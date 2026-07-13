// Métricas de RESULTADO no CRM para o módulo de CS (Admin OS).
// Fonte: RPCs SECURITY DEFINER get_cs_crm_metrics() e get_cs_client_crm_detail(org),
// que agregam dados cross-org bypassando RLS (mesmo padrão do get_cs_clients).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CSCrmMetrics, CSCrmDetail, CSCrmPeriod, CSCrmTrendPoint } from '@/pages/admin-os/types/cs';

// Resumo de todos os clientes → mapa organization_id → métricas.
export function useCSCrmMetrics() {
  return useQuery({
    queryKey: ['cs-crm-metrics'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Record<string, CSCrmMetrics>> => {
      const { data, error } = await supabase.rpc('get_cs_crm_metrics');
      if (error) throw error;
      const map: Record<string, CSCrmMetrics> = {};
      (data || []).forEach((r: any) => {
        map[r.organization_id] = {
          organization_id: r.organization_id,
          fat_30d: Number(r.fat_30d ?? 0),
          fat_30d_prev: Number(r.fat_30d_prev ?? 0),
          fat_growth_pct: r.fat_growth_pct == null ? null : Number(r.fat_growth_pct),
          fechamentos_30d: Number(r.fechamentos_30d ?? 0),
          ticket_medio_30d: r.ticket_medio_30d == null ? null : Number(r.ticket_medio_30d),
          fat_total_lifetime: Number(r.fat_total_lifetime ?? 0),
          leads_30d: Number(r.leads_30d ?? 0),
          mql_30d: Number(r.mql_30d ?? 0),
          agend_30d: Number(r.agend_30d ?? 0),
          fech_30d: Number(r.fech_30d ?? 0),
          tx_mql: r.tx_mql == null ? null : Number(r.tx_mql),
          tx_agend: r.tx_agend == null ? null : Number(r.tx_agend),
          tx_fech: r.tx_fech == null ? null : Number(r.tx_fech),
          msgs_30d: Number(r.msgs_30d ?? 0),
          ultima_atividade: r.ultima_atividade ?? null,
          tempo_1o_contato_med_min: r.tempo_1o_contato_med_min == null ? null : Number(r.tempo_1o_contato_med_min),
          meta_receita_ativa: r.meta_receita_ativa == null ? null : Number(r.meta_receita_ativa),
          meta_realizado: r.meta_realizado == null ? null : Number(r.meta_realizado),
          meta_pct: r.meta_pct == null ? null : Number(r.meta_pct),
          usa_ia: !!r.usa_ia,
          usa_followup: !!r.usa_followup,
          usa_agenda: !!r.usa_agenda,
          tem_meta: !!r.tem_meta,
          registra_vendas: !!r.registra_vendas,
        };
      });
      return map;
    },
  });
}

// Deep dive de um cliente (série mensal, funil, adoção, tempo).
export function useCSClientCrmDetail(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['cs-client-crm-detail', orgId],
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<CSCrmDetail> => {
      const { data, error } = await supabase.rpc('get_cs_client_crm_detail', { p_org_id: orgId });
      if (error) throw error;
      const d = (data || {}) as any;
      return {
        monthly: (d.monthly || []).map((m: any) => ({
          mes: m.mes,
          faturamento: Number(m.faturamento ?? 0),
          fechamentos: Number(m.fechamentos ?? 0),
        })),
        funil: {
          leads: Number(d.funil?.leads ?? 0),
          mql: Number(d.funil?.mql ?? 0),
          agendamentos: Number(d.funil?.agendamentos ?? 0),
          fechamentos: Number(d.funil?.fechamentos ?? 0),
        },
        adocao: {
          leads_com_ia: Number(d.adocao?.leads_com_ia ?? 0),
          leads_followup: Number(d.adocao?.leads_followup ?? 0),
          agendamentos: Number(d.adocao?.agendamentos ?? 0),
          vendas: Number(d.adocao?.vendas ?? 0),
          metas: Number(d.adocao?.metas ?? 0),
          leads_com_tag: Number(d.adocao?.leads_com_tag ?? 0),
          leads_total: Number(d.adocao?.leads_total ?? 0),
        },
        tempo: d.tempo
          ? {
              tempo_1o_contato_min: d.tempo.tempo_1o_contato_min == null ? null : Number(d.tempo.tempo_1o_contato_min),
              tempo_resposta_med_min: d.tempo.tempo_resposta_med_min == null ? null : Number(d.tempo.tempo_resposta_med_min),
            }
          : null,
      };
    },
  });
}

// Tendência do Resultado (snapshots diários, últimos 90 dias) — gráfico da ficha.
export function useCSClientCrmTrend(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['cs-client-crm-trend', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CSCrmTrendPoint[]> => {
      const { data, error } = await supabase.rpc('get_cs_client_crm_trend', { p_org_id: orgId });
      if (error) throw error;
      return ((data || []) as any[]).map(r => ({
        snapshot_date: r.snapshot_date,
        resultado_score: r.resultado_score == null ? null : Number(r.resultado_score),
        fat_30d: Number(r.fat_30d ?? 0),
        fat_growth_pct: r.fat_growth_pct == null ? null : Number(r.fat_growth_pct),
      }));
    },
  });
}

// Métricas do CRM para um intervalo [from, to] (datas 'yyyy-MM-dd') — filtro da ficha.
export function useCSClientCrmPeriod(orgId: string | null | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['cs-client-crm-period', orgId, from, to],
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<CSCrmPeriod> => {
      const { data, error } = await supabase.rpc('get_cs_client_crm_period', { p_org_id: orgId, p_from: from, p_to: to });
      if (error) throw error;
      const d = (data || {}) as any;
      return {
        faturamento: Number(d.faturamento ?? 0),
        fechamentos: Number(d.fechamentos ?? 0),
        faturamento_prev: Number(d.faturamento_prev ?? 0),
        msgs: Number(d.msgs ?? 0),
        funil: {
          leads: Number(d.funil?.leads ?? 0),
          mql: Number(d.funil?.mql ?? 0),
          agendamentos: Number(d.funil?.agendamentos ?? 0),
          fechamentos: Number(d.funil?.fechamentos ?? 0),
        },
        tempo: d.tempo
          ? {
              tempo_1o_contato_min: d.tempo.tempo_1o_contato_min == null ? null : Number(d.tempo.tempo_1o_contato_min),
              tempo_resposta_med_min: d.tempo.tempo_resposta_med_min == null ? null : Number(d.tempo.tempo_resposta_med_min),
            }
          : null,
      };
    },
  });
}

// Configura a meta mensal de faturamento do cliente (a partir do CS).
export function useSetClientMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, metaReceita }: { orgId: string; metaReceita: number }) => {
      const { error } = await supabase.rpc('cs_set_client_meta', { p_org_id: orgId, p_meta_receita: metaReceita });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-crm-metrics'] });
      qc.invalidateQueries({ queryKey: ['cs-client-crm-detail'] });
    },
  });
}
