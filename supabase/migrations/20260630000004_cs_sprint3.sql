-- CS Sprint 3 — Pipeline de Renovação

CREATE TABLE IF NOT EXISTS cs_renovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'em_acompanhamento' CHECK (
    status IN ('em_acompanhamento', 'retrospectiva_agendada', 'proposta_enviada', 'confirmado', 'em_risco')
  ),
  valor_contrato numeric(12,2),
  notas text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cs_renovacoes_client_unique UNIQUE (client_id)
);

ALTER TABLE cs_renovacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_renovacoes_all" ON cs_renovacoes USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cs_renovacoes_client ON cs_renovacoes(client_id);
CREATE INDEX IF NOT EXISTS idx_cs_renovacoes_status ON cs_renovacoes(status);
CREATE INDEX IF NOT EXISTS idx_cs_renovacoes_vencimento ON cs_renovacoes(data_vencimento);
