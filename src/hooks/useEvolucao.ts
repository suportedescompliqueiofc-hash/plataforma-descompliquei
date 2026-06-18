import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { startOfDay, endOfDay, format } from 'date-fns';

export interface DatePeriod {
  from: Date;
  to: Date;
}

export interface PeriodMetrics {
  totalLeads: number;
  leadsMkt: number;
  leadsOrg: number;
  leadsReativ: number;
  leadsOutros: number;
  mqlCount: number;
  scheduledCount: number;
  closedCount: number;
  taxaMQL: number;
  taxaAgendamento: number;
  taxaFechamento: number;

  vendasCount: number;
  faturamento: number;
  ticketMedio: number;
  topProcedimentos: { name: string; count: number }[];

  agTotal: number;
  agRealizados: number;
  agNoShow: number;
  agCancelados: number;
  agTaxaComparecimento: number;
  agTaxaNoShow: number;

  tempoRespostaHumano: number;
  duracaoAtendimento: number;
  taxaSemResposta: number;
  conversasTotal: number;
  conversasHumano: number;
  conversasIA: number;

  leadsAtendidosIA: number;
  taxaHandoff: number;
  tempoMedioIA: number;

  mensagensTotal: number;
  msgLead: number;
  msgHumano: number;
  msgIA: number;

  scoringA: number;
  scoringB: number;
  scoringC: number;
  scoringD: number;
}

export function computeDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function fetchPeriodLeads(orgId: string, start: string, end: string) {
  const PAGE_SIZE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, criado_em, origem, fonte, is_qualified, is_scheduled, is_closed, lead_scoring, excluir_metricas')
      .eq('organization_id', orgId)
      .gte('criado_em', start)
      .lte('criado_em', end)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all.filter((l: any) => !l.excluir_metricas && l.fonte !== 'importado');
}

