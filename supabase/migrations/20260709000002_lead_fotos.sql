-- ══════════════════════════════════════════════════════════════════
-- Galeria Antes/Depois do lead (Nível 3)
-- Fotos de paciente vinculadas ao procedimento realizado.
-- Bucket PRIVADO + signed URLs (dado sensível — LGPD).
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lead_fotos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  procedimento    text,
  tipo            text NOT NULL CHECK (tipo IN ('antes','depois')),
  storage_path    text NOT NULL,
  descricao       text,
  criado_por      uuid,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_fotos_lead ON lead_fotos (lead_id);

ALTER TABLE lead_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_fotos_select_org ON lead_fotos;
DROP POLICY IF EXISTS lead_fotos_insert_org ON lead_fotos;
DROP POLICY IF EXISTS lead_fotos_delete_org ON lead_fotos;

CREATE POLICY lead_fotos_select_org ON lead_fotos FOR SELECT
  USING (organization_id = (select organization_id from perfis where id = auth.uid()));
CREATE POLICY lead_fotos_insert_org ON lead_fotos FOR INSERT
  WITH CHECK (organization_id = (select organization_id from perfis where id = auth.uid()));
CREATE POLICY lead_fotos_delete_org ON lead_fotos FOR DELETE
  USING (organization_id = (select organization_id from perfis where id = auth.uid()));

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-fotos', 'lead-fotos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage — path: {organization_id}/{lead_id}/{arquivo}
DROP POLICY IF EXISTS lead_fotos_storage_select ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS lead_fotos_storage_delete ON storage.objects;

CREATE POLICY lead_fotos_storage_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'lead-fotos'
    AND (storage.foldername(name))[1] = (select organization_id::text from perfis where id = auth.uid())
  );
CREATE POLICY lead_fotos_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lead-fotos'
    AND (storage.foldername(name))[1] = (select organization_id::text from perfis where id = auth.uid())
  );
CREATE POLICY lead_fotos_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lead-fotos'
    AND (storage.foldername(name))[1] = (select organization_id::text from perfis where id = auth.uid())
  );
