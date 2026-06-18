import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

export interface BlacklistEntry {
  id: string;
  telefone: string;
  telefone_normalizado: string;
  motivo: string | null;
  blocked_by: string | null;
  created_at: string;
  organization_id: string;
}

export function useBlacklist() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['blacklist', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('lead_blacklist')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BlacklistEntry[];
    },
    enabled: !!orgId,
  });

  const removeFromBlacklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_blacklist')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId!);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['blacklist', orgId] });
      const prev = queryClient.getQueryData<BlacklistEntry[]>(['blacklist', orgId]);
      queryClient.setQueryData<BlacklistEntry[]>(
        ['blacklist', orgId],
        (old) => (old || []).filter((e) => e.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['blacklist', orgId], ctx.prev);
      toast.error('Erro ao remover da blacklist.');
    },
    onSuccess: () => {
      toast.success('Número removido da blacklist. Pode receber mensagens novamente.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist', orgId] });
    },
  });

  return {
    entries,
    isLoading,
    removeFromBlacklist: removeFromBlacklist.mutate,
  };
}
