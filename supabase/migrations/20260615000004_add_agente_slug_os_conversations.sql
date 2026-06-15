-- Adiciona coluna agente_slug em os_conversations
-- NULL = Athos GS padrão (sem override), valor = slug do agente em athos_agentes

ALTER TABLE os_conversations
  ADD COLUMN IF NOT EXISTS agente_slug TEXT;

-- Índice para filtrar conversas por agente rapidamente
CREATE INDEX IF NOT EXISTS idx_os_conversations_agente_slug
  ON os_conversations (user_id, agente_slug);
