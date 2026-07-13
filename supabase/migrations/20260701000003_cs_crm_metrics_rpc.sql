-- Métricas de RESULTADO no CRM por cliente do CS, agregadas server-side
-- (SECURITY DEFINER) porque o RLS escopa dados por org — só um definer roda
-- cross-org. Mesma elegibilidade do get_cs_clients: orgs com platform_tenants
-- de produto != PCA. Alimenta o eixo "Resultado" do Health Score 2-eixos.
--
-- Nota de robustez: as janelas de faturamento usam 30d MÓVEIS (não mês-calendário)
-- para não quebrar no dia 1º do mês. fat_growth_pct é NULL quando não há base
-- anterior (a UI mostra "novo", nunca -100%). Divisões protegidas com NULLIF.

-- ── Resumo por org (lista + painel + eixo Resultado do health) ────────────────
-- OBS: NÃO inclui marketing/Meta Ads nem scoring de leads — são features
-- exclusivas da Descompliquei e não fazem sentido como métrica de CS por cliente.
DROP FUNCTION IF EXISTS get_cs_crm_metrics();
CREATE OR REPLACE FUNCTION get_cs_crm_metrics()
RETURNS TABLE (
  organization_id uuid,
  fat_30d numeric,
  fat_30d_prev numeric,
  fat_growth_pct numeric,
  fechamentos_30d integer,
  ticket_medio_30d numeric,
  fat_total_lifetime numeric,
  leads_30d integer,
  mql_30d integer,
  agend_30d integer,
  fech_30d integer,
  tx_mql numeric,
  tx_agend numeric,
  tx_fech numeric,
  msgs_30d integer,
  ultima_atividade timestamptz,
  tempo_1o_contato_med_min numeric,
  meta_receita_ativa numeric,
  meta_realizado numeric,
  meta_pct numeric,
  usa_ia boolean,
  usa_followup boolean,
  usa_agenda boolean,
  tem_meta boolean,
  registra_vendas boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  d30 date := (now() - interval '30 days')::date;
  d60 date := (now() - interval '60 days')::date;
  ts30 timestamptz := now() - interval '30 days';
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH elig AS (
    SELECT DISTINCT ON (t.organization_id) t.organization_id AS org_id
    FROM platform_tenants t
    WHERE t.product_id IS DISTINCT FROM '1fa00b04-87f2-4196-ad49-937995c08349'
    ORDER BY t.organization_id, t.created_at DESC
  )
  SELECT
    e.org_id,
    COALESCE(fat.fat_30d, 0),
    COALESCE(fat.fat_prev, 0),
    CASE WHEN COALESCE(fat.fat_prev, 0) > 0
         THEN round((COALESCE(fat.fat_30d, 0) - fat.fat_prev) / fat.fat_prev * 100, 1)
         ELSE NULL END,
    COALESCE(fat.fech_30d, 0)::int,
    CASE WHEN COALESCE(fat.fech_30d, 0) > 0
         THEN round(COALESCE(fat.fat_30d, 0) / fat.fech_30d, 2) ELSE NULL END,
    COALESCE(fat.fat_life, 0),
    COALESCE(fn.leads_30d, 0)::int,
    COALESCE(fn.mql_30d, 0)::int,
    COALESCE(fn.agend_30d, 0)::int,
    COALESCE(fn.fech_30d, 0)::int,
    round(COALESCE(fn.mql_30d, 0)::numeric / NULLIF(fn.leads_30d, 0) * 100, 1),
    round(COALESCE(fn.agend_30d, 0)::numeric / NULLIF(fn.leads_30d, 0) * 100, 1),
    round(COALESCE(fn.fech_30d, 0)::numeric / NULLIF(fn.leads_30d, 0) * 100, 1),
    COALESCE(act.msgs_30d, 0)::int,
    act.ultima_atividade,
    round(tmp.tempo_1o_med, 1),
    mt.meta_receita,
    CASE WHEN mt.meta_receita IS NOT NULL THEN COALESCE(mt.realizado, 0) ELSE NULL END,
    CASE WHEN COALESCE(mt.meta_receita, 0) > 0
         THEN round(COALESCE(mt.realizado, 0) / mt.meta_receita * 100, 1) ELSE NULL END,
    COALESCE(fn.usa_ia, false),
    COALESCE(fn.usa_followup, false),
    COALESCE(ag.usa_agenda, false),
    mt.meta_receita IS NOT NULL,
    COALESCE(fat.fech_life, 0) > 0
  FROM elig e
  -- Faturamento (vendas.valor_fechado por data_fechamento)
  LEFT JOIN LATERAL (
    SELECT
      SUM(v.valor_fechado) FILTER (WHERE v.data_fechamento >= d30) AS fat_30d,
      SUM(v.valor_fechado) FILTER (WHERE v.data_fechamento >= d60 AND v.data_fechamento < d30) AS fat_prev,
      COUNT(*) FILTER (WHERE v.data_fechamento >= d30 AND v.valor_fechado IS NOT NULL) AS fech_30d,
      SUM(v.valor_fechado) AS fat_life,
      COUNT(*) FILTER (WHERE v.valor_fechado IS NOT NULL) AS fech_life
    FROM vendas v WHERE v.organization_id = e.org_id
  ) fat ON true
  -- Funil (leads criados nos últimos 30d, excluindo test/excluir_metricas)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS leads_30d,
      COUNT(*) FILTER (WHERE l.is_qualified) AS mql_30d,
      COUNT(*) FILTER (WHERE l.is_scheduled) AS agend_30d,
      COUNT(*) FILTER (WHERE l.is_closed) AS fech_30d,
      bool_or(l.ia_ja_ativada OR l.ia_ativa) AS usa_ia,
      bool_or(COALESCE(l.followup_tentativas, 0) > 0) AS usa_followup
    FROM leads l
    WHERE l.organization_id = e.org_id
      AND l.criado_em >= ts30
      AND NOT COALESCE(l.excluir_metricas, false)
  ) fn ON true
  -- Atividade no CRM (mensagens)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE m.criado_em >= ts30) AS msgs_30d,
      MAX(m.criado_em) AS ultima_atividade
    FROM mensagens m WHERE m.organization_id = e.org_id
  ) act ON true
  -- Tempo até 1º contato (min saída - criação do lead), leads dos últimos 30d
  LEFT JOIN LATERAL (
    SELECT AVG(EXTRACT(EPOCH FROM (fc.primeira_saida - fc.criado_em)) / 60) AS tempo_1o_med
    FROM (
      SELECT l.criado_em,
        (SELECT MIN(m.criado_em) FROM mensagens m
           WHERE m.lead_id = l.id AND m.direcao = 'saida') AS primeira_saida
      FROM leads l
      WHERE l.organization_id = e.org_id
        AND l.criado_em >= ts30
        AND NOT COALESCE(l.excluir_metricas, false)
    ) fc
    WHERE fc.primeira_saida IS NOT NULL AND fc.primeira_saida >= fc.criado_em
  ) tmp ON true
  -- Agenda
  LEFT JOIN LATERAL (
    SELECT COUNT(*) > 0 AS usa_agenda
    FROM agendamentos a WHERE a.organization_id = e.org_id
  ) ag ON true
  -- Meta ativa (mensal) + realizado no período da meta
  LEFT JOIN LATERAL (
    SELECT mm.meta_receita,
      (SELECT SUM(v.valor_fechado) FROM vendas v
         WHERE v.organization_id = e.org_id
           AND v.data_fechamento >= mm.data_inicio
           AND v.data_fechamento <= mm.data_fim) AS realizado
    FROM metas mm
    WHERE mm.organization_id = e.org_id AND mm.ativo
      AND CURRENT_DATE BETWEEN mm.data_inicio AND mm.data_fim
    ORDER BY mm.data_inicio DESC LIMIT 1
  ) mt ON true;
