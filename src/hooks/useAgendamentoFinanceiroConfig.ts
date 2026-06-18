import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";

export interface AgendamentoFinanceiroConfig {
  consulta_valor_padrao: number | null;
  consulta_abatimento_ativo: boolean;
  consulta_abatimento_tipo: "fixo" | "percentual";
  consulta_abatimento_valor: number | null;
}

export function useAgendamentoFinanceiroConfig() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["agendamento-financeiro-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("consulta_valor_padrao, consulta_abatimento_ativo, consulta_abatimento_tipo, consulta_abatimento_valor")
        .eq("id", orgId!)
        .single();
      if (error) throw error;
      return {
        consulta_valor_padrao: data.consulta_valor_padrao ?? null,
        consulta_abatimento_ativo: data.consulta_abatimento_ativo ?? false,
        consulta_abatimento_tipo: (data.consulta_abatimento_tipo ?? "fixo") as "fixo" | "percentual",
        consulta_abatimento_valor: data.consulta_abatimento_valor ?? null,
      } as AgendamentoFinanceiroConfig;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const saveConfig = useMutation({
    mutationFn: async (payload: AgendamentoFinanceiroConfig) => {
      const { error } = await supabase
        .from("organizations")
        .update({
          consulta_valor_padrao: payload.consulta_valor_padrao,
          consulta_abatimento_ativo: payload.consulta_abatimento_ativo,
          consulta_abatimento_tipo: payload.consulta_abatimento_tipo,
          consulta_abatimento_valor: payload.consulta_abatimento_valor,
        })
        .eq("id", orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamento-financeiro-config", orgId] });
      toast.success("Configurações financeiras salvas!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar configurações.");
    },
  });

  /** Calcula o valor do abatimento para um dado valor de procedimento */
  function calcularAbatimento(valorConsulta: number | null, valorProcedimento: number | null): number {
    if (!config?.consulta_abatimento_ativo) return 0;
    const base = config.consulta_abatimento_valor ?? 0;
    if (config.consulta_abatimento_tipo === "percentual") {
      return Math.round(((valorProcedimento ?? 0) * base) / 100 * 100) / 100;
    }
    // fixo — usa o valor configurado, ou o valor da consulta se não houver config
    return base > 0 ? base : (valorConsulta ?? 0);
  }

  return { config, isLoading, saveConfig, calcularAbatimento };
}
