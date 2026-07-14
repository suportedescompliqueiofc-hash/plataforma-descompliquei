import { useState } from 'react';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { useEvolucao, computeDelta, type DatePeriod } from '@/hooks/useEvolucao';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/PageHero';
import {
  LineChart, Users, Target, Calendar, MessageSquare,
  ArrowUp, ArrowDown, Minus, Loader2, Lock, ShieldCheck, Activity,
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, subMonths,
  startOfYear, endOfYear, subYears,
  subDays, differenceInCalendarDays, format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { formatBRL, formatInt, formatPct, formatNum } from '@/lib/format';

// ─────────────────────────────────────────────────────────────────
// Presets de comparação — cada um define A e B de uma vez.
// ─────────────────────────────────────────────────────────────────
const PERIOD_PRESETS: { id: string; label: string; getA: () => DateRange; getB: () => DateRange }[] = [
  {
    id: 'mes-anterior', label: 'Mês vs anterior',
    getA: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
    getB: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }),
  },
  {
    id: 'ano-anterior', label: 'Ano vs anterior',
    getA: () => ({ from: startOfYear(new Date()), to: new Date() }),
    getB: () => ({ from: startOfYear(subYears(new Date(), 1)), to: subYears(new Date(), 1) }),
  },
  {
    id: '30d-30d', label: '30d vs 30d',
    getA: () => ({ from: subDays(new Date(), 29), to: new Date() }),
    getB: () => ({ from: subDays(new Date(), 59), to: subDays(new Date(), 30) }),
  },
];

/** Período anterior de mesma duração, imediatamente antes de `range` (usado no auto-B). */
function periodBefore(range: { from: Date; to: Date }): DateRange {
  const days = differenceInCalendarDays(range.to, range.from) + 1;
  const to = subDays(range.from, 1);
  const from = subDays(to, days - 1);
  return { from, to };
}

/** Formata as datas de um período para o cabeçalho das tabelas — ex.: "01–31 jul" / "01 jul – 15 ago 2025". */
function formatPeriodShort(period: DatePeriod): string {
  const sameYear = period.from.getFullYear() === period.to.getFullYear();
  const sameMonth = sameYear && period.from.getMonth() === period.to.getMonth();
  if (period.from.toDateString() === period.to.toDateString()) {
    return format(period.from, "dd MMM yyyy", { locale: ptBR });
  }
  if (sameMonth) {
    return `${format(period.from, "dd")}–${format(period.to, "dd MMM", { locale: ptBR })}`;
  }
  if (sameYear) {
    return `${format(period.from, "dd MMM", { locale: ptBR })} – ${format(period.to, "dd MMM", { locale: ptBR })}`;
  }
  return `${format(period.from, "dd MMM yyyy", { locale: ptBR })} – ${format(period.to, "dd MMM yyyy", { locale: ptBR })}`;
}

// ─────────────────────────────────────────────────────────────────
// Formatação de valores — números/moeda/% delegam à fonte única (@/lib/format).
// ─────────────────────────────────────────────────────────────────
type MetricFmt = 'int' | 'brl' | 'pct' | 'time';

/** Helper de tempo local (minutos → "4 min" / "1h 30min") — não existe em @/lib/format. */
function fmtTime(minutes: number): string {
  if (minutes === 0) return '—';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatMetricValue(v: number, fmt: MetricFmt): string {
  switch (fmt) {
    case 'brl': return formatBRL(v);
    case 'pct': return formatPct(v, 1);
    case 'time': return fmtTime(v);
    default: return formatInt(v);
  }
}

// ─────────────────────────────────────────────────────────────────
// Componente local de comparação em 2 colunas (Período A / Período B).
// ─────────────────────────────────────────────────────────────────
interface CompareRow {
  label: string;
  a: number;
  b: number;
  fmt: MetricFmt;
  /** Menor é melhor (No-show, Sem resposta, Tempo de 1ª resposta). Default: maior é melhor. */
  invert?: boolean;
  /** Métrica já é percentual — variação em pontos percentuais (A−B) em vez de %. */
  isRate?: boolean;
  dot?: string;
}

interface DeltaInfo {
  dir: 'up' | 'down' | 'flat';
  good: boolean;
  strong: boolean;
  text: string;
}

function computeRowDelta(row: CompareRow): DeltaInfo {
  if (row.isRate) {
    const pp = row.a - row.b;
    const dir: DeltaInfo['dir'] = pp > 0 ? 'up' : pp < 0 ? 'down' : 'flat';
    const good = row.invert ? pp < 0 : pp > 0;
    const strong = dir !== 'flat' && Math.abs(pp) >= 3;
    return { dir, good, strong, text: `${formatNum(Math.abs(pp), 1)}pp` };
  }
  const delta = computeDelta(row.a, row.b);
  const dir: DeltaInfo['dir'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const good = row.invert ? delta < 0 : delta > 0;
  const strong = dir !== 'flat' && Math.abs(delta) >= 15;
  return { dir, good, strong, text: formatPct(Math.abs(delta), 1) };
}

function DeltaCell({ info }: { info: DeltaInfo }) {
  if (info.dir === 'flat') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold font-display tabular-nums text-muted-foreground bg-muted/60">
        <Minus className="h-3 w-3" />
        {info.text}
      </span>
    );
  }
  const Icon = info.dir === 'up' ? ArrowUp : ArrowDown;
  const color = info.good
    ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10'
    : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold font-display tabular-nums', color)}>
      <Icon className="h-3 w-3" />
      {info.text}
    </span>
  );
}

