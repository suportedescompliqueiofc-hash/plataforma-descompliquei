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
import { PageHero } from "@/components/PageHero";
import { StatCard, StatCardGrid } from "@/components/StatCard";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { useState } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";

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
            <span className="text-[13px] font-bold text-foreground font-display tabular-nums">{entry.value}</span>
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

  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(undefined);

  const { metrics, isLoading } = useDashboard(dateRange, 'geral', selectedMemberId);
  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null;

  // Delegam para @/lib/format (fonte única da verdade de formatação).
  const fmtCurrency = formatBRL;

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
    { label: "LEADS ATIVOS",  value: formatInt(totalLeads),   icon: UserPlus,      dot: undefined,  rate: null },
    { label: "QUALIFICADOS",  value: formatInt(mql),          icon: BadgeCheck,    dot: "#10b981",  rate: formatPct(taxaMQL) },
    { label: "AGENDAMENTOS",  value: formatInt(agend),        icon: CalendarCheck, dot: "#8b5cf6",  rate: formatPct(taxaAgend) },
    { label: "FECHAMENTOS",   value: formatInt(fechados),     icon: Trophy,        dot: "#3b82f6",  rate: formatPct(taxaFech) },
    { label: "FATURAMENTO",   value: fmtCurrency(faturamento),icon: DollarSign,    dot: "#10b981",  rate: ticketMedio > 0 ? `TM ${fmtCurrency(ticketMedio)}` : null },
  ];

  const funnelSteps = [
    { label: "Leads",   value: totalLeads, color: "#6366f1", icon: Users },
    { label: "MQL",     value: mql,        color: "#10b981", icon: BadgeCheck },
    { label: "Agend.",  value: agend,      color: "#8b5cf6", icon: CalendarCheck },
    { label: "Fechados",value: fechados,   color: "#3b82f6", icon: Trophy },
  ];
  const funnelRates = [
    totalLeads > 0 ? formatPct(taxaMQL) : "—",
    mql > 0        ? formatPct(taxaAgend) : "—",
    agend > 0      ? formatPct(taxaFech) : "—",
  ];

  const chartData = metrics?.leadsOverTime?.map((d: any) => ({ day: d.day, Leads: d.captados })) ?? [];
  const topProcs  = metrics?.topProcedimentos ?? [];
  const ag        = metrics?.agendamentos;

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-5">

      {/* ── Page Header ── */}
      <PageHero
        dataTutorial="equipe-header"
        icon={Users}
        title="Equipe"
        subtitle="Desempenho individual e comparativo da equipe comercial"
      />

      {/* ── Toolbar: período ── */}
      <div className="flex justify-end" data-tutorial="equipe-period">
        <DateRangePicker date={dateRange} setDate={setDateRange} />
      </div>

      {/* ── Seletor de Membro ── */}
      <div data-tutorial="equipe-members" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
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
              <p className="text-sm font-semibold text-foreground font-display">{selectedMember.nome}</p>
              <p className="text-[11px] text-muted-foreground">{selectedMember.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Strip ── */}
      <div data-tutorial="equipe-kpis" className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border/40 bg-muted/[0.03]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">VISÃO GERAL DO PERÍODO</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          </div>
        ) : (
          <StatCardGrid cols={5} bare>
            {kpis.map((kpi, i) => (
              <StatCard
                key={i}
                icon={kpi.icon}
                dotColor={kpi.dot}
                label={kpi.label}
                value={kpi.value}
              />
            ))}
          </StatCardGrid>
        )}
      </div>

      {/* ── Funil de Conversão ── */}
      <div data-tutorial="equipe-funnel" className="rounded-2xl border border-border/60 bg-card overflow-hidden">
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
        <StatCardGrid cols={4} bare flush>
          {funnelSteps.map((step, i) => {
            const Icon = step.icon;
            const maxVal = funnelSteps[0].value || 1;
            const pct = Math.round((step.value / maxVal) * 100);
            return (
              <div key={i} className="relative">
                <StatCard icon={Icon} dotColor={step.color} label={step.label} value={formatInt(step.value)} />
                <div className="px-4 sm:px-6 pb-5 -mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                  </div>
                  {i < funnelSteps.length - 1 && (
                    <span className="text-[10px] font-semibold font-display tabular-nums px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ color: funnelSteps[i + 1].color, backgroundColor: funnelSteps[i + 1].color + '15' }}>
                      {funnelRates[i]}
                    </span>
                  )}
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
        </StatCardGrid>
      </div>

      {/* ── Evolução + Top Procedimentos ── */}
      <div data-tutorial="equipe-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
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
                  <span className="text-sm font-semibold text-emerald-600 font-display tabular-nums">
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
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
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
          <StatCardGrid cols={3} bare className="xl:grid-cols-6">
            {[
              { label: "Total",          value: formatInt(ag.total),       dot: undefined },
              { label: "Realizados",     value: formatInt(ag.realizados),  dot: "#10b981" },
              { label: "Confirmados",    value: formatInt(ag.confirmados), dot: "#3b82f6" },
              { label: "No-show",        value: formatInt(ag.noShow),      dot: "#f43f5e" },
              { label: "Cancelados",     value: formatInt(ag.cancelados),  dot: undefined },
              { label: "Comparecimento", value: formatPct(ag.taxaComparecimento),
                dot: ag.taxaComparecimento >= 70 ? "#10b981" : "#f59e0b" },
            ].map((item, i) => (
              <StatCard key={i} dotColor={item.dot} label={item.label} value={item.value} />
            ))}
          </StatCardGrid>
        </div>
      )}

      {/* ── Taxas de Conversão ── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
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
        <StatCardGrid cols={4} bare>
          {[
            { label: "Taxa MQL",        value: formatPct(taxaMQL),    desc: "Leads → Qualificados",     color: "#10b981" },
            { label: "Taxa Agendamento",value: formatPct(taxaAgend),  desc: "Qualificados → Agendados", color: "#8b5cf6" },
            { label: "Taxa Fechamento", value: formatPct(taxaFech),   desc: "Agendados → Fechados",     color: "#3b82f6" },
            { label: "Conversão Global",value: formatPct(taxaGlobal), desc: "Leads → Fechados",         color: "#f59e0b" },
          ].map((item, i) => (
            <StatCard key={i} dotColor={item.color} label={item.label} value={item.value} sublabel={item.desc} />
          ))}
        </StatCardGrid>
      </div>

    </div>
  );
}
