-- ══════════════════════════════════════════════════════════════════
-- Documentos do lead (aba "Documentos" no LeadModal)
-- PDFs organizados em pastas simples (1 nível). Bucket PRIVADO + signed URLs.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lead_documento_pastas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  nome            text NOT NULL,
  criado_por      uuid,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_documento_pastas_lead ON lead_documento_pastas (lead_id);

CREATE TABLE IF NOT EXISTS lead_documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  pasta_id        uuid REFERENCES lead_documento_pastas(id) ON DELETE CASCADE,
  nome_arquivo    text NOT NULL,
  storage_path    text NOT NULL,
  tamanho_bytes   bigint,
  criado_por      uuid,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_documentos_lead ON lead_documentos (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_documentos_pasta ON lead_documentos (pasta_id);

ALTER TABLE lead_documento_pastas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_documento_pastas_select_org ON lead_documento_pastas;
DROP POLICY IF EXISTS lead_documento_pastas_insert_org ON lead_documento_pastas;
DROP POLICY IF EXISTS lead_documento_pastas_delete_org ON lead_documento_pastas;

CREATE POLICY lead_documento_pastas_select_org ON lead_documento_pastas FOR SELECT
  USING (organization_id = (select organization_id from perfis where id = auth.uid()));
CREATE POLICY lead_documento_pastas_insert_org ON lead_documento_pastas FOR INSERT
  WITH CHECK (organization_id = (select organization_id from perfis where id = auth.uid()));
CREATE POLICY lead_documento_pastas_delete_org ON lead_documento_pastas FOR DELETE
  USING (organization_id = (select organization_id from perfis where id = auth.uid()));

DROP POLICY IF EXISTS lead_documentos_select_org ON lead_documentos;
DROP POLICY IF EXISTS lead_documentos_insert_org ON lead_documentos;
DROP POLICY IF EXISTS lead_documentos_delete_org ON lead_documentos;

CREATE POLICY lead_documentos_select_org ON lead_documentos FOR SELECT
  USING (organization_id = (select organization_id from perfis where id = auth.uid()));
CREATE POLICY lead_documentos_insert_org ON lead_documentos FOR INSERT
  WITH CHECK (organization_id = (select organization_id from perfis where id = auth.uid()));
CREATE POLICY lead_documentos_delete_org ON lead_documentos FOR DELETE
  USING (organization_id = (select organization_id from perfis where id = auth.uid()));

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-documentos', 'lead-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage — path: {organization_id}/{lead_id}/{arquivo}
DROP POLICY IF EXISTS lead_documentos_storage_select ON storage.objects;
DROP POLICY IF EXISTS lead_documentos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS lead_documentos_storage_delete ON storage.objects;

CREATE POLICY lead_documentos_storage_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'lead-documentos'
    AND (storage.foldername(name))[1] = (select organization_id::text from perfis where id = auth.uid())
  );
CREATE POLICY lead_documentos_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lead-documentos'
    AND (storage.foldername(name))[1] = (select organization_id::text from perfis where id = auth.uid())
  );
CREATE POLICY lead_documentos_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lead-documentos'
    AND (storage.foldername(name))[1] = (select organization_id::text from perfis where id = auth.uid())
  );
