-- Sistema de Páginas ("Notas"): hierarquia real (pastas/sub-páginas), conteúdo
-- em JSON (Tiptap doc), escopo pessoal ou compartilhado com a organização.
-- Substitui, na prática, "Meus Materiais" (meus_materiais segue existindo,
-- migração/descontinuação fica para uma decisão explícita futura).

CREATE TABLE paginas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  criado_por      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES paginas(id) ON DELETE CASCADE,
  titulo          text NOT NULL DEFAULT 'Sem título',
  icone           text,
  conteudo        jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}',
  visibilidade    text NOT NULL DEFAULT 'pessoal' CHECK (visibilidade IN ('pessoal','empresa')),
  categoria       text,
  ordem_index     integer NOT NULL DEFAULT 0,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX paginas_org_idx ON paginas(organization_id);
CREATE INDEX paginas_parent_idx ON paginas(parent_id);
CREATE INDEX paginas_criado_por_idx ON paginas(criado_por);

CREATE TABLE pagina_compartilhamentos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagina_id  uuid NOT NULL REFERENCES paginas(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao  text NOT NULL DEFAULT 'visualizar' CHECK (permissao IN ('visualizar','editar')),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pagina_id, user_id)
);

CREATE INDEX pagina_compartilhamentos_pagina_idx ON pagina_compartilhamentos(pagina_id);
CREATE INDEX pagina_compartilhamentos_user_idx ON pagina_compartilhamentos(user_id);

ALTER TABLE paginas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagina_compartilhamentos ENABLE ROW LEVEL SECURITY;

-- SELECT: mesma org, e (empresa OU autor OU compartilhada comigo)
CREATE POLICY "paginas select" ON paginas FOR SELECT TO authenticated USING (
  organization_id = (SELECT organization_id FROM perfis WHERE id = auth.uid())
  AND (
    visibilidade = 'empresa'
    OR criado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pagina_compartilhamentos pc
      WHERE pc.pagina_id = paginas.id AND pc.user_id = auth.uid()
    )
  )
);

-- INSERT: só na própria org, como autor
CREATE POLICY "paginas insert" ON paginas FOR INSERT TO authenticated WITH CHECK (
  criado_por = auth.uid()
  AND organization_id = (SELECT organization_id FROM perfis WHERE id = auth.uid())
);

-- UPDATE: autor, OU empresa (mesma org), OU compartilhada com permissao='editar'
CREATE POLICY "paginas update" ON paginas FOR UPDATE TO authenticated USING (
  criado_por = auth.uid()
  OR (visibilidade = 'empresa' AND organization_id = (SELECT organization_id FROM perfis WHERE id = auth.uid()))
  OR EXISTS (
    SELECT 1 FROM pagina_compartilhamentos pc
    WHERE pc.pagina_id = paginas.id AND pc.user_id = auth.uid() AND pc.permissao = 'editar'
  )
);

-- DELETE: só o autor, mesmo em página "empresa" — evita exclusão cross-time acidental
CREATE POLICY "paginas delete" ON paginas FOR DELETE TO authenticated USING (
  criado_por = auth.uid()
);

-- pagina_compartilhamentos: só o autor da página gerencia; o convidado vê a própria linha
CREATE POLICY "compartilhamentos select" ON pagina_compartilhamentos FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR (SELECT criado_por FROM paginas WHERE id = pagina_id) = auth.uid()
);

CREATE POLICY "compartilhamentos insert" ON pagina_compartilhamentos FOR INSERT TO authenticated WITH CHECK (
  (SELECT criado_por FROM paginas WHERE id = pagina_id) = auth.uid()
);

CREATE POLICY "compartilhamentos delete" ON pagina_compartilhamentos FOR DELETE TO authenticated USING (
  (SELECT criado_por FROM paginas WHERE id = pagina_id) = auth.uid()
);
