import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CSNPSTemplate, CSNPSCampanha, CSNPSPergunta, CSNPSRespostaDetalhe, NPSDimensao, NPSPerguntaTipo } from '@/pages/admin-os/types/cs';

export interface DraftNpsPergunta {
  _id: string;
  dbId?: string;
  dimensao: NPSDimensao;
  tipo: NPSPerguntaTipo;
  texto: string;
  obrigatoria: boolean;
}

export function useCSNpsTemplates() {
  return useQuery({
    queryKey: ['cs-nps-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_nps_templates')
        .select('*, cs_nps_perguntas(*)')
        .eq('ativo', true)
        .order('created_at');
      if (error) throw error;
      const templates = (data || []) as unknown as CSNPSTemplate[];
      templates.forEach(t => t.cs_nps_perguntas?.sort((a, b) => a.ordem - b.ordem));
      return templates;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveNpsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, nome, perguntas }: { templateId?: string; nome: string; perguntas: DraftNpsPergunta[] }) => {
      let realTemplateId = templateId;
      if (realTemplateId) {
        const { error } = await supabase.from('cs_nps_templates').update({ nome }).eq('id', realTemplateId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('cs_nps_templates').insert({ nome }).select('id').single();
        if (error) throw error;
        realTemplateId = (data as { id: string }).id;
      }

      const perguntaRows = perguntas.map((p, i) => ({
        ...(p.dbId ? { id: p.dbId } : {}),
        template_id: realTemplateId,
        ordem: i,
        dimensao: p.dimensao,
        tipo: p.tipo,
        texto: p.texto,
        variaveis: Array.from(new Set((p.texto.match(/\[([^\]]+)\]/g) ?? []).map(m => m.slice(1, -1)))),
        obrigatoria: p.obrigatoria,
      }));

      const savedIds: string[] = [];
      if (perguntaRows.length > 0) {
        const { data: savedPerguntas, error: pErr } = await supabase
          .from('cs_nps_perguntas')
          .upsert(perguntaRows, { onConflict: 'id' })
          .select('id');
        if (pErr) throw pErr;
        savedIds.push(...(savedPerguntas as { id: string }[]).map(p => p.id));
      }

      const { data: allPerguntas } = await supabase
        .from('cs_nps_perguntas')
        .select('id')
        .eq('template_id', realTemplateId);
      const toDelete = (allPerguntas ?? [])
        .map((p: { id: string }) => p.id)
        .filter((id: string) => !savedIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('cs_nps_perguntas').delete().in('id', toDelete);
      }
    },
    onSuccess: () => {
      toast.success('Template salvo');
      qc.invalidateQueries({ queryKey: ['cs-nps-templates'] });
    },
    onError: () => toast.error('Erro ao salvar template'),
  });
}

export function useCSNpsResponseDetail(campanhaId: string | null) {
  return useQuery({
    queryKey: ['cs-nps-response-detail', campanhaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_nps_respostas_detalhe')
        .select('*')
        .eq('campanha_id', campanhaId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as CSNPSRespostaDetalhe[];
    },
    enabled: !!campanhaId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCSNpsCampaigns(limit = 100) {
  return useQuery({
    queryKey: ['cs-nps-campanhas', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_nps_campanhas')
        .select('*, platform_users(clinic_name, nome_completo), cs_nps_templates(nome, cs_nps_perguntas(*))')
        .order('disparado_em', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as CSNPSCampanha[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useDispatchNpsSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, templateId, dispatchedBy }: { clientId: string; templateId: string; dispatchedBy?: string }) => {
      const { error } = await supabase.from('cs_nps_campanhas').insert({
        client_id: clientId,
        template_id: templateId,
        disparado_por: dispatchedBy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pesquisa disparada');
      qc.invalidateQueries({ queryKey: ['cs-nps-campanhas'] });
    },
    onError: (error: { code?: string }) => {
      if (error?.code === '23505') {
        toast.error('Já existe uma pesquisa pendente para este cliente');
      } else {
        toast.error('Erro ao disparar pesquisa');
      }
    },
  });
}

export function useCancelNpsCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campanhaId, canceledBy }: { campanhaId: string; canceledBy?: string }) => {
      const { error } = await supabase.from('cs_nps_campanhas')
        .update({ status: 'cancelada', cancelado_por: canceledBy, cancelado_em: new Date().toISOString() })
        .eq('id', campanhaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pesquisa cancelada');
      qc.invalidateQueries({ queryKey: ['cs-nps-campanhas'] });
    },
    onError: () => toast.error('Erro ao cancelar pesquisa'),
  });
}
