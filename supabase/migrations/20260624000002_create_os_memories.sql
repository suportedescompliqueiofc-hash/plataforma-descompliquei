-- Sistema de memória persistente do Athos GS
-- Armazena fatos, preferências e instruções entre conversas

CREATE TABLE IF NOT EXISTS os_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('preferencia', 'fato', 'decisao', 'instrucao', 'contexto')),
  conteudo text NOT NULL,
  tags text[] DEFAULT '{}',
  fonte_conversation_id uuid REFERENCES os_conversations(id) ON DELETE SET NULL,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE INDEX idx_os_memories_user ON os_memories(user_id);
CREATE INDEX idx_os_memories_org ON os_memories(organization_id);
CREATE INDEX idx_os_memories_tipo ON os_memories(tipo);

ALTER TABLE os_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memories"
  ON os_memories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on os_memories"
  ON os_memories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
