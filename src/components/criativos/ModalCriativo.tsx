import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  X, ChevronLeft, ChevronRight, Download, Edit2, Trash2,
  FolderOpen, ChevronRightIcon, Home, Loader2, Send,
  Image, Film, StickyNote, Calendar, Ruler, HardDrive,
  Tag, Pin, ExternalLink, Save,
} from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

// ── Status ──────────────────────────────────────────────────

const STATUS_LIST = [
  { value: "em_criacao", label: "Em Criacao", color: "#6b7280" },
  { value: "em_revisao", label: "Em Revisao", color: "#f59e0b" },
  { value: "aprovado", label: "Aprovado", color: "#3b82f6" },
  { value: "ativo", label: "Ativo", color: "#22c55e" },
  { value: "em_teste", label: "Em Teste", color: "#8b5cf6" },
  { value: "pausado", label: "Pausado", color: "#f97316" },
  { value: "arquivado", label: "Arquivado", color: "#fca5a5" },
] as const;

const STATUS_MAP = Object.fromEntries(STATUS_LIST.map((s) => [s.value, s]));

// ── Types ───────────────────────────────────────────────────

interface Criativo {
  id: string;
  organization_id: string;
  pasta_id: string | null;
  nome: string;
  tipo: string | null;
  url_arquivo: string;
  url_thumbnail: string | null;
  storage_path: string | null;
  tamanho_bytes: number | null;
  largura: number | null;
  altura: number | null;
  duracao_segundos: number | null;
  descricao: string | null;
  notas: string | null;
  tags: string[] | null;
  status: string;
  meta_ad_id: string | null;
  data_inicio_veiculacao: string | null;
  data_fim_veiculacao: string | null;
  ordem: number;
  fixado: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface Nota {
  id: string;
  criativo_id: string;
  organization_id: string;
  usuario_id: string;
  conteudo: string;
  criado_em: string;
  atualizado_em: string;
  perfil?: { nome_completo: string | null } | null;
}

interface BreadcrumbItem { id: string | null; nome: string; }

export interface ModalCriativoProps {
  criativoId: string;
  pastaId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

// ── Helpers ─────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status];
  if (!s) return null;
  return (
    <Badge className={cn("text-white text-[10px] font-semibold border-none", status === "ativo" && "animate-pulse")} style={{ backgroundColor: s.color }}>
      {s.label}
    </Badge>
  );
}

// ── Component ───────────────────────────────────────────────

export default function ModalCriativo({ criativoId, pastaId, isOpen, onClose, onUpdate }: ModalCriativoProps) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // UI state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [novaNota, setNovaNota] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [descricaoLocal, setDescricaoLocal] = useState("");
  const [statusLocal, setStatusLocal] = useState("");

