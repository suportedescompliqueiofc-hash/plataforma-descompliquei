import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { Lead } from './useLeads';
import { useEffect } from 'react';

export interface Notification {
  id: string;
  user_id: string;
  lead_id: string;
  mensagem: string;
  status: 'pendente' | 'resolvido';
  criado_em: string;
  tipo?: string;
  titulo?: string;
  dados?: Record<string, any>;
  lida?: boolean;
}

export interface NotificationWithLead extends Notification {
  leads: Pick<Lead, 'id' | 'nome' | 'telefone'> | null;
}

interface UseAllNotificationsProps {
  dateRange?: DateRange;
  leadId?: string | null;
}

export function useAllNotifications({ dateRange, leadId }: UseAllNotificationsProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const queryKey = ['all_notifications', orgId, dateRange, leadId];

  // Configuração do Real-time para atualizar o sininho e a lista automaticamente
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel('global_notifications_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificacoes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['all_notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user || !orgId) return [];

      let query = supabase
        .from('notificacoes')
        .select('*')
        .eq('organization_id', orgId);

      if (dateRange?.from) {
        query = query.gte('criado_em', format(startOfDay(dateRange.from), 'yyyy-MM-dd HH:mm:ss'));
      }
      
      if (dateRange?.to) {
        query = query.lte('criado_em', format(endOfDay(dateRange.to), 'yyyy-MM-dd HH:mm:ss'));
      } else if (dateRange?.from && !dateRange.to) {
        query = query.lte('criado_em', format(endOfDay(dateRange.from), 'yyyy-MM-dd HH:mm:ss'));
      }

      if (leadId && leadId !== 'todos') {
        query = query.eq('lead_id', leadId);
      }

      query = query.order('criado_em', { ascending: false });

      const { data: notificationsData, error: notificationsError } = await query;

      if (notificationsError) {
        console.error("Error fetching notifications:", notificationsError);
        throw notificationsError;
      }

      if (!notificationsData || notificationsData.length === 0) {
        return [];
      }

      const leadIds = Array.from(new Set(notificationsData.map(n => n.lead_id).filter(Boolean)));
      
      let leadsMap = new Map<string, Pick<Lead, 'id' | 'nome' | 'telefone'>>();

      if (leadIds.length > 0) {
        const { data: leadsData, error: leadsError } = await supabase
          .from('leads')
          .select('id, nome, telefone')
          .in('id', leadIds);
        
        if (leadsError) {
          console.error("Error fetching leads for notifications:", leadsError);
        } else if (leadsData) {
          leadsData.forEach(lead => {
            leadsMap.set(lead.id, lead);
          });
        }
      }

      const result: NotificationWithLead[] = notificationsData.map(n => ({
        ...n,
        status: n.status as 'pendente' | 'resolvido',
        leads: leadsMap.get(n.lead_id) || null
      }));
      
      return result;
    },
    enabled: !!user && !!orgId,
  });

  const updateNotificationStatus = useMutation({
    mutationFn: async ({ notificationId, status }: { notificationId: string, status: 'pendente' | 'resolvido' }) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ status })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onMutate: async ({ notificationId, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousNotifications = queryClient.getQueryData<NotificationWithLead[]>(queryKey);

      if (previousNotifications) {
        queryClient.setQueryData<NotificationWithLead[]>(queryKey, (old) =>
          old?.map(notification =>
            notification.id === notificationId
              ? { ...notification, status }
              : notification
          ) ?? []
        );
      }

      return { previousNotifications };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
      }
      toast.error('Erro ao atualizar notificação:', { description: err.message });
    },
    onSuccess: () => {
      toast.success('Notificação atualizada com sucesso!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteResolvedNotifications = useMutation({
    mutationFn: async () => {
      // Deleta as notificações com status resolvido. 
      // O RLS já restringe às notificações da organização do usuário.
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('status', 'resolvido');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_notifications'] });
      toast.success('Notificações resolvidas foram limpas com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao limpar notificações:', { description: error.message });
    }
  });

  return {
    notifications,
    isLoading,
    updateStatus: updateNotificationStatus.mutate,
    deleteResolved: deleteResolvedNotifications.mutate,
    isDeletingResolved: deleteResolvedNotifications.isPending,
  };
}