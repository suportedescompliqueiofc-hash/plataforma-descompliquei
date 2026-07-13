-- ═══════════════════════════════════════════════════════════════════════════
-- CS — Pacote de aprimoramentos
--   #1 Tendência do Resultado (snapshots diários + cron + reader)
--   #3 Guard de confiabilidade no tempo de atendimento (exclui artefatos de import)
--   #5 Configuração de meta a partir do CS
--   #6 Índices de performance
-- ═══════════════════════════════════════════════════════════════════════════

-- ── #6 Índices de performance ────────────────────────────────────────────────
-- As RPCs de CS agregam por org e por lead cross-org; estes índices evitam
-- degradação conforme a base de clientes cresce.
CREATE INDEX IF NOT EXISTS idx_mensagens_lead_direcao_criado ON mensagens (lead_id, direcao, criado_em);
CREATE INDEX IF NOT EXISTS idx_mensagens_org_criado ON mensagens (organization_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_vendas_org_datafech ON vendas (organization_id, data_fechamento);
CREATE INDEX IF NOT EXISTS idx_leads_org_criado ON leads (organization_id, criado_em);

-- ── Rubrica do eixo RESULTADO em SQL (espelha computeResultadoScore no front) ──
-- Reutilizada pelo snapshot. IMMUTABLE: só depende dos argumentos.
CREATE OR REPLACE FUNCTION _cs_resultado_score(
  p_fat numeric, p_growth numeric, p_fech integer, p_txfech numeric,
  p_tempo numeric, p_has_meta boolean, p_meta_pct numeric
) RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  WITH s AS (
    SELECT
      CASE WHEN p_growth IS NULL THEN (CASE WHEN p_fat > 0 THEN 60 ELSE 30 END)
           WHEN p_growth >= 50 THEN 100 WHEN p_growth >= 20 THEN 88 WHEN p_growth >= 5 THEN 72
           WHEN p_growth >= -5 THEN 55 WHEN p_growth >= -20 THEN 35 ELSE 15 END AS growth,
      CASE WHEN p_fech >= 20 THEN 100 WHEN p_fech >= 10 THEN 82 WHEN p_fech >= 5 THEN 62
           WHEN p_fech >= 1 THEN 42 ELSE 8 END AS receita,
      CASE WHEN COALESCE(p_txfech,0) >= 15 THEN 100 WHEN p_txfech >= 8 THEN 82 WHEN p_txfech >= 4 THEN 62
           WHEN p_txfech >= 1 THEN 38 ELSE 10 END AS conversao,
      CASE WHEN p_tempo IS NULL THEN 50 WHEN p_tempo <= 5 THEN 100 WHEN p_tempo <= 15 THEN 85
           WHEN p_tempo <= 60 THEN 65 WHEN p_tempo <= 240 THEN 42 ELSE 18 END AS tempo,
      CASE WHEN NOT COALESCE(p_has_meta,false) OR p_meta_pct IS NULL THEN NULL
           WHEN p_meta_pct >= 100 THEN 100 WHEN p_meta_pct >= 70 THEN 80 WHEN p_meta_pct >= 40 THEN 55
           ELSE 30 END AS meta
  )
  SELECT round(
    (growth*0.32 + receita*0.26 + conversao*0.20 + tempo*0.14
      + CASE WHEN meta IS NULL THEN 0 ELSE meta*0.08 END)
    / (0.92 + CASE WHEN meta IS NULL THEN 0 ELSE 0.08 END)
  )::integer
  FROM s;
$$;

-- ── #1 Tabela de snapshots do Resultado no CRM ───────────────────────────────
CREATE TABLE IF NOT EXISTS cs_crm_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  resultado_score integer,
  fat_30d numeric,
  fat_growth_pct numeric,
  fech_30d integer,
  tx_fech numeric,
  tempo_1o_min numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_cs_crm_snapshots_org_date ON cs_crm_snapshots (organization_id, snapshot_date);

ALTER TABLE cs_crm_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cs_crm_snapshots_admin ON cs_crm_snapshots;
CREATE POLICY cs_crm_snapshots_admin ON cs_crm_snapshots
  FOR SELECT USING (is_super_admin() OR is_admin());

-- ── #1 Snapshot: grava o Resultado do dia para cada org elegível ──────────────
-- Chamada pelo cron (sem contexto de auth). Guard de tempo de 3 dias (#3).
CREATE OR REPLACE FUNCTION cs_snapshot_crm()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d30 date := (now() - interval '30 days')::date;
  d60 date := (now() - interval '60 days')::date;
  ts30 timestamptz := now() - interval '30 days';
  n integer := 0;
BEGIN
  INSERT INTO cs_crm_snapshots (organization_id, snapshot_date, resultado_score, fat_30d, fat_growth_pct, fech_30d, tx_fech, tempo_1o_min)
  SELECT
    e.org_id, CURRENT_DATE,
    _cs_resultado_score(
      COALESCE(fat.fat_30d,0),
      CASE WHEN COALESCE(fat.fat_prev,0) > 0 THEN round((COALESCE(fat.fat_30d,0)-fat.fat_prev)/fat.fat_prev*100,1) ELSE NULL END,
      COALESCE(fat.fech_30d,0)::int,
      round(COALESCE(fn.fech_30d,0)::numeric / NULLIF(fn.leads_30d,0) * 100, 1),
      round(tmp.tempo_1o_med,1),
      mt.meta_receita IS NOT NULL,
      CASE WHEN COALESCE(mt.meta_receita,0) > 0 THEN round(COALESCE(mt.realizado,0)/mt.meta_receita*100,1) ELSE NULL END
    ),
    COALESCE(fat.fat_30d,0),
    CASE WHEN COALESCE(fat.fat_prev,0) > 0 THEN round((COALESCE(fat.fat_30d,0)-fat.fat_prev)/fat.fat_prev*100,1) ELSE NULL END,
    COALESCE(fat.fech_30d,0)::int,
    round(COALESCE(fn.fech_30d,0)::numeric / NULLIF(fn.leads_30d,0) * 100, 1),
    round(tmp.tempo_1o_med,1)
  FROM (
    SELECT DISTINCT ON (t.organization_id) t.organization_id AS org_id
    FROM platform_tenants t
    WHERE t.product_id IS DISTINCT FROM '1fa00b04-87f2-4196-ad49-937995c08349'
    ORDER BY t.organization_id, t.created_at DESC
  ) e
  LEFT JOIN LATERAL (
    SELECT SUM(v.valor_fechado) FILTER (WHERE v.data_fechamento >= d30) AS fat_30d,
      SUM(v.valor_fechado) FILTER (WHERE v.data_fechamento >= d60 AND v.data_fechamento < d30) AS fat_prev,
      COUNT(*) FILTER (WHERE v.data_fechamento >= d30 AND v.valor_fechado IS NOT NULL) AS fech_30d
    FROM vendas v WHERE v.organization_id = e.org_id
  ) fat ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS leads_30d, COUNT(*) FILTER (WHERE l.is_closed) AS fech_30d
    FROM leads l WHERE l.organization_id = e.org_id AND l.criado_em >= ts30 AND NOT COALESCE(l.excluir_metricas,false)
  ) fn ON true
  LEFT JOIN LATERAL (
    SELECT AVG(EXTRACT(EPOCH FROM (fc.primeira_saida - fc.criado_em))/60) AS tempo_1o_med
    FROM (SELECT l.criado_em, (SELECT MIN(m.criado_em) FROM mensagens m WHERE m.lead_id=l.id AND m.direcao='saida') AS primeira_saida
      FROM leads l WHERE l.organization_id=e.org_id AND l.criado_em>=ts30 AND NOT COALESCE(l.excluir_metricas,false)) fc
    WHERE fc.primeira_saida IS NOT NULL AND fc.primeira_saida >= fc.criado_em
      AND fc.primeira_saida <= fc.criado_em + interval '3 days'
  ) tmp ON true
  LEFT JOIN LATERAL (
    SELECT mm.meta_receita, (SELECT SUM(v.valor_fechado) FROM vendas v WHERE v.organization_id=e.org_id AND v.data_fechamento>=mm.data_inicio AND v.data_fechamento<=mm.data_fim) AS realizado
    FROM metas mm WHERE mm.organization_id=e.org_id AND mm.ativo AND CURRENT_DATE BETWEEN mm.data_inicio AND mm.data_fim
    ORDER BY mm.data_inicio DESC LIMIT 1
  ) mt ON true
  ON CONFLICT (organization_id, snapshot_date) DO UPDATE SET
    resultado_score = EXCLUDED.resultado_score, fat_30d = EXCLUDED.fat_30d,
    fat_growth_pct = EXCLUDED.fat_growth_pct, fech_30d = EXCLUDED.fech_30d,
    tx_fech = EXCLUDED.tx_fech, tempo_1o_min = EXCLUDED.tempo_1o_min;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Cron diário (09:00 UTC = 06:00 BRT) + seed imediato do dia de hoje.
SELECT cron.schedule('cs-crm-snapshot', '0 9 * * *', 'SELECT cs_snapshot_crm()');
SELECT cs_snapshot_crm();

-- ── #1 Reader: série de tendência do Resultado de um cliente (90 dias) ────────
CREATE OR REPLACE FUNCTION get_cs_client_crm_trend(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.snapshot_date), '[]'::jsonb) INTO result
  FROM (
    SELECT snapshot_date, resultado_score, fat_30d, fat_growth_pct
    FROM cs_crm_snapshots
    WHERE organization_id = p_org_id AND snapshot_date >= CURRENT_DATE - 90
    ORDER BY snapshot_date
  ) x;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION get_cs_client_crm_trend(uuid) TO authenticated;

