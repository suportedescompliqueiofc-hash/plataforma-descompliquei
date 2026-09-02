import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { addMinutes, addHours, addDays } from 'date-fns';
import { useEffect } from 'react';

export interface CadenceStep {
  id?: string;
  posicao_ordem: number;
  tempo_espera: number;
  unidade_tempo: 'minutos' | 'horas' | 'dias';
  tipo_mensagem: 'texto' | 'audio' | 'imagem' | 'video' | 'pdf';
  conteudo: string | null;
  arquivo_path: string | null;
  temp_file?: File | null;
}

export interface Cadence {
  id: string;
  nome: string;
  descricao: string | null;
  passos?: CadenceStep[];
  criado_em: string;
}

export function useCadences() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: cadences = [], isLoading } = useQuery({
    queryKey: ['cadences', orgId],
    queryFn: async () => {
      if (!user || !orgId) return [];
      const { data, error } = await supabase
        .from('cadencias')
        .select('*, passos:cadencia_passos(*)')
        .eq('organization_id', orgId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data.map(c => ({
        ...c,
        passos: (c.passos || []).sort((a: any, b: any) => a.posicao_ordem - b.posicao_ordem)
      })) as Cadence[];
    },
    enabled: !!user && !!orgId,
  });

  const createCadence = useMutation({
    mutationFn: async ({ nome, descricao, passos }: { nome: string; descricao: string; passos: CadenceStep[] }) => {
      if (!user || !orgId) throw new Error("Sessão inválida");
      const { data: cadence, error: cadenceError } = await supabase.from('cadencias').insert({ nome, descricao, organization_id: orgId }).select().single();
      if (cadenceError) throw cadenceError;
      const stepsToInsert = await Promise.all(passos.map(async (step) => {
        let arquivo_path = step.arquivo_path;
        if (step.temp_file) {
          const fileExt = step.temp_file.name.split('.').pop();
          const filePath = `${orgId}/cadences/${cadence.id}/${Date.now()}_${step.posicao_ordem}.${fileExt}`;
          await supabase.storage.from('media-mensagens').upload(filePath, step.temp_file);
          arquivo_path = filePath;
        }
        return { cadencia_id: cadence.id, posicao_ordem: step.posicao_ordem, tempo_espera: step.tempo_espera, unidade_tempo: step.unidade_tempo, tipo_mensagem: step.tipo_mensagem, conteudo: step.conteudo, arquivo_path };
      }));
      if (stepsToInsert.length > 0) await supabase.from('cadencia_passos').insert(stepsToInsert);
      return cadence;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadences', orgId] });
      toast.success('Fluxo criado com sucesso!');
    }
  });

  const deleteCadence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cadencias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cadences', orgId] })
  });

  const updateCadence = useMutation({
    mutationFn: async ({ id, nome, descricao, passos }: { id: string; nome: string; descricao: string; passos: CadenceStep[] }) => {
        if (!user || !orgId) throw new Error("Não autorizado");
        await supabase.from('cadencias').update({ nome, descricao, atualizado_em: new Date().toISOString() }).eq('id', id);
        await supabase.from('cadencia_passos').delete().eq('cadencia_id', id);
        const stepsToInsert = await Promise.all(passos.map(async (step) => {
          let arquivo_path = step.arquivo_path;
          if (step.temp_file) {
            const fileExt = step.temp_file.name.split('.').pop();
            const filePath = `${orgId}/cadences/${id}/${Date.now()}_${step.posicao_ordem}.${fileExt}`;
            await supabase.storage.from('media-mensagens').upload(filePath, step.temp_file);
            arquivo_path = filePath;
          }
          return { cadencia_id: id, posicao_ordem: step.posicao_ordem, tempo_espera: step.tempo_espera, unidade_tempo: step.unidade_tempo, tipo_mensagem: step.tipo_mensagem, conteudo: step.conteudo, arquivo_path };
        }));
        await supabase.from('cadencia_passos').insert(stepsToInsert);
        return true;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['cadences', orgId] });
        toast.success('Fluxo atualizado!');
      }
  });

  const bulkStartCadence = useMutation({
    mutationFn: async ({ cadenceId, leadIds, minDelay, maxDelay }: { cadenceId: string, leadIds: string[], minDelay: number, maxDelay: number }) => {
        if (!orgId || !user) throw new Error("Não autorizado");

        // 1. Buscar primeiro passo da cadência
        const { data: firstStep } = await supabase
            .from('cadencia_passos')
            .select('*')
            .eq('cadencia_id', cadenceId)
            .order('posicao_ordem', { ascending: true })
            .limit(1)
            .single();

        if (!firstStep) throw new Error("Esta cadência não possui passos configurados.");

        // 2. Criar registro do disparo em massa para rastreamento
        const { data: dispatch, error: dispatchError } = await supabase
            .from('cadence_dispatches' as any)
            .insert({
                organization_id: orgId,
                cadencia_id: cadenceId,
                total_leads: leadIds.length,
                criado_por: user.id,
            })
            .select('id')
            .single();

        if (dispatchError) throw dispatchError;

        // Intervalo de segurança em ms puro, sem passar pelas funções addX do
        // date-fns: addDays trunca a fração aleatória pra inteiro e descartava
        // o segundo aleatório inteiro pra cadências em "dias" (o caso mais comum).
        // Também empilha o atraso de cada lead sobre o anterior — sorteios
        // independentes a partir de "agora" podiam cair perto um do outro por
        // acaso e o cron mandava os dois na mesma execução.
        const baseWaitMs = firstStep.unidade_tempo === 'minutos' ? firstStep.tempo_espera * 60_000
            : firstStep.unidade_tempo === 'horas' ? firstStep.tempo_espera * 3_600_000
            : firstStep.tempo_espera * 86_400_000;
        const baseNow = Date.now();
        let cumulativeDelayMs = 0;

        const inserts = leadIds.map(leadId => {
            cumulativeDelayMs += Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
            const executionDate = new Date(baseNow + baseWaitMs + cumulativeDelayMs);

            return {
                organization_id: orgId,
                lead_id: leadId,
                cadencia_id: cadenceId,
                passo_atual_ordem: 0,
                status: 'ativo',
                proxima_execucao: executionDate.toISOString(),
                dispatch_id: (dispatch as any).id,
            };
        });

        const { error } = await supabase
            .from('lead_cadencias')
            .upsert(inserts, { onConflict: 'lead_id,cadencia_id' });

        if (error) throw error;
        return true;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['lead_cadence_active'] });
        queryClient.invalidateQueries({ queryKey: ['cadence_dispatches'] });
        toast.success("Disparo em massa iniciado!");
    }
  });

  return { cadences, isLoading, createCadence: createCadence.mutate, updateCadence: updateCadence.mutate, deleteCadence: deleteCadence.mutate, bulkStartCadence: bulkStartCadence.mutateAsync, isCreating: createCadence.isPending, isUpdating: updateCadence.isPending };
}

