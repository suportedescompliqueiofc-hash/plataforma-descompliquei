import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, getISOWeek, getISOWeekYear, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, TrendingUp, AlertTriangle, CheckCircle2, Flame, CheckSquare, Square, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

function getDailyKey(d = new Date()) { return format(d, 'yyyy-MM-dd'); }
function getWeeklyKey(d = new Date()) {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
}
function getMonthlyKey(d = new Date()) { return format(d, 'yyyy-MM'); }
function calcScore(done: number, total: number) {
  if (total === 0) return 100;
  return Math.round((done / total) * 100);
}
function scoreColor(v: number) {
  if (v >= 80) return 'text-emerald-600';
  if (v >= 60) return 'text-amber-600';
  if (v >= 40) return 'text-orange-500';
  return 'text-red-600';
}
function scoreLabel(v: number) {
  if (v >= 80) return { text: 'Excelente', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' };
  if (v >= 60) return { text: 'Bom', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' };
  if (v >= 40) return { text: 'Regular', cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20' };
  return { text: 'Crítico', cls: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20' };
}

function ScoreRing({ value }: { value: number }) {
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : value >= 40 ? '#f97316' : '#ef4444';
  const r = 22, stroke = 4;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const dim = (r + stroke) * 2 + 2;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <span className="absolute text-sm font-extrabold tabular-nums font-display" style={{ color }}>{value}</span>
    </div>
  );
}

const FREQ_LABEL: Record<string, string> = {
  daily: 'Diárias', weekly: 'Semanais', monthly: 'Mensais',
};

interface Props { orgId: string }

export default function AbaPerformance({ orgId }: Props) {
  const [refDateStr, setRefDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const refDate = parseISO(refDateStr);
  const todayKey = getDailyKey(refDate);
  const weekKey = getWeeklyKey(refDate);
  const monthKey = getMonthlyKey(refDate);

  function shiftDay(delta: number) {
    const d = parseISO(refDateStr);
    d.setDate(d.getDate() + delta);
    setRefDateStr(format(d, 'yyyy-MM-dd'));
  }

  const isToday = refDateStr === format(new Date(), 'yyyy-MM-dd');

  const weekStart = format(startOfWeek(refDate, { weekStartsOn: 1 }), 'dd/MM', { locale: ptBR });
  const weekEnd   = format(endOfWeek(refDate,   { weekStartsOn: 1 }), 'dd/MM', { locale: ptBR });
  const monthLabel = format(refDate, 'MMMM yyyy', { locale: ptBR });

  const { data, isLoading } = useQuery({
    queryKey: ['client_performance', orgId, todayKey],
    queryFn: async () => {
      const [tasksRes, checkinsRes] = await Promise.all([
        supabase.from('performance_tasks').select('id, title, frequency, description').eq('is_active', true).order('frequency').order('title'),
        supabase.from('performance_checkins')
          .select('task_id, period_key, completed_at')
          .eq('organization_id', orgId)
          .in('period_key', [todayKey, weekKey, monthKey]),
      ]);

      const tasks = tasksRes.data || [];
      const checkins = checkinsRes.data || [];

      const doneDaily = new Set(checkins.filter(c => c.period_key === todayKey).map(c => c.task_id));
      const doneWeekly = new Set(checkins.filter(c => c.period_key === weekKey).map(c => c.task_id));
      const doneMonthly = new Set(checkins.filter(c => c.period_key === monthKey).map(c => c.task_id));

      const daily = tasks.filter(t => t.frequency === 'daily');
      const weekly = tasks.filter(t => t.frequency === 'weekly');
      const monthly = tasks.filter(t => t.frequency === 'monthly');

      const dailyScore = calcScore(daily.filter(t => doneDaily.has(t.id)).length, daily.length);
      const weeklyScore = calcScore(weekly.filter(t => doneWeekly.has(t.id)).length, weekly.length);
      const monthlyScore = calcScore(monthly.filter(t => doneMonthly.has(t.id)).length, monthly.length);
      const overall = Math.round(dailyScore * 0.5 + weeklyScore * 0.3 + monthlyScore * 0.2);

      return {
        tasks,
        doneDaily, doneWeekly, doneMonthly,
        daily, weekly, monthly,
        dailyScore, weeklyScore, monthlyScore, overall,
      };
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted/30 animate-pulse" />)}
    </div>
  );

  if (!data) return null;

  const { daily, weekly, monthly, doneDaily, doneWeekly, doneMonthly, dailyScore, weeklyScore, monthlyScore, overall } = data;

  const dayLabel = isToday ? 'Hoje' : format(refDate, 'dd/MM', { locale: ptBR });
  const scores = [
    { label: 'Overall', value: overall, icon: Trophy, desc: 'pontuação geral (50% diário + 30% semanal + 20% mensal)' },
    { label: dayLabel, value: dailyScore, icon: Flame, desc: `${doneDaily.size}/${daily.length} tarefas diárias` },
    { label: 'Semana', value: weeklyScore, icon: TrendingUp, desc: `${doneWeekly.size}/${weekly.length} tarefas semanais` },
    { label: 'Mês', value: monthlyScore, icon: CheckCircle2, desc: `${doneMonthly.size}/${monthly.length} tarefas mensais` },
  ];

  const groups: { freq: string; tasks: any[]; done: Set<string> }[] = [
    { freq: 'daily', tasks: daily, done: doneDaily },
    { freq: 'weekly', tasks: weekly, done: doneWeekly },
    { freq: 'monthly', tasks: monthly, done: doneMonthly },
  ].filter(g => g.tasks.length > 0);

  return (
    <div className="space-y-4">

      {/* ── FILTRO DE DATA ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Período de referência</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <span>Semana: {weekStart}–{weekEnd}</span>
            <span className="mx-1">·</span>
            <span className="capitalize">{monthLabel}</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => shiftDay(-1)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/60 hover:bg-muted/40 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <input
              type="date"
              value={refDateStr}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => e.target.value && setRefDateStr(e.target.value)}
              className="h-7 px-2 text-[11px] font-mono rounded-lg border border-border/60 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <button onClick={() => shiftDay(1)} disabled={isToday} className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/60 hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {!isToday && (
              <button onClick={() => setRefDateStr(format(new Date(), 'yyyy-MM-dd'))} className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-border/60 hover:bg-muted/40 transition-colors text-muted-foreground">
                Hoje
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {scores.map(({ label, value, desc }) => {
          const { text, cls } = scoreLabel(value);
          return (
            <div key={label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col items-center text-center gap-2">
              <ScoreRing value={value} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{desc}</p>
              </div>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', cls)}>{text}</span>
            </div>
          );
        })}
      </div>

      {/* Task groups */}
      {groups.map(({ freq, tasks, done }) => (
        <div key={freq} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Tarefas {FREQ_LABEL[freq]}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{done.size} de {tasks.length} concluídas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', done.size === tasks.length ? 'bg-emerald-500' : 'bg-foreground/40')}
                  style={{ width: `${calcScore(done.size, tasks.length)}%` }} />
              </div>
              <span className={cn('text-xs font-extrabold tabular-nums font-mono', scoreColor(calcScore(done.size, tasks.length)))}>
                {calcScore(done.size, tasks.length)}%
              </span>
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {tasks.map(task => {
              const completed = done.has(task.id);
              return (
                <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  {completed
                    ? <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                    : <Square className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{task.description}</p>
                    )}
                  </div>
                  {completed && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shrink-0">
                      Feito
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-border/60 bg-card">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Trophy className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma tarefa de performance configurada</p>
        </div>
      )}
    </div>
  );
}
