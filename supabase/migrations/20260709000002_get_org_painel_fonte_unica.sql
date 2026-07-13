-- ═══════════════════════════════════════════════════════════════════════════
-- get_org_painel — FONTE ÚNICA da Visão Geral (dashboard do cliente + Athos CS)
-- Retorna, por bucket de origem (geral/marketing/organico/reativacao/convenio/
-- paciente), os 2 modos do painel:
--   atividade   = leads com atividade real no período (criado OU mql OU agend OU venda),
--                 exigindo estar no "array de leads" (criado OU atualizado no período).
--   cadastrados = leads CRIADOS no período.
-- Métricas: leads, vendas (linhas), faturamento (SUM), ticket (= fat / VENDAS, por
-- transação), conversao_pct (= clientes fechados únicos / leads). Timestamp em FUSO BRT.
-- Gate: própria org (dono/equipe da clínica) OU superadmin/admin (CS cross-org).
-- get_cs_client_raio_x delega o bloco `painel` a esta função (mesmos números no Athos).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_org_painel(p_org_id uuid, p_from date, p_to date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  tsf timestamptz := (p_from::timestamp AT TIME ZONE 'America/Sao_Paulo');
  tst timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  result jsonb;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND organization_id = p_org_id)
    OR is_super_admin() OR is_admin()
  ) THEN RAISE EXCEPTION 'not authorized'; END IF;

  WITH la AS (
    SELECT l.id,
      (CASE WHEN l.origem IN ('organico','indicacao') THEN 'organico' WHEN l.origem='convenio' THEN 'convenio'
            WHEN l.origem='marketing' THEN 'marketing' WHEN l.origem='reativacao' THEN 'reativacao'
            WHEN l.origem='paciente' THEN 'paciente' ELSE 'outros' END) AS bucket,
      (l.criado_em>=tsf AND l.criado_em<tst) AS created_in,
      ((l.criado_em>=tsf AND l.criado_em<tst) OR (l.atualizado_em>=tsf AND l.atualizado_em<tst)) AS in_array,
      (l.criado_em>=tsf AND l.criado_em<tst
        OR EXISTS (SELECT 1 FROM lead_notas n WHERE n.lead_id=l.id AND n.tipo='sistema' AND n.metadados->>'evento'='mql' AND n.criado_em>=tsf AND n.criado_em<tst)
        OR EXISTS (SELECT 1 FROM agendamentos a WHERE a.lead_id=l.id AND a.organization_id=p_org_id AND a.data_hora_inicio>=tsf AND a.data_hora_inicio<tst)
        OR EXISTS (SELECT 1 FROM vendas v WHERE v.lead_id=l.id AND v.organization_id=p_org_id AND v.data_fechamento BETWEEN p_from AND p_to)
      ) AS has_activity
    FROM leads l
    WHERE l.organization_id=p_org_id AND l.fonte IS DISTINCT FROM 'importado' AND NOT COALESCE(l.excluir_metricas,false)
  ),
  vd AS (
    SELECT v.lead_id,
      (CASE WHEN l.origem IN ('organico','indicacao') THEN 'organico' WHEN l.origem='convenio' THEN 'convenio'
            WHEN l.origem='marketing' THEN 'marketing' WHEN l.origem='reativacao' THEN 'reativacao'
            WHEN l.origem='paciente' THEN 'paciente' ELSE 'outros' END) AS bucket,
      v.valor_fechado,
      (l.criado_em>=tsf AND l.criado_em<tst) AS lead_created_in
    FROM vendas v LEFT JOIN leads l ON l.id=v.lead_id
    WHERE v.organization_id=p_org_id AND v.data_fechamento BETWEEN p_from AND p_to AND v.valor_fechado IS NOT NULL
  ),
  buckets AS (SELECT unnest(ARRAY['geral','marketing','organico','reativacao','convenio','paciente']) AS bucket),
  agg AS (
    SELECT b.bucket,
      (SELECT count(*) FROM la WHERE has_activity AND in_array AND (la.bucket=b.bucket OR (b.bucket='geral' AND la.bucket<>'paciente'))) AS ativ_leads,
      (SELECT count(*) FROM la WHERE created_in AND (la.bucket=b.bucket OR (b.bucket='geral' AND la.bucket<>'paciente'))) AS cad_leads,
      (SELECT count(*) FROM vd WHERE (vd.bucket=b.bucket OR (b.bucket='geral' AND vd.bucket<>'paciente'))) AS ativ_vendas,
      (SELECT count(DISTINCT lead_id) FROM vd WHERE (vd.bucket=b.bucket OR (b.bucket='geral' AND vd.bucket<>'paciente'))) AS ativ_fechados,
      (SELECT COALESCE(SUM(valor_fechado),0) FROM vd WHERE (vd.bucket=b.bucket OR (b.bucket='geral' AND vd.bucket<>'paciente'))) AS ativ_fat,
      (SELECT count(*) FROM vd WHERE lead_created_in AND (vd.bucket=b.bucket OR (b.bucket='geral' AND vd.bucket<>'paciente'))) AS cad_vendas,
      (SELECT count(DISTINCT lead_id) FROM vd WHERE lead_created_in AND (vd.bucket=b.bucket OR (b.bucket='geral' AND vd.bucket<>'paciente'))) AS cad_fechados,
      (SELECT COALESCE(SUM(valor_fechado),0) FROM vd WHERE lead_created_in AND (vd.bucket=b.bucket OR (b.bucket='geral' AND vd.bucket<>'paciente'))) AS cad_fat
    FROM buckets b
  )
  SELECT jsonb_object_agg(bucket, jsonb_build_object(
    'atividade', jsonb_build_object(
      'leads', ativ_leads, 'vendas', ativ_vendas, 'faturamento', ativ_fat,
      'ticket', CASE WHEN ativ_vendas>0 THEN round(ativ_fat/ativ_vendas) ELSE 0 END,
      'conversao_pct', CASE WHEN ativ_leads>0 THEN round(ativ_fechados::numeric/ativ_leads*100,1) ELSE 0 END
    ),
    'cadastrados', jsonb_build_object(
      'leads', cad_leads, 'vendas', cad_vendas, 'faturamento', cad_fat,
      'ticket', CASE WHEN cad_vendas>0 THEN round(cad_fat/cad_vendas) ELSE 0 END,
      'conversao_pct', CASE WHEN cad_leads>0 THEN round(cad_fechados::numeric/cad_leads*100,1) ELSE 0 END
    )
  )) INTO result FROM agg;
  RETURN result;
END; $function$;
