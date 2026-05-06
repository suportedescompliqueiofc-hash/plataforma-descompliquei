import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, eachDayOfInterval, endOfDay } from 'date-fns';
import { useEffect } from 'react';

export type OrigemFilter = 'geral' | 'marketing' | 'organico';

export function useDashboard(dateRange: DateRange | undefined, origemFilter: OrigemFilter = 'geral') {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase.channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `organization_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas', filter: `organization_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_expenses', filter: `organization_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  const { data: metrics, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-metrics', orgId, dateRange, origemFilter],
    queryFn: async () => {
      if (!user || !orgId || !dateRange?.from || !dateRange?.to) return null;

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();
      const startDayStr = format(startOfDay(dateRange.from), 'yyyy-MM-dd');
      const endDayStr = format(endOfDay(dateRange.to), 'yyyy-MM-dd');

      try {
        const [ leadsRes, stagesRes, vendasRes, expensesRes, criativosRes, metaInsightsRes ] = await Promise.all([
          supabase
            .from('leads')
            .select('*')
            .eq('organization_id', orgId)
            .or(`and(criado_em.gte.${startDate},criado_em.lte.${endDate}),and(atualizado_em.gte.${startDate},atualizado_em.lte.${endDate})`),
          supabase.from('etapas').select('*').order('posicao_ordem'),
          supabase.from('vendas').select('*').eq('organization_id', orgId).gte('data_fechamento', startDayStr).lte('data_fechamento', endDayStr),
          supabase.from('marketing_expenses').select('amount').eq('organization_id', orgId).gte('expense_date', startDayStr).lte('expense_date', endDayStr),
          supabase.from('criativos').select('platform_metrics').eq('organization_id', orgId),
          supabase.from('meta_insights' as any).select('gasto').eq('organization_id', orgId).eq('nivel', 'campaign').gte('data_ref', startDayStr).lte('data_ref', endDayStr),
        ]);

        if (leadsRes.error?.status === 401) throw new Error("Sessão expirada.");

        // Exclui leads marcados como "fora das métricas" (testes, spam, etc.)
        const leads = (leadsRes.data || []).filter(l => !l.excluir_metricas);
        const allStages = stagesRes.data || [];
        const vendas = vendasRes.data || [];
        const expenses = expensesRes.data || [];
        const criativos = criativosRes.data || [];
        const metaInsights = (metaInsightsRes.data as any[]) || [];

        const funnelStages = allStages.filter(s => s.em_funil);
        const lostPos = allStages.find(s => s.nome.toLowerCase() === 'perdido')?.posicao_ordem || 999;
        const convertedStage = funnelStages[funnelStages.length - 1];
        const convertedPos = convertedStage?.posicao_ordem || 6;

        const isLeadInFunnel = (lead: any) => {
          const leadStage = allStages.find(s => s.posicao_ordem === lead.posicao_pipeline);
          return !!leadStage?.em_funil;
        };

        const isLeadConvertedInPeriod = (lead: any) =>
          isLeadInFunnel(lead) &&
          lead.posicao_pipeline >= convertedPos &&
          lead.posicao_pipeline < lostPos &&
          lead.atualizado_em >= startDate &&
          lead.atualizado_em <= endDate;

        const faturamentoTotal = vendas.reduce((sum, v) => sum + Number(v.valor_fechado || 0), 0);

        const metaAdsSpend = metaInsights.reduce((a: number, c: any) => a + Number(c.gasto || 0), 0);
        const manualExpenses = expenses.reduce((a, c) => a + Number(c.amount || 0), 0);
        const criativosSpend = criativos.reduce((a, c) => {
          const m = c.platform_metrics as any;
          return (m?.included_in_dashboard) ? a + Number(m.spend || 0) : a;
        }, 0);
        const totalInvestment = metaAdsSpend > 0 ? metaAdsSpend : (manualExpenses + criativosSpend);

        const filterByOrigem = (l: any) => {
          if (origemFilter === 'marketing') return l.origem === 'marketing';
          if (origemFilter === 'organico') return l.origem !== 'marketing';
          return true;
        };

        const leadsCreatedInPeriod = leads
          .filter(l => l.criado_em >= startDate && l.criado_em <= endDate)
          .filter(filterByOrigem);
        const filteredAllLeads = leads.filter(filterByOrigem);

        const mqlCount = leadsCreatedInPeriod.filter(l => l.is_qualified).length;
        const scheduledCount = leadsCreatedInPeriod.filter(l => l.is_scheduled).length;
        const closedCount = leadsCreatedInPeriod.filter(l => l.is_closed).length;

        // --- Funil passo-a-passo ---
        const sortedFunnelStages = [...funnelStages].sort((a, b) => a.posicao_ordem - b.posicao_ordem);
        const funnelConversion = sortedFunnelStages.slice(0, -1).map((stage, i) => {
          const nextStage = sortedFunnelStages[i + 1];
          const fromCount = leadsCreatedInPeriod.filter(
            l => l.posicao_pipeline >= stage.posicao_ordem && l.posicao_pipeline < lostPos
          ).length;
          const toCount = leadsCreatedInPeriod.filter(
            l => l.posicao_pipeline >= nextStage.posicao_ordem && l.posicao_pipeline < lostPos
          ).length;
          return {
            from: stage.nome,
            to: nextStage.nome,
            fromCount,
            toCount,
            rate: fromCount > 0 ? parseFloat(((toCount / fromCount) * 100).toFixed(1)) : 0
          };
        });

        // --- Distribuição do pipeline para gráfico de barras ---
        const PIPE_COLORS = ['#6366f1', '#3b82f6', '#f59e0b', '#f97316', '#10b981', '#22c55e'];
        const pipelineDistribution = sortedFunnelStages.map((stage, i) => ({
          name: stage.nome,
          value: filteredAllLeads.filter(l => l.posicao_pipeline === stage.posicao_ordem).length,
          color: (stage.cor as string | null) || PIPE_COLORS[i % PIPE_COLORS.length]
        }));

        // --- Taxas de performance ---
        // Quando filtro é 'marketing', leadsCreatedInPeriod JÁ é só marketing
        const mktLeads = origemFilter === 'marketing'
          ? leadsCreatedInPeriod
          : origemFilter === 'organico'
            ? []
            : leadsCreatedInPeriod.filter(l => l.origem === 'marketing');
        const mktQualified = mktLeads.filter(l => l.is_qualified);
        const mktClosed = mktLeads.filter(l => l.is_closed);

        const taxaMQL = mktLeads.length > 0
          ? parseFloat(((mktQualified.length / mktLeads.length) * 100).toFixed(1))
          : 0;
        const taxaAgendamento = mqlCount > 0
          ? parseFloat(((scheduledCount / mqlCount) * 100).toFixed(1))
          : 0;
        const taxaFechamento = scheduledCount > 0
          ? parseFloat(((closedCount / scheduledCount) * 100).toFixed(1))
          : 0;
        const taxaConversaoGlobal = mktLeads.length > 0
          ? parseFloat(((mktClosed.length / mktLeads.length) * 100).toFixed(1))
          : 0;
        const ticketMedio = closedCount > 0 ? faturamentoTotal / closedCount : 0;
        const custoPerLead = mktLeads.length > 0 ? totalInvestment / mktLeads.length : 0;

        // --- Performance da IA ---
        const handoffStage = allStages.find(s =>
          s.nome.toLowerCase().includes('handoff') ||
          s.nome.toLowerCase().includes('humano')
        );
        const handoffPos = handoffStage?.posicao_ordem || 4;

        let leadsAtendidosIA = 0;
        let taxaHandoffIA = 0;
        let tempoMedioIA = 0;

        try {
          // Busca logs de sucesso da IA no período
          // A tabela usa 'atualizado_em' como timestamp (não tem created_at garantido)
          const { data: aiLogs } = await (supabase as any)
            .from('ai_execution_logs')
            .select('lead_id, duracao_ms, status')
            .eq('organization_id', orgId)
            .gte('atualizado_em', startDate)
            .lte('atualizado_em', endDate)
            .limit(1000);

          if (Array.isArray(aiLogs) && aiLogs.length > 0) {
            const logs = aiLogs as { lead_id: string | null; duracao_ms: number | null; status: string }[];

            // Leads únicos atendidos pela IA no período (qualquer status — conta o atendimento)
            const uniqueLeadIds = [...new Set(logs.map(l => l.lead_id).filter(Boolean))] as string[];
            leadsAtendidosIA = uniqueLeadIds.length;

            // Tempo médio de atendimento só dos logs de sucesso (duracao_ms → segundos)
            const successLogs = logs.filter(l => l.status === 'success');
            const durations = successLogs.map(l => Number(l.duracao_ms || 0)).filter(d => d > 0);
            if (durations.length > 0) {
              tempoMedioIA = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length / 1000);
            }

            // Taxa de handoff: dos leads atendidos, quantos chegaram ao estágio de handoff
            if (uniqueLeadIds.length > 0) {
              const handoffCount = leads.filter(l =>
                uniqueLeadIds.includes(l.id) &&
                l.posicao_pipeline >= handoffPos &&
                l.posicao_pipeline < lostPos
              ).length;
              taxaHandoffIA = parseFloat(((handoffCount / uniqueLeadIds.length) * 100).toFixed(1));
            }
          }
        } catch (_) { /* tabela opcional */ }

        // Aguardando contato humano: snapshot atual de todos os leads da org em handoff sem IA
        let aguardandoContatoHumano = 0;
        try {
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('posicao_pipeline', handoffPos)
            .eq('ia_ativa', false);
          aguardandoContatoHumano = count ?? 0;
        } catch (_) {
          // fallback para os leads já buscados
          aguardandoContatoHumano = filteredAllLeads.filter(
            l => l.posicao_pipeline === handoffPos && l.ia_ativa === false
          ).length;
        }

        // --- Top procedimentos ---
        const procedimentoMap: Record<string, number> = {};
        leadsCreatedInPeriod.forEach(l => {
          const proc = (l.procedimento_interesse as string | undefined)?.trim();
          if (proc) procedimentoMap[proc] = (procedimentoMap[proc] || 0) + 1;
        });
        const topProcedimentos = Object.entries(procedimentoMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({ name, count }));

        return {
          // Campos existentes (mantidos para compatibilidade)
          totalContatos: leadsCreatedInPeriod.length,
          marketingLeads: mktLeads.length,
          organicLeads: leadsCreatedInPeriod.filter(l => l.origem === 'organico').length,
          mqlCount,
          mqlRate: leadsCreatedInPeriod.length > 0 ? ((mqlCount / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          scheduledCount,
          scheduledRate: leadsCreatedInPeriod.length > 0 ? ((scheduledCount / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          closedCount,
          closedRate: leadsCreatedInPeriod.length > 0 ? ((closedCount / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          conversionRate: leadsCreatedInPeriod.length > 0 ? ((vendas.length / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          faturamentoTotal,
          cac: vendas.length > 0 ? totalInvestment / vendas.length : 0,
          leadsByStage: leads.map(l => ({ etapa_id: l.posicao_pipeline })),
          leadsOverTime: eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).map(d => {
            const dayStr = format(d, 'yyyy-MM-dd');
            return {
              day: format(d, 'dd/MM'),
              captados: filteredAllLeads.filter(l => l.criado_em.startsWith(dayStr)).length,
              convertidos: filteredAllLeads.filter(l =>
                isLeadInFunnel(l) &&
                l.posicao_pipeline >= convertedPos &&
                l.posicao_pipeline < lostPos &&
                l.atualizado_em?.startsWith(dayStr)
              ).length
            };
          }),
          // Novos campos
          funnelConversion,
          pipelineDistribution,
          taxaMQL,
          taxaAgendamento,
          taxaFechamento,
          taxaConversaoGlobal,
          // Taxas globais (todas com base no total de leads do período)
          taxaGlobalMQL: leadsCreatedInPeriod.length > 0 ? parseFloat(((mqlCount / leadsCreatedInPeriod.length) * 100).toFixed(1)) : 0,
          taxaGlobalAgendamento: leadsCreatedInPeriod.length > 0 ? parseFloat(((scheduledCount / leadsCreatedInPeriod.length) * 100).toFixed(1)) : 0,
          taxaGlobalFechamento: leadsCreatedInPeriod.length > 0 ? parseFloat(((closedCount / leadsCreatedInPeriod.length) * 100).toFixed(1)) : 0,
          taxaGlobalConversao: leadsCreatedInPeriod.length > 0 ? parseFloat(((closedCount / leadsCreatedInPeriod.length) * 100).toFixed(1)) : 0,
          ticketMedio,
          custoPerLead,
          leadsAtendidosIA,
          taxaHandoffIA,
          tempoMedioIA,
          aguardandoContatoHumano,
          topProcedimentos,
          // Funil Descompliquei (apenas leads de marketing CRIADOS no período)
          descompliqueiFunnel: (() => {
            const mkt = leadsCreatedInPeriod.filter(l => l.origem === 'marketing');
            const mktTotal = mkt.length;
            const mktMql = mkt.filter(l => l.is_qualified).length;
            const mktScheduled = mkt.filter(l => l.is_scheduled).length;
            const mktClosed2 = mkt.filter(l => l.is_closed).length;
            return {
              leads: mktTotal,
              mql: mktMql,
              scheduled: mktScheduled,
              closed: mktClosed2,
              txMql: mktTotal > 0 ? parseFloat(((mktMql / mktTotal) * 100).toFixed(1)) : 0,
              txAgendamento: mktMql > 0 ? parseFloat(((mktScheduled / mktMql) * 100).toFixed(1)) : 0,
              txConversao: mktScheduled > 0 ? parseFloat(((mktClosed2 / mktScheduled) * 100).toFixed(1)) : 0,
            };
          })(),
          // Eficiência de aquisição (investimento / etapas do funil marketing criados no período)
          acquisitionEfficiency: (() => {
            const mkt = leadsCreatedInPeriod.filter(l => l.origem === 'marketing');
            const mktMql = mkt.filter(l => l.is_qualified).length;
            const mktScheduled = mkt.filter(l => l.is_scheduled).length;
            const mktClosed2 = mkt.filter(l => l.is_closed).length;
            return {
              investment: totalInvestment,
              cpl: mkt.length > 0 ? totalInvestment / mkt.length : null,
              cpm: mktMql > 0 ? totalInvestment / mktMql : null,
              cpa: mktScheduled > 0 ? totalInvestment / mktScheduled : null,
              cpf: mktClosed2 > 0 ? totalInvestment / mktClosed2 : null,
            };
          })(),
          scoringDistribution: (['A', 'B', 'C', 'D'] as const).map(s => ({
            scoring: s,
            count: leadsCreatedInPeriod.filter(l => l.origem === 'marketing' && l.is_qualified && l.lead_scoring === s).length,
          })),
          // Evolução no tempo para Descompliquei (3 séries: leads mkt, mqls, fechamentos)
          descompliqueiOverTime: eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).map(d => {
            const dayStart = startOfDay(d).toISOString();
            const dayEnd = endOfDay(d).toISOString();
            const mktDay = leads.filter(l => l.origem === 'marketing' && l.criado_em >= dayStart && l.criado_em <= dayEnd);
            return {
              day: format(d, 'dd/MM'),
              leads: mktDay.length,
              mqls: mktDay.filter(l => l.is_qualified).length,
              agendamentos: mktDay.filter(l => l.is_scheduled).length,
              fechamentos: mktDay.filter(l => l.is_closed).length,
            };
          }),
        };
      } catch (err: any) {
        console.error("Erro no painel:", err);
        throw err;
      }
    },
    enabled: !!user && !!orgId && !!dateRange?.from,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  return { metrics, isLoading, error, refetch };
}
