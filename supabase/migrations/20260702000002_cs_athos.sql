-- ═══════════════════════════════════════════════════════════════════════════
-- Athos CS — assistente especialista de Customer Success (Admin OS)
-- Tabelas dedicadas (cross-org, admin-only). Modeladas em os_conversations/os_memories,
-- mas com client_org_id para escopar conversas/memórias a um cliente específico.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cs_athos_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  csm_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_org_id uuid,                       -- NULL = modo geral (base inteira)
  titulo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_athos_conv_csm ON cs_athos_conversations (csm_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_athos_conv_client ON cs_athos_conversations (client_org_id);

CREATE TABLE IF NOT EXISTS cs_athos_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES cs_athos_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_athos_msg_conv ON cs_athos_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS cs_athos_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  csm_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_org_id uuid,                       -- NULL = memória geral do time/base
  tipo text NOT NULL DEFAULT 'fato' CHECK (tipo IN ('preferencia','fato','decisao','instrucao','contexto')),
  conteudo text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  fonte_conversation_id uuid REFERENCES cs_athos_conversations(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_athos_mem_client ON cs_athos_memories (client_org_id);
CREATE INDEX IF NOT EXISTS idx_cs_athos_mem_csm ON cs_athos_memories (csm_id);

-- RLS: apenas superadmin/admin (o Athos CS é ferramenta interna do time de CS).
ALTER TABLE cs_athos_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_athos_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_athos_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cs_athos_conv_admin ON cs_athos_conversations;
CREATE POLICY cs_athos_conv_admin ON cs_athos_conversations
  USING (is_super_admin() OR is_admin()) WITH CHECK (is_super_admin() OR is_admin());

DROP POLICY IF EXISTS cs_athos_msg_admin ON cs_athos_messages;
CREATE POLICY cs_athos_msg_admin ON cs_athos_messages
  USING (is_super_admin() OR is_admin()) WITH CHECK (is_super_admin() OR is_admin());

DROP POLICY IF EXISTS cs_athos_mem_admin ON cs_athos_memories;
CREATE POLICY cs_athos_mem_admin ON cs_athos_memories
  USING (is_super_admin() OR is_admin()) WITH CHECK (is_super_admin() OR is_admin());
