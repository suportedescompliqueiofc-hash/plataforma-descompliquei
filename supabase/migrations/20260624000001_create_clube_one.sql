-- ─── Clube One — Tabelas, triggers, seed e cron ──────────────────────────────

-- 1. Níveis
CREATE TABLE IF NOT EXISTS clube_niveis (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  pontos_minimo  integer NOT NULL DEFAULT 0,
  pontos_maximo  integer NOT NULL DEFAULT 999999,
  selo           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clube_niveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_all_clube_niveis" ON clube_niveis FOR ALL USING (true);

-- 2. Atividades
CREATE TABLE IF NOT EXISTS clube_atividades (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  descricao      text,
  pontos_ganho   integer NOT NULL DEFAULT 0,
  pontos_perda   integer NOT NULL DEFAULT 0,
  categoria      text NOT NULL CHECK (categoria IN ('presenca','execucao','comunidade','penalidade')),
  ativa          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clube_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_all_clube_atividades" ON clube_atividades FOR ALL USING (true);

-- 3. Membros (user_id nullable — adicionados pelo admin, não precisam ter login)
CREATE TABLE IF NOT EXISTS clube_membros (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome           text NOT NULL,
  foto_url       text,
  produto        text NOT NULL CHECK (produto IN ('PCA','GCA')),
  pontos_total   integer NOT NULL DEFAULT 0,
  nivel          text NOT NULL DEFAULT 'Membro',
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clube_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_all_clube_membros" ON clube_membros FOR ALL USING (true);

-- 4. Registros de pontos
CREATE TABLE IF NOT EXISTS clube_registros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id       uuid NOT NULL REFERENCES clube_membros(id) ON DELETE CASCADE,
  atividade_id    uuid NOT NULL REFERENCES clube_atividades(id) ON DELETE RESTRICT,
  pontos          integer NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('ganho','perda')),
  observacao      text,
  registrado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clube_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_all_clube_registros" ON clube_registros FOR ALL USING (true);

-- ─── Trigger: recalcular pontos_total após mudança em clube_registros ─────────

CREATE OR REPLACE FUNCTION fn_recalcular_pontos_membro()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_membro_id uuid;
  v_total     integer;
  v_nivel     text;
BEGIN
  -- Determinar qual membro foi afetado
  IF TG_OP = 'DELETE' THEN
    v_membro_id := OLD.membro_id;
  ELSE
    v_membro_id := NEW.membro_id;
  END IF;

  -- Validação de duplicidade semanal para categorias presença e execução (apenas ganho)
  IF TG_OP = 'INSERT' AND NEW.tipo = 'ganho' THEN
    DECLARE
      v_cat text;
      v_count integer;
    BEGIN
      SELECT ca.categoria INTO v_cat
      FROM clube_atividades ca WHERE ca.id = NEW.atividade_id;

      IF v_cat IN ('presenca', 'execucao') THEN
        SELECT COUNT(*) INTO v_count
        FROM clube_registros cr
        WHERE cr.membro_id = NEW.membro_id
          AND cr.atividade_id = NEW.atividade_id
          AND cr.tipo = 'ganho'
          AND date_trunc('week', cr.created_at) = date_trunc('week', now());

        IF v_count > 0 THEN
          RAISE EXCEPTION 'Atividade já registrada esta semana para este membro.';
        END IF;
      END IF;
    END;
  END IF;

  -- Recalcular total
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'ganho' THEN pontos ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN tipo = 'perda' THEN pontos ELSE 0 END), 0)
  INTO v_total
  FROM clube_registros
  WHERE membro_id = v_membro_id;

  -- Garantir que não fique negativo
  v_total := GREATEST(v_total, 0);

  -- Determinar nível
  SELECT nome INTO v_nivel
  FROM clube_niveis
  WHERE pontos_minimo <= v_total AND pontos_maximo >= v_total
  ORDER BY pontos_minimo DESC
  LIMIT 1;

  IF v_nivel IS NULL THEN
    v_nivel := 'Membro';
  END IF;

  -- Atualizar membro
  UPDATE clube_membros
  SET pontos_total = v_total, nivel = v_nivel, updated_at = now()
  WHERE id = v_membro_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalcular_pontos
