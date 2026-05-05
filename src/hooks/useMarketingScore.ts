import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

export interface ScoreConfig {
  cpl_otimo: number;
  cpl_bom: number;
  cpl_aceitavel: number;
  ctr_otimo: number;
  ctr_bom: number;
  ctr_aceitavel: number;
  peso_cpl: number;
  peso_ctr: number;
  peso_leads: number;
  peso_consistencia: number;
  leads_minimo: number;
  gasto_alerta_sem_leads: number;
  tag_escalar: string;
  tag_manter: string;
  tag_monitorar: string;
  tag_pausar: string;
  cor_escalar: string;
  cor_manter: string;
  cor_monitorar: string;
  cor_pausar: string;
}

const DEFAULTS: ScoreConfig = {
  cpl_otimo: 5, cpl_bom: 8, cpl_aceitavel: 15,
  ctr_otimo: 2, ctr_bom: 1.2, ctr_aceitavel: 0.8,
  peso_cpl: 40, peso_ctr: 30, peso_leads: 20, peso_consistencia: 10,
  leads_minimo: 1, gasto_alerta_sem_leads: 20,
  tag_escalar: "Escalar", tag_manter: "Manter", tag_monitorar: "Monitorar", tag_pausar: "Pausar",
  cor_escalar: "#22c55e", cor_manter: "#3b82f6", cor_monitorar: "#f59e0b", cor_pausar: "#ef4444",
};

export interface ScoreInput {
  cpl: number;
  ctr: number;
  leads: number;
  diasAtivos: number;
  gasto: number;
}

export interface ScoreOutput {
  score: number;
  tag: string;
  cor: string;
  breakdown: {
    cpl_pts: number;
    ctr_pts: number;
    leads_pts: number;
    consistencia_pts: number;
  };
}

function parseConfig(data: any): ScoreConfig {
  return {
    cpl_otimo: Number(data.cpl_otimo) || DEFAULTS.cpl_otimo,
    cpl_bom: Number(data.cpl_bom) || DEFAULTS.cpl_bom,
    cpl_aceitavel: Number(data.cpl_aceitavel) || DEFAULTS.cpl_aceitavel,
    ctr_otimo: Number(data.ctr_otimo) || DEFAULTS.ctr_otimo,
    ctr_bom: Number(data.ctr_bom) || DEFAULTS.ctr_bom,
    ctr_aceitavel: Number(data.ctr_aceitavel) || DEFAULTS.ctr_aceitavel,
    peso_cpl: Number(data.peso_cpl) ?? DEFAULTS.peso_cpl,
    peso_ctr: Number(data.peso_ctr) ?? DEFAULTS.peso_ctr,
    peso_leads: Number(data.peso_leads) ?? DEFAULTS.peso_leads,
    peso_consistencia: Number(data.peso_consistencia) ?? DEFAULTS.peso_consistencia,
    leads_minimo: Number(data.leads_minimo) ?? DEFAULTS.leads_minimo,
    gasto_alerta_sem_leads: Number(data.gasto_alerta_sem_leads) || DEFAULTS.gasto_alerta_sem_leads,
    tag_escalar: data.tag_escalar || DEFAULTS.tag_escalar,
    tag_manter: data.tag_manter || DEFAULTS.tag_manter,
    tag_monitorar: data.tag_monitorar || DEFAULTS.tag_monitorar,
    tag_pausar: data.tag_pausar || DEFAULTS.tag_pausar,
    cor_escalar: data.cor_escalar || DEFAULTS.cor_escalar,
    cor_manter: data.cor_manter || DEFAULTS.cor_manter,
    cor_monitorar: data.cor_monitorar || DEFAULTS.cor_monitorar,
    cor_pausar: data.cor_pausar || DEFAULTS.cor_pausar,
  };
}

function computeScore(input: ScoreInput, cfg: ScoreConfig): ScoreOutput {
  let cpl_pts = 0;
  if (input.cpl > 0) {
    if (input.cpl <= cfg.cpl_otimo) cpl_pts = cfg.peso_cpl;
    else if (input.cpl <= cfg.cpl_bom) cpl_pts = cfg.peso_cpl * 0.7;
    else if (input.cpl <= cfg.cpl_aceitavel) cpl_pts = cfg.peso_cpl * 0.4;
  }

  let ctr_pts = 0;
  if (input.ctr >= cfg.ctr_otimo) ctr_pts = cfg.peso_ctr;
  else if (input.ctr >= cfg.ctr_bom) ctr_pts = cfg.peso_ctr * 0.7;
  else if (input.ctr >= cfg.ctr_aceitavel) ctr_pts = cfg.peso_ctr * 0.4;

  let leads_pts = 0;
  if (input.leads >= 10) leads_pts = cfg.peso_leads;
  else if (input.leads >= 5) leads_pts = cfg.peso_leads * 0.75;
  else if (input.leads >= 2) leads_pts = cfg.peso_leads * 0.5;
  else if (input.leads >= 1) leads_pts = cfg.peso_leads * 0.25;

  let consistencia_pts = 0;
  if (input.diasAtivos >= 5) consistencia_pts = cfg.peso_consistencia;
  else if (input.diasAtivos >= 3) consistencia_pts = cfg.peso_consistencia * 0.6;
  else if (input.diasAtivos >= 1) consistencia_pts = cfg.peso_consistencia * 0.3;

  const score = Math.round(cpl_pts + ctr_pts + leads_pts + consistencia_pts);

  let tag: string;
  let cor: string;
  if (score >= 70) { tag = cfg.tag_escalar; cor = cfg.cor_escalar; }
  else if (score >= 50) { tag = cfg.tag_manter; cor = cfg.cor_manter; }
  else if (score >= 30) { tag = cfg.tag_monitorar; cor = cfg.cor_monitorar; }
  else { tag = cfg.tag_pausar; cor = cfg.cor_pausar; }

  return {
    score,
    tag,
    cor,
    breakdown: {
      cpl_pts: Math.round(cpl_pts),
      ctr_pts: Math.round(ctr_pts),
      leads_pts: Math.round(leads_pts),
      consistencia_pts: Math.round(consistencia_pts),
    },
  };
}

export function useMarketingScore() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ['marketing-score-config', orgId],
    queryFn: async () => {
      if (!orgId) return DEFAULTS;
      const { data, error } = await (supabase
        .from('marketing_score_config' as any) as any)
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return data ? parseConfig(data) : DEFAULTS;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
  });

  const config = configQuery.data ?? DEFAULTS;

  const calcularScore = useCallback(
    (input: ScoreInput): ScoreOutput => computeScore(input, config),
    [config],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['marketing-score-config', orgId] });
  }, [queryClient, orgId]);

  return useMemo(() => ({
    calcularScore,
    config,
    isLoading: configQuery.isLoading,
    refetch,
  }), [calcularScore, config, configQuery.isLoading, refetch]);
}
