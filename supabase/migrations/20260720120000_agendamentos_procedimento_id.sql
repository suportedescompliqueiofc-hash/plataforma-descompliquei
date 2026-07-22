-- Agendamentos: vínculo real (FK) com o catálogo de procedimentos.
--
-- Contexto: o modal inline de Agendamentos.tsx gravava em `procedimento_id`, coluna que
-- nunca existiu — a seleção de procedimento era perdida silenciosamente. Só o modal da
-- conversa gravava, em `procedimento_interesse` (texto livre). Resultado: 179 agendamentos
-- de tipo 'procedimento' e apenas 5 com procedimento vinculado.
--
-- Esta migration cria a coluna real e faz o backfill do texto legado.
-- `procedimento_interesse` é mantida por ora (legado + tools do Athos GS).

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS procedimento_id uuid
  REFERENCES procedimentos(id) ON DELETE SET NULL;

COMMENT ON COLUMN agendamentos.procedimento_id IS
  'FK para o catálogo de procedimentos. Fonte da projeção de faturamento. '
  'Substitui procedimento_interesse (texto livre, legado).';

-- Backfill: casa o texto legado com o catálogo, dentro da mesma org.
UPDATE agendamentos a
SET procedimento_id = p.id
FROM procedimentos p
WHERE a.procedimento_id IS NULL
  AND a.procedimento_interesse IS NOT NULL
  AND p.organization_id = a.organization_id
  AND lower(trim(p.nome)) = lower(trim(a.procedimento_interesse));

-- Índice para as agregações da projeção (filtram por org + status + data futura).
CREATE INDEX IF NOT EXISTS idx_agendamentos_procedimento_id
  ON agendamentos (procedimento_id)
  WHERE procedimento_id IS NOT NULL;