-- ── #5 Configurar meta de faturamento do cliente a partir do CS ───────────────
-- Cria/atualiza a meta mensal do mês corrente para a org do cliente. SECURITY
-- DEFINER porque o CSM opera sobre outra org (RLS bloquearia).
CREATE OR REPLACE FUNCTION cs_set_client_meta(p_org_id uuid, p_meta_receita numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ini date := date_trunc('month', now())::date;
  fim date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_meta_receita IS NULL OR p_meta_receita <= 0 THEN RAISE EXCEPTION 'meta inválida'; END IF;

  -- Desativa metas mensais que cobrem o mês corrente para evitar ambiguidade.
  UPDATE metas SET ativo = false, atualizado_em = now()
  WHERE organization_id = p_org_id AND ativo
    AND periodo_tipo = 'mensal' AND ini BETWEEN data_inicio AND data_fim;

  INSERT INTO metas (organization_id, nome, periodo_tipo, data_inicio, data_fim, ativo, meta_receita)
  VALUES (p_org_id, 'Meta ' || to_char(now(), 'MM/YYYY'), 'mensal', ini, fim, true, p_meta_receita);
END;
$$;
GRANT EXECUTE ON FUNCTION cs_set_client_meta(uuid, numeric) TO authenticated;

-- ── #3 Guard de confiabilidade no tempo de 1º contato ─────────────────────────
-- Redefine as 3 RPCs de métricas com o corte de 3 dias: um "1º contato" que
-- leva mais de 72h quase sempre é artefato de importação em massa (lead criado
-- com data antiga, mensageado muito depois), não responsividade real. Excluí-los
-- evita médias absurdas (ex.: ~20h) que corroem a confiança no painel.

CREATE OR REPLACE FUNCTION get_cs_crm_metrics()
RETURNS TABLE (
  organization_id uuid, fat_30d numeric, fat_30d_prev numeric, fat_growth_pct numeric,
  fechamentos_30d integer, ticket_medio_30d numeric, fat_total_lifetime numeric,
  leads_30d integer, mql_30d integer, agend_30d integer, fech_30d integer,
  tx_mql numeric, tx_agend numeric, tx_fech numeric, msgs_30d integer,
  ultima_atividade timestamptz, tempo_1o_contato_med_min numeric,
  meta_receita_ativa numeric, meta_realizado numeric, meta_pct numeric,
  usa_ia boolean, usa_followup boolean, usa_agenda boolean, tem_meta boolean, registra_vendas boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  d30 date := (now() - interval '30 days')::date;
  d60 date := (now() - interval '60 days')::date;
  ts30 timestamptz := now() - interval '30 days';
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  WITH elig AS (
    SELECT DISTINCT ON (t.organization_id) t.organization_id AS org_id
    FROM platform_tenants t
    WHERE t.product_id IS DISTINCT FROM '1fa00b04-87f2-4196-ad49-937995c08349'
    ORDER BY t.organization_id, t.created_at DESC
  )
  SELECT e.org_id,
    COALESCE(fat.fat_30d, 0), COALESCE(fat.fat_prev, 0),
    CASE WHEN COALESCE(fat.fat_prev,0) > 0 THEN round((COALESCE(fat.fat_30d,0)-fat.fat_prev)/fat.fat_prev*100,1) ELSE NULL END,
    COALESCE(fat.fech_30d,0)::int,
    CASE WHEN COALESCE(fat.fech_30d,0)>0 THEN round(COALESCE(fat.fat_30d,0)/fat.fech_30d,2) ELSE NULL END,
    COALESCE(fat.fat_life,0),
    COALESCE(fn.leads_30d,0)::int, COALESCE(fn.mql_30d,0)::int, COALESCE(fn.agend_30d,0)::int, COALESCE(fn.fech_30d,0)::int,
    round(COALESCE(fn.mql_30d,0)::numeric/NULLIF(fn.leads_30d,0)*100,1),
    round(COALESCE(fn.agend_30d,0)::numeric/NULLIF(fn.leads_30d,0)*100,1),
    round(COALESCE(fn.fech_30d,0)::numeric/NULLIF(fn.leads_30d,0)*100,1),
    COALESCE(act.msgs_30d,0)::int, act.ultima_atividade, round(tmp.tempo_1o_med,1),
    mt.meta_receita,
    CASE WHEN mt.meta_receita IS NOT NULL THEN COALESCE(mt.realizado,0) ELSE NULL END,
    CASE WHEN COALESCE(mt.meta_receita,0)>0 THEN round(COALESCE(mt.realizado,0)/mt.meta_receita*100,1) ELSE NULL END,
    COALESCE(fn.usa_ia,false), COALESCE(fn.usa_followup,false), COALESCE(ag.usa_agenda,false),
    mt.meta_receita IS NOT NULL, COALESCE(fat.fech_life,0)>0
  FROM elig e
  LEFT JOIN LATERAL (
    SELECT SUM(v.valor_fechado) FILTER (WHERE v.data_fechamento >= d30) AS fat_30d,
      SUM(v.valor_fechado) FILTER (WHERE v.data_fechamento >= d60 AND v.data_fechamento < d30) AS fat_prev,
      COUNT(*) FILTER (WHERE v.data_fechamento >= d30 AND v.valor_fechado IS NOT NULL) AS fech_30d,
      SUM(v.valor_fechado) AS fat_life, COUNT(*) FILTER (WHERE v.valor_fechado IS NOT NULL) AS fech_life
    FROM vendas v WHERE v.organization_id = e.org_id
  ) fat ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS leads_30d, COUNT(*) FILTER (WHERE l.is_qualified) AS mql_30d,
      COUNT(*) FILTER (WHERE l.is_scheduled) AS agend_30d, COUNT(*) FILTER (WHERE l.is_closed) AS fech_30d,
      bool_or(l.ia_ja_ativada OR l.ia_ativa) AS usa_ia, bool_or(COALESCE(l.followup_tentativas,0)>0) AS usa_followup
    FROM leads l WHERE l.organization_id = e.org_id AND l.criado_em >= ts30 AND NOT COALESCE(l.excluir_metricas,false)
  ) fn ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE m.criado_em >= ts30) AS msgs_30d, MAX(m.criado_em) AS ultima_atividade
    FROM mensagens m WHERE m.organization_id = e.org_id
  ) act ON true
  LEFT JOIN LATERAL (
    SELECT AVG(EXTRACT(EPOCH FROM (fc.primeira_saida - fc.criado_em))/60) AS tempo_1o_med
    FROM (SELECT l.criado_em, (SELECT MIN(m.criado_em) FROM mensagens m WHERE m.lead_id=l.id AND m.direcao='saida') AS primeira_saida
      FROM leads l WHERE l.organization_id=e.org_id AND l.criado_em>=ts30 AND NOT COALESCE(l.excluir_metricas,false)) fc
    WHERE fc.primeira_saida IS NOT NULL AND fc.primeira_saida >= fc.criado_em
      AND fc.primeira_saida <= fc.criado_em + interval '3 days'
  ) tmp ON true
  LEFT JOIN LATERAL (SELECT COUNT(*)>0 AS usa_agenda FROM agendamentos a WHERE a.organization_id=e.org_id) ag ON true
  LEFT JOIN LATERAL (
    SELECT mm.meta_receita, (SELECT SUM(v.valor_fechado) FROM vendas v WHERE v.organization_id=e.org_id AND v.data_fechamento>=mm.data_inicio AND v.data_fechamento<=mm.data_fim) AS realizado
    FROM metas mm WHERE mm.organization_id=e.org_id AND mm.ativo AND CURRENT_DATE BETWEEN mm.data_inicio AND mm.data_fim
    ORDER BY mm.data_inicio DESC LIMIT 1
  ) mt ON true;
