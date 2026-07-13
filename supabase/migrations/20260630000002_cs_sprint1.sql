-- CS Sprint 1 — Marcos, colunas adicionais e flags de resultado

-- Tabela de marcos por cliente
CREATE TABLE IF NOT EXISTS cs_marcos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  marco text NOT NULL,
  atingido boolean NOT NULL DEFAULT false,
  atingido_em timestamptz,
  automatico boolean NOT NULL DEFAULT false,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cs_marcos_client_marco_unique UNIQUE (client_id, marco)
);

ALTER TABLE cs_marcos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_marcos_all" ON cs_marcos USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cs_marcos_client ON cs_marcos(client_id);

-- Colunas adicionais em cs_touchpoints
ALTER TABLE cs_touchpoints
  ADD COLUMN IF NOT EXISTS sinal_risco integer CHECK (sinal_risco BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS playbook_tipo text,
  ADD COLUMN IF NOT EXISTS playbook_passo text,
  ADD COLUMN IF NOT EXISTS cliente_faltou boolean;

-- Colunas adicionais em cs_health_scores (descrição qualitativa do CRM)
ALTER TABLE cs_health_scores
  ADD COLUMN IF NOT EXISTS dim_crm_label text;

-- Colunas adicionais em platform_users (resultado declarado + status renovação)
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS cs_resultado_declarado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cs_resultado_declarado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cs_renovacao_status text CHECK (
    cs_renovacao_status IN ('em_acompanhamento', 'retrospectiva_agendada', 'proposta_enviada', 'confirmado', 'em_risco')
  );
