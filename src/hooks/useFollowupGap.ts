import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";

export type FollowupGapLead = {
  id: string;
  nome: string | null;
  telefone: string | null;
  criado_em: string;
  atualizado_em: string | null;
  followup_gap_motivo: string | null;
  followup_gap_analisado_em: string;
  ultimo_contato: string | null;
  horasSemContato: number;
};

export function useFollowupGap(dateRange?: DateRange) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const from = dateRange?.from;
  const to = dateRange?.to;

  const { data: gapLeads, isLoading } = useQuery({
    queryKey: ["followup-gap", orgId, from?.toISOString(), to?.toISOString()],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from("leads")
        .select("id, nome, telefone, criado_em, atualizado_em, followup_gap_motivo, followup_gap_analisado_em, ultimo_contato")
        .eq("organization_id", orgId)
        .eq("followup_gap", "PRECISA_FOLLOW")
        .order("ultimo_contato", { ascending: false, nullsFirst: false });

      if (from) query = query.gte("ultimo_contato", startOfDay(from).toISOString());
      if (to) query = query.lte("ultimo_contato", endOfDay(to).toISOString());

      const { data } = await query;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: avgTicket } = useQuery({
    queryKey: ["followup-gap-avg-ticket", orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { data } = await supabase
        .from("vendas")
        .select("valor_fechado")
        .eq("organization_id", orgId)
        .not("valor_fechado", "is", null);
      if (!data?.length) return 0;
      return data.reduce((sum, v) => sum + (v.valor_fechado ?? 0), 0) / data.length;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
  });

  const now = Date.now();
  const leads: FollowupGapLead[] = (gapLeads ?? []).map((l) => ({
    ...l,
    horasSemContato: l.ultimo_contato
      ? Math.floor((now - new Date(l.ultimo_contato).getTime()) / (1000 * 60 * 60))
      : 0,
  }));

  const avgHorasSemContato =
    leads.length > 0
      ? Math.round(leads.reduce((sum, l) => sum + l.horasSemContato, 0) / leads.length)
      : 0;

  return {
    leads,
    total: leads.length,
    avgHorasSemContato,
    faturamentoEmRisco: leads.length * (avgTicket ?? 0),
    isLoading,
  };
}
