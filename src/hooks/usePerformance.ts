import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import {
  format,
  getISOWeek,
  getISOWeekYear,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  isAfter,
  isBefore,
  isToday,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  subDays,
  getDay,
  startOfDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskFrequency = 'daily' | 'weekly' | 'monthly';

export interface PerformanceTask {
  id: string;
  title: string;
  description: string | null;
  frequency: TaskFrequency;
  order_index: number;
  is_active: boolean;
}

export interface PerformanceCheckin {
  id: string;
  organization_id: string;
  task_id: string;
  user_id: string | null;
  period_key: string;
  completed_at: string;
}

export interface TaskWithStatus extends PerformanceTask {
  completed: boolean;
  checkin_id?: string;
  period_key: string;
}

export interface PerformanceScore {
  daily: number;
  weekly: number;
  monthly: number;
  overall: number;
}

// ─── Period key helpers ───────────────────────────────────────────────────────

export function getDailyKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function getWeeklyKey(date: Date = new Date()): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getMonthlyKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

// ─── Lock logic ───────────────────────────────────────────────────────────────

/** Retorna o último dia útil (seg–sex) do mês de uma data */
export function getLastBusinessDayOfMonth(date: Date): Date {
  const last = endOfMonth(date);
  const dow = getDay(last); // 0=dom, 6=sab
  if (dow === 0) return subDays(last, 2); // dom → sex
  if (dow === 6) return subDays(last, 1); // sab → sex
  return last;
}

/** Diário: só hoje é editável */
export function isDailyEditable(selectedDate: Date): boolean {
  return isToday(selectedDate);
}

/**
 * Semanal: disponível apenas a partir da segunda-feira da semana seguinte à selecionada.
 * Ex: semana 22 (26 mai–1 jun) → disponível a partir de 2 jun (seg da semana 23)
 */
export function isWeeklyEditable(selectedDate: Date, today: Date = new Date()): boolean {
  const weekStart = startOfISOWeek(selectedDate); // seg da semana selecionada
  const nextMonday = addWeeks(weekStart, 1);       // seg da semana seguinte
  return !isBefore(startOfDay(today), startOfDay(nextMonday));
}

/**
 * Mensal: disponível a partir do último dia útil do mês selecionado.
 * Ex: maio 2025 → último dia útil = 30/05 (sexta) → disponível a partir do dia 30
 */
export function isMonthlyEditable(selectedDate: Date, today: Date = new Date()): boolean {
  const lastBizDay = getLastBusinessDayOfMonth(selectedDate);
  return !isBefore(startOfDay(today), startOfDay(lastBizDay));
}

/** Mensagem de bloqueio para cada frequência */
export function getLockMessage(
  frequency: TaskFrequency,
  selectedDate: Date,
  today: Date = new Date(),
): string {
  if (frequency === 'daily') {
    if (isBefore(startOfDay(selectedDate), startOfDay(today))) return 'Este dia já passou. Apenas o dia atual pode ser editado.';
    if (isAfter(startOfDay(selectedDate), startOfDay(today))) return 'Este dia ainda não chegou.';
    return '';
  }
  if (frequency === 'weekly') {
    const nextMonday = addWeeks(startOfISOWeek(selectedDate), 1);
    return `Disponível a partir de ${format(nextMonday, "dd/MM/yyyy")} (segunda-feira da próxima semana).`;
  }
  // monthly
  const lastBizDay = getLastBusinessDayOfMonth(selectedDate);
  return `Disponível a partir de ${format(lastBizDay, "dd/MM/yyyy")} — último dia útil do mês.`;
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function calcScore(completed: number, expected: number): number {
  if (expected === 0) return 100;
  return Math.round((completed / expected) * 100);
}

// ─── Hook: visão geral (scores correntes) ────────────────────────────────────

export function usePerformanceOverview() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const now = new Date();
  const currentMonth = format(now, 'yyyy-MM');

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['performance_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_tasks')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      return data as PerformanceTask[];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Busca checkins do mês atual + semanas do ano atual
  const { data: checkins = [], isLoading: checkinsLoading } = useQuery({
    queryKey: ['performance_checkins_overview', orgId, currentMonth],
    queryFn: async () => {
      if (!orgId) return [];
      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        supabase
          .from('performance_checkins')
          .select('*')
          .eq('organization_id', orgId)
          .like('period_key', `${currentMonth}%`),
        supabase
          .from('performance_checkins')
          .select('*')
          .eq('organization_id', orgId)
          .like('period_key', `${format(now, 'yyyy')}-W%`),
      ]);
      return [...(d1 ?? []), ...(d2 ?? [])] as PerformanceCheckin[];
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });

  const dailyTasks = tasks.filter((t) => t.frequency === 'daily');
  const weeklyTasks = tasks.filter((t) => t.frequency === 'weekly');
  const monthlyTasks = tasks.filter((t) => t.frequency === 'monthly');

  const checkinSet = new Set(checkins.map((c) => `${c.task_id}:${c.period_key}`));

  const todayKey = getDailyKey(now);
  const weekKey = getWeeklyKey(now);
  const monthKey = getMonthlyKey(now);

  // Score diário
  const dailyDone = dailyTasks.filter((t) => checkinSet.has(`${t.id}:${todayKey}`)).length;
  const dailyScore = calcScore(dailyDone, dailyTasks.length);

  // Score semanal: média dos dias da semana atual + tarefas semanais
  const weekStart = startOfISOWeek(now);
  const weekDays = eachDayOfInterval({ start: weekStart, end: now });
  const avgDailyThisWeek =
    weekDays.map((d) => {
      const k = getDailyKey(d);
      return calcScore(dailyTasks.filter((t) => checkinSet.has(`${t.id}:${k}`)).length, dailyTasks.length);
    }).reduce((a, b) => a + b, 0) / (weekDays.length || 1);
  const weeklyDone = weeklyTasks.filter((t) => checkinSet.has(`${t.id}:${weekKey}`)).length;
  const weeklyScore = Math.round(avgDailyThisWeek * 0.7 + calcScore(weeklyDone, weeklyTasks.length) * 0.3);

  // Score mensal
  const monthDays = eachDayOfInterval({ start: startOfMonth(now), end: now });
  const avgDailyThisMonth =
    monthDays.map((d) => {
      const k = getDailyKey(d);
      return calcScore(dailyTasks.filter((t) => checkinSet.has(`${t.id}:${k}`)).length, dailyTasks.length);
    }).reduce((a, b) => a + b, 0) / (monthDays.length || 1);
  const weeksInMonth = eachWeekOfInterval({ start: startOfMonth(now), end: now }, { weekStartsOn: 1 });
  const weeklyDoneInMonth = weeksInMonth.filter((wStart) => {
    const wk = getWeeklyKey(wStart);
    return weeklyTasks.filter((t) => checkinSet.has(`${t.id}:${wk}`)).length === weeklyTasks.length && weeklyTasks.length > 0;
  }).length;
  const monthlyDone = monthlyTasks.filter((t) => checkinSet.has(`${t.id}:${monthKey}`)).length;
  const monthlyScore = Math.round(
    avgDailyThisMonth * 0.6 +
    calcScore(weeklyDoneInMonth, Math.max(weeksInMonth.length, 1)) * 0.25 +
    calcScore(monthlyDone, monthlyTasks.length) * 0.15,
  );

  const overallScore = Math.round(dailyScore * 0.4 + weeklyScore * 0.3 + monthlyScore * 0.3);

  // Histórico diário (30 dias)
  const last30Days = eachDayOfInterval({
    start: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
    end: now,
  });
  const dailyHistory = last30Days.map((day) => {
    const k = getDailyKey(day);
    const done = dailyTasks.filter((t) => checkinSet.has(`${t.id}:${k}`)).length;
    return { date: k, label: format(day, 'dd/MM'), score: calcScore(done, dailyTasks.length), done, total: dailyTasks.length };
  });

  // Tarefas de hoje com status
  const todayPending = dailyTasks.filter((t) => !checkinSet.has(`${t.id}:${todayKey}`));

  return {
    isLoading: tasksLoading || checkinsLoading,
    score: { daily: dailyScore, weekly: weeklyScore, monthly: monthlyScore, overall: overallScore },
    dailyHistory,
    todayPending,
    todayDone: dailyDone,
    todayTotal: dailyTasks.length,
  };
}

