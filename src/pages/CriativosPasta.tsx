import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  FolderOpen, FolderPlus, Upload, Search, ChevronRight, Home,
  ArrowUp, Edit2, Trash2, Pin, LayoutGrid, List, Filter,
  Loader2, X, Play, Image, Film, FileText, MessageSquare,
  Eye, MoreHorizontal, StickyNote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import ModalCriativo from "@/components/criativos/ModalCriativo";
import { PageHero } from "@/components/PageHero";

// ── Status config ──────────────────────────────────────────

const STATUS_LIST = [
  { value: "em_criacao", label: "Em Criação", color: "#6b7280" },
  { value: "em_revisao", label: "Em Revisão", color: "#f59e0b" },
  { value: "aprovado", label: "Aprovado", color: "#3b82f6" },
  { value: "ativo", label: "Ativo", color: "#22c55e" },
  { value: "em_teste", label: "Em Teste", color: "#8b5cf6" },
  { value: "pausado", label: "Pausado", color: "#f97316" },
  { value: "arquivado", label: "Arquivado", color: "#fca5a5" },
] as const;

const STATUS_MAP = Object.fromEntries(STATUS_LIST.map((s) => [s.value, s]));

const CORES_PASTA = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7",
];

const ACCEPTED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime", "video/avi", "video/webm",
];
const MAX_FILE_SIZE = 52428800; // 50MB

// ── Types ──────────────────────────────────────────────────

interface Pasta {
  id: string;
  organization_id: string;
  pasta_pai_id: string | null;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  status: string;
  data_inicio_veiculacao: string | null;
  data_fim_veiculacao: string | null;
  ordem: number;
  fixado: boolean;
  criado_em: string;
  atualizado_em: string;
  criativo_biblioteca: { count: number }[];
}

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
  criativo_notas: { count: number }[];
}

interface BreadcrumbItem { id: string | null; nome: string; }

interface UploadItem {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

type TipoFilter = "todos" | "imagem" | "video" | "gif";

// ── Helpers ────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function getFileType(mime: string): "imagem" | "video" | "gif" {
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("video/")) return "video";
  return "imagem";
}

function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = URL.createObjectURL(file);
  });
}

function getVideoDimensions(file: File): Promise<{ w: number; h: number; dur: number }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({ w: video.videoWidth, h: video.videoHeight, dur: Math.round(video.duration) });
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve({ w: 0, h: 0, dur: 0 });
    video.src = URL.createObjectURL(file);
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status];
  if (!s) return null;
  return (
    <Badge
      className={cn("text-white text-[10px] font-semibold border-none", status === "ativo" && "animate-pulse")}
      style={{ backgroundColor: s.color }}
    >
      {s.label}
    </Badge>
  );
}

// ── Component ──────────────────────────────────────────────

