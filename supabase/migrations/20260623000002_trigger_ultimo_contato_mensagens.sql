-- Trigger que atualiza leads.ultimo_contato sempre que uma nova mensagem é inserida
-- Isso garante que o cron analyze-followup-need sempre encontre candidatos recentes

CREATE OR REPLACE FUNCTION update_lead_ultimo_contato()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE leads
    SET
      ultimo_contato = NEW.criado_em,
      -- Reseta a análise para que o cron reclassifique o lead após nova mensagem
      followup_gap_analisado_em = NULL,
      followup_gap = NULL
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_lead_ultimo_contato ON mensagens;

CREATE TRIGGER trg_update_lead_ultimo_contato
AFTER INSERT ON mensagens
FOR EACH ROW
EXECUTE FUNCTION update_lead_ultimo_contato();
