-- Adiciona suporte a override de prompt base por organização.
-- organization_id NULL = configuração global (comportamento atual, inalterado).
-- organization_id preenchido = override exclusivo para aquela org.
-- A whatsapp-ai-agent lê o override primeiro; se não existir, usa o global.

-- 1. Remove o UNIQUE simples em chave (só servia para o global — substituímos por índices parciais)
ALTER TABLE system_ai_config DROP CONSTRAINT IF EXISTS system_ai_config_chave_key;

-- 2. Adiciona a coluna de org (nullable — NULL = global)
ALTER TABLE system_ai_config
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- 3. Índice parcial: garante unicidade das entradas globais (organization_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_ai_config_global
  ON system_ai_config (chave)
  WHERE organization_id IS NULL;

-- 4. Índice parcial: garante unicidade dos overrides por org (organization_id IS NOT NULL)
--    Permite INSERT/UPDATE explícito via código sem depender de ON CONFLICT em índice parcial
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_ai_config_org_override
  ON system_ai_config (chave, organization_id)
  WHERE organization_id IS NOT NULL;
