import { useState, Fragment } from 'react';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { useEvolucao, computeDelta, type DatePeriod, type PeriodMetrics } from '@/hooks/useEvolucao';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, Users, Target, Calendar, DollarSign,
  MessageSquare, Bot, Activity, ArrowUp, ArrowDown, Minus,
  Loader2, Clock, BarChart3, UserCheck, ShieldCheck,
  ArrowRight, Lock
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, subMonths, subDays,
  startOfQuarter, endOfQuarter, subQuarters,
  startOfYear, endOfYear, subYears,
  format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';

const PRESETS = [
  {
    id: 'mes', label: 'Mês',
    getA: () => ({ from: startOfMonth(new Date()), to: new Date() }),
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

function KpiCard({ label, icon: Icon, current, previous, fmt = 'num', invert = false }: {
  label: string; icon: LucideIcon; current: number; previous: number;
  fmt?: FmtType; invert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="p-1.5 rounded-lg bg-muted">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</p>
      </div>
      <p className="text-2xl font-bold font-mono tabular-nums text-foreground">{fmtValue(current, fmt)}</p>
      <div className="flex items-center gap-2 mt-2">
        <DeltaBadge current={current} previous={previous} invert={invert} />
        <span className="text-[10px] text-muted-foreground/40">vs {fmtValue(previous, fmt)}</span>
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
    <div className="flex items-center justify-between py-3 px-5 border-b border-border/20 last:border-b-0">
      <p className="text-sm text-foreground font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold font-mono tabular-nums text-foreground">{fmtValue(current, fmt)}</span>
        <DeltaBadge current={current} previous={previous} invert={invert} />
        <span className="text-[10px] text-muted-foreground/40 w-16 text-right">{fmtValue(previous, fmt)}</span>
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
  const defaultPreset = PRESETS[0];
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
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
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

        {/* Date inputs */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 w-16">Atual</span>
            <input
              type="date"
              value={toInputDate(periodA.from)}
              onChange={e => { setPeriodA({ ...periodA, from: fromInputDate(e.target.value) }); setActivePreset('custom'); }}
              className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-mono text-foreground focus-visible:ring-1 focus-visible:ring-border/60 focus-visible:outline-none"
            />
            <span className="text-xs text-muted-foreground/40">—</span>
            <input
              type="date"
              value={toInputDate(periodA.to)}
              onChange={e => { setPeriodA({ ...periodA, to: fromInputDate(e.target.value) }); setActivePreset('custom'); }}
              className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-mono text-foreground focus-visible:ring-1 focus-visible:ring-border/60 focus-visible:outline-none"
            />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 hidden sm:block">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 w-16">Anterior</span>
            <input
              type="date"
              value={toInputDate(periodB.from)}
              onChange={e => { setPeriodB({ ...periodB, from: fromInputDate(e.target.value) }); setActivePreset('custom'); }}
              className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-mono text-foreground focus-visible:ring-1 focus-visible:ring-border/60 focus-visible:outline-none"
            />
            <span className="text-xs text-muted-foreground/40">—</span>
            <input
              type="date"
              value={toInputDate(periodB.to)}
              onChange={e => { setPeriodB({ ...periodB, to: fromInputDate(e.target.value) }); setActivePreset('custom'); }}
              className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs font-mono text-foreground focus-visible:ring-1 focus-visible:ring-border/60 focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
          <Activity className="h-3 w-3" />
          <span>
            Atual: {format(periodA.from, "dd MMM yyyy", { locale: ptBR })} — {format(periodA.to, "dd MMM yyyy", { locale: ptBR })}
            {' · '}
            Anterior: {format(periodB.from, "dd MMM yyyy", { locale: ptBR })} — {format(periodB.to, "dd MMM yyyy", { locale: ptBR })}
          </span>
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
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 ml-1">Visão Geral</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Leads" icon={Users} current={a.totalLeads} previous={b.totalLeads} />
              <KpiCard label="Qualificados" icon={Target} current={a.mqlCount} previous={b.mqlCount} />
              <KpiCard label="Agendamentos" icon={Calendar} current={a.scheduledCount} previous={b.scheduledCount} />
              <KpiCard label="Vendas" icon={DollarSign} current={a.closedCount} previous={b.closedCount} />
              <KpiCard label="Faturamento" icon={BarChart3} current={a.faturamento} previous={b.faturamento} fmt="currency" />
            </div>
          </div>

          {/* ── FUNIL DE CONVERSÃO ──────────────────────────────────── */}
          <SectionCard title="Funil de Conversão" icon={Activity}>
            <div className="flex items-center justify-between gap-1 overflow-x-auto py-6 px-5">
              {[
                { label: 'Leads', ca: a.totalLeads, cb: b.totalLeads },
                { label: 'MQL', ca: a.mqlCount, cb: b.mqlCount },
                { label: 'Agendamentos', ca: a.scheduledCount, cb: b.scheduledCount },
                { label: 'Vendas', ca: a.closedCount, cb: b.closedCount },
              ].map((step, i, arr) => (
                <Fragment key={step.label}>
                  <div className="flex flex-col items-center min-w-[90px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{step.label}</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmtNum(step.ca)}</p>
                    <DeltaBadge current={step.ca} previous={step.cb} size="lg" />
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">vs {fmtNum(step.cb)}</p>
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
          </SectionCard>

          {/* ── LEADS & AQUISIÇÃO ───────────────────────────────────── */}
          <SectionCard title="Leads & Aquisição" icon={Users}>
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Scoring de Leads (MQL)</p>
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
                          <p className="text-[9px] text-muted-foreground/40">vs {s.prev}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {/* ── VENDAS & RECEITA ────────────────────────────────────── */}
          <SectionCard title="Vendas & Receita" icon={DollarSign}>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
                {[
                  { label: 'Faturamento', current: a.faturamento, prev: b.faturamento, fmt: 'currency' as FmtType },
                  { label: 'Ticket Médio', current: a.ticketMedio, prev: b.ticketMedio, fmt: 'currency' as FmtType },
                  { label: 'Vendas Fechadas', current: a.vendasCount, prev: b.vendasCount, fmt: 'num' as FmtType },
                ].map(m => (
                  <div key={m.label} className="p-5 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{m.label}</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-foreground">{fmtValue(m.current, m.fmt)}</p>
                    <div className="flex items-center gap-2">
                      <DeltaBadge current={m.current} previous={m.prev} />
                      <span className="text-[10px] text-muted-foreground/40">vs {fmtValue(m.prev, m.fmt)}</span>
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
                        <div key={proc.name} className="flex items-center justify-between py-1">
                          <p className="text-sm text-foreground">{proc.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-semibold tabular-nums">{proc.count}</span>
                            <DeltaBadge current={proc.count} previous={prev} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── AGENDAMENTOS ────────────────────────────────────────── */}
          <SectionCard title="Agendamentos" icon={Calendar}>
            <div>
              <MetricRow label="Total de Agendamentos" current={a.agTotal} previous={b.agTotal} />
              <MetricRow label="Realizados" current={a.agRealizados} previous={b.agRealizados} />
              <MetricRow label="No-Show" current={a.agNoShow} previous={b.agNoShow} invert />
              <MetricRow label="Cancelados" current={a.agCancelados} previous={b.agCancelados} invert />
              <MetricRow label="Taxa de Comparecimento" current={a.agTaxaComparecimento} previous={b.agTaxaComparecimento} fmt="pct" />
              <MetricRow label="Taxa de No-Show" current={a.agTaxaNoShow} previous={b.agTaxaNoShow} fmt="pct" invert />
            </div>
          </SectionCard>

          {/* ── ATENDIMENTO ─────────────────────────────────────────── */}
          <SectionCard title="Atendimento" icon={MessageSquare}>
            <div>
              <MetricRow label="Tempo médio de 1ª resposta" current={a.tempoRespostaHumano} previous={b.tempoRespostaHumano} fmt="time" invert />
              <MetricRow label="Duração média do atendimento" current={a.duracaoAtendimento} previous={b.duracaoAtendimento} fmt="time" invert />
              <MetricRow label="Taxa sem resposta (24h)" current={a.taxaSemResposta} previous={b.taxaSemResposta} fmt="pct" invert />
              <MetricRow label="Conversas totais" current={a.conversasTotal} previous={b.conversasTotal} />
              <MetricRow label="Conversas com humano" current={a.conversasHumano} previous={b.conversasHumano} />
              <MetricRow label="Conversas com IA" current={a.conversasIA} previous={b.conversasIA} />
            </div>
          </SectionCard>

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
