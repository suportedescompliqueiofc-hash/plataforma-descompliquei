-- NPS multi-pergunta — um template passa a ter N perguntas (recomendação,
-- resultado percebido, experiência, atendimento, outro). A pergunta de
-- dimensão 'recomendacao' continua alimentando cs_nps_responses.score, que é
-- a métrica oficial de NPS (ver conhecimento/operacional/cs/09-metricas-e-kpis.md)
-- — as demais dimensões são um detalhe complementar, só de leitura pelo CS.

CREATE TABLE IF NOT EXISTS cs_nps_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES cs_nps_templates(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  dimensao text NOT NULL CHECK (dimensao IN ('recomendacao', 'resultado', 'experiencia', 'atendimento', 'outro')),
  tipo text NOT NULL CHECK (tipo IN ('escala', 'texto')),
  texto text NOT NULL,
  variaveis text[] DEFAULT '{}',
  obrigatoria boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_nps_perguntas_template ON cs_nps_perguntas(template_id, ordem);
ALTER TABLE cs_nps_perguntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_nps_perguntas_all" ON cs_nps_perguntas USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS cs_nps_respostas_detalhe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES cs_nps_campanhas(id) ON DELETE CASCADE,
  pergunta_id uuid REFERENCES cs_nps_perguntas(id) ON DELETE SET NULL,
  dimensao text NOT NULL,
  texto_pergunta text NOT NULL,
  valor_numero integer,
  valor_texto text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_nps_respostas_detalhe_campanha ON cs_nps_respostas_detalhe(campanha_id);
ALTER TABLE cs_nps_respostas_detalhe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_nps_respostas_detalhe_staff_select" ON cs_nps_respostas_detalhe FOR SELECT USING (
  EXISTS (SELECT 1 FROM usuarios_papeis WHERE usuario_id = auth.uid() AND papel = 'superadmin')
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- Migra os templates antigos (1 pergunta embutida na própria linha) para o
-- novo formato: 1 linha em cs_nps_perguntas por template, dimensão recomendação.
INSERT INTO cs_nps_perguntas (template_id, ordem, dimensao, tipo, texto, variaveis, obrigatoria)
SELECT id, 0, 'recomendacao', 'escala', pergunta, COALESCE(variaveis, '{}'), true
FROM cs_nps_templates
WHERE NOT EXISTS (SELECT 1 FROM cs_nps_perguntas WHERE cs_nps_perguntas.template_id = cs_nps_templates.id);

ALTER TABLE cs_nps_templates DROP COLUMN IF EXISTS pergunta;
ALTER TABLE cs_nps_templates DROP COLUMN IF EXISTS variaveis;

-- Seed de exemplo: template rico com as 4 dimensões + campo aberto.
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  INSERT INTO cs_nps_templates (nome) VALUES ('NPS completo — todas as dimensões')
  RETURNING id INTO v_template_id;

  INSERT INTO cs_nps_perguntas (template_id, ordem, dimensao, tipo, texto, variaveis, obrigatoria) VALUES
  (v_template_id, 0, 'recomendacao', 'escala', 'Oi [nome]! De 0 a 10, o quanto você recomendaria a Descompliquei a um colega da sua área?', ARRAY['nome'], true),
  (v_template_id, 1, 'resultado', 'escala', 'E o quanto você sente que a Descompliquei tem contribuído para o crescimento da sua clínica?', '{}', true),
  (v_template_id, 2, 'experiencia', 'escala', 'Como você avalia sua experiência usando a plataforma e o Athos no dia a dia?', '{}', true),
  (v_template_id, 3, 'atendimento', 'escala', 'E o atendimento do seu time de CS — como você avalia?', '{}', true),
  (v_template_id, 4, 'outro', 'texto', 'Tem algo que a gente poderia fazer melhor? (opcional)', '{}', false);
END $$;

-- ── RPCs reescritas para o formato multi-pergunta ───────────────────────────

DROP FUNCTION IF EXISTS get_pending_nps_survey();

CREATE OR REPLACE FUNCTION get_pending_nps_survey()
RETURNS TABLE(campanha_id uuid, template_id uuid, pergunta_id uuid, ordem int, dimensao text, tipo text, texto text, obrigatoria boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campanha_id uuid;
  v_template_id uuid;
BEGIN
  SELECT c.id, c.template_id INTO v_campanha_id, v_template_id
  FROM cs_nps_campanhas c
  WHERE c.client_id = auth.uid()
    AND c.status = 'pendente'
    AND (c.snoozed_until IS NULL OR c.snoozed_until <= now())
  ORDER BY c.disparado_em DESC
  LIMIT 1;

  IF v_campanha_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_campanha_id, v_template_id, p.id, p.ordem, p.dimensao, p.tipo, p.texto, p.obrigatoria
  FROM cs_nps_perguntas p
  WHERE p.template_id = v_template_id
  ORDER BY p.ordem;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_nps_survey() TO authenticated;

DROP FUNCTION IF EXISTS submit_nps_response(uuid, int, text);

CREATE OR REPLACE FUNCTION submit_nps_response(p_campanha_id uuid, p_respostas jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_pergunta cs_nps_perguntas%ROWTYPE;
  v_score int;
  v_comentario text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cs_nps_campanhas
    WHERE id = p_campanha_id AND client_id = auth.uid() AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'campanha inválida ou já respondida';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_respostas) LOOP
    SELECT * INTO v_pergunta FROM cs_nps_perguntas WHERE id = (r->>'pergunta_id')::uuid;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO cs_nps_respostas_detalhe (campanha_id, pergunta_id, dimensao, texto_pergunta, valor_numero, valor_texto)
    VALUES (
      p_campanha_id, v_pergunta.id, v_pergunta.dimensao, v_pergunta.texto,
      NULLIF(r->>'valor_numero', '')::int,
      NULLIF(r->>'valor_texto', '')
    );

    IF v_pergunta.dimensao = 'recomendacao' AND v_score IS NULL THEN
      v_score := NULLIF(r->>'valor_numero', '')::int;
    END IF;
    IF v_pergunta.tipo = 'texto' AND v_comentario IS NULL THEN
      v_comentario := NULLIF(r->>'valor_texto', '');
    END IF;
  END LOOP;

  IF v_score IS NULL THEN
    RAISE EXCEPTION 'nenhuma pergunta de recomendação (NPS) respondida';
  END IF;

  INSERT INTO cs_nps_responses (client_id, score, comentario, coletado_por, campanha_id, respondido_em)
  VALUES (auth.uid(), v_score, v_comentario, auth.uid(), p_campanha_id, now());

  UPDATE cs_nps_campanhas SET status = 'respondida', respondido_em = now()
  WHERE id = p_campanha_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_nps_response(uuid, jsonb) TO authenticated;
