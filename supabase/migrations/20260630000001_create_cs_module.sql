-- CS Module — tabelas de Customer Success

-- Colunas de CS em platform_users
ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS cs_fase text CHECK (cs_fase IN ('ativacao', 'execucao', 'tracao', 'maturidade')),
  ADD COLUMN IF NOT EXISTS cs_fase_desde date,
  ADD COLUMN IF NOT EXISTS cs_csm_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cs_ultimo_touchpoint timestamptz,
  ADD COLUMN IF NOT EXISTS cs_proximo_touchpoint date,
  ADD COLUMN IF NOT EXISTS cs_health_status text CHECK (cs_health_status IN ('verde', 'amarelo', 'vermelho'));

-- Health scores por cliente
CREATE TABLE IF NOT EXISTS cs_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  dim_ativacao integer NOT NULL DEFAULT 50 CHECK (dim_ativacao BETWEEN 0 AND 100),
  dim_jornada integer NOT NULL DEFAULT 50 CHECK (dim_jornada BETWEEN 0 AND 100),
  dim_arsenal integer NOT NULL DEFAULT 50 CHECK (dim_arsenal BETWEEN 0 AND 100),
  dim_crm integer NOT NULL DEFAULT 50 CHECK (dim_crm BETWEEN 0 AND 100),
  dim_responsividade integer NOT NULL DEFAULT 50 CHECK (dim_responsividade BETWEEN 0 AND 100),
  score_total integer GENERATED ALWAYS AS (
    (dim_ativacao * 20 + dim_jornada * 25 + dim_arsenal * 20 + dim_crm * 25 + dim_responsividade * 10) / 100
  ) STORED,
  status_calculado text GENERATED ALWAYS AS (
    CASE
      WHEN (dim_ativacao * 20 + dim_jornada * 25 + dim_arsenal * 20 + dim_crm * 25 + dim_responsividade * 10) / 100 >= 70 THEN 'verde'
      WHEN (dim_ativacao * 20 + dim_jornada * 25 + dim_arsenal * 20 + dim_crm * 25 + dim_responsividade * 10) / 100 >= 40 THEN 'amarelo'
      ELSE 'vermelho'
    END
  ) STORED,
  notas_csm text,
  avaliado_por uuid REFERENCES auth.users(id),
  avaliado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Touchpoints (registros de contato com cliente)
CREATE TABLE IF NOT EXISTS cs_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  csm_id uuid REFERENCES auth.users(id),
  tipo text NOT NULL CHECK (tipo IN ('whatsapp', 'reuniao', 'email', 'ligacao', 'outro')),
  data_contato timestamptz NOT NULL DEFAULT now(),
  duracao_minutos integer,
  resultado text NOT NULL CHECK (resultado IN ('positivo', 'neutro', 'negativo', 'sem_resposta')),
  notas text,
  proximo_contato date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Respostas de NPS por cliente
CREATE TABLE IF NOT EXISTS cs_nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 10),
  comentario text,
  coletado_por uuid REFERENCES auth.users(id),
  respondido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE cs_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_health_scores_all" ON cs_health_scores USING (true) WITH CHECK (true);
CREATE POLICY "cs_touchpoints_all" ON cs_touchpoints USING (true) WITH CHECK (true);
CREATE POLICY "cs_nps_responses_all" ON cs_nps_responses USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cs_health_scores_client ON cs_health_scores(client_id);
CREATE INDEX IF NOT EXISTS idx_cs_health_scores_avaliado ON cs_health_scores(avaliado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cs_touchpoints_client ON cs_touchpoints(client_id);
CREATE INDEX IF NOT EXISTS idx_cs_touchpoints_data ON cs_touchpoints(data_contato DESC);
CREATE INDEX IF NOT EXISTS idx_cs_nps_client ON cs_nps_responses(client_id);
CREATE INDEX IF NOT EXISTS idx_cs_nps_respondido ON cs_nps_responses(respondido_em DESC);
