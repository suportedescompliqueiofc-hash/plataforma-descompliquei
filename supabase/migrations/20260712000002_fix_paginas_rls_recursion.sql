-- Fix: RLS de paginas ↔ pagina_compartilhamentos entra em recursão infinita.
-- paginas.select faz EXISTS em pagina_compartilhamentos, e as policies de
-- pagina_compartilhamentos faziam subquery direta em paginas (criado_por) —
-- cada leitura reavalia a policy da outra tabela, formando um ciclo.
-- Solução: função SECURITY DEFINER (ignora RLS internamente) pra resolver
-- o dono da página sem reacionar a policy de "paginas".

CREATE OR REPLACE FUNCTION pagina_criado_por(p_pagina_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT criado_por FROM paginas WHERE id = p_pagina_id;
$$;

DROP POLICY IF EXISTS "compartilhamentos select" ON pagina_compartilhamentos;
DROP POLICY IF EXISTS "compartilhamentos insert" ON pagina_compartilhamentos;
DROP POLICY IF EXISTS "compartilhamentos delete" ON pagina_compartilhamentos;

CREATE POLICY "compartilhamentos select" ON pagina_compartilhamentos FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR pagina_criado_por(pagina_id) = auth.uid()
);

CREATE POLICY "compartilhamentos insert" ON pagina_compartilhamentos FOR INSERT TO authenticated WITH CHECK (
  pagina_criado_por(pagina_id) = auth.uid()
);

CREATE POLICY "compartilhamentos delete" ON pagina_compartilhamentos FOR DELETE TO authenticated USING (
  pagina_criado_por(pagina_id) = auth.uid()
);
