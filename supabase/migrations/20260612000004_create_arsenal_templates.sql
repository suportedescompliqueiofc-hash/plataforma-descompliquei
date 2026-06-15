-- Templates do Arsenal: conteúdo pré-estruturado vinculado a ferramenta + categoria
-- Gerenciados pelo admin via Supabase dashboard; lidos pelos usuários da plataforma

CREATE TABLE IF NOT EXISTS arsenal_templates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo               text NOT NULL,
  descricao            text,
  conteudo             text NOT NULL DEFAULT '',
  ferramenta_id        uuid NOT NULL REFERENCES arsenal_ferramentas(id) ON DELETE CASCADE,
  categoria_arsenal_id uuid NOT NULL REFERENCES arsenal_categorias(id) ON DELETE CASCADE,
  ordem                int NOT NULL DEFAULT 0,
  ativo                boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arsenal_templates_ferramenta_idx ON arsenal_templates(ferramenta_id);
CREATE INDEX IF NOT EXISTS arsenal_templates_categoria_idx  ON arsenal_templates(categoria_arsenal_id);

ALTER TABLE arsenal_templates ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler templates ativos
CREATE POLICY "Arsenal templates leitura" ON arsenal_templates
  FOR SELECT TO authenticated USING (ativo = true);
