import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

export interface OutboundStage {
  id: string;
  organization_id: string;
  nome: string;
  cor: string;
  posicao_ordem: number;
  tipo: 'ativo' | 'ganho' | 'perdido';
  criado_em: string;
  atualizado_em: string;
}

export function useOutboundStages() {
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['outbound_stages', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_stages')
        .select('*')
        .eq('organization_id', orgId)
        .order('posicao_ordem', { ascending: true });
      if (error) throw error;
      return data as OutboundStage[];
    },
    enabled: !!orgId,
  });

  const createStage = useMutation({
    mutationFn: async (stage: Partial<OutboundStage>) => {
      const { data, error } = await (supabase as any)
        .from('outbound_stages')
        .insert({ ...stage, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_stages', orgId] });
      toast.success('Stage criado com sucesso');
    },
    onError: (err: any) => toast.error('Erro ao criar stage: ' + err.message),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OutboundStage> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('outbound_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_stages', orgId] });
      toast.success('Stage atualizado');
    },
    onError: (err: any) => toast.error('Erro ao atualizar stage: ' + err.message),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('outbound_stages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound_stages', orgId] });
      toast.success('Stage removido');
    },
    onError: (err: any) => toast.error('Erro ao remover stage: ' + err.message),
  });

  return { stages, isLoading, createStage, updateStage, deleteStage };
}
