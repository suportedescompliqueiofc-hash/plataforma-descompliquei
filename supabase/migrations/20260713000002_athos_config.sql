-- Configuração global do Athos GS (modelo de IA usado em todo chat voltado
-- a clientes). O cliente NUNCA escolhe o modelo — a edge function
-- descompliquei-os sempre lê este valor no servidor, ignorando qualquer
-- "model" que venha no corpo da requisição. Só superadmin pode alterar.
CREATE TABLE athos_config (
  id             text PRIMARY KEY DEFAULT 'default',
  modelo_padrao  text NOT NULL DEFAULT 'openai/gpt-5.6-luna-pro',
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id)
);

INSERT INTO athos_config (id, modelo_padrao) VALUES ('default', 'openai/gpt-5.6-luna-pro');

ALTER TABLE athos_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athos_config select" ON athos_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "athos_config update" ON athos_config FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM usuarios_papeis WHERE usuario_id = auth.uid() AND papel = 'superadmin')
);
