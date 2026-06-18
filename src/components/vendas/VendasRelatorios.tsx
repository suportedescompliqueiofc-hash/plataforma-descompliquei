import { useMemo } from "react";
import { Venda } from "@/hooks/useVendas";
import {
  format, parseISO, eachDayOfInterval, isSameDay,
  differenceInCalendarDays, eachWeekOfInterval, endOfWeek, min as dateMin,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartTooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart,
  CreditCard, Package, Users, BarChart2, Percent, Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Tipos ──────────────────────────────────────────────────────

interface Props {
  vendas: Venda[];
  isLoading: boolean;
  dateRange?: DateRange;
}

// ── Helpers ────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function initials(nome: string) {
  return nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const PAYMENT_COLORS: Record<string, string> = {
  pix: "#10b981",
  "cartão de crédito": "#6366f1",
  "cartão de débito": "#8b5cf6",
  "crédito": "#6366f1",
  "débito": "#8b5cf6",
  dinheiro: "#f59e0b",
  boleto: "#3b82f6",
  financiamento: "#ec4899",
  transferência: "#14b8a6",
};
const FALLBACK_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

const FAIXAS = [
  { label: "Até R$ 500",    min: 0,    max: 500 },
  { label: "R$ 500–1k",     min: 500,  max: 1_000 },
  { label: "R$ 1k–2k",      min: 1_000,max: 2_000 },
  { label: "R$ 2k–5k",      min: 2_000,max: 5_000 },
  { label: "Acima de R$ 5k",min: 5_000,max: Infinity },
];

// ── Tooltips customizados ──────────────────────────────────────

function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-lg px-3 py-2.5 text-xs">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-foreground">{fmt(payload[0].value)}</p>
      {payload[0].payload.count > 0 && (
        <p className="text-muted-foreground mt-0.5">
          {payload[0].payload.count} venda{payload[0].payload.count !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-lg px-3 py-2.5 text-xs">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-foreground">{payload[0].value} venda{payload[0].value !== 1 ? "s" : ""}</p>
      {payload[0].payload.total > 0 && (
        <p className="text-muted-foreground mt-0.5">{fmt(payload[0].payload.total)}</p>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────

export function VendasRelatorios({ vendas, isLoading, dateRange }: Props) {

  const analytics = useMemo(() => {
    if (!vendas.length) return null;

    const valores = vendas.map(v => v.valor_fechado);
    const totalFaturado = valores.reduce((a, b) => a + b, 0);
    const ticketMedio = totalFaturado / vendas.length;
    const maiorVenda = Math.max(...valores);
    const menorVenda = Math.min(...valores);

    // Desconto médio
    const comOrcamento = vendas.filter(v => v.valor_orcado && v.valor_orcado > 0);
    const descMedio = comOrcamento.length > 0
      ? comOrcamento.reduce((acc, v) => {
          const d = ((v.valor_orcado! - v.valor_fechado) / v.valor_orcado!) * 100;
          return acc + d;
        }, 0) / comOrcamento.length
      : null;

    // Faturamento médio por dia no período
    const dias = dateRange?.from && dateRange?.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
      : null;
    const faturamentoDia = dias ? totalFaturado / dias : null;

    // ── Evolução temporal (diária ou semanal) ──────────────────
    let dailyData: { label: string; value: number; count: number }[] = [];
    if (dateRange?.from && dateRange?.to) {
      const diffDias = differenceInCalendarDays(dateRange.to, dateRange.from);
      if (diffDias <= 45) {
        // Diário
        dailyData = eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).map(day => {
          const dayVendas = vendas.filter(v => isSameDay(parseISO(v.data_fechamento), day));
          return {
            label: format(day, "dd/MM", { locale: ptBR }),
            value: dayVendas.reduce((a, v) => a + v.valor_fechado, 0),
            count: dayVendas.length,
          };
        });
      } else {
        // Semanal
        dailyData = eachWeekOfInterval(
          { start: dateRange.from, end: dateRange.to },
          { weekStartsOn: 1 }
        ).map(weekStart => {
          const weekEnd = dateMin([endOfWeek(weekStart, { weekStartsOn: 1 }), dateRange.to!]);
          const weekVendas = vendas.filter(v => {
            const d = parseISO(v.data_fechamento);
            return d >= weekStart && d <= weekEnd;
          });
          return {
            label: format(weekStart, "dd/MM", { locale: ptBR }),
            value: weekVendas.reduce((a, v) => a + v.valor_fechado, 0),
            count: weekVendas.length,
          };
        });
      }
    }

    // ── Formas de pagamento ────────────────────────────────────
    const paymentMap = new Map<string, { total: number; count: number }>();
    vendas.forEach(v => {
      const key = (v.forma_pagamento || "Não informado").toLowerCase().trim();
      const ex = paymentMap.get(key) || { total: 0, count: 0 };
      paymentMap.set(key, { total: ex.total + v.valor_fechado, count: ex.count + 1 });
    });
    const paymentData = Array.from(paymentMap.entries())
      .map(([name, { total, count }], idx) => ({
        name,
        displayName: capitalize(name),
        total,
        count,
        pct: (total / totalFaturado) * 100,
        color: PAYMENT_COLORS[name] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      }))
      .sort((a, b) => b.total - a.total);

    // ── Top serviços ───────────────────────────────────────────
    const serviceMap = new Map<string, { total: number; count: number }>();
    vendas.forEach(v => {
      const key = v.produto_servico?.trim() || "Não informado";
      const ex = serviceMap.get(key) || { total: 0, count: 0 };
      serviceMap.set(key, { total: ex.total + v.valor_fechado, count: ex.count + 1 });
    });
    const topServices = Array.from(serviceMap.entries())
      .map(([name, { total, count }]) => ({
        name,
        total,
        count,
        pct: (total / totalFaturado) * 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // ── Top clientes ───────────────────────────────────────────
    const clientMap = new Map<string, { nome: string; total: number; count: number }>();
    vendas.forEach(v => {
      const key = v.lead_id || v.leads?.nome || "desconhecido";
      const nome = v.leads?.nome || "Cliente";
      const ex = clientMap.get(key) || { nome, total: 0, count: 0 };
      clientMap.set(key, { nome, total: ex.total + v.valor_fechado, count: ex.count + 1 });
    });
    const topClients = Array.from(clientMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // ── Faixas de valor ────────────────────────────────────────
    const faixasData = FAIXAS.map(faixa => {
      const faixaVendas = vendas.filter(v => v.valor_fechado >= faixa.min && v.valor_fechado < faixa.max);
      return {
        label: faixa.label,
        count: faixaVendas.length,
        total: faixaVendas.reduce((a, v) => a + v.valor_fechado, 0),
      };
    });

    // ── Composição por tipo ────────────────────────────────────
    const tipoConsultas = vendas.filter(v => v.tipo_venda === "consulta");
    const tipoProcedimentos = vendas.filter(v => !v.tipo_venda || v.tipo_venda === "procedimento");
    const tipoOutros = vendas.filter(v => v.tipo_venda === "outro");
    const tipoData = [
      { label: "Procedimentos", count: tipoProcedimentos.length, total: tipoProcedimentos.reduce((a, v) => a + v.valor_fechado, 0), color: "#10b981" },
      { label: "Consultas", count: tipoConsultas.length, total: tipoConsultas.reduce((a, v) => a + v.valor_fechado, 0), color: "#60a5fa" },
      ...(tipoOutros.length > 0 ? [{ label: "Outros", count: tipoOutros.length, total: tipoOutros.reduce((a, v) => a + v.valor_fechado, 0), color: "#94a3b8" }] : []),
    ].filter(t => t.count > 0);

    return {
      totalFaturado, ticketMedio, maiorVenda, menorVenda,
      descMedio, faturamentoDia, dias,
      dailyData, paymentData, topServices, topClients, faixasData, tipoData,
      totalVendas: vendas.length,
      servicosUnicos: serviceMap.size,
    };
  }, [vendas, dateRange]);

  // ── Loading ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <BarChart2 className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nenhum dado para analisar</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">Registre vendas no período para ver os relatórios</p>
      </div>
    );
  }

  const {
    totalFaturado, ticketMedio, maiorVenda, menorVenda,
    descMedio, faturamentoDia, dias,
    dailyData, paymentData, topServices, topClients, faixasData, tipoData,
    totalVendas, servicosUnicos,
  } = analytics;

  const maxService = topServices[0]?.total || 1;
  const maxClient = topClients[0]?.total || 1;
  const maxFaixa = Math.max(...faixasData.map(f => f.count), 1);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Faturamento", value: fmt(totalFaturado), icon: DollarSign, accent: true },
          { label: "Ticket Médio", value: fmt(ticketMedio), icon: TrendingUp },
          { label: "Maior Venda", value: fmt(maiorVenda), icon: TrendingUp },
          { label: "Menor Venda", value: fmt(menorVenda), icon: TrendingDown },
          {
            label: "Média / Dia",
            value: faturamentoDia ? fmt(faturamentoDia) : "—",
            sub: dias ? `${dias} dias` : undefined,
            icon: Calendar,
          },
          {
            label: "Desc. Médio",
            value: descMedio !== null ? `${descMedio.toFixed(1)}%` : "—",
            sub: descMedio !== null ? "sobre orçado" : "sem orçamentos",
            icon: Percent,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={cn(
              "rounded-2xl px-4 py-3.5 border transition-colors",
              kpi.accent
                ? "bg-emerald-50/60 border-emerald-200/50"
                : "bg-card border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <kpi.icon className={cn("h-3 w-3", kpi.accent ? "text-emerald-600" : "text-muted-foreground")} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </span>
            </div>
            <p className={cn(
              "text-lg font-extrabold tracking-tight font-display leading-none",
              kpi.accent ? "text-emerald-700" : "text-foreground"
            )}>
              {kpi.value}
            </p>
            {kpi.sub && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* ═══ Composição por Tipo ═══ */}
      {tipoData.length >= 2 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">COMPOSIÇÃO POR TIPO</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Distribuição entre consultas e procedimentos</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="h-2.5 rounded-full overflow-hidden flex bg-muted/40">
              {tipoData.map(t => (
                <div
                  key={t.label}
                  className="h-full transition-all"
                  style={{ width: `${(t.total / totalFaturado) * 100}%`, backgroundColor: t.color }}
                />
              ))}
            </div>
            <div className={cn("grid gap-3", tipoData.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {tipoData.map(t => (
                <div key={t.label} className="rounded-xl px-4 py-3 border"
                  style={{ backgroundColor: `${t.color}12`, borderColor: `${t.color}40` }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${t.color}CC` }}>
                      {t.label}
                    </span>
                  </div>
                  <p className="text-lg font-extrabold font-display tabular-nums leading-tight text-foreground">
                    {fmt(t.total)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {t.count} venda{t.count !== 1 ? "s" : ""} · {totalFaturado > 0 ? Math.round((t.total / totalFaturado) * 100) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Evolução + Pagamentos ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

        {/* Evolução temporal */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  EVOLUÇÃO DE FATURAMENTO
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {dias && dias > 45 ? "Agrupado por semana" : "Faturamento diário no período"}
                </p>
              </div>
            </div>
          </div>
          <div className="p-5">
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground/40 text-xs">
                Selecione um período para ver a evolução
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval={dailyData.length > 20 ? Math.ceil(dailyData.length / 10) : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    width={40}
                  />
                  <RechartTooltip content={<AreaTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#areaGradient)"
                    dot={dailyData.length <= 20 ? { fill: "#10b981", r: 3, strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Formas de Pagamento */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  FORMAS DE PAGAMENTO
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Distribuição por método</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {paymentData.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground/40 text-xs">
                Sem dados de pagamento
              </div>
            ) : (
              paymentData.map((p, i) => (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-[12px] font-medium text-foreground truncate max-w-[120px]">
                        {p.displayName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                        {p.count}x
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-foreground tabular-nums">
                        {fmt(p.total)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums w-10 text-right">
                        {p.pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${p.pct}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ Top Serviços + Top Clientes ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top Serviços */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    TOP SERVIÇOS
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{servicosUnicos} serviço{servicosUnicos !== 1 ? "s" : ""} no período</p>
                </div>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {topServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-6 w-6 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground/50">Nenhum serviço registrado</p>
              </div>
            ) : (
              topServices.map((s, i) => (
                <div key={s.name} className="px-5 py-3 hover:bg-muted/20 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums w-5 text-center shrink-0",
                      i === 0 ? "text-amber-500" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-orange-400" : "text-muted-foreground/40"
                    )}>
                      {i + 1}º
                    </span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-foreground truncate">{s.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground/60">{s.count}x</span>
                          <span className="text-[12px] font-bold text-foreground tabular-nums">{fmt(s.total)}</span>
                          <span className="text-[10px] text-muted-foreground/50 w-8 text-right">{s.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${(s.total / maxService) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Clientes */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  TOP CLIENTES
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Por faturamento no período</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {topClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-6 w-6 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground/50">Nenhum cliente encontrado</p>
              </div>
            ) : (
              topClients.map((c, i) => (
                <div key={c.nome + i} className="px-5 py-3 hover:bg-muted/20 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums w-5 text-center shrink-0",
                      i === 0 ? "text-amber-500" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-orange-400" : "text-muted-foreground/40"
                    )}>
                      {i + 1}º
                    </span>
                    <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">{initials(c.nome)}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-foreground truncate">{c.nome}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground/60">{c.count}x</span>
                          <span className="text-[12px] font-bold text-foreground tabular-nums">{fmt(c.total)}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${(c.total / maxClient) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ Distribuição por Faixa de Valor ═══ */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                DISTRIBUIÇÃO POR FAIXA DE VALOR
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Concentração de vendas por ticket</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-5 gap-3">
            {faixasData.map((f, i) => {
              const pct = maxFaixa > 0 ? (f.count / maxFaixa) * 100 : 0;
              const totalPct = totalVendas > 0 ? (f.count / totalVendas) * 100 : 0;
              return (
                <div key={f.label} className="flex flex-col items-center gap-2">
                  {/* Barra vertical */}
                  <div className="w-full flex flex-col items-center gap-1">
                    <span className="text-[11px] font-bold text-foreground tabular-nums">{f.count}</span>
                    <div className="w-full h-24 bg-muted/40 rounded-lg overflow-hidden flex items-end">
                      <div
                        className="w-full rounded-t-lg transition-all duration-500"
                        style={{
                          height: `${Math.max(pct, f.count > 0 ? 4 : 0)}%`,
                          backgroundColor: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground leading-tight">
                      {f.label}
                    </p>
                    {f.total > 0 && (
                      <p className="text-[10px] text-muted-foreground/60 tabular-nums mt-0.5">
                        {fmt(f.total)}
                      </p>
                    )}
                    <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                      {totalPct.toFixed(0)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
