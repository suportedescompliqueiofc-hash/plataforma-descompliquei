-- Cron job para analisar leads sem retorno (followup gap)
-- Roda a cada 15 minutos para todas as orgs
-- Classifica leads como PRECISA_FOLLOW ou ENCERRADO via IA (DeepSeek)
-- Janela: leads com ultimo_contato nos últimos 3 dias, silenciosos há 10+ min

SELECT cron.schedule(
  'analyze-followup-need',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://noncbgdczgcboronmcah.supabase.co/functions/v1/analyze-followup-need',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbmNiZ2RjemdjYm9yb25tY2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMTgxNjUsImV4cCI6MjA4MjU5NDE2NX0.2oWe_oyHb4Y7MB5DspkpcfHCaUR8tu6W2Vco-cAPtgM"}'::jsonb
  )
  $$
);
