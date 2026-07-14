import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

export interface LeadDocumentoPasta {
  id: string;
  lead_id: string;
  organization_id: string;
  nome: string;
  criado_em: string;
}

export interface LeadDocumento {
  id: string;
  lead_id: string;
  organization_id: string;
  pasta_id: string | null;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number | null;
  criado_em: string;
  signedUrl: string | null;
}

const BUCKET = "lead-documentos";
const SIGNED_TTL = 60 * 60; // 1h

export function useLeadDocumentos(leadId: string | undefined) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const pastasQuery = useQuery({
    queryKey: ["lead-documento-pastas", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_documento_pastas")
        .select("*")
        .eq("lead_id", leadId!)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data || []) as LeadDocumentoPasta[];
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
  });

  const documentosQuery = useQuery({
    queryKey: ["lead-documentos", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_documentos")
        .select("*")
        .eq("lead_id", leadId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;

      const rows = (data || []) as any[];
      if (!rows.length) return [] as LeadDocumento[];

      // Bucket é privado → gera URLs assinadas temporárias
      const paths = rows.map((r) => r.storage_path);
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
      const urlByPath = new Map((signed || []).map((s: any) => [s.path, s.signedUrl]));

      return rows.map((r) => ({ ...r, signedUrl: urlByPath.get(r.storage_path) ?? null })) as LeadDocumento[];
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
  });

  const createPasta = useMutation({
    mutationFn: async (nome: string) => {
      if (!orgId || !leadId) throw new Error("Sem organização ou lead");
      const { error } = await supabase.from("lead_documento_pastas").insert({
        lead_id: leadId,
        organization_id: orgId,
        nome,
        criado_por: profile?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-documento-pastas", leadId] });
      toast.success("Pasta criada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar pasta"),
  });

  const removePasta = useMutation({
    mutationFn: async (pasta: LeadDocumentoPasta) => {
      const docsNaPasta = (documentosQuery.data || []).filter((d) => d.pasta_id === pasta.id);
      if (docsNaPasta.length) {
        await supabase.storage.from(BUCKET).remove(docsNaPasta.map((d) => d.storage_path));
      }
      const { error } = await supabase.from("lead_documento_pastas").delete().eq("id", pasta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-documento-pastas", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-documentos", leadId] });
      toast.success("Pasta removida");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover pasta"),
  });

  const upload = useMutation({
    mutationFn: async (input: { file: File; pastaId: string | null }) => {
      if (!orgId || !leadId) throw new Error("Sem organização ou lead");
      if (input.file.type !== "application/pdf") throw new Error("Apenas arquivos PDF são aceitos");
      const path = `${orgId}/${leadId}/${crypto.randomUUID()}.pdf`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, { upsert: false, contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("lead_documentos").insert({
        lead_id: leadId,
        organization_id: orgId,
        pasta_id: input.pastaId,
        nome_arquivo: input.file.name,
        storage_path: path,
        tamanho_bytes: input.file.size,
        criado_por: profile?.id ?? null,
      });
      if (insErr) {
        // rollback do arquivo se a linha falhar
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-documentos", leadId] });
      toast.success("Documento adicionado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar documento"),
  });

  const remove = useMutation({
    mutationFn: async (doc: LeadDocumento) => {
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      const { error } = await supabase.from("lead_documentos").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-documentos", leadId] });
      toast.success("Documento removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover documento"),
  });

  return {
    pastas: pastasQuery.data || [],
    documentos: documentosQuery.data || [],
    isLoading: pastasQuery.isLoading || documentosQuery.isLoading,
    createPasta,
    removePasta,
    upload,
    remove,
  };
}
