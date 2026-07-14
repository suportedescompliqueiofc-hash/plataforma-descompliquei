import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, BookOpen, Bot, BrainCircuit, Activity, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, ChevronRight, Loader2,
  AlertCircle, CheckSquare, LayoutDashboard, Info
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────
interface PlatformUser {
  id: string;
  clinic_name: string | null;
  plan: string | null;
  cerebro_complete: boolean | null;
  onboarding_complete: boolean | null;
  updated_at: string | null;
}

interface ActivityItem {
  id: string;
  tipo: 'modulo' | 'ia' | 'cerebro';
  descricao: string;
  created_at: string;
  cliente: string;
}

interface AdminTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  client_id: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} dia${Math.floor(diff / 86400) > 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

const PRIORITY_DOT: Record<string, string> = {
  urgente: 'bg-red-500',
  alta: 'bg-orange-500',
  media: 'bg-amber-400',
  baixa: 'bg-blue-400',
};

const IA_LABEL: Record<string, string> = {
  preattendance: 'Pré-Atendimento',
  objections: 'Objeções',
  remarketing: 'Remarketing',
  analysis: 'Análise',
  copywriter: 'Copywriter',
  scripts: 'Scripts',
  strategy: 'Estratégia',
  reporting: 'Relatórios',
  followup: 'Follow-up',
};

// ── Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [progressAvg, setProgressAvg] = useState(0);
  const [iaToday, setIaToday] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [todayTasks, setTodayTasks] = useState<AdminTask[]>([]);
  const [modulesLast7, setModulesLast7] = useState(0);