END; $$;

CREATE OR REPLACE FUNCTION get_cs_client_crm_detail(p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE ts30 timestamptz := now() - interval '30 days'; result jsonb;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'monthly', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT to_char(gs.mes, 'YYYY-MM') AS mes,
          COALESCE((SELECT SUM(v.valor_fechado) FROM vendas v WHERE v.organization_id=p_org_id AND date_trunc('month', v.data_fechamento)=gs.mes),0) AS faturamento,
          COALESCE((SELECT COUNT(*) FROM vendas v WHERE v.organization_id=p_org_id AND date_trunc('month', v.data_fechamento)=gs.mes AND v.valor_fechado IS NOT NULL),0) AS fechamentos
        FROM generate_series(date_trunc('month', now())-interval '11 months', date_trunc('month', now()), interval '1 month') gs(mes)
        ORDER BY gs.mes
      ) x
    ),
    'funil', (SELECT row_to_json(f) FROM (
        SELECT COUNT(*) AS leads, COUNT(*) FILTER (WHERE l.is_qualified) AS mql,
          COUNT(*) FILTER (WHERE l.is_scheduled) AS agendamentos, COUNT(*) FILTER (WHERE l.is_closed) AS fechamentos
        FROM leads l WHERE l.organization_id=p_org_id AND l.criado_em>=ts30 AND NOT COALESCE(l.excluir_metricas,false)
      ) f),
    'adocao', (SELECT row_to_json(a) FROM (
        SELECT
          (SELECT COUNT(*) FROM leads l WHERE l.organization_id=p_org_id AND (l.ia_ja_ativada OR l.ia_ativa)) AS leads_com_ia,
          (SELECT COUNT(*) FROM leads l WHERE l.organization_id=p_org_id AND COALESCE(l.followup_tentativas,0)>0) AS leads_followup,
          (SELECT COUNT(*) FROM agendamentos ag WHERE ag.organization_id=p_org_id) AS agendamentos,
          (SELECT COUNT(*) FROM vendas v WHERE v.organization_id=p_org_id) AS vendas,
          (SELECT COUNT(*) FROM metas m WHERE m.organization_id=p_org_id) AS metas,
          (SELECT COUNT(DISTINCT lt.lead_id) FROM leads_tags lt JOIN leads l ON l.id=lt.lead_id WHERE l.organization_id=p_org_id) AS leads_com_tag,
          (SELECT COUNT(*) FROM leads l WHERE l.organization_id=p_org_id) AS leads_total
      ) a),
    'tempo', (SELECT row_to_json(t) FROM (
        SELECT round(AVG(EXTRACT(EPOCH FROM (fc.primeira_saida - fc.criado_em))/60)::numeric,1) AS tempo_1o_contato_min,
          round(AVG(fc.gap_resposta_min)::numeric,1) AS tempo_resposta_med_min
        FROM (
          SELECT l.criado_em,
            (SELECT MIN(m.criado_em) FROM mensagens m WHERE m.lead_id=l.id AND m.direcao='saida') AS primeira_saida,
            (SELECT AVG(EXTRACT(EPOCH FROM (m2.criado_em - m1.criado_em))/60)
               FROM mensagens m1
               JOIN LATERAL (SELECT MIN(mx.criado_em) AS criado_em FROM mensagens mx WHERE mx.lead_id=m1.lead_id AND mx.direcao='saida' AND mx.criado_em>m1.criado_em) m2 ON true
               WHERE m1.lead_id=l.id AND m1.direcao='entrada' AND m2.criado_em IS NOT NULL) AS gap_resposta_min
          FROM leads l WHERE l.organization_id=p_org_id AND l.criado_em>=ts30 AND NOT COALESCE(l.excluir_metricas,false)
        ) fc
        WHERE fc.primeira_saida IS NOT NULL AND fc.primeira_saida >= fc.criado_em
          AND fc.primeira_saida <= fc.criado_em + interval '3 days'
      ) t)
  ) INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION get_cs_client_crm_period(p_org_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  span integer := (p_to - p_from);
  prev_to date := p_from - 1;
  prev_from date := p_from - 1 - span;
  ts_from timestamptz := p_from::timestamptz;
  ts_to timestamptz := (p_to + 1)::timestamptz;
  result jsonb;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'faturamento', COALESCE((SELECT SUM(v.valor_fechado) FROM vendas v WHERE v.organization_id=p_org_id AND v.data_fechamento BETWEEN p_from AND p_to),0),
    'fechamentos', COALESCE((SELECT COUNT(*) FROM vendas v WHERE v.organization_id=p_org_id AND v.data_fechamento BETWEEN p_from AND p_to AND v.valor_fechado IS NOT NULL),0),
    'faturamento_prev', COALESCE((SELECT SUM(v.valor_fechado) FROM vendas v WHERE v.organization_id=p_org_id AND v.data_fechamento BETWEEN prev_from AND prev_to),0),
    'msgs', COALESCE((SELECT COUNT(*) FROM mensagens m WHERE m.organization_id=p_org_id AND m.criado_em>=ts_from AND m.criado_em<ts_to),0),
    'funil', (SELECT row_to_json(f) FROM (
        SELECT COUNT(*) AS leads, COUNT(*) FILTER (WHERE l.is_qualified) AS mql,
          COUNT(*) FILTER (WHERE l.is_scheduled) AS agendamentos, COUNT(*) FILTER (WHERE l.is_closed) AS fechamentos
        FROM leads l WHERE l.organization_id=p_org_id AND l.criado_em>=ts_from AND l.criado_em<ts_to AND NOT COALESCE(l.excluir_metricas,false)
      ) f),
    'tempo', (SELECT row_to_json(t) FROM (
        SELECT round(AVG(EXTRACT(EPOCH FROM (fc.primeira_saida - fc.criado_em))/60)::numeric,1) AS tempo_1o_contato_min,
          round(AVG(fc.gap)::numeric,1) AS tempo_resposta_med_min
        FROM (
          SELECT l.criado_em,
            (SELECT MIN(m.criado_em) FROM mensagens m WHERE m.lead_id=l.id AND m.direcao='saida') AS primeira_saida,
            (SELECT AVG(EXTRACT(EPOCH FROM (m2.c - m1.criado_em))/60)
               FROM mensagens m1
               JOIN LATERAL (SELECT MIN(mx.criado_em) AS c FROM mensagens mx WHERE mx.lead_id=m1.lead_id AND mx.direcao='saida' AND mx.criado_em>m1.criado_em) m2 ON true
               WHERE m1.lead_id=l.id AND m1.direcao='entrada' AND m2.c IS NOT NULL) AS gap
          FROM leads l WHERE l.organization_id=p_org_id AND l.criado_em>=ts_from AND l.criado_em<ts_to AND NOT COALESCE(l.excluir_metricas,false)
        ) fc
        WHERE fc.primeira_saida IS NOT NULL AND fc.primeira_saida >= fc.criado_em
          AND fc.primeira_saida <= fc.criado_em + interval '3 days'
      ) t)
  ) INTO result;
  RETURN result;
END; $$;
