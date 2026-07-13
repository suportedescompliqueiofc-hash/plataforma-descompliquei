import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feed "o que cada agente Athos fez" — agrega os logs próprios de Triagem, Pré-Atendimento,
 * Follow-Up e Análise via a função SQL `get_athos_eventos` (SECURITY DEFINER, escopo derivado do
 * auth.uid()). Passe `agenteSlug` para filtrar a atividade de um único agente (usado na página
 * individual `/crm/athos/:id`); sem slug (null) = feed de todos os agentes.
 *
 * A função ainda não está nos tipos gerados do Supabase — shim tipado local (sem `any`).
 */
export interface AthosEvento {
  agente_slug: string;
  agente_nome: string;
  lead_id: string | null;
  resumo: string;
  status: string | null;
  criado_em: string;
}

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const rpcAthosEventos = (limit: number, agenteSlug: string | null) =>
  (supabase as unknown as {
    rpc(fn: string, args: Record<string, unknown>): RpcResult<AthosEvento[]>;
  }).rpc("get_athos_eventos", { p_limit: limit, p_agente_slug: agenteSlug });

export function useAthosEventos(agenteSlug: string | null = null, limit = 20) {
  return useQuery({
    queryKey: ["athos-eventos", agenteSlug, limit],
    queryFn: async (): Promise<AthosEvento[]> => {
      const { data, error } = await rpcAthosEventos(limit, agenteSlug);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