export function useLeadCadence(leadId: string | undefined) {
    const { profile } = useProfile();
    const orgId = profile?.organization_id;
    const queryClient = useQueryClient();

    // Sincronização em tempo real para o status da cadência do lead
    useEffect(() => {
        if (!leadId) return;

        const channel = supabase
            .channel(`cadence_sync_${leadId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lead_cadencias', filter: `lead_id=eq.${leadId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['lead_cadence_active', leadId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [leadId, queryClient]);

    const { data: activeCadence, isLoading } = useQuery({
        queryKey: ['lead_cadence_active', leadId],
        queryFn: async () => {
            if (!leadId) return null;
            const { data, error } = await supabase
                .from('lead_cadencias')
                .select('*, cadencias(nome)')
                .eq('lead_id', leadId)
                .eq('status', 'ativo')
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!leadId
    });

    const startCadence = useMutation({
        mutationFn: async ({ cadenceId }: { cadenceId: string }) => {
            if (!leadId || !orgId) throw new Error("Dados insuficientes");
            
            const { data: firstStep } = await supabase
                .from('cadencia_passos')
                .select('*')
                .eq('cadencia_id', cadenceId)
                .order('posicao_ordem', { ascending: true })
                .limit(1)
                .single();

            if (!firstStep) throw new Error("Esta cadência não possui passos configurados.");

            const now = new Date();
            let executionDate = now;

            if (firstStep.unidade_tempo === 'minutos') executionDate = addMinutes(now, firstStep.tempo_espera);
            else if (firstStep.unidade_tempo === 'horas') executionDate = addHours(now, firstStep.tempo_espera);
            else executionDate = addDays(now, firstStep.tempo_espera);

            const { error } = await supabase
                .from('lead_cadencias')
                .upsert({
                    organization_id: orgId,
                    lead_id: leadId,
                    cadencia_id: cadenceId,
                    passo_atual_ordem: 0,
                    status: 'ativo',
                    proxima_execucao: executionDate.toISOString(),
                    status_ultima_execucao: null,
                    erro_log: null
                }, { onConflict: 'lead_id,cadencia_id' });

            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead_cadence_active', leadId] });
            toast.success('Cadência ativada para este cliente!');
        },
        onError: (err: any) => toast.error(err.message)
    });

    const stopCadence = useMutation({
        mutationFn: async () => {
            if (!leadId) return;
            const { error } = await supabase
                .from('lead_cadencias')
                .update({ status: 'cancelado', proxima_execucao: null })
                .eq('lead_id', leadId)
                .eq('status', 'ativo');
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead_cadence_active', leadId] });
            toast.info('Cadência interrompida.');
        }
    });

    return { activeCadence, isLoading, startCadence: startCadence.mutate, stopCadence: stopCadence.mutate, isStarting: startCadence.isPending };
}