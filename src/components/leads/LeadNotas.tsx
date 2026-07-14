import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  StickyNote, Phone, CalendarDays, Bot, ClipboardList,
  Pencil, Trash2, Loader2, Send, X, FileText, Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

// ── Tipo config ─────────────────────────────────────────────

const TIPOS = {
  manual:          { label: "Manual",        icon: StickyNote,    color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200/60" },
  formulario_meta: { label: "Meta Lead Ads", icon: ClipboardList, color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200/60" },
  sistema:         { label: "Sistema",       icon: Bot,           color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border/40" },
  os:              { label: "OS",            icon: Sparkles,      color: "text-purple-600",       bg: "bg-purple-50", border: "border-purple-200/60" },
  reuniao:         { label: "Reunião",       icon: CalendarDays,  color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200/60" },
  ligacao:         { label: "Ligação",       icon: Phone,         color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200/60" },
} as const;

type TipoNota = keyof typeof TIPOS;

const TIPOS_MANUAIS: { value: TipoNota; label: string; icon: any }[] = [
  { value: "manual",  label: "Manual",  icon: StickyNote },
  { value: "reuniao", label: "Reunião", icon: CalendarDays },
  { value: "ligacao", label: "Ligação", icon: Phone },
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-muted">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Notas
        </span>
        {notas.length > 0 && (
          <span className="text-[10px] font-bold font-display tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
            {notas.length}
          </span>
        )}
      </div>

      {/* Nova nota */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] focus-within:border-foreground/30 transition-colors">
        <Textarea
          value={novoConteudo}
          onChange={(e) => setNovoConteudo(e.target.value)}
          placeholder="Escreva uma observação, o resumo de uma ligação ou reunião..."
          rows={2}
          className="text-[13px] resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent px-4 pt-3.5 min-h-[60px] placeholder:text-muted-foreground/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) adicionarNota.mutate();
          }}
        />
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-border/40 bg-muted/20">
          {/* Seletor de tipo */}
          <div className="flex items-center gap-1">
            {TIPOS_MANUAIS.map((t) => {
              const TIcon = t.icon;
              const active = novoTipo === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNovoTipo(t.value)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors",
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <TIcon className="h-3 w-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline text-[10px] text-muted-foreground/40">Ctrl+Enter</span>
            <Button
              size="sm"
              className="h-7 rounded-lg text-[11px] font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-3.5"
              onClick={() => adicionarNota.mutate()}
              disabled={salvando || !novoConteudo.trim()}
            >
              {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && notas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <StickyNote className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma nota ainda</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Registre observações, ligações e reuniões deste lead</p>
        </div>
      )}

      {/* Lista de notas */}
      <div className="space-y-2">
        {notas.map((nota) => {
          const tipo = getTipo(nota.tipo);
          const TipoIcon = tipo.icon;
          const isMeta = nota.tipo === "formulario_meta";
          const isEditing = editingId === nota.id;
          const isDeleting = deletingId === nota.id;
          const isOwner = nota.usuario_id === profile?.id;
          // Notas geradas pela plataforma não têm autor humano — chip com ícone
          const isAuto = nota.tipo === "sistema" || nota.tipo === "formulario_meta" || nota.tipo === "os";
          const authorName = nota.perfis?.nome_completo || (isAuto ? tipo.label : "Usuário");

          return (
            <div
              key={nota.id}
              className={cn(
                "rounded-xl border bg-card p-3.5 transition-all group",
                isMeta
                  ? "border-amber-200/60 bg-amber-50/20"
                  : "border-border/50 hover:border-border",
              )}
            >
              {/* Header da nota */}
              <div className="flex items-start gap-2.5">
                {/* Chip: ícone (automático) ou iniciais (pessoa) */}
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border", tipo.bg, tipo.border)}>
                  {isAuto
                    ? <TipoIcon className={cn("h-4 w-4", tipo.color)} />
                    : <span className={cn("text-[11px] font-bold", tipo.color)}>{getInitials(nota.perfis?.nome_completo || null)}</span>
                  }
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-foreground truncate">{authorName}</span>
                    {/* Badge de tipo só para notas de pessoas — nas automáticas o nome já é o tipo */}
                    {!isAuto && (
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border",
                        tipo.bg, tipo.border, tipo.color
                      )}>
                        <TipoIcon className="h-2.5 w-2.5" />
                        {tipo.label}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {formatDistanceToNow(new Date(nota.criado_em), { addSuffix: true, locale: ptBR })}
                    {nota.editado && " · editado"}
                  </span>
                </div>

                {/* Ações (só do autor, notas manuais) */}
                {!isEditing && !isDeleting && isOwner && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => { setEditingId(nota.id); setEditingText(nota.conteudo); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeletingId(nota.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Conteúdo */}
              {isEditing ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={3}
                    className="text-[12.5px] resize-none rounded-lg border-border/60"
                    autoFocus
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[11px] h-7 gap-1 text-muted-foreground"
                      onClick={() => { setEditingId(null); setEditingText(""); }}
                    >
                      <X className="h-3 w-3" /> Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="text-[11px] h-7 gap-1 bg-foreground text-background hover:bg-foreground/90 rounded-lg px-3"
                      onClick={() => editarNota.mutate({ id: nota.id, conteudo: editingText })}
                      disabled={!editingText.trim() || editarNota.isPending}
                    >
                      {editarNota.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2.5 pl-[42px] text-[12.5px] text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                  {nota.conteudo}
                </p>
              )}

              {/* Confirmação de exclusão */}
              {isDeleting && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                  <span className="text-[11px] text-destructive font-medium">Excluir esta nota?</span>
                  <div className="flex gap-1 ml-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[11px] h-7 px-2.5"
                      onClick={() => setDeletingId(null)}
                    >
                      Não
                    </Button>
                    <Button
                      size="sm"
                      className="text-[11px] h-7 px-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-lg"
                      onClick={() => excluirNota.mutate(nota.id)}
                      disabled={excluirNota.isPending}
                    >
                      {excluirNota.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sim, excluir"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
