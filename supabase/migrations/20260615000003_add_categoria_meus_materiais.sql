ALTER TABLE public.meus_materiais
  ADD COLUMN IF NOT EXISTS categoria text;

CREATE INDEX IF NOT EXISTS idx_meus_materiais_user_categoria
  ON public.meus_materiais (user_id, categoria)
  WHERE categoria IS NOT NULL;
