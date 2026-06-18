import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { Lead } from './useLeads';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useEffect } from 'react';

export interface Venda {
  id: string;
  lead_id: string;
  organization_id: string;
  usuario_id: string | null;
  valor_orcado: number | null;
  data_orcamento: string | null;
  valor_fechado: number;
  data_fechamento: string;
  forma_pagamento: string | null;
  produto_servico: string | null;
  agendamento_id: string | null;
  tipo_venda: string | null;
  criado_em: string;
  leads: Pick<Lead, 'nome' | 'telefone'>; // Para join
}

export function useVendas(dateRange?: DateRange) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Realtime Subscription
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel('vendas_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendas' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['vendas'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ['vendas', orgId, dateRange],
    queryFn: async () => {
      if (!user || !orgId) return [];
      
      let query = supabase
        .from('vendas')
        .select(`
          *,
          leads (
            nome,
            telefone
          )
        `)
        .eq('organization_id', orgId)
        .order('data_fechamento', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('data_fechamento', format(startOfDay(dateRange.from), 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte('data_fechamento', format(endOfDay(dateRange.to), 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Venda[];
    },
    enabled: !!user && !!orgId,
  });

  const createVenda = useMutation({
    mutationFn: async (venda: Omit<Venda, 'id' | 'organization_id' | 'criado_em' | 'leads' | 'usuario_id'>) => {
      if (!user || !orgId) throw new Error("Usuário ou organização não autenticado");
      
      const { data, error } = await supabase
        .from('vendas')
        .insert([{ ...venda, usuario_id: user.id, organization_id: orgId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      if (data?.lead_id) {
        await supabase
          .from('leads')
          .update({ is_closed: true, is_qualified: true })
          .eq('id', data.lead_id);
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      queryClient.invalidateQueries({ queryKey: ['vendas', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Venda registrada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao registrar venda');
    },
  });

  const updateVenda = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<Venda, 'criado_em' | 'leads'>> & { id: string }) => {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from('vendas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Venda atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar venda');
    },
  });

  const deleteVenda = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from('vendas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success('Venda excluída com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir venda');
    },
  });

  return {
    vendas,
    isLoading,
    createVenda: createVenda.mutate,
    updateVenda: updateVenda.mutate,
    deleteVenda: deleteVenda.mutate,
  };
}