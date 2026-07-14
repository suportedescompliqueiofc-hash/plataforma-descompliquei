import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
  FolderOpen, FolderPlus, Upload, Search, ChevronRight, Home,
  ArrowUp, Edit2, Trash2, Pin, LayoutGrid, List, Filter,
  Loader2, Plus, X, ImagePlay, Eye,
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

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { PageHero } from "@/components/PageHero";

// ── Status config ──────────────────────────────────────────────

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

type SortOption = "recente" | "antigo" | "nome" | "fixados";

// ── Types ──────────────────────────────────────────────────────

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

interface BreadcrumbItem {
  id: string | null;
  nome: string;
}

// ── Component ──────────────────────────────────────────────────

export default function CriativosBiblioteca() {
  const { pastaId } = useParams<{ pastaId: string }>();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const pastaAtualId = pastaId || null;

  // Date range
  const today = new Date();
  const initialDateRange: DateRange = { from: startOfMonth(today), to: endOfMonth(today) };
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);

  // UI state
  const [viewMode, setViewMode] = useState<"grid" | "lista">("grid");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [ordenacao, setOrdenacao] = useState<SortOption>("fixados");
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [modalPasta, setModalPasta] = useState(false);
  const [editingPasta, setEditingPasta] = useState<Pasta | null>(null);
  const [deletingPasta, setDeletingPasta] = useState<Pasta | null>(null);

  // Form state
  const [formNome, setFormNome] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formStatus, setFormStatus] = useState("em_criacao");
  const [formCor, setFormCor] = useState("#3b82f6");
  const [formDataInicio, setFormDataInicio] = useState("");
  const [formDataFim, setFormDataFim] = useState("");
  const [formFixado, setFormFixado] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Queries ─────────────────────────────────────────────────

  // Pastas da pasta atual
  const { data: pastas = [], isLoading } = useQuery({
    queryKey: ["criativo-pastas", orgId, pastaAtualId],
    queryFn: async () => {
      let query = supabase
        .from("criativo_pastas")
        .select("*, criativo_biblioteca(count)")
        .eq("organization_id", orgId!)
        .order("fixado", { ascending: false })
        .order("criado_em", { ascending: false });

      if (pastaAtualId) {
        query = query.eq("pasta_pai_id", pastaAtualId);
      } else {
        query = query.is("pasta_pai_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Pasta[];
    },
    enabled: !!orgId,
  });

  // Breadcrumb — busca ancestrais da pasta atual
  const { data: breadcrumb = [] } = useQuery({
    queryKey: ["criativo-breadcrumb", orgId, pastaAtualId],
    queryFn: async () => {
      if (!pastaAtualId) return [];
      const crumbs: BreadcrumbItem[] = [];
      let currentId: string | null = pastaAtualId;

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
    enabled: !!orgId && !!pastaAtualId,
  });

  // Contagem de criativos ativos por pasta (via view)
  const { data: hierarquiaData = [] } = useQuery({
    queryKey: ["criativo-hierarquia", orgId, pastaAtualId],
    queryFn: async () => {
      let query = supabase
        .from("vw_pasta_hierarquia")
        .select("id, total_criativos, criativos_ativos")
        .eq("organization_id", orgId!);

      if (pastaAtualId) {
        query = query.eq("pasta_pai_id", pastaAtualId);
      } else {
        query = query.is("pasta_pai_id", null);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!orgId,
  });

  const hierarquiaMap = useMemo(() => {
    const map: Record<string, { total: number; ativos: number }> = {};
    hierarquiaData.forEach((h: any) => {
      map[h.id] = { total: Number(h.total_criativos) || 0, ativos: Number(h.criativos_ativos) || 0 };
    });
    return map;
  }, [hierarquiaData]);

  // ── Filtered & sorted ─────────────────────────────────────

  const pastasFiltradas = useMemo(() => {
    let result = [...pastas];

    // Date range filter
    if (dateRange?.from) {
      const from = dateRange.from;
      const to = dateRange.to || from;
      result = result.filter((p) => {
        const criado = new Date(p.criado_em);
        return isWithinInterval(criado, { start: from, end: to });
      });
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      result = result.filter((p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.descricao && p.descricao.toLowerCase().includes(q))
      );
    }

    if (filtroStatus !== "todos") {
      result = result.filter((p) => p.status === filtroStatus);
    }

    switch (ordenacao) {
      case "recente":
        result.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
        break;
      case "antigo":
        result.sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
        break;
      case "nome":
        result.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        break;
      case "fixados":
        result.sort((a, b) => {
          if (a.fixado !== b.fixado) return a.fixado ? -1 : 1;
          return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
        });
        break;
    }

    return result;
  }, [pastas, busca, filtroStatus, ordenacao, dateRange]);

  // ── Mutations ─────────────────────────────────────────────

  const salvarPasta = useMutation({
    mutationFn: async () => {
      if (!formNome.trim()) throw new Error("Nome é obrigatório");
      const payload: any = {
        organization_id: orgId,
        nome: formNome.trim(),
        descricao: formDescricao.trim() || null,
        status: formStatus,
        cor: formCor,
        data_inicio_veiculacao: formDataInicio || null,
        data_fim_veiculacao: formDataFim || null,
        fixado: formFixado,
        atualizado_em: new Date().toISOString(),
      };

      if (editingPasta) {
        const { error } = await supabase
          .from("criativo_pastas")
          .update(payload)
          .eq("id", editingPasta.id);
        if (error) throw error;
      } else {
        payload.pasta_pai_id = pastaAtualId;
        const { error } = await supabase
          .from("criativo_pastas")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPasta ? "Pasta atualizada!" : "Pasta criada!");
      queryClient.invalidateQueries({ queryKey: ["criativo-pastas"] });
      queryClient.invalidateQueries({ queryKey: ["criativo-hierarquia"] });
      fecharModal();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const excluirPasta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("criativo_pastas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta excluída!");
      queryClient.invalidateQueries({ queryKey: ["criativo-pastas"] });
      queryClient.invalidateQueries({ queryKey: ["criativo-hierarquia"] });
      setDeletingPasta(null);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir"),
  });

  // ── Modal helpers ─────────────────────────────────────────

  function abrirCriar() {
    setEditingPasta(null);
    setFormNome("");
    setFormDescricao("");
    setFormStatus("em_criacao");
    setFormCor("#3b82f6");
    setFormDataInicio("");
    setFormDataFim("");
    setFormFixado(false);
    setModalPasta(true);
  }

  function abrirEditar(pasta: Pasta) {
    setEditingPasta(pasta);
    setFormNome(pasta.nome);
    setFormDescricao(pasta.descricao || "");
    setFormStatus(pasta.status);
    setFormCor(pasta.cor);
    setFormDataInicio(pasta.data_inicio_veiculacao || "");
    setFormDataFim(pasta.data_fim_veiculacao || "");
    setFormFixado(pasta.fixado);
    setModalPasta(true);
  }

  function fecharModal() {
    setModalPasta(false);
    setEditingPasta(null);
    setSaving(false);
  }

  async function handleSalvar() {
    setSaving(true);
    await salvarPasta.mutateAsync();
    setSaving(false);
  }

  // ── Render helpers ────────────────────────────────────────

  function getContagem(pastaId: string) {
    const h = hierarquiaMap[pastaId];
    if (h) return h;
    const p = pastas.find((pp) => pp.id === pastaId);
    const total = p?.criativo_biblioteca?.[0]?.count || 0;
    return { total, ativos: 0 };
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

  // ── Loading ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6 overflow-hidden">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4">
        <PageHero
          icon={FolderOpen}
          title="Biblioteca de Criativos"
          subtitle="Organize campanhas e criativos por pasta."
          right={
            <div className="flex items-center gap-2 flex-wrap">
              {pastaAtualId && (
                <Button
                  className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4"
                  onClick={() => {
                    const parentId = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null;
                    navigate(parentId ? `/crm/criativos/${parentId}` : "/crm/criativos");
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" /> Pasta anterior
                </Button>
              )}
              <Button className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4" onClick={abrirCriar}>
                <FolderPlus className="h-3.5 w-3.5" /> Nova Pasta
              </Button>
              <Button className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4" onClick={() => navigate(pastaAtualId ? `/crm/criativos/${pastaAtualId}` : "/crm/criativos")}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            </div>
          }
        />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button
            onClick={() => navigate("/crm/criativos")}
            className={cn(
              "flex items-center gap-1 hover:text-foreground transition-colors",
              !pastaAtualId && "text-foreground font-medium"
            )}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Biblioteca</span>
          </button>
          {breadcrumb.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <button
                onClick={() => navigate(crumb.id === pastaAtualId ? "#" : `/crm/criativos/${crumb.id}`)}
                className={cn(
                  "hover:text-foreground transition-colors",
                  crumb.id === pastaAtualId && "text-foreground font-medium"
                )}
              >
                {crumb.nome}
              </button>
            </span>
          ))}
        </nav>

        {/* Search + Filters bar */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pastas..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <DateRangePicker date={dateRange} setDate={setDateRange} />

            <Button
              variant="outline"
              size="sm"
              className={cn("gap-1.5 text-xs h-9 rounded-lg border-border/60", showFilters && "bg-foreground text-background hover:bg-foreground/90")}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3.5 w-3.5" /> Filtros
            </Button>

            <div className="flex rounded-xl border border-border/60 bg-muted/40 p-1 gap-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "grid"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("lista")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "lista"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg border border-border/60">
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
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
            <div>
              <Label className="text-xs text-muted-foreground">Ordenar por</Label>
              <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as SortOption)}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixados">Fixados primeiro</SelectItem>
                  <SelectItem value="recente">Mais recente</SelectItem>
                  <SelectItem value="antigo">Mais antigo</SelectItem>
                  <SelectItem value="nome">Nome A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtroStatus !== "todos" && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFiltroStatus("todos"); setOrdenacao("fixados"); }}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {pastasFiltradas.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mx-auto mb-3 w-fit">
            <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {busca || filtroStatus !== "todos" ? "Nenhuma pasta encontrada" : "Nenhuma pasta criada"}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 mb-4">
            {busca || filtroStatus !== "todos"
              ? "Tente ajustar os filtros de busca"
              : "Crie sua primeira pasta para organizar os criativos"}
          </p>
          {!busca && filtroStatus === "todos" && (
            <Button onClick={abrirCriar} className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              <FolderPlus className="h-3.5 w-3.5" /> Nova Pasta
            </Button>
          )}
        </div>
      )}

      {/* ── Grid view ── */}
      {viewMode === "grid" && pastasFiltradas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pastasFiltradas.map((pasta) => {
            const contagem = getContagem(pasta.id);
            return (
              <div
                key={pasta.id}
                className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-border transition-all duration-200 cursor-pointer relative"
                onClick={() => navigate(`/crm/criativos/${pasta.id}`)}
              >
                {/* Top color bar */}
                <div className="h-1.5" style={{ backgroundColor: pasta.cor }} />

                {pasta.fixado && (
                  <div className="absolute top-3 right-3">
                    <Pin className="h-3.5 w-3.5 text-primary fill-primary" />
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Folder icon + name */}
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg p-2 bg-muted/50 shrink-0" style={{ color: pasta.cor }}>
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-sm truncate leading-tight font-display">{pasta.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {contagem.total} {contagem.total === 1 ? "criativo" : "criativos"}
                        {contagem.ativos > 0 && ` · ${contagem.ativos} ${contagem.ativos === 1 ? "ativo" : "ativos"}`}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={pasta.status} />

                  {/* Date */}
                  {pasta.data_inicio_veiculacao && (
                    <p className="text-[10px] text-muted-foreground">
                      No ar desde: {format(parseISO(pasta.data_inicio_veiculacao), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}

                  {/* Description */}
                  {pasta.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{pasta.descricao}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-2 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); abrirEditar(pasta); }}
                    >
                      <Edit2 className="h-3 w-3" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeletingPasta(pasta); }}
                    >
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === "lista" && pastasFiltradas.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nome</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Criativos</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">No ar desde</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Atualização</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pastasFiltradas.map((pasta) => {
                  const contagem = getContagem(pasta.id);
                  return (
                    <tr
                      key={pasta.id}
                      className="border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => navigate(`/crm/criativos/${pasta.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {pasta.fixado && <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />}
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pasta.cor }} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{pasta.nome}</p>
                            {pasta.descricao && <p className="text-xs text-muted-foreground truncate max-w-[250px]">{pasta.descricao}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                        {contagem.total}
                        {contagem.ativos > 0 && <span className="text-green-600 ml-1">({contagem.ativos})</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={pasta.status} />
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {pasta.data_inicio_veiculacao
                          ? format(parseISO(pasta.data_inicio_veiculacao), "dd/MM/yyyy")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {format(parseISO(pasta.atualizado_em), "dd/MM HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); abrirEditar(pasta); }}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); setDeletingPasta(pasta); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Criar/Editar Pasta ── */}
      <Dialog open={modalPasta} onOpenChange={(o) => !o && fecharModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingPasta ? "Editar Pasta" : "Nova Pasta"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Nome da pasta *</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Campanha Maio 2026"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Descrição/notas</Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Notas sobre essa campanha..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
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
              </div>

              <div>
                <Label>Cor de identificação</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CORES_PASTA.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all",
                        formCor === c ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setFormCor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data início veiculação</Label>
                <Input
                  type="date"
                  value={formDataInicio}
                  onChange={(e) => setFormDataInicio(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Data fim veiculação</Label>
                <Input
                  type="date"
                  value={formDataFim}
                  onChange={(e) => setFormDataFim(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="fixar"
                checked={formFixado}
                onCheckedChange={(c) => setFormFixado(!!c)}
              />
              <Label htmlFor="fixar" className="cursor-pointer text-sm">
                Fixar pasta no topo
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving || !formNome.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingPasta ? "Salvar" : "Criar Pasta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Alert de exclusão ── */}
      <AlertDialog open={!!deletingPasta} onOpenChange={(o) => !o && setDeletingPasta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir pasta "{deletingPasta?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os criativos e subpastas dentro desta pasta também serão excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingPasta && excluirPasta.mutate(deletingPasta.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
