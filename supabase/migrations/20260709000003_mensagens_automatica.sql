-- ══════════════════════════════════════════════════════════════════
-- Distinguir mensagens AUTOMÁTICAS do sistema (confirmação/lembrete de
-- agendamento) das respostas reais da IA de pré-atendimento.
-- Ambas eram gravadas como remetente='bot', inflando as métricas de IA
-- e sendo lidas como handoff/interferência humana no painel.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE mensagens
  ADD COLUMN IF NOT EXISTS automatica boolean NOT NULL DEFAULT false;

-- Backfill: mensagens de confirmação/lembrete já enviadas (por padrão de conteúdo dos templates)
UPDATE mensagens
SET automatica = true
WHERE remetente = 'bot'
  AND direcao = 'saida'
  AND automatica = false
  AND (
    conteudo ILIKE '%Lembramos que você tem%'
    OR conteudo ILIKE '%foi confirmad%'
    OR conteudo ILIKE '%Confirme sua presença%'
    OR conteudo ILIKE '%atendimento agendado para%'
    OR conteudo ILIKE '%reunião agendada%'
  );
