import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Stethoscope, Search, Pencil, Trash2, DollarSign,
  ShoppingCart, TrendingUp, Package, BarChart3, ChevronRight, ToggleLeft,
  ArrowUpDown, Calendar, Wallet, User,
} from "lucide-react";
import { useProcedimentos, Procedimento } from "@/hooks/useProcedimentos";
import { useVendas, Venda } from "@/hooks/useVendas";
import { ProcedimentoModal, CATEGORIAS } from "@/components/procedimentos/ProcedimentoModal";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";
import { StatCard, StatCardGrid } from "@/components/StatCard";
import { formatBRL, formatInt } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Helpers ──────────────────────────────────────────────────

function formatDuracao(minutos: number | null) {
  if (!minutos) return null;
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const CATEGORIA_COLORS: Record<string, string> = {
  "Estética Facial": "bg-pink-50 text-pink-700 border-pink-200/60",
  "Estética Corporal": "bg-purple-50 text-purple-700 border-purple-200/60",
  "Capilar": "bg-amber-50 text-amber-700 border-amber-200/60",
  "Odontologia": "bg-blue-50 text-blue-700 border-blue-200/60",
  "Médico": "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  "Outro": "bg-muted text-muted-foreground border-border/60",
};

type SortKey = "nome" | "fechamentos" | "faturamento" | "valor";

const SORT_LABELS: Record<SortKey, string> = {
  nome: "Nome (A-Z)",
  fechamentos: "Mais fechamentos",
  faturamento: "Maior faturamento",
  valor: "Maior valor base",
};

interface MetricaProcedimento {
  vendas: Venda[];
  faturamento: number;
}

// ── Component ────────────────────────────────────────────────

export default function Procedimentos() {
  const { procedimentos, isLoading, deleteProcedimento, updateProcedimento } = useProcedimentos();
  const { vendas } = useVendas();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedimento, setEditingProcedimento] = useState<Procedimento | null>(null);
  const [deletingProcedimento, setDeletingProcedimento] = useState<Procedimento | null>(null);
  const [selectedProcedimento, setSelectedProcedimento] = useState<Procedimento | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<"todos" | "ativo" | "inativo">("todos");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<SortKey>("nome");

  // ── Métricas por procedimento (via match de texto em vendas) ──

  const metricasPorProcedimento = useMemo(() => {
    const map: Record<string, MetricaProcedimento> = {};
    for (const proc of procedimentos) {
      const nomeNorm = proc.nome.toLowerCase().trim();
      const vendasProc = vendas.filter(v =>
        (v.produto_servico || "").toLowerCase().trim() === nomeNorm
      );
      map[proc.id] = {
        vendas: vendasProc,
        faturamento: vendasProc.reduce((s, v) => s + v.valor_fechado, 0),
      };
    }
    return map;
  }, [procedimentos, vendas]);

  // ── Métricas globais ──

  const metricas = useMemo(() => {
    const ativos = procedimentos.filter(p => p.ativo).length;
    const totalVendas = Object.values(metricasPorProcedimento).reduce((s, m) => s + m.vendas.length, 0);
    const totalFaturamento = Object.values(metricasPorProcedimento).reduce((s, m) => s + m.faturamento, 0);
    const maisVendido = procedimentos.reduce<Procedimento | null>((best, p) => {
      if (!best) return p;
      return (metricasPorProcedimento[p.id]?.vendas.length ?? 0) > (metricasPorProcedimento[best.id]?.vendas.length ?? 0) ? p : best;
    }, null);
    const ticketMedio = totalVendas > 0 ? totalFaturamento / totalVendas : 0;
    return { ativos, totalVendas, totalFaturamento, maisVendido, ticketMedio };
  }, [procedimentos, metricasPorProcedimento]);

  // ── Categorias presentes no catálogo ──

  const categoriasDisponiveis = useMemo(() => {
    const presentes = new Set(procedimentos.map(p => p.categoria).filter(Boolean) as string[]);
    return CATEGORIAS.filter(c => presentes.has(c));
  }, [procedimentos]);

  // ── Filtragem + ordenação ──

  const filtered = useMemo(() => {
    let list = procedimentos;
    if (filterAtivo === "ativo") list = list.filter(p => p.ativo);
    if (filterAtivo === "inativo") list = list.filter(p => !p.ativo);
    if (filterCategoria !== "todas") list = list.filter(p => p.categoria === filterCategoria);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        (p.categoria || "").toLowerCase().includes(q) ||
        (p.descricao || "").toLowerCase().includes(q)
      );
    }

    const withMetrica = list.map(p => ({ p, m: metricasPorProcedimento[p.id] ?? { vendas: [], faturamento: 0 } }));
    withMetrica.sort((a, b) => {
      switch (sortBy) {
        case "fechamentos":
          return b.m.vendas.length - a.m.vendas.length;
        case "faturamento":
          return b.m.faturamento - a.m.faturamento;
        case "valor":
          return (b.p.valor_base ?? 0) - (a.p.valor_base ?? 0);
        default:
          return a.p.nome.localeCompare(b.p.nome, "pt-BR");
      }
    });
    return withMetrica.map(({ p }) => p);
  }, [procedimentos, filterAtivo, filterCategoria, searchQuery, sortBy, metricasPorProcedimento]);

  const hasActiveFilters = filterAtivo !== "todos" || filterCategoria !== "todas" || searchQuery.trim() !== "";

  const clearFilters = () => {
    setFilterAtivo("todos");
    setFilterCategoria("todas");
    setSearchQuery("");
  };

  // ── Handlers ──

  const handleEdit = (p: Procedimento) => {
    setEditingProcedimento(p);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingProcedimento(null);
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) setEditingProcedimento(null);
    setIsModalOpen(open);
  };

  const handleToggleAtivo = (p: Procedimento) => {
    updateProcedimento({ id: p.id, ativo: !p.ativo });
  };

  const confirmDelete = () => {
    if (deletingProcedimento) deleteProcedimento(deletingProcedimento.id);
    setDeletingProcedimento(null);
  };

  const selectedMetrica = selectedProcedimento ? metricasPorProcedimento[selectedProcedimento.id] : null;

  // ── Render ──

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">

      {/* ═══ PAGE HEADER ═══ */}
      <PageHero
        dataTutorial="procedimentos-header"
        icon={Stethoscope}
        title="Procedimentos"
        subtitle="Gerencie seu catálogo de procedimentos e acompanhe a performance de cada um"
        right={
          <Button
            onClick={handleNew}
            data-tutorial="procedimentos-add"
            className="h-9 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-5 gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Procedimento
          </Button>
        }
      />

      {/* ═══ METRICS ═══ */}
      <div data-tutorial="procedimentos-metrics">
        <StatCardGrid cols={4}>
          {[
            {
              label: "Ativos",
              value: isLoading ? "—" : formatInt(metricas.ativos),
              icon: Package,
            },
            {
              label: "Fechamentos",
              value: isLoading ? "—" : formatInt(metricas.totalVendas),
              icon: ShoppingCart,
            },
            {
              label: "Faturamento",
              value: isLoading ? "—" : formatBRL(metricas.totalFaturamento),
              icon: DollarSign,
            },
            {
              label: "Ticket Médio",
              value: isLoading ? "—" : metricas.ticketMedio > 0 ? formatBRL(metricas.ticketMedio) : "—",
              icon: TrendingUp,
            },
          ].map(stat => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
          ))}
        </StatCardGrid>
      </div>

      {/* ═══ MAIS VENDIDO BANNER ═══ */}
      {!isLoading && metricas.maisVendido && metricas.totalVendas > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/60 shrink-0">
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
              Procedimento mais vendido
            </p>
            <p className="text-[14px] font-semibold text-foreground truncate font-display">
              {metricas.maisVendido.nome}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground/50">Fechamentos</p>
            <p className="text-lg font-extrabold font-display tabular-nums text-foreground">
              {metricasPorProcedimento[metricas.maisVendido.id]?.vendas.length ?? 0}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground/50">Faturado</p>
            <p className="text-[13px] font-bold font-display tabular-nums text-emerald-600">
              {formatBRL(metricasPorProcedimento[metricas.maisVendido.id]?.faturamento ?? 0)}
            </p>
          </div>
        </div>
      )}

      {/* ═══ LIST SECTION ═══ */}
      <div data-tutorial="procedimentos-list">

        {/* Section header + filters */}
        <div className="flex flex-col gap-3 mb-4" data-tutorial="procedimentos-filters">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Catálogo
              </span>
              {filtered.length > 0 && (
                <span className="text-[10px] font-bold font-display tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                  {filtered.length}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter pills */}
              <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
                {(["todos", "ativo", "inativo"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterAtivo(f)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[11px] font-medium transition-all",
                      filterAtivo === f
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f === "todos" ? "Todos" : f === "ativo" ? "Ativos" : "Inativos"}
                  </button>
                ))}
              </div>

              {/* Categoria filter */}
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="h-8 text-[11px] w-[150px] bg-muted/30 border-border/40 rounded-lg">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60">
                  <SelectItem value="todas" className="text-xs">Todas as categorias</SelectItem>
                  {categoriasDisponiveis.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
                <SelectTrigger className="h-8 text-[11px] w-[172px] bg-muted/30 border-border/40 rounded-lg gap-1.5">
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <SelectItem key={key} value={key} className="text-xs">{SORT_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Buscar procedimento..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-xs bg-muted/30 border-border/40 rounded-lg placeholder:text-muted-foreground/40"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-8 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-border/60 bg-card">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Stethoscope className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {hasActiveFilters ? "Nenhum procedimento encontrado" : "Nenhum procedimento cadastrado"}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {hasActiveFilters ? "Tente ajustar os filtros ou o termo de busca" : "Clique em \"Novo Procedimento\" para começar"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(proc => {
              const m = metricasPorProcedimento[proc.id] ?? { vendas: [], faturamento: 0 };
              const categoriaClass = proc.categoria ? (CATEGORIA_COLORS[proc.categoria] ?? CATEGORIA_COLORS["Outro"]) : CATEGORIA_COLORS["Outro"];

              return (
                <div
                  key={proc.id}
                  onClick={() => setSelectedProcedimento(proc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter") setSelectedProcedimento(proc); }}
                  className={cn(
                    "rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden group transition-all hover:border-border hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer",
                    !proc.ativo && "opacity-60"
                  )}
                >
                  {/* Card Header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-semibold text-foreground truncate font-display">{proc.nome}</h3>
                        {proc.categoria && (
                          <span className={cn("inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1", categoriaClass)}>
                            {proc.categoria}
                          </span>
                        )}
                      </div>
                      {!proc.ativo && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 bg-muted/50 px-2 py-1 rounded-md shrink-0">
                          Inativo
                        </span>
                      )}
                    </div>

                    {proc.descricao && (
                      <p className="text-[11px] text-muted-foreground/60 line-clamp-2 mt-1">
                        {proc.descricao}
                      </p>
                    )}
                  </div>

                  {/* Info row */}
                  <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                    <div className="bg-muted/30 rounded-xl px-3 py-2 border border-border/40">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">
                        Valor Base
                      </span>
                      <span className="text-[13px] font-bold text-foreground font-display tabular-nums">
                        {proc.valor_base != null ? formatBRL(proc.valor_base) : "—"}
                      </span>
                    </div>
                    <div className="bg-muted/30 rounded-xl px-3 py-2 border border-border/40">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">
                        Duração
                      </span>
                      <span className="text-[13px] font-bold text-foreground font-display tabular-nums">
                        {formatDuracao(proc.duracao_minutos) ?? "—"}
                      </span>
                    </div>
                  </div>

                  {/* Sales metrics */}
                  <div className="px-4 pb-3">
                    <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[11px] text-muted-foreground/70">
                          <span className="font-bold text-foreground font-display tabular-nums">{m.vendas.length}</span>
                          {" "}fechamento{m.vendas.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m.faturamento > 0 && (
                          <span className="text-[11px] font-bold text-emerald-600 font-display tabular-nums">
                            {formatBRL(m.faturamento)}
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-border/40 bg-muted/[0.03] flex items-center justify-between">
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleAtivo(proc); }}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <ToggleLeft className="h-3.5 w-3.5" />
                      {proc.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); handleEdit(proc); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingProcedimento(proc); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ MODAL ═══ */}
      <ProcedimentoModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        procedimento={editingProcedimento}
      />

      {/* ═══ DETAIL DIALOG ═══ */}
      <Dialog open={!!selectedProcedimento} onOpenChange={open => !open && setSelectedProcedimento(null)}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl border-border/60 p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
          {selectedProcedimento && (() => {
            const proc = selectedProcedimento;
            const m = selectedMetrica ?? { vendas: [], faturamento: 0 };
            const ticket = m.vendas.length > 0 ? m.faturamento / m.vendas.length : 0;
            const categoriaClass = proc.categoria ? (CATEGORIA_COLORS[proc.categoria] ?? CATEGORIA_COLORS["Outro"]) : CATEGORIA_COLORS["Outro"];
            const vendasOrdenadas = [...m.vendas].sort((a, b) => b.data_fechamento.localeCompare(a.data_fechamento));

            return (
              <>
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
                  <DialogHeader className="space-y-0 text-left">
                    <div className="flex items-start justify-between gap-2 pr-6">
                      <div className="min-w-0">
                        <DialogTitle className="text-base font-semibold font-display truncate">{proc.nome}</DialogTitle>
                        {proc.categoria && (
                          <span className={cn("inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1.5", categoriaClass)}>
                            {proc.categoria}
                          </span>
                        )}
                      </div>
                      {!proc.ativo && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 bg-muted/50 px-2 py-1 rounded-md shrink-0">
                          Inativo
                        </span>
                      )}
                    </div>
                  </DialogHeader>
                  {proc.descricao && (
                    <p className="text-[12px] text-muted-foreground/70 mt-2.5 leading-relaxed">
                      {proc.descricao}
                    </p>
                  )}
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 min-h-0">
                  {/* Stats */}
                  <div className="px-5 py-4 grid grid-cols-2 gap-2 border-b border-border/40">
                    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">Valor Base</span>
                      <span className="text-[13px] font-bold text-foreground font-display tabular-nums">
                        {proc.valor_base != null ? formatBRL(proc.valor_base) : "—"}
                      </span>
                    </div>
                    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">Duração</span>
                      <span className="text-[13px] font-bold text-foreground font-display tabular-nums">
                        {formatDuracao(proc.duracao_minutos) ?? "—"}
                      </span>
                    </div>
                    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">Faturamento</span>
                      <span className="text-[13px] font-bold text-emerald-600 font-display tabular-nums">
                        {formatBRL(m.faturamento)}
                      </span>
                    </div>
                    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">Ticket Médio</span>
                      <span className="text-[13px] font-bold text-foreground font-display tabular-nums">
                        {ticket > 0 ? formatBRL(ticket) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Fechamentos list */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        Fechamentos
                      </span>
                      <span className="text-[10px] font-bold font-display tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                        {vendasOrdenadas.length}
                      </span>
                    </div>
                    {vendasOrdenadas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="p-3 rounded-xl bg-muted/40 mb-3">
                          <ShoppingCart className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                        <p className="text-[12px] font-medium text-muted-foreground">Nenhum fechamento ainda</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                          Vendas com o serviço "{proc.nome}" aparecerão aqui
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {vendasOrdenadas.map(venda => (
                          <div key={venda.id} className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <User className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                <span className="text-[12px] font-semibold text-foreground truncate">
                                  {venda.leads?.nome || "Cliente"}
                                </span>
                              </div>
                              <span className="text-[12px] font-bold text-emerald-600 font-display tabular-nums shrink-0">
                                {formatBRL(venda.valor_fechado)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {format(parseISO(venda.data_fechamento), "dd MMM yyyy", { locale: ptBR })}
                              </span>
                              {venda.forma_pagamento && (
                                <span className="flex items-center gap-1">
                                  <Wallet className="h-2.5 w-2.5" />
                                  {venda.forma_pagamento}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="px-5 py-3.5 border-t border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => handleToggleAtivo(proc)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                  >
                    <ToggleLeft className="h-3.5 w-3.5" />
                    {proc.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => { setSelectedProcedimento(null); setDeletingProcedimento(proc); }}
                      className="h-8 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-destructive px-3 gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                    <Button
                      onClick={() => { setSelectedProcedimento(null); handleEdit(proc); }}
                      className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE DIALOG ═══ */}
      <AlertDialog open={!!deletingProcedimento} onOpenChange={() => setDeletingProcedimento(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold font-display">Excluir procedimento?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              O procedimento <strong>{deletingProcedimento?.nome}</strong> será removido do seu catálogo. O histórico de vendas não será afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl text-xs h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 rounded-xl text-xs h-9"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
