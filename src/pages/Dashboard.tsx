import {
  UserPlus, TrendingUp, DollarSign, Tag, AlertTriangle, RefreshCw,
  Megaphone, Users, CalendarCheck, BadgeCheck, ArrowRight,
  Target, Activity, ChevronRight, ArrowUpRight, ArrowDownRight,
  Wallet, Zap, Bot, Clock, UserCheck, BarChart3, Stethoscope, Layers, Timer, Gauge,
  Trophy, CheckCircle2, Bell
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { useDashboard, type OrigemFilter } from "@/hooks/useDashboard";
import { usePerformanceBadge } from "@/hooks/usePerformance";
import { useProfile } from "@/hooks/useProfile";
import { DESCOMPLIQUEI_ORG_ID, ANNA_CLARA_ORG_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Button } from "@/components/ui/button";
import { DashboardLeadsModal } from "@/components/dashboard/DashboardLeadsModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* ─── Custom Active Dot ─── */
const PremiumDot = ({ cx, cy, stroke }: any) => (
  <g>
    <circle cx={cx} cy={cy} r={6} fill={stroke} fillOpacity={0.15} />
    <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={stroke} strokeWidth={2} />
  </g>
);

/* ─── Chart Tooltip ─── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
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
              <span className="text-[13px] font-bold text-foreground font-mono tabular-nums">
                {entry.name === 'Faturamento'
                  ? `R$ ${Number(entry.value).toLocaleString('pt-BR')}`
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

/* ─── Custom Legend ─── */
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

/* ─── Rounded Bar Shape ─── */
const RoundedBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  if (height <= 0) return null;
  const radius = Math.min(width / 2, 6);
  return (
    <g>
      <defs>
        <linearGradient id={`barGrad-${x}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity={1} />
          <stop offset="100%" stopColor={fill} stopOpacity={0.6} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={radius} ry={radius} fill={`url(#barGrad-${x})`} />
    </g>
  );
};

/* ─── Floating Label on Bars ─── */
const BarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fontSize={10}
      fontWeight={700}
      fontFamily="var(--font-mono, monospace)"
      fill="hsl(var(--foreground))"
    >
      {value}
    </text>
  );
};

