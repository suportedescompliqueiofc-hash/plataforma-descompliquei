import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

export interface OutboundScript {
  id: string;
  organization_id: string;
  usuario_id: string | null;
  nome: string;
  objetivo: string;
  status: string;
  conteudo: string;
  versao: number;
  criado_em: string;
  atualizado_em: string;
  prospectos_count?: number;
}

export interface ScriptProspecto {
  id: string;
  script_id: string;
  prospecto_id: string;
  associado_em: string;
  prospecto_nome?: string;
  prospecto_clinica?: string;
  prospecto_stage_nome?: string;
  prospecto_stage_cor?: string;
  prospecto_scoring?: string;
}

export interface ScriptMetricas {
  total_ligacoes: number;
  total_atendeu: number;
  total_qualificados: number;
  total_agendamentos: number;
  total_recusas: number;
  tx_atendimento: number;
  tx_qualificacao: number;
  tx_agendamento: number;
  distribuicao: Record<string, number>;
}

export function useOutboundScripts() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ['outbound_scripts', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_scripts')
        .select('*, outbound_script_prospectos(count)')
        .eq('organization_id', orgId)
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        prospectos_count: s.outbound_script_prospectos?.[0]?.count || 0,
      })) as OutboundScript[];
    },
    enabled: !!orgId,
  });

  const activeScripts = scripts.filter(s => s.status === 'aprovado' || s.status === 'em_teste');

  const createScript = useMutation({
    mutationFn: async (script: Partial<OutboundScript>) => {
      const { data, error } = await (supabase as any)
        .from('outbound_scripts')
        .insert({ ...script, organization_id: orgId, usuario_id: user?.id, versao: 1 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_scripts', orgId] });
      toast.success('Script criado com sucesso');
    },
    onError: (err: any) => toast.error('Erro ao criar script: ' + err.message),
  });

  const updateScript = useMutation({
    mutationFn: async ({ id, incrementVersion, ...updates }: Partial<OutboundScript> & { id: string; incrementVersion?: boolean }) => {
      if (incrementVersion) {
        const current = scripts.find(s => s.id === id);
        if (current) updates.versao = current.versao + 1;
      }
      const { data, error } = await (supabase as any)
        .from('outbound_scripts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_scripts', orgId] });
      toast.success('Script atualizado');
    },
    onError: (err: any) => toast.error('Erro ao atualizar: ' + err.message),
  });

  const deleteScript = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('outbound_scripts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_scripts', orgId] });
      toast.success('Script removido');
    },
    onError: (err: any) => toast.error('Erro ao remover: ' + err.message),
  });

  return { scripts, activeScripts, isLoading, createScript, updateScript, deleteScript };
}

export function useScriptProspectos(scriptId: string | null) {
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: associacoes = [], isLoading } = useQuery({
    queryKey: ['outbound_script_prospectos', scriptId],
    queryFn: async () => {
      if (!scriptId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_script_prospectos')
        .select(`
          *,
          outbound_prospectos:prospecto_id (
            nome, clinica, lead_scoring,
            outbound_stages:stage_id ( nome, cor )
          )
        `)
        .eq('script_id', scriptId)
        .order('associado_em', { ascending: false });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        prospecto_nome: a.outbound_prospectos?.nome || null,
        prospecto_clinica: a.outbound_prospectos?.clinica || null,
        prospecto_scoring: a.outbound_prospectos?.lead_scoring || null,
        prospecto_stage_nome: a.outbound_prospectos?.outbound_stages?.nome || null,
        prospecto_stage_cor: a.outbound_prospectos?.outbound_stages?.cor || null,
      })) as ScriptProspecto[];
    },
    enabled: !!scriptId && !!orgId,
  });

  const associar = useMutation({
    mutationFn: async (prospectoId: string) => {
      const { error } = await (supabase as any)
        .from('outbound_script_prospectos')
        .insert({ organization_id: orgId, script_id: scriptId, prospecto_id: prospectoId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_script_prospectos', scriptId] });
      queryClient.invalidateQueries({ queryKey: ['outbound_scripts', orgId] });
      toast.success('Prospecto associado');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const desassociar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('outbound_script_prospectos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_script_prospectos', scriptId] });
      queryClient.invalidateQueries({ queryKey: ['outbound_scripts', orgId] });
      toast.success('Associação removida');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  return { associacoes, isLoading, associar, desassociar };
}

export function useScriptMetricas(scriptId: string | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['outbound_script_metricas', scriptId],
    queryFn: async (): Promise<ScriptMetricas> => {
      if (!scriptId || !orgId) return { total_ligacoes: 0, total_atendeu: 0, total_qualificados: 0, total_agendamentos: 0, total_recusas: 0, tx_atendimento: 0, tx_qualificacao: 0, tx_agendamento: 0, distribuicao: {} };

      const { data, error } = await (supabase as any)
        .from('outbound_ligacoes')
        .select('status, resultado')
        .eq('script_id', scriptId)
        .eq('organization_id', orgId);
      if (error) throw error;

      const rows = data || [];
      const total = rows.length;
      const atendeu = rows.filter((r: any) => r.status === 'atendeu').length;
      const qualificados = rows.filter((r: any) => r.resultado === 'qualificado').length;
      const agendamentos = rows.filter((r: any) => r.resultado === 'agendou_call').length;
      const recusas = rows.filter((r: any) => r.status === 'recusou').length;

      const distribuicao: Record<string, number> = {};
      rows.filter((r: any) => r.resultado).forEach((r: any) => {
        distribuicao[r.resultado] = (distribuicao[r.resultado] || 0) + 1;
      });

      return {
        total_ligacoes: total,
        total_atendeu: atendeu,
        total_qualificados: qualificados,
        total_agendamentos: agendamentos,
        total_recusas: recusas,
        tx_atendimento: total > 0 ? Math.round((atendeu / total) * 1000) / 10 : 0,
        tx_qualificacao: atendeu > 0 ? Math.round((qualificados / atendeu) * 1000) / 10 : 0,
        tx_agendamento: atendeu > 0 ? Math.round((agendamentos / atendeu) * 1000) / 10 : 0,
        distribuicao,
      };
    },
    enabled: !!scriptId && !!orgId,
  });
}

export function useScriptLigacoes(scriptId: string | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['outbound_script_ligacoes', scriptId],
    queryFn: async () => {
      if (!scriptId || !orgId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_ligacoes')
        .select(`
          id, data_hora, status, resultado, anotacao,
          perfis:usuario_id ( nome_completo ),
          outbound_prospectos:prospecto_id ( nome, clinica )
        `)
        .eq('script_id', scriptId)
        .eq('organization_id', orgId)
        .order('data_hora', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        perfil_nome: l.perfis?.nome_completo || null,
        prospecto_nome: l.outbound_prospectos?.nome || null,
        prospecto_clinica: l.outbound_prospectos?.clinica || null,
      }));
    },
    enabled: !!scriptId && !!orgId,
  });
}