// ─── Hook: período específico (checklist com navegação) ───────────────────────

export function usePerformancePeriod(frequency: TaskFrequency, selectedDate: Date) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const periodKey =
    frequency === 'daily'
      ? getDailyKey(selectedDate)
      : frequency === 'weekly'
      ? getWeeklyKey(selectedDate)
      : getMonthlyKey(selectedDate);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['performance_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_tasks')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      return data as PerformanceTask[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: checkins = [], isLoading: checkinsLoading } = useQuery({
    queryKey: ['performance_checkins_period', orgId, periodKey],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('performance_checkins')
        .select('*')
        .eq('organization_id', orgId)
        .eq('period_key', periodKey);
      if (error) throw error;
      return data as PerformanceCheckin[];
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });

  const frequencyTasks = tasks.filter((t) => t.frequency === frequency);
  const checkinMap = new Map(checkins.map((c) => [c.task_id, c]));

  const tasksWithStatus: TaskWithStatus[] = frequencyTasks.map((t) => ({
    ...t,
    period_key: periodKey,
    completed: checkinMap.has(t.id),
    checkin_id: checkinMap.get(t.id)?.id,
  }));

  const done = tasksWithStatus.filter((t) => t.completed).length;
  const total = frequencyTasks.length;
  const periodScore = calcScore(done, total);

  const isEditable =
    frequency === 'daily'
      ? isDailyEditable(selectedDate)
      : frequency === 'weekly'
      ? isWeeklyEditable(selectedDate)
      : isMonthlyEditable(selectedDate);

  const lockMessage = isEditable ? '' : getLockMessage(frequency, selectedDate);

  const toggleCheckin = useMutation({
    mutationFn: async ({
      taskId,
      completed,
      checkinId,
    }: {
      taskId: string;
      completed: boolean;
      checkinId?: string;
    }) => {
      if (!orgId) throw new Error('No org');
      if (completed) {
        if (checkinId) {
          const { error } = await supabase.from('performance_checkins').delete().eq('id', checkinId);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('performance_checkins').insert({
          organization_id: orgId,
          task_id: taskId,
          period_key: periodKey,
          user_id: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance_checkins_period', orgId, periodKey] });
      queryClient.invalidateQueries({ queryKey: ['performance_checkins_overview'] });
    },
  });

  return {
    isLoading: tasksLoading || checkinsLoading,
    tasks: tasksWithStatus,
    done,
    total,
    periodScore,
    isEditable,
    lockMessage,
    periodKey,
    toggleCheckin,
  };
}

// ─── Hook leve: badge do sidebar ─────────────────────────────────────────────
// Retorna apenas a contagem de tarefas diárias pendentes hoje.
// Cache curto (1min) para não sobrecarregar — usado no sidebar global.

export function usePerformanceBadge() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const todayKey = getDailyKey();

  const { data: tasks = [] } = useQuery({
    queryKey: ['performance_tasks_daily'],   // chave exclusiva — não conflita com o cache geral
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_tasks')
        .select('id, frequency, title')
        .eq('is_active', true)
        .eq('frequency', 'daily')
        .order('order_index');
      if (error) throw error;
      return data as Pick<PerformanceTask, 'id' | 'frequency' | 'title'>[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ['performance_badge', orgId, todayKey],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('performance_checkins')
        .select('task_id')
        .eq('organization_id', orgId)
        .eq('period_key', todayKey);
      if (error) throw error;
      return data as { task_id: string }[];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,   // 1 minuto
    refetchInterval: 2 * 60 * 1000, // re-fetch a cada 2 min
  });

  const completedIds = new Set(checkins.map((c) => c.task_id));
  const pendingTasks = tasks.filter((t) => !completedIds.has(t.id));
  const pending = pendingTasks.length;
  const total = tasks.length;
  const score = total > 0 ? Math.round(((total - pending) / total) * 100) : 100;

  return { pending, total, score, pendingTasks };
}
