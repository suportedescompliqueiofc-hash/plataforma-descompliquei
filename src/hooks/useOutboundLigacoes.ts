import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { useEffect, useMemo } from 'react';

export interface OutboundLigacao {
  id: string;
  organization_id: string;
  prospecto_id: string;
  usuario_id: string | null;
  data_hora: string;
  duracao_segundos: number | null;
  numero_tentativa: number;
  status: string;
  resultado: string | null;
  script_id: string | null;
  anotacao: string | null;
  proxima_acao: string | null;
  proxima_acao_data: string | null;
  criado_em: string;
  perfil_nome?: string;
  prospecto_nome?: string;
  prospecto_clinica?: string;
  prospecto_telefone?: string;
  script_nome?: string;
}

export function useOutboundLigacoes(prospectoId: string | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: ligacoes = [], isLoading } = useQuery({
    queryKey: ['outbound_ligacoes', prospectoId],
    queryFn: async () => {
      if (!prospectoId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_ligacoes')
        .select(`
          *,
          perfis:usuario_id ( nome_completo )
        `)
        .eq('prospecto_id', prospectoId)
        .order('data_hora', { ascending: false });
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        perfil_nome: l.perfis?.nome_completo || null,
      })) as OutboundLigacao[];
    },
    enabled: !!prospectoId && !!orgId,
  });

  return { ligacoes, isLoading };
}

export function useAllOutboundLigacoes() {
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: ligacoes = [], isLoading } = useQuery({
    queryKey: ['outbound_ligacoes_all', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_ligacoes')
        .select(`
          *,
          perfis:usuario_id ( nome_completo ),
          outbound_prospectos:prospecto_id ( nome, clinica, telefone ),
          outbound_scripts:script_id ( nome )
        `)
        .eq('organization_id', orgId)
        .order('data_hora', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        perfil_nome: l.perfis?.nome_completo || null,
        prospecto_nome: l.outbound_prospectos?.nome || null,
        prospecto_clinica: l.outbound_prospectos?.clinica || null,
        prospecto_telefone: l.outbound_prospectos?.telefone || null,
        script_nome: l.outbound_scripts?.nome || null,
      })) as OutboundLigacao[];
    },
    enabled: !!orgId,
  });

  // Realtime: invalidar ao inserir nova ligação
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase.channel('outbound-ligacoes-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'outbound_ligacoes',
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['outbound_ligacoes_all', orgId] });
        queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  // Métricas do dia
  const metricasDoDia = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ligacoesHoje = ligacoes.filter(l => new Date(l.data_hora) >= hoje);
    const conexoesHoje = ligacoesHoje.filter(l => l.status === 'atendeu');
    const callsAgendadas = ligacoesHoje.filter(l => l.resultado === 'agendou_call');
    const taxaAtendimento = ligacoesHoje.length > 0
      ? Math.round((conexoesHoje.length / ligacoesHoje.length) * 100)
      : 0;
    return {
      totalLigacoes: ligacoesHoje.length,
      totalConexoes: conexoesHoje.length,
      totalCallsAgendadas: callsAgendadas.length,
      taxaAtendimento,
    };
  }, [ligacoes]);

  return { ligacoes, isLoading, metricasDoDia };
}

export function useCreateLigacao() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  return useMutation({
    mutationFn: async (ligacao: Partial<OutboundLigacao> & {
      alterar_stage?: boolean;
      novo_stage_id?: string;
      alterar_scoring?: boolean;
      novo_scoring?: string;
    }) => {
      const { data: existing } = await (supabase as any)
        .from('outbound_ligacoes')
        .select('numero_tentativa')
        .eq('prospecto_id', ligacao.prospecto_id)
        .order('numero_tentativa', { ascending: false })
        .limit(1);

      const nextTentativa = (existing?.[0]?.numero_tentativa || 0) + 1;

      const payload = {
        organization_id: orgId,
        prospecto_id: ligacao.prospecto_id,
        usuario_id: ligacao.usuario_id || user?.id,
        numero_tentativa: nextTentativa,
        data_hora: ligacao.data_hora || new Date().toISOString(),
        status: ligacao.status,
        resultado: ligacao.resultado || null,
        script_id: ligacao.script_id || null,
        duracao_segundos: ligacao.duracao_segundos || null,
        anotacao: ligacao.anotacao || null,
        proxima_acao: ligacao.proxima_acao || null,
        proxima_acao_data: ligacao.proxima_acao_data || null,
      };

      const { data, error } = await (supabase as any)
        .from('outbound_ligacoes')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Atualizar prospecto com próxima ação + stage/scoring + SDR responsável
      const sdrId = ligacao.usuario_id || user?.id;
      const prospectoUpdates: any = {
        proxima_acao: ligacao.proxima_acao || null,
        proxima_acao_data: ligacao.proxima_acao_data || null,
        usuario_id: sdrId,
        ultimo_contato: new Date().toISOString(),
        total_tentativas: nextTentativa,
      };
      if (ligacao.alterar_stage && ligacao.novo_stage_id) {
        prospectoUpdates.stage_id = ligacao.novo_stage_id;
      }
      if (ligacao.alterar_scoring && ligacao.novo_scoring) {
        prospectoUpdates.lead_scoring = ligacao.novo_scoring;
      }
      await (supabase as any)
        .from('outbound_prospectos')
        .update(prospectoUpdates)
        .eq('id', ligacao.prospecto_id);

      // Registrar no histórico
      await (supabase as any)
        .from('outbound_historico')
        .insert({
          organization_id: orgId,
          prospecto_id: ligacao.prospecto_id,
          usuario_id: user?.id,
          tipo: 'ligacao_registrada',
          descricao: `Ligação #${nextTentativa} registrada — ${ligacao.status}${ligacao.resultado ? ` → ${ligacao.resultado}` : ''}`,
          metadados: {
            ligacao_id: data.id,
            status: ligacao.status,
            resultado: ligacao.resultado,
            duracao_segundos: ligacao.duracao_segundos,
            script_id: ligacao.script_id,
          },
        });

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound_ligacoes', variables.prospecto_id] });
      queryClient.invalidateQueries({ queryKey: ['outbound_ligacoes_all', orgId] });
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      queryClient.invalidateQueries({ queryKey: ['outbound_prospecto', variables.prospecto_id] });
      toast.success('Ligação registrada com sucesso');
    },
    onError: (err: any) => toast.error('Erro ao registrar ligação: ' + err.message),
  });
}
