-- Suporte a lembretes de horário fixo ("X dias antes, às HH:MM") além do modo relativo.
-- A dedup dos lembretes passa a ser feita por chave_lembrete (o antecedencia_minutos
-- inteiro não identifica um lembrete de horário fixo, cuja antecedência varia por agendamento).

ALTER TABLE agendamento_notificacoes
  ADD COLUMN IF NOT EXISTS chave_lembrete text;

-- Backfill dos registros existentes (todos são do modo relativo).
UPDATE agendamento_notificacoes
  SET chave_lembrete = 'rel:' || antecedencia_minutos
  WHERE chave_lembrete IS NULL;

-- Índice para a query de dedup (agendamento_id + chave_lembrete).
CREATE INDEX IF NOT EXISTS idx_agendamento_notificacoes_chave
  ON agendamento_notificacoes (agendamento_id, chave_lembrete);
