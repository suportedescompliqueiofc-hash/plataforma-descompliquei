import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus, DollarSign, TrendingUp, TrendingDown, ShoppingCart, Percent, Pencil, Trash2,
  Calendar as CalendarIcon, User, CreditCard, Loader2, Search, Receipt,
  ArrowUpRight, ArrowDownRight, BarChart3, ChevronDown, Filter, Package,
} from "lucide-react";
import { useVendas, Venda } from "@/hooks/useVendas";
import { VendaModal } from "@/components/vendas/VendaModal";
import { VendasRelatorios } from "@/components/vendas/VendasRelatorios";
import { ExportVendasButton } from "@/components/vendas/ExportVendasButton";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Component ────────────────────────────────────────────────

export default function Vendas() {
  const { profile } = useProfile();
  const today = new Date();
  const initialDateRange: DateRange = {
    from: startOfMonth(today),
    to: endOfMonth(today),
  };
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const { vendas, isLoading, deleteVenda } = useVendas(dateRange);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenda, setEditingVenda] = useState<Venda | null>(null);
  const [isDeleting, setIsDeleting] = useState<Venda | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"registros" | "relatorios">("registros");

  // ── Metrics ────────────────────────────────────────────────

  const metrics = useMemo(() => {
    if (isLoading || vendas.length === 0) {
      return {
        totalFaturado: 0, ticketMedio: 0, vendasNoPeriodo: 0, taxaConversao: 0, maiorVenda: 0,
        faturamentoConsultas: 0, faturamentoProcedimentos: 0, faturamentoOutros: 0,
        qtdConsultas: 0, qtdProcedimentos: 0,
      };
    }
    const totalFaturado = vendas.reduce((acc, v) => acc + v.valor_fechado, 0);
    const ticketMedio = totalFaturado / vendas.length;
    const vendasNoPeriodo = vendas.length;
    const maiorVenda = Math.max(...vendas.map(v => v.valor_fechado));
    const vendasComOrcamento = vendas.filter(v => v.valor_orcado && v.valor_orcado > 0);
    const totalOrcado = vendasComOrcamento.reduce((acc, v) => acc + (v.valor_orcado || 0), 0);
    const totalFechadoDeOrcados = vendasComOrcamento.reduce((acc, v) => acc + v.valor_fechado, 0);
    const taxaConversao = totalOrcado > 0 ? (totalFechadoDeOrcados / totalOrcado) * 100 : 0;

    const consultas = vendas.filter(v => v.tipo_venda === "consulta");
    const procedimentos = vendas.filter(v => !v.tipo_venda || v.tipo_venda === "procedimento");
    const outros = vendas.filter(v => v.tipo_venda === "outro");
    const faturamentoConsultas = consultas.reduce((acc, v) => acc + v.valor_fechado, 0);
    const faturamentoProcedimentos = procedimentos.reduce((acc, v) => acc + v.valor_fechado, 0);
    const faturamentoOutros = outros.reduce((acc, v) => acc + v.valor_fechado, 0);

    return {
      totalFaturado, ticketMedio, vendasNoPeriodo, taxaConversao, maiorVenda,
      faturamentoConsultas, faturamentoProcedimentos, faturamentoOutros,
      qtdConsultas: consultas.length, qtdProcedimentos: procedimentos.length,
    };
  }, [vendas, isLoading]);

  // ── Filtered vendas ────────────────────────────────────────

  const filteredVendas = useMemo(() => {
    if (!searchQuery.trim()) return vendas;
    const q = searchQuery.toLowerCase();
    return vendas.filter(v =>
      (v.leads?.nome || "").toLowerCase().includes(q) ||
      (v.produto_servico || "").toLowerCase().includes(q) ||
      (v.forma_pagamento || "").toLowerCase().includes(q)
    );
  }, [vendas, searchQuery]);

  // ── Handlers ───────────────────────────────────────────────

  const handleEdit = (venda: Venda) => {
    setEditingVenda(venda);
    setIsModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    if (!open) setEditingVenda(null);
    setIsModalOpen(open);
  };

  const handleDeleteRequest = (venda: Venda) => setIsDeleting(venda);

  const confirmDelete = () => {
    if (isDeleting) deleteVenda(isDeleting.id);
    setIsDeleting(null);
  };

  // ── Greeting ───────────────────────────────────────────────

  const firstName = profile?.nome_completo?.split(" ")[0] || "Gestor";

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">
      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex flex-col gap-5" data-tutorial="vendas-header">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Vendas
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Acompanhe o faturamento e gerencie as vendas do período
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap" data-tutorial="vendas-filters">
            <DateRangePicker
              date={dateRange}
              setDate={setDateRange}
              className="[&>button]:h-9 [&>button]:text-xs [&>button]:rounded-lg"
            />
            <ExportVendasButton vendas={vendas} dateRange={dateRange} />
            <Button
              onClick={() => handleCloseModal(true)}
              className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 shadow-none w-full sm:w-auto"
              data-tutorial="vendas-new"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar Venda
            </Button>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tutorial="vendas-metrics">
          {[
            {
              label: "Faturamento",
              value: formatCurrency(metrics.totalFaturado),
              icon: DollarSign,
              accent: true,
            },
            {
              label: "Ticket Medio",
              value: formatCurrency(metrics.ticketMedio),
              icon: TrendingUp,
            },
            {
              label: "Vendas",
              value: metrics.vendasNoPeriodo.toString(),
              icon: ShoppingCart,
            },
            {
              label: "Maior Venda",
              value: formatCurrency(metrics.maiorVenda),
              icon: TrendingUp,
            },
          ].map((stat) => (
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
                "text-xl font-extrabold tracking-tight font-display",
                stat.accent ? "text-primary" : "text-foreground"
              )}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ COMPOSIÇÃO DO FATURAMENTO ═══ */}
      {!isLoading && vendas.length > 0 && (metrics.faturamentoConsultas > 0 || metrics.faturamentoProcedimentos > 0) && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">COMPOSIÇÃO DO FATURAMENTO</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Distribuição entre consultas e procedimentos</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* Barra de proporção */}
            {metrics.totalFaturado > 0 && (
              <div className="space-y-1.5">
                <div className="h-2.5 rounded-full overflow-hidden flex bg-muted/40">
                  {metrics.faturamentoProcedimentos > 0 && (
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(metrics.faturamentoProcedimentos / metrics.totalFaturado) * 100}%` }}
                    />
                  )}
                  {metrics.faturamentoConsultas > 0 && (
                    <div
                      className="h-full bg-blue-400 transition-all"
                      style={{ width: `${(metrics.faturamentoConsultas / metrics.totalFaturado) * 100}%` }}
                    />
                  )}
                  {metrics.faturamentoOutros > 0 && (
                    <div
                      className="h-full bg-muted-foreground/30 transition-all"
                      style={{ width: `${(metrics.faturamentoOutros / metrics.totalFaturado) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}
            {/* Cards de breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100/80 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/60">Procedimentos</span>
                </div>
                <p className="text-lg font-extrabold text-emerald-800 font-display tabular-nums leading-tight">
                  {formatCurrency(metrics.faturamentoProcedimentos)}
                </p>
                <p className="text-[10px] text-emerald-700/50 mt-0.5">
                  {metrics.qtdProcedimentos} venda{metrics.qtdProcedimentos !== 1 ? "s" : ""} ·{" "}
                  {metrics.totalFaturado > 0
                    ? Math.round((metrics.faturamentoProcedimentos / metrics.totalFaturado) * 100)
                    : 0}%
                </p>
              </div>
              <div className="rounded-xl bg-blue-50/60 border border-blue-100/80 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700/60">Consultas</span>
                </div>
                <p className="text-lg font-extrabold text-blue-800 font-display tabular-nums leading-tight">
                  {formatCurrency(metrics.faturamentoConsultas)}
                </p>
                <p className="text-[10px] text-blue-700/50 mt-0.5">
                  {metrics.qtdConsultas} consulta{metrics.qtdConsultas !== 1 ? "s" : ""} ·{" "}
                  {metrics.totalFaturado > 0
                    ? Math.round((metrics.faturamentoConsultas / metrics.totalFaturado) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {[
          { id: "registros" as const, label: "Registros", icon: Receipt },
          { id: "relatorios" as const, label: "Relatórios", icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold rounded-lg transition-all",
              activeTab === tab.id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TABLE SECTION ═══ */}
      {activeTab === "registros" && <div data-tutorial="vendas-list">
        {/* Section Header + Search */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Historico de Vendas
            </span>
            {filteredVendas.length > 0 && (
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                {filteredVendas.length}
              </span>
            )}
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Buscar cliente, servico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs bg-muted/30 border-border/40 rounded-lg placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded w-full" />
              </div>
            ))
          ) : filteredVendas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-border/60 bg-card">
              <div className="bg-muted/30 p-5 rounded-2xl mb-4">
                <Receipt className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Nenhuma venda encontrada</p>
              <p className="text-xs text-muted-foreground/60">
                {searchQuery ? "Tente outro termo de busca" : "Registre a primeira venda do período"}
              </p>
            </div>
          ) : (
            filteredVendas.map((venda) => (
              <div
                key={venda.id}
                className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 space-y-3 hover:border-border transition-colors group"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {(venda.leads?.nome || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-semibold text-foreground truncate">
                          {venda.leads?.nome || "Cliente não encontrado"}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <p className="text-[11px] text-muted-foreground/60 truncate">
                            {venda.produto_servico || "Sem serviço"}
                          </p>
                          {venda.tipo_venda && (
                            <span className={cn(
                              "inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0",
                              venda.tipo_venda === "consulta"
                                ? "bg-blue-50 text-blue-700 border-blue-200/60"
                                : venda.tipo_venda === "procedimento"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                                : "bg-muted/50 text-muted-foreground border-border/40"
                            )}>
                              {venda.tipo_venda === "consulta" ? "Consulta" : venda.tipo_venda === "procedimento" ? "Procedimento" : "Outro"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(venda)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(venda)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50/60 rounded-xl px-3 py-2 border border-emerald-200/40">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/60 block mb-0.5">
                      Valor Fechado
                    </span>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(venda.valor_fechado)}
                    </span>
                  </div>
                  <div className="bg-muted/30 rounded-xl px-3 py-2 border border-border/40">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mb-0.5">
                      Pagamento
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CreditCard className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-xs font-medium text-foreground truncate">
                        {venda.forma_pagamento || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center pt-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground/50">
                    <CalendarIcon className="h-3 w-3" />
                    <span className="text-[11px] tabular-nums">
                      {format(parseISO(venda.data_fechamento), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest py-3 pl-5">
                  Cliente
                </TableHead>
                <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest py-3">
                  Servico / Produto
                </TableHead>
                <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest py-3">
                  Valor Fechado
                </TableHead>
                <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest py-3">
                  Data
                </TableHead>
                <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest py-3">
                  Pagamento
                </TableHead>
                <TableHead className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest py-3 pr-5 text-right">
                  Acoes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border/30">
                    <TableCell className="pl-5"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="pr-5"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredVendas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-muted/30 p-5 rounded-2xl mb-4">
                        <Receipt className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Nenhuma venda encontrada</p>
                      <p className="text-xs text-muted-foreground/60">
                        {searchQuery ? "Tente outro termo de busca" : "Registre a primeira venda do período"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendas.map((venda, idx) => (
                  <TableRow
                    key={venda.id}
                    className="group border-b border-border/30 hover:bg-muted/20 transition-colors"
                    {...(idx === 0 ? { "data-tutorial": "vendas-row" } : {})}
                  >
                    {/* Cliente */}
                    <TableCell className="pl-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-muted-foreground">
                            {(venda.leads?.nome || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[13px] font-medium text-foreground truncate max-w-[180px]">
                          {venda.leads?.nome || "Cliente não encontrado"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Servico */}
                    <TableCell className="py-3.5">
                      <div className="flex flex-col gap-1 max-w-[160px]">
                        <span className="text-xs text-muted-foreground truncate block">
                          {venda.produto_servico || "—"}
                        </span>
                        {venda.tipo_venda && (
                          <span className={cn(
                            "inline-flex w-fit items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border",
                            venda.tipo_venda === "consulta"
                              ? "bg-blue-50 text-blue-700 border-blue-200/60"
                              : venda.tipo_venda === "procedimento"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                              : "bg-muted/50 text-muted-foreground border-border/40"
                          )}>
                            {venda.tipo_venda === "consulta" ? "Consulta" : venda.tipo_venda === "procedimento" ? "Procedimento" : "Outro"}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Valor Fechado */}
                    <TableCell className="py-3.5">
                      <span className="text-[13px] font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(venda.valor_fechado)}
                      </span>
                    </TableCell>

                    {/* Data */}
                    <TableCell className="py-3.5">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(parseISO(venda.data_fechamento), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </TableCell>

                    {/* Pagamento */}
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md bg-muted/50 border border-border/40 text-muted-foreground">
                        <CreditCard className="h-3 w-3" />
                        {venda.forma_pagamento || "N/A"}
                      </span>
                    </TableCell>

                    {/* Acoes */}
                    <TableCell className="pr-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(venda)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(venda)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>}

      {/* ═══ RELATÓRIOS ═══ */}
      {activeTab === "relatorios" && (
        <VendasRelatorios vendas={vendas} isLoading={isLoading} dateRange={dateRange} />
      )}

      {/* ═══ MODAL ═══ */}
      <VendaModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        venda={editingVenda}
      />

      {/* ═══ DELETE DIALOG ═══ */}
      <AlertDialog open={!!isDeleting} onOpenChange={() => setIsDeleting(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Esta ação não pode ser desfeita. A venda de{" "}
              <strong>{isDeleting?.leads?.nome || "este cliente"}</strong> no valor de{" "}
              <strong>{isDeleting?.valor_fechado ? formatCurrency(isDeleting.valor_fechado) : "R$ 0,00"}</strong>{" "}
              será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl text-xs h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 rounded-xl text-xs h-9"
            >
              Sim, excluir venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
