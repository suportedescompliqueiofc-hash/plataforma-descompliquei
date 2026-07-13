-- Substitui o trigger anterior para marcar leads como PENDENTE quando
-- a equipe/IA envia mensagem, e limpar quando o lead responde.
-- Remove completamente a dependência de janela de datas.

CREATE OR REPLACE FUNCTION update_lead_ultimo_contato()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.direcao = 'entrada' THEN
    -- Lead respondeu: limpa follow-up em aberto imediatamente
    UPDATE leads
    SET
      ultimo_contato = NEW.criado_em,
      followup_gap = NULL,
      followup_gap_analisado_em = NULL
    WHERE id = NEW.lead_id;
  ELSE
    -- Equipe ou IA enviou: marca como PENDENTE para análise após 10 min
    UPDATE leads
    SET
      ultimo_contato = NEW.criado_em,
      followup_gap = 'PENDENTE',
      followup_gap_analisado_em = NULL
    WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar cron para rodar a cada 5 minutos (workload muito mais leve agora)
SELECT cron.unschedule('analyze-followup-need');

SELECT cron.schedule(
  'analyze-followup-need',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://noncbgdczgcboronmcah.supabase.co/functions/v1/analyze-followup-need',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbmNiZ2RjemdjYm9yb25tY2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMTgxNjUsImV4cCI6MjA4MjU5NDE2NX0.2oWe_oyHb4Y7MB5DspkpcfHCaUR8tu6W2Vco-cAPtgM"}'::jsonb
  )
  $$
);

-- Backfill: marcar como PENDENTE todos os leads cujo último
-- contato foi saída (equipe/bot, excluindo IA) e não houve
-- resposta do lead depois. Preserva os já classificados como PRECISA_FOLLOW.
UPDATE leads l
SET followup_gap = 'PENDENTE', followup_gap_analisado_em = NULL
FROM (
  SELECT DISTINCT ON (lead_id) lead_id, direcao, remetente
  FROM mensagens
  WHERE lead_id IS NOT NULL
  ORDER BY lead_id, criado_em DESC
) last_msg
WHERE l.id = last_msg.lead_id
  AND last_msg.direcao = 'saida'
  AND last_msg.remetente != 'ia'
  AND l.followup_gap IS DISTINCT FROM 'PRECISA_FOLLOW'
  AND (l.is_closed = false OR l.is_closed IS NULL)
  AND NOT EXISTS (SELECT 1 FROM vendas WHERE lead_id = l.id);
