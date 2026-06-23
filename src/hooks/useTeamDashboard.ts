import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { useTeamMembersForSelect, MemberSelectOption } from './useTeamMembersForSelect';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';

// Mesma classificação do useDashboard.ts
const HUMAN_REMETENTES = ['agente', 'humano'];

export interface MemberDashboardStats {
  member: MemberSelectOption;
  leadsAtendidos: number;
  leadsQualificados: number;
  leadsAgendados: number;
  leadsFechados: number;
  totalVendas: number;
  faturamento: number;
  taxaConversao: number;
  taxaQualificacao: number;
  taxaAgendamento: number;
  mensagensEnviadas: number;
  tempoMedioResposta: number | null;
  scoringDist: Record<string, number>;
}

export interface AtividadeRecente {
  id: string;
  tipo: string;
  descricao: string;
  criado_em: string;
  user_id: string | null;
  autor?: { nome: string; url_avatar?: string | null };
  lead?: { id: string; nome: string | null; telefone: string };
}

const TIPO_LABELS: Record<string, string> = {
  criacao: 'criou o lead',
  etapa: 'moveu de etapa',
  responsavel: 'atribuiu responsável',
};

const PAGE_SIZE = 1000;

async function fetchPaginated<T>(builder: () => any): Promise<T[]> {
  let all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder().range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export function useTeamDashboard(dateRange?: DateRange) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const { members, isLoading: loadingMembers } = useTeamMembersForSelect();

  const startDate = dateRange?.from
    ? startOfDay(dateRange.from).toISOString()
    : undefined;
  const endDate = dateRange?.to
    ? endOfDay(dateRange.to).toISOString()
    : undefined;
  const startDayStr = dateRange?.from ? format(startOfDay(dateRange.from), 'yyyy-MM-dd') : undefined;
  const endDayStr = dateRange?.to ? format(endOfDay(dateRange.to), 'yyyy-MM-dd') : undefined;

  const { data, isLoading: loadingData } = useQuery({
    queryKey: ['team-dashboard', orgId, startDate, endDate],
    queryFn: async () => {
      if (!orgId) return null;

      // ── 1. Buscar leads (mesmo padrão do useDashboard — or criado_em/atualizado_em) ──
      const allLeads = await fetchPaginated<{
        id: string; responsavel_id: string | null;
        is_qualified: boolean; is_scheduled: boolean; is_closed: boolean;
        lead_scoring: string | null; criado_em: string; fonte: string | null;
        excluir_metricas: boolean | null;
      }>(() => {
        let q = supabase
          .from('leads')
          .select('id, responsavel_id, is_qualified, is_scheduled, is_closed, lead_scoring, criado_em, fonte, excluir_metricas')
          .eq('organization_id', orgId);
        if (startDate && endDate) {
          q = q.or(`and(criado_em.gte.${startDate},criado_em.lte.${endDate}),and(atualizado_em.gte.${startDate},atualizado_em.lte.${endDate})`);
        }
        return q;
      });

      // Excluir leads de teste/spam (mesmo filtro do Dashboard)
      const leads = allLeads.filter(l => !l.excluir_metricas);

      // ── 2. Buscar MQL notas no período (mesmo padrão do Dashboard) ──
      const mqlNotasRes = startDate && endDate
        ? await supabase
            .from('lead_notas')
            .select('lead_id')
            .eq('organization_id', orgId)
            .eq('tipo', 'sistema')
            .filter('metadados->>evento', 'eq', 'mql')
            .gte('criado_em', startDate)
            .lte('criado_em', endDate)
        : { data: [] };
      const mqlNotas = (mqlNotasRes.data || []) as { lead_id: string }[];

      // ── 3. Buscar agendamentos realizados no período ──
      const agendamentosRes = startDate && endDate
        ? await supabase
            .from('agendamentos')
            .select('id, lead_id, status')
            .eq('organization_id', orgId)
            .eq('status', 'realizado')
            .gte('data_hora_inicio', startDate)
            .lte('data_hora_inicio', endDate)
        : { data: [] };
      const agendamentos = (agendamentosRes.data || []) as { id: string; lead_id: string; status: string }[];

      // ── 4. Buscar vendas no período ──
      const vendasRes = startDayStr && endDayStr
        ? await supabase
            .from('vendas')
            .select('lead_id, valor_fechado')
            .eq('organization_id', orgId)
            .gte('data_fechamento', startDayStr)
            .lte('data_fechamento', endDayStr)
        : { data: [] };
      const vendas = (vendasRes.data || []) as { lead_id: string; valor_fechado: number }[];

      // ── 5. Calcular leadsComAtividadeReal (idêntico ao Dashboard) ──
      const leadsComAtividadeReal = new Set<string>();

      // Criados no período
      for (const l of leads) {
        if (!startDate || !endDate) { leadsComAtividadeReal.add(l.id); continue; }
        const criado = new Date(l.criado_em).getTime();
        if (criado >= new Date(startDate).getTime() && criado <= new Date(endDate).getTime()) {
          leadsComAtividadeReal.add(l.id);
        }
      }
      // Qualificados como MQL no período
      for (const n of mqlNotas) leadsComAtividadeReal.add(n.lead_id);
      // Tiveram agendamento no período
      for (const a of agendamentos) { if (a.lead_id) leadsComAtividadeReal.add(a.lead_id); }
      // Tiveram venda no período
      for (const v of vendas) { if (v.lead_id) leadsComAtividadeReal.add(v.lead_id); }

      // Leads ativos no período (sem importados — mesmo filtro do Dashboard)
      const leadsAtivos = leads
        .filter(l => l.fonte !== 'importado')
        .filter(l => leadsComAtividadeReal.has(l.id));

      const leadsById = new Map(leadsAtivos.map(l => [l.id, l]));

      // Conjuntos por etapa (baseados em evento, não em estado atual)
      const mqlLeadIds = new Set(mqlNotas.map(n => n.lead_id));
      const agLeadIds = new Set(agendamentos.map(a => a.lead_id).filter(Boolean));
      const fechadoLeadIds = new Set(vendas.map(v => v.lead_id).filter(Boolean));

      // Vendas por lead
      const vendasByLead = new Map<string, number>();
      const faturamentoByLead = new Map<string, number>();
      for (const v of vendas) {
        vendasByLead.set(v.lead_id, (vendasByLead.get(v.lead_id) || 0) + 1);
        faturamentoByLead.set(v.lead_id, (faturamentoByLead.get(v.lead_id) || 0) + (v.valor_fechado || 0));
      }

      // ── 6. Buscar mensagens humanas com user_id no período ──
      const allMensagens = startDate && endDate
        ? await fetchPaginated<{
            user_id: string | null; criado_em: string; lead_id: string; remetente: string;
          }>(() =>
            supabase
              .from('mensagens')
              .select('user_id, criado_em, lead_id, remetente')
              .eq('organization_id', orgId)
              .in('remetente', [...HUMAN_REMETENTES, 'lead'])
              .gte('criado_em', startDate)
              .lte('criado_em', endDate)
          )
        : [];

      const humanMessages = allMensagens.filter(m => m.user_id && HUMAN_REMETENTES.includes(m.remetente));

      // ── 7. Métricas por membro ──
      // Atribuição: responsavel_id é a fonte de verdade
      // Mensagens: contadas por user_id (mesmo sem responsavel_id)

      // Mensagens enviadas por membro
      const msgCountByUser = new Map<string, number>();
      for (const msg of humanMessages) {
        if (!msg.user_id) continue;
        msgCountByUser.set(msg.user_id, (msgCountByUser.get(msg.user_id) || 0) + 1);
      }

      // Métricas de leads por membro (via responsavel_id)
      const statsByUser = new Map<string, {
        leadsAtendidos: number; leadsQualificados: number; leadsAgendados: number;
        leadsFechados: number; totalVendas: number; faturamento: number;
        scoringDist: Record<string, number>;
      }>();

      for (const lead of leadsAtivos) {
        if (!lead.responsavel_id) continue;
        const uid = lead.responsavel_id;
        if (!statsByUser.has(uid)) {
          statsByUser.set(uid, {
            leadsAtendidos: 0, leadsQualificados: 0, leadsAgendados: 0,
            leadsFechados: 0, totalVendas: 0, faturamento: 0, scoringDist: {},
          });
        }
        const s = statsByUser.get(uid)!;
        s.leadsAtendidos++;
        if (mqlLeadIds.has(lead.id)) s.leadsQualificados++;
        if (agLeadIds.has(lead.id)) s.leadsAgendados++;
        if (fechadoLeadIds.has(lead.id)) s.leadsFechados++;
        if (lead.lead_scoring) {
          s.scoringDist[lead.lead_scoring] = (s.scoringDist[lead.lead_scoring] || 0) + 1;
        }
        s.totalVendas += vendasByLead.get(lead.id) || 0;
        s.faturamento += faturamentoByLead.get(lead.id) || 0;
      }

      // ── 8. Tempo médio de resposta por membro ──
      const tempoRespostaMap = new Map<string, number[]>();
      const msgsByLead = new Map<string, typeof allMensagens>();
      for (const m of allMensagens) {
        if (!msgsByLead.has(m.lead_id)) msgsByLead.set(m.lead_id, []);
        msgsByLead.get(m.lead_id)!.push(m);
      }
      for (const [, msgs] of msgsByLead) {
        msgs.sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
        for (let i = 1; i < msgs.length; i++) {
          const prev = msgs[i - 1];
          const curr = msgs[i];
          if (prev.remetente === 'lead' && HUMAN_REMETENTES.includes(curr.remetente) && curr.user_id) {
            const diffMs = new Date(curr.criado_em).getTime() - new Date(prev.criado_em).getTime();
            if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
              if (!tempoRespostaMap.has(curr.user_id)) tempoRespostaMap.set(curr.user_id, []);
              tempoRespostaMap.get(curr.user_id)!.push(diffMs);
            }
          }
        }
      }

      // ── 9. Feed de atividades recentes ──
      const { data: feedData } = await supabase
        .from('lead_atividades' as any)
        .select('id, tipo, descricao, user_id, criado_em, lead_id')
        .eq('organization_id', orgId)
        .order('criado_em', { ascending: false })
        .limit(50);

      const feedRaw = (feedData || []) as {
        id: string; tipo: string; descricao: string; user_id: string | null;
        criado_em: string; lead_id: string;
      }[];

      const feedLeadIds = [...new Set(feedRaw.map(f => f.lead_id).filter(Boolean))];
      const feedUserIds = [...new Set(feedRaw.map(f => f.user_id).filter(Boolean))] as string[];

      const [feedLeadsRes, feedPerfisRes] = await Promise.all([
        feedLeadIds.length > 0
          ? supabase.from('leads').select('id, nome, telefone').in('id', feedLeadIds)
          : Promise.resolve({ data: [] }),
        feedUserIds.length > 0
          ? supabase.from('perfis').select('id, nome_completo, url_avatar').in('id', feedUserIds)
          : Promise.resolve({ data: [] }),
      ]);

      const feedLeadsMap = new Map(
        ((feedLeadsRes.data || []) as { id: string; nome: string | null; telefone: string }[])
          .map(l => [l.id, l])
      );
      const perfisMap = new Map(
        ((feedPerfisRes.data || []) as { id: string; nome_completo: string | null; url_avatar: string | null }[])
          .map(p => [p.id, p])
      );

      const recentActivity: AtividadeRecente[] = feedRaw.map(f => {
        const perfil = f.user_id ? perfisMap.get(f.user_id) : undefined;
        const lead = feedLeadsMap.get(f.lead_id);
        return {
          id: f.id,
          tipo: f.tipo,
          descricao: TIPO_LABELS[f.tipo] || f.descricao,
          criado_em: f.criado_em,
          user_id: f.user_id,
          autor: perfil ? { nome: perfil.nome_completo || 'Usuário', url_avatar: perfil.url_avatar } : undefined,
          lead: lead ? { id: lead.id, nome: lead.nome, telefone: lead.telefone } : undefined,
        };
      });

      // ── 10. Totais do overview (espelham os contadores do Dashboard) ──
      const totals = {
        totalLeads: leadsAtivos.length,
        totalQualificados: leadsAtivos.filter(l => mqlLeadIds.has(l.id)).length,
        totalAgendados: leadsAtivos.filter(l => agLeadIds.has(l.id)).length,
        totalFechados: leadsAtivos.filter(l => fechadoLeadIds.has(l.id)).length,
        totalVendas: vendas.length,
        totalFaturamento: vendas.reduce((s, v) => s + (v.valor_fechado || 0), 0),
        totalMensagens: humanMessages.length,
      };

      return { statsByUser, msgCountByUser, tempoRespostaMap, recentActivity, totals };
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const memberStats: MemberDashboardStats[] = members.map(member => {
    const raw = data?.statsByUser.get(member.id);
    const tempos = data?.tempoRespostaMap.get(member.id);
    const msgs = data?.msgCountByUser.get(member.id) || 0;
    const total = raw?.leadsAtendidos || 0;
    const qualificados = raw?.leadsQualificados || 0;
    const agendados = raw?.leadsAgendados || 0;
    const fechados = raw?.leadsFechados || 0;

    return {
      member,
      leadsAtendidos: total,
      leadsQualificados: qualificados,
      leadsAgendados: agendados,
      leadsFechados: fechados,
      totalVendas: raw?.totalVendas || 0,
      faturamento: raw?.faturamento || 0,
      taxaConversao: total > 0 ? Math.round((fechados / total) * 100) : 0,
      taxaQualificacao: total > 0 ? Math.round((qualificados / total) * 100) : 0,
      taxaAgendamento: qualificados > 0 ? Math.round((agendados / qualificados) * 100) : 0,
      mensagensEnviadas: msgs,
      tempoMedioResposta: tempos && tempos.length > 0
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length / 60000)
        : null,
      scoringDist: raw?.scoringDist || {},
    };
  });

  const ranking = [...memberStats]
    .filter(m => m.leadsAtendidos > 0 || m.mensagensEnviadas > 0)
    .sort((a, b) => {
      if (b.leadsFechados !== a.leadsFechados) return b.leadsFechados - a.leadsFechados;
      if (b.leadsAgendados !== a.leadsAgendados) return b.leadsAgendados - a.leadsAgendados;
      if (b.leadsQualificados !== a.leadsQualificados) return b.leadsQualificados - a.leadsQualificados;
      return b.leadsAtendidos - a.leadsAtendidos;
    });

  return {
    memberStats,
    ranking,
    recentActivity: data?.recentActivity || [],
    totals: data?.totals || {
      totalLeads: 0, totalQualificados: 0, totalAgendados: 0, totalFechados: 0,
      totalVendas: 0, totalFaturamento: 0, totalMensagens: 0,
    },
    isLoading: loadingMembers || loadingData,
  };
}
