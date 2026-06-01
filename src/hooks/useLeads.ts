import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useProfile } from './useProfile';
import { Tag } from './useTags';
import { useEffect } from 'react';

const normalizePhoneNumber = (phone: string) => {
  let cleaned = (phone || '').replace(/\D/g, '');
  if ((cleaned.length === 10 || cleaned.length === 11) && !cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
};

export interface Lead {
  id: string;
  usuario_id: string;
  organization_id?: string;
  nome?: string;
  telefone: string;
  email?: string;
  cpf?: string;
  idade?: number;
  genero?: string;
  endereco?: string;
  queixa_principal?: string;
  procedimento_interesse?: string;
  resumo?: string;
  origem?: string;
  fonte?: string;
  criativo_id?: string;
  meta_ad_platform?: string;
  meta_ad_source_id?: string;
  status: string;
  posicao_pipeline: number;
  ultimo_contato?: string;
  criado_em: string;
  atualizado_em: string;
  data_nascimento?: string;
  ia_ativa?: boolean;
  ia_paused_until?: string;
  leads_tags?: { tags: Tag }[];
  agendamento?: string;
  is_qualified?: boolean;
  is_scheduled?: boolean;
  is_closed?: boolean;
  excluir_metricas?: boolean;
  lead_scoring?: string | null;
  responsavel_id?: string | null;
}

export function useLeads(dateRange?: DateRange) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const isPhoneBlacklisted = async (phone: string) => {
    if (!orgId) return false;

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) return false;

    const { data, error } = await supabase
      .from('lead_blacklist')
      .select('id')
      .eq('organization_id', orgId)
      .eq('telefone_normalizado', normalizedPhone)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  };

  const removeLeadDependencies = async (id: string) => {
    const { data: msgs } = await supabase.from('mensagens').select('id').eq('lead_id', id);
    const msgIds = msgs?.map(m => m.id) || [];

    if (msgIds.length > 0) {
      await supabase.from('message_attachments').delete().in('message_id', msgIds);
    }

    await Promise.all([
      supabase.from('mensagens').delete().eq('lead_id', id),
      supabase.from('leads_tags').delete().eq('lead_id', id),
      supabase.from('lead_stage_history').delete().eq('lead_id', id),
      supabase.from('notificacoes').delete().eq('lead_id', id),
      supabase.from('vendas').delete().eq('lead_id', id),
      supabase.from('atividades').delete().eq('lead_id', id),
      supabase.from('scheduled_quick_messages').delete().eq('lead_id', id),
      supabase.from('lead_cadencias').delete().eq('lead_id', id),
      supabase.from('cadencia_logs').delete().eq('lead_id', id),
    ]);
  };

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel('leads_global_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `organization_id=eq.${orgId}` },
        (payload) => {
          const leadId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (leadId) {
            queryClient.setQueryData(['lead', leadId, orgId], payload.new);
          }

          queryClient.getQueriesData({ queryKey: ['leads', orgId] }).forEach(([queryKey]) => {
            queryClient.setQueryData<Lead[]>(queryKey, (old) => {
              const current = old || [];

              if (payload.eventType === 'INSERT') {
                const newLead = payload.new as Lead;
                if (current.find((lead) => lead.id === newLead.id)) return current;
                return [newLead, ...current];
              }

              if (payload.eventType === 'UPDATE') {
                const updatedLead = payload.new as Lead;
                return current.map((lead) => lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead);
              }

              if (payload.eventType === 'DELETE') {
                return current.filter((lead) => lead.id !== (payload.old as any).id);
              }

              return current;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient, dateRange]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', orgId, dateRange],
    queryFn: async () => {
      if (!user || !orgId) return [];

      const PAGE_SIZE = 1000;
      let allLeads: Lead[] = [];
      let from = 0;

      while (true) {
        let query = supabase
          .from('leads')
          .select(`
            *,
            leads_tags (
              tags (
                *
              )
            )
          `)
          .eq('organization_id', orgId)
          .order('criado_em', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (dateRange?.from && dateRange?.to) {
          const startDate = format(startOfDay(dateRange.from), 'yyyy-MM-dd HH:mm:ss');
          const endDate = format(endOfDay(dateRange.to), 'yyyy-MM-dd HH:mm:ss');
          query = query.or(`and(criado_em.gte.${startDate},criado_em.lte.${endDate}),and(agendamento.gte.${startDate},agendamento.lte.${endDate}),and(atualizado_em.gte.${startDate},atualizado_em.lte.${endDate})`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allLeads = allLeads.concat(data as Lead[]);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return allLeads;
    },
    enabled: !!user && !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const createLead = useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'usuario_id' | 'organization_id' | 'criado_em' | 'atualizado_em'>) => {
      if (!user || !orgId) throw new Error('Usuário/Organização não autenticado');

      if (await isPhoneBlacklisted(lead.telefone)) {
        throw new Error('Este número está bloqueado permanentemente na blacklist do CRM.');
      }

      const { data, error } = await supabase
        .from('leads')
        .insert([{ ...lead, usuario_id: user.id, organization_id: orgId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Lead[]>(['leads', orgId, dateRange], (old) => [data, ...(old || [])]);
      toast.success('Lead criado com sucesso!');
      // Registrar quem criou o lead
      if (data?.id && orgId) {
        supabase.from('lead_atividades' as any).insert({
          lead_id: data.id,
          organization_id: orgId,
          user_id: user?.id,
          tipo: 'criacao',
          descricao: 'Lead criado',
          metadados: { origem: (data as any).origem },
        }).then(() => {});
      }
    },
    onError: (error: any) => {
      if (error?.message?.toLowerCase().includes('blacklist')) {
        toast.error('Este número está bloqueado permanentemente e não pode voltar para o CRM.');
        return;
      }

      toast.error(error.code === '23505' ? 'Telefone já cadastrado.' : error.message);
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      if (!id || typeof id !== 'string') {
        throw new Error('ID do lead inválido');
      }

      if (!orgId) {
        throw new Error('Usuário sem organização associada');
      }

      if (updates.telefone && await isPhoneBlacklisted(updates.telefone)) {
        throw new Error('Este número está bloqueado permanentemente na blacklist do CRM.');
      }

      const allowedFields: (keyof Lead)[] = [
        'nome', 'telefone', 'email', 'cpf', 'idade', 'genero', 'endereco',
        'queixa_principal', 'procedimento_interesse', 'resumo', 'origem', 'fonte',
        'criativo_id', 'status', 'posicao_pipeline', 'ultimo_contato', 'agendamento',
        'data_nascimento', 'ia_ativa', 'ia_paused_until', 'is_qualified', 'is_scheduled', 'is_closed', 'excluir_metricas', 'lead_scoring', 'responsavel_id',
      ];

      const cleanUpdates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in updates && updates[key] !== undefined) {
          const value = (updates as any)[key];
          if (key === 'ia_ativa' && typeof value !== 'boolean') {
            console.warn('[updateLead] ia_ativa não é boolean, convertendo:', typeof value, value);
          }
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        throw new Error('Nenhum campo válido para atualizar');
      }

      console.log('[updateLead] Atualizando lead:', id, 'com:', cleanUpdates);
      const { error } = await supabase
        .from('leads')
        .update(cleanUpdates)
        .eq('id', id);

      if (error) {
        console.error('[updateLead] Erro ao atualizar lead:', error);
        throw new Error(`Erro ao atualizar lead: ${error.message} (código: ${error.code})`);
      }

      // Nota: lead_stage_history é populado automaticamente pelo trigger
      // trg_track_stage_change no banco — não inserir manualmente aqui.

      // Registrar atividade quando etapa do pipeline muda (atribuição de autor)
      if ('posicao_pipeline' in cleanUpdates) {
        await supabase.from('lead_atividades' as any).insert({
          lead_id: id,
          organization_id: orgId,
          user_id: user?.id,
          tipo: 'etapa',
          descricao: `Etapa alterada para posição ${cleanUpdates.posicao_pipeline}`,
          metadados: { posicao_pipeline: cleanUpdates.posicao_pipeline },
        });
      }

      // Registrar nota do sistema quando is_qualified muda para true
      // (para ter timestamp exato na Jornada do Paciente)
      if (cleanUpdates.is_qualified === true) {
        await supabase.from('lead_notas').insert({
          lead_id: id,
          organization_id: orgId,
          conteudo: 'Lead marcado como qualificado (MQL)',
          tipo: 'sistema',
          metadados: { evento: 'mql', is_qualified: true },
        });
      }

      // Registrar nota do sistema quando lead_scoring é definido/alterado
      if (cleanUpdates.lead_scoring) {
        const labels: Record<string, string> = {
          A: 'Lead dos Sonhos',
          B: 'Qualificado com Ressalva',
          C: 'Em Desenvolvimento',
          D: 'Fora do ICP',
        };
        await supabase.from('lead_notas').insert({
          lead_id: id,
          organization_id: orgId,
          conteudo: `Scoring definido como ${cleanUpdates.lead_scoring} — ${labels[cleanUpdates.lead_scoring as string] || ''}`,
          tipo: 'sistema',
          metadados: { evento: 'scoring', scoring: cleanUpdates.lead_scoring },
        });
      }

      // Registrar atividade quando responsavel_id é atribuído/alterado
      if ('responsavel_id' in cleanUpdates) {
        await supabase.from('lead_atividades' as any).insert({
          lead_id: id,
          organization_id: orgId,
          user_id: user?.id,
          tipo: 'responsavel',
          descricao: cleanUpdates.responsavel_id
            ? 'Responsável atribuído ao lead'
            : 'Responsável removido do lead',
          metadados: { responsavel_id: cleanUpdates.responsavel_id },
        });
      }

      return { id, ...cleanUpdates } as Lead;
    },
    onMutate: async (variables) => {
      const listQueryKey = ['leads', orgId, dateRange];
      const singleQueryKey = ['lead', variables.id, orgId];

      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousLeads = queryClient.getQueryData<Lead[]>(listQueryKey);
      const previousLead = queryClient.getQueryData<Lead>(singleQueryKey);

      queryClient.setQueryData<Lead[]>(listQueryKey, (old) => {
        return (old || []).map((lead) => lead.id === variables.id ? { ...lead, ...variables } : lead);
      });

      if (previousLead) {
        queryClient.setQueryData<Lead>(singleQueryKey, { ...previousLead, ...variables });
      }

      return { previousLeads, previousLead };
    },
    onError: (err: any, variables, context) => {
      console.error('[updateLead] Erro:', err?.message || err);
      if (context?.previousLeads) {
        queryClient.setQueryData(['leads', orgId, dateRange], context.previousLeads);
      }
      if (context?.previousLead) {
        queryClient.setQueryData(['lead', variables.id, orgId], context.previousLead);
      }
      toast.error('Erro ao atualizar lead: ' + (err?.message || 'Tente novamente.'));
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads', orgId] });
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id, orgId] });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      await removeLeadDependencies(id);

      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;

      return id;
    },
    onMutate: async (id) => {
      const queryKey = ['leads', orgId, dateRange];
      await queryClient.cancelQueries({ queryKey });
      const previousLeads = queryClient.getQueryData<Lead[]>(queryKey);
      queryClient.setQueryData<Lead[]>(queryKey, (old) => (old || []).filter((lead) => lead.id !== id));
      return { previousLeads };
    },
    onError: (err: any, _id, context) => {
      if (context?.previousLeads) {
        const queryKey = ['leads', orgId, dateRange];
        queryClient.setQueryData(queryKey, context.previousLeads);
      }
      toast.error(`Falha ao excluir lead: ${err.message}`);
    },
  });

  const blacklistLead = useMutation({
    mutationFn: async (lead: Pick<Lead, 'id' | 'nome' | 'telefone'>) => {
      const { error } = await supabase.rpc('blacklist_lead_permanently', {
        p_lead_id: lead.id,
        p_reason: 'Bloqueado manualmente pelo CRM.',
      });

      if (error) throw error;
      return lead.id;
    },
    onMutate: async (lead) => {
      const queryKey = ['leads', orgId, dateRange];
      await queryClient.cancelQueries({ queryKey });
      const previousLeads = queryClient.getQueryData<Lead[]>(queryKey);
      queryClient.setQueryData<Lead[]>(queryKey, (old) => (old || []).filter((item) => item.id !== lead.id));
      return { previousLeads };
    },
    onError: (err: any, lead, context) => {
      if (context?.previousLeads) {
        const queryKey = ['leads', orgId, dateRange];
        queryClient.setQueryData(queryKey, context.previousLeads);
      }
      toast.error(`Falha ao bloquear ${lead.nome || lead.telefone}: ${err.message}`);
    },
    onSuccess: () => {
      toast.success('Número bloqueado permanentemente. Ele não voltará mais para o CRM.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', orgId] });
    },
  });

  return {
    leads,
    isLoading,
    createLead: createLead.mutate,
    updateLead: updateLead.mutate,
    deleteLead: deleteLead.mutateAsync,
    blacklistLead: blacklistLead.mutateAsync,
  };
}

export function useLead(leadId: string | null) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leadId || !orgId) return;

    const channel = supabase
      .channel(`lead_detail_${leadId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
        (payload) => {
          queryClient.setQueryData(['lead', leadId, orgId], payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, orgId, queryClient]);

  return useQuery<Lead | null, Error>({
    queryKey: ['lead', leadId, orgId],
    queryFn: async () => {
      if (!leadId || !user || !orgId) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('organization_id', orgId)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
    enabled: !!leadId && !!user && !!orgId,
  });
}
