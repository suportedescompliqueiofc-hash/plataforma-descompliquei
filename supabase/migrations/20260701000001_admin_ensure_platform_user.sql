-- Permite que o CS provisione platform_users para clientes que compraram um produto
-- da plataforma mas nunca fizeram login (portanto nunca geraram o registro lazy em
-- PlataformaContext.tsx). Sem isso, esses clientes somem da lista de CS porque não
-- existe client_id (platform_users.id) para vincular touchpoints/health scores.
-- SECURITY DEFINER: só executa a criação se quem chama é superadmin, ou se está
-- criando o próprio registro (mesmo caso de uso do fluxo normal de login).
CREATE OR REPLACE FUNCTION admin_ensure_platform_user(p_user_id UUID)
RETURNS platform_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row platform_users;
  v_is_superadmin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM usuarios_papeis
    WHERE usuario_id = auth.uid() AND papel = 'superadmin'
  ) INTO v_is_superadmin;

  IF NOT v_is_superadmin AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_row FROM platform_users WHERE id = p_user_id;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO platform_users (id, crm_user_id, plan)
  VALUES (p_user_id, p_user_id, 'pca')
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_row FROM platform_users WHERE id = p_user_id;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_ensure_platform_user(UUID) TO authenticated;
