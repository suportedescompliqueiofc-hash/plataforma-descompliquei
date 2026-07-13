-- Reformulação das "Notas": de aninhamento livre (Notion-like, parent_id sem
-- restrição de tipo) para o modelo PASTA vs NOTA.
--
--   pasta = container, pode aninhar pasta -> subpasta -> sub-subpasta sem
--           limite de profundidade. Sem conteúdo de texto; tem uma
--           descrição curta. Nunca é folha "de conteúdo".
--   nota  = folha. Tem `conteudo` (Tiptap). NUNCA é pai de outra página —
--           só se aninha dentro de uma pasta (ou fica solta na raiz, com
--           parent_id null).
--
-- Decisão de produto (2026-07-13): os dados atuais de `paginas` são de teste
-- e não têm valor de negócio. Em vez de escrever uma migração de dados para
-- classificar retroativamente cada registro em pasta/nota, a decisão
-- aprovada foi começar do zero: apagar tudo e seguir com o schema novo já
-- validado pela trigger de integridade abaixo. Isso é intencional.
DELETE FROM paginas;

-- Coluna de discriminação pasta/nota. Default 'nota' porque é o caso comum
-- (a maioria das páginas criadas pelo usuário é conteúdo solto, não pasta).
ALTER TABLE paginas ADD COLUMN tipo text NOT NULL DEFAULT 'nota' CHECK (tipo IN ('pasta', 'nota'));

-- Descrição curta, exclusiva de pastas (nota usa `conteudo` para tudo).
ALTER TABLE paginas ADD COLUMN descricao text;

COMMENT ON COLUMN paginas.tipo IS
  'Discriminador do modelo pasta/nota. "pasta" = container organizacional, pode ter filhos (pasta ou nota) e nunca tem conteúdo de texto. "nota" = folha com `conteudo` (Tiptap), nunca é pai de outra página.';

COMMENT ON COLUMN paginas.descricao IS
  'Descrição curta, opcional, exibida na listagem de pastas. Só faz sentido para tipo=''pasta''; notas usam `conteudo` para tudo.';

-- Trigger de integridade hierárquica: garante em nível de banco que uma nota
-- nunca vira pai de outra página. Só é permitido aninhar dentro de uma
-- pasta existente; parent_id null (raiz) sempre é válido.
CREATE OR REPLACE FUNCTION paginas_valida_hierarquia()
RETURNS trigger AS $$
DECLARE
  parent_tipo text;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tipo INTO parent_tipo FROM paginas WHERE id = NEW.parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'paginas_valida_hierarquia: parent_id % não existe', NEW.parent_id;
  END IF;

  IF parent_tipo <> 'pasta' THEN
    RAISE EXCEPTION 'paginas_valida_hierarquia: parent_id % é do tipo ''%'', não ''pasta'' — nota nunca pode ser pai de outra página', NEW.parent_id, parent_tipo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_paginas_valida_hierarquia
  BEFORE INSERT OR UPDATE OF parent_id ON paginas
  FOR EACH ROW
  EXECUTE FUNCTION paginas_valida_hierarquia();
