-- ══════════════════════════════════════════════════════════════════
-- Athos Escriba — enriquecimento passivo do lead
-- ──────────────────────────────────────────────────────────────────
-- Lê a conversa (IA OU humana) e mantém preenchidos: resumo, procedimento
-- de interesse (pode ser mais de um), objetivo estético e objeção.
-- Diferente do Pré-Atendimento, que só grava enquanto a IA responde.
-- ══════════════════════════════════════════════════════════════════

-- 1) Colunas de estado + campos extraídos
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS enriquecido_em     timestamptz,
  ADD COLUMN IF NOT EXISTS precisa_enriquecer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS objetivo           text,
  ADD COLUMN IF NOT EXISTS objecao            text;

-- 2) Índice parcial: o cron só varre a fila
CREATE INDEX IF NOT EXISTS idx_leads_precisa_enriquecer
  ON leads (ultimo_contato)
  WHERE precisa_enriquecer = true;

-- 3) Sempre que houver novo contato, marca o lead para re-enriquecer.
--    (O trigger de mensagens já atualiza leads.ultimo_contato a cada msg.)
--    BEFORE UPDATE modifica NEW no lugar — sem recursão. O UPDATE do próprio
--    Escriba não mexe em ultimo_contato, então não re-enfileira.
CREATE OR REPLACE FUNCTION mark_lead_precisa_enriquecer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ultimo_contato IS DISTINCT FROM OLD.ultimo_contato
     AND NEW.ultimo_contato IS NOT NULL THEN
    NEW.precisa_enriquecer := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_precisa_enriquecer ON leads;
CREATE TRIGGER trg_mark_precisa_enriquecer
BEFORE UPDATE OF ultimo_contato ON leads
FOR EACH ROW EXECUTE FUNCTION mark_lead_precisa_enriquecer();

-- 4) Cron a cada 5 minutos (a função aplica debounce de ~3 min internamente)
SELECT cron.schedule(
  'athos-escriba',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://noncbgdczgcboronmcah.supabase.co/functions/v1/athos-escriba',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbmNiZ2RjemdjYm9yb25tY2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMTgxNjUsImV4cCI6MjA4MjU5NDE2NX0.2oWe_oyHb4Y7MB5DspkpcfHCaUR8tu6W2Vco-cAPtgM"}'::jsonb
  )
  $$
);

-- 5) Backfill enxuto: leads ativos nos últimos 30 dias entram na fila uma vez.
--    (Evita floodar o cron com a base inteira; o resto enriquece no próximo contato.)
UPDATE leads l
SET precisa_enriquecer = true
WHERE l.ultimo_contato > now() - interval '30 days'
  AND EXISTS (SELECT 1 FROM mensagens m WHERE m.lead_id = l.id);
