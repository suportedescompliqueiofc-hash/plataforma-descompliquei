-- Sistema de 3 níveis de meta (Piso / Alvo / Super)
ALTER TABLE metas
  ADD COLUMN IF NOT EXISTS tipo_meta text DEFAULT 'simples',
  ADD COLUMN IF NOT EXISTS meta_receita_piso numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_receita_super numeric DEFAULT 0;

ALTER TABLE metas
  DROP CONSTRAINT IF EXISTS metas_tipo_meta_check;

ALTER TABLE metas
  ADD CONSTRAINT metas_tipo_meta_check
  CHECK (tipo_meta IN ('simples', 'niveis'));

-- Recria a view incluindo os novos campos
DROP VIEW IF EXISTS vw_meta_acompanhamento;

CREATE VIEW vw_meta_acompanhamento AS
WITH dias_uteis AS (
  SELECT
    m.id AS meta_id,
    m.data_fim - CURRENT_DATE AS dias_restantes,
    CURRENT_DATE - m.data_inicio AS dias_decorridos,
    m.data_fim - m.data_inicio + 1 AS total_dias
  FROM metas m
),
realizado AS (
  SELECT
    m.id AS meta_id,
    m.organization_id,
    (SELECT count(*) FROM leads l
      WHERE l.organization_id = m.organization_id
        AND date(l.criado_em) >= m.data_inicio AND date(l.criado_em) <= m.data_fim
    ) AS leads_total,
    (SELECT count(*) FROM leads l
      WHERE l.organization_id = m.organization_id
        AND date(l.criado_em) >= m.data_inicio AND date(l.criado_em) <= m.data_fim
        AND l.is_qualified = true
    ) AS mqls_total,
    (SELECT count(DISTINCT ag.lead_id) FROM agendamentos ag
      WHERE ag.organization_id = m.organization_id
        AND date(ag.data_hora_inicio) >= m.data_inicio AND date(ag.data_hora_inicio) <= m.data_fim
        AND ag.status = 'realizado'
    ) AS reunioes_total,
    (SELECT count(DISTINCT v.lead_id) FROM vendas v
      WHERE v.organization_id = m.organization_id
        AND v.data_fechamento >= m.data_inicio AND v.data_fechamento <= m.data_fim
    ) AS fechamentos_total,
    (SELECT COALESCE(sum(v.valor_fechado), 0) FROM vendas v
      WHERE v.organization_id = m.organization_id
        AND v.data_fechamento >= m.data_inicio AND v.data_fechamento <= m.data_fim
    ) AS receita_total,
    0::numeric AS bucket_total,
    (SELECT count(*) FROM leads l
      WHERE l.organization_id = m.organization_id AND date(l.criado_em) = CURRENT_DATE
    ) AS leads_hoje,
    (SELECT count(*) FROM leads l
      WHERE l.organization_id = m.organization_id AND date(l.criado_em) = CURRENT_DATE AND l.is_qualified = true
    ) AS mqls_hoje,
    (SELECT count(*) FROM leads l
      WHERE l.organization_id = m.organization_id AND l.criado_em >= date_trunc('week', now())
    ) AS leads_semana,
    (SELECT count(*) FROM leads l
      WHERE l.organization_id = m.organization_id AND l.criado_em >= date_trunc('week', now()) AND l.is_qualified = true
    ) AS mqls_semana
  FROM metas m
)
SELECT
  m.id,
  m.organization_id,
  m.nome,
  m.periodo_tipo,
  m.data_inicio,
  m.data_fim,
  m.ativo,
  m.meta_receita,
  m.ticket_medio,
  m.tx_mql,
  m.tx_agendamento,
  m.tx_conversao,
  m.meta_fechamentos,
  m.meta_reunioes,
  m.meta_mqls,
  m.meta_leads,
  m.cpl_meta,
  m.meta_bucket,
  m.criado_em,
  COALESCE(m.tipo_meta, 'simples')       AS tipo_meta,
  COALESCE(m.meta_receita_piso, 0)       AS meta_receita_piso,
  COALESCE(m.meta_receita_super, 0)      AS meta_receita_super,
  r.leads_total,
  r.mqls_total,
  r.reunioes_total,
  r.fechamentos_total,
  r.receita_total,
  r.bucket_total,
  r.leads_hoje,
  r.mqls_hoje,
  r.leads_semana,
  r.mqls_semana,
  du.dias_restantes,
  du.dias_decorridos,
  du.total_dias,
  CASE WHEN m.meta_receita > 0 THEN round(r.receita_total / m.meta_receita * 100, 1) ELSE 0 END AS pct_receita,
  CASE WHEN m.meta_leads > 0  THEN round(r.leads_total::numeric / m.meta_leads * 100, 1) ELSE 0 END AS pct_leads,
  CASE WHEN m.meta_mqls > 0   THEN round(r.mqls_total::numeric / m.meta_mqls * 100, 1) ELSE 0 END AS pct_mqls,
  CASE WHEN m.meta_reunioes > 0 THEN round(r.reunioes_total::numeric / m.meta_reunioes * 100, 1) ELSE 0 END AS pct_reunioes,
  CASE WHEN m.meta_fechamentos > 0 THEN round(r.fechamentos_total::numeric / m.meta_fechamentos * 100, 1) ELSE 0 END AS pct_fechamentos,
  round(m.meta_leads    / NULLIF(du.total_dias, 0)::numeric, 1) AS meta_leads_dia,
  round(m.meta_mqls     / NULLIF(du.total_dias, 0)::numeric, 1) AS meta_mqls_dia,
  round(m.meta_reunioes / NULLIF(du.total_dias, 0)::numeric, 1) AS meta_reunioes_dia,
  round(m.meta_receita  / NULLIF(du.total_dias, 0)::numeric, 2) AS meta_receita_dia,
  round(m.meta_leads    / NULLIF(ceil(du.total_dias::numeric / 7), 0), 1) AS meta_leads_semana,
  round(m.meta_mqls     / NULLIF(ceil(du.total_dias::numeric / 7), 0), 1) AS meta_mqls_semana,
  round(m.meta_reunioes / NULLIF(ceil(du.total_dias::numeric / 7), 0), 1) AS meta_reunioes_semana,
  round(m.meta_receita  / NULLIF(ceil(du.total_dias::numeric / 7), 0), 2) AS meta_receita_semana,
  CASE WHEN du.dias_restantes > 0 THEN round((m.meta_receita - r.receita_total) / du.dias_restantes::numeric, 2) ELSE 0 END AS receita_necessaria_por_dia,
  CASE WHEN du.dias_restantes > 0 THEN round((m.meta_leads - r.leads_total::numeric) / du.dias_restantes::numeric, 1) ELSE 0 END AS leads_necessarios_por_dia
FROM metas m
LEFT JOIN realizado r ON m.id = r.meta_id
JOIN dias_uteis du ON m.id = du.meta_id;
