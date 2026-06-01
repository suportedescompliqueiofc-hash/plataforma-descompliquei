import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Plus, Stethoscope, Search, Pencil, Trash2, Clock, DollarSign,
  ShoppingCart, TrendingUp, Package, BarChart3, ChevronRight, ToggleLeft,
} from "lucide-react";
import { useProcedimentos, Procedimento } from "@/hooks/useProcedimentos";
import { useVendas } from "@/hooks/useVendas";
import { ProcedimentoModal } from "@/components/procedimentos/ProcedimentoModal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDuracao(minutos: number | null) {
  if (!minutos) return null;
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const CATEGORIA_COLORS: Record<string, string> = {
  "Estetica Facial": "bg-pink-50 text-pink-700 border-pink-200/60",
  "Estetica Corporal": "bg-purple-50 text-purple-700 border-purple-200/60",
  "Capilar": "bg-amber-50 text-amber-700 border-amber-200/60",
  "Odontologia": "bg-blue-50 text-blue-700 border-blue-200/60",
  "Medico": "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  "Outro": "bg-muted text-muted-foreground border-border/60",
};

// ── Component ────────────────────────────────────────────────

export default function Procedimentos() {
  const { procedimentos, isLoading, deleteProcedimento, updateProcedimento } = useProcedimentos();
  const { vendas } = useVendas();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedimento, setEditingProcedimento] = useState<Procedimento | null>(null);
  const [deletingProcedimento, setDeletingProcedimento] = useState<Procedimento | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<"todos" | "ativo" | "inativo">("todos");

  // ── Métricas por procedimento (via match de texto em vendas) ──

  const metricasPorProcedimento = useMemo(() => {
    const map: Record<string, { vendas: number; faturamento: number }> = {};
    for (const proc of procedimentos) {
      const nomeNorm = proc.nome.toLowerCase().trim();
      const vendasProc = vendas.filter(v =>
        (v.produto_servico || "").toLowerCase().trim() === nomeNorm
      );
      map[proc.id] = {
        vendas: vendasProc.length,
        faturamento: vendasProc.reduce((s, v) => s + v.valor_fechado, 0),
      };
    }
    return map;
  }, [procedimentos, vendas]);

  // ── Métricas globais ──

  const metricas = useMemo(() => {
    const ativos = procedimentos.filter(p => p.ativo).length;
    const totalVendas = Object.values(metricasPorProcedimento).reduce((s, m) => s + m.vendas, 0);
    const totalFaturamento = Object.values(metricasPorProcedimento).reduce((s, m) => s + m.faturamento, 0);
    const maisVendido = procedimentos.reduce<Procedimento | null>((best, p) => {
      if (!best) return p;
      return (metricasPorProcedimento[p.id]?.vendas ?? 0) > (metricasPorProcedimento[best.id]?.vendas ?? 0) ? p : best;
    }, null);
    const ticketMedio = totalVendas > 0 ? totalFaturamento / totalVendas : 0;
    return { ativos, totalVendas, totalFaturamento, maisVendido, ticketMedio };
  }, [procedimentos, metricasPorProcedimento]);

  // ── Filtragem ──

  const filtered = useMemo(() => {
    let list = procedimentos;
    if (filterAtivo === "ativo") list = list.filter(p => p.ativo);
    if (filterAtivo === "inativo") list = list.filter(p => !p.ativo);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        (p.categoria || "").toLowerCase().includes(q) ||
        (p.descricao || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [procedimentos, filterAtivo, searchQuery]);

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

  // ── Render ──

  return (
    <div className="space-y-6 pb-10">

      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4" data-tutorial="procedimentos-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Procedimentos
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">
            Gerencie seu catalogo de procedimentos e acompanhe a performance de cada um
          </p>
        </div>
        <Button
          onClick={handleNew}
          data-tutorial="procedimentos-add"
          className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 w-full sm:w-auto shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Procedimento
        </Button>
      </div>

      {/* ═══ METRICS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tutorial="procedimentos-metrics">
        {[
          {
            label: "Ativos",
            value: isLoading ? "—" : metricas.ativos.toString(),
            icon: Package,
            accent: false,
          },
          {
            label: "Fechamentos",
            value: isLoading ? "—" : metricas.totalVendas.toString(),
            icon: ShoppingCart,
            accent: false,
          },
          {
            label: "Faturamento",
            value: isLoading ? "—" : metricas.totalFaturamento > 0
              ? metricas.totalFaturamento >= 1000
                ? `R$ ${(metricas.totalFaturamento / 1000).toFixed(1)}K`
                : formatCurrency(metricas.totalFaturamento)
              : "R$ 0",
            icon: DollarSign,
            accent: true,
          },
          {
            label: "Ticket Medio",
            value: isLoading ? "—" : metricas.ticketMedio > 0 ? formatCurrency(metricas.ticketMedio) : "—",
            icon: TrendingUp,
            accent: false,
          },
        ].map(stat => (
          <div
            key={stat.label}
            className={cn(
              "rounded-2xl px-4 py-3.5 border transition-colors",
              stat.accent
                ? "bg-primary/[0.04] border-primary/20"
                : "bg-card border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <stat.icon className={cn("h-3 w-3", stat.accent ? "text-primary" : "text-muted-foreground")} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </span>
            </div>
            <p className={cn(
              "text-xl font-extrabold tracking-tight font-display tabular-nums",
              stat.accent ? "text-primary" : "text-foreground"
            )}>
              {stat.value}
            </p>
          </div>
        ))}
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
            <p className="text-[14px] font-semibold text-foreground truncate">
              {metricas.maisVendido.nome}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground/50">Fechamentos</p>
            <p className="text-lg font-extrabold tabular-nums text-foreground font-display">
              {metricasPorProcedimento[metricas.maisVendido.id]?.vendas ?? 0}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground/50">Faturado</p>
            <p className="text-[13px] font-bold tabular-nums text-emerald-600">
              {formatCurrency(metricasPorProcedimento[metricas.maisVendido.id]?.faturamento ?? 0)}
            </p>
          </div>
        </div>
      )}

      {/* ═══ LIST SECTION ═══ */}
      <div data-tutorial="procedimentos-list">

        {/* Section header + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Catalogo
            </span>
            {filtered.length > 0 && (
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                {filtered.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
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
              {searchQuery ? "Nenhum procedimento encontrado" : "Nenhum procedimento cadastrado"}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {searchQuery ? "Tente outro termo de busca" : "Clique em \"Novo Procedimento\" para comecar"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(proc => {
              const m = metricasPorProcedimento[proc.id] ?? { vendas: 0, faturamento: 0 };
              const categoriaClass = proc.categoria ? (CATEGORIA_COLORS[proc.categoria] ?? CATEGORIA_COLORS["Outro"]) : CATEGORIA_COLORS["Outro"];

              return (
                <div
                  key={proc.id}
                  className={cn(
                    "rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden group transition-colors hover:border-border",
                    !proc.ativo && "opacity-60"
                  )}
                >
                  {/* Card Header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-semibold text-foreground truncate">{proc.nome}</h3>
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
                      <span className="text-[13px] font-bold text-foreground tabular-nums">
                        {proc.valor_base != null ? formatCurrency(proc.valor_base) : "—"}
                      </span>
                    </div>
                    <div className="bg-muted/30 rounded-xl px-3 py-2 border border-border/40">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">
                        Duracao
                      </span>
                      <span className="text-[13px] font-bold text-foreground">
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
                          <span className="font-bold text-foreground tabular-nums">{m.vendas}</span>
                          {" "}fechamento{m.vendas !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {m.faturamento > 0 && (
                        <span className="text-[11px] font-bold text-emerald-600 tabular-nums">
                          {formatCurrency(m.faturamento)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-border/40 bg-muted/[0.03] flex items-center justify-between">
                    <button
                      onClick={() => handleToggleAtivo(proc)}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <ToggleLeft className="h-3.5 w-3.5" />
                      {proc.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(proc)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDeletingProcedimento(proc)}
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

      {/* ═══ DELETE DIALOG ═══ */}
      <AlertDialog open={!!deletingProcedimento} onOpenChange={() => setDeletingProcedimento(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir procedimento?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              O procedimento <strong>{deletingProcedimento?.nome}</strong> sera removido do seu catalogo. O historico de vendas nao sera afetado.
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
