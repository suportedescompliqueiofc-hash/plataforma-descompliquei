import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

/**
 * Liga/desliga de agentes Athos por organização.
 * Ausência de linha = agente ATIVO (padrão). As edge functions dos agentes consultam o mesmo
 * estado via `athos_agente_ativo(org, slug)`.
 *
 * `athos_agentes_org` ainda não está nos tipos gerados do Supabase — usamos um shim tipado
 * local (via `unknown`, sem `any`) só para esta tabela.
 */
type AthosOrgRow = { agente_slug: string; ativo: boolean };
type DbResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

interface AthosOrgTable {
  select(cols: string): { eq(col: string, val: string): DbResult<AthosOrgRow[]> };
  upsert(
    row: { organization_id: string; agente_slug: string; ativo: boolean; updated_at: string },
    opts: { onConflict: string },
  ): DbResult<unknown>;
}

const athosOrgTable = () =>
  (supabase as unknown as { from(t: string): AthosOrgTable }).from("athos_agentes_org");

export function useAthosAgentesOrg() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const qc = useQueryClient();

  const { data: orgFlags } = useQuery({
    queryKey: ["athos-agentes-org", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await athosOrgTable()
        .select("agente_slug, ativo")
        .eq("organization_id", orgId!);
      if (error) throw new Error(error.message);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r) => {
        map[r.agente_slug] = r.ativo;
      });
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ slug, ativo }: { slug: string; ativo: boolean }) => {
      if (!orgId) throw new Error("Organização não encontrada");
      const { error } = await athosOrgTable().upsert(
        {
          organization_id: orgId,
          agente_slug: slug,
          ativo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,agente_slug" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athos-agentes-org", orgId] }),
    onError: (err: unknown) => toast.error("Erro ao atualizar agente: " + String(err)),
  });

  /** ativo por padrão quando não há registro */
  const isAtivo = (slug: string) => orgFlags?.[slug] ?? true;

  return { isAtivo, toggle, orgFlags };
}
