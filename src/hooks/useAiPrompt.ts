import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

const DEFAULT_HORARIO = { weekday_open: "09:00", weekday_close: "18:00", saturday_open: "", saturday_close: "", saturday_closed: true, sunday_closed: true };
const DEFAULT_FORMAS = { pix: false, dinheiro: false, credito: false, debito: false, parcelamento: "", observacoes: "" };
const DEFAULT_PALAVRAS: string[] = [];

export function useAiPrompt() {
  const defaultModel = 'openrouter/deepseek/deepseek-v4-flash';
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: promptData, isLoading } = useQuery({
    queryKey: ['ai_prompt', orgId],
    queryFn: async () => {
      if (!user || !orgId) return null;
      const { data, error } = await supabase
        .from('organization_ai_prompts')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ prompt: newPrompt, promptCrm, iaAtiva, acumulo_mensagens, modeloIa, horario_atendimento, formas_pagamento, contraindicacoes, palavras_proibidas }: { prompt: string; promptCrm?: string; iaAtiva?: boolean; acumulo_mensagens?: number; modeloIa?: string; horario_atendimento?: Record<string, unknown>; formas_pagamento?: Record<string, unknown>; contraindicacoes?: string; palavras_proibidas?: string[] }) => {
      if (!user || !orgId) throw new Error("Usuário não autenticado");
      const timestamp = new Date().toISOString();
      const payload: Record<string, unknown> = {
        prompt: newPrompt,
        updated_at: timestamp,
        ia_ativa: iaAtiva ?? true,
        modelo_ia: modeloIa?.trim() || promptData?.modelo_ia || defaultModel,
      };

      if (promptCrm !== undefined) {
        payload.prompt_crm = promptCrm;
      }
      if (acumulo_mensagens !== undefined) {
        payload.acumulo_mensagens = acumulo_mensagens;
      }
      if (horario_atendimento !== undefined) {
        payload.horario_atendimento = horario_atendimento;
      }
      if (formas_pagamento !== undefined) {
        payload.formas_pagamento = formas_pagamento;
      }
      if (contraindicacoes !== undefined) {
        payload.contraindicacoes = contraindicacoes;
      }
      if (palavras_proibidas !== undefined) {
        payload.palavras_proibidas = palavras_proibidas;
      }
      
      let resultData;
      if (!promptData) {
        // Defaults fallbacks if new
        payload.delay_entre_mensagens = 2000;
        if (payload.acumulo_mensagens === undefined) payload.acumulo_mensagens = 45;

        const { data, error } = await supabase
          .from('organization_ai_prompts')
          .insert([{ ...payload, organization_id: orgId }])
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      } else {
        const { data, error } = await supabase
          .from('organization_ai_prompts')
          .update(payload)
          .eq('id', promptData.id)
          .select()
          .single();
        if (error) throw error;
        resultData = data;
      }
      return resultData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_prompt', orgId] });
      toast.success('Configurações de IA salvas com sucesso!', { closeButton: true });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar configurações', { closeButton: true });
    },
  });

  const saveModelMutation = useMutation({
    mutationFn: async (modeloIa: string) => {
      if (!user || !orgId) throw new Error("Usuário não autenticado");
      if (!promptData) throw new Error("Configure e salve o prompt antes de alterar o modelo");

      const value = modeloIa.trim();
      if (!value) throw new Error("Informe um modelo para salvar.");

      const { data, error } = await supabase
        .from('organization_ai_prompts')
        .update({ modelo_ia: value, updated_at: new Date().toISOString() })
        .eq('id', promptData.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_prompt', orgId] });
      toast.success('Modelo salvo com sucesso!', { closeButton: true });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar modelo', { closeButton: true });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (ativa: boolean) => {
      if (!orgId) throw new Error("Organização não encontrada");
      if (!promptData) throw new Error("Configure e salve o prompt antes de ativar a IA");
      const { error } = await supabase
        .from('organization_ai_prompts')
        .update({ ia_ativa: ativa, updated_at: new Date().toISOString() })
        .eq('id', promptData.id);
      if (error) throw error;
    },
    onSuccess: (_, ativa) => {
      queryClient.invalidateQueries({ queryKey: ['ai_prompt', orgId] });
      toast.success(ativa ? '🤖 IA ativada com sucesso!' : '⏸️ IA pausada.', { closeButton: true });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao alterar status da IA', { closeButton: true });
    },
  });

  return {
    prompt: promptData?.prompt || '',
    promptCrm: promptData?.prompt_crm || '',
    modeloIa: promptData?.modelo_ia || defaultModel,
    iaAtiva: promptData?.ia_ativa ?? false,
    acumuloMensagens: promptData?.acumulo_mensagens ?? 45,
    horarioAtendimento: (promptData as any)?.horario_atendimento ?? DEFAULT_HORARIO,
    formasPagamento: (promptData as any)?.formas_pagamento ?? DEFAULT_FORMAS,
    contraindicacoes: (promptData as any)?.contraindicacoes ?? '',
    palavrasProibidas: (promptData as any)?.palavras_proibidas ?? DEFAULT_PALAVRAS,
    lastUpdated: promptData?.updated_at,
    isLoading,
    savePrompt: (prompt: string, promptCrm?: string, acumulo_mensagens?: number, callbacks?: { onSuccess?: () => void }, modeloIa?: string, horario_atendimento?: Record<string, unknown>, formas_pagamento?: Record<string, unknown>, contraindicacoes?: string, palavras_proibidas?: string[]) => {
      saveMutation.mutate({ prompt, promptCrm, iaAtiva: true, acumulo_mensagens, modeloIa, horario_atendimento, formas_pagamento, contraindicacoes, palavras_proibidas }, { onSuccess: callbacks?.onSuccess });
    },
    saveModel: saveModelMutation.mutate,
    isSavingModel: saveModelMutation.isPending,
    toggleIa: toggleMutation.mutate,
    isTogglingIa: toggleMutation.isPending,
    isSaving: saveMutation.isPending,
  };
}
