ALTER TABLE public.onboarding_progresso
  ADD COLUMN IF NOT EXISTS historico_conversa jsonb NOT NULL DEFAULT '[]';
