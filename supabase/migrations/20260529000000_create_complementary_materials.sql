-- Bucket para PDFs dos materiais complementares
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-complementary',
  'platform-complementary',
  true,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public read platform-complementary" ON storage.objects;
CREATE POLICY "Public read platform-complementary" ON storage.objects
  FOR SELECT USING (bucket_id = 'platform-complementary');

DROP POLICY IF EXISTS "Auth upload platform-complementary" ON storage.objects;
CREATE POLICY "Auth upload platform-complementary" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'platform-complementary');

DROP POLICY IF EXISTS "Auth update platform-complementary" ON storage.objects;
CREATE POLICY "Auth update platform-complementary" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'platform-complementary');

DROP POLICY IF EXISTS "Auth delete platform-complementary" ON storage.objects;
CREATE POLICY "Auth delete platform-complementary" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'platform-complementary');

-- Tabela de pastas/subpastas
CREATE TABLE IF NOT EXISTS platform_complementary_folders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  parent_id   UUID        REFERENCES platform_complementary_folders(id) ON DELETE CASCADE,
  ordem_index INTEGER     NOT NULL DEFAULT 0,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de materiais
CREATE TABLE IF NOT EXISTS platform_complementary_materials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id     UUID        NOT NULL REFERENCES platform_complementary_folders(id) ON DELETE CASCADE,
  titulo        TEXT        NOT NULL,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('pdf', 'html')),
  pdf_url       TEXT,
  conteudo_html TEXT,
  ordem_index   INTEGER     NOT NULL DEFAULT 0,
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE platform_complementary_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_complementary_materials ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer usuário autenticado lê e gerencia
DROP POLICY IF EXISTS "Authenticated read complementary folders" ON platform_complementary_folders;
CREATE POLICY "Authenticated read complementary folders" ON platform_complementary_folders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated manage complementary folders" ON platform_complementary_folders;
CREATE POLICY "Authenticated manage complementary folders" ON platform_complementary_folders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read complementary materials" ON platform_complementary_materials;
CREATE POLICY "Authenticated read complementary materials" ON platform_complementary_materials
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated manage complementary materials" ON platform_complementary_materials;
CREATE POLICY "Authenticated manage complementary materials" ON platform_complementary_materials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
