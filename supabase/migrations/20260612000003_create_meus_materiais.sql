-- Meus Materiais: área de construção pessoal do usuário na plataforma
-- Armazena documentos livres e construções vindas do Arsenal

CREATE TABLE IF NOT EXISTS meus_materiais (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo              text NOT NULL DEFAULT 'Sem título',
  conteudo            text NOT NULL DEFAULT '',
  categoria_arsenal_id uuid REFERENCES arsenal_categorias(id) ON DELETE SET NULL,
  ferramenta_id       uuid REFERENCES arsenal_ferramentas(id) ON DELETE SET NULL,
  criado_manualmente  boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meus_materiais_user_idx ON meus_materiais(user_id);

-- Partial unique index: allows multiple manual docs (ferramenta_id IS NULL)
-- but enforces one doc per arsenal ferramenta per user
CREATE UNIQUE INDEX IF NOT EXISTS meus_materiais_user_ferramenta_uidx
  ON meus_materiais(user_id, ferramenta_id)
  WHERE ferramenta_id IS NOT NULL;

ALTER TABLE meus_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meus materiais select" ON meus_materiais
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Meus materiais insert" ON meus_materiais
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Meus materiais update" ON meus_materiais
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Meus materiais delete" ON meus_materiais
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
