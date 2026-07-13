-- Lista de clientes do módulo CS, agregada server-side (SECURITY DEFINER) para
-- eliminar a fragilidade de RLS do client-side: dependendo de quem acessava
-- (superadmin em platform_admins vs. superadmin comum, ou org residual de
-- impersonação), o join de organizations voltava null (nome de membro no lugar
-- do nome da clínica) e platform_users vinha incompleto (cliente sumindo).
-- Aqui rodamos tudo bypassando RLS e devolvemos exatamente uma linha por org.
CREATE OR REPLACE FUNCTION get_cs_clients()
RETURNS TABLE (
  id uuid,
  crm_user_id uuid,
  organization_id uuid,
  clinic_name text,
  nome_completo text,
  product_name text,
  cs_fase text,
  cs_fase_desde date,
  cs_health_status text,
  cs_ultimo_touchpoint timestamptz,
  cs_proximo_touchpoint date,
  onboarding_concluido boolean,
  onboarding_complete boolean,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Os OUT params do RETURNS TABLE (id, crm_user_id, ...) viram variáveis plpgsql
-- e colidem com a lista de colunas do INSERT INTO platform_users (id, crm_user_id).
-- use_column resolve identificadores ambíguos como coluna — sem isso a função
-- lança "column reference id is ambiguous" em TODA chamada e a lista de clientes
-- do CS vem vazia no frontend (erro engolido pelo react-query → [] → "0 na base").
#variable_conflict use_column
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Provisiona platform_users para o dono de orgs elegíveis que nunca logaram
  -- na plataforma (o registro é criado lazy no primeiro login). Sem isso, esses
  -- clientes — justamente os "comprou e nunca ativou" — somem da lista.
  INSERT INTO platform_users (id, crm_user_id, plan)
  SELECT perfil_id, perfil_id, 'pca'
  FROM (
    SELECT DISTINCT ON (r.organization_id) r.perfil_id
    FROM (
      SELECT p.organization_id, p.id AS perfil_id,
        (CASE WHEN up_a.usuario_id IS NOT NULL THEN 2
              WHEN up_s.usuario_id IS NOT NULL THEN 0 ELSE 1 END) AS prio
      FROM perfis p
      LEFT JOIN usuarios_papeis up_a ON up_a.usuario_id = p.id AND up_a.papel = 'admin'
      LEFT JOIN usuarios_papeis up_s ON up_s.usuario_id = p.id AND up_s.papel = 'superadmin'
      WHERE p.organization_id IS NOT NULL
    ) r
    WHERE r.prio > 0
      AND EXISTS (
        SELECT 1 FROM platform_tenants t
        WHERE t.organization_id = r.organization_id
          AND t.product_id IS DISTINCT FROM '1fa00b04-87f2-4196-ad49-937995c08349'
      )
      AND NOT EXISTS (
        SELECT 1 FROM platform_users pu2
        JOIN perfis p2 ON p2.id = pu2.id
        WHERE p2.organization_id = r.organization_id
      )
    ORDER BY r.organization_id, r.prio DESC, r.perfil_id
  ) missing
  ON CONFLICT (id) DO NOTHING;

  RETURN QUERY
  WITH sa AS (SELECT usuario_id FROM usuarios_papeis WHERE papel = 'superadmin'),
  adm AS (SELECT usuario_id FROM usuarios_papeis WHERE papel = 'admin'),
  elig AS (
    SELECT DISTINCT ON (t.organization_id)
      t.organization_id, t.product_id, t.created_at, o.name AS org_name
    FROM platform_tenants t
    JOIN organizations o ON o.id = t.organization_id
    WHERE t.product_id IS DISTINCT FROM '1fa00b04-87f2-4196-ad49-937995c08349'
    ORDER BY t.organization_id, t.created_at DESC
  ),
  org_real AS (
    SELECT DISTINCT p.organization_id FROM perfis p
    WHERE p.organization_id IS NOT NULL AND p.id NOT IN (SELECT usuario_id FROM sa)
  ),
  ranked AS (
    SELECT p.organization_id, p.id AS perfil_id, p.nome_completo,
      (CASE WHEN p.id IN (SELECT usuario_id FROM adm) THEN 2
            WHEN p.id IN (SELECT usuario_id FROM sa) THEN 0 ELSE 1 END) AS prio
    FROM perfis p
  ),
  chosen AS (
    SELECT DISTINCT ON (r.organization_id) r.organization_id, r.perfil_id, r.nome_completo
    FROM ranked r
    JOIN platform_users pu ON pu.id = r.perfil_id
    ORDER BY r.organization_id, r.prio DESC,
      (CASE WHEN pu.cs_fase IS NOT NULL OR pu.cs_ultimo_touchpoint IS NOT NULL THEN 0 ELSE 1 END),
      r.perfil_id
  )
  SELECT
    pu.id,
    pu.crm_user_id,
    e.organization_id,
    COALESCE(NULLIF(BTRIM(e.org_name), ''), NULLIF(BTRIM(pu.clinic_name), '')) AS clinic_name,
    c.nome_completo,
    pp.nome AS product_name,
    pu.cs_fase,
    pu.cs_fase_desde,
    pu.cs_health_status,
    pu.cs_ultimo_touchpoint,
    pu.cs_proximo_touchpoint,
    pu.onboarding_concluido,
    pu.onboarding_complete,
    e.created_at AS joined_at
  FROM elig e
  JOIN org_real orl ON orl.organization_id = e.organization_id
  JOIN chosen c ON c.organization_id = e.organization_id
  JOIN platform_users pu ON pu.id = c.perfil_id
  LEFT JOIN platform_products pp ON pp.id = e.product_id
  ORDER BY clinic_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cs_clients() TO authenticated;
