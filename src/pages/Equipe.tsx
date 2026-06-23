import {
  Users, UserPlus, BadgeCheck, CalendarCheck, DollarSign,
  TrendingUp, ChevronRight, Activity,
  Trophy, Layers, Stethoscope,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useDashboard } from "@/hooks/useDashboard";
import { useTeamMembersForSelect } from "@/hooks/useTeamMembersForSelect";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
} from "date-fns";
import { DateRange } from "react-day-picker";

type PeriodKey = "dia" | "semana" | "mes" | "ano";

function getPeriodRange(key: PeriodKey): DateRange {
  const now = new Date();
  switch (key) {
    case "dia":    return { from: startOfDay(now), to: endOfDay(now) };
    case "semana": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "mes":    return { from: startOfMonth(now), to: endOfMonth(now) };
    case "ano":    return { from: startOfYear(now), to: endOfYear(now) };
  }
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-[13px] font-semibold text-foreground mb-2 pb-1.5 border-b border-border/60">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6 py-0.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-[13px] font-bold text-foreground font-mono tabular-nums">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PremiumDot = ({ cx, cy, stroke }: any) => (
  <g>
    <circle cx={cx} cy={cy} r={6} fill={stroke} fillOpacity={0.15} />
    <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={stroke} strokeWidth={2} />
  </g>
);

const PremiumLegend = ({ payload }: any) => (
  <div className="flex items-center justify-center gap-5 pt-3">
    {payload?.map((entry: any, i: number) => (
      <div key={i} className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
        <span className="text-[11px] text-muted-foreground font-medium">{entry.value}</span>
      </div>
    ))}
  </div>
);

function Avatar({ nome, url_avatar, size = "md" }: { nome: string; url_avatar?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const sz = size === "sm" ? "h-7 w-7 text-[11px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  if (url_avatar) return <img src={url_avatar} className={cn("rounded-full object-cover flex-shrink-0", sz)} />;
  return (
    <div className={cn("rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground flex-shrink-0", sz)}>
      {initials}
    </div>
  );
}

export default function Equipe() {
  const { profile } = useProfile();
  const { members } = useTeamMembersForSelect();

  const [period, setPeriod] = useState<PeriodKey>("mes");
  const dateRange = getPeriodRange(period);
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(undefined);

  const { metrics, isLoading } = useDashboard(dateRange, 'geral', selectedMemberId);
  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtCurrency = (v: number) => `R$ ${fmt(v)}`;

  const totalLeads = metrics?.totalLeadsAtivos ?? 0;
  const mql       = metrics?.mqlCount ?? 0;
  const agend     = metrics?.scheduledCount ?? 0;
  const fechados  = metrics?.closedCount ?? 0;
  const faturamento = metrics?.faturamentoTotal ?? 0;
  const ticketMedio = metrics?.ticketMedio ?? 0;
  const taxaMQL   = metrics?.taxaMQL ?? 0;
  const taxaAgend = metrics?.taxaAgendamento ?? 0;
  const taxaFech  = metrics?.taxaFechamento ?? 0;
  const taxaGlobal = metrics?.taxaConversaoGlobal ?? 0;

  const kpis = [
    { label: "LEADS ATIVOS",  value: totalLeads,              icon: UserPlus,     color: "text-foreground",  rate: null },
    { label: "QUALIFICADOS",  value: mql,                     icon: BadgeCheck,   color: "text-emerald-600", rate: `${taxaMQL}%` },
    { label: "AGENDAMENTOS",  value: agend,                   icon: CalendarCheck,color: "text-violet-600",  rate: `${taxaAgend}%` },
    { label: "FECHAMENTOS",   value: fechados,                icon: Trophy,       color: "text-blue-600",    rate: `${taxaFech}%` },
    { label: "FATURAMENTO",   value: fmtCurrency(faturamento),icon: DollarSign,   color: "text-emerald-600", rate: ticketMedio > 0 ? `TM ${fmtCurrency(ticketMedio)}` : null },
  ];

  const funnelSteps = [
    { label: "Leads",   value: totalLeads, color: "#6366f1", icon: Users },
    { label: "MQL",     value: mql,        color: "#10b981", icon: BadgeCheck },
    { label: "Agend.",  value: agend,      color: "#8b5cf6", icon: CalendarCheck },
    { label: "Fechados",value: fechados,   color: "#3b82f6", icon: Trophy },
  ];
  const funnelRates = [
    totalLeads > 0 ? `${taxaMQL}%` : "—",
    mql > 0        ? `${taxaAgend}%` : "—",
    agend > 0      ? `${taxaFech}%` : "—",
  ];

  const chartData = metrics?.leadsOverTime?.map((d: any) => ({ day: d.day, Leads: d.captados })) ?? [];
  const topProcs  = metrics?.topProcedimentos ?? [];
  const ag        = metrics?.agendamentos;

  const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: "dia", label: "Dia" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
    { key: "ano", label: "Ano" },
  ];

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 max-w-[1400px] mx-auto">

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">Equipe</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">
            Desempenho individual e comparativo da equipe comercial
          </p>
        </div>

        {/* Período */}
        <div className="flex items-center bg-muted/40 rounded-xl p-1 gap-0.5">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                period === p.key
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Seletor de Membro ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border/40 bg-muted/[0.03]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">VISUALIZAR POR MEMBRO</p>
        </div>
        <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedMemberId(undefined)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all",
              !selectedMemberId
                ? "bg-foreground text-background border-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Todos
          </button>
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMemberId(m.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all",
                selectedMemberId === m.id
                  ? "bg-foreground text-background border-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Avatar nome={m.nome} url_avatar={m.url_avatar} size="sm" />
              {m.nome.split(" ")[0]}
            </button>
          ))}
        </div>
        {selectedMember && (
          <div className="px-4 sm:px-5 py-2.5 border-t border-border/40 bg-muted/20 flex items-center gap-2.5">
            <Avatar nome={selectedMember.nome} url_avatar={selectedMember.url_avatar} size="md" />
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedMember.nome}</p>
              <p className="text-[11px] text-muted-foreground">{selectedMember.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Strip ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border/40 bg-muted/[0.03]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">VISÃO GERAL DO PERÍODO</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 bg-border/40 gap-px">
            {kpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="bg-card px-4 sm:px-6 py-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em] leading-tight">{kpi.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={cn("text-2xl sm:text-[32px] font-bold font-display leading-none tracking-tight", kpi.color)}>
                      {kpi.value}
                    </span>
                    {kpi.rate && (
                      <span className="text-xs font-semibold text-muted-foreground font-mono">{kpi.rate}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Funil de Conversão ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">FUNIL DE CONVERSÃO</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Progresso passo a passo no período</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 bg-border/40 gap-px">
          {funnelSteps.map((step, i) => {
            const Icon = step.icon;
            const maxVal = funnelSteps[0].value || 1;
            const pct = Math.round((step.value / maxVal) * 100);
            return (
              <div key={i} className="bg-card relative px-4 sm:px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em]">{step.label}</span>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl sm:text-[32px] font-bold font-display text-foreground leading-none tracking-tight">
                    {step.value}
                  </span>
                  {i < funnelSteps.length - 1 && (
                    <span className="text-xs font-semibold font-mono px-1.5 py-0.5 rounded-md"
                      style={{ color: funnelSteps[i + 1].color, backgroundColor: funnelSteps[i + 1].color + '15' }}>
                      {funnelRates[i]}
                    </span>
                  )}
                </div>
                <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: step.color }} />
                </div>
                {/* Seta só em desktop (xl) onde as 4 colunas ficam lado a lado */}
                {i < funnelSteps.length - 1 && (
                  <div className="hidden xl:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-card border border-border/40 rounded-full p-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Evolução + Top Procedimentos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Evolução no Tempo */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">EVOLUÇÃO NO PERÍODO</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Leads captados por dia</p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend content={<PremiumLegend />} />
                  <Area type="monotone" dataKey="Leads" stroke="#6366f1" strokeWidth={2}
                    fill="url(#colorLeads)" dot={false} activeDot={<PremiumDot />} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Activity className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sem dados no período</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Procedimentos */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TOP PROCEDIMENTOS</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Vendas no período por procedimento</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {topProcs.length > 0 ? topProcs.slice(0, 6).map((proc: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] font-bold text-muted-foreground/50 w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium text-foreground truncate">{proc.name}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">{proc.count}×</span>
                  <span className="text-sm font-semibold text-emerald-600 font-mono tabular-nums">
                    {fmtCurrency(proc.revenue)}
                  </span>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Stethoscope className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhuma venda no período</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Agendamentos ── */}
      {ag && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">AGENDAMENTOS</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Status dos agendamentos no período</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 bg-border/40 gap-px">
            {[
              { label: "Total",          value: ag.total,       color: "text-foreground" },
              { label: "Realizados",     value: ag.realizados,  color: "text-emerald-600" },
              { label: "Confirmados",    value: ag.confirmados, color: "text-blue-600" },
              { label: "No-show",        value: ag.noShow,      color: "text-rose-600" },
              { label: "Cancelados",     value: ag.cancelados,  color: "text-muted-foreground" },
              { label: "Comparecimento", value: `${ag.taxaComparecimento}%`,
                color: ag.taxaComparecimento >= 70 ? "text-emerald-600" : "text-amber-600" },
            ].map((item, i) => (
              <div key={i} className="bg-card px-4 sm:px-5 py-4">
                <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em] mb-1 leading-tight">{item.label}</p>
                <span className={cn("text-xl sm:text-2xl font-bold font-display tracking-tight", item.color)}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Taxas de Conversão ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TAXAS DE CONVERSÃO</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Performance comercial no período</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 bg-border/40 gap-px">
          {[
            { label: "Taxa MQL",        value: `${taxaMQL}%`,    desc: "Leads → Qualificados",     color: "#10b981" },
            { label: "Taxa Agendamento",value: `${taxaAgend}%`,  desc: "Qualificados → Agendados", color: "#8b5cf6" },
            { label: "Taxa Fechamento", value: `${taxaFech}%`,   desc: "Agendados → Fechados",     color: "#3b82f6" },
            { label: "Conversão Global",value: `${taxaGlobal}%`, desc: "Leads → Fechados",         color: "#f59e0b" },
          ].map((item, i) => (
            <div key={i} className="bg-card px-4 sm:px-6 py-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em] mb-1 leading-tight">{item.label}</p>
              <p className="text-2xl sm:text-[32px] font-bold font-display tracking-tight leading-none"
                style={{ color: item.color }}>{item.value}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
