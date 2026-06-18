-- Adiciona suporte a aulas do arsenal em jornada_passos
ALTER TABLE jornada_passos
  ADD COLUMN IF NOT EXISTS aula_id uuid REFERENCES arsenal_aulas(id) ON DELETE SET NULL;
