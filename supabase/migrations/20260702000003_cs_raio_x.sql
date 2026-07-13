-- Raio-X operacional de um cliente para o Athos CS — leitura profunda do CRM
-- POR PERÍODO DE CALENDÁRIO (sem janelas móveis). Sem p_from/p_to = mês corrente.
-- Também: get_cs_month_fat() = faturamento do mês corrente por org (resumo do Athos).
-- SECURITY DEFINER (cross-org, gated para admin).

CREATE OR REPLACE FUNCTION get_cs_month_fat()
RETURNS TABLE(org_id uuid, fat_mes numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT v.organization_id, COALESCE(SUM(v.valor_fechado), 0)
    FROM vendas v WHERE v.data_fechamento >= date_trunc('month', now())::date
    GROUP BY v.organization_id;
END; $$;
GRANT EXECUTE ON FUNCTION get_cs_month_fat() TO authenticated;

-- Remove eventual versão antiga de 1 argumento (janela móvel) para evitar overload ambíguo.
DROP FUNCTION IF EXISTS get_cs_client_raio_x(uuid);

CREATE OR REPLACE FUNCTION get_cs_client_raio_x(p_org_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  f date := COALESCE(p_from, date_trunc('month', now())::date);
  t date := COALESCE(p_to, current_date);
  span integer := (t - f);
  pf date := f - 1 - span;
  pt date := f - 1;
  tsf timestamptz := f::timestamptz;
  tst timestamptz := (t + 1)::timestamptz;
  result jsonb;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('de', f, 'ate', t),
    'funil', (SELECT row_to_json(x) FROM (
      SELECT count(*) AS leads, count(*) FILTER (WHERE is_qualified) AS mql,
        count(*) FILTER (WHERE is_scheduled) AS agendados, count(*) FILTER (WHERE is_closed) AS fechados
      FROM leads l WHERE l.organization_id=p_org_id AND l.criado_em>=tsf AND l.criado_em<tst AND NOT COALESCE(l.excluir_metricas,false)
    ) x),
    'oportunidades', (SELECT row_to_json(x) FROM (
      SELECT
        (SELECT count(*) FROM leads l WHERE l.organization_id=p_org_id AND l.is_qualified AND NOT l.is_scheduled AND NOT l.is_closed AND l.criado_em>=tsf AND l.criado_em<tst AND NOT COALESCE(l.excluir_metricas,false)) AS qualificados_sem_agendamento,
        (SELECT count(*) FROM leads l WHERE l.organization_id=p_org_id AND l.is_scheduled AND NOT l.is_closed AND l.criado_em>=tsf AND l.criado_em<tst AND NOT COALESCE(l.excluir_metricas,false)) AS agendados_sem_fechamento,
        (SELECT COALESCE(SUM(a.valor_orcado),0) FROM agendamentos a JOIN leads l ON l.id=a.lead_id WHERE a.organization_id=p_org_id AND NOT COALESCE(l.is_closed,false) AND a.status IN ('agendado','confirmado') AND l.criado_em>=tsf AND l.criado_em<tst) AS valor_potencial_agendado
    ) x),
    'atendimento', (SELECT row_to_json(x) FROM (
      SELECT
        (SELECT count(*) FROM leads l WHERE l.organization_id=p_org_id AND l.ultimo_contato IS NULL AND NOT l.is_closed AND l.criado_em>=tsf AND l.criado_em<tst AND NOT COALESCE(l.excluir_metricas,false)) AS sem_primeiro_contato,
        (SELECT count(*) FROM leads l WHERE l.organization_id=p_org_id AND NOT l.is_closed AND l.ultimo_contato < now()-interval '7 days' AND l.criado_em>=tsf AND l.criado_em<tst AND NOT COALESCE(l.excluir_metricas,false)) AS parados_7d,
        (SELECT count(*) FROM leads l WHERE l.organization_id=p_org_id AND NOT l.is_closed AND l.criado_em>=tsf AND l.criado_em<tst AND NOT COALESCE(l.excluir_metricas,false) AND (SELECT m.direcao FROM mensagens m WHERE m.lead_id=l.id ORDER BY m.criado_em DESC LIMIT 1)='entrada') AS aguardando_resposta,
        (SELECT count(*) FROM mensagens m WHERE m.organization_id=p_org_id AND m.criado_em>=tsf AND m.criado_em<tst) AS msgs_periodo,
        (SELECT EXTRACT(DAY FROM now()-MAX(m.criado_em))::int FROM mensagens m WHERE m.organization_id=p_org_id AND m.direcao='saida') AS dias_desde_ultimo_envio
    ) x),
    'agenda', (SELECT row_to_json(x) FROM (
      SELECT
        (SELECT count(*) FROM agendamentos a WHERE a.organization_id=p_org_id AND a.data_hora_inicio>now() AND a.status IN ('agendado','confirmado')) AS proximos,
        (SELECT count(*) FROM agendamentos a WHERE a.organization_id=p_org_id AND a.status='realizado' AND a.data_hora_inicio>=tsf AND a.data_hora_inicio<tst) AS realizados,
        (SELECT count(*) FROM agendamentos a WHERE a.organization_id=p_org_id AND a.status='faltou' AND a.data_hora_inicio>=tsf AND a.data_hora_inicio<tst) AS faltas,
        (SELECT count(*) FROM agendamentos a WHERE a.organization_id=p_org_id AND a.status='cancelado' AND a.data_hora_inicio>=tsf AND a.data_hora_inicio<tst) AS cancelados
    ) x),
    'vendas', (SELECT row_to_json(x) FROM (
      SELECT COALESCE(SUM(valor_fechado) FILTER (WHERE data_fechamento BETWEEN f AND t),0) AS fat,
        COALESCE(SUM(valor_fechado) FILTER (WHERE data_fechamento BETWEEN pf AND pt),0) AS fat_prev,
        count(*) FILTER (WHERE data_fechamento BETWEEN f AND t AND valor_fechado IS NOT NULL) AS fechamentos
      FROM vendas WHERE organization_id=p_org_id
    ) x),
    'top_produtos', (SELECT COALESCE(jsonb_agg(row_to_json(x)),'[]'::jsonb) FROM (
      SELECT produto_servico AS produto, count(*) AS qtd, COALESCE(SUM(valor_fechado),0) AS valor
      FROM vendas WHERE organization_id=p_org_id AND data_fechamento BETWEEN f AND t AND produto_servico IS NOT NULL
      GROUP BY produto_servico ORDER BY SUM(valor_fechado) DESC NULLS LAST LIMIT 5
    ) x),
    'origens', (SELECT COALESCE(jsonb_agg(row_to_json(x)),'[]'::jsonb) FROM (
      SELECT COALESCE(origem,'sem origem') AS origem, count(*) AS leads, count(*) FILTER (WHERE is_closed) AS fechamentos
      FROM leads WHERE organization_id=p_org_id AND criado_em>=tsf AND criado_em<tst AND NOT COALESCE(excluir_metricas,false)
      GROUP BY origem ORDER BY count(*) DESC LIMIT 6
    ) x)
  ) INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION get_cs_client_raio_x(uuid, date, date) TO authenticated;