async function fetchPeriodMetrics(orgId: string, period: DatePeriod): Promise<PeriodMetrics> {
  const startDate = startOfDay(period.from).toISOString();
  const endDate = endOfDay(period.to).toISOString();
  const startDayStr = format(startOfDay(period.from), 'yyyy-MM-dd');
  const endDayStr = format(endOfDay(period.to), 'yyyy-MM-dd');

  const [leads, vendasRes, agendamentosRes, mensagensRes, aiLogsRes] = await Promise.all([
    fetchPeriodLeads(orgId, startDate, endDate),
    supabase.from('vendas').select('valor_fechado, produto_servico')
      .eq('organization_id', orgId)
      .gte('data_fechamento', startDayStr).lte('data_fechamento', endDayStr),
    supabase.from('agendamentos').select('id, status')
      .eq('organization_id', orgId)
      .gte('data_hora_inicio', startDate).lte('data_hora_inicio', endDate),
    supabase.from('mensagens').select('lead_id, remetente, criado_em')
      .eq('organization_id', orgId)
      .in('remetente', ['lead', 'bot', 'agente', 'humano'])
      .gte('criado_em', startDate).lte('criado_em', endDate)
      .order('criado_em', { ascending: true }).limit(10000),
    (supabase as any).from('ai_execution_logs').select('lead_id, duracao_ms, status')
      .eq('organization_id', orgId)
      .gte('atualizado_em', startDate).lte('atualizado_em', endDate).limit(2000),
  ]);

  const vendas = vendasRes.data || [];
  const agendamentos = agendamentosRes.data || [];
  const mensagens = (mensagensRes.data as any[]) || [];
  const aiLogs = Array.isArray(aiLogsRes?.data) ? (aiLogsRes.data as any[]) : [];

  const totalLeads = leads.length;
  const leadsMkt = leads.filter((l: any) => l.origem === 'marketing').length;
  const leadsOrg = leads.filter((l: any) => l.origem === 'organico' || l.origem === 'indicacao').length;
  const leadsReativ = leads.filter((l: any) => l.origem === 'reativacao').length;
  const leadsOutros = leads.filter((l: any) => !['marketing', 'organico', 'indicacao', 'reativacao', 'paciente'].includes(l.origem)).length;
  const mqlCount = leads.filter((l: any) => l.is_qualified).length;
  const scheduledCount = leads.filter((l: any) => l.is_scheduled).length;
  const closedCount = leads.filter((l: any) => l.is_closed).length;
  const taxaMQL = totalLeads > 0 ? (mqlCount / totalLeads) * 100 : 0;
  const taxaAgendamento = mqlCount > 0 ? (scheduledCount / mqlCount) * 100 : 0;
  const taxaFechamento = scheduledCount > 0 ? (closedCount / scheduledCount) * 100 : 0;

  const faturamento = vendas.reduce((s: number, v: any) => s + Number(v.valor_fechado || 0), 0);
  const vendasCount = vendas.length;
  const ticketMedio = vendasCount > 0 ? faturamento / vendasCount : 0;
  const procMap: Record<string, number> = {};
  vendas.forEach((v: any) => {
    const proc = (v.produto_servico as string | undefined)?.trim();
    if (proc) procMap[proc] = (procMap[proc] || 0) + 1;
  });
  const topProcedimentos = Object.entries(procMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const agTotal = agendamentos.length;
  const agRealizados = agendamentos.filter((a: any) => a.status === 'realizado').length;
  const agNoShow = agendamentos.filter((a: any) => a.status === 'no_show' || a.status === 'nao_compareceu').length;
  const agCancelados = agendamentos.filter((a: any) => a.status === 'cancelado').length;
  const agFin = agRealizados + agNoShow;
  const agTaxaComparecimento = agFin > 0 ? (agRealizados / agFin) * 100 : 0;
  const agTaxaNoShow = agFin > 0 ? (agNoShow / agFin) * 100 : 0;

  const isHuman = (m: any) => m.remetente === 'agente' || m.remetente === 'humano';
  const isBot = (m: any) => m.remetente === 'bot';
  const diffMin = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / 60000;
  const avgOf = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const msgByLead = new Map<string, any[]>();
  for (const msg of mensagens) {
    if (!msgByLead.has(msg.lead_id)) msgByLead.set(msg.lead_id, []);
    msgByLead.get(msg.lead_id)!.push(msg);
  }

  let conversasHumano = 0, conversasIA = 0;
  const primeiraRespostaVals: number[] = [];
  const duracaoVals: number[] = [];
  let semResposta = 0, totalConversasComLead = 0;

  for (const [, msgs] of msgByLead) {
    const humMsgs = msgs.filter(isHuman);
    const iaMsgs = msgs.filter(isBot);
    if (humMsgs.length > 0) conversasHumano++;
    if (iaMsgs.length > 0) conversasIA++;

    if (humMsgs.length > 0 && msgs[0]?.remetente === 'lead') {
      const firstHum = humMsgs.find((m: any) => m.criado_em > msgs[0].criado_em);
      if (firstHum) {
        const m = diffMin(firstHum.criado_em, msgs[0].criado_em);
        if (m >= 0 && m < 1440) primeiraRespostaVals.push(m);
      }
    }

    if (humMsgs.length > 0 && msgs.length >= 2) {
      const dur = diffMin(msgs[msgs.length - 1].criado_em, humMsgs[0].criado_em);
      if (dur > 0) duracaoVals.push(dur);
    }

    const leadMsgs = msgs.filter((m: any) => m.remetente === 'lead');
    if (leadMsgs.length > 0) {
      totalConversasComLead++;
      const last = leadMsgs[leadMsgs.length - 1].criado_em;
      const replied = msgs.some((m: any) => isHuman(m) && m.criado_em > last && diffMin(m.criado_em, last) <= 1440);
      if (!replied) semResposta++;
    }
  }

  const mensagensTotal = mensagens.length;
  const msgLead = mensagens.filter((m: any) => m.remetente === 'lead').length;
  const msgHumano = mensagens.filter(isHuman).length;
  const msgIA = mensagens.filter(isBot).length;

  const successLogs = aiLogs.filter((l: any) => l.status === 'success');
  const leadIdsIA = [...new Set(successLogs.map((l: any) => l.lead_id).filter(Boolean))] as string[];
  const leadsAtendidosIA = leadIdsIA.length;

  const taxaHandoff = 0;

  const durations = successLogs.map((l: any) => Number(l.duracao_ms || 0)).filter((d: number) => d > 0);
  const tempoMedioIA = durations.length > 0 ? Math.round(avgOf(durations) / 1000) : 0;

  const mqlLeads = leads.filter((l: any) => l.is_qualified);

  return {
    totalLeads, leadsMkt, leadsOrg, leadsReativ, leadsOutros,
    mqlCount, scheduledCount, closedCount,
    taxaMQL, taxaAgendamento, taxaFechamento,
    vendasCount, faturamento, ticketMedio, topProcedimentos,
    agTotal, agRealizados, agNoShow, agCancelados, agTaxaComparecimento, agTaxaNoShow,
    tempoRespostaHumano: avgOf(primeiraRespostaVals),
    duracaoAtendimento: avgOf(duracaoVals),
    taxaSemResposta: totalConversasComLead > 0 ? (semResposta / totalConversasComLead) * 100 : 0,
    conversasTotal: msgByLead.size,
    conversasHumano, conversasIA,
    leadsAtendidosIA, taxaHandoff, tempoMedioIA,
    mensagensTotal, msgLead, msgHumano, msgIA,
    scoringA: mqlLeads.filter((l: any) => l.lead_scoring === 'A').length,
    scoringB: mqlLeads.filter((l: any) => l.lead_scoring === 'B').length,
    scoringC: mqlLeads.filter((l: any) => l.lead_scoring === 'C').length,
    scoringD: mqlLeads.filter((l: any) => l.lead_scoring === 'D').length,
  };
}

export function useEvolucao(periodA: DatePeriod | null, periodB: DatePeriod | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: [
      'evolucao', orgId,
      periodA?.from?.toISOString(), periodA?.to?.toISOString(),
      periodB?.from?.toISOString(), periodB?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!orgId || !periodA || !periodB) return null;
      const [atual, anterior] = await Promise.all([
        fetchPeriodMetrics(orgId, periodA),
        fetchPeriodMetrics(orgId, periodB),
      ]);
      return { atual, anterior };
    },
    enabled: !!orgId && !!periodA && !!periodB,
    staleTime: 5 * 60 * 1000,
  });
}
