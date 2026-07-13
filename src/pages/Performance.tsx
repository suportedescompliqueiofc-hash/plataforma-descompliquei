import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy, CheckCircle2, Circle, AlertCircle, Lock,
  CalendarDays, CalendarRange, Calendar, ChevronLeft, ChevronRight,
  BarChart2, Target, Flame, LayoutDashboard, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  usePerformanceOverview,
  usePerformancePeriod,
  TaskFrequency,
  TaskWithStatus,
  getDailyKey,
  getWeeklyKey,
  getMonthlyKey,
} from "@/hooks/usePerformance";
import {
  format,
  parseISO,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfISOWeek,
  endOfISOWeek,
  getISOWeek,
  isToday,
  startOfDay,
  isBefore,
} from "date-fns";

// ─── Helpers de limite de navegação ──────────────────────────────────────────

function isPrevBeforeOrgCreation(date: Date, freq: TaskFrequency, orgCreatedAt: Date | null): boolean {
  if (!orgCreatedAt) return false;
  if (freq === 'daily')   return getDailyKey(subDays(date, 1))   < getDailyKey(orgCreatedAt);
  if (freq === 'weekly')  return getWeeklyKey(subWeeks(date, 1)) < getWeeklyKey(orgCreatedAt);
  return getMonthlyKey(subMonths(date, 1)) < getMonthlyKey(orgCreatedAt);
}

function isNextInFuture(date: Date, freq: TaskFrequency): boolean {
  const today = new Date();
  if (freq === 'daily')   return getDailyKey(addDays(date, 1))    > getDailyKey(today);
  if (freq === 'weekly')  return getWeeklyKey(addWeeks(date, 1))  > getWeeklyKey(today);
  return getMonthlyKey(addMonths(date, 1)) > getMonthlyKey(today);
}
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Score Gauge ─────────────────────────────────────────────────────────────

function ScoreGauge({
  value,
  label,
  size = 'md',
  sublabel,
}: {
  value: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  sublabel?: string;
}) {
  const radius = size === 'lg' ? 60 : size === 'md' ? 44 : 30;
  const stroke = size === 'lg' ? 8 : size === 'md' ? 7 : 5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(value, 100) / 100) * circumference;
  const color = value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  const dim = (radius + stroke) * 2 + 4;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none" stroke="currentColor" strokeWidth={stroke}
            className="text-muted/40"
          />
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            strokeLinecap="round" className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-extrabold tabular-nums font-display leading-none",
              size === 'lg' ? "text-3xl" : size === 'md' ? "text-2xl" : "text-base"
            )}
            style={{ color }}
          >
            {value}%
          </span>
        </div>
      </div>
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</span>
      {sublabel && <span className="text-[10px] text-muted-foreground/40">{sublabel}</span>}
    </div>
  );
}

// ─── Period Navigator ─────────────────────────────────────────────────────────

function PeriodNavigator({
  frequency,
  selectedDate,
  onPrev,
  onNext,
  onToday,
  disablePrev,
  disableNext,
}: {
  frequency: TaskFrequency;
  selectedDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
}) {
  const today = new Date();

  let label = '';
  let isCurrentPeriod = false;

  if (frequency === 'daily') {
    label = format(selectedDate, "EEE, d 'de' MMM yyyy", { locale: ptBR });
    isCurrentPeriod = isToday(selectedDate);
  } else if (frequency === 'weekly') {
    const start = startOfISOWeek(selectedDate);
    const end = endOfISOWeek(selectedDate);
    const week = getISOWeek(selectedDate);
    label = `Semana ${week} · ${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM', { locale: ptBR })}`;
    isCurrentPeriod = getWeeklyKey(selectedDate) === getWeeklyKey(today);
  } else {
    label = format(selectedDate, 'MMMM yyyy', { locale: ptBR });
    isCurrentPeriod = getMonthlyKey(selectedDate) === getMonthlyKey(today);
  }

  return (
    <div data-tutorial="performance-checklist-navigator" className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/[0.03]">
      <button
        onClick={onPrev}
        disabled={disablePrev}
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          disablePrev
            ? "opacity-25 cursor-not-allowed text-muted-foreground"
            : "hover:bg-muted/50 text-muted-foreground"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-foreground capitalize">{label}</span>
        {!isCurrentPeriod && (
          <button
            onClick={onToday}
            className="text-[10px] font-semibold text-primary/70 hover:text-primary border border-border/60 px-2 py-0.5 rounded-md transition-colors"
          >
            Atual
          </button>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={disableNext}
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          disableNext
            ? "opacity-25 cursor-not-allowed text-muted-foreground"
            : "hover:bg-muted/50 text-muted-foreground"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Lock Banner ──────────────────────────────────────────────────────────────

function LockBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 bg-muted/30 border-b border-border/40">
      <Lock className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
      <p className="text-[12px] text-muted-foreground leading-relaxed">{message}</p>
    </div>
  );
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({
  task,
  onToggle,
  isEditable,
  isPending,
}: {
  task: TaskWithStatus;
  onToggle: () => void;
  isEditable: boolean;
  isPending: boolean;
}) {
  return (
    <button
      onClick={isEditable ? onToggle : undefined}
      disabled={!isEditable || isPending}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all text-left",
        !isEditable && "opacity-60 cursor-default",
        isEditable && !task.completed && "border-border/60 bg-card hover:bg-muted/20 hover:border-border",
        isEditable && task.completed && "border-emerald-200/60 bg-emerald-50/50",
        !isEditable && task.completed && "border-emerald-200/40 bg-emerald-50/30",
        !isEditable && !task.completed && "border-border/40 bg-muted/20",
      )}
    >
      <div className="mt-0.5 shrink-0">
        {task.completed
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          : <Circle className={cn("h-4 w-4", isEditable ? "text-muted-foreground/40 group-hover:text-muted-foreground/70" : "text-muted-foreground/25")} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13px] font-medium leading-snug",
          task.completed ? "text-muted-foreground line-through" : "text-foreground"
        )}>
          {task.title}
        </p>
        {task.description && !task.completed && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">
            {task.description}
          </p>
        )}
      </div>
      {!isEditable && !task.completed && (
        <Lock className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
      )}
    </button>
  );
}

