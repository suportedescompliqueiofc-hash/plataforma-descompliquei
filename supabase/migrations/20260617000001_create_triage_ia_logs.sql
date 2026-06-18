-- Tabela de logs da triagem de ativação da IA de pré-atendimento
CREATE TABLE IF NOT EXISTS triage_ia_logs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid       NOT NULL,
  lead_id        uuid,
  lead_nome      text,
  mensagem       text,
  tipo_mensagem  text,
  decisao        boolean     NOT NULL,
  motivo         text,
  modelo         text        DEFAULT 'deepseek/deepseek-v4-flash',
  duracao_ms     integer,
  origem_lead    text,
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS triage_ia_logs_org_idx
  ON triage_ia_logs (organization_id, created_at DESC);

ALTER TABLE triage_ia_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read triage logs"
  ON triage_ia_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM perfis WHERE id = auth.uid()
    )
  );
