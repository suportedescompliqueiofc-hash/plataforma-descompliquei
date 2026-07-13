-- CS — Tabela de depoimentos coletados por cliente

CREATE TABLE IF NOT EXISTS cs_depoimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  formato text NOT NULL CHECK (formato IN ('audio', 'video', 'texto', 'case')),
  conteudo text,
  link_externo text,
  coletado_por uuid REFERENCES auth.users(id),
  coletado_em timestamptz NOT NULL DEFAULT now(),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cs_depoimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_depoimentos_all" ON cs_depoimentos USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cs_depoimentos_client ON cs_depoimentos(client_id);
