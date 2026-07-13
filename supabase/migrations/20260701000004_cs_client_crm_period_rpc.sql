-- Métricas de Resultado no CRM de um cliente para um INTERVALO arbitrário
-- (usado pelo filtro Dia/Semana/Mês da ficha do CS). SECURITY DEFINER porque o
-- CSM está olhando dados de outra org (RLS bloquearia). Compara sempre com o
-- período imediatamente anterior de mesma duração (crescimento período-a-período).
CREATE OR REPLACE FUNCTION get_cs_client_crm_period(p_org_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  span integer := (p_to - p_from);                 -- duração em dias (diferença inclusiva)
  prev_to date := p_from - 1;
  prev_from date := p_from - 1 - span;
  ts_from timestamptz := p_from::timestamptz;
  ts_to timestamptz := (p_to + 1)::timestamptz;     -- limite superior exclusivo
  result jsonb;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'faturamento', COALESCE((SELECT SUM(v.valor_fechado) FROM vendas v
       WHERE v.organization_id = p_org_id AND v.data_fechamento BETWEEN p_from AND p_to), 0),
    'fechamentos', COALESCE((SELECT COUNT(*) FROM vendas v
       WHERE v.organization_id = p_org_id AND v.data_fechamento BETWEEN p_from AND p_to AND v.valor_fechado IS NOT NULL), 0),
    'faturamento_prev', COALESCE((SELECT SUM(v.valor_fechado) FROM vendas v
       WHERE v.organization_id = p_org_id AND v.data_fechamento BETWEEN prev_from AND prev_to), 0),
    'msgs', COALESCE((SELECT COUNT(*) FROM mensagens m
       WHERE m.organization_id = p_org_id AND m.criado_em >= ts_from AND m.criado_em < ts_to), 0),
    'funil', (
      SELECT row_to_json(f) FROM (
        SELECT COUNT(*) AS leads,
          COUNT(*) FILTER (WHERE l.is_qualified) AS mql,
          COUNT(*) FILTER (WHERE l.is_scheduled) AS agendamentos,
          COUNT(*) FILTER (WHERE l.is_closed) AS fechamentos
        FROM leads l
        WHERE l.organization_id = p_org_id
          AND l.criado_em >= ts_from AND l.criado_em < ts_to
          AND NOT COALESCE(l.excluir_metricas, false)
      ) f
    ),
    'tempo', (
      SELECT row_to_json(t) FROM (
        SELECT round(AVG(EXTRACT(EPOCH FROM (fc.primeira_saida - fc.criado_em)) / 60)::numeric, 1) AS tempo_1o_contato_min,
          round(AVG(fc.gap)::numeric, 1) AS tempo_resposta_med_min
        FROM (
          SELECT l.criado_em,
            (SELECT MIN(m.criado_em) FROM mensagens m WHERE m.lead_id = l.id AND m.direcao = 'saida') AS primeira_saida,
            (SELECT AVG(EXTRACT(EPOCH FROM (m2.c - m1.criado_em)) / 60)
               FROM mensagens m1
               JOIN LATERAL (
                 SELECT MIN(mx.criado_em) AS c FROM mensagens mx
                 WHERE mx.lead_id = m1.lead_id AND mx.direcao = 'saida' AND mx.criado_em > m1.criado_em
               ) m2 ON true
               WHERE m1.lead_id = l.id AND m1.direcao = 'entrada' AND m2.c IS NOT NULL) AS gap
          FROM leads l
          WHERE l.organization_id = p_org_id
            AND l.criado_em >= ts_from AND l.criado_em < ts_to
            AND NOT COALESCE(l.excluir_metricas, false)
        ) fc
        WHERE fc.primeira_saida IS NOT NULL AND fc.primeira_saida >= fc.criado_em
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cs_client_crm_period(uuid, date, date) TO authenticated;
