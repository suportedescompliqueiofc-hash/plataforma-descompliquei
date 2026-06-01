import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";

export interface Agendamento {
  id: string;
  organization_id: string;
  lead_id: string | null;
  usuario_id: string | null;
  titulo: string;
  descricao: string | null;
  data_hora_inicio: string;
  data_hora_fim: string;
  duracao_minutos: number;
  tipo: string;
  local: string | null;
  link_reuniao: string | null;
  status: string;
  cor: string;
  resultado: string | null;
  observacoes_pos: string | null;
  procedimento_interesse: string | null;
  valor_orcado: number | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string | null;
  lead?: {
    id: string;
    nome: string;
    telefone: string | null;
    lead_scoring: string | null;
  };
}

export interface AgendamentoMetricas {
  organization_id: string;
  total_agendamentos: number;
  agendados: number;
  confirmados: number;
  realizados: number;
  no_show: number;
  cancelados: number;
  remarcados: number;
  taxa_comparecimento: number;
  taxa_no_show: number;
  valor_orcado_realizados: number;
  proximos: number;
}

export interface AgendamentoInput {
  lead_id?: string | null;
  usuario_id?: string | null;
  titulo: string;
  descricao?: string | null;
  data_hora_inicio: string;
  data_hora_fim: string;
  duracao_minutos?: number;
  tipo?: string;
  local?: string | null;
  link_reuniao?: string | null;
  status?: string;
  cor?: string;
  resultado?: string | null;
  observacoes_pos?: string | null;
  procedimento_interesse?: string | null;
  valor_orcado?: number | null;
}

export function useAgendamentos() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["agendamentos", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          lead:leads(id, nome, telefone, lead_scoring)
        `)
        .eq("organization_id", orgId!)
        .order("data_hora_inicio", { ascending: true });
      if (error) throw error;
      return (data || []) as Agendamento[];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: metricas } = useQuery({
    queryKey: ["agendamentos-metricas", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_agendamentos_metricas")
        .select("*")
        .eq("organization_id", orgId!)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return (data || null) as AgendamentoMetricas | null;
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const criarAgendamento = useMutation({
    mutationFn: async (input: AgendamentoInput) => {
      const { data, error } = await supabase
        .from("agendamentos")
        .insert({
          ...input,
          organization_id: orgId!,
          criado_por: profile?.id,
        })
        .select(`*, lead:leads(id, nome, telefone, lead_scoring)`)
        .single();
      if (error) throw error;
      return data as Agendamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-metricas", orgId] });
    },
  });

  const atualizarAgendamento = useMutation({
    mutationFn: async ({ id, ...updates }: AgendamentoInput & { id: string }) => {
      const { data, error } = await supabase
        .from("agendamentos")
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", orgId!)
        .select(`*, lead:leads(id, nome, telefone, lead_scoring)`)
        .single();
      if (error) throw error;
      return data as Agendamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-metricas", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });

  const deletarAgendamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-metricas", orgId] });
    },
  });

  const buscarNotificacoes = async (agendamentoId: string) => {
    const { data, error } = await supabase
      .from("agendamento_notificacoes")
      .select("*")
      .eq("agendamento_id", agendamentoId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return data || [];
  };

  return {
    agendamentos,
    metricas,
    isLoading,
    criarAgendamento,
    atualizarAgendamento,
    deletarAgendamento,
    buscarNotificacoes,
    orgId,
  };
}
