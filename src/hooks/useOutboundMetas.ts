import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWeekend, isToday as isTodayFn, isFuture as isFutureFn } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface OutboundMeta {
  id: string;
  organization_id: string;
  usuario_id: string | null;
  nome: string;
  periodo_tipo: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  meta_leads_contatados: number | null;
  meta_ligacoes: number | null;
  meta_conexoes: number | null;
  meta_qualificados: number | null;
  meta_calls_agendadas: number | null;
  meta_show_rate: number | null;
  meta_fechamentos: number | null;
  meta_receita: number | null;
  perfil_nome?: string | null;
}

export interface MetaRealizado {
  leads_contatados: number;
  ligacoes: number;
  conexoes: number;
  qualificados: number;
  calls_agendadas: number;
  fechamentos: number;
  receita: number;
}

export function useOutboundMetas() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ['outbound_metas', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_metas')
        .select('*, perfis:usuario_id(nome_completo)')
        .eq('organization_id', orgId)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        perfil_nome: m.perfis?.nome_completo || null,
      })) as OutboundMeta[];
    },
    enabled: !!orgId,
  });

  const createMeta = useMutation({
    mutationFn: async (meta: Partial<OutboundMeta>) => {
      const { data, error } = await (supabase as any)
        .from('outbound_metas')
        .insert({ ...meta, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_metas', orgId] });
      toast.success('Meta criada com sucesso');
    },
    onError: (err: any) => toast.error('Erro ao criar meta: ' + err.message),
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OutboundMeta> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('outbound_metas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_metas', orgId] });
      toast.success('Meta atualizada');
    },
    onError: (err: any) => toast.error('Erro ao atualizar: ' + err.message),
  });

  const deleteMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('outbound_metas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_metas', orgId] });
      toast.success('Meta removida');
    },
    onError: (err: any) => toast.error('Erro ao remover: ' + err.message),
  });

  return { metas, isLoading, createMeta, updateMeta, deleteMeta };
}

export interface MetaDailyData {
  data: string;
  diaNum: number;
  diaSemana: string;
  isWeekend: boolean;
  isToday: boolean;
  isFuture: boolean;
  ligacoes: number;
  conexoes: number;
  qualificados: number;
  calls_agendadas: number;
}

export interface MetaMesHistorico {
  mes: string;
  mesLabel: string;
  ligacoes: number;
  conexoes: number;
  qualificados: number;
  calls_agendadas: number;
  metaLigacoes: number | null;
}

export function useMetaRealizadoDiario(inicio?: string, fim?: string, usuarioId?: string | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['outbound_meta_diario', orgId, inicio, fim, usuarioId],
    queryFn: async (): Promise<MetaDailyData[]> => {
      if (!orgId || !inicio || !fim) return [];

      let ligQuery = (supabase as any)
        .from('outbound_ligacoes')
        .select('data_hora, status, resultado')
        .eq('organization_id', orgId)
        .gte('data_hora', `${inicio}T00:00:00`)
        .lte('data_hora', `${fim}T23:59:59`);
      if (usuarioId) ligQuery = ligQuery.eq('usuario_id', usuarioId);

      const { data: ligs, error } = await ligQuery;
      if (error) throw error;

      const dailyMap = new Map<string, MetaDailyData>();
      const startDate = parseISO(inicio);
      const endDate = parseISO(fim);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = format(d, 'yyyy-MM-dd');
        dailyMap.set(key, {
          data: key,
          diaNum: d.getDate(),
          diaSemana: format(d, 'EEE', { locale: ptBR }),
          isWeekend: isWeekend(d),
          isToday: isTodayFn(d),
          isFuture: isFutureFn(d),
          ligacoes: 0,
          conexoes: 0,
          qualificados: 0,
          calls_agendadas: 0,
        });
      }

      (ligs || []).forEach((l: any) => {
        const day = l.data_hora.slice(0, 10);
        const entry = dailyMap.get(day);
        if (entry) {
          entry.ligacoes++;
          if (l.status === 'atendeu') entry.conexoes++;
          if (l.resultado === 'qualificado') entry.qualificados++;
          if (l.resultado === 'agendou_call') entry.calls_agendadas++;
        }
      });

      return Array.from(dailyMap.values()).sort((a, b) => a.data.localeCompare(b.data));
    },
    enabled: !!orgId && !!inicio && !!fim,
    staleTime: 60_000,
  });
}