/* ─── Bar Chart Tooltip ─── */
const BarChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl px-4 py-3 shadow-xl">
        <p className="text-[13px] font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.fill || entry.color }} />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-[13px] font-bold font-mono text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const initialDateRange: DateRange = { from: startOfMonth(today), to: endOfMonth(today) };
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const [origemFilter, setOrigemFilter] = useState<OrigemFilter>('geral');
  const [leadsModal, setLeadsModal] = useState<{ title: string; leads: any[] } | null>(null);
  const [showTempoRespostaDetail, setShowTempoRespostaDetail] = useState(false);
  const [showSemRespostaDetail, setShowSemRespostaDetail] = useState(false);

  const { profile } = useProfile();
  const isDescompliqueiOrg = profile?.organization_id === DESCOMPLIQUEI_ORG_ID;
  const isAnnaClaraOrg = profile?.organization_id === ANNA_CLARA_ORG_ID;
  const orgId = profile?.organization_id;
  const { pending: perfPending, total: perfTotal, score: perfScore, pendingTasks: perfPendingTasks } = usePerformanceBadge();
  const currentHour = new Date().getHours();
  const perfUrgency = perfPending === 0
    ? 'done'
    : currentHour < 9  ? 'early'
    : currentHour < 12 ? 'warning'
    : currentHour < 18 ? 'urgent'
    : 'critical';

  const firstName = (profile?.nome_completo || '').split(' ')[0] || 'Doutor(a)';

  /* ── Meta ativa ── */
  const { data: metaAtiva } = useQuery({
    queryKey: ["meta-ativa-widget", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_meta_acompanhamento")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("ativo", true)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const { metrics, isLoading, error: metricsError, refetch } = useDashboard(dateRange, origemFilter);

  /* ── Gradients ── */
  const GRADIENTS = (
    <defs>
      <linearGradient id="gCaptados" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gConvertidos" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gMqls" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.30} />
        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gAgendamentos" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.30} />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gFechamentos" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10b981" stopOpacity={0.30} />
        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );

  /* ── States ── */
  if (metricsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-4 text-center">
        <div className="bg-muted rounded-2xl p-6"><AlertTriangle className="h-8 w-8 text-muted-foreground" /></div>
        <h3 className="text-lg font-semibold font-display">Erro ao carregar o painel</h3>
        <Button onClick={() => refetch()} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> Tentar novamente</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 mx-auto max-w-[1400px]">
        <div className="h-36 rounded-2xl bg-muted/30 animate-pulse" />
        <div className="grid grid-cols-5 gap-px">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-muted/20 rounded-none animate-pulse" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-72 bg-muted/20 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-4 text-center">
        <div className="bg-muted/50 rounded-2xl p-6"><RefreshCw className="h-8 w-8 text-muted-foreground" /></div>
        <h3 className="text-lg font-semibold font-display">Sem dados disponíveis</h3>
        <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> Tentar novamente</Button>
      </div>
    );
  }

  /* ── Data ── */
  const faturamento = metrics.faturamentoTotal ?? 0;
  const funnelConversion: any[] = metrics.funnelConversion ?? [];
  const pipelineDistribution: { name: string; value: number; color: string }[] = metrics.pipelineDistribution ?? [];
  const allStages = metrics.allStages ?? [];
  const totalLeads = metrics.totalLeadsAtivos ?? metrics.totalContatos ?? 0;
  const mqlCount = metrics.mqlCount ?? 0;
  const scheduledCount = metrics.scheduledCount ?? 0;
  const closedCount = metrics.closedCount ?? 0;
  const taxaConversaoGlobal = metrics.taxaConversaoGlobal ?? 0;
  const ticketMedio = metrics.ticketMedio ?? 0;
  const importedLeads = metrics.importedLeads ?? 0;
  const leadsAtendidosIA = metrics.leadsAtendidosIA ?? 0;
  const taxaHandoffIA = metrics.taxaHandoffIA ?? 0;
  const tempoMedioIA = metrics.tempoMedioIA ?? 0;
  const aguardandoContatoHumano = metrics.aguardandoContatoHumano ?? 0;
  const topProcedimentos: { name: string; count: number; leads?: any[] }[] = metrics.topProcedimentos ?? [];

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K` : v.toLocaleString("pt-BR");
  const pctOf = (n: number, total: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0';

  const fmtMinutes = (mins: number) => {
    if (mins <= 0) return '—';
    if (mins < 1) return `${Math.round(mins * 60)}s`;
    if (mins < 60) return `${Math.round(mins)}min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const fmtTempoIA = (s: number) => {
    if (s <= 0) return '—';
    if (s < 60) return `${s}s`;
    return `${Math.round(s / 60)}min`;
  };

  /* ── Funil: derivar nós de stage a partir das transições ── */
  const funnelStageNodes = funnelConversion.length > 0
    ? [
        { name: funnelConversion[0].from, count: funnelConversion[0].fromCount },
        ...funnelConversion.map((s: any) => ({ name: s.to, count: s.toCount })),
      ]
    : [];
  const funnelTotalEntry = metrics.totalLeadsAtivos || funnelStageNodes[0]?.count || 1;
  const FUNNEL_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#0ea5e9', '#10b981', '#22c55e'];

  /* ── Pipeline max para escala de barras ── */
  const pipelineMax = Math.max(...pipelineDistribution.map(d => d.value), 1);

  return (
    <div className="space-y-5 mx-auto max-w-[1400px]">

      {/* ── Performance Widget ── */}
      {perfUrgency === 'done' ? (
        // ─ Estado: tudo em dia ─
        <Link
          to="/crm/performance"
          className="flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-emerald-200/60 bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors group shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-semibold text-emerald-800">Rotina do dia concluída!</span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
                {perfTotal}/{perfTotal} tarefas ✓
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full w-full rounded-full bg-emerald-500 transition-all duration-500" />
              </div>
              <span className="text-[11px] text-emerald-600/70 shrink-0 font-medium">100%</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-emerald-400 group-hover:text-emerald-600 transition-colors shrink-0" />
        </Link>
      ) : perfUrgency === 'early' ? (
        // ─ Estado: cedo (antes das 9h) — informacional ─
        <Link
          to="/crm/performance"
          className="flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors group shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0">
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-semibold text-foreground">Performance do dia</span>
              <span className="text-[10px] text-muted-foreground/60 bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded-md">
                {perfPending} {perfPending === 1 ? 'tarefa' : 'tarefas'} para hoje
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full bg-muted-foreground/20 transition-all duration-500"
                  style={{ width: `${perfTotal > 0 ? ((perfTotal - perfPending) / perfTotal) * 100 : 0}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground/50 shrink-0 tabular-nums">
                {perfTotal - perfPending}/{perfTotal}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-extrabold tabular-nums font-display text-muted-foreground/40">{perfScore}%</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
          </div>
        </Link>
      ) : perfUrgency === 'warning' ? (
        // ─ Estado: aviso (9h–12h) — lembrete suave ─
        <Link
          to="/crm/performance"
          className="flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-amber-200/70 bg-amber-50/50 hover:bg-amber-50/80 transition-colors group shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 shrink-0">
            <Bell className="h-4 w-4 text-amber-600" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-50 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-semibold text-amber-900">Rotina do dia pendente</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
                {perfPending} {perfPending === 1 ? 'pendente' : 'pendentes'}
              </span>
            </div>
            <p className="text-[11px] text-amber-700/70 mb-1.5 truncate">
              {perfPendingTasks.slice(0, 3).map(t => t.title).join(' · ')}{perfPendingTasks.length > 3 ? ` +${perfPendingTasks.length - 3}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-amber-100 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${perfTotal > 0 ? ((perfTotal - perfPending) / perfTotal) * 100 : 0}%` }} />
              </div>
              <span className="text-[11px] text-amber-600/60 shrink-0 tabular-nums">{perfTotal - perfPending}/{perfTotal}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-extrabold tabular-nums font-display text-amber-600">{perfScore}%</span>
            <ChevronRight className="h-4 w-4 text-amber-400 group-hover:text-amber-600 transition-colors" />
          </div>
        </Link>
      ) : perfUrgency === 'urgent' ? (
        // ─ Estado: urgente (12h–18h) — alerta visível ─
        <Link
          to="/crm/performance"
          className="block rounded-2xl border-2 border-orange-300/80 bg-orange-50/60 hover:bg-orange-50/90 transition-colors group shadow-[0_2px_8px_rgba(234,88,12,0.08)]"
        >
          <div className="px-5 py-3 flex items-center justify-between border-b border-orange-200/50">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-orange-900 uppercase tracking-wide">Rotina do dia em aberto</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tabular-nums font-display text-orange-600">{perfScore}%</span>
              <ChevronRight className="h-4 w-4 text-orange-400 group-hover:text-orange-600 transition-colors" />
            </div>
          </div>
          <div className="px-5 py-3">
            <p className="text-[12px] text-orange-800 mb-2 font-medium">
              Você ainda tem <strong>{perfPending} {perfPending === 1 ? 'tarefa' : 'tarefas'}</strong> não registradas. O dia termina à meia-noite.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {perfPendingTasks.slice(0, 5).map(t => (
                <span key={t.id} className="text-[10px] font-medium text-orange-700 bg-orange-100 border border-orange-200/60 px-2 py-0.5 rounded-full">
                  {t.title}
                </span>
              ))}
              {perfPendingTasks.length > 5 && (
                <span className="text-[10px] font-medium text-orange-600 bg-orange-100 border border-orange-200/60 px-2 py-0.5 rounded-full">
                  +{perfPendingTasks.length - 5} mais
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-orange-100 overflow-hidden">
                <div className="h-full rounded-full bg-orange-400 transition-all duration-500"
                  style={{ width: `${perfTotal > 0 ? ((perfTotal - perfPending) / perfTotal) * 100 : 0}%` }} />
              </div>
              <span className="text-[11px] text-orange-600/70 shrink-0 tabular-nums font-medium">{perfTotal - perfPending}/{perfTotal} concluídas</span>
            </div>
          </div>
        </Link>
      ) : (
        // ─ Estado: crítico (após 18h) — última chance ─
        <Link
          to="/crm/performance"
          className="block rounded-2xl border-2 border-red-400/70 bg-red-50/70 hover:bg-red-50 transition-colors group shadow-[0_2px_8px_rgba(239,68,68,0.10)]"
        >
          <div className="px-5 py-3 flex items-center justify-between border-b border-red-200/60">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-red-900 uppercase tracking-wide">Última chance — dia termina à meia-noite</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tabular-nums font-display text-red-600">{perfScore}%</span>
              <ChevronRight className="h-4 w-4 text-red-400 group-hover:text-red-600 transition-colors" />
            </div>
          </div>
          <div className="px-5 py-3">
            <p className="text-[12px] text-red-800 mb-2 font-medium">
              <strong>{perfPending} {perfPending === 1 ? 'tarefa não registrada' : 'tarefas não registradas'}</strong> — se não preencher agora, o score cai permanentemente.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {perfPendingTasks.map(t => (
                <span key={t.id} className="text-[10px] font-medium text-red-700 bg-red-100 border border-red-200/60 px-2 py-0.5 rounded-full">
                  {t.title}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-red-100 overflow-hidden">
                <div className="h-full rounded-full bg-red-400 transition-all duration-500"
                  style={{ width: `${perfTotal > 0 ? ((perfTotal - perfPending) / perfTotal) * 100 : 0}%` }} />
              </div>
              <span className="text-[11px] text-red-600/70 shrink-0 tabular-nums font-medium">{perfTotal - perfPending}/{perfTotal} concluídas</span>
            </div>
          </div>
        </Link>
      )}

      {/* ═══════════════════════════════════════════════
          ① HERO HEADER
      ═══════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 pt-6 pb-0 flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-muted-foreground/60 mb-1 uppercase tracking-widest font-medium">
              {format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <h1 className="text-[26px] font-bold text-foreground font-display tracking-tight leading-tight">
              Olá, {firstName}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              Aqui está o resumo do seu CRM no período selecionado
            </p>
          </div>
          <DateRangePicker date={dateRange} setDate={setDateRange} />
        </div>
        {/* Filtro de origem — centralizado */}
        <div className="flex justify-center px-6 py-4" data-tutorial="dashboard-period">
          <div className="flex rounded-xl border border-border/60 bg-muted/30 p-1 gap-0.5">
            {([
              { key: 'geral',      label: 'Geral' },
              { key: 'marketing',  label: 'Marketing' },
              { key: 'organico',   label: 'Orgânico' },
              { key: 'reativacao', label: 'Reativação' },
              ...(isAnnaClaraOrg ? [{ key: 'convenio' as OrigemFilter, label: 'Convênio' }] : []),
              { key: 'paciente',   label: 'Paciente' },
            ] as { key: OrigemFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setOrigemFilter(key)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-150",
                  origemFilter === key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPIs Strip ── */}
        <div className="border-t border-border/40" data-tutorial="dashboard-metrics">
          {isDescompliqueiOrg ? (
            /* ── Descompliquei: Funil horizontal ── */
            (() => {
              const f = metrics.descompliqueiFunnel ?? { leads: 0, mql: 0, scheduled: 0, closed: 0, txMql: 0, txAgendamento: 0, txConversao: 0 };
              const steps = [
                { label: 'Leads Captados', value: f.leads, icon: UserPlus, color: '#6366f1' },
                { label: 'Qualificados', value: f.mql, icon: Tag, color: '#8b5cf6' },
                { label: 'Agendamentos', value: f.scheduled, icon: CalendarCheck, color: '#3b82f6' },
                { label: 'Fechamentos', value: f.closed, icon: BadgeCheck, color: '#10b981' },
              ];
              const rates = [f.txMql, f.txAgendamento, f.txConversao];
              return (
                <div className="flex items-stretch divide-x divide-border/40 bg-muted/[0.02]">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.label} className="flex-1 relative">
                        <div className="px-6 py-5">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em]">{step.label}</span>
                          </div>
                          <div className="flex items-baseline gap-3">
                            <span className="text-[32px] font-bold font-display text-foreground leading-none tracking-tight">{step.value}</span>
                            {i < steps.length - 1 && (
                              <span className="text-xs font-semibold font-mono px-1.5 py-0.5 rounded-md" style={{ color: steps[i + 1].color, backgroundColor: steps[i + 1].color + '10' }}>
                                {rates[i]}%
                              </span>
                            )}
                          </div>
                        </div>
                        {i < steps.length - 1 && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-card border border-border/40 rounded-full p-1">
                            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            /* ── Clientes: 5 KPIs no hero ── */
            <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border/40">
              {[
                { label: 'Total de Leads',         value: totalLeads.toString(),                                           sub: 'no período',            icon: UserPlus,    color: '#E85D24', listKey: 'totalLeadsList' },
                { label: 'Faturamento',            value: fmtCurrency(metrics.faturamentoTotal ?? 0),                     sub: 'receita no período',    icon: DollarSign,  color: '#10b981', listKey: null },
                { label: 'Ticket Médio',           value: fmtCurrency(metrics.ticketMedio ?? 0),                          sub: 'por venda fechada',     icon: Wallet,      color: '#6366f1', listKey: null },
                { label: 'Taxa de Conversão',      value: `${(metrics.taxaConversaoGlobal ?? 0).toFixed(1)}%`,            sub: 'leads → fechamentos',   icon: TrendingUp,  color: '#8b5cf6', listKey: null },
                { label: 'Vendas',                 value: (metrics.vendasCount ?? 0).toString(),                          sub: 'fechamentos no período', icon: BadgeCheck,  color: '#3b82f6', listKey: null },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "flex flex-col gap-2 px-5 py-5 bg-card transition-colors duration-150",
                      item.listKey && "cursor-pointer hover:bg-muted/20"
                    )}
                    onClick={() => item.listKey && setLeadsModal({ title: item.label, leads: (metrics as any)[item.listKey] ?? [] })}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: item.color + '15' }}>
                        <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.06em]">{item.label}</span>
                    </div>
                    <div>
                      <span className="text-[28px] font-bold font-display text-foreground leading-none tracking-tight">{item.value}</span>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{item.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Origem dos Leads (apenas clientes, apenas no filtro geral) ── */}
      {!isDescompliqueiOrg && origemFilter === 'geral' && (() => {
        const oc = metrics?.origemCounts;
        const ol = metrics?.origemLeads;
        if (!oc) return null;
        const total = oc.total || 1;
        const origens = [
          { key: 'marketing',  label: 'Marketing',  color: '#f59e0b', bg: '#f59e0b15', count: oc.marketing,  leads: ol?.marketing  ?? [] },
          { key: 'organico',   label: 'Orgânico',   color: '#22c55e', bg: '#22c55e15', count: oc.organico,   leads: ol?.organico   ?? [] },
          { key: 'reativacao', label: 'Reativação', color: '#06b6d4', bg: '#06b6d415', count: oc.reativacao, leads: ol?.reativacao ?? [] },
          ...(isAnnaClaraOrg ? [{ key: 'convenio', label: 'Convênio', color: '#8b5cf6', bg: '#8b5cf615', count: oc.convenio ?? 0, leads: ol?.convenio ?? [] }] : []),
          // Paciente é excluído do geral — só aparece quando o filtro Paciente está selecionado
          ...(origemFilter !== 'geral' ? [{ key: 'paciente', label: 'Paciente', color: '#14b8a6', bg: '#14b8a615', count: oc.paciente, leads: ol?.paciente ?? [] }] : []),
        ].filter(o => o.count > 0 || origemFilter === 'geral');

        return (
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-origem">
            <div className="px-5 py-3 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">ORIGEM DOS LEADS</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Distribuição por canal de aquisição · {oc.total} leads no período</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center divide-x divide-border/40">
              {origens.map(o => (
                <div
                  key={o.key}
                  onClick={() => o.count > 0 && setLeadsModal({ title: `Leads · ${o.label}`, leads: o.leads })}
                  className={cn("flex flex-col items-center gap-2 p-5 bg-card transition-colors text-center flex-1 min-w-[160px]", o.count > 0 ? "cursor-pointer hover:bg-muted/20" : "opacity-40")}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{o.label}</span>
                  </div>
                  <div className="text-[30px] font-bold font-display leading-none" style={{ color: o.color }}>{o.count}</div>
                  <div className="text-[10px] text-muted-foreground/50">{total > 0 ? ((o.count / total) * 100).toFixed(0) : 0}% do total</div>
                  <div className="w-full h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${total > 0 ? (o.count / total) * 100 : 0}%`, backgroundColor: o.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════
          ② META WIDGET
      ═══════════════════════════════════════════════ */}
      {(() => {
        const m = metaAtiva;
        if (!m) {
          return (
            <div data-tutorial="dashboard-meta" className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Nenhuma meta ativa</p>
                  <p className="text-xs text-muted-foreground">Defina metas para acompanhar seu progresso</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/crm/metas")} className="shrink-0 gap-1.5 rounded-lg">
                Criar meta <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }

        const diasRestantes = Math.max(Number(m.dias_restantes) || 0, 0);
        const receitaTotal = Number(m.receita_total) || 0;
        const metaReceita = Number(m.meta_receita) || 1;
        const leadsTotal = Number(m.leads_total) || 0;
        const metaLeads = Number(m.meta_leads) || 0;
        const reunioesTotal = Number(m.reunioes_total) || 0;
        const metaReunioes = Number(m.meta_reunioes) || 0;
        const fechamentosTotal = Number(m.fechamentos_total) || 0;
        const metaFechamentos = Number(m.meta_fechamentos) || 0;
        const leadsHoje = Number(m.leads_hoje) || 0;
        const leadsSemana = Number(m.leads_semana) || 0;
        const metaLeadsDia = Number(m.meta_leads_dia) || 0;
        const metaLeadsSemana = Number(m.meta_leads_semana) || 0;
        const leadsNecessariosDia = Number(m.leads_necessarios_por_dia) || 0;

        const pctReceita = metaReceita > 0 ? Math.round((receitaTotal / metaReceita) * 100) : 0;
        const pctLeads = metaLeads > 0 ? Math.round((leadsTotal / metaLeads) * 100) : 0;
        const pctReunioes = metaReunioes > 0 ? Math.round((reunioesTotal / metaReunioes) * 100) : 0;
        const pctFechamentos = metaFechamentos > 0 ? Math.round((fechamentosTotal / metaFechamentos) * 100) : 0;

        const metaBatida = pctReceita >= 100;
        const hojeBateu = leadsHoje >= metaLeadsDia;
        const semanaBateu = leadsSemana >= metaLeadsSemana;

        const barColor = (pct: number) => pct >= 100 ? "#10b981" : pct >= 60 ? "#3b82f6" : pct >= 30 ? "#f59e0b" : "#ef4444";

        const metricsList = [
          { label: "Receita", real: `R$${fmtK(receitaTotal)}`, meta: `R$${fmtK(metaReceita)}`, pct: pctReceita },
          { label: "Leads", real: String(leadsTotal), meta: String(metaLeads), pct: pctLeads },
          { label: "Agendamentos", real: String(reunioesTotal), meta: String(metaReunioes), pct: pctReunioes },
          { label: "Fechamentos", real: String(fechamentosTotal), meta: String(metaFechamentos), pct: pctFechamentos },
        ];

        return (
          <div data-tutorial="dashboard-meta" className={cn("rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden", metaBatida && "ring-1 ring-emerald-500/20")}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", metaBatida ? "bg-emerald-500/10" : "bg-muted")}>
                  <Target className={cn("h-4 w-4", metaBatida ? "text-emerald-600" : "text-muted-foreground")} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{diasRestantes > 0 ? `${diasRestantes} dias restantes` : "Encerrada"}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate("/crm/metas")} className="gap-1 text-xs h-8 text-muted-foreground hover:text-foreground">
                Detalhes <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 px-5 pb-4">
              {metricsList.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
                    <span className="text-[11px] font-bold font-mono" style={{ color: barColor(item.pct) }}>{item.pct}%</span>
                  </div>
                  <div className="text-base font-bold font-display text-foreground">
                    {item.real} <span className="text-muted-foreground font-normal text-xs font-sans">/ {item.meta}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: barColor(item.pct) }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/40 bg-muted/20 px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                Hoje: <span className="font-mono font-semibold text-foreground">{leadsHoje}</span> leads
                <span className={cn("h-1.5 w-1.5 rounded-full", hojeBateu ? "bg-emerald-500" : "bg-red-400")} />
              </span>
              <span className="h-3 w-px bg-border" />
              <span className="flex items-center gap-1.5">
                Semana: <span className="font-mono font-semibold text-foreground">{leadsSemana}</span> leads
                <span className={cn("h-1.5 w-1.5 rounded-full", semanaBateu ? "bg-emerald-500" : "bg-red-400")} />
              </span>
              <span className="h-3 w-px bg-border" />
              <span>Pace: <span className="font-mono font-semibold text-foreground">{leadsNecessariosDia}</span> leads/dia</span>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════
          DESCOMPLIQUEI ONLY — Scoring + Eficiência
      ═══════════════════════════════════════════════ */}
      {isDescompliqueiOrg && (() => {
        const scoring = metrics.scoringDistribution ?? [];
        const totalQualified = scoring.reduce((sum: number, s: any) => sum + s.count, 0);
        const aq = metrics.acquisitionEfficiency ?? { investment: 0, cpl: null, cpm: null, cpa: null, cpf: null };
        const fmt = (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '—';
        const roas = (aq.investment && aq.investment > 0 && faturamento > 0)
          ? (faturamento / aq.investment).toFixed(1) + 'x' : '—';

        const SCORING_META: Record<string, { label: string; color: string }> = {
          A: { label: 'Lead dos sonhos', color: '#10b981' },
          B: { label: 'Qualificado c/ ressalva', color: '#3b82f6' },
          C: { label: 'Em desenvolvimento', color: '#f59e0b' },
          D: { label: 'Fora do ICP', color: '#ef4444' },
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <h3 className="text-[15px] font-semibold font-display text-foreground">Qualidade dos Leads</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{totalQualified} MQLs qualificados no período</p>
              </div>
              <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                {scoring.map((s: any) => {
                  const meta = SCORING_META[s.scoring];
                  const pct = totalQualified > 0 ? Math.round((s.count / totalQualified) * 100) : 0;
                  return (
                    <div key={s.scoring} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shrink-0" style={{ backgroundColor: meta.color }}>
                        {s.scoring}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[13px] font-medium text-foreground truncate">{meta.label}</span>
                          <span className="text-sm font-bold font-mono ml-2" style={{ color: meta.color }}>{pct}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-border/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: meta.color }} />
                          </div>
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{s.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <h3 className="text-[15px] font-semibold font-display text-foreground">Eficiência de Aquisição</h3>
                {aq.investment > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Investimento: <span className="font-mono font-semibold text-foreground">{fmt(aq.investment)}</span></p>
                )}
              </div>
              <div className="px-5 pb-5 space-y-3">
                {[
                  { label: 'CPL', desc: 'Custo por Lead', value: fmt(aq.cpl), color: '#6366f1' },
                  { label: 'CPMQL', desc: 'Custo por MQL', value: fmt(aq.cpm), color: '#8b5cf6' },
                  { label: 'CPR', desc: 'Custo por Reunião', value: fmt(aq.cpa), color: '#3b82f6' },
                  { label: 'CPA', desc: 'Custo de Aquisição', value: fmt(aq.cpf), color: '#10b981' },
                  { label: 'ROAS', desc: 'Retorno sobre Ads', value: roas, color: '#f59e0b' },
                ].map((c) => (
                  <div key={c.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <div>
                        <span className="text-[13px] font-medium text-foreground">{c.label}</span>
                        <span className="text-[11px] text-muted-foreground ml-1.5">{c.desc}</span>
                      </div>
                    </div>
                    <span className="text-[15px] font-bold font-display text-foreground">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════
          CLIENT ONLY — Seções exclusivas para clientes
      ═══════════════════════════════════════════════ */}
      {!isDescompliqueiOrg && (
        <>
          {/* ③ FUNIL DE CONVERSÃO — redesenhado */}
          {/* ③ FUNIL COMERCIAL — 4 etapas fixas de negócio */}
          {(() => {
            const cf = metrics.comercialFunnel;
            if (!cf) return null;
            const CF_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981'];
            const stages = [
              { key: 'leads',        label: 'Leads',        count: cf.leads.count,        pct: cf.leads.pct,        rate: null,                  listKey: 'totalLeadsList',     listTitle: 'Leads no período' },
              { key: 'mql',          label: 'MQLs',         count: cf.mql.count,          pct: cf.mql.pct,          rate: cf.mql.rate,           listKey: 'mqlLeadsList',       listTitle: 'Leads Qualificados (MQL)' },
              { key: 'agendamentos', label: 'Agendamentos', count: cf.agendamentos.count, pct: cf.agendamentos.pct, rate: cf.agendamentos.rate,  listKey: 'scheduledLeadsList', listTitle: 'Leads Agendados' },
              { key: 'fechamentos',  label: 'Fechamentos',  count: cf.fechamentos.count,  pct: cf.fechamentos.pct,  rate: cf.fechamentos.rate,   listKey: 'closedLeadsList',    listTitle: 'Leads Fechados' },
            ];
            return (
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-conversion">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-muted">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">FUNIL COMERCIAL</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Conversão nos marcos de negócio do período</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground/50 font-mono">{cf.leads.count} leads ativos no período</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-stretch gap-2">
                    {stages.map((stage, i) => {
                      const color = CF_COLORS[i];
                      return (
                        <div key={stage.key} className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Arrow ANTES do card — mostra taxa de conversão da etapa anterior para esta */}
                          {i > 0 && stage.rate !== null && (
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded-full border"
                                style={{ color, borderColor: color + '30', backgroundColor: color + '0a' }}>
                                {stage.rate}%
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                            </div>
                          )}
                          <div
                            className="relative flex flex-col justify-between p-3 rounded-xl w-full border transition-colors duration-150 cursor-pointer hover:shadow-md"
                            style={{ backgroundColor: color + '07', borderColor: color + '30' }}
                            onClick={() => setLeadsModal({ title: stage.listTitle, leads: (metrics as any)[stage.listKey] ?? [] })}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color, backgroundColor: color + '15' }}>
                                {i + 1}
                              </span>
                              <span className="text-[11px] font-bold font-mono" style={{ color }}>
                                {stage.pct}%
                              </span>
                            </div>
                            <div>
                              <div className="text-[26px] font-bold font-display text-foreground leading-none">{stage.count}</div>
                              <div className="text-[11px] text-muted-foreground mt-1 truncate">{stage.label}</div>
                            </div>
                            <div className="h-1 bg-border/30 rounded-full overflow-hidden mt-2.5">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(stage.pct, 3)}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ④ PERFORMANCE COMERCIAL — 3 cards */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-performance">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">PERFORMANCE COMERCIAL</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Taxas de conversão do período</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border/40">
              {[
                {
                  label: 'Taxa de MQL',
                  value: `${metrics.taxaMQL ?? 0}%`,
                  sub: `${mqlCount} de ${totalLeads} lead${totalLeads !== 1 ? 's' : ''}`,
                  icon: Tag,
                  color: '#8b5cf6',
                  listKey: 'mqlLeadsList',
                  listTitle: 'Leads Qualificados (MQL)',
                },
                {
                  label: 'Taxa Agendamento',
                  value: `${metrics.taxaAgendamento ?? 0}%`,
                  sub: `${scheduledCount} de ${mqlCount} qualificado${mqlCount !== 1 ? 's' : ''}`,
                  icon: CalendarCheck,
                  color: '#3b82f6',
                  listKey: 'scheduledLeadsList',
                  listTitle: 'Leads Agendados',
                },
                {
                  label: 'Taxa Fechamento',
                  value: `${metrics.taxaFechamento ?? 0}%`,
                  sub: `${closedCount} de ${scheduledCount} agendado${scheduledCount !== 1 ? 's' : ''}`,
                  icon: BadgeCheck,
                  color: '#10b981',
                  listKey: 'closedLeadsList',
                  listTitle: 'Leads Fechados',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "flex flex-col gap-3 p-5 bg-card transition-colors duration-150",
                      item.listKey && "cursor-pointer hover:bg-muted/20"
                    )}
                    onClick={() => item.listKey && setLeadsModal({ title: item.listTitle!, leads: (metrics as any)[item.listKey] ?? [] })}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: item.color + '12' }}
                      >
                        <Icon className="h-4 w-4" style={{ color: item.color }} />
                      </span>
                      {item.listKey && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                      )}
                    </div>
                    <div>
                      <div className="text-[28px] font-bold font-display text-foreground leading-none">
                        {item.value}
                      </div>
                      <div className="text-[12px] font-medium text-foreground/70 mt-1.5">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground/50 mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ⑤ COMPARECIMENTOS & NO-SHOW */}
          {(() => {
            const ag = metrics.agendamentos ?? {
              total: 0, realizados: 0, noShow: 0, confirmados: 0,
              cancelados: 0, remarcados: 0, taxaComparecimento: 0,
              taxaNoShow: 0, valorOrcadoRealizados: 0,
            };
            const semDados = ag.total === 0;
            return (
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-comparecimentos">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-muted">
                        <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">COMPARECIMENTOS & NO-SHOW</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Presença e ausência nas consultas agendadas no período</p>
                      </div>
                    </div>
                    {!semDados && ag.valorOrcadoRealizados > 0 && (
                      <span className="text-[11px] text-muted-foreground/60 font-mono">
                        Orçado realizado: <span className="font-semibold text-foreground">{fmtCurrency(ag.valorOrcadoRealizados)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {semDados ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <CalendarCheck className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum agendamento no período</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Crie agendamentos para visualizar as métricas de comparecimento</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-border/40">
                    {[
                      {
                        label: 'Total Agendado',
                        value: ag.total.toString(),
                        sub: 'no período',
                        icon: CalendarCheck,
                        color: '#6366f1',
                        extra: null,
                        list: ag.leadsTotal,
                      },
                      {
                        label: 'Compareceram',
                        value: ag.realizados.toString(),
                        sub: 'consultas realizadas',
                        icon: BadgeCheck,
                        color: '#10b981',
                        extra: null,
                        list: ag.leadsRealizados,
                      },
                      {
                        label: 'No-Show',
                        value: ag.noShow.toString(),
                        sub: 'não compareceram',
                        icon: Users,
                        color: '#ef4444',
                        extra: null,
                        list: ag.leadsNoShow,
                      },
                      {
                        label: 'Cancelados',
                        value: ag.cancelados.toString(),
                        sub: 'cancelados no período',
                        icon: RefreshCw,
                        color: '#f59e0b',
                        extra: null,
                        list: ag.leadsCancelados,
                      },
                      {
                        label: 'Taxa Comparecimento',
                        value: ag.taxaComparecimento > 0 ? `${ag.taxaComparecimento}%` : '—',
                        sub: 'realizados / finalizados',
                        icon: TrendingUp,
                        color: '#10b981',
                        extra: ag.taxaComparecimento,
                        list: ag.leadsRealizados,
                      },
                      {
                        label: 'Taxa No-Show',
                        value: ag.taxaNoShow > 0 ? `${ag.taxaNoShow}%` : '—',
                        sub: 'no-show / finalizados',
                        icon: ArrowDownRight,
                        color: '#ef4444',
                        extra: ag.taxaNoShow,
                        list: ag.leadsNoShow,
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const barColor = item.extra !== null
                        ? (item.color === '#10b981'
                          ? (item.extra >= 70 ? '#10b981' : item.extra >= 40 ? '#f59e0b' : '#ef4444')
                          : (item.extra <= 20 ? '#10b981' : item.extra <= 40 ? '#f59e0b' : '#ef4444'))
                        : item.color;
                      const clickable = item.list && item.list.length > 0;
                      return (
                        <div
                          key={item.label}
                          className={cn("flex flex-col gap-3 p-5 bg-card", clickable && "cursor-pointer hover:bg-muted/20 transition-colors")}
                          onClick={() => clickable && setLeadsModal({ title: `Comparecimentos — ${item.label}`, leads: item.list! })}
                        >
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg"
                            style={{ backgroundColor: item.color + '12' }}
                          >
                            <Icon className="h-4 w-4" style={{ color: item.color }} />
                          </span>
                          <div>
                            <div
                              className="text-[28px] font-bold font-display leading-none"
                              style={{ color: item.extra !== null ? barColor : 'hsl(var(--foreground))' }}
                            >
                              {item.value}
                            </div>
                            <div className="text-[12px] font-medium text-foreground/70 mt-1.5">{item.label}</div>
                            <div className="text-[10px] text-muted-foreground/50 mt-0.5">{item.sub}</div>
                            {item.extra !== null && (
                              <div className="h-1 bg-muted/40 rounded-full overflow-hidden mt-2.5">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${Math.min(item.extra, 100)}%`, backgroundColor: barColor }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ⑦ TEMPO DE RESPOSTA HUMANO */}
          {(() => {
            const tr = metrics?.tempoResposta ?? {
              humano: { tempoResposta: 0, duracaoAtendimento: 0, totalConversas: 0, totalTurnos: 0 },
              geral: { totalConversas: 0 },
            };
            const h = tr.humano;
            const g = tr.geral;
            const semDados = h.totalConversas === 0;

            return (
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-tempo-resposta">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-muted">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TEMPO DE RESPOSTA HUMANO</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Velocidade e duração do atendimento humano no período</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!semDados && (
                        <span className="text-[11px] text-muted-foreground/60">
                          {h.totalConversas} com atendimento humano · {h.totalTurnos} com lead iniciando
                        </span>
                      )}
                      {!semDados && (
                        <button
                          onClick={() => setShowTempoRespostaDetail(true)}
                          className="h-7 px-3 rounded-lg text-[11px] font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex items-center gap-1.5"
                        >
                          <BarChart3 className="h-3 w-3" />
                          Ver por horário
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {semDados ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <Timer className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum atendimento humano no período</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Dados aparecem quando há conversas com respostas humanas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-px bg-border/40">
                    <div className="flex flex-col gap-3 p-5 bg-card">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: '#6366f115' }}>
                        <Clock className="h-4 w-4" style={{ color: '#6366f1' }} />
                      </span>
                      <div>
                        <div className="text-[28px] font-bold font-display leading-none">{fmtMinutes(h.tempoResposta)}</div>
                        <div className="text-[12px] font-medium text-foreground/70 mt-1.5">Tempo de Primeira Resposta</div>
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5">média — lead envia msg → humano responde</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 p-5 bg-card">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: '#8b5cf615' }}>
                        <Timer className="h-4 w-4" style={{ color: '#8b5cf6' }} />
                      </span>
                      <div>
                        <div className="text-[28px] font-bold font-display leading-none">{fmtMinutes(h.duracaoAtendimento)}</div>
                        <div className="text-[12px] font-medium text-foreground/70 mt-1.5">Duração do Atendimento</div>
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5">média — primeira à última mensagem</div>
                      </div>
                    </div>
                    <div
                      className="flex flex-col gap-3 p-5 bg-card cursor-pointer hover:bg-muted/20 transition-colors group"
                      onClick={() => setShowSemRespostaDetail(true)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: '#ef444415' }}>
                          <AlertTriangle className="h-4 w-4" style={{ color: '#ef4444' }} />
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                      </div>
                      <div>
                        <div className="text-[28px] font-bold font-display leading-none" style={{ color: (h.taxaSemResposta ?? 0) > 30 ? '#ef4444' : (h.taxaSemResposta ?? 0) > 10 ? '#f97316' : '#22c55e' }}>
                          {(h.taxaSemResposta ?? 0).toFixed(1)}%
                        </div>
                        <div className="text-[12px] font-medium text-foreground/70 mt-1.5">Sem Resposta em 24h</div>
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5">{h.semResposta ?? 0} de {h.totalConversasComLead ?? 0} conversas · clique para ver</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ⑧ TOP PROCEDIMENTOS + DISTRIBUIÇÃO DO PIPELINE */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Top Procedimentos — 3 colunas */}
            <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-top-procedimentos">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TOP PROCEDIMENTOS</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Procedimentos mais solicitados pelos leads no período</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {topProcedimentos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <Stethoscope className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Sem dados de procedimentos</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Cadastre o campo "Procedimento de Interesse" nos leads</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topProcedimentos.map((proc, i) => {
                      const maxCount = topProcedimentos[0]?.count || 1;
                      const pct = Math.round((proc.count / maxCount) * 100);
                      const PROC_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#0ea5e9', '#10b981', '#22c55e', '#f59e0b', '#ef4444'];
                      const color = PROC_COLORS[i % PROC_COLORS.length];
                      return (
                        <div
                          key={proc.name}
                          className="group flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => setLeadsModal({ title: proc.name, leads: proc.leads ?? [] })}
                        >
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[13px] font-medium text-foreground truncate">{proc.name}</span>
                              <span className="text-[12px] font-bold font-mono text-foreground ml-2 shrink-0">{proc.count}</span>
                            </div>
                            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color, opacity: 0.8 }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Distribuição do Pipeline — 2 colunas */}
            <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-funnel">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">PIPELINE ATUAL</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Leads por etapa — clique para ver detalhes</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {pipelineDistribution.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <BarChart3 className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum lead no pipeline</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Adicione leads para visualizar a distribuição</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pipelineDistribution.map((entry) => {
                      const pct = (entry.value / pipelineMax) * 100;
                      const stage = allStages.find((s: any) => s.nome === entry.name);
                      return (
                        <div
                          key={entry.name}
                          className="group cursor-pointer"
                          onClick={() => {
                            if (!stage) return;
                            const stageLeads = (metrics.filteredAllLeadsList ?? []).filter(
                              (l: any) => l.posicao_pipeline === stage.posicao_ordem
                            );
                            setLeadsModal({ title: `Etapa: ${entry.name}`, leads: stageLeads });
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="text-[12px] font-medium text-foreground group-hover:text-foreground/80 transition-colors truncate max-w-[120px]">
                                {entry.name}
                              </span>
                            </div>
                            <span className="text-[14px] font-bold font-display text-foreground tabular-nums">{entry.value}</span>
                          </div>
                          <div className="h-2 bg-muted/40 rounded-full overflow-hidden group-hover:bg-muted/60 transition-colors">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: entry.color, opacity: 0.8 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ⑦ EVOLUÇÃO NO TEMPO — gráfico de barras */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="dashboard-chart">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">EVOLUÇÃO NO TEMPO</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Volume de captação e conversão diária no período</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#E85D24]" />
                    <span className="text-[11px] text-muted-foreground font-medium">Captados</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-[11px] text-muted-foreground font-medium">Convertidos</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <div className="h-[260px] [&_.recharts-bar-rectangle]:cursor-pointer [&_.recharts-bar-rectangle_path]:cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.leadsOverTime ?? []}
                    margin={{ top: 24, right: 8, left: -10, bottom: 0 }}
                    barCategoryGap="25%"
                    barGap={2}
                    barSize={16}
                  >
                    <XAxis
                      dataKey="day"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      stroke="hsl(var(--muted-foreground))"
                      dy={8}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip content={<BarChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3, radius: 4 }} />
                    <Bar dataKey="captados" name="Captados" fill="#E85D24" shape={<RoundedBar />} label={<BarLabel />} cursor="pointer"
                      onClick={(data: any) => data?.captadosList?.length && setLeadsModal({ title: `Captados em ${data.day}`, leads: data.captadosList })}
                    />
                    <Bar dataKey="convertidos" name="Convertidos" fill="#10b981" shape={<RoundedBar />} cursor="pointer"
                      onClick={(data: any) => data?.convertidosList?.length && setLeadsModal({ title: `Convertidos em ${data.day}`, leads: data.convertidosList })}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
          DESCOMPLIQUEI ONLY — Performance + Gráfico
      ═══════════════════════════════════════════════ */}
      {isDescompliqueiOrg && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">

          {/* Performance Comercial */}
          <div data-tutorial="dashboard-performance" className="rounded-xl border border-border bg-card overflow-hidden lg:col-span-1">
            <div className="px-5 pt-5 pb-4">
              <h3 className="text-[15px] font-semibold font-display text-foreground">Performance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Taxas de conversão</p>
            </div>
            <div className="px-5 pb-5 space-y-1">
              {[
                { label: 'Taxa de MQL', value: `${pctOf(mqlCount, totalLeads)}%`, sub: `${mqlCount} qualificados`, color: '#8b5cf6', icon: Tag, listKey: 'mqlLeadsList', listTitle: 'Leads Qualificados (MQL)' },
                { label: 'Taxa Agendamento', value: `${pctOf(scheduledCount, totalLeads)}%`, sub: `${scheduledCount} agendados`, color: '#3b82f6', icon: CalendarCheck, listKey: 'scheduledLeadsList', listTitle: 'Leads Agendados' },
                { label: 'Taxa Fechamento', value: `${pctOf(closedCount, totalLeads)}%`, sub: `${closedCount} fechados`, color: '#10b981', icon: BadgeCheck, listKey: 'closedLeadsList', listTitle: 'Leads Fechados' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setLeadsModal({ title: item.listTitle, leads: (metrics as any)[item.listKey] ?? [] })}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: item.color + '12' }}>
                      <Icon className="h-4 w-4" style={{ color: item.color }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-foreground">{item.label}</span>
                      <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                    </div>
                    <span className="text-lg font-bold font-display text-foreground shrink-0">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráfico Descompliquei */}
          <div data-tutorial="dashboard-chart" className="rounded-xl border border-border bg-card overflow-hidden lg:col-span-2">
            <div className="px-5 pt-5 pb-1">
              <h3 className="text-[15px] font-semibold font-display text-foreground">Evolução no Tempo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Marketing — evolução diária</p>
            </div>
            <div className="px-3 pb-3 pt-0">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.descompliqueiOverTime ?? []} margin={{ top: 20, right: 16, left: -10, bottom: 0 }}>
                    {GRADIENTS}
                    <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" dy={8} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Legend content={<PremiumLegend />} />
                    <Area type="natural" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gCaptados)" activeDot={<PremiumDot />} dot={false} />
                    <Area type="natural" dataKey="mqls" name="MQLs" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gMqls)" activeDot={<PremiumDot />} dot={false} />
                    <Area type="natural" dataKey="agendamentos" name="Agendamentos" stroke="#3b82f6" strokeWidth={2} fill="url(#gAgendamentos)" activeDot={<PremiumDot />} dot={false} />
                    <Area type="natural" dataKey="fechamentos" name="Fechamentos" stroke="#10b981" strokeWidth={2} fill="url(#gFechamentos)" activeDot={<PremiumDot />} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      <DashboardLeadsModal
        open={!!leadsModal}
        onClose={() => setLeadsModal(null)}
        title={leadsModal?.title ?? ''}
        leads={leadsModal?.leads ?? []}
        stages={allStages}
      />

      {/* ── Modal: Conversas Sem Resposta em 24h ── */}
      {(() => {
        const tr = metrics?.tempoResposta;
        if (!tr) return null;
        const h = tr.humano;
        const semRespostaLeads: any[] = h?.semRespostaLeads ?? [];
        const taxa = h?.taxaSemResposta ?? 0;
        const total = h?.totalConversasComLead ?? 0;
        const semResp = h?.semResposta ?? 0;
        const comResp = total - semResp;
        const taxaColor = taxa > 30 ? '#ef4444' : taxa > 10 ? '#f97316' : '#22c55e';

        return (
          <Dialog open={showSemRespostaDetail} onOpenChange={setShowSemRespostaDetail}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
              <DialogHeader className="px-6 py-5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div>
                    <DialogTitle className="text-[15px] font-bold text-foreground font-display">
                      Conversas Sem Resposta em 24h
                    </DialogTitle>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      Leads que enviaram mensagem e não receberam retorno humano dentro de 24 horas
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-5">

                {/* Métricas resumo */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                    <div className="text-[26px] font-bold font-display leading-none" style={{ color: taxaColor }}>{taxa.toFixed(1)}%</div>
                    <div className="text-[11px] text-muted-foreground mt-1.5">Taxa sem resposta</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                    <div className="text-[26px] font-bold font-display leading-none text-foreground">{semResp}</div>
                    <div className="text-[11px] text-muted-foreground mt-1.5">Sem resposta</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
                    <div className="text-[26px] font-bold font-display leading-none text-foreground">{comResp}</div>
                    <div className="text-[11px] text-muted-foreground mt-1.5">Com resposta</div>
                  </div>
                </div>

                {/* Barra de progresso visual */}
                {total > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">Respondidas</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">Sem resposta</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted/40 overflow-hidden flex">
                      <div
                        className="h-full rounded-l-full transition-all"
                        style={{ width: `${((comResp / total) * 100).toFixed(1)}%`, backgroundColor: '#22c55e' }}
                      />
                      <div
                        className="h-full rounded-r-full transition-all"
                        style={{ width: `${taxa.toFixed(1)}%`, backgroundColor: taxaColor }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground/60">{((comResp / total) * 100).toFixed(1)}% ({comResp})</span>
                      <span className="text-[10px] text-muted-foreground/60">{taxa.toFixed(1)}% ({semResp})</span>
                    </div>
                  </div>
                )}

                {/* Lista de leads sem resposta */}
                {semRespostaLeads.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">LEADS SEM RETORNO</p>
                      <button
                        onClick={() => {
                          setShowSemRespostaDetail(false);
                          setLeadsModal({ title: 'Leads sem resposta em 24h', leads: semRespostaLeads });
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        Ver todos <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
                      {semRespostaLeads.slice(0, 8).map((lead: any) => (
                        <div key={lead.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground flex-shrink-0">
                            {(lead.nome ?? '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-foreground truncate">{lead.nome ?? 'Lead sem nome'}</div>
                            <div className="text-[10px] text-muted-foreground/60 truncate">{lead.telefone ?? '—'}</div>
                          </div>
                          {lead.atualizado_em && (
                            <div className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                              {format(new Date(lead.atualizado_em), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      ))}
                      {semRespostaLeads.length > 8 && (
                        <div
                          className="px-4 py-3 text-center text-[11px] text-muted-foreground hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => {
                            setShowSemRespostaDetail(false);
                            setLeadsModal({ title: 'Leads sem resposta em 24h', leads: semRespostaLeads });
                          }}
                        >
                          + {semRespostaLeads.length - 8} leads a mais · clique para ver todos
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <AlertTriangle className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa sem resposta</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Todos os leads receberam retorno dentro de 24h</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Modal: Distribuição do Tempo de Resposta por Horário ── */}
      {(() => {
        const tr = metrics?.tempoResposta;
        if (!tr) return null;
        const h = tr.humano;
        const horaData = h?.primeiraRespostaPorHora ?? [];
        const periodos = h?.periodos ?? [];
        const horasComDados = horaData.filter((d: any) => d.count > 0);

        // Encontrar melhor e pior hora
        const horasOrdenadas = [...horasComDados].sort((a: any, b: any) => a.avg - b.avg);
        const melhoresHoras = horasOrdenadas.slice(0, 3);
        const pioresHoras = horasOrdenadas.slice(-3).reverse();

        // Cor da barra baseada no tempo médio
        const barColor = (avg: number) => {
          if (avg <= 5) return '#22c55e';
          if (avg <= 15) return '#f59e0b';
          if (avg <= 60) return '#f97316';
          return '#ef4444';
        };

        const periodoLabel = (id: string) => {
          const icons: Record<string, string> = { madrugada: '00h–05h', manha: '06h–11h', tarde: '12h–17h', noite: '18h–23h' };
          return icons[id] ?? '';
        };

        return (
          <Dialog open={showTempoRespostaDetail} onOpenChange={setShowTempoRespostaDetail}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
              <DialogHeader className="px-6 py-5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div>
                    <DialogTitle className="text-[15px] font-bold text-foreground font-display">
                      Distribuição por Horário
                    </DialogTitle>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      Tempo médio de primeira resposta humana por hora do dia · {horasComDados.length} horas com dados
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-6">

                {/* Períodos do dia */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">RESUMO POR PERÍODO</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {periodos.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => p.count > 0 && setLeadsModal({ title: `Leads · ${p.label} (${periodoLabel(p.id)})`, leads: p.leads })}
                        className={`rounded-xl border border-border/60 bg-card p-4 transition-colors ${p.count > 0 ? 'cursor-pointer hover:bg-muted/30 hover:border-border' : ''}`}
                      >
                        <div className="text-[13px] font-semibold text-foreground mb-0.5">{p.label}</div>
                        <div className="text-[10px] text-muted-foreground/50 mb-3">{periodoLabel(p.id)}</div>
                        {p.count > 0 ? (
                          <>
                            <div className="text-[22px] font-bold font-display leading-none" style={{ color: barColor(p.avg) }}>
                              {fmtMinutes(p.avg)}
                            </div>
                            <div className="text-[10px] text-muted-foreground/60 mt-1">{p.count} amostra{p.count !== 1 ? 's' : ''}</div>
                          </>
                        ) : (
                          <div className="text-[13px] text-muted-foreground/40 font-medium">sem dados</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gráfico por hora */}
                {horasComDados.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">TEMPO MÉDIO POR HORA</p>
                    <div className="rounded-xl border border-border/60 bg-card p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={horaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', opacity: 0.6 }}
                            axisLine={false}
                            tickLine={false}
                            interval={1}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', opacity: 0.6 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => v > 0 ? fmtMinutes(v) : ''}
                          />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              if (d.count === 0) return null;
                              return (
                                <div className="rounded-lg border border-border/60 bg-card shadow-md p-3 text-[12px]">
                                  <div className="font-semibold text-foreground mb-1">{d.label}</div>
                                  <div className="text-muted-foreground">Média: <span className="font-bold text-foreground">{fmtMinutes(d.avg)}</span></div>
                                  <div className="text-muted-foreground">{d.count} amostra{d.count !== 1 ? 's' : ''}</div>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="avg"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                            style={{ cursor: 'pointer' }}
                            onClick={(data: any) => {
                              if (data?.count > 0) {
                                setLeadsModal({ title: `Leads · ${data.label}`, leads: data.leads });
                              }
                            }}
                          >
                            {horaData.map((entry: any, index: number) => (
                              <Cell
                                key={index}
                                fill={entry.count > 0 ? barColor(entry.avg) : 'transparent'}
                                fillOpacity={entry.count > 0 ? 0.85 : 0}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex items-center gap-4 mt-2 justify-center flex-wrap">
                        {[
                          { label: '≤ 5min', color: '#22c55e' },
                          { label: '5–15min', color: '#f59e0b' },
                          { label: '15–60min', color: '#f97316' },
                          { label: '> 1h', color: '#ef4444' },
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Melhores e piores horas */}
                {horasComDados.length >= 2 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">MELHORES HORÁRIOS</p>
                      <div className="space-y-2">
                        {melhoresHoras.map((d: any, i: number) => (
                          <div
                            key={d.hora}
                            onClick={() => setLeadsModal({ title: `Leads · ${d.label}`, leads: d.leads })}
                            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 cursor-pointer hover:bg-muted/30 hover:border-border transition-colors"
                          >
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-[12px] font-semibold text-foreground">{d.label}</div>
                              <div className="text-[10px] text-muted-foreground/60">{d.count} amostra{d.count !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="text-[14px] font-bold font-display" style={{ color: '#22c55e' }}>{fmtMinutes(d.avg)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">HORÁRIOS MAIS LENTOS</p>
                      <div className="space-y-2">
                        {pioresHoras.map((d: any, i: number) => (
                          <div
                            key={d.hora}
                            onClick={() => setLeadsModal({ title: `Leads · ${d.label}`, leads: d.leads })}
                            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 cursor-pointer hover:bg-muted/30 hover:border-border transition-colors"
                          >
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-[12px] font-semibold text-foreground">{d.label}</div>
                              <div className="text-[10px] text-muted-foreground/60">{d.count} amostra{d.count !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="text-[14px] font-bold font-display" style={{ color: barColor(d.avg) }}>{fmtMinutes(d.avg)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabela completa */}
                {horasComDados.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">DETALHAMENTO COMPLETO</p>
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <div className="grid grid-cols-3 px-4 py-2 bg-muted/30 border-b border-border/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hora</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Amostras</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Tempo médio</span>
                      </div>
                      <div className="divide-y divide-border/40">
                        {horasComDados
                          .sort((a: any, b: any) => a.hora - b.hora)
                          .map((d: any) => (
                            <div
                              key={d.hora}
                              onClick={() => setLeadsModal({ title: `Leads · ${d.label}`, leads: d.leads })}
                              className="grid grid-cols-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                            >
                              <span className="text-[12px] font-medium text-foreground">{d.label}</span>
                              <span className="text-[12px] text-muted-foreground text-center">{d.count}</span>
                              <span className="text-[12px] font-semibold text-right font-display" style={{ color: barColor(d.avg) }}>
                                {fmtMinutes(d.avg)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {horasComDados.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <BarChart3 className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum dado disponível</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Dados aparecem conforme os atendimentos ocorrem no período selecionado</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
