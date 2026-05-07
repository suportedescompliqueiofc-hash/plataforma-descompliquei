import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { Agendamento } from "./useAgendamentos";

export function useLeadAgendamento(leadId: string | null | undefined) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: agendamentoAtivo, isLoading } = useQuery({
    queryKey: ["lead-agendamento", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`*, lead:leads(id, nome, telefone, lead_scoring)`)
        .eq("lead_id", leadId!)
        .in("status", ["agendado", "confirmado"])
        .order("data_hora_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Agendamento | null;
    },
    enabled: !!leadId && !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["lead-agendamento", leadId] });
    queryClient.invalidateQueries({ queryKey: ["agendamentos", orgId] });
    queryClient.invalidateQueries({ queryKey: ["agendamentos-metricas", orgId] });
  }

  return { agendamentoAtivo, isLoading, invalidate };
}
