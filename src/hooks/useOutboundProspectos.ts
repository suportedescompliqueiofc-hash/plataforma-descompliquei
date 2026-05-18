import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

export interface OutboundProspecto {
  id: string;
  organization_id: string;
  usuario_id: string | null;
  nome: string;
  telefone: string;
  email: string | null;
  cargo: string | null;
  clinica: string | null;
  cidade: string | null;
  especialidade: string | null;
  faturamento_estimado: string | null;
  tamanho_equipe: number | null;
  tempo_mercado: string | null;
  canal_origem: string | null;
  stage_id: string | null;
  lead_scoring: string | null;
  script_id: string | null;
  whatsapp_lead_id: string | null;
  motivo_perda: string | null;
  observacoes: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  proxima_acao_data: string | null;
  total_tentativas: number;
  criado_em: string;
  atualizado_em: string;
  // joined
  perfil_nome?: string;
  stage_nome?: string;
  stage_cor?: string;
}

export function useOutboundProspectos() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: prospectos = [], isLoading } = useQuery({
    queryKey: ['outbound_prospectos', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_prospectos')
        .select(`
          *,
          perfis:usuario_id ( nome_completo ),
          outbound_stages:stage_id ( nome, cor )
        `)
        .eq('organization_id', orgId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        perfil_nome: p.perfis?.nome_completo || null,
        stage_nome: p.outbound_stages?.nome || null,
        stage_cor: p.outbound_stages?.cor || null,
      })) as OutboundProspecto[];
    },
    enabled: !!orgId,
  });

  const createProspecto = useMutation({
    mutationFn: async (prospecto: Partial<OutboundProspecto>) => {
      const payload = { ...prospecto, organization_id: orgId };
      const { data, error } = await (supabase as any)
        .from('outbound_prospectos')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Registrar histórico de criação
      await (supabase as any)
        .from('outbound_historico')
        .insert({
          organization_id: orgId,
          prospecto_id: data.id,
          usuario_id: user?.id,
          tipo: 'prospecto_criado',
          descricao: `Prospecto "${data.nome}" criado`,
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      toast.success('Prospecto criado com sucesso');
    },
    onError: (err: any) => toast.error('Erro ao criar prospecto: ' + err.message),
  });

  const updateProspecto = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OutboundProspecto> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('outbound_prospectos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      toast.success('Prospecto atualizado');
    },
    onError: (err: any) => toast.error('Erro ao atualizar: ' + err.message),
  });

  const deleteProspecto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('outbound_prospectos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      toast.success('Prospecto removido');
    },
    onError: (err: any) => toast.error('Erro ao remover: ' + err.message),
  });

  return { prospectos, isLoading, createProspecto, updateProspecto, deleteProspecto };
}

export function useOutboundProspecto(id: string | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['outbound_prospecto', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('outbound_prospectos')
        .select(`
          *,
          perfis:usuario_id ( nome_completo ),
          outbound_stages:stage_id ( nome, cor )
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return {
        ...data,
        perfil_nome: data.perfis?.nome_completo || null,
        stage_nome: data.outbound_stages?.nome || null,
        stage_cor: data.outbound_stages?.cor || null,
      } as OutboundProspecto;
    },
    enabled: !!id && !!orgId,
  });
}