  // Edit form
  const [editNome, setEditNome] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editStatus, setEditStatus] = useState("em_criacao");
  const [editTags, setEditTags] = useState("");
  const [editDataInicio, setEditDataInicio] = useState("");
  const [editDataFim, setEditDataFim] = useState("");
  const [editFixado, setEditFixado] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ── Queries ───────────────────────────────────────────────

  const { data: criativo, isLoading } = useQuery({
    queryKey: ["criativo-detalhe", criativoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativo_biblioteca")
        .select("*")
        .eq("id", criativoId)
        .single();
      if (error) throw error;
      return data as Criativo;
    },
    enabled: isOpen && !!criativoId,
  });

  // Siblings for navigation
  const { data: siblings = [] } = useQuery({
    queryKey: ["criativos-siblings", pastaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("criativo_biblioteca")
        .select("id, nome, url_arquivo, tipo, url_thumbnail")
        .eq("pasta_id", pastaId)
        .order("fixado", { ascending: false })
        .order("criado_em", { ascending: false });
      return data || [];
    },
    enabled: isOpen && !!pastaId,
  });

  // Breadcrumb
  const { data: breadcrumb = [] } = useQuery({
    queryKey: ["criativo-breadcrumb", pastaId],
    queryFn: async () => {
      const crumbs: BreadcrumbItem[] = [];
      let currentId: string | null = pastaId;
      while (currentId) {
        const { data } = await supabase
          .from("criativo_pastas")
          .select("id, nome, pasta_pai_id")
          .eq("id", currentId)
          .single();
        if (!data) break;
        crumbs.unshift({ id: data.id, nome: data.nome });
        currentId = data.pasta_pai_id;
      }
      return crumbs;
    },
    enabled: isOpen && !!pastaId,
  });

  // Notas
  const { data: notas = [], refetch: refetchNotas } = useQuery({
    queryKey: ["criativo-notas", criativoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativo_notas")
        .select("*")
        .eq("criativo_id", criativoId)
        .order("criado_em", { ascending: false });
      if (error) throw error;

      // Fetch profile names for each unique usuario_id
      const userIds = [...new Set((data || []).map((n: any) => n.usuario_id).filter(Boolean))];
      const profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis")
          .select("id, nome_completo")
          .in("id", userIds);
        (perfis || []).forEach((p: any) => { profileMap[p.id] = p.nome_completo || "Usuario"; });
      }

      return (data || []).map((n: any) => ({
        ...n,
        perfil: { nome_completo: profileMap[n.usuario_id] || null },
      })) as Nota[];
    },
    enabled: isOpen && !!criativoId,
  });

  // ── Sync local state ─────────────────────────────────────

  useEffect(() => {
    if (criativo) {
      setDescricaoLocal(criativo.descricao || "");
      setStatusLocal(criativo.status);
    }
  }, [criativo]);

  // ── Debounced description save ────────────────────────────

  const salvarDescricao = useCallback(async (desc: string) => {
    if (!criativoId) return;
    await supabase
      .from("criativo_biblioteca")
      .update({ descricao: desc || null, atualizado_em: new Date().toISOString() })
      .eq("id", criativoId);
    queryClient.invalidateQueries({ queryKey: ["criativo-detalhe", criativoId] });
  }, [criativoId, queryClient]);

  function handleDescricaoChange(val: string) {
    setDescricaoLocal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => salvarDescricao(val), 1000);
  }

  // ── Status change ─────────────────────────────────────────

  async function handleStatusChange(newStatus: string) {
    setStatusLocal(newStatus);
    await supabase
      .from("criativo_biblioteca")
      .update({ status: newStatus, atualizado_em: new Date().toISOString() })
      .eq("id", criativoId);
    queryClient.invalidateQueries({ queryKey: ["criativo-detalhe", criativoId] });
    onUpdate();
  }

  // ── Nota mutations ────────────────────────────────────────

  async function adicionarNota() {
    if (!novaNota.trim() || !orgId || !profile?.id) return;
    setSalvandoNota(true);
    const { error } = await supabase.from("criativo_notas").insert({
      criativo_id: criativoId,
      organization_id: orgId,
      usuario_id: profile.id,
      conteudo: novaNota.trim(),
    });
    setSalvandoNota(false);
    if (error) { toast.error("Erro ao salvar nota"); return; }
    setNovaNota("");
    refetchNotas();
  }

  async function excluirNota(notaId: string) {
    await supabase.from("criativo_notas").delete().eq("id", notaId);
    refetchNotas();
  }

  // ── Delete criativo ───────────────────────────────────────

  const excluirCriativo = useMutation({
    mutationFn: async () => {
      if (criativo?.storage_path) {
        await supabase.storage.from("criativos-biblioteca").remove([criativo.storage_path]);
      }
      const { error } = await supabase.from("criativo_biblioteca").delete().eq("id", criativoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Criativo excluido!");
      onUpdate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Edit modal ────────────────────────────────────────────

  function abrirEdit() {
    if (!criativo) return;
    setEditNome(criativo.nome);
    setEditDescricao(criativo.descricao || "");
    setEditStatus(criativo.status);
    setEditTags((criativo.tags || []).join(", "));
    setEditDataInicio(criativo.data_inicio_veiculacao || "");
    setEditDataFim(criativo.data_fim_veiculacao || "");
    setEditFixado(criativo.fixado);
    setShowEditModal(true);
  }

  async function salvarEdit() {
    setEditSaving(true);
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase
      .from("criativo_biblioteca")
      .update({
        nome: editNome.trim(),
        descricao: editDescricao.trim() || null,
        status: editStatus,
        tags: tags.length > 0 ? tags : null,
        data_inicio_veiculacao: editDataInicio || null,
        data_fim_veiculacao: editDataFim || null,
        fixado: editFixado,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", criativoId);
    setEditSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Criativo atualizado!");
    setShowEditModal(false);
    queryClient.invalidateQueries({ queryKey: ["criativo-detalhe", criativoId] });
    onUpdate();
  }

  // ── Navigation ────────────────────────────────────────────

  const currentIndex = siblings.findIndex((s: any) => s.id === criativoId);
  const prevSibling = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextSibling = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  function navigateTo(id: string) {
    queryClient.invalidateQueries({ queryKey: ["criativo-detalhe", id] });
    queryClient.invalidateQueries({ queryKey: ["criativo-notas", id] });
    // We pass the new id by closing and re-opening — but simpler to just update the query key
    // Since we can't change props, we'll use a workaround: invalidate and let parent handle
    // For now, navigate by closing and callback
    onClose();
    // Parent will re-open with new id
    setTimeout(() => {
      const event = new CustomEvent("criativo-navigate", { detail: { id, pastaId } });
      window.dispatchEvent(event);
    }, 100);
  }

  // ── Download ──────────────────────────────────────────────

  function handleDownload() {
    if (!criativo) return;
    const a = document.createElement("a");
    a.href = criativo.url_arquivo;
    a.download = criativo.nome;
    a.target = "_blank";
    a.click();
  }

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-hidden p-0 [&>button.absolute]:hidden">
          {isLoading || !criativo ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row h-[85vh] lg:h-[80vh]">

              {/* ── Left: Preview ── */}
              <div className="flex-1 flex flex-col bg-muted/20 min-w-0 relative">
                {/* Nav arrows */}
                {prevSibling && (
                  <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-all"
                    onClick={() => navigateTo((prevSibling as any).id)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {nextSibling && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-all"
                    onClick={() => navigateTo((nextSibling as any).id)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}

                {/* Main preview */}
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                  {criativo.tipo === "video" ? (
                    <video
                      src={criativo.url_arquivo}
                      controls
                      className="max-w-full max-h-full rounded-lg shadow-lg"
                    />
                  ) : (
                    <img
                      src={criativo.url_arquivo}
                      alt={criativo.nome}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg hover:scale-[1.02] transition-transform cursor-zoom-in"
                    />
                  )}
                </div>

                {/* Thumbnail strip */}
                {siblings.length > 1 && (
                  <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
                    {siblings.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => s.id !== criativoId && navigateTo(s.id)}
                        className={cn(
                          "w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                          s.id === criativoId ? "border-primary ring-1 ring-primary" : "border-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        {s.tipo === "video" ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Film className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : (
                          <img src={s.url_arquivo} alt="" className="w-full h-full object-cover" loading="lazy" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Download button */}
                <div className="absolute top-3 right-3">
                  <Button size="sm" variant="secondary" className="gap-1.5 text-xs shadow-md" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>

              {/* ── Right: Info panel ── */}
              <div className="w-full lg:w-[380px] border-l border-border flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                  <div className="p-5 space-y-5">

                    {/* Close button */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {currentIndex + 1} de {siblings.length}
                      </span>
                      <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* ── Info block ── */}
                    <div className="space-y-3">
                      <h2 className="text-lg font-bold text-foreground leading-tight break-words">{criativo.nome}</h2>

                      {/* Status inline edit */}
                      <div className="flex items-center gap-2">
                        <Select value={statusLocal} onValueChange={handleStatusChange}>
                          <SelectTrigger className="h-7 w-auto text-xs gap-1 border-none shadow-none px-0 font-medium">
                            <StatusBadge status={statusLocal} />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_LIST.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                  {s.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {criativo.fixado && <Pin className="h-3 w-3 text-primary fill-primary" />}
                      </div>

                      {/* Breadcrumb */}
                      <nav className="flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground">
                        <Home className="h-3 w-3" />
                        {breadcrumb.map((c, i) => (
                          <span key={c.id} className="flex items-center gap-1">
                            <ChevronRightIcon className="h-2.5 w-2.5" />
                            <span>{c.nome}</span>
                          </span>
                        ))}
                      </nav>

                      {/* Metadata grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {criativo.tipo === "video" ? <Film className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                          <span className="capitalize">{criativo.tipo || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Ruler className="h-3 w-3" />
                          {criativo.largura && criativo.altura ? `${criativo.largura}x${criativo.altura}` : "—"}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <HardDrive className="h-3 w-3" />
                          {fmtSize(criativo.tamanho_bytes)}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(criativo.criado_em), "dd/MM/yy", { locale: ptBR })}
                        </div>
                        {criativo.duracao_segundos && (
                          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                            <Film className="h-3 w-3" />
                            {Math.floor(criativo.duracao_segundos / 60)}:{String(criativo.duracao_segundos % 60).padStart(2, "0")}
                          </div>
                        )}
                      </div>

                      {/* Veiculacao */}
                      {(criativo.data_inicio_veiculacao || criativo.data_fim_veiculacao) && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Veiculacao:</span>{" "}
                          {criativo.data_inicio_veiculacao ? format(parseISO(criativo.data_inicio_veiculacao), "dd/MM/yyyy") : "—"}{" "}
                          {criativo.data_fim_veiculacao && `ate ${format(parseISO(criativo.data_fim_veiculacao), "dd/MM/yyyy")}`}
                        </div>
                      )}

                      {/* Tags */}
                      {criativo.tags && criativo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {criativo.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                              <Tag className="h-2.5 w-2.5 mr-0.5" />{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── Description block ── */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Descricao</Label>
                      <Textarea
                        value={descricaoLocal}
                        onChange={(e) => handleDescricaoChange(e.target.value)}
                        placeholder="Adicionar descricao..."
                        rows={3}
                        className="mt-1.5 text-sm resize-none"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Salva automaticamente</p>
                    </div>

                    {/* ── Meta Ads link ── */}
                    {criativo.meta_ad_id && (
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/60">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1.5">Meta Ads</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-foreground truncate">{criativo.meta_ad_id}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => window.open("/crm/marketing-trafego", "_blank")}>
                            <ExternalLink className="h-3 w-3" /> Ver anuncio
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* ── Notes block ── */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5">
                        <StickyNote className="h-3 w-3" /> Notas ({notas.length})
                      </Label>

                      {/* Notes feed */}
                      <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                        {notas.length === 0 && (
                          <p className="text-xs text-muted-foreground/60 py-2">Nenhuma nota</p>
                        )}
                        {notas.map((nota) => {
                          const nomeUsuario = (nota.perfil as any)?.nome_completo || "Usuario";
                          const initials = nomeUsuario.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                          const isOwner = nota.usuario_id === profile?.id;
                          return (
                            <div key={nota.id} className="flex gap-2 group">
                              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs font-medium text-foreground">{nomeUsuario}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(parseISO(nota.criado_em), "dd/MM HH:mm")}
                                  </span>
                                </div>
                                <p className="text-xs text-foreground/80 mt-0.5 break-words">{nota.conteudo}</p>
                              </div>
                              {isOwner && (
                                <button
                                  onClick={() => excluirNota(nota.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add note */}
                      <div className="flex gap-2 mt-3">
                        <Textarea
                          value={novaNota}
                          onChange={(e) => setNovaNota(e.target.value)}
                          placeholder="Adicionar nota..."
                          rows={2}
                          className="text-sm resize-none flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) adicionarNota();
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-auto px-3 self-end"
                          onClick={adicionarNota}
                          disabled={salvandoNota || !novaNota.trim()}
                        >
                          {salvandoNota ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Footer actions ── */}
                <div className="border-t border-border p-3 flex items-center gap-2 bg-background shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={abrirEdit}>
                    <Edit2 className="h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive flex-1" onClick={() => setShowDeleteAlert(true)}>
                    <Trash2 className="h-3 w-3" /> Excluir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit modal ── */}
      <Dialog open={showEditModal} onOpenChange={(o) => !o && setShowEditModal(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="space-y-4 py-2">
            <h3 className="text-lg font-bold">Editar Criativo</h3>
            <div>
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_LIST.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags (separadas por virgula)</Label>
                <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="tag1, tag2" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inicio veiculacao</Label>
                <Input type="date" value={editDataInicio} onChange={(e) => setEditDataInicio(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Fim veiculacao</Label>
                <Input type="date" value={editDataFim} onChange={(e) => setEditDataFim(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="edit-fixar" checked={editFixado} onCheckedChange={(c) => setEditFixado(!!c)} />
              <Label htmlFor="edit-fixar" className="cursor-pointer text-sm">Fixar no topo</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={salvarEdit} disabled={editSaving || !editNome.trim()}>
              {editSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete alert ── */}
      <AlertDialog open={showDeleteAlert} onOpenChange={(o) => !o && setShowDeleteAlert(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{criativo?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>O arquivo sera removido permanentemente do storage e do banco.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => excluirCriativo.mutate()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
