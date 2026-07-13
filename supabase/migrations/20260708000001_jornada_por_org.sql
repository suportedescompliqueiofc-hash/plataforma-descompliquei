-- ═══════════════════════════════════════════════════════════════════════════
-- Jornada por ORGANIZAÇÃO
-- A jornada passa a pertencer à CLÍNICA (org), não à conta que a criou.
-- Corrige clínicas com múltiplas contas admin (ex.: dono + sócios/equipe):
-- antes a jornada grudava numa conta e as outras (inclusive quem loga na
-- plataforma) não enxergavam por causa do RLS user_id = auth.uid().
-- Agora qualquer membro da org vê e atualiza as jornadas da própria clínica.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Backfill: organização do perfil dono da jornada
UPDATE jornadas j
SET organization_id = p.organization_id
FROM perfis p
WHERE p.id = j.user_id AND j.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_jornadas_organization_id ON jornadas(organization_id);

-- ── RLS: SELECT/UPDATE agora por ORG (com fallback ao dono para linhas sem org) ──

-- jornadas (SELECT)
DROP POLICY IF EXISTS users_view_own_jornada ON jornadas;
CREATE POLICY users_view_org_jornada ON jornadas FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT p.organization_id FROM perfis p WHERE p.id = auth.uid())
  );

-- jornada_estagios (SELECT)
DROP POLICY IF EXISTS users_view_own_estagios ON jornada_estagios;
CREATE POLICY users_view_org_estagios ON jornada_estagios FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jornadas j
    WHERE j.id = jornada_estagios.jornada_id
      AND (j.user_id = auth.uid()
           OR j.organization_id IN (SELECT p.organization_id FROM perfis p WHERE p.id = auth.uid()))
  ));

-- jornada_passos (SELECT + UPDATE)
DROP POLICY IF EXISTS users_select_own_passos ON jornada_passos;
CREATE POLICY users_select_org_passos ON jornada_passos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jornada_estagios e JOIN jornadas j ON j.id = e.jornada_id
    WHERE e.id = jornada_passos.estagio_id
      AND (j.user_id = auth.uid()
           OR j.organization_id IN (SELECT p.organization_id FROM perfis p WHERE p.id = auth.uid()))
  ));
DROP POLICY IF EXISTS users_update_own_passos ON jornada_passos;
CREATE POLICY users_update_org_passos ON jornada_passos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM jornada_estagios e JOIN jornadas j ON j.id = e.jornada_id
    WHERE e.id = jornada_passos.estagio_id
      AND (j.user_id = auth.uid()
           OR j.organization_id IN (SELECT p.organization_id FROM perfis p WHERE p.id = auth.uid()))
  ));

-- jornada_subtarefas (SELECT + UPDATE)
DROP POLICY IF EXISTS users_select_own_subtarefas ON jornada_subtarefas;
CREATE POLICY users_select_org_subtarefas ON jornada_subtarefas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM jornada_passos pa
      JOIN jornada_estagios e ON e.id = pa.estagio_id
      JOIN jornadas j ON j.id = e.jornada_id
    WHERE pa.id = jornada_subtarefas.passo_id
      AND (j.user_id = auth.uid()
           OR j.organization_id IN (SELECT p.organization_id FROM perfis p WHERE p.id = auth.uid()))
  ));
DROP POLICY IF EXISTS users_update_own_subtarefas ON jornada_subtarefas;
CREATE POLICY users_update_org_subtarefas ON jornada_subtarefas FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM jornada_passos pa
      JOIN jornada_estagios e ON e.id = pa.estagio_id
      JOIN jornadas j ON j.id = e.jornada_id
    WHERE pa.id = jornada_subtarefas.passo_id
      AND (j.user_id = auth.uid()
           OR j.organization_id IN (SELECT p.organization_id FROM perfis p WHERE p.id = auth.uid()))
  ));
