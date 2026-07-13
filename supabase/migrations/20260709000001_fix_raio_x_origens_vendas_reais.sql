-- ═══════════════════════════════════════════════════════════════════════════
-- raio_x: bloco PAINEL idêntico ao dashboard + origens com vendas reais
-- O Athos CS puxava números que divergiam do painel do dono da clínica porque
-- media "leads criados no mês" e "is_closed entre eles" — enquanto o dashboard
-- mede LEADS COM ATIVIDADE, VENDAS por data_fechamento, TICKET = faturamento /
-- leads fechados ÚNICOS e CONVERSÃO = fechados únicos / leads com atividade.
-- Agora o raio_x traz um bloco `painel` que reproduz EXATAMENTE esses cards por
-- origem (buckets: organico[+indicacao], convenio, marketing, reativacao,
-- paciente, outros), usando o MÊS INTEIRO no default (como a aba "Mês").
-- `origens` também passou a reportar vendas/faturamento reais (aliases compat).
-- Ver memória project_raio_x_vendas_reais.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_cs_client_raio_x(p_org_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  f date := COALESCE(p_from, date_trunc('month', now())::date);
  t date := COALESCE(p_to, current_date);
  span integer := (t - f);
  pf date := f - 1 - span;
  pt date := f - 1;
  tsf timestamptz := f::timestamptz;
  tst timestamptz := (t + 1)::timestamptz;
  pnt date := CASE WHEN p_to IS NULL THEN (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date ELSE t END;
  pntst timestamptz := (pnt + 1)::timestamptz;
  result jsonb;
BEGIN
  IF NOT (is_super_admin() OR is_admin()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('de', f, 'ate', t),
    'painel', (SELECT COALESCE(jsonb_agg(row_to_json(x)),'[]'::jsonb) FROM (
      SELECT b.bucket AS origem,
             COALESCE(la.leads,0) AS leads,
             COALESCE(ve.vendas,0) AS vendas,
             COALESCE(ve.faturamento,0) AS faturamento,
             CASE WHEN COALESCE(ve.fechados,0)>0 THEN round(ve.faturamento/ve.fechados) ELSE 0 END AS ticket,
             CASE WHEN COALESCE(la.leads,0)>0 THEN round(COALESCE(ve.fechados,0)::numeric/la.leads*100,1) ELSE 0 END AS conversao_pct
      FROM (
        SELECT DISTINCT (CASE WHEN origem IN ('organico','indicacao') THEN 'organico' WHEN origem='convenio' THEN 'convenio' WHEN origem='marketing' THEN 'marketing' WHEN origem='reativacao' THEN 'reativacao' WHEN origem='paciente' THEN 'paciente' ELSE 'outros' END) AS bucket
        FROM leads WHERE organization_id=p_org_id
      ) b
      LEFT JOIN (
        SELECT (CASE WHEN l.origem IN ('organico','indicacao') THEN 'organico' WHEN l.origem='convenio' THEN 'convenio' WHEN l.origem='marketing' THEN 'marketing' WHEN l.origem='reativacao' THEN 'reativacao' WHEN l.origem='paciente' THEN 'paciente' ELSE 'outros' END) AS bucket, count(*) AS leads
        FROM leads l
        WHERE l.organization_id=p_org_id AND l.fonte IS DISTINCT FROM 'importado'
          AND ((l.criado_em>=tsf AND l.criado_em<pntst) OR (l.atualizado_em>=tsf AND l.atualizado_em<pntst))
          AND ((l.criado_em>=tsf AND l.criado_em<pntst)
            OR EXISTS (SELECT 1 FROM lead_notas n WHERE n.lead_id=l.id AND n.tipo='sistema' AND n.metadados->>'evento'='mql' AND n.criado_em>=tsf AND n.criado_em<pntst)
            OR EXISTS (SELECT 1 FROM agendamentos a WHERE a.lead_id=l.id AND a.organization_id=p_org_id AND a.data_hora_inicio>=tsf AND a.data_hora_inicio<pntst)
            OR EXISTS (SELECT 1 FROM vendas v WHERE v.lead_id=l.id AND v.organization_id=p_org_id AND v.data_fechamento BETWEEN f AND pnt))
        GROUP BY 1
      ) la ON la.bucket=b.bucket
      LEFT JOIN (
        SELECT (CASE WHEN l.origem IN ('organico','indicacao') THEN 'organico' WHEN l.origem='convenio' THEN 'convenio' WHEN l.origem='marketing' THEN 'marketing' WHEN l.origem='reativacao' THEN 'reativacao' WHEN l.origem='paciente' THEN 'paciente' ELSE 'outros' END) AS bucket,
               count(*) AS vendas, count(DISTINCT v.lead_id) AS fechados, COALESCE(SUM(v.valor_fechado),0) AS faturamento
        FROM vendas v LEFT JOIN leads l ON l.id=v.lead_id
        WHERE v.organization_id=p_org_id AND v.data_fechamento BETWEEN f AND pnt AND v.valor_fechado IS NOT NULL
        GROUP BY 1
      ) ve ON ve.bucket=b.bucket
      WHERE COALESCE(la.leads,0)>0 OR COALESCE(ve.vendas,0)>0
      ORDER BY COALESCE(ve.faturamento,0) DESC, COALESCE(la.leads,0) DESC
    ) x),
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
      SELECT COALESCE(SUM(valor_fechado) FILTER (WHERE data_fechamento BETWEEN f AND pnt),0) AS fat,
        COALESCE(SUM(valor_fechado) FILTER (WHERE data_fechamento BETWEEN pf AND pt),0) AS fat_prev,
        count(*) FILTER (WHERE data_fechamento BETWEEN f AND pnt AND valor_fechado IS NOT NULL) AS fechamentos
      FROM vendas WHERE organization_id=p_org_id
    ) x),
    'top_produtos', (SELECT COALESCE(jsonb_agg(row_to_json(x)),'[]'::jsonb) FROM (
      SELECT produto_servico AS produto, count(*) AS qtd, COALESCE(SUM(valor_fechado),0) AS valor
      FROM vendas WHERE organization_id=p_org_id AND data_fechamento BETWEEN f AND pnt AND produto_servico IS NOT NULL
      GROUP BY produto_servico ORDER BY SUM(valor_fechado) DESC NULLS LAST LIMIT 5
    ) x),
    'origens', (SELECT COALESCE(jsonb_agg(row_to_json(x)),'[]'::jsonb) FROM (
      SELECT COALESCE(le.origem, ve.origem) AS origem,
             COALESCE(le.leads,0) AS leads_novos, COALESCE(le.leads,0) AS leads,
             COALESCE(ve.vendas,0) AS vendas, COALESCE(ve.vendas,0) AS fechamentos,
             COALESCE(ve.faturamento,0) AS faturamento
      FROM (
        SELECT COALESCE(origem,'sem origem') AS origem, count(*) AS leads
        FROM leads WHERE organization_id=p_org_id AND criado_em>=tsf AND criado_em<tst AND NOT COALESCE(excluir_metricas,false)
        GROUP BY 1
      ) le
      FULL OUTER JOIN (
        SELECT COALESCE(l.origem,'sem origem') AS origem, count(*) AS vendas, COALESCE(SUM(v.valor_fechado),0) AS faturamento
        FROM vendas v LEFT JOIN leads l ON l.id=v.lead_id
        WHERE v.organization_id=p_org_id AND v.data_fechamento BETWEEN f AND pnt AND v.valor_fechado IS NOT NULL
        GROUP BY 1
      ) ve ON ve.origem = le.origem
      ORDER BY COALESCE(ve.faturamento,0) DESC, COALESCE(le.leads,0) DESC
      LIMIT 8
    ) x)
  ) INTO result;
  RETURN result;
END; $function$;