END;
$$;

-- ── Deep dive por cliente (ficha) ─────────────────────────────────────────────
-- Retorna jsonb: série mensal (12m), funil detalhado, adoção de funcionalidades,
-- tempo de atendimento (1º contato + resposta média).
CREATE OR REPLACE FUNCTION get_cs_client_crm_detail(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts30 timestamptz := now() - interval '30 days';
  result jsonb;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'monthly', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT to_char(gs.mes, 'YYYY-MM') AS mes,
          COALESCE((SELECT SUM(v.valor_fechado) FROM vendas v
             WHERE v.organization_id = p_org_id
               AND date_trunc('month', v.data_fechamento) = gs.mes), 0) AS faturamento,
          COALESCE((SELECT COUNT(*) FROM vendas v
             WHERE v.organization_id = p_org_id
               AND date_trunc('month', v.data_fechamento) = gs.mes
               AND v.valor_fechado IS NOT NULL), 0) AS fechamentos
        FROM generate_series(date_trunc('month', now()) - interval '11 months',
                             date_trunc('month', now()), interval '1 month') gs(mes)
        ORDER BY gs.mes
      ) x
    ),
    'funil', (
      SELECT row_to_json(f) FROM (
        SELECT
          COUNT(*) AS leads,
          COUNT(*) FILTER (WHERE l.is_qualified) AS mql,
          COUNT(*) FILTER (WHERE l.is_scheduled) AS agendamentos,
          COUNT(*) FILTER (WHERE l.is_closed) AS fechamentos
        FROM leads l
        WHERE l.organization_id = p_org_id
          AND l.criado_em >= ts30
          AND NOT COALESCE(l.excluir_metricas, false)
      ) f
    ),
    'adocao', (
      SELECT row_to_json(a) FROM (
        SELECT
          (SELECT COUNT(*) FROM leads l WHERE l.organization_id = p_org_id AND (l.ia_ja_ativada OR l.ia_ativa)) AS leads_com_ia,
          (SELECT COUNT(*) FROM leads l WHERE l.organization_id = p_org_id AND COALESCE(l.followup_tentativas,0) > 0) AS leads_followup,
          (SELECT COUNT(*) FROM agendamentos ag WHERE ag.organization_id = p_org_id) AS agendamentos,
          (SELECT COUNT(*) FROM vendas v WHERE v.organization_id = p_org_id) AS vendas,
          (SELECT COUNT(*) FROM metas m WHERE m.organization_id = p_org_id) AS metas,
          (SELECT COUNT(DISTINCT lt.lead_id) FROM leads_tags lt
             JOIN leads l ON l.id = lt.lead_id WHERE l.organization_id = p_org_id) AS leads_com_tag,
          (SELECT COUNT(*) FROM leads l WHERE l.organization_id = p_org_id) AS leads_total
      ) a
    ),
    'tempo', (
      SELECT row_to_json(t) FROM (
        SELECT
          round(AVG(EXTRACT(EPOCH FROM (fc.primeira_saida - fc.criado_em)) / 60)::numeric, 1) AS tempo_1o_contato_min,
          round(AVG(fc.gap_resposta_min)::numeric, 1) AS tempo_resposta_med_min
        FROM (
          SELECT l.criado_em,
            (SELECT MIN(m.criado_em) FROM mensagens m
               WHERE m.lead_id = l.id AND m.direcao = 'saida') AS primeira_saida,
            (SELECT AVG(EXTRACT(EPOCH FROM (m2.criado_em - m1.criado_em)) / 60)
               FROM mensagens m1
               JOIN LATERAL (
                 SELECT MIN(mx.criado_em) AS criado_em FROM mensagens mx
                 WHERE mx.lead_id = m1.lead_id AND mx.direcao = 'saida' AND mx.criado_em > m1.criado_em
               ) m2 ON true
               WHERE m1.lead_id = l.id AND m1.direcao = 'entrada' AND m2.criado_em IS NOT NULL
            ) AS gap_resposta_min
          FROM leads l
          WHERE l.organization_id = p_org_id
            AND l.criado_em >= ts30
            AND NOT COALESCE(l.excluir_metricas, false)
        ) fc
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cs_crm_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_cs_client_crm_detail(uuid) TO authenticated;