  useEffect(() => {
    document.title = 'Dashboard · Admin OS | Descompliquei';
    async function load() {
      try {
        const { data: usersData } = await supabase
          .from('platform_users')
          .select('id, clinic_name, plan, cerebro_complete, onboarding_complete, updated_at')
          .order('updated_at', { ascending: false });

        const usersList: PlatformUser[] = (usersData || []) as PlatformUser[];
        setUsers(usersList);

        const { count: totalModulesCount } = await supabase
          .from('platform_modules')
          .select('id', { count: 'exact', head: true })
          .eq('active', true);
        const totalModules = totalModulesCount || 1;

        const { data: progressData } = await supabase
          .from('platform_progress')
          .select('user_id, completed');

        if (usersList.length > 0) {
          const completedByUser: Record<string, number> = {};
          (progressData || []).forEach((p: any) => {
            if (p.completed) completedByUser[p.user_id] = (completedByUser[p.user_id] || 0) + 1;
          });
          const perUserPcts = usersList.map(u => {
            const done = completedByUser[u.id] || 0;
            return Math.round((done / totalModules) * 100);
          });
          const avg = Math.round(perUserPcts.reduce((a, b) => a + b, 0) / perUserPcts.length);
          setProgressAvg(avg);
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: iaCount } = await supabase
          .from('platform_ia_history')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString());
        setIaToday(iaCount || 0);

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { count: modCount } = await supabase
          .from('platform_progress')
          .select('id', { count: 'exact', head: true })
          .eq('completed', true)
          .gte('completed_at', sevenDaysAgo);
        setModulesLast7(modCount || 0);

        const userMap: Record<string, string> = {};
        usersList.forEach(u => { userMap[u.id] = u.clinic_name || 'Cliente'; });

        const [{ data: progActs }, { data: iaActs }, { data: modulesData }] = await Promise.all([
          supabase.from('platform_progress').select('id, user_id, module_id, completed_at').eq('completed', true).order('completed_at', { ascending: false }).limit(10),
          supabase.from('platform_ia_history').select('id, user_id, ia_type, created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('platform_modules').select('id, title'),
        ]);

        const moduleMap: Record<string, string> = {};
        (modulesData || []).forEach((m: any) => { moduleMap[m.id] = m.title; });

        const progItems: ActivityItem[] = (progActs || []).filter((p: any) => p.completed_at).map((p: any) => ({
          id: p.id, tipo: 'modulo' as const,
          descricao: `concluiu "${moduleMap[p.module_id] || `Módulo ${p.module_id}`}"`,
          created_at: p.completed_at, cliente: userMap[p.user_id] || 'Cliente',
        }));

        const iaItems: ActivityItem[] = (iaActs || []).map((a: any) => ({
          id: a.id, tipo: 'ia' as const,
          descricao: `usou a IA de ${IA_LABEL[a.ia_type] || a.ia_type}`,
          created_at: a.created_at, cliente: userMap[a.user_id] || 'Cliente',
        }));

        const all = [...progItems, ...iaItems].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 20);
        setActivity(all);

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: tasksData } = await supabase
          .from('admin_tasks')
          .select('id, title, status, priority, due_date, client_id')
          .gte('due_date', todayStr + 'T00:00:00+00:00')
          .lt('due_date', todayStr + 'T23:59:59.999+00:00')
          .neq('status', 'concluida')
          .order('priority')
          .limit(5);
        setTodayTasks((tasksData || []) as AdminTask[]);

      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Métricas ─────────────────────────────────────────────────────────
  const totalUsers = users.length;
  const comAtividade = users.filter(u => daysSince(u.updated_at) < 7).length;
  const cerebrosConfig = users.filter(u => u.cerebro_complete).length;
  const semAtividade7 = users.filter(u => daysSince(u.updated_at) >= 7).length;
  const semAtividade14 = users.filter(u => daysSince(u.updated_at) >= 14);
  const semAtividade7a13 = users.filter(u => daysSince(u.updated_at) >= 7 && daysSince(u.updated_at) < 14);
  const cerebroVazio = users.filter(u => !u.cerebro_complete);

  const visibleActivity = showAllActivity ? activity : activity.slice(0, 8);

  if (loading) {
    return (
      <div className="space-y-8 pb-10">
        <div><Skeleton className="h-8 w-64 mb-2" /><Skeleton className="h-4 w-96" /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[120px] w-full rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[90px] w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Dashboard Operacional</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Visão geral da Descompliquei e do Hub de Gestão Comercial</p>
      </div>

      {/* ── FAIXA 1 — 4 MÉTRICAS PRINCIPAIS ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Clientes Ativos', value: totalUsers, sub: `${comAtividade} ativos (7d)`, subColor: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
          { icon: BookOpen, label: 'Progresso Médio', value: `${progressAvg}%`, bar: progressAvg, sub: 'Conclusão média dos clientes', subColor: '' },
          { icon: Bot, label: 'IAs Usadas Hoje', value: iaToday, sub: 'consultas realizadas hoje', subColor: '' },
          { icon: BrainCircuit, label: 'Cérebros Config.', value: cerebrosConfig, sub: `de ${totalUsers} clientes (${totalUsers > 0 ? Math.round((cerebrosConfig / totalUsers) * 100) : 0}%)`, subColor: '' },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-muted">
                <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</span>
            </div>
            <p className="text-4xl font-black font-display tabular-nums text-foreground">{m.value}</p>
            {m.bar !== undefined && (
              <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-foreground/40 rounded-full transition-all" style={{ width: `${m.bar}%` }} />
              </div>
            )}
            {m.subColor ? (
              <span className={cn('mt-2 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border', m.subColor)}>{m.sub}</span>
            ) : (
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">{m.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── FAIXA 2 — ENGAJAMENTO ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: AlertTriangle, label: 'Sem atividade há 7+ dias', value: semAtividade7,
            iconColor: semAtividade7 > 0 ? 'text-red-500' : 'text-emerald-500',
            bg: semAtividade7 > 0 ? 'bg-red-500/8' : 'bg-emerald-500/8',
            badge: semAtividade7 > 0 ? { label: 'risco de churn', cls: 'bg-red-500/10 text-red-600 border-red-500/20' } : null,
          },
          { icon: TrendingUp, label: 'Módulos concluídos (7 dias)', value: modulesLast7, iconColor: 'text-blue-500', bg: 'bg-blue-500/8', badge: null },
          { icon: Clock, label: 'Tarefas para hoje', value: todayTasks.length, iconColor: 'text-amber-500', bg: 'bg-amber-500/8', badge: null },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex items-center gap-4">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', m.bg)}>
              <m.icon className={cn('h-5 w-5', m.iconColor)} />
            </div>
            <div>
              <p className="text-2xl font-black font-display tabular-nums text-foreground">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              {m.badge && (
                <span className={cn('mt-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border', m.badge.cls)}>{m.badge.label}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── SEÇÃO PRINCIPAL: ATIVIDADE + ALERTAS ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ATIVIDADE RECENTE */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Atividade Recente</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Últimas ações dos clientes na plataforma</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 rounded-xl bg-muted/40 mb-3">
                    <Activity className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade registrada</p>
                </div>
              ) : (
                <>
                  {visibleActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className={cn(
                        'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white',
                        item.tipo === 'modulo' ? 'bg-blue-500' : item.tipo === 'ia' ? 'bg-purple-500' : 'bg-emerald-500'
                      )}>
                        {item.cliente.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          <span className="font-semibold">{item.cliente}</span>{' '}
                          <span className="text-muted-foreground">{item.descricao}</span>
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">{timeAgo(item.created_at)}</span>
                    </div>
                  ))}
                  {activity.length > 8 && (
                    <div className="px-5 py-3 flex items-center justify-center">
                      <button
                        onClick={() => setShowAllActivity(v => !v)}
                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showAllActivity ? 'Ver menos' : `Ver todos (${activity.length})`}
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ALERTAS + RESUMO */}
        <div className="lg:col-span-2 space-y-4">

          {/* Alertas */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Alertas do Sistema</p>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {semAtividade14.length > 0 && (
                <div className="flex gap-3 p-3 bg-red-500/[0.06] border border-red-500/20 rounded-xl">
                  <div className="p-1.5 rounded-lg bg-red-500/10 shrink-0 mt-0.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Crítico — Risco de Churn</p>
                    <p className="text-[11px] text-red-500/80 mt-0.5">
                      {semAtividade14.length} cliente{semAtividade14.length > 1 ? 's' : ''} sem atividade há 14+ dias
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {semAtividade14.slice(0, 3).map(u => (
                        <span key={u.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          {u.clinic_name || 'Cliente'}
                        </span>
                      ))}
                      {semAtividade14.length > 3 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 border border-red-500/20">+{semAtividade14.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {semAtividade7a13.length > 0 && (
                <div className="flex gap-3 p-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0 mt-0.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Atenção — Inatividade</p>
                    <p className="text-[11px] text-amber-500/80 mt-0.5">
                      {semAtividade7a13.length} cliente{semAtividade7a13.length > 1 ? 's' : ''} sem atividade entre 7–13 dias
                    </p>
                  </div>
                </div>
              )}

              {cerebroVazio.length > 0 && (
                <div className="flex gap-3 p-3 bg-orange-500/[0.06] border border-orange-500/20 rounded-xl">
                  <div className="p-1.5 rounded-lg bg-orange-500/10 shrink-0 mt-0.5">
                    <Info className="h-3.5 w-3.5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Aviso — Cérebro Vazio</p>
                    <p className="text-[11px] text-orange-500/80 mt-0.5">
                      {cerebroVazio.length} cliente{cerebroVazio.length > 1 ? 's' : ''} com Cérebro Central não configurado
                    </p>
                  </div>
                </div>
              )}

              {semAtividade14.length === 0 && semAtividade7a13.length === 0 && cerebroVazio.length === 0 && (
                <div className="flex gap-3 p-3 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 shrink-0 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Tudo em ordem</p>
                    <p className="text-[11px] text-emerald-500/80 mt-0.5">Nenhum alerta crítico no momento</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resumo de Saúde */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Resumo de Saúde</p>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              {[
                { label: 'Clientes ativos', value: totalUsers, valueClass: 'text-foreground' },
                { label: 'Onboarding completo', value: users.filter(u => u.onboarding_complete).length, valueClass: 'text-emerald-600' },
                { label: 'Cérebro configurado', value: cerebrosConfig, valueClass: 'text-blue-600' },
                { label: 'Em risco de churn', value: semAtividade14.length, valueClass: semAtividade14.length > 0 ? 'text-red-500' : 'text-emerald-600' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={cn('text-xs font-bold tabular-nums font-display', item.valueClass)}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TAREFAS DO DIA ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tarefas de Hoje</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Pendências agendadas para hoje</p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {todayTasks.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-5 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-sm">Nenhuma tarefa pendente para hoje.</p>
            </div>
          ) : (
            todayTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                <div className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority] || 'bg-muted-foreground')} />
                <p className="text-sm text-foreground flex-1">{task.title}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 py-0.5 rounded-md bg-muted/60">
                  {task.priority}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
