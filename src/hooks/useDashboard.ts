import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, eachDayOfInterval, endOfDay } from 'date-fns';
import { useEffect } from 'react';

export type OrigemFilter = 'geral' | 'marketing' | 'organico' | 'reativacao' | 'paciente' | 'convenio';

async function fetchAllLeads(orgId: string, startDate: string, endDate: string) {
  const PAGE_SIZE = 1000;
  let allLeads: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('organization_id', orgId)
      .or(`and(criado_em.gte.${startDate},criado_em.lte.${endDate}),and(atualizado_em.gte.${startDate},atualizado_em.lte.${endDate})`)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allLeads = allLeads.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allLeads;
}

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
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!user || !orgId || !dateRange?.from || !dateRange?.to) return null;

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();
      const startDayStr = format(startOfDay(dateRange.from), 'yyyy-MM-dd');
      const endDayStr = format(endOfDay(dateRange.to), 'yyyy-MM-dd');

      try {
        const [ leadsData, stagesRes, vendasRes, expensesRes, criativosRes, metaInsightsRes, agendamentosRes, mensagensRes, mqlNotasRes, stageHistoryRes ] = await Promise.all([
          fetchAllLeads(orgId, startDate, endDate),
          supabase.from('etapas').select('*').order('posicao_ordem'),
          supabase.from('vendas').select('*, lead_id, lead:leads(origem)').eq('organization_id', orgId).gte('data_fechamento', startDayStr).lte('data_fechamento', endDayStr),
          supabase.from('marketing_expenses').select('amount').eq('organization_id', orgId).gte('expense_date', startDayStr).lte('expense_date', endDayStr),
          supabase.from('criativos').select('platform_metrics').eq('organization_id', orgId),
          supabase.from('meta_insights' as any).select('gasto').eq('organization_id', orgId).eq('nivel', 'campaign').gte('data_ref', startDayStr).lte('data_ref', endDayStr),
          supabase.from('agendamentos').select('id, status, valor_orcado, lead_id, data_hora_inicio, lead:leads(id, nome, telefone, posicao_pipeline, atualizado_em, criado_em, origem)').eq('organization_id', orgId).gte('data_hora_inicio', startDate).lte('data_hora_inicio', endDate),
          supabase.from('mensagens').select('lead_id, remetente, criado_em').eq('organization_id', orgId).in('remetente', ['lead', 'bot', 'agente', 'humano']).gte('criado_em', startDate).lte('criado_em', endDate).order('criado_em', { ascending: true }).limit(8000),
          supabase.from('lead_notas').select('lead_id').eq('organization_id', orgId).eq('tipo', 'sistema').filter('metadados->>evento', 'eq', 'mql').gte('criado_em', startDate).lte('criado_em', endDate),
          supabase.from('lead_stage_history').select('lead_id, stage_position').eq('organization_id', orgId).not('from_stage_position', 'is', null).gte('entered_at', startDate).lte('entered_at', endDate),
        ]);

        // Exclui leads marcados como "fora das métricas" (testes, spam, etc.)
        const leads = leadsData.filter((l: any) => !l.excluir_metricas);
        const allStages = stagesRes.data || [];
        const vendas = vendasRes.data || [];
        const expenses = expensesRes.data || [];
        const criativos = criativosRes.data || [];
        const metaInsights = (metaInsightsRes.data as any[]) || [];
        const agendamentosData = agendamentosRes.data || [];
        const mensagens = (mensagensRes.data as any[]) || [];
        const mqlNotas = (mqlNotasRes.data as any[]) || [];
        const stageHistory = (stageHistoryRes.data as any[]) || [];

        // --- Filtro de origem (definido aqui para ser usado em TODAS as métricas) ---
        // Nota: 'indicacao' foi unificado com 'organico' — leads de indicação são tratados como orgânicos
        const filterByOrigem = (l: any) => {
          if (origemFilter === 'marketing')  return l.origem === 'marketing';
          if (origemFilter === 'organico')   return l.origem === 'organico' || l.origem === 'indicacao';
          if (origemFilter === 'reativacao') return l.origem === 'reativacao';
          if (origemFilter === 'paciente')   return l.origem === 'paciente';
          if (origemFilter === 'convenio')   return l.origem === 'convenio';
          return l.origem !== 'paciente'; // 'geral' exclui pacientes
        };

        // --- Leads com atividade CRM real no período ---
        // Um lead "conta" no período se foi criado nele OU teve atividade significativa:
        // mudança de etapa, qualificação (MQL), agendamento ou fechamento.
        // Leads que apenas enviaram uma mensagem (atualizado_em via webhook) NÃO são contados.
        const leadsComAtividadeReal = new Set<string>();

        // 1. Criados no período
        for (const l of leads) {
          const criado = new Date(l.criado_em).getTime();
          if (criado >= new Date(startDate).getTime() && criado <= new Date(endDate).getTime()) {
            leadsComAtividadeReal.add(l.id);
          }
        }
        // 2. Mudaram de etapa no período (lead_stage_history)
        for (const sh of stageHistory) {
          leadsComAtividadeReal.add(sh.lead_id);
        }
        // 3. Foram qualificados como MQL no período (lead_notas sistema)
        for (const nota of mqlNotas) {
          leadsComAtividadeReal.add(nota.lead_id);
        }
        // 4. Tiveram agendamento criado no período
        for (const ag of agendamentosData) {
          if (ag.lead_id) leadsComAtividadeReal.add(ag.lead_id);
        }
        // 5. Foram fechados (venda) no período
        for (const v of vendas) {
          if (v.lead_id) leadsComAtividadeReal.add(v.lead_id);
        }

        const filteredAllLeads = leads
          .filter(filterByOrigem)
          .filter((l: any) => l.fonte !== 'importado')
          .filter((l: any) => leadsComAtividadeReal.has(l.id));
        const filteredLeadsIds = new Set(filteredAllLeads.map((l: any) => l.id as string));

        // --- Métricas de Tempo de Resposta (IA vs Humano) ---
        const diffMin = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / 60000;
        const medianOf = (arr: number[]) => {
          if (arr.length === 0) return 0;
          const s = [...arr].sort((a, b) => a - b);
          return s[Math.floor(s.length / 2)];
        };

        // Classificação real (confirmada pelo código das Edge Functions):
        // - 'agente' = envio manual pelo App/CRM (HUMANO)
        // - 'humano' = label legado (HUMANO)
        // - 'bot' = IA/automação (whatsapp-ai-agent, cadências, follow-up, msgs agendadas)
        // - 'lead' = mensagem do cliente

        const msgByLead = new Map<string, { remetente: string; criado_em: string }[]>();
        for (const msg of mensagens) {
          // Só processa mensagens de leads que pertencem à origem selecionada
          if (!filteredLeadsIds.has(msg.lead_id)) continue;
          if (!msgByLead.has(msg.lead_id)) msgByLead.set(msg.lead_id, []);
          msgByLead.get(msg.lead_id)!.push(msg);
        }

        const isHuman = (m: any) => m.remetente === 'agente' || m.remetente === 'humano';
        const isIA = (m: any) => m.remetente === 'bot';

        // Arrays de métricas humanas
        const primeiraRespostaValues: number[] = []; // 1ª msg lead → 1ª resposta humana (só se lead iniciou)
        const duracaoHumValues: number[] = [];       // duração total do atendimento
        let conversasComHumano = 0;
        let conversasComIA = 0;
        // Mapa hora (0-23) → { min, leadId } (para distribuição horária com drilldown)
        const primeiraRespostaPorHoraMap = new Map<number, { min: number; leadId: string }[]>();
        // Conversas sem resposta humana dentro de 24h
        const semRespostaLeadIds: string[] = [];
        let totalConversasComMsgLead = 0;

        for (const [leadId, msgs] of msgByLead) {
          const iaMsgs = msgs.filter(isIA);
          const humMsgs = msgs.filter(isHuman);

          if (iaMsgs.length > 0) conversasComIA++;
          if (humMsgs.length > 0) conversasComHumano++;

          // --- PRIMEIRA RESPOSTA HUMANA ---
          // Apenas conversas onde o LEAD enviou a primeira mensagem
          if (humMsgs.length > 0 && msgs.length > 0 && msgs[0].remetente === 'lead') {
            const firstLeadTime = msgs[0].criado_em;
            const firstHum = humMsgs.find((m: any) => m.criado_em > firstLeadTime);
            if (firstHum) {
              const m = diffMin(firstHum.criado_em, firstLeadTime);
              if (m >= 0 && m < 1440) {
                primeiraRespostaValues.push(m);
                // Registra a hora em que o lead enviou a primeira msg (horário local)
                const hora = new Date(firstLeadTime).getHours();
                if (!primeiraRespostaPorHoraMap.has(hora)) primeiraRespostaPorHoraMap.set(hora, []);
                primeiraRespostaPorHoraMap.get(hora)!.push({ min: m, leadId });
              }
            }
          }

          // --- DURAÇÃO DO ATENDIMENTO ---
          if (humMsgs.length > 0 && msgs.length >= 2) {
            const firstHumTime = humMsgs[0].criado_em;
            const lastMsgTime = msgs[msgs.length - 1].criado_em;
            const dur = diffMin(lastMsgTime, firstHumTime);
            if (dur > 0) duracaoHumValues.push(dur);
          }

          // --- CONVERSAS SEM RESPOSTA (24h) ---
          const leadMsgsOnly = msgs.filter((m: any) => m.remetente === 'lead');
          if (leadMsgsOnly.length > 0) {
            totalConversasComMsgLead++;
            const lastLeadTime = leadMsgsOnly[leadMsgsOnly.length - 1].criado_em;
            // Verifica se houve resposta humana dentro de 24h após última msg do lead
            const hasHumanWithin24h = msgs.some(
              (m: any) => isHuman(m) && m.criado_em > lastLeadTime && diffMin(m.criado_em, lastLeadTime) <= 1440
            );
            if (!hasHumanWithin24h) {
              semRespostaLeadIds.push(leadId);
            }
          }
        }

        // Consolidação — média para primeira resposta, mediana para duração
        const avgOf = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

        // Helper: de IDs → objetos de lead completos
        const leadsById = new Map(leads.map((l: any) => [l.id, l]));
        const idsToLeads = (ids: string[]) =>
          [...new Set(ids)].map(id => leadsById.get(id)).filter(Boolean);

        // Distribuição horária (0-23h) com leads para drilldown
        const primeiraRespostaPorHora = Array.from({ length: 24 }, (_, h) => {
          const entries = primeiraRespostaPorHoraMap.get(h) || [];
          const vals = entries.map(e => e.min);
          return {
            hora: h,
            label: `${h.toString().padStart(2, '0')}h`,
            avg: avgOf(vals),
            count: vals.length,
            leads: idsToLeads(entries.map(e => e.leadId)),
          };
        });

        // Períodos do dia agrupados com leads
        const periodos = [
          { id: 'madrugada', label: 'Madrugada', horas: [0,1,2,3,4,5], emoji: '🌙' },
          { id: 'manha',     label: 'Manhã',     horas: [6,7,8,9,10,11], emoji: '🌅' },
          { id: 'tarde',     label: 'Tarde',     horas: [12,13,14,15,16,17], emoji: '☀️' },
          { id: 'noite',     label: 'Noite',     horas: [18,19,20,21,22,23], emoji: '🌆' },
        ].map(p => {
          const entries = p.horas.flatMap(h => primeiraRespostaPorHoraMap.get(h) || []);
          const vals = entries.map(e => e.min);
          return { ...p, avg: avgOf(vals), count: vals.length, leads: idsToLeads(entries.map(e => e.leadId)) };
        });

        const semRespostaLeads = idsToLeads(semRespostaLeadIds);
        const taxaSemResposta = totalConversasComMsgLead > 0
          ? parseFloat(((semRespostaLeadIds.length / totalConversasComMsgLead) * 100).toFixed(1))
          : 0;

        const trHumano = {
          tempoResposta: avgOf(primeiraRespostaValues),
          duracaoAtendimento: avgOf(duracaoHumValues),
          totalConversas: conversasComHumano,
          totalTurnos: primeiraRespostaValues.length,
          primeiraRespostaPorHora,
          periodos,
          semResposta: semRespostaLeadIds.length,
          totalConversasComLead: totalConversasComMsgLead,
          taxaSemResposta,
          semRespostaLeads,
        };

        const trGeral = {
          totalConversas: msgByLead.size,
        };

        // --- Métricas de agendamentos (filtrados pela origem selecionada via lead_id) ---
        const agendamentosFiltered = agendamentosData.filter(
          (a: any) => !a.lead || filterByOrigem(a.lead)
        );
        const agTotalAgendamentos = agendamentosFiltered.length;
        const agRealizados = agendamentosFiltered.filter((a: any) => a.status === 'realizado').length;
        const agNoShow = agendamentosFiltered.filter((a: any) => a.status === 'no_show' || a.status === 'nao_compareceu').length;
        const agConfirmados = agendamentosFiltered.filter((a: any) => a.status === 'confirmado').length;
        const agCancelados = agendamentosFiltered.filter((a: any) => a.status === 'cancelado').length;
        const agRemarcados = agendamentosFiltered.filter((a: any) => a.status === 'remarcado').length;
        const agFinalizados = agRealizados + agNoShow;
        const agTaxaComparecimento = agFinalizados > 0 ? parseFloat(((agRealizados / agFinalizados) * 100).toFixed(1)) : 0;
        const agTaxaNoShow = agFinalizados > 0 ? parseFloat(((agNoShow / agFinalizados) * 100).toFixed(1)) : 0;
        const agValorOrcadoRealizados = agendamentosFiltered
          .filter((a: any) => a.status === 'realizado')
          .reduce((sum: number, a: any) => sum + Number(a.valor_orcado || 0), 0);

        // Listas de leads por status de agendamento (para drilldown no dashboard)
        const agLeadFromAg = (a: any) => a.lead ? { ...a.lead, atualizado_em: a.lead.atualizado_em || a.lead.criado_em } : null;
        const uniqueLeads = (arr: any[]) => {
          const seen = new Set();
          return arr.filter(l => l && !seen.has(l.id) && seen.add(l.id));
        };
        const agLeadsTotal = uniqueLeads(agendamentosFiltered.map(agLeadFromAg));
        const agLeadsRealizados = uniqueLeads(agendamentosFiltered.filter((a: any) => a.status === 'realizado').map(agLeadFromAg));
        const agLeadsNoShow = uniqueLeads(agendamentosFiltered.filter((a: any) => a.status === 'no_show' || a.status === 'nao_compareceu').map(agLeadFromAg));
        const agLeadsCancelados = uniqueLeads(agendamentosFiltered.filter((a: any) => a.status === 'cancelado').map(agLeadFromAg));

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

        // faturamentoTotal calculado abaixo após leadsCreatedInPeriod (para respeitar origem)

        const metaAdsSpend = metaInsights.reduce((a: number, c: any) => a + Number(c.gasto || 0), 0);
        const manualExpenses = expenses.reduce((a, c) => a + Number(c.amount || 0), 0);
        const criativosSpend = criativos.reduce((a, c) => {
          const m = c.platform_metrics as any;
          return (m?.included_in_dashboard) ? a + Number(m.spend || 0) : a;
        }, 0);
        const totalInvestment = metaAdsSpend > 0 ? metaAdsSpend : (manualExpenses + criativosSpend);

        const allLeadsInPeriod = leads
          .filter(l => l.criado_em >= startDate && l.criado_em <= endDate)
          .filter(l => l.fonte !== 'importado');

        const leadsCreatedInPeriod = allLeadsInPeriod.filter(filterByOrigem);
        const importedLeadsInPeriodList = leads
          .filter(l => l.criado_em >= startDate && l.criado_em <= endDate)
          .filter(l => l.fonte === 'importado');
        // filteredAllLeads já definido acima (junto com filterByOrigem e filteredLeadsIds)

        // Contagens por origem
        // 'indicacao' unificado com 'organico'; 'paciente' excluído do 'geral'
        // Origem usa apenas leads com atividade real no período (mesma base do totalLeads)
        const leadsAtivosPeriodo = leads
          .filter((l: any) => l.fonte !== 'importado')
          .filter((l: any) => leadsComAtividadeReal.has(l.id));
        const origemCounts = {
          marketing:  leadsAtivosPeriodo.filter((l: any) => l.origem === 'marketing'),
          organico:   leadsAtivosPeriodo.filter((l: any) => l.origem === 'organico' || l.origem === 'indicacao'),
          reativacao: leadsAtivosPeriodo.filter((l: any) => l.origem === 'reativacao'),
          paciente:   origemFilter !== 'geral' ? leadsAtivosPeriodo.filter((l: any) => l.origem === 'paciente') : [],
          convenio:   leadsAtivosPeriodo.filter((l: any) => l.origem === 'convenio'),
          outros:     leadsAtivosPeriodo.filter((l: any) => !['marketing','organico','indicacao','reativacao','paciente','convenio'].includes(l.origem)),
        };

        // --- Modelo por evento: conta quando o evento OCORREU, não quando o lead foi criado ---

        // MQL: busca notas de sistema com evento='mql' gravadas no período
        const mqlLeadIdsSet = new Set<string>(
          mqlNotas
            .map((n: any) => n.lead_id)
            .filter((id: string) => {
              if (!id) return false;
              const l = leadsById.get(id);
              return !l || filterByOrigem(l);
            })
        );
        const mqlCount = mqlLeadIdsSet.size;

        // Agendamentos: leads com agendamento no período (data_hora_inicio), filtro por origem via lead embutido
        const scheduledLeadIdsSet = new Set<string>(
          agendamentosData
            .filter((a: any) => !a.lead || filterByOrigem(a.lead))
            .map((a: any) => a.lead_id)
            .filter(Boolean)
        );
        const scheduledCount = scheduledLeadIdsSet.size;

        // Fechamentos: vendas com data_fechamento no período, filtro por origem via lead embutido ou leadsById
        const closedVendas = vendas.filter((v: any) => {
          const lead = (v as any).lead || leadsById.get((v as any).lead_id);
          return !lead || filterByOrigem(lead);
        });
        const closedLeadIdsSet = new Set<string>(
          closedVendas.map((v: any) => v.lead_id).filter(Boolean)
        );
        const closedCount = closedLeadIdsSet.size || vendas.length;

        // --- Tempo de conversão (cadastro → fechamento) ---
        const temposFechamento: { dias: number; lead: any; venda: any }[] = [];
        for (const v of closedVendas) {
          if (!v.lead_id || !v.data_fechamento) continue;
          const lead = leadsById.get(v.lead_id);
          if (!lead?.criado_em) continue;
          const dias = Math.round(
            (new Date(v.data_fechamento).getTime() - new Date(lead.criado_em).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (dias < 0) continue;
          temposFechamento.push({ dias, lead, venda: v });
        }
        const tfTotal = temposFechamento.length;
        const tfSorted = [...temposFechamento].sort((a, b) => a.dias - b.dias);
        const tfMedia  = tfTotal > 0 ? Math.round(temposFechamento.reduce((s, t) => s + t.dias, 0) / tfTotal) : 0;
        const tfMediana = tfTotal > 0 ? tfSorted[Math.floor(tfTotal / 2)].dias : 0;
        const tfMin = tfTotal > 0 ? tfSorted[0].dias : 0;
        const tfMax = tfTotal > 0 ? tfSorted[tfTotal - 1].dias : 0;

        const tfBuckets = [
          { label: 'No mesmo dia',  min: 0,  max: 0  },
          { label: 'Até 7 dias',    min: 1,  max: 7  },
          { label: '8 a 15 dias',   min: 8,  max: 15 },
          { label: '16 a 30 dias',  min: 16, max: 30 },
          { label: '31 a 60 dias',  min: 31, max: 60 },
          { label: '61 a 90 dias',  min: 61, max: 90 },
          { label: 'Mais de 90 dias', min: 91, max: Infinity },
        ];
        const tfDistribuicao = tfBuckets.map(b => {
          const matched = temposFechamento.filter(t => t.dias >= b.min && t.dias <= b.max);
          return {
            label: b.label,
            count: matched.length,
            leads: matched.map(t => t.lead),
            items: matched.map(t => ({ lead: t.lead, dias: t.dias })),
            pct: tfTotal > 0 ? Math.round((matched.length / tfTotal) * 100) : 0,
          };
        });

        const tfOrigens = ['marketing', 'organico', 'indicacao', 'reativacao', 'paciente', 'convenio'];
        const tfPorOrigem = tfOrigens.map(o => {
          const ts = temposFechamento.filter(t => t.lead?.origem === o);
          return {
            origem: o,
            count: ts.length,
            media: ts.length > 0 ? Math.round(ts.reduce((s, t) => s + t.dias, 0) / ts.length) : 0,
            leads: ts.map(t => t.lead),
          };
        }).filter(o => o.count > 0);

        const tempoFunil = {
          total: tfTotal,
          media: tfMedia,
          mediana: tfMediana,
          minimo: tfMin,
          maximo: tfMax,
          distribuicao: tfDistribuicao,
          porOrigem: tfPorOrigem,
        };

        // --- Funil passo-a-passo (modelo por evento via lead_stage_history) ---
        const sortedFunnelStages = [...funnelStages].sort((a, b) => a.posicao_ordem - b.posicao_ordem);

        // Mapa: posicao_ordem → Set de lead_ids que ENTRARAM nessa etapa no período
        const entriesPerStage = new Map<number, Set<string>>();

        // Etapas 2+: usa lead_stage_history (trigger AFTER UPDATE — captura transições reais)
        for (const entry of stageHistory) {
          const pos = entry.stage_position as number;
          if (!entriesPerStage.has(pos)) entriesPerStage.set(pos, new Set());
          entriesPerStage.get(pos)!.add(entry.lead_id as string);
        }

        // Etapa 1 (Novo Lead): o evento de entrada é a criação do lead (criado_em),
        // pois o trigger só dispara em UPDATE — leads novos não geram entrada no histórico.
        const firstFunnelStage = sortedFunnelStages[0];
        if (firstFunnelStage) {
          const firstStagePos = firstFunnelStage.posicao_ordem;
          if (!entriesPerStage.has(firstStagePos)) entriesPerStage.set(firstStagePos, new Set());
          for (const lead of leadsCreatedInPeriod.filter(filterByOrigem)) {
            entriesPerStage.get(firstStagePos)!.add(lead.id as string);
          }
        }

        // Total de leads com qualquer atividade no período — denominador comum do funil
        const totalLeadsAtivos = filteredAllLeads.length || 1;

        const funnelConversion = sortedFunnelStages.slice(0, -1).map((stage, i) => {
          const nextStage = sortedFunnelStages[i + 1];
          const fromCount = entriesPerStage.get(stage.posicao_ordem)?.size || 0;
          const toCount = entriesPerStage.get(nextStage.posicao_ordem)?.size || 0;
          return {
            from: stage.nome,
            to: nextStage.nome,
            fromCount,
            toCount,
            // Taxa relativa ao total ativo no período — nunca passa de 100%
            rate: parseFloat(((toCount / totalLeadsAtivos) * 100).toFixed(1)),
          };
        });

        // --- Distribuição do pipeline — snapshot do estado atual (onde cada lead está agora) ---
        const PIPE_COLORS = ['#6366f1', '#3b82f6', '#f59e0b', '#f97316', '#10b981', '#22c55e'];
        const pipelineDistribution = sortedFunnelStages.map((stage, i) => ({
          name: stage.nome,
          value: filteredAllLeads.filter((l: any) => l.posicao_pipeline === stage.posicao_ordem).length,
          color: (stage.cor as string | null) || PIPE_COLORS[i % PIPE_COLORS.length]
        }));

        // --- Funil Comercial — 4 etapas fixas de negócio (evento-based) ---
        const _totalFunil = filteredAllLeads.length || 1;
        const comercialFunnel = {
          leads:        { count: filteredAllLeads.length, label: 'Leads',         pct: 100 },
          mql:          { count: mqlCount,       label: 'MQLs',          pct: parseFloat(((mqlCount / _totalFunil) * 100).toFixed(1)),       rate: parseFloat(((mqlCount / _totalFunil) * 100).toFixed(1)) },
          agendamentos: { count: scheduledCount, label: 'Agendamentos',  pct: parseFloat(((scheduledCount / _totalFunil) * 100).toFixed(1)), rate: mqlCount > 0 ? parseFloat(((scheduledCount / mqlCount) * 100).toFixed(1)) : 0 },
          fechamentos:  { count: closedCount,    label: 'Fechamentos',   pct: parseFloat(((closedCount / _totalFunil) * 100).toFixed(1)),    rate: scheduledCount > 0 ? parseFloat(((closedCount / scheduledCount) * 100).toFixed(1)) : 0 },
        };

        // --- Taxas de performance ---
        // Quando filtro é 'marketing', leadsCreatedInPeriod JÁ é só marketing
        const mktLeads = origemFilter === 'marketing'
          ? leadsCreatedInPeriod
          : origemFilter === 'organico'
            ? []
            : leadsCreatedInPeriod.filter(l => l.origem === 'marketing');
        const mktQualified = mktLeads.filter(l => l.is_qualified);
        const mktClosed = mktLeads.filter(l => l.is_closed);

        const _totalAtivos = filteredAllLeads.length || 1;
        // MQL: % dos leads ativos que foram qualificados
        const taxaMQL = parseFloat(((mqlCount / _totalAtivos) * 100).toFixed(1));
        // Agendamento: % dos MQLs que agendaram (step-to-step)
        const taxaAgendamento = mqlCount > 0
          ? parseFloat(((scheduledCount / mqlCount) * 100).toFixed(1))
          : 0;
        // Fechamento: % dos agendados que fecharam (step-to-step)
        const taxaFechamento = scheduledCount > 0
          ? parseFloat(((closedCount / scheduledCount) * 100).toFixed(1))
          : 0;
        // Vendas filtradas por evento (data_fechamento no período) + origem — já computado acima em closedVendas
        const vendasFiltradas = closedVendas;
        const faturamentoTotal = vendasFiltradas.reduce((sum, v) => sum + Number(v.valor_fechado || 0), 0);
        const vendasCount = vendasFiltradas.length;

        // Taxa de conversão global: fechados / total de leads no período (respeita origem)
        const taxaConversaoGlobal = filteredAllLeads.length > 0
          ? parseFloat(((closedCount / filteredAllLeads.length) * 100).toFixed(1))
          : 0;
        const ticketMedio = closedCount > 0 ? faturamentoTotal / closedCount : 0;
        const custoPerLead = mktLeads.length > 0 ? totalInvestment / mktLeads.length : 0;

        // --- Métricas de leads CADASTRADOS no período ---
        const cadastradosIds = new Set(leadsCreatedInPeriod.map((l: any) => l.id));
        const vendasCadastrados = closedVendas.filter((v: any) => cadastradosIds.has(v.lead_id));
        const cadastradosFaturamento = vendasCadastrados.reduce((sum: number, v: any) => sum + Number(v.valor_fechado || 0), 0);
        const cadastradosClosedIds = new Set(vendasCadastrados.map((v: any) => v.lead_id).filter(Boolean));
        const cadastradosVendasCount = vendasCadastrados.length;
        const cadastradosTicketMedio = cadastradosClosedIds.size > 0 ? cadastradosFaturamento / cadastradosClosedIds.size : 0;
        const cadastradosTaxaConversao = leadsCreatedInPeriod.length > 0
          ? parseFloat(((cadastradosClosedIds.size / leadsCreatedInPeriod.length) * 100).toFixed(1))
          : 0;

        // --- Performance da IA ---
        const handoffStage = allStages.find(s =>
          s.nome.toLowerCase().includes('handoff') ||
          s.nome.toLowerCase().includes('humano')
        );
        const handoffPos = handoffStage?.posicao_ordem || 4;

        let leadsAtendidosIA = 0;
        let taxaHandoffIA = 0;
        let tempoMedioIA = 0;
        let leadsAtendidosIAList: any[] = [];

        try {
          // Busca logs da IA no período — usa atualizado_em como timestamp
          const { data: aiLogs } = await (supabase as any)
            .from('ai_execution_logs')
            .select('lead_id, duracao_ms, status')
            .eq('organization_id', orgId)
            .gte('atualizado_em', startDate)
            .lte('atualizado_em', endDate)
            .limit(1000);

          if (Array.isArray(aiLogs) && aiLogs.length > 0) {
            const logs = aiLogs as { lead_id: string | null; duracao_ms: number | null; status: string }[];

            // Leads únicos atendidos pela IA no período (apenas logs de sucesso — skipped não conta)
            const successfulLogs = logs.filter(l => l.status === 'success');
            const allUniqueLeadIds = [...new Set(successfulLogs.map(l => l.lead_id).filter(Boolean))] as string[];
            // Filtrar pela origem selecionada
            const uniqueLeadIds = allUniqueLeadIds.filter(id => filteredLeadsIds.has(id));
            leadsAtendidosIA = uniqueLeadIds.length;

            // Tempo médio de atendimento só dos logs de sucesso (duracao_ms → segundos)
            const successLogs = logs.filter(l => l.status === 'success');
            const durations = successLogs.map(l => Number(l.duracao_ms || 0)).filter(d => d > 0);
            if (durations.length > 0) {
              tempoMedioIA = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length / 1000);
            }

            // Busca dados completos dos leads atendidos pela IA (para drilldown e taxa de handoff)
            if (uniqueLeadIds.length > 0) {
              const { data: aiLeadsData } = await supabase
                .from('leads')
                .select('*')
                .in('id', uniqueLeadIds)
                .eq('organization_id', orgId);
              leadsAtendidosIAList = aiLeadsData || [];
              const handoffCount = leadsAtendidosIAList.filter((l: any) =>
                l.posicao_pipeline >= handoffPos &&
                l.posicao_pipeline < lostPos
              ).length;
              taxaHandoffIA = parseFloat(((handoffCount / uniqueLeadIds.length) * 100).toFixed(1));
            }
          }
        } catch (_) { /* tabela opcional */ }

        // Aguardando contato humano: leads ativos no período que estão em handoff sem IA
        // Usa os dados já buscados (period-aligned) para manter coerência com os demais cards de IA
        const aguardandoContatoHumanoList: any[] = filteredAllLeads.filter(
          (l: any) => l.posicao_pipeline === handoffPos && l.ia_ativa === false
        );
        const aguardandoContatoHumano = aguardandoContatoHumanoList.length;

        // --- Top procedimentos (baseado em vendas fechadas com procedimentos cadastrados) ---
        const procedimentoMap: Record<string, number> = {};
        const procedimentoLeadsMap: Record<string, any[]> = {};
        vendas.forEach((v: any) => {
          const proc = (v.produto_servico as string | undefined)?.trim();
          if (!proc) return;
          procedimentoMap[proc] = (procedimentoMap[proc] || 0) + 1;
          const lead = leadsById.get(v.lead_id);
          if (lead) {
            if (!procedimentoLeadsMap[proc]) procedimentoLeadsMap[proc] = [];
            // evitar duplicatas (mesmo lead em múltiplas vendas do mesmo procedimento)
            if (!procedimentoLeadsMap[proc].some((l: any) => l.id === lead.id)) {
              procedimentoLeadsMap[proc].push(lead);
            }
          }
        });
        const topProcedimentos = Object.entries(procedimentoMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({
            name,
            count,
            leads: procedimentoLeadsMap[name] ?? [],
          }));

        return {
          // Campos existentes (mantidos para compatibilidade)
          totalContatos: leadsCreatedInPeriod.length,
          totalLeadsAtivos: filteredAllLeads.length,
          importedLeads: importedLeadsInPeriodList.length,
          marketingLeads: mktLeads.length,
          organicLeads: leadsCreatedInPeriod.filter(l => l.origem === 'organico').length,
          // Contagens por origem (fixas, independente do filtro ativo)
          origemCounts: {
            marketing:  origemCounts.marketing.length,
            organico:   origemCounts.organico.length,
            reativacao: origemCounts.reativacao.length,
            paciente:   origemCounts.paciente.length,
            convenio:   origemCounts.convenio.length,
            outros:     origemCounts.outros.length,
            total:      origemFilter === 'geral'
              ? leadsAtivosPeriodo.filter((l: any) => l.origem !== 'paciente').length
              : leadsAtivosPeriodo.length,
          },
          origemLeads: {
            marketing:  origemCounts.marketing,
            organico:   origemCounts.organico,
            reativacao: origemCounts.reativacao,
            paciente:   origemCounts.paciente,
            convenio:   origemCounts.convenio,
            outros:     origemCounts.outros,
          },
          mqlCount,
          mqlRate: leadsCreatedInPeriod.length > 0 ? ((mqlCount / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          scheduledCount,
          scheduledRate: leadsCreatedInPeriod.length > 0 ? ((scheduledCount / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          closedCount,
          closedRate: leadsCreatedInPeriod.length > 0 ? ((closedCount / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          conversionRate: leadsCreatedInPeriod.length > 0 ? ((vendas.length / leadsCreatedInPeriod.length) * 100).toFixed(1) : "0",
          faturamentoTotal,
          vendasCount,
          cac: vendas.length > 0 ? totalInvestment / vendas.length : 0,
          leadsByStage: leads.map(l => ({ etapa_id: l.posicao_pipeline })),
          leadsOverTime: eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).map(d => {
            const dayStr = format(d, 'yyyy-MM-dd');
            const captadosList = filteredAllLeads.filter(l => l.criado_em.startsWith(dayStr));
            const convertidosList = filteredAllLeads.filter(l =>
              isLeadInFunnel(l) &&
              l.posicao_pipeline >= convertedPos &&
              l.posicao_pipeline < lostPos &&
              l.atualizado_em?.startsWith(dayStr)
            );
            return {
              day: format(d, 'dd/MM'),
              captados: captadosList.length,
              convertidos: convertidosList.length,
              captadosList,
              convertidosList,
            };
          }),
          // Novos campos
          funnelConversion,
          comercialFunnel,
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
          agendamentos: {
            total: agTotalAgendamentos,
            realizados: agRealizados,
            noShow: agNoShow,
            confirmados: agConfirmados,
            cancelados: agCancelados,
            remarcados: agRemarcados,
            taxaComparecimento: agTaxaComparecimento,
            taxaNoShow: agTaxaNoShow,
            valorOrcadoRealizados: agValorOrcadoRealizados,
            leadsTotal: agLeadsTotal,
            leadsRealizados: agLeadsRealizados,
            leadsNoShow: agLeadsNoShow,
            leadsCancelados: agLeadsCancelados,
          },
          leadsAtendidosIA,
          leadsAtendidosIAList,
          taxaHandoffIA,
          tempoMedioIA,
          aguardandoContatoHumano,
          aguardandoContatoHumanoList,
          tempoResposta: {
            humano: trHumano,
            geral: trGeral,
          },
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
          // Arrays de leads por segmento (para drilldown nos cards do dashboard)
          allStages,
          filteredAllLeadsList: filteredAllLeads,
          totalLeadsList: filteredAllLeads,
          tempoFunil,
          // Cadastrados no período
          cadastradosTotal: leadsCreatedInPeriod.length,
          cadastradosFaturamento,
          cadastradosVendasCount,
          cadastradosTicketMedio,
          cadastradosTaxaConversao,
          cadastradosList: leadsCreatedInPeriod,
          cadastradosClosedList: [...cadastradosClosedIds].map(id => leadsById.get(id)).filter(Boolean),
          marketingLeadsList: mktLeads,
          organicLeadsList: leadsCreatedInPeriod.filter(l => l.origem === 'organico'),
          importedLeadsList: importedLeadsInPeriodList,
          mqlLeadsList: [...mqlLeadIdsSet].map(id => leadsById.get(id)).filter(Boolean),
          scheduledLeadsList: [...scheduledLeadIdsSet].map(id => leadsById.get(id)).filter(Boolean),
          closedLeadsList: [...closedLeadIdsSet].map(id => leadsById.get(id)).filter(Boolean),
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
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  return { metrics, isLoading: isLoading && !!orgId, error, refetch };
}
