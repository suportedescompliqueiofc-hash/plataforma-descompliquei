import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import type { NPSDimensao, NPSPerguntaTipo } from '@/pages/admin-os/types/cs';

interface PendingNpsSurveyRow {
  campanha_id: string;
  template_id: string;
  pergunta_id: string;
  ordem: number;
  dimensao: NPSDimensao;
  tipo: NPSPerguntaTipo;
  texto: string;
  obrigatoria: boolean;
}

export interface PendingNpsPergunta {
  perguntaId: string;
  dimensao: NPSDimensao;
  tipo: NPSPerguntaTipo;
  texto: string;
  obrigatoria: boolean;
}

export interface PendingNpsSurvey {
  campanhaId: string;
  perguntas: PendingNpsPergunta[];
}

export function useNpsSurvey() {
  const { user } = useAuth();
  const { role } = useProfile();
  const queryClient = useQueryClient();

  const isOrgOwner = role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['nps-survey-pending', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_nps_survey');
      if (error) throw error;
      const rows = (data as PendingNpsSurveyRow[] | null) ?? [];
      if (rows.length === 0) return null;
      const survey: PendingNpsSurvey = {
        campanhaId: rows[0].campanha_id,
        perguntas: rows
          .sort((a, b) => a.ordem - b.ordem)
          .map(r => ({ perguntaId: r.pergunta_id, dimensao: r.dimensao, tipo: r.tipo, texto: r.texto, obrigatoria: r.obrigatoria })),
      };
      return survey;
    },
    enabled: isOrgOwner && !!user,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const submitResponse = useMutation({
    mutationFn: async ({ campanhaId, respostas }: { campanhaId: string; respostas: Array<{ pergunta_id: string; valor_numero?: number; valor_texto?: string }> }) => {
      const { error } = await supabase.rpc('submit_nps_response', {
        p_campanha_id: campanhaId,
        p_respostas: respostas,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps-survey-pending', user?.id] });
    },
  });

  const snooze = useMutation({
    mutationFn: async ({ campanhaId, dias = 3 }: { campanhaId: string; dias?: number }) => {
      const { error } = await supabase.rpc('snooze_nps_survey', {
        p_campanha_id: campanhaId,
        p_dias: dias,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps-survey-pending', user?.id] });
    },
  });

  return {
    pending: data ?? null,
    isLoading,
    submitResponse,
    snooze,
  };
}
