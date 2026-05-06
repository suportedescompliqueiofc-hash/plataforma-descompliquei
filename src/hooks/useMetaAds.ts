import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { useEffect, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { differenceInDays, subDays, format } from 'date-fns';

export interface MetaSummary {
  totalInvestido: number;
  totalLeads: number;
  cplMedio: number;
  ctrMedio: number;
  totalImpressoes: number;
  totalCliques: number;
  alcance: number;
  frequencia: number;
}

export interface MetaSummaryWithVariation extends MetaSummary {
  prev: MetaSummary;
  variacao: {
    investido: number | null;
    leads: number | null;
    cpl: number | null;
    ctr: number | null;
    impressoes: number | null;
    cliques: number | null;
  };
}

export type CampaignType = 'whatsapp' | 'formulario' | 'outro';

function classifyCampaign(objetivo: string | null): CampaignType {
  if (!objetivo) return 'outro';
  const obj = objetivo.toUpperCase();
  if (obj === 'OUTCOME_ENGAGEMENT' || obj === 'MESSAGES') return 'whatsapp';
  if (obj === 'OUTCOME_LEADS' || obj === 'LEAD_GENERATION') return 'formulario';
  return 'outro';
}

export interface CampaignRow {
  meta_campaign_id: string;
  nome: string;
  status: string;
  tipo: CampaignType;
  investido: number;
  leads: number;
  cpl: number;
  ctr: number;
  impressoes: number;
  cliques: number;
}

export interface AdRow {
  meta_ad_id: string;
  meta_adset_id: string;
  meta_campaign_id: string;
  nome: string;
  campanha_nome: string;
  url_thumbnail: string | null;
  investido: number;
  leads: number;
  cpl: number;
  ctr: number;
  cpc: number;
  impressoes: number;
  cliques: number;
  frequencia: number;
  quality_ranking: string | null;
  engagement_ranking: string | null;
  conversion_ranking: string | null;
  diasAtivos: number;
  status: string;
}

export interface AdsetRow {
  meta_adset_id: string;
  meta_campaign_id: string;
  nome: string;
  status: string;
  budget_diario: number | null;
  budget_total: number | null;
  optimization_goal: string | null;
  investido: number;
  leads: number;
  cpl: number;
  ctr: number;
  impressoes: number;
  cliques: number;
}

export interface DailyPoint {
  data: string;
  investido: number;
  leads: number;
  cpl: number;
}

export interface AlertItem {
  type: 'critical' | 'warning' | 'highlight' | 'info';
  message: string;
}

function calcVariation(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function computeSummary(insights: any[]): MetaSummary {
  const totalInvestido = insights.reduce((s, i) => s + (Number(i.gasto) || 0), 0);
  const totalLeads = insights.reduce((s, i) => s + (Number(i.leads) || 0), 0);
  const totalImpressoes = insights.reduce((s, i) => s + (Number(i.impressoes) || 0), 0);
  const totalCliques = insights.reduce((s, i) => s + (Number(i.cliques) || 0), 0);
  const alcance = insights.reduce((s, i) => s + (Number(i.alcance) || 0), 0);
  const frequencia = alcance > 0 ? totalImpressoes / alcance : 0;
  return {
    totalInvestido,
    totalLeads,
    cplMedio: totalLeads > 0 ? totalInvestido / totalLeads : 0,
    ctrMedio: totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0,
    totalImpressoes,
    totalCliques,
    alcance,
    frequencia,
  };
}

export function useMetaAds(dateRange: DateRange | undefined) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const from = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const to = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  const periodDays = dateRange?.from && dateRange?.to
    ? differenceInDays(dateRange.to, dateRange.from) + 1
    : 30;
  const prevFrom = format(subDays(new Date(from), periodDays), 'yyyy-MM-dd');
  const prevTo = format(subDays(new Date(from), 1), 'yyyy-MM-dd');

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel('meta-ads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_insights', filter: `organization_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['meta-ads', orgId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  const insightsQuery = useQuery({
    queryKey: ['meta-ads', 'insights', orgId, prevFrom, to],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('meta_insights')
        .select('*')
        .eq('organization_id', orgId)
        .gte('data_ref', prevFrom)
        .lte('data_ref', to);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const campaignsQuery = useQuery({
    queryKey: ['meta-ads', 'campaigns', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('organization_id', orgId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const adsetsQuery = useQuery({
    queryKey: ['meta-ads', 'adsets', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('meta_adsets')
        .select('*')
        .eq('organization_id', orgId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const adsQuery = useQuery({
    queryKey: ['meta-ads', 'ads', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('meta_ads')
        .select('*')
        .eq('organization_id', orgId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const integrationQuery = useQuery({
    queryKey: ['meta-ads', 'integration', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('integracoes')
        .select('id, ultima_sincronizacao, status')
        .eq('organization_id', orgId)
        .eq('tipo', 'meta_ads')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Sem organization_id');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://noncbgdczgcboronmcah.supabase.co'}/functions/v1/meta-ads-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ organization_id: orgId }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || 'Erro na sincronização');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
    },
  });

  const computed = useMemo(() => {
    const allInsights = insightsQuery.data || [];
    const campaigns = campaignsQuery.data || [];
    const adsets = adsetsQuery.data || [];
    const ads = adsQuery.data || [];

    const currentInsights = allInsights.filter((i: any) => i.data_ref >= from && i.data_ref <= to);
    const prevInsights = allInsights.filter((i: any) => i.data_ref >= prevFrom && i.data_ref < from);

    const campaignInsights = currentInsights.filter((i: any) => i.nivel === 'campaign');
    const prevCampaignInsights = prevInsights.filter((i: any) => i.nivel === 'campaign');
    const adInsights = currentInsights.filter((i: any) => i.nivel === 'ad');

    const summary = computeSummary(campaignInsights);
    const prev = computeSummary(prevCampaignInsights);

    const summaryWithVariation: MetaSummaryWithVariation = {
      ...summary,
      prev,
      variacao: {
        investido: calcVariation(summary.totalInvestido, prev.totalInvestido),
        leads: calcVariation(summary.totalLeads, prev.totalLeads),
        cpl: calcVariation(summary.cplMedio, prev.cplMedio),
        ctr: calcVariation(summary.ctrMedio, prev.ctrMedio),
        impressoes: calcVariation(summary.totalImpressoes, prev.totalImpressoes),
        cliques: calcVariation(summary.totalCliques, prev.totalCliques),
      },
    };

    const campaignRows: CampaignRow[] = campaigns.map((c: any) => {
      const cInsights = campaignInsights.filter((i: any) => i.meta_campaign_id === c.meta_campaign_id);
      const investido = cInsights.reduce((s: number, i: any) => s + (Number(i.gasto) || 0), 0);
      const leads = cInsights.reduce((s: number, i: any) => s + (Number(i.leads) || 0), 0);
      const impressoes = cInsights.reduce((s: number, i: any) => s + (Number(i.impressoes) || 0), 0);
      const cliques = cInsights.reduce((s: number, i: any) => s + (Number(i.cliques) || 0), 0);
      return {
        meta_campaign_id: c.meta_campaign_id,
        nome: c.nome || 'Sem nome',
        status: c.status || 'UNKNOWN',
        tipo: classifyCampaign(c.objetivo),
        investido,
        leads,
        cpl: leads > 0 ? investido / leads : 0,
        ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
        impressoes,
        cliques,
      };
    });

    const adRows: AdRow[] = ads.map((a: any) => {
      const aInsights = adInsights.filter((i: any) => i.meta_ad_id === a.meta_ad_id);
      const investido = aInsights.reduce((s: number, i: any) => s + (Number(i.gasto) || 0), 0);
      const leads = aInsights.reduce((s: number, i: any) => s + (Number(i.leads) || 0), 0);
      const cliques = aInsights.reduce((s: number, i: any) => s + (Number(i.cliques) || 0), 0);
      const impressoes = aInsights.reduce((s: number, i: any) => s + (Number(i.impressoes) || 0), 0);
      const frequencia = aInsights.length > 0
        ? aInsights.reduce((s: number, i: any) => s + (Number(i.frequencia) || 0), 0) / aInsights.length
        : 0;
      const diasComLeads = new Set(aInsights.filter((i: any) => Number(i.leads) > 0).map((i: any) => i.data_ref)).size;
      const lastInsight = aInsights[aInsights.length - 1];
      const campanha = campaigns.find((c: any) => c.meta_campaign_id === a.meta_campaign_id);
      const adset = adsets.find((as_: any) => as_.meta_adset_id === a.meta_adset_id);
      const effectiveStatus = (campanha?.status && campanha.status !== 'ACTIVE') || (adset?.status && adset.status !== 'ACTIVE')
        ? 'PAUSED'
        : (a.status || 'UNKNOWN');
      return {
        meta_ad_id: a.meta_ad_id,
        meta_adset_id: a.meta_adset_id || '',
        meta_campaign_id: a.meta_campaign_id,
        nome: a.nome || 'Sem nome',
        campanha_nome: campanha?.nome || '—',
        url_thumbnail: a.url_thumbnail,
        investido,
        leads,
        cpl: leads > 0 ? investido / leads : 0,
        ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
        cpc: cliques > 0 ? investido / cliques : 0,
        impressoes,
        cliques,
        frequencia,
        quality_ranking: lastInsight?.quality_ranking || null,
        engagement_ranking: lastInsight?.engagement_ranking || null,
        conversion_ranking: lastInsight?.conversion_ranking || null,
        diasAtivos: diasComLeads,
        status: effectiveStatus,
      };
    });

    const adsetRows: AdsetRow[] = adsets.map((as_: any) => {
      const adsInAdset = adRows.filter(a => a.meta_adset_id === as_.meta_adset_id);
      const investido = adsInAdset.reduce((s, a) => s + a.investido, 0);
      const leads = adsInAdset.reduce((s, a) => s + a.leads, 0);
      const impressoes = adsInAdset.reduce((s, a) => s + a.impressoes, 0);
      const cliques = adsInAdset.reduce((s, a) => s + a.cliques, 0);
      return {
        meta_adset_id: as_.meta_adset_id,
        meta_campaign_id: as_.meta_campaign_id,
        nome: as_.nome || 'Sem nome',
        status: as_.status || 'UNKNOWN',
        budget_diario: as_.budget_diario ? Number(as_.budget_diario) : null,
        budget_total: as_.budget_total ? Number(as_.budget_total) : null,
        optimization_goal: as_.optimization_goal,
        investido,
        leads,
        cpl: leads > 0 ? investido / leads : 0,
        ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
        impressoes,
        cliques,
      };
    });

    const dailyMap = new Map<string, { investido: number; leads: number }>();
    campaignInsights.forEach((i: any) => {
      const key = i.data_ref;
      const existing = dailyMap.get(key) || { investido: 0, leads: 0 };
      existing.investido += Number(i.gasto) || 0;
      existing.leads += Number(i.leads) || 0;
      dailyMap.set(key, existing);
    });
    const dailyData: DailyPoint[] = Array.from(dailyMap.entries())
      .map(([data, vals]) => ({
        data,
        ...vals,
        cpl: vals.leads > 0 ? vals.investido / vals.leads : 0,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));

    // Alerts
    const alerts: AlertItem[] = [];
    if (summary.cplMedio > 30) {
      alerts.push({ type: 'critical', message: `CPL acima de R$ 30 (${summary.cplMedio.toFixed(2)}). Revise segmentação ou criativos.` });
    } else if (summary.cplMedio > 20) {
      alerts.push({ type: 'warning', message: `CPL em R$ ${summary.cplMedio.toFixed(2)} — atenção ao custo.` });
    }
    if (summary.ctrMedio < 1 && summary.totalImpressoes > 1000) {
      alerts.push({ type: 'critical', message: `CTR abaixo de 1% (${summary.ctrMedio.toFixed(2)}%). Criativos com baixa atratividade.` });
    }
    if (summary.frequencia > 3) {
      alerts.push({ type: 'warning', message: `Frequência alta (${summary.frequencia.toFixed(1)}x). Público pode estar saturado.` });
    }
    const bestAd = [...adRows].filter(a => a.leads > 0).sort((a, b) => a.cpl - b.cpl)[0];
    if (bestAd && bestAd.cpl < summary.cplMedio * 0.6) {
      alerts.push({ type: 'highlight', message: `"${bestAd.nome.substring(0, 40)}" tem CPL ${((1 - bestAd.cpl / summary.cplMedio) * 100).toFixed(0)}% abaixo da média. Considere escalar.` });
    }
    if (summaryWithVariation.variacao.leads !== null && summaryWithVariation.variacao.leads > 30) {
      alerts.push({ type: 'info', message: `Leads cresceram ${summaryWithVariation.variacao.leads.toFixed(0)}% vs período anterior.` });
    }

    // Spend by campaign (for donut)
    const spendByCampaign = campaignRows
      .filter(c => c.investido > 0)
      .sort((a, b) => b.investido - a.investido)
      .slice(0, 8)
      .map(c => ({ name: c.nome.length > 25 ? c.nome.substring(0, 25) + '…' : c.nome, value: c.investido }));

    return {
      summary: summaryWithVariation,
      campaignRows,
      adsetRows,
      adRows,
      dailyData,
      alerts,
      spendByCampaign,
    };
  }, [insightsQuery.data, campaignsQuery.data, adsetsQuery.data, adsQuery.data, from, to, prevFrom]);

  return {
    ...computed,
    integration: integrationQuery.data,
    isLoading: insightsQuery.isLoading || campaignsQuery.isLoading || adsetsQuery.isLoading || adsQuery.isLoading,
    syncMutation,
  };
}
