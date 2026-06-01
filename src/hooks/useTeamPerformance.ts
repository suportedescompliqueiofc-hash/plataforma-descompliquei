import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { useTeamMembersForSelect, MemberSelectOption } from './useTeamMembersForSelect';

export interface MemberStats {
  member: MemberSelectOption;
  totalLeads: number;
  leadsQualificados: number;
  leadsAgendados: number;
  leadsFechados: number;
  totalVendas: number;
  faturamento: number;
  taxaConversao: number; // fechados / total (%)
  atividadesCount: number;
  scoringDist: Record<string, number>; // A/B/C/D → count
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

export interface TeamPerformanceData {
  memberStats: MemberStats[];
  recentActivity: AtividadeRecente[];
  isLoading: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  criacao:     'criou o lead',
  etapa:       'moveu de etapa',
  responsavel: 'atribuiu responsável',
};

export function useTeamPerformance(): TeamPerformanceData {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const { members, isLoading: loadingMembers } = useTeamMembersForSelect();

  const { data, isLoading: loadingData } = useQuery({
    queryKey: ['team-performance', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const [leadsResult, vendasResult, atividadesResult, feedResult] = await Promise.all([
        // Leads com responsável
        supabase
          .from('leads')
          .select('responsavel_id, is_qualified, is_scheduled, is_closed, lead_scoring')
          .eq('organization_id', orgId)
          .not('responsavel_id', 'is', null),

        // Vendas via leads com responsável
        supabase
          .from('leads')
          .select('responsavel_id, vendas!lead_id(valor_fechado)')
          .eq('organization_id', orgId)
          .not('responsavel_id', 'is', null),

        // Contagem de atividades por user
        supabase
          .from('lead_atividades' as any)
          .select('user_id, tipo')
          .eq('organization_id', orgId),

        // Feed recente (últimas 40 entradas)
        supabase
          .from('lead_atividades' as any)
          .select('id, tipo, descricao, user_id, criado_em, lead_id')
          .eq('organization_id', orgId)
          .order('criado_em', { ascending: false })
          .limit(40),
      ]);

      const leads     = (leadsResult.data || []) as {
        responsavel_id: string; is_qualified: boolean; is_scheduled: boolean;
        is_closed: boolean; lead_scoring: string | null;
      }[];
      const leadsComVendas = (vendasResult.data || []) as {
        responsavel_id: string;
        vendas: { valor_fechado: number }[];
      }[];
      const atividades = (atividadesResult.data || []) as { user_id: string | null; tipo: string }[];
      const feedRaw    = (feedResult.data || []) as {
        id: string; tipo: string; descricao: string; user_id: string | null;
        criado_em: string; lead_id: string;
      }[];

      // ── Métricas por membro ──────────────────────────────────
      const statsMap = new Map<string, Omit<MemberStats, 'member' | 'taxaConversao'>>();

      const ensureEntry = (uid: string) => {
        if (!statsMap.has(uid)) {
          statsMap.set(uid, {
            totalLeads: 0, leadsQualificados: 0, leadsAgendados: 0,
            leadsFechados: 0, totalVendas: 0, faturamento: 0,
            atividadesCount: 0, scoringDist: {},
          });
        }
        return statsMap.get(uid)!;
      };

      for (const l of leads) {
        if (!l.responsavel_id) continue;
        const e = ensureEntry(l.responsavel_id);
        e.totalLeads++;
        if (l.is_qualified) e.leadsQualificados++;
        if (l.is_scheduled) e.leadsAgendados++;
        if (l.is_closed)    e.leadsFechados++;
        if (l.lead_scoring) e.scoringDist[l.lead_scoring] = (e.scoringDist[l.lead_scoring] || 0) + 1;
      }

      for (const lv of leadsComVendas) {
        if (!lv.responsavel_id || !lv.vendas?.length) continue;
        const e = ensureEntry(lv.responsavel_id);
        e.totalVendas   += lv.vendas.length;
        e.faturamento   += lv.vendas.reduce((s, v) => s + (v.valor_fechado || 0), 0);
      }

      for (const at of atividades) {
        if (!at.user_id) continue;
        const e = ensureEntry(at.user_id);
        e.atividadesCount++;
      }

      // ── Buscar leads do feed para nomes ────────────────────
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

      const leadsMap = new Map(
        ((feedLeadsRes.data || []) as { id: string; nome: string | null; telefone: string }[])
          .map(l => [l.id, l])
      );
      const perfisMap = new Map(
        ((feedPerfisRes.data || []) as { id: string; nome_completo: string | null; url_avatar: string | null }[])
          .map(p => [p.id, p])
      );

      const recentActivity: AtividadeRecente[] = feedRaw.map(f => {
        const perfil = f.user_id ? perfisMap.get(f.user_id) : undefined;
        const lead   = leadsMap.get(f.lead_id);
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

      return { statsMap, recentActivity };
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const memberStats: MemberStats[] = members.map(member => {
    const raw = data?.statsMap.get(member.id);
    const total = raw?.totalLeads || 0;
    return {
      member,
      totalLeads:        total,
      leadsQualificados: raw?.leadsQualificados || 0,
      leadsAgendados:    raw?.leadsAgendados    || 0,
      leadsFechados:     raw?.leadsFechados     || 0,
      totalVendas:       raw?.totalVendas       || 0,
      faturamento:       raw?.faturamento       || 0,
      taxaConversao:     total > 0 ? Math.round(((raw?.leadsFechados || 0) / total) * 100) : 0,
      atividadesCount:   raw?.atividadesCount   || 0,
      scoringDist:       raw?.scoringDist       || {},
    };
  });

  return {
    memberStats,
    recentActivity: data?.recentActivity || [],
    isLoading: loadingMembers || loadingData,
  };
}
