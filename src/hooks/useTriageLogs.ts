import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export interface TriageLog {
  id: string;
  lead_id: string | null;
  lead_nome: string | null;
  mensagem: string | null;
  tipo_mensagem: string | null;
  decisao: boolean;
  motivo: string | null;
  modelo: string | null;
  duracao_ms: number | null;
  origem_lead: string | null;
  created_at: string;
}

export function useLeadTriageLog(leadId: string | undefined) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["triage_ia_log_lead", orgId, leadId],
    queryFn: async (): Promise<TriageLog | null> => {
      if (!orgId || !leadId) return null;
      const { data } = await supabase
        .from("triage_ia_logs")
        .select("*")
        .eq("organization_id", orgId)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!orgId && !!leadId,
    staleTime: 60_000,
  });
}

export function useTriageLogs() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["triage_ia_logs", orgId],
    queryFn: async (): Promise<TriageLog[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("triage_ia_logs")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}