const COMPARE_GRID = 'grid grid-cols-[1.3fr_1fr_1fr_0.9fr] items-center gap-3';

function MetricCompareHeader({ periodA, periodB }: { periodA: DatePeriod; periodB: DatePeriod }) {
  return (
    <div className={cn(COMPARE_GRID, 'items-end px-5 py-3')}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Métrica</span>
      <div className="text-right">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Período A</span>
        <span className="text-[9px] font-display tabular-nums text-muted-foreground/60">{formatPeriodShort(periodA)}</span>
      </div>
      <div className="text-right">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground">Período B</span>
        <span className="text-[9px] font-display tabular-nums text-muted-foreground/60">{formatPeriodShort(periodB)}</span>
      </div>
      <span className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Variação</span>
    </div>
  );
}

function MetricCompareRow({ row }: { row: CompareRow }) {
  const info = computeRowDelta(row);
  const va = formatMetricValue(row.a, row.fmt);
  const vb = formatMetricValue(row.b, row.fmt);
  const heat = info.strong
    ? info.good
      ? 'text-emerald-600'
      : 'text-red-600'
    : 'text-foreground';
  return (
    <div className={cn(COMPARE_GRID, 'border-t border-border/40 px-5 py-3.5')}>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        {row.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.dot }} />}
        {row.label}
      </p>
      <p className={cn('text-right text-2xl font-bold font-display tabular-nums', heat)}>
        {va}
      </p>
      <p className="border-l border-dashed border-border pl-3 text-right text-2xl font-bold font-display tabular-nums text-foreground opacity-90">
        {vb}
      </p>
      <div className="flex justify-end">
        <DeltaCell info={info} />
      </div>
    </div>
  );
}