// ─── Period Checklist View ────────────────────────────────────────────────────

function PeriodChecklistView({
  frequency,
  selectedDate,
  onPrev,
  onNext,
  onToday,
  disablePrev,
  disableNext,
}: {
  frequency: TaskFrequency;
  selectedDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
}) {
  const { isLoading, tasks, done, total, periodScore, isEditable, lockMessage, toggleCheckin } =
    usePerformancePeriod(frequency, selectedDate);

  const scoreColor = periodScore >= 80 ? '#10b981' : periodScore >= 50 ? '#f59e0b' : '#ef4444';

  const handleToggle = async (task: TaskWithStatus) => {
    try {
      await toggleCheckin.mutateAsync({
        taskId: task.id,
        completed: task.completed,
        checkinId: task.checkin_id,
      });
      if (!task.completed) toast.success('Tarefa concluída!', { duration: 1500 });
    } catch {
      toast.error('Erro ao atualizar tarefa');
    }
  };

  const freqLabel = {
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
  }[frequency];

  const freqIcon = {
    daily: CalendarDays,
    weekly: CalendarRange,
    monthly: Calendar,
  }[frequency];
  const FreqIcon = freqIcon;

  return (
    <div data-tutorial="performance-checklist-card" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Card header */}
      <div data-tutorial="performance-checklist-header" className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <FreqIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{freqLabel}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{done}/{total} tarefas concluídas</p>
            </div>
          </div>
          {/* Mini score */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold tabular-nums font-display" style={{ color: scoreColor }}>
              {periodScore}%
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${total > 0 ? (done / total) * 100 : 0}%`,
              backgroundColor: scoreColor,
            }}
          />
        </div>
      </div>

      {/* Period navigator */}
      <PeriodNavigator
        frequency={frequency}
        selectedDate={selectedDate}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
        disablePrev={disablePrev}
        disableNext={disableNext}
      />

      {/* Lock banner */}
      {!isEditable && lockMessage && <LockBanner message={lockMessage} />}

      {/* Checklist */}
      <div data-tutorial="performance-checklist-tasks" className="p-4 space-y-2">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
          ))
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <FreqIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sem tarefas cadastradas</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={() => handleToggle(task)}
              isEditable={isEditable}
              isPending={toggleCheckin.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { isLoading, score, dailyHistory, todayPending, todayDone, todayTotal } =
    usePerformanceOverview();

  const scoreLabel = (v: number) =>
    v >= 80 ? 'Excelente' : v >= 60 ? 'Bom' : v >= 40 ? 'Regular' : 'Crítico';
  const scoreColor = (v: number) =>
    v >= 80 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-red-500';

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div data-tutorial="performance-overview-scores" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">PONTUAÇÃO GERAL</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Baseado em desempenho diário, semanal e mensal</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <ScoreGauge value={score.overall} label="Overall" size="lg" />
              <span className={cn("text-sm font-bold", scoreColor(score.overall))}>
                {scoreLabel(score.overall)}
              </span>
            </div>
            <div className="hidden sm:block w-px h-28 bg-border/40" />
            <div className="flex items-center justify-center gap-8 flex-1 flex-wrap">
              <ScoreGauge value={score.daily} label="Hoje" size="md" sublabel={`${todayDone}/${todayTotal} tarefas`} />
              <ScoreGauge value={score.weekly} label="Semana" size="md" />
              <ScoreGauge value={score.monthly} label="Mês" size="md" />
            </div>
          </div>
        </div>
      </div>

      {/* Alert: tarefas pendentes hoje */}
      {todayPending.length > 0 && (
        <div data-tutorial="performance-overview-pending" className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 flex items-start gap-3">
          <Flame className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-amber-800">
              {todayPending.length} {todayPending.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'} hoje
            </p>
            <p className="text-[11px] text-amber-700/70 mt-0.5">
              {todayPending.map((t) => t.title).join(' · ')}
            </p>
          </div>
        </div>
      )}
      {todayPending.length === 0 && todayTotal > 0 && (
        <div data-tutorial="performance-overview-pending" className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-[12px] font-semibold text-emerald-800">Todas as tarefas de hoje concluídas!</p>
        </div>
      )}

      {/* Histórico */}
      <div data-tutorial="performance-overview-chart" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">EVOLUÇÃO DIÁRIA</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Score diário — últimos 30 dias</p>
            </div>
          </div>
        </div>
        <div className="p-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyHistory} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false} axisLine={false} interval={4}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false} axisLine={false}
              />
              <RechartTooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8, fontSize: 11,
                }}
                formatter={(v: number) => [`${v}%`, 'Score']}
              />
              <Area
                type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2}
                fill="url(#scoreGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aviso */}
      <div data-tutorial="performance-overview-info" className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 flex items-start gap-3">
        <Info className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          Tarefas diárias: editáveis apenas no dia corrente. Tarefas semanais: disponíveis na segunda-feira da semana seguinte. Tarefas mensais: disponíveis a partir do último dia útil do mês.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'daily' | 'weekly' | 'monthly';

export default function Performance() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  // Busca data de criação da org para limitar navegação
  const { data: orgInfo } = useQuery({
    queryKey: ['org_info', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('created_at')
        .eq('id', orgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 60 * 60 * 1000,
  });
  const orgCreatedAt = orgInfo?.created_at ? parseISO(orgInfo.created_at) : null;

  // Datas de navegação por período (iniciam em hoje)
  const [dailyDate, setDailyDate] = useState(new Date());
  const [weeklyDate, setWeeklyDate] = useState(new Date());
  const [monthlyDate, setMonthlyDate] = useState(new Date());

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'daily',    label: 'Diário',      icon: CalendarDays },
    { id: 'weekly',   label: 'Semanal',     icon: CalendarRange },
    { id: 'monthly',  label: 'Mensal',      icon: Calendar },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <PageHero
        dataTutorial="performance-header"
        icon={Trophy}
        title="Performance"
        subtitle={format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
      />

      {/* ── sr-only tab switchers (used by tutorial actions) ── */}
      <button data-tutorial="performance-open-overview-direct" className="sr-only" onClick={() => setActiveTab('overview')} tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="performance-open-daily-direct"    className="sr-only" onClick={() => setActiveTab('daily')}    tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="performance-open-weekly-direct"   className="sr-only" onClick={() => setActiveTab('weekly')}   tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="performance-open-monthly-direct"  className="sr-only" onClick={() => setActiveTab('monthly')}  tabIndex={-1} aria-hidden="true" />

      {/* ── Tabs ── */}
      <div data-tutorial="performance-tabs" className="bg-muted/40 rounded-xl p-1 inline-flex gap-0.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-all",
              activeTab === id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && <OverviewTab />}

      {activeTab === 'daily' && (
        <PeriodChecklistView
          frequency="daily"
          selectedDate={dailyDate}
          onPrev={() => !isPrevBeforeOrgCreation(dailyDate, 'daily', orgCreatedAt) && setDailyDate((d) => subDays(d, 1))}
          onNext={() => !isNextInFuture(dailyDate, 'daily') && setDailyDate((d) => addDays(d, 1))}
          onToday={() => setDailyDate(new Date())}
          disablePrev={isPrevBeforeOrgCreation(dailyDate, 'daily', orgCreatedAt)}
          disableNext={isNextInFuture(dailyDate, 'daily')}
        />
      )}

      {activeTab === 'weekly' && (
        <PeriodChecklistView
          frequency="weekly"
          selectedDate={weeklyDate}
          onPrev={() => !isPrevBeforeOrgCreation(weeklyDate, 'weekly', orgCreatedAt) && setWeeklyDate((d) => subWeeks(d, 1))}
          onNext={() => !isNextInFuture(weeklyDate, 'weekly') && setWeeklyDate((d) => addWeeks(d, 1))}
          onToday={() => setWeeklyDate(new Date())}
          disablePrev={isPrevBeforeOrgCreation(weeklyDate, 'weekly', orgCreatedAt)}
          disableNext={isNextInFuture(weeklyDate, 'weekly')}
        />
      )}

      {activeTab === 'monthly' && (
        <PeriodChecklistView
          frequency="monthly"
          selectedDate={monthlyDate}
          onPrev={() => !isPrevBeforeOrgCreation(monthlyDate, 'monthly', orgCreatedAt) && setMonthlyDate((d) => subMonths(d, 1))}
          onNext={() => !isNextInFuture(monthlyDate, 'monthly') && setMonthlyDate((d) => addMonths(d, 1))}
          onToday={() => setMonthlyDate(new Date())}
          disablePrev={isPrevBeforeOrgCreation(monthlyDate, 'monthly', orgCreatedAt)}
          disableNext={isNextInFuture(monthlyDate, 'monthly')}
        />
      )}
    </div>
  );
}
