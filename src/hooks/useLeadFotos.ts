import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

export interface LeadFoto {
  id: string;
  lead_id: string;
  organization_id: string;
  procedimento: string | null;
  tipo: "antes" | "depois";
  storage_path: string;
  descricao: string | null;
  data_procedimento: string | null;
  criado_em: string;
  signedUrl: string | null;
}

const BUCKET = "lead-fotos";
const SIGNED_TTL = 60 * 60; // 1h

export function useLeadFotos(leadId: string | undefined) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["lead-fotos", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_fotos")
        .select("*")
        .eq("lead_id", leadId!)
        .order("criado_em", { ascending: true });
      if (error) throw error;

      const rows = (data || []) as any[];
      if (!rows.length) return [] as LeadFoto[];

      // Bucket é privado → gera URLs assinadas temporárias
      const paths = rows.map((r) => r.storage_path);
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
      const urlByPath = new Map((signed || []).map((s: any) => [s.path, s.signedUrl]));

      return rows.map((r) => ({ ...r, signedUrl: urlByPath.get(r.storage_path) ?? null })) as LeadFoto[];
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
  });

  const upload = useMutation({
    mutationFn: async (input: { file: File; tipo: "antes" | "depois"; procedimento?: string; descricao?: string; data_procedimento?: string }) => {
      if (!orgId || !leadId) throw new Error("Sem organização ou lead");
      const ext = (input.file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${orgId}/${leadId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, { upsert: false, contentType: input.file.type });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("lead_fotos").insert({
        lead_id: leadId,
        organization_id: orgId,
        procedimento: input.procedimento || null,
        tipo: input.tipo,
        storage_path: path,
        descricao: input.descricao || null,
        data_procedimento: input.data_procedimento || null,
        criado_por: profile?.id ?? null,
      });
      if (insErr) {
        // rollback do arquivo se a linha falhar
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-fotos", leadId] });
      toast.success("Foto adicionada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar foto"),
  });

  const remove = useMutation({
    mutationFn: async (foto: LeadFoto) => {
      await supabase.storage.from(BUCKET).remove([foto.storage_path]);
      const { error } = await supabase.from("lead_fotos").delete().eq("id", foto.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-fotos", leadId] });
      toast.success("Foto removida");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover foto"),
  });

  return { fotos: query.data || [], isLoading: query.isLoading, upload, remove };
}