AFTER INSERT OR UPDATE OR DELETE ON clube_registros
FOR EACH ROW EXECUTE FUNCTION fn_recalcular_pontos_membro();

-- ─── Cron: rebaixar nível de membros sem ganho há 30 dias ────────────────────

CREATE OR REPLACE FUNCTION fn_rebaixar_nivel_inativo()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_rec RECORD;
  v_nivel_atual_pos integer;
  v_novo_nivel text;
BEGIN
  FOR v_rec IN
    SELECT m.id, m.nivel, m.pontos_total
    FROM clube_membros m
    WHERE m.ativo = true
      AND m.nivel != 'Membro' -- já no nível mínimo, não rebaixa
      AND NOT EXISTS (
        SELECT 1 FROM clube_registros r
        WHERE r.membro_id = m.id
          AND r.tipo = 'ganho'
          AND r.created_at > now() - interval '30 days'
      )
  LOOP
    -- Buscar o nível imediatamente abaixo do atual
    SELECT n.nome INTO v_novo_nivel
    FROM clube_niveis n
    WHERE n.pontos_maximo < (
      SELECT pontos_minimo FROM clube_niveis WHERE nome = v_rec.nivel LIMIT 1
    )
    ORDER BY n.pontos_minimo DESC
    LIMIT 1;

    IF v_novo_nivel IS NOT NULL THEN
      UPDATE clube_membros
      SET nivel = v_novo_nivel, updated_at = now()
      WHERE id = v_rec.id;
    END IF;
  END LOOP;
END;
$$;

-- Cron diário às 03h
SELECT cron.schedule(
  'clube-one-rebaixar-nivel',
  '0 3 * * *',
  $$SELECT fn_rebaixar_nivel_inativo();$$
);

-- ─── Seed: níveis ────────────────────────────────────────────────────────────

INSERT INTO clube_niveis (nome, pontos_minimo, pontos_maximo, selo) VALUES
  ('Membro',       0,    199,    NULL),
  ('Destaque',     200,  499,    'star'),
  ('Elite',        500,  999,    'star2'),
  ('Fundador One', 1000, 999999, 'crown')
ON CONFLICT DO NOTHING;

-- ─── Seed: atividades ────────────────────────────────────────────────────────

INSERT INTO clube_atividades (nome, descricao, pontos_ganho, pontos_perda, categoria) VALUES
  ('Presença na aula ao vivo',              'Participou da aula ao vivo do clube',         10, 0, 'presenca'),
  ('Participação ativa na aula',            'Interagiu ativamente durante a aula',         15, 0, 'presenca'),
  ('Presença no encontro presencial',       'Compareceu ao encontro presencial do clube',  50, 0, 'presenca'),
  ('Resultado mensurável apresentado',      'Apresentou resultado concreto ao grupo',      30, 0, 'execucao'),
  ('Compartilhou aprendizado no grupo',     'Compartilhou um aprendizado no grupo',        10, 0, 'comunidade'),
  ('Ajudou outro membro com dúvida',        'Respondeu dúvida de outro membro',            15, 0, 'comunidade'),
  ('Compartilhou resultado publicamente',   'Publicou resultado em rede social',           25, 0, 'comunidade'),
  ('Autorizou uso do resultado como case',  'Autorizou a Descompliquei a usar seu case',  40, 0, 'comunidade'),
  ('Faltou sem avisar',                     'Faltou à aula ou encontro sem aviso prévio',  0,10, 'penalidade'),
  ('Sem resultado na semana',               'Semana sem resultado apresentado',             0,15, 'penalidade'),
  ('2 semanas sem interagir no grupo',      'Ficou 2 semanas sem interação no grupo',      0,20, 'penalidade')
ON CONFLICT DO NOTHING;
