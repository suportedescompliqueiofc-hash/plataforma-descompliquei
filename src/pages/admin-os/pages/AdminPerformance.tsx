import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ORG_ID } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { format, getISOWeek, getISOWeekYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Trophy, TrendingUp, AlertTriangle, CheckCircle2,
  Users, Flame, ChevronRight, Search
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDailyKey(d = new Date()) { return format(d, 'yyyy-MM-dd'); }
function getWeeklyKey(d = new Date()) {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
}
function getMonthlyKey(d = new Date()) { return format(d, 'yyyy-MM'); }
function calcScore(done: number, total: number) {
  if (total === 0) return 100;
  return Math.round((done / total) * 100);
}

function scoreLabel(v: number) {
  if (v >= 80) return 'Excelente';
  if (v >= 60) return 'Bom';
  if (v >= 40) return 'Regular';
  return 'Crítico';
}
function scoreColor(v: number) {
  if (v >= 80) return 'text-emerald-600';
  if (v >= 60) return 'text-amber-600';
  if (v >= 40) return 'text-orange-500';
  return 'text-red-600';
}
function scoreBg(v: number) {
  if (v >= 80) return 'bg-emerald-50 border-emerald-200/60 text-emerald-700';
  if (v >= 60) return 'bg-amber-50 border-amber-200/60 text-amber-700';
  if (v >= 40) return 'bg-orange-50 border-orange-200/60 text-orange-700';
  return 'bg-red-50 border-red-200/60 text-red-700';
}

// ─── Mini Gauge ───────────────────────────────────────────────────────────────

function MiniGauge({ value }: { value: number }) {
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : value >= 40 ? '#f97316' : '#ef4444';
  const r = 14, stroke = 3;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const dim = (r + stroke) * 2 + 2;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface OrgPerformance {
  orgId: string;
  name: string;
  dailyScore: number;
  weeklyScore: number;
  monthlyScore: number;
  overall: number;
  dailyDone: number;
  dailyTotal: number;
  lastCheckin: string | null;
}

function useAdminPerformance() {
  const now = new Date();
  const todayKey = getDailyKey(now);
  const weekKey = getWeeklyKey(now);
  const monthKey = getMonthlyKey(now);

  return useQuery({
    queryKey: ['admin_performance', todayKey],
    queryFn: async () => {
      // 1. Client orgs (exclude master)
      const { data: tenants } = await supabase
        .from('platform_tenants')
        .select('organization_id, organizations(name)')
        .neq('organization_id', MASTER_ORG_ID);

      if (!tenants || tenants.length === 0) return [];

      const orgIds = tenants.map((t: any) => t.organization_id);

      // 2. Tasks by frequency
      const { data: tasks } = await supabase
        .from('performance_tasks')
        .select('id, frequency')
        .eq('is_active', true);

      const dailyTasks = (tasks || []).filter((t: any) => t.frequency === 'daily');
      const weeklyTasks = (tasks || []).filter((t: any) => t.frequency === 'weekly');
      const monthlyTasks = (tasks || []).filter((t: any) => t.frequency === 'monthly');

      // 3. All current-period checkins across all orgs (3 keys at once)
      const { data: checkins } = await supabase
        .from('performance_checkins')
        .select('organization_id, task_id, period_key, completed_at')
        .in('organization_id', orgIds)
        .in('period_key', [todayKey, weekKey, monthKey]);

      // 4. Most recent checkin per org (any period) for "last activity"
      const { data: lastCheckins } = await supabase
        .from('performance_checkins')
        .select('organization_id, completed_at')
        .in('organization_id', orgIds)
        .order('completed_at', { ascending: false });

      const lastByOrg: Record<string, string> = {};
      (lastCheckins || []).forEach((c: any) => {
        if (!lastByOrg[c.organization_id]) lastByOrg[c.organization_id] = c.completed_at;
      });

      // 5. Group checkins by org + period
      const byOrg: Record<string, { daily: Set<string>; weekly: Set<string>; monthly: Set<string> }> = {};
      orgIds.forEach((id: string) => {
        byOrg[id] = { daily: new Set(), weekly: new Set(), monthly: new Set() };
      });
      (checkins || []).forEach((c: any) => {
        if (!byOrg[c.organization_id]) return;
        if (c.period_key === todayKey) byOrg[c.organization_id].daily.add(c.task_id);
        else if (c.period_key === weekKey) byOrg[c.organization_id].weekly.add(c.task_id);
        else if (c.period_key === monthKey) byOrg[c.organization_id].monthly.add(c.task_id);
      });

      // 6. Compute scores
      return tenants.map((t: any): OrgPerformance => {
        const orgId = t.organization_id;
        const d = byOrg[orgId];
        const dailyDone = dailyTasks.filter((tk: any) => d.daily.has(tk.id)).length;
        const weeklyDone = weeklyTasks.filter((tk: any) => d.weekly.has(tk.id)).length;
        const monthlyDone = monthlyTasks.filter((tk: any) => d.monthly.has(tk.id)).length;

        const dailyScore = calcScore(dailyDone, dailyTasks.length);
        const weeklyScore = calcScore(weeklyDone, weeklyTasks.length);
        const monthlyScore = calcScore(monthlyDone, monthlyTasks.length);
        const overall = Math.round(dailyScore * 0.5 + weeklyScore * 0.3 + monthlyScore * 0.2);

        return {
          orgId,
          name: (t.organizations as any)?.name || 'Sem nome',
          dailyScore,
          weeklyScore,
          monthlyScore,
          overall,
          dailyDone,
          dailyTotal: dailyTasks.length,
          lastCheckin: lastByOrg[orgId] ?? null,
        };
      }).sort((a: OrgPerformance, b: OrgPerformance) => a.overall - b.overall);
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPerformance() {
  const { data: orgs = [], isLoading } = useAdminPerformance();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'good'>('all');
  const navigate = useNavigate();
  const now = new Date();

  const filtered = orgs.filter((o) => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'critical' ? o.overall < 50 :
      o.overall >= 80;
    return matchSearch && matchFilter;
  });

  const avgScore = orgs.length > 0
    ? Math.round(orgs.reduce((s, o) => s + o.overall, 0) / orgs.length)
    : 0;
  const critical = orgs.filter((o) => o.overall < 50).length;
  const excellent = orgs.filter((o) => o.overall >= 80).length;
  const zeroPct = orgs.filter((o) => o.dailyDone === 0 && o.dailyTotal > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight font-display">Performance CRM</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-7 capitalize">
          {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })} · Score diário dos clientes
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Média Geral', value: `${avgScore}%`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'score overall hoje' },
          { label: 'Críticos', value: critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', desc: 'score abaixo de 50%' },
          { label: 'Excelentes', value: excellent, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'score acima de 80%' },
          { label: 'Sem nada hoje', value: zeroPct, icon: Flame, color: 'text-amber-600', bg: 'bg-amber-50', desc: '0 tarefas diárias feitas' },
        ].map(({ label, value, icon: Icon, color, bg, desc }) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('p-1.5 rounded-lg', bg)}>
                <Icon className={cn('h-3.5 w-3.5', color)} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
            </div>
            <p className={cn('text-3xl font-extrabold font-display tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">{desc}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">CLIENTES</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{orgs.length} clientes · atualiza a cada 5 min</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="h-8 pl-8 pr-3 text-[12px] rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-border w-44"
              />
            </div>
            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
              {(['all', 'critical', 'good'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                    filter === f ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f === 'all' ? 'Todos' : f === 'critical' ? 'Críticos' : 'Excelentes'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table rows */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Trophy className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_110px] gap-2 px-5 py-2 bg-muted/20">
              {['Cliente', 'Hoje', 'Semana', 'Mês', 'Overall', 'Status', 'Última ação'].map((h) => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{h}</span>
              ))}
            </div>

            {filtered.map((org) => (
              <div
                key={org.orgId}
                className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_110px] gap-2 px-5 py-3.5 items-center hover:bg-muted/20 transition-colors cursor-pointer group"
                onClick={() => navigate(`/admin/clientes/${org.orgId}`)}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    org.overall >= 80 ? 'bg-emerald-500' : org.overall >= 50 ? 'bg-amber-400' : 'bg-red-500'
                  )} />
                  <span className="text-[13px] font-semibold text-foreground truncate">{org.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>

                {/* Hoje */}
                <div className="flex items-center gap-1.5">
                  <MiniGauge value={org.dailyScore} />
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                    {org.dailyDone}/{org.dailyTotal}
                  </span>
                </div>

                {/* Semana */}
                <span className={cn('text-[13px] font-bold tabular-nums', scoreColor(org.weeklyScore))}>
                  {org.weeklyScore}%
                </span>

                {/* Mês */}
                <span className={cn('text-[13px] font-bold tabular-nums', scoreColor(org.monthlyScore))}>
                  {org.monthlyScore}%
                </span>

                {/* Overall */}
                <span className={cn('text-[14px] font-extrabold tabular-nums font-display', scoreColor(org.overall))}>
                  {org.overall}%
                </span>

                {/* Status badge */}
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md border w-fit', scoreBg(org.overall))}>
                  {scoreLabel(org.overall)}
                </span>

                {/* Last activity */}
                <span className="text-[11px] text-muted-foreground/60">
                  {org.lastCheckin
                    ? format(new Date(org.lastCheckin), "dd/MM 'às' HH:mm")
                    : <span className="text-muted-foreground/30 italic">Nunca</span>
                  }
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
