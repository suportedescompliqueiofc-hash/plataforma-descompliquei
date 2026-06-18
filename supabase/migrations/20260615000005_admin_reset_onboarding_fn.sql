-- Função SECURITY DEFINER para reset de onboarding de um cliente pelo admin
-- Contorna RLS (admin não tem permissão direta de DELETE nas tabelas do cliente)

CREATE OR REPLACE FUNCTION admin_reset_platform_onboarding(
  p_platform_user_id uuid,
  p_auth_user_id     uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reseta flags na tabela platform_users
  UPDATE platform_users SET
    onboarding_concluido        = false,
    platform_onboarding_enabled = true,
    platform_onboarding_steps   = '{}',
    onboarding_iniciado_em      = null,
    onboarding_concluido_em     = null
  WHERE id = p_platform_user_id;

  -- Remove dados de diagnóstico
  DELETE FROM onboarding_diagnosticos WHERE user_id = p_auth_user_id;
  DELETE FROM onboarding_progresso    WHERE user_id = p_auth_user_id;

  -- Remove jornada (CASCADE apaga estágios e passos automaticamente)
  DELETE FROM jornadas WHERE user_id = p_auth_user_id;

  -- Remove material de diagnóstico do Meus Materiais
  DELETE FROM meus_materiais WHERE user_id = p_auth_user_id AND categoria = 'diagnostico';

  -- Remove conversas OS do agente de onboarding
  DELETE FROM os_conversations WHERE user_id = p_auth_user_id AND agente_slug = 'onboarding';
END;
$$;

-- Somente usuários autenticados podem chamar (checagem de superadmin fica no frontend)
REVOKE ALL ON FUNCTION admin_reset_platform_onboarding(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reset_platform_onboarding(uuid, uuid) TO authenticated;
