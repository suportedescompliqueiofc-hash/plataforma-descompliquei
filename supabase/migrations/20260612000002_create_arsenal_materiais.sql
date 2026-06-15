-- Arsenal Materiais Complementares: materiais por ferramenta (PDF ou HTML)

CREATE TABLE IF NOT EXISTS arsenal_materiais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id uuid NOT NULL REFERENCES arsenal_ferramentas(id) ON DELETE CASCADE,
  titulo        text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('pdf', 'html')),
  pdf_url       text,
  conteudo_html text,
  ordem         int NOT NULL DEFAULT 0,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE arsenal_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arsenal materiais leitura" ON arsenal_materiais
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Arsenal materiais insert" ON arsenal_materiais
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Arsenal materiais update" ON arsenal_materiais
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Arsenal materiais delete" ON arsenal_materiais
  FOR DELETE TO authenticated USING (true);
