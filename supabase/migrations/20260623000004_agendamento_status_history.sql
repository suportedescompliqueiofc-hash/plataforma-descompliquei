-- Histórico de mudanças de status dos agendamentos
CREATE TABLE IF NOT EXISTS agendamento_status_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id  uuid        NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL,
  status_anterior text,
  status_novo     text        NOT NULL,
  alterado_em     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agendamento_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON agendamento_status_history
  FOR ALL USING (organization_id = (
    SELECT organization_id FROM perfis WHERE id = auth.uid() LIMIT 1
  ));

-- Índices
CREATE INDEX IF NOT EXISTS idx_agend_status_hist_agend   ON agendamento_status_history(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_agend_status_hist_org     ON agendamento_status_history(organization_id);

-- Trigger que registra cada mudança de status
CREATE OR REPLACE FUNCTION track_agendamento_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO agendamento_status_history (agendamento_id, organization_id, status_anterior, status_novo)
    VALUES (NEW.id, NEW.organization_id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_agendamento_status ON agendamentos;
CREATE TRIGGER trg_track_agendamento_status
  AFTER UPDATE ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION track_agendamento_status_change();
