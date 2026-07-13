-- Distingue follow-up AUTOMÁTICO (fluxo da IA de atendimento, ia_ativa=true)
-- de follow-up MANUAL (resgate ativado no botão "Follow IA", followup_manual=true).
-- Antes desta coluna, a UI inferia o tipo pelo estado ATUAL do lead (join em
-- leads.followup_manual), o que é furado: um lead seguido no automático e depois
-- reativado como manual aparecia com TODO o histórico marcado como "manual".
-- Agora o tipo é carimbado no MOMENTO do envio pela edge function ia-followup-agent.

ALTER TABLE public.ia_followup_log
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'automatico';

ALTER TABLE public.ia_followup_log
  DROP CONSTRAINT IF EXISTS ia_followup_log_tipo_check;

ALTER TABLE public.ia_followup_log
  ADD CONSTRAINT ia_followup_log_tipo_check
  CHECK (tipo IN ('automatico', 'manual'));

-- Backfill aproximado dos registros antigos: usa o estado atual do lead como
-- melhor palpite disponível (não há histórico da flag no passado).
UPDATE public.ia_followup_log f
SET tipo = 'manual'
FROM public.leads l
WHERE l.id = f.lead_id
  AND l.followup_manual IS TRUE
  AND f.tipo <> 'manual';

CREATE INDEX IF NOT EXISTS idx_ia_followup_log_org_tipo_enviado
  ON public.ia_followup_log (organization_id, tipo, enviado_em DESC);
