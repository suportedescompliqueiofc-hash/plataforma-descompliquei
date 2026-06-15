-- Módulo Jornada do Cliente
-- Tabelas: jornadas, jornada_estagios, jornada_passos

CREATE TABLE IF NOT EXISTS jornadas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  status      text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'concluida')),
  gerada_por  text NOT NULL DEFAULT 'admin' CHECK (gerada_por IN ('ia', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jornada_estagios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id  uuid NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  descricao   text,
  ordem       integer NOT NULL DEFAULT 0,
  prazo_dias  integer NOT NULL DEFAULT 7,
  data_inicio date
);

CREATE TABLE IF NOT EXISTS jornada_passos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  estagio_id    uuid NOT NULL REFERENCES jornada_estagios(id) ON DELETE CASCADE,
  titulo        text NOT NULL,
  descricao     text,
  ordem         integer NOT NULL DEFAULT 0,
  tipo          text NOT NULL DEFAULT 'acao_livre' CHECK (tipo IN ('acao_livre', 'ferramenta_arsenal')),
  ferramenta_id uuid REFERENCES arsenal_ferramentas(id) ON DELETE SET NULL,
  prazo_dias    integer,
  obrigatorio   boolean NOT NULL DEFAULT false,
  concluido     boolean NOT NULL DEFAULT false,
  concluido_em  timestamptz,
  concluido_por uuid REFERENCES perfis(id) ON DELETE SET NULL
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_jornada_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jornada_updated_at ON jornadas;
CREATE TRIGGER trg_jornada_updated_at
  BEFORE UPDATE ON jornadas
  FOR EACH ROW EXECUTE FUNCTION update_jornada_updated_at();

-- RLS
ALTER TABLE jornadas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornada_estagios ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornada_passos ENABLE ROW LEVEL SECURITY;

-- jornadas: superadmin full access
CREATE POLICY "superadmin_all_jornadas" ON jornadas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.organization_id = 'aa787cc8-787a-4774-bd80-ffbf78c0cf5f')
  );

-- jornadas: client sees own
CREATE POLICY "users_view_own_jornada" ON jornadas
  FOR SELECT USING (user_id = auth.uid());

-- jornada_estagios: superadmin full access
CREATE POLICY "superadmin_all_estagios" ON jornada_estagios
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.organization_id = 'aa787cc8-787a-4774-bd80-ffbf78c0cf5f')
  );

-- jornada_estagios: client sees own
CREATE POLICY "users_view_own_estagios" ON jornada_estagios
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM jornadas j WHERE j.id = jornada_estagios.jornada_id AND j.user_id = auth.uid())
  );

-- jornada_passos: superadmin full access
CREATE POLICY "superadmin_all_passos" ON jornada_passos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.organization_id = 'aa787cc8-787a-4774-bd80-ffbf78c0cf5f')
  );

-- jornada_passos: client sees own
CREATE POLICY "users_select_own_passos" ON jornada_passos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jornada_estagios e JOIN jornadas j ON j.id = e.jornada_id
      WHERE e.id = jornada_passos.estagio_id AND j.user_id = auth.uid()
    )
  );

-- jornada_passos: client can mark as concluido
CREATE POLICY "users_update_own_passos" ON jornada_passos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM jornada_estagios e JOIN jornadas j ON j.id = e.jornada_id
      WHERE e.id = jornada_passos.estagio_id AND j.user_id = auth.uid()
    )
  );
