-- Cron job para processar notificações de ações outbound pendentes
-- Roda a cada 5 minutos e cria notificações na tabela 'notificacoes'
-- quando um prospecto tem proxima_acao_data vencendo

SELECT cron.schedule(
  'process-outbound-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://noncbgdczgcboronmcah.supabase.co/functions/v1/process-outbound-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbmNiZ2RjemdjYm9yb25tY2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMTgxNjUsImV4cCI6MjA4MjU5NDE2NX0.2oWe_oyHb4Y7MB5DspkpcfHCaUR8tu6W2Vco-cAPtgM"}'::jsonb
  )
  $$
);
