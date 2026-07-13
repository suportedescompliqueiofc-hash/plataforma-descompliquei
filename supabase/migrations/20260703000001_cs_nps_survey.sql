-- NPS via pesquisa direta ao cliente — templates + campanhas + popup no CRM
--
-- Até aqui, cs_nps_responses só era escrita pelo time de CS via Admin OS (RLS
-- USING(true) totalmente aberta, gate só de UI). Agora o cliente final passa a
-- ler/escrever nela pelo popup do CRM, então a RLS precisa ficar restritiva de
-- verdade. NOTA: usuarios_papeis.papel = 'admin' é atribuído a TODO dono de
-- clínica (useProfile.ts) — não é o papel de staff interno. O papel de staff
-- real é 'superadmin' (exato) OU presença em platform_admins, igual ao
-- isCallerAdmin() da edge function cs-athos. Usar is_admin()/is_super_admin()
-- aqui reabriria a mesma falha (qualquer cliente é "admin" da própria org).

-- ── Templates de pergunta de NPS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cs_nps_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  pergunta text NOT NULL,
  variaveis text[] DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cs_nps_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_nps_templates_all" ON cs_nps_templates USING (true) WITH CHECK (true);

-- ── Campanhas (disparo de pesquisa para um cliente) ─────────────────────────

CREATE TABLE IF NOT EXISTS cs_nps_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES cs_nps_templates(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondida', 'cancelada')),
  disparado_por uuid REFERENCES auth.users(id),
  disparado_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz,
  snoozed_until timestamptz,
  snooze_count integer NOT NULL DEFAULT 0,
  cancelado_por uuid REFERENCES auth.users(id),
  cancelado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo 1 campanha pendente por cliente (v1: disparo manual, um por vez).
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_nps_campanhas_one_pending
  ON cs_nps_campanhas(client_id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_cs_nps_campanhas_client ON cs_nps_campanhas(client_id);
CREATE INDEX IF NOT EXISTS idx_cs_nps_campanhas_status ON cs_nps_campanhas(status);

ALTER TABLE cs_nps_campanhas ENABLE ROW LEVEL SECURITY;

-- Leitura aberta (consistente com o restante do módulo CS). Escrita restrita a
-- staff real — o cliente nunca grava nesta tabela direto, só via as funções
-- SECURITY DEFINER abaixo (que ignoram RLS e validam client_id = auth.uid()).
CREATE POLICY "cs_nps_campanhas_select" ON cs_nps_campanhas FOR SELECT USING (true);
CREATE POLICY "cs_nps_campanhas_staff_write" ON cs_nps_campanhas FOR ALL USING (
  EXISTS (SELECT 1 FROM usuarios_papeis WHERE usuario_id = auth.uid() AND papel = 'superadmin')
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios_papeis WHERE usuario_id = auth.uid() AND papel = 'superadmin')
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- ── cs_nps_responses: vínculo com a campanha + RLS restritiva ───────────────

ALTER TABLE cs_nps_responses ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES cs_nps_campanhas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cs_nps_responses_campanha ON cs_nps_responses(campanha_id);

DROP POLICY IF EXISTS "cs_nps_responses_all" ON cs_nps_responses;

CREATE POLICY "cs_nps_responses_select" ON cs_nps_responses FOR SELECT USING (
  client_id = auth.uid()
  OR EXISTS (SELECT 1 FROM usuarios_papeis WHERE usuario_id = auth.uid() AND papel = 'superadmin')
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

CREATE POLICY "cs_nps_responses_staff_write" ON cs_nps_responses FOR ALL USING (
  EXISTS (SELECT 1 FROM usuarios_papeis WHERE usuario_id = auth.uid() AND papel = 'superadmin')
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios_papeis WHERE usuario_id = auth.uid() AND papel = 'superadmin')
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- ── Funções SECURITY DEFINER chamadas pelo cliente final ────────────────────
-- client_id em cs_nps_campanhas/cs_nps_responses é sempre platform_users.id,
-- que é 1:1 com o auth.uid() do dono da clínica — por isso basta comparar com
-- auth.uid() para garantir que o cliente só vê/responde a própria pesquisa.

CREATE OR REPLACE FUNCTION get_pending_nps_survey()
RETURNS TABLE(campanha_id uuid, template_id uuid, pergunta text, disparado_em timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.template_id, t.pergunta, c.disparado_em
  FROM cs_nps_campanhas c
  JOIN cs_nps_templates t ON t.id = c.template_id
  WHERE c.client_id = auth.uid()
    AND c.status = 'pendente'
    AND (c.snoozed_until IS NULL OR c.snoozed_until <= now())
  ORDER BY c.disparado_em DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_nps_survey() TO authenticated;

CREATE OR REPLACE FUNCTION submit_nps_response(p_campanha_id uuid, p_score int, p_comentario text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_score IS NULL OR p_score < 0 OR p_score > 10 THEN
    RAISE EXCEPTION 'score inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cs_nps_campanhas
    WHERE id = p_campanha_id AND client_id = auth.uid() AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'campanha inválida ou já respondida';
  END IF;

  INSERT INTO cs_nps_responses (client_id, score, comentario, coletado_por, campanha_id, respondido_em)
  VALUES (auth.uid(), p_score, p_comentario, auth.uid(), p_campanha_id, now());

  UPDATE cs_nps_campanhas SET status = 'respondida', respondido_em = now()
  WHERE id = p_campanha_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_nps_response(uuid, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION snooze_nps_survey(p_campanha_id uuid, p_dias int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cs_nps_campanhas
  SET snoozed_until = now() + (p_dias || ' days')::interval,
      snooze_count = snooze_count + 1
  WHERE id = p_campanha_id AND client_id = auth.uid() AND status = 'pendente';
END;
$$;

GRANT EXECUTE ON FUNCTION snooze_nps_survey(uuid, int) TO authenticated;
