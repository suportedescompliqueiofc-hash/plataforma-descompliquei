import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

export interface Procedimento {
  id: string;
  organization_id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  valor_base: number | null;
  duracao_minutos: number | null;
  ativo: boolean;
  criado_em: string;
}

export type ProcedimentoInput = Omit<Procedimento, 'id' | 'organization_id' | 'criado_em'>;

export function useProcedimentos() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: procedimentos = [], isLoading } = useQuery({
    queryKey: ['procedimentos', orgId],
    queryFn: async () => {
      if (!user || !orgId) return [];
      const { data, error } = await supabase
        .from('procedimentos')
        .select('*')
        .eq('organization_id', orgId)
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as Procedimento[];
    },
    enabled: !!user && !!orgId,
  });

  const createProcedimento = useMutation({
    mutationFn: async (input: ProcedimentoInput) => {
      if (!orgId) throw new Error('Organização não encontrada');
      const { data, error } = await supabase
        .from('procedimentos')
        .insert([{ ...input, organization_id: orgId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedimentos', orgId] });
      toast.success('Procedimento criado com sucesso!');
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao criar procedimento'),
  });

  const updateProcedimento = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProcedimentoInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('procedimentos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedimentos', orgId] });
      toast.success('Procedimento atualizado!');
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao atualizar procedimento'),
  });

  const deleteProcedimento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('procedimentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedimentos', orgId] });
      toast.success('Procedimento excluído!');
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao excluir procedimento'),
  });

  return {
    procedimentos,
    isLoading,
    createProcedimento: createProcedimento.mutate,
    updateProcedimento: updateProcedimento.mutate,
    deleteProcedimento: deleteProcedimento.mutate,
    isMutating: createProcedimento.isPending || updateProcedimento.isPending || deleteProcedimento.isPending,
  };
}