function MetricCompareTable({ title, icon: Icon, big, rows, periodA, periodB, dataTutorial }: {
  title?: string; icon?: LucideIcon; big?: boolean; rows: CompareRow[];
  periodA: DatePeriod; periodB: DatePeriod; dataTutorial?: string;
}) {
  return (
    <div
      data-tutorial={dataTutorial}
      className={cn(
        'rounded-2xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden',
        big ? 'border-2 border-border' : 'border-border/60',
      )}
    >
      {title && Icon && (
        <div className="flex items-center gap-2 border-b border-border/40 bg-muted/[0.03] px-5 py-4">
          <span className="rounded-lg bg-muted p-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        </div>
      )}
      <MetricCompareHeader periodA={periodA} periodB={periodB} />
      <div>
        {rows.map(row => <MetricCompareRow key={row.label} row={row} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
export default function Evolucao() {
  const { isMember, acesso, isContextLoading, tenant } = usePlataforma();

  const defaultPreset = PERIOD_PRESETS[0];
  const [activePresetId, setActivePresetId] = useState<string | null>(defaultPreset.id);
  const [periodA, setPeriodA] = useState<DateRange | undefined>(defaultPreset.getA());
  const [periodB, setPeriodB] = useState<DateRange | undefined>(defaultPreset.getB());

  function applyPreset(id: string) {
    const preset = PERIOD_PRESETS.find(p => p.id === id);
    if (!preset) return;
    setActivePresetId(id);
    setPeriodA(preset.getA());
    setPeriodB(preset.getB());
  }

  function handleSetPeriodA(range: DateRange | undefined) {
    setPeriodA(range);
    setActivePresetId(null);
    if (range?.from && range?.to) {
      setPeriodB(periodBefore({ from: range.from, to: range.to }));
    }
  }

  function handleSetPeriodB(range: DateRange | undefined) {
    setPeriodB(range);
    setActivePresetId(null);
  }

  const datePeriodA: DatePeriod | null = periodA?.from && periodA?.to ? { from: periodA.from, to: periodA.to } : null;
  const datePeriodB: DatePeriod | null = periodB?.from && periodB?.to ? { from: periodB.from, to: periodB.to } : null;

  const { data, isLoading } = useEvolucao(datePeriodA, datePeriodB);

  if (isContextLoading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[140px] rounded-2xl" />)}
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
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      <PageHero
        dataTutorial="evolucao-header"
        icon={LineChart}
        title="Evolução"
        subtitle="Compare a performance da sua clínica entre dois períodos"
      />

      {/* Barra de período */}
      <div data-tutorial="evolucao-period" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">Período A</p>
            <DateRangePicker date={periodA} setDate={handleSetPeriodA} hideQuickSelect />
          </div>
          <span className="pb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">vs</span>
          <div className="flex-1 min-w-[240px]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">Período B</p>
            <DateRangePicker date={periodB} setDate={handleSetPeriodB} hideQuickSelect />
          </div>
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
            {PERIOD_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  activePresetId === p.id
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
          <span className="ml-3 text-sm text-muted-foreground">Calculando métricas...</span>
        </div>
      )}

      {d && a && b && datePeriodA && datePeriodB && (
        <>
          {/* ── VISÃO GERAL DO PERÍODO ──────────────────────────────── */}
          <div data-tutorial="evolucao-kpis">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 ml-1">Visão Geral do Período</p>
            <MetricCompareTable
              big
              periodA={datePeriodA}
              periodB={datePeriodB}
              rows={[
                { label: 'Leads', a: a.totalLeads, b: b.totalLeads, fmt: 'int', dot: '#6366f1' },
                { label: 'Qualificados', a: a.mqlCount, b: b.mqlCount, fmt: 'int', dot: '#10b981' },
                { label: 'Agendamentos', a: a.scheduledCount, b: b.scheduledCount, fmt: 'int', dot: '#8b5cf6' },
                { label: 'Fechamentos', a: a.closedCount, b: b.closedCount, fmt: 'int', dot: '#3b82f6' },
                { label: 'Faturamento', a: a.faturamento, b: b.faturamento, fmt: 'brl', dot: '#E85D24' },
                { label: 'Ticket Médio', a: a.ticketMedio, b: b.ticketMedio, fmt: 'brl', dot: '#E85D24' },
              ]}
            />
          </div>

          {/* ── DETALHE POR ÁREA ────────────────────────────────────── */}
          <div data-tutorial="evolucao-vendas">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 ml-1">Detalhe por Área</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MetricCompareTable
                title="Taxas de Conversão"
                icon={Target}
                dataTutorial="evolucao-funnel"
                periodA={datePeriodA}
                periodB={datePeriodB}
                rows={[
                  { label: 'Taxa MQL', a: a.taxaMQL, b: b.taxaMQL, fmt: 'pct', isRate: true },
                  { label: 'Taxa Agendamento', a: a.taxaAgendamento, b: b.taxaAgendamento, fmt: 'pct', isRate: true },
                  { label: 'Taxa Fechamento', a: a.taxaFechamento, b: b.taxaFechamento, fmt: 'pct', isRate: true },
                ]}
              />
              <MetricCompareTable
                title="Agendamentos"
                icon={Calendar}
                dataTutorial="evolucao-agendamentos"
                periodA={datePeriodA}
                periodB={datePeriodB}
                rows={[
                  { label: 'Realizados', a: a.agRealizados, b: b.agRealizados, fmt: 'int' },
                  { label: 'No-show', a: a.agNoShow, b: b.agNoShow, fmt: 'int', invert: true },
                  { label: 'Comparecimento', a: a.agTaxaComparecimento, b: b.agTaxaComparecimento, fmt: 'pct', isRate: true },
                ]}
              />
              <MetricCompareTable
                title="Atendimento"
                icon={MessageSquare}
                dataTutorial="evolucao-atendimento"
                periodA={datePeriodA}
                periodB={datePeriodB}
                rows={[
                  { label: '1ª resposta', a: a.tempoRespostaHumano, b: b.tempoRespostaHumano, fmt: 'time', invert: true },
                  { label: 'Sem resposta', a: a.taxaSemResposta, b: b.taxaSemResposta, fmt: 'pct', isRate: true, invert: true },
                  { label: 'Conversas', a: a.conversasTotal, b: b.conversasTotal, fmt: 'int' },
                ]}
              />
              <MetricCompareTable
                title="Origem dos Leads"
                icon={Users}
                dataTutorial="evolucao-leads"
                periodA={datePeriodA}
                periodB={datePeriodB}
                rows={[
                  { label: 'Marketing', a: a.leadsMkt, b: b.leadsMkt, fmt: 'int', dot: '#E85D24' },
                  { label: 'Orgânico', a: a.leadsOrg, b: b.leadsOrg, fmt: 'int', dot: '#10b981' },
                  { label: 'Reativação', a: a.leadsReativ, b: b.leadsReativ, fmt: 'int', dot: '#8b5cf6' },
                  { label: 'Outros', a: a.leadsOutros, b: b.leadsOutros, fmt: 'int', dot: '#94a3b8' },
                ]}
              />
            </div>
          </div>
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
