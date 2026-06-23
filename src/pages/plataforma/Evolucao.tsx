import { useState, Fragment, useRef } from 'react';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { useEvolucao, computeDelta, type DatePeriod, type PeriodMetrics } from '@/hooks/useEvolucao';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  TrendingUp, Users, Target, Calendar, DollarSign,
  MessageSquare, Bot, Activity, ArrowUp, ArrowDown, Minus,
  Loader2, Clock, BarChart3, UserCheck, ShieldCheck,
  ArrowRight, Lock, ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, subMonths, subDays, addDays,
  startOfQuarter, endOfQuarter, subQuarters, addQuarters,
  startOfYear, endOfYear, subYears, addYears,
  startOfWeek, endOfWeek, subWeeks, addWeeks,
  addMonths, format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';

const PRESETS = [
  {
    id: 'dia', label: 'Dia',
    getA: () => ({ from: new Date(), to: new Date() }),
    getB: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }),
  },
  {
    id: 'semana', label: 'Semana',
    getA: () => ({ from: startOfWeek(new Date(), { locale: ptBR }), to: endOfWeek(new Date(), { locale: ptBR }) }),
    getB: () => ({ from: startOfWeek(subWeeks(new Date(), 1), { locale: ptBR }), to: endOfWeek(subWeeks(new Date(), 1), { locale: ptBR }) }),
  },
  {
    id: 'mes', label: 'Mês',
    getA: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
    getB: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }),
  },
  {
    id: '30d', label: '30 dias',
    getA: () => ({ from: subDays(new Date(), 29), to: new Date() }),
    getB: () => ({ from: subDays(new Date(), 59), to: subDays(new Date(), 30) }),
  },
  {
    id: 'trimestre', label: 'Trimestre',
    getA: () => ({ from: startOfQuarter(new Date()), to: new Date() }),
    getB: () => ({ from: startOfQuarter(subQuarters(new Date(), 1)), to: endOfQuarter(subQuarters(new Date(), 1)) }),
  },
  {
    id: 'semestre', label: 'Semestre',
    getA: () => ({ from: subMonths(new Date(), 5), to: new Date() }),
    getB: () => ({ from: subMonths(new Date(), 11), to: subMonths(new Date(), 6) }),
  },
  {
    id: 'ano', label: 'Ano',
    getA: () => ({ from: startOfYear(new Date()), to: new Date() }),
    getB: () => ({ from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) }),
  },
];

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}
function fmtCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
function fmtTime(minutes: number): string {
  if (minutes === 0) return '—';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
function fmtTimeSec(seconds: number): string {
  if (seconds === 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
}

type FmtType = 'num' | 'currency' | 'pct' | 'time' | 'timeSec';
function fmtValue(v: number, fmt: FmtType): string {
  switch (fmt) {
    case 'currency': return fmtCurrency(v);
    case 'pct': return fmtPct(v);
    case 'time': return fmtTime(v);
    case 'timeSec': return fmtTimeSec(v);
    default: return fmtNum(v);
  }
}

function DeltaBadge({ current, previous, invert = false, size = 'sm' }: {
  current: number; previous: number; invert?: boolean; size?: 'sm' | 'lg';
}) {
  const delta = computeDelta(current, previous);
  if (delta === 0 && current === 0 && previous === 0) return null;
  const isGood = delta === 0 ? null : invert ? delta < 0 : delta > 0;
  const color = isGood === null
    ? 'text-muted-foreground bg-muted/60'
    : isGood
      ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10'
      : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10';
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${text} ${color}`}>
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, icon: Icon, current, previous, fmt = 'num', invert = false, className }: {
  label: string; icon: LucideIcon; current: number; previous: number;
  fmt?: FmtType; invert?: boolean; className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span className="p-1.5 rounded-lg bg-muted">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</p>
        <div className="ml-auto"><DeltaBadge current={current} previous={previous} invert={invert} /></div>
      </div>
      {/* Valor atual — destaque */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mb-1">Atual</p>
        <p className="text-2xl font-extrabold font-display tabular-nums text-foreground leading-none">{fmtValue(current, fmt)}</p>
      </div>
      {/* Separador */}
      <div className="h-px bg-border/30" />
      {/* Valor anterior — secundário */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Anterior</p>
        <p className="text-base font-bold font-display tabular-nums text-muted-foreground leading-none">{fmtValue(previous, fmt)}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: {
  title: string; icon: LucideIcon; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function MetricRow({ label, current, previous, fmt = 'num', invert = false }: {
  label: string; current: number; previous: number; fmt?: FmtType; invert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-5 border-b border-border/20 last:border-b-0 gap-4">
      <p className="text-sm text-foreground font-medium flex-1">{label}</p>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-0.5">Anterior</p>
          <p className="text-sm font-mono tabular-nums text-muted-foreground">{fmtValue(previous, fmt)}</p>
        </div>
        <DeltaBadge current={current} previous={previous} invert={invert} />
        <div className="text-right min-w-[72px]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">Atual</p>
          <p className="text-sm font-bold font-mono tabular-nums text-foreground">{fmtValue(current, fmt)}</p>
        </div>
      </div>
    </div>
  );
}

function ComparisonBar({ label, current, previous, color }: {
  label: string; current: number; previous: number; color: string;
}) {
  const max = Math.max(current, previous, 1);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <DeltaBadge current={current} previous={previous} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/50 w-10 shrink-0">Atual</span>
          <div className="flex-1 h-5 bg-muted/30 rounded-md overflow-hidden">
            <div className={`h-full rounded-md ${color} transition-all duration-500`} style={{ width: `${(current / max) * 100}%` }} />
          </div>
          <span className="text-xs font-mono font-semibold tabular-nums w-10 text-right">{fmtNum(current)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/50 w-10 shrink-0">Ant.</span>
          <div className="flex-1 h-5 bg-muted/30 rounded-md overflow-hidden">
            <div className="h-full rounded-md bg-muted-foreground/15 transition-all duration-500" style={{ width: `${(previous / max) * 100}%` }} />
          </div>
          <span className="text-xs font-mono tabular-nums text-muted-foreground w-10 text-right">{fmtNum(previous)}</span>
        </div>
      </div>
    </div>
  );
}

function toInputDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
function fromInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function Evolucao() {
  const { isMember, acesso, isContextLoading, tenant } = usePlataforma();

  const [activePreset, setActivePreset] = useState('mes');
  const defaultPreset = PRESETS.find(p => p.id === 'mes')!;
  const [periodA, setPeriodA] = useState<DatePeriod>(defaultPreset.getA());
  const [periodB, setPeriodB] = useState<DatePeriod>(defaultPreset.getB());

  const { data, isLoading } = useEvolucao(periodA, periodB);

  function applyPreset(id: string) {
    setActivePreset(id);
    const preset = PRESETS.find(p => p.id === id);
    if (preset) {
      setPeriodA(preset.getA());
      setPeriodB(preset.getB());
    }
  }

  function navigatePeriod(dir: 'prev' | 'next', which: 'A' | 'B') {
    const amt = dir === 'prev' ? -1 : 1;
    const curr = which === 'A' ? periodA : periodB;
    const set = which === 'A' ? setPeriodA : setPeriodB;
    switch (activePreset) {
      case 'dia': { const d = addDays(curr.from, amt); set({ from: d, to: d }); break; }
      case 'semana': { const w = addWeeks(curr.from, amt); set({ from: startOfWeek(w, { locale: ptBR }), to: endOfWeek(w, { locale: ptBR }) }); break; }
      case 'mes': { const m = addMonths(curr.from, amt); set({ from: startOfMonth(m), to: endOfMonth(m) }); break; }
      case '30d': set({ from: addDays(curr.from, amt * 30), to: addDays(curr.to, amt * 30) }); break;
      case 'trimestre': { const q = addQuarters(curr.from, amt); set({ from: startOfQuarter(q), to: endOfQuarter(q) }); break; }
      case 'semestre': set({ from: addMonths(curr.from, amt * 6), to: addMonths(curr.to, amt * 6) }); break;
      case 'ano': { const y = addYears(curr.from, amt); set({ from: startOfYear(y), to: endOfYear(y) }); break; }
    }
  }

  function DatePill({ period, setPeriod, label, accent }: {
    period: DatePeriod; setPeriod: (p: DatePeriod) => void;
    label: string; accent?: boolean;
  }) {
    const isSameDay = period.from.toDateString() === period.to.toDateString();
    const displayFrom = format(period.from, "dd MMM", { locale: ptBR });
    const displayTo = format(period.to, "dd MMM yyyy", { locale: ptBR });
    const displayFull = isSameDay ? format(period.from, "dd MMM yyyy", { locale: ptBR }) : `${displayFrom} – ${displayTo}`;
    const canNav = activePreset !== 'custom';
    return (
      <div className="flex-1 min-w-0">
        <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-1.5", accent ? "text-primary/70" : "text-muted-foreground/50")}>{label}</p>
        <div className="flex items-center gap-1.5">
          {canNav && (
            <button onClick={() => navigatePeriod('prev', accent ? 'A' : 'B')}
              className="h-8 w-8 shrink-0 rounded-lg border border-border/60 bg-card flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          {activePreset === 'custom' ? (
            // Custom mode — dois calendar popovers
            <div className="flex items-center gap-1.5 flex-1">
              {(['from', 'to'] as const).map((key, idx) => (
                <Fragment key={key}>
                  {idx === 1 && <span className="text-xs text-muted-foreground/40">—</span>}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex-1 h-9 rounded-lg border border-border/60 bg-card px-3 text-xs font-medium tabular-nums text-foreground hover:bg-muted transition-colors text-center">
                        {format(period[key], "dd/MM/yyyy")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <UICalendar
                        mode="single"
                        selected={period[key]}
                        onSelect={(d) => { if (d) { setPeriod({ ...period, [key]: d }); } }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </Fragment>
              ))}
            </div>
          ) : (
            // Preset mode — pill de texto clicável
            <div className={cn("flex-1 rounded-xl border px-4 py-2.5 text-center transition-colors",
              accent ? "border-primary/20 bg-primary/[0.04]" : "border-border/50 bg-muted/20"
            )}>
              <p className="text-xs font-semibold tabular-nums text-foreground">{displayFull}</p>
            </div>
          )}
          {canNav && (
            <button onClick={() => navigatePeriod('next', accent ? 'A' : 'B')}
              className="h-8 w-8 shrink-0 rounded-lg border border-border/60 bg-card flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isContextLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[140px] rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!tenant || !acesso.acesso_crm) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <Lock className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Acesso não disponível</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">Esta funcionalidade requer acesso ao CRM.</p>
      </div>
    );
  }

  if (isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <ShieldCheck className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Acesso restrito</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">A página de Evolução está disponível apenas para o proprietário da clínica.</p>
      </div>
    );
  }

  const d = data;
  const a = d?.atual;
  const b = d?.anterior;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div data-tutorial="evolucao-header">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Evolução</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">
          Acompanhe a evolução completa da sua operação e compare períodos.
        </p>
      </div>

      {/* Period selector */}
      <div data-tutorial="evolucao-period" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
        {/* Presets */}
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === p.id
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setActivePreset('custom')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activePreset === 'custom'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Personalizado
          </button>
        </div>

        {/* Period pickers */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <DatePill period={periodA} setPeriod={setPeriodA} label="Atual" accent />
          <div className="flex items-center justify-center sm:pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">vs</span>
          </div>
          <DatePill period={periodB} setPeriod={setPeriodB} label="Anterior" />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
          <span className="ml-3 text-sm text-muted-foreground">Calculando métricas...</span>
        </div>
      )}

      {d && a && b && (
        <>
          {/* ── VISÃO GERAL ─────────────────────────────────────────── */}
          <div data-tutorial="evolucao-kpis">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 ml-1">Visão Geral</p>
            <div className="flex flex-wrap justify-center gap-4">
              <KpiCard label="Leads" icon={Users} current={a.totalLeads} previous={b.totalLeads} className="w-[calc(50%-8px)] md:w-[calc(33.333%-11px)]" />
              <KpiCard label="Qualificados" icon={Target} current={a.mqlCount} previous={b.mqlCount} className="w-[calc(50%-8px)] md:w-[calc(33.333%-11px)]" />
              <KpiCard label="Agendamentos" icon={Calendar} current={a.scheduledCount} previous={b.scheduledCount} className="w-[calc(50%-8px)] md:w-[calc(33.333%-11px)]" />
              <KpiCard label="Vendas" icon={DollarSign} current={a.vendasCount} previous={b.vendasCount} className="w-[calc(50%-8px)] md:w-[calc(33.333%-11px)]" />
              <KpiCard label="Faturamento" icon={BarChart3} current={a.faturamento} previous={b.faturamento} fmt="currency" className="w-[calc(50%-8px)] md:w-[calc(33.333%-11px)]" />
            </div>
          </div>

          {/* ── FUNIL DE CONVERSÃO ──────────────────────────────────── */}
          <div data-tutorial="evolucao-funnel"><SectionCard title="Funil de Conversão" icon={Activity}>
            <div className="flex items-center justify-between gap-1 overflow-x-auto py-6 px-5">
              {[
                { label: 'Leads', ca: a.totalLeads, cb: b.totalLeads },
                { label: 'Qualificados', ca: a.mqlCount, cb: b.mqlCount },
                { label: 'Agendamentos', ca: a.scheduledCount, cb: b.scheduledCount },
                { label: 'Vendas', ca: a.vendasCount, cb: b.vendasCount },
              ].map((step, i, arr) => (
                <Fragment key={step.label}>
                  <div className="flex flex-col items-center min-w-[90px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">{step.label}</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-foreground">{fmtNum(step.ca)}</p>
                    <DeltaBadge current={step.ca} previous={step.cb} size="lg" />
                    <div className="mt-1.5 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Anterior</p>
                      <p className="text-sm font-mono tabular-nums text-muted-foreground font-medium">{fmtNum(step.cb)}</p>
                    </div>
                  </div>
                  {i < arr.length - 1 && (() => {
                    const rates = [
                      { ca: a.taxaMQL, cb: b.taxaMQL },
                      { ca: a.taxaAgendamento, cb: b.taxaAgendamento },
                      { ca: a.taxaFechamento, cb: b.taxaFechamento },
                    ];
                    const r = rates[i];
                    return (
                      <div className="flex flex-col items-center shrink-0 px-1">
                        <ArrowRight className="h-4 w-4 text-muted-foreground/20" />
                        <p className="text-[11px] font-semibold text-foreground mt-0.5">{fmtPct(r.ca)}</p>
                        <p className="text-[9px] text-muted-foreground/40">({fmtPct(r.cb)})</p>
                      </div>
                    );
                  })()}
                </Fragment>
              ))}
            </div>
          </SectionCard></div>

          {/* ── LEADS & AQUISIÇÃO ───────────────────────────────────── */}
          <div data-tutorial="evolucao-leads"><SectionCard title="Leads & Aquisição" icon={Users}>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ComparisonBar label="Marketing" current={a.leadsMkt} previous={b.leadsMkt} color="bg-blue-500/80" />
                <ComparisonBar label="Orgânico" current={a.leadsOrg} previous={b.leadsOrg} color="bg-emerald-500/80" />
                <ComparisonBar label="Reativação" current={a.leadsReativ} previous={b.leadsReativ} color="bg-amber-500/80" />
                <ComparisonBar label="Outros" current={a.leadsOutros} previous={b.leadsOutros} color="bg-purple-500/80" />
              </div>

              {(a.scoringA + a.scoringB + a.scoringC + a.scoringD > 0 || b.scoringA + b.scoringB + b.scoringC + b.scoringD > 0) && (
                <>
                  <div className="h-px bg-border/30" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Scoring de Leads Qualificados</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'A — Dos sonhos', current: a.scoringA, prev: b.scoringA, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10' },
                        { label: 'B — Qualificado', current: a.scoringB, prev: b.scoringB, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10' },
                        { label: 'C — Em desenv.', current: a.scoringC, prev: b.scoringC, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10' },
                        { label: 'D — Fora do ICP', current: a.scoringD, prev: b.scoringD, color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10' },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl border border-border/40 p-3 space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground">{s.label}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold font-mono ${s.color.split(' ')[0]} rounded-lg px-2 py-0.5 ${s.color.split(' ').slice(1).join(' ')}`}>{s.current}</span>
                            <DeltaBadge current={s.current} previous={s.prev} />
                          </div>
                          <p className="text-xs font-mono tabular-nums text-muted-foreground">Ant.: {s.prev}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </SectionCard></div>

          {/* ── VENDAS & RECEITA ────────────────────────────────────── */}
          <div data-tutorial="evolucao-vendas"><SectionCard title="Vendas & Receita" icon={DollarSign}>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
                {[
                  { label: 'Faturamento', current: a.faturamento, prev: b.faturamento, fmt: 'currency' as FmtType },
                  { label: 'Ticket Médio', current: a.ticketMedio, prev: b.ticketMedio, fmt: 'currency' as FmtType },
                  { label: 'Vendas Fechadas', current: a.vendasCount, prev: b.vendasCount, fmt: 'num' as FmtType },
                ].map(m => (
                  <div key={m.label} className="p-5 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{m.label}</p>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">Atual</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold font-mono tabular-nums text-foreground">{fmtValue(m.current, m.fmt)}</p>
                        <DeltaBadge current={m.current} previous={m.prev} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-0.5">Anterior</p>
                      <p className="text-base font-mono tabular-nums text-muted-foreground">{fmtValue(m.prev, m.fmt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {(a.topProcedimentos.length > 0 || b.topProcedimentos.length > 0) && (
                <div className="border-t border-border/30 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Top Procedimentos</p>
                  <div className="space-y-2">
                    {a.topProcedimentos.map(proc => {
                      const prev = b.topProcedimentos.find(p => p.name === proc.name)?.count || 0;
                      return (
                        <div key={proc.name} className="flex items-center justify-between py-1.5 gap-4">
                          <p className="text-sm text-foreground flex-1">{proc.name}</p>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-mono tabular-nums text-muted-foreground hidden sm:block">{prev > 0 ? prev : '—'}</span>
                            <DeltaBadge current={proc.count} previous={prev} />
                            <span className="text-sm font-mono font-bold tabular-nums w-8 text-right">{proc.count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </SectionCard></div>

          {/* ── AGENDAMENTOS ────────────────────────────────────────── */}
          <div data-tutorial="evolucao-agendamentos"><SectionCard title="Agendamentos" icon={Calendar}>
            <div>
              <MetricRow label="Total de Agendamentos" current={a.agTotal} previous={b.agTotal} />
              <MetricRow label="Realizados" current={a.agRealizados} previous={b.agRealizados} />
              <MetricRow label="No-Show" current={a.agNoShow} previous={b.agNoShow} invert />
              <MetricRow label="Cancelados" current={a.agCancelados} previous={b.agCancelados} invert />
              <MetricRow label="Taxa de Comparecimento" current={a.agTaxaComparecimento} previous={b.agTaxaComparecimento} fmt="pct" />
              <MetricRow label="Taxa de No-Show" current={a.agTaxaNoShow} previous={b.agTaxaNoShow} fmt="pct" invert />
            </div>
          </SectionCard></div>

          {/* ── ATENDIMENTO ─────────────────────────────────────────── */}
          <div data-tutorial="evolucao-atendimento"><SectionCard title="Atendimento" icon={MessageSquare}>
            <div>
              <MetricRow label="Tempo médio de 1ª resposta" current={a.tempoRespostaHumano} previous={b.tempoRespostaHumano} fmt="time" invert />
              <MetricRow label="Duração média do atendimento" current={a.duracaoAtendimento} previous={b.duracaoAtendimento} fmt="time" invert />
              <MetricRow label="Taxa sem resposta (24h)" current={a.taxaSemResposta} previous={b.taxaSemResposta} fmt="pct" invert />
            </div>
          </SectionCard></div>

        </>
      )}

      {!isLoading && !d && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Activity className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum dado encontrado</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Ajuste os períodos selecionados para visualizar a evolução.</p>
        </div>
      )}
    </div>
  );
}
