import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  StickyNote, Phone, CalendarDays, Bot, ClipboardList,
  Pencil, Trash2, Loader2, Save, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

// ── Tipo config ─────────────────────────────────────────────

const TIPOS = {
  manual:          { label: "Manual",          icon: StickyNote,    color: "text-blue-500",   bg: "bg-blue-50",    border: "border-blue-200" },
  formulario_meta: { label: "Meta Lead Ads",   icon: ClipboardList, color: "text-orange-500", bg: "bg-orange-50",  border: "border-orange-300" },
  sistema:         { label: "Sistema",         icon: Bot,           color: "text-gray-500",   bg: "bg-gray-50",    border: "border-gray-200" },
  reuniao:         { label: "Reunião",         icon: CalendarDays,  color: "text-green-500",  bg: "bg-green-50",   border: "border-green-200" },
  ligacao:         { label: "Ligação",         icon: Phone,         color: "text-purple-500", bg: "bg-purple-50",  border: "border-purple-200" },
} as const;

type TipoNota = keyof typeof TIPOS;

const TIPOS_MANUAIS: { value: TipoNota; label: string }[] = [
  { value: "manual",  label: "📝 Manual" },
  { value: "reuniao", label: "📅 Reunião" },
  { value: "ligacao", label: "📞 Ligação" },
];

// ── Types ───────────────────────────────────────────────────

interface Nota {
  id: string;
  lead_id: string;
  organization_id: string;
  usuario_id: string | null;
  conteudo: string;
  tipo: TipoNota;
  metadados: any;
  editado: boolean;
  criado_em: string;
  atualizado_em: string;
  perfis?: { nome_completo: string | null; avatar_url: string | null } | null;
}

interface LeadNotasProps {
  leadId: string;
  organizationId: string;
}

// ── Component ───────────────────────────────────────────────

export default function LeadNotas({ leadId, organizationId }: LeadNotasProps) {
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  const [novoConteudo, setNovoConteudo] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoNota>("manual");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // ── Query ───────────────────────────────────────────────

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["lead-notas", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notas")
        .select("*")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: false });

      if (error) throw error;

      // Fetch profile names separately (usuario_id references auth.users, not perfis directly)
      const userIds = [...new Set((data || []).map((n: any) => n.usuario_id).filter(Boolean))];
      const profileMap: Record<string, { nome_completo: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis")
          .select("id, nome_completo, avatar_url")
          .in("id", userIds);
        (perfis || []).forEach((p: any) => {
          profileMap[p.id] = { nome_completo: p.nome_completo, avatar_url: p.avatar_url };
        });
      }

      return (data || []).map((n: any) => ({
        ...n,
        perfis: profileMap[n.usuario_id] || null,
      })) as Nota[];
    },
    enabled: !!leadId,
  });

  // ── Mutations ─────────────────────────────────────────────

  const adicionarNota = useMutation({
    mutationFn: async () => {
      if (!novoConteudo.trim()) throw new Error("Conteúdo é obrigatório");
      setSalvando(true);
      const { error } = await supabase.from("lead_notas").insert({
        lead_id: leadId,
        organization_id: organizationId,
        usuario_id: profile?.id,
        conteudo: novoConteudo.trim(),
        tipo: novoTipo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoConteudo("");
      setNovoTipo("manual");
      queryClient.invalidateQueries({ queryKey: ["lead-notas", leadId] });
      toast.success("Nota adicionada");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar nota"),
    onSettled: () => setSalvando(false),
  });

  const editarNota = useMutation({
    mutationFn: async ({ id, conteudo }: { id: string; conteudo: string }) => {
      const { error } = await supabase
        .from("lead_notas")
        .update({ conteudo, editado: true, atualizado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingText("");
      queryClient.invalidateQueries({ queryKey: ["lead-notas", leadId] });
      toast.success("Nota editada");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao editar"),
  });

  const excluirNota = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_notas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["lead-notas", leadId] });
      toast.success("Nota excluída");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir"),
  });

  // ── Helpers ───────────────────────────────────────────────

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  };

  const getTipo = (tipo: string) => TIPOS[tipo as TipoNota] || TIPOS.manual;

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        📝 Notas ({notas.length})
      </h3>

      {/* Nova nota */}
      <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex gap-2">
          <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as TipoNota)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_MANUAIS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={novoConteudo}
          onChange={(e) => setNovoConteudo(e.target.value)}
          placeholder="Adicionar uma nota..."
          rows={3}
          className="text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) adicionarNota.mutate();
          }}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => adicionarNota.mutate()}
            disabled={salvando || !novoConteudo.trim()}
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar nota
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Lista de notas */}
      {!isLoading && notas.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhuma nota registrada para este lead.
        </p>
      )}

      <div className="space-y-2">
        {notas.map((nota) => {
          const tipo = getTipo(nota.tipo);
          const TipoIcon = tipo.icon;
          const isMeta = nota.tipo === "formulario_meta";
          const isEditing = editingId === nota.id;
          const isDeleting = deletingId === nota.id;

          return (
            <div
              key={nota.id}
              className={cn(
                "rounded-lg border p-3 transition-all",
                isMeta ? "border-l-4 border-l-orange-400 border-orange-200 bg-orange-50/50" : "border-border bg-background",
              )}
            >
              {/* Header da nota */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0">
                    {nota.perfis?.avatar_url && <AvatarImage src={nota.perfis.avatar_url} />}
                    <AvatarFallback className="text-[10px] bg-muted">
                      {getInitials(nota.perfis?.nome_completo || null)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground truncate">
                    {nota.perfis?.nome_completo || "Sistema"}
                  </span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1 shrink-0", tipo.bg, tipo.border, tipo.color)}>
                    <TipoIcon className="h-3 w-3" />
                    {tipo.label}
                  </Badge>
                  {isMeta && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-orange-500 hover:bg-orange-600 text-white shrink-0">
                      Meta Lead Ads
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(nota.criado_em), { addSuffix: true, locale: ptBR })}
                    {nota.editado && " (editado)"}
                  </span>
                  {!isEditing && !isDeleting && nota.usuario_id === profile?.id && (
                    <>
                      <button
                        onClick={() => { setEditingId(nota.id); setEditingText(nota.conteudo); }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDeletingId(nota.id)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Conteúdo */}
              {isEditing ? (
                <div className="space-y-2 mt-2">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 gap-1"
                      onClick={() => { setEditingId(null); setEditingText(""); }}
                    >
                      <X className="h-3 w-3" /> Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => editarNota.mutate({ id: nota.id, conteudo: editingText })}
                      disabled={!editingText.trim() || editarNota.isPending}
                    >
                      {editarNota.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                  {nota.conteudo}
                </p>
              )}

              {/* Confirmação de exclusão */}
              {isDeleting && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                  <span className="text-xs text-destructive font-medium">Excluir esta nota?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs h-6 px-2"
                    onClick={() => excluirNota.mutate(nota.id)}
                    disabled={excluirNota.isPending}
                  >
                    {excluirNota.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sim"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-6 px-2"
                    onClick={() => setDeletingId(null)}
                  >
                    Não
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