export function useMetaHistoricoMensal(meses: number = 6) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const now = new Date();
  const inicioHistorico = format(startOfMonth(subMonths(now, meses - 1)), 'yyyy-MM-dd');
  const fimHistorico = format(endOfMonth(now), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['outbound_meta_historico', orgId, inicioHistorico, meses],
    queryFn: async (): Promise<MetaMesHistorico[]> => {
      if (!orgId) return [];

      const [ligRes, metasRes] = await Promise.all([
        (supabase as any)
          .from('outbound_ligacoes')
          .select('data_hora, status, resultado')
          .eq('organization_id', orgId)
          .gte('data_hora', `${inicioHistorico}T00:00:00`)
          .lte('data_hora', `${fimHistorico}T23:59:59`),
        (supabase as any)
          .from('outbound_metas')
          .select('data_inicio, data_fim, meta_ligacoes, usuario_id, ativo')
          .eq('organization_id', orgId)
          .eq('ativo', true)
          .is('usuario_id', null),
      ]);

      if (ligRes.error) throw ligRes.error;

      const monthMap = new Map<string, MetaMesHistorico>();

      for (let i = 0; i < meses; i++) {
        const m = subMonths(now, meses - 1 - i);
        const key = format(m, 'yyyy-MM');
        monthMap.set(key, {
          mes: key,
          mesLabel: format(m, 'MMM/yy', { locale: ptBR }),
          ligacoes: 0,
          conexoes: 0,
          qualificados: 0,
          calls_agendadas: 0,
          metaLigacoes: null,
        });
      }

      (ligRes.data || []).forEach((l: any) => {
        const monthKey = l.data_hora.slice(0, 7);
        const entry = monthMap.get(monthKey);
        if (entry) {
          entry.ligacoes++;
          if (l.status === 'atendeu') entry.conexoes++;
          if (l.resultado === 'qualificado') entry.qualificados++;
          if (l.resultado === 'agendou_call') entry.calls_agendadas++;
        }
      });

      (metasRes.data || []).forEach((m: any) => {
        const mStart = m.data_inicio.slice(0, 7);
        const entry = monthMap.get(mStart);
        if (entry && m.meta_ligacoes) {
          entry.metaLigacoes = m.meta_ligacoes;
        }
      });

      return Array.from(monthMap.values());
    },
    enabled: !!orgId,
    staleTime: 120_000,
  });
}

export function useMetaRealizado(meta: OutboundMeta | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['outbound_meta_realizado', meta?.id, meta?.data_inicio, meta?.data_fim, meta?.usuario_id],
    queryFn: async (): Promise<MetaRealizado> => {
      if (!meta || !orgId) return { leads_contatados: 0, ligacoes: 0, conexoes: 0, qualificados: 0, calls_agendadas: 0, fechamentos: 0, receita: 0 };

      let ligQuery = (supabase as any)
        .from('outbound_ligacoes')
        .select('status, resultado, prospecto_id')
        .eq('organization_id', orgId)
        .gte('data_hora', meta.data_inicio)
        .lte('data_hora', meta.data_fim);
      if (meta.usuario_id) ligQuery = ligQuery.eq('usuario_id', meta.usuario_id);

      let prospQuery = (supabase as any)
        .from('outbound_prospectos')
        .select('id, stage_id, outbound_stages:stage_id(tipo)')
        .eq('organization_id', orgId)
        .gte('criado_em', meta.data_inicio)
        .lte('criado_em', meta.data_fim);
      if (meta.usuario_id) prospQuery = prospQuery.eq('usuario_id', meta.usuario_id);

      const [ligRes, prospRes] = await Promise.all([ligQuery, prospQuery]);
      if (ligRes.error) throw ligRes.error;
      if (prospRes.error) throw prospRes.error;

      const ligs: any[] = ligRes.data || [];
      const prosps: any[] = prospRes.data || [];

      const uniqueProspectos = new Set(ligs.map((l: any) => l.prospecto_id));
      return {
        leads_contatados: uniqueProspectos.size,
        ligacoes: ligs.length,
        conexoes: ligs.filter(l => l.status === 'atendeu').length,
        qualificados: ligs.filter(l => l.resultado === 'qualificado').length,
        calls_agendadas: ligs.filter(l => l.resultado === 'agendou_call').length,
        fechamentos: prosps.filter(p => p.outbound_stages?.tipo === 'ganho').length,
        receita: 0,
      };
    },
    enabled: !!meta && !!orgId,
    staleTime: 60_000,
  });
}