export default function CriativosPasta() {
  const { pastaId } = useParams<{ pastaId: string }>();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!pastaId) { navigate("/crm/criativos"); return null; }

  // UI state
  const [viewMode, setViewMode] = useState<"grid" | "lista">("grid");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoFilter>("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Upload state
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  // Modal states
  const [modalSubpasta, setModalSubpasta] = useState(false);
  const [modalEditPasta, setModalEditPasta] = useState(false);
  const [deletingPasta, setDeletingPasta] = useState(false);
  const [modalCriativoId, setModalCriativoId] = useState<string | null>(null);
  const [deletingCriativo, setDeletingCriativo] = useState<Criativo | null>(null);

  // Listen for criativo navigation events from ModalCriativo
  useEffect(() => {
    function handleNavigate(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) setModalCriativoId(detail.id);
    }
    window.addEventListener("criativo-navigate", handleNavigate);
    return () => window.removeEventListener("criativo-navigate", handleNavigate);
  }, []);

  // Subpasta form
  const [spNome, setSpNome] = useState("");
  const [spDescricao, setSpDescricao] = useState("");
  const [spStatus, setSpStatus] = useState("em_criacao");
  const [spCor, setSpCor] = useState("#3b82f6");
  const [spSaving, setSpSaving] = useState(false);

  // Edit pasta form
  const [epNome, setEpNome] = useState("");
  const [epDescricao, setEpDescricao] = useState("");
  const [epStatus, setEpStatus] = useState("em_criacao");
  const [epCor, setEpCor] = useState("#3b82f6");
  const [epDataInicio, setEpDataInicio] = useState("");
  const [epDataFim, setEpDataFim] = useState("");
  const [epFixado, setEpFixado] = useState(false);
  const [epSaving, setEpSaving] = useState(false);

  // ── Queries ─────────────────────────────────────────────

  // Pasta atual
  const { data: pastaAtual, isLoading: loadingPasta } = useQuery({
    queryKey: ["pasta-atual", pastaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativo_pastas")
        .select("*")
        .eq("id", pastaId)
        .single();
      if (error) throw error;
      return data as Pasta;
    },
    enabled: !!pastaId,
  });

  // Breadcrumb
  const { data: breadcrumb = [] } = useQuery({
    queryKey: ["criativo-breadcrumb", pastaId],
    queryFn: async () => {
      const crumbs: BreadcrumbItem[] = [];
      let currentId: string | null = pastaId!;
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
    enabled: !!pastaId,
  });

  // Subpastas
  const { data: subpastas = [] } = useQuery({
    queryKey: ["criativo-pastas", orgId, pastaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativo_pastas")
        .select("*, criativo_biblioteca(count)")
        .eq("organization_id", orgId!)
        .eq("pasta_pai_id", pastaId)
        .order("fixado", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as Pasta[];
    },
    enabled: !!orgId,
  });

  // Criativos
  const { data: criativos = [], isLoading: loadingCriativos } = useQuery({
    queryKey: ["criativos", pastaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativo_biblioteca")
        .select("*, criativo_notas(count)")
        .eq("pasta_id", pastaId)
        .order("fixado", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as Criativo[];
    },
    enabled: !!pastaId,
  });

  // ── Filtered criativos ────────────────────────────────────

  const criativosFiltrados = useMemo(() => {
    let result = [...criativos];
    if (busca.trim()) {
      const q = busca.toLowerCase();
      result = result.filter((c) => c.nome.toLowerCase().includes(q) || (c.descricao && c.descricao.toLowerCase().includes(q)));
    }
    if (filtroTipo !== "todos") result = result.filter((c) => c.tipo === filtroTipo);
    if (filtroStatus !== "todos") result = result.filter((c) => c.status === filtroStatus);
    return result;
  }, [criativos, busca, filtroTipo, filtroStatus]);

  // ── Upload logic ──────────────────────────────────────────

  const processUpload = useCallback(async (files: File[]) => {
    if (!orgId || !pastaId) return;

    const validFiles = files.filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) { toast.error(`Tipo não suportado: ${f.name}`); return false; }
      if (f.size > MAX_FILE_SIZE) { toast.error(`Arquivo muito grande: ${f.name} (max 50MB)`); return false; }
      return true;
    });

    if (validFiles.length === 0) return;

    const items: UploadItem[] = validFiles.map((f) => ({ file: f, progress: 0, status: "pending" as const }));
    setUploads(items);
    setUploading(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, status: "uploading", progress: 10 } : u));

      try {
        const ext = item.file.name.split(".").pop() || "bin";
        const uuid = crypto.randomUUID();
        const storagePath = `${orgId}/${pastaId}/${uuid}.${ext}`;

        // Upload to storage
        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, progress: 30 } : u));
        const { error: uploadError } = await supabase.storage
          .from("criativos-biblioteca")
          .upload(storagePath, item.file, { contentType: item.file.type, upsert: false });
        if (uploadError) throw uploadError;

        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, progress: 60 } : u));

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("criativos-biblioteca")
          .getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        // Get dimensions
        const tipo = getFileType(item.file.type);
        let largura = 0, altura = 0, duracao = 0;

        if (tipo === "imagem" || tipo === "gif") {
          const dims = await getImageDimensions(item.file);
          largura = dims.w; altura = dims.h;
        } else if (tipo === "video") {
          const dims = await getVideoDimensions(item.file);
          largura = dims.w; altura = dims.h; duracao = dims.dur;
        }

        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, progress: 80 } : u));

        // Insert record
        const { error: insertError } = await supabase
          .from("criativo_biblioteca")
          .insert({
            organization_id: orgId,
            pasta_id: pastaId,
            nome: item.file.name,
            tipo,
            url_arquivo: publicUrl,
            storage_path: storagePath,
            tamanho_bytes: item.file.size,
            largura: largura || null,
            altura: altura || null,
            duracao_segundos: duracao || null,
            status: "em_criacao",
          });
        if (insertError) throw insertError;

        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, progress: 100, status: "done" } : u));
      } catch (err: any) {
        setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, status: "error", error: err.message } : u));
      }
    }

    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ["criativos", pastaId] });
    queryClient.invalidateQueries({ queryKey: ["criativo-pastas"] });
    queryClient.invalidateQueries({ queryKey: ["criativo-hierarquia"] });

    setTimeout(() => setUploads([]), 3000);
  }, [orgId, pastaId, queryClient]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processUpload(files);
  }, [processUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processUpload(files);
    e.target.value = "";
  }, [processUpload]);

  // ── Mutations ─────────────────────────────────────────────

  const criarSubpasta = useMutation({
    mutationFn: async () => {
      if (!spNome.trim()) throw new Error("Nome obrigatorio");
      const { error } = await supabase.from("criativo_pastas").insert({
        organization_id: orgId,
        pasta_pai_id: pastaId,
        nome: spNome.trim(),
        descricao: spDescricao.trim() || null,
        status: spStatus,
        cor: spCor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subpasta criada!");
      queryClient.invalidateQueries({ queryKey: ["criativo-pastas"] });
      setModalSubpasta(false);
      setSpNome(""); setSpDescricao(""); setSpStatus("em_criacao"); setSpCor("#3b82f6");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const editarPastaAtual = useMutation({
    mutationFn: async () => {
      if (!epNome.trim()) throw new Error("Nome obrigatorio");
      const { error } = await supabase.from("criativo_pastas").update({
        nome: epNome.trim(),
        descricao: epDescricao.trim() || null,
        status: epStatus,
        cor: epCor,
        data_inicio_veiculacao: epDataInicio || null,
        data_fim_veiculacao: epDataFim || null,
        fixado: epFixado,
        atualizado_em: new Date().toISOString(),
      }).eq("id", pastaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta atualizada!");
      queryClient.invalidateQueries({ queryKey: ["pasta-atual", pastaId] });
      queryClient.invalidateQueries({ queryKey: ["criativo-pastas"] });
      queryClient.invalidateQueries({ queryKey: ["criativo-breadcrumb"] });
      setModalEditPasta(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const excluirPastaAtual = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("criativo_pastas").delete().eq("id", pastaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta excluida!");
      const parentId = pastaAtual?.pasta_pai_id;
      navigate(parentId ? `/crm/criativos/${parentId}` : "/crm/criativos");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const excluirCriativo = useMutation({
    mutationFn: async (criativo: Criativo) => {
      // Delete from storage first
      if (criativo.storage_path) {
        await supabase.storage.from("criativos-biblioteca").remove([criativo.storage_path]);
      }
      const { error } = await supabase.from("criativo_biblioteca").delete().eq("id", criativo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Criativo excluido!");
      queryClient.invalidateQueries({ queryKey: ["criativos", pastaId] });
      setDeletingCriativo(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Open edit pasta modal ─────────────────────────────────

  function abrirEditPasta() {
    if (!pastaAtual) return;
    setEpNome(pastaAtual.nome);
    setEpDescricao(pastaAtual.descricao || "");
    setEpStatus(pastaAtual.status);
    setEpCor(pastaAtual.cor);
    setEpDataInicio(pastaAtual.data_inicio_veiculacao || "");
    setEpDataFim(pastaAtual.data_fim_veiculacao || "");
    setEpFixado(pastaAtual.fixado);
    setModalEditPasta(true);
  }

  // ── Loading ───────────────────────────────────────────────

  if (loadingPasta) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!pastaAtual) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Pasta não encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/crm/criativos")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <PageHero
          icon={FolderOpen}
          title={
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: pastaAtual.cor }} />
              {pastaAtual.nome}
              {pastaAtual.fixado && <Pin className="h-4 w-4 text-white/70 fill-white/70" />}
            </span>
          }
          subtitle={pastaAtual.descricao || undefined}
          right={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4"
                onClick={() => {
                  const parentId = pastaAtual.pasta_pai_id;
                  navigate(parentId ? `/crm/criativos/${parentId}` : "/crm/criativos");
                }}
              >
                <ArrowUp className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button
                className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4"
                onClick={() => { setSpNome(""); setSpDescricao(""); setSpStatus("em_criacao"); setSpCor("#3b82f6"); setModalSubpasta(true); }}
              >
                <FolderPlus className="h-3.5 w-3.5" /> Subpasta
              </Button>
              <Button
                className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
              <Button
                size="icon"
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white"
                onClick={abrirEditPasta}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white"
                onClick={() => setDeletingPasta(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          }
        />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button onClick={() => navigate("/crm/criativos")} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="h-3.5 w-3.5" /><span>Biblioteca</span>
          </button>
          {breadcrumb.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <button
                onClick={() => crumb.id !== pastaId && navigate(`/crm/criativos/${crumb.id}`)}
                className={cn("hover:text-foreground transition-colors", crumb.id === pastaId && "text-foreground font-medium")}
              >
                {crumb.nome}
              </button>
            </span>
          ))}
        </nav>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar criativos..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-9 text-sm" />
            {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-9 rounded-lg border-border/60", showFilters && "bg-foreground text-background hover:bg-foreground/90")} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3.5 w-3.5" /> Filtros
            </Button>
            <div className="flex rounded-xl border border-border/60 bg-muted/40 p-1 gap-0.5">
              <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-lg transition-all", viewMode === "grid" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("lista")} className={cn("p-1.5 rounded-lg transition-all", viewMode === "lista" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg border border-border/60">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoFilter)}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="imagem">Imagem</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="gif">GIF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
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
          </div>
        )}
      </div>

      {/* ── Upload progress ── */}
      {uploads.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Uploads</p>
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-foreground truncate flex-1 min-w-0">{u.file.name}</span>
              <div className="w-32">
                <Progress value={u.progress} className="h-1.5" />
              </div>
              <span className={cn("text-[10px] font-medium w-16 text-right font-display tabular-nums",
                u.status === "done" && "text-green-600",
                u.status === "error" && "text-destructive",
                u.status === "uploading" && "text-primary"
              )}>
                {u.status === "done" ? "Concluido" : u.status === "error" ? "Erro" : u.status === "uploading" ? `${u.progress}%` : "Aguardando"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Subpastas section ── */}
      {subpastas.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 pl-3 border-l-[3px] border-primary">
            Pastas ({subpastas.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subpastas.map((sp) => {
              const count = sp.criativo_biblioteca?.[0]?.count || 0;
              return (
                <div key={sp.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/crm/criativos/${sp.id}`)}>
                  <div className="h-1.5" style={{ backgroundColor: sp.cor }} />
                  <div className="p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <FolderOpen className="h-5 w-5 shrink-0 mt-0.5" style={{ color: sp.cor }} />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate font-display">{sp.nome}</p>
                        <p className="text-xs text-muted-foreground">{count} criativos</p>
                      </div>
                    </div>
                    <StatusBadge status={sp.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Criativos section ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 pl-3 border-l-[3px] border-primary">
          Criativos ({criativosFiltrados.length})
        </h2>

        {/* Drop zone / empty state */}
        {criativos.length === 0 && !loadingCriativos && (
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer",
              dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60 hover:border-primary/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="p-3 rounded-xl bg-muted/40 mx-auto mb-3 w-fit">
              <Upload className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Arraste e solte criativos aqui</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">ou clique para selecionar</p>
            <p className="text-[10px] text-muted-foreground/50 mt-2">JPG, PNG, GIF, WEBP, MP4, MOV, AVI, WEBM (max 50MB)</p>
          </div>
        )}

        {/* Inline drop zone when criativos exist */}
        {criativos.length > 0 && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-3 mb-4 text-center transition-all cursor-pointer",
              dragOver ? "border-primary bg-primary/5" : "border-border/40 hover:border-primary/40"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-xs text-muted-foreground"><Upload className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />Solte arquivos aqui ou clique para upload</p>
          </div>
        )}

        {/* Grid view */}
        {viewMode === "grid" && criativosFiltrados.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {criativosFiltrados.map((c) => {
              const notasCount = c.criativo_notas?.[0]?.count || 0;
              return (
                <div key={c.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md transition-all cursor-pointer" onClick={() => setModalCriativoId(c.id)}>
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-muted/30 overflow-hidden">
                    {c.tipo === "video" ? (
                      <>
                        {c.url_thumbnail ? (
                          <img src={c.url_thumbnail} alt={c.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted/50">
                            <Film className="h-10 w-10 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/50 rounded-full p-2">
                            <Play className="h-5 w-5 text-white fill-white" />
                          </div>
                        </div>
                        {c.duracao_segundos && (
                          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {Math.floor(c.duracao_segundos / 60)}:{String(c.duracao_segundos % 60).padStart(2, "0")}
                          </span>
                        )}
                      </>
                    ) : (
                      <img src={c.url_arquivo} alt={c.nome} className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>

                  <div className="p-3 space-y-1.5">
                    <p className="text-xs font-medium text-foreground truncate">{c.nome}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {c.largura && c.altura ? `${c.largura}x${c.altura}` : ""}
                      {c.largura && c.tamanho_bytes ? " · " : ""}
                      {fmtSize(c.tamanho_bytes)}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1.5 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setModalCriativoId(c.id); }}>
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setDeletingCriativo(c); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                      {notasCount > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
                          <StickyNote className="h-3 w-3" /> {notasCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List view */}
        {viewMode === "lista" && criativosFiltrados.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest w-12">Preview</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nome</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Tipo</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Dimensoes</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Upload</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Notas</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {criativosFiltrados.map((c) => {
                    const notasCount = c.criativo_notas?.[0]?.count || 0;
                    return (
                      <tr key={c.id} className="border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setModalCriativoId(c.id)}>
                        <td className="px-4 py-2">
                          <div className="w-10 h-10 rounded overflow-hidden bg-muted/30 flex-shrink-0 relative">
                            {c.tipo === "video" ? (
                              <div className="w-full h-full flex items-center justify-center"><Film className="h-4 w-4 text-muted-foreground/40" /></div>
                            ) : (
                              <img src={c.url_arquivo} alt="" className="w-full h-full object-cover" loading="lazy" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{c.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtSize(c.tamanho_bytes)}</p>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-xs text-muted-foreground capitalize">{c.tipo}</span>
                        </td>
                        <td className="px-4 py-2 text-center"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground">
                          {c.largura && c.altura ? `${c.largura}x${c.altura}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground">
                          {format(parseISO(c.criado_em), "dd/MM HH:mm")}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {notasCount > 0 ? <span className="text-xs text-muted-foreground">{notasCount}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setDeletingCriativo(c); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleFileInput} />

      {/* ── Modal Criativo Detail ── */}
      {modalCriativoId && (
        <ModalCriativo
          criativoId={modalCriativoId}
          pastaId={pastaId!}
          isOpen={!!modalCriativoId}
          onClose={() => setModalCriativoId(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["criativos", pastaId] });
          }}
        />
      )}

      {/* ── Modal Nova Subpasta ── */}
      <Dialog open={modalSubpasta} onOpenChange={(o) => !o && setModalSubpasta(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nova Subpasta</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={spNome} onChange={(e) => setSpNome(e.target.value)} placeholder="Nome da subpasta" className="mt-1" />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={spDescricao} onChange={(e) => setSpDescricao(e.target.value)} placeholder="Notas..." rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={spStatus} onValueChange={setSpStatus}>
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
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CORES_PASTA.map((c) => (
                    <button key={c} className={cn("w-5 h-5 rounded-full border-2 transition-all", spCor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setSpCor(c)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalSubpasta(false)}>Cancelar</Button>
            <Button onClick={() => { setSpSaving(true); criarSubpasta.mutateAsync().finally(() => setSpSaving(false)); }} disabled={spSaving || !spNome.trim()}>
              {spSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Editar Pasta ── */}
      <Dialog open={modalEditPasta} onOpenChange={(o) => !o && setModalEditPasta(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Editar Pasta</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={epNome} onChange={(e) => setEpNome(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={epDescricao} onChange={(e) => setEpDescricao(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={epStatus} onValueChange={setEpStatus}>
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
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CORES_PASTA.map((c) => (
                    <button key={c} className={cn("w-5 h-5 rounded-full border-2 transition-all", epCor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setEpCor(c)} />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inicio veiculacao</Label>
                <Input type="date" value={epDataInicio} onChange={(e) => setEpDataInicio(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Fim veiculacao</Label>
                <Input type="date" value={epDataFim} onChange={(e) => setEpDataFim(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ep-fixar" checked={epFixado} onCheckedChange={(c) => setEpFixado(!!c)} />
              <Label htmlFor="ep-fixar" className="cursor-pointer text-sm">Fixar no topo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditPasta(false)}>Cancelar</Button>
            <Button onClick={() => { setEpSaving(true); editarPastaAtual.mutateAsync().finally(() => setEpSaving(false)); }} disabled={epSaving || !epNome.trim()}>
              {epSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Alert excluir pasta ── */}
      <AlertDialog open={deletingPasta} onOpenChange={(o) => !o && setDeletingPasta(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir pasta "{pastaAtual.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>Todos os criativos e subpastas serão excluídos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => excluirPastaAtual.mutate()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Alert excluir criativo ── */}
      <AlertDialog open={!!deletingCriativo} onOpenChange={(o) => !o && setDeletingCriativo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir "{deletingCriativo?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>O arquivo será removido permanentemente do storage e do banco.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deletingCriativo && excluirCriativo.mutate(deletingCriativo)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
