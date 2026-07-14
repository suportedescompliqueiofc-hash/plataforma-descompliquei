import { useState, Fragment, useMemo } from "react";
import {
  DollarSign, Users, Target, MousePointerClick, Eye, TrendingUp,
  RefreshCw, ChevronDown, ChevronUp, Loader2, Image, MessageCircle, FileText,
  AlertTriangle, AlertCircle, Zap, Info, Trophy, Medal, Award, ArrowUpRight,
  Clock, Filter, LayoutDashboard, Layers, BarChart3,
  Megaphone, Settings, Pause, Play, ArrowRight, CheckCircle, CalendarCheck, Handshake, Key,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/PageHero";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip as ShadTooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, format as fnsFormat } from "date-fns";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell,
  LineChart, Line, BarChart, Bar,
} from "recharts";
import { toast } from "sonner";
import { useMetaAds, AlertItem } from "@/hooks/useMetaAds";
import { CriativoScoreCard, CriativoScoreBadge } from "@/components/marketing/CriativoScoreCard";
import { ConfiguracaoScore } from "@/components/marketing/ConfiguracaoScore";
import { useMarketingScore } from "@/hooks/useMarketingScore";
import { useProfile } from "@/hooks/useProfile";
import { DESCOMPLIQUEI_ORG_ID } from "@/lib/constants";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/hooks/useDashboard";
import { StatCard, StatCardGrid } from "@/components/StatCard";
import { formatBRL, formatInt, formatPct, formatNum } from "@/lib/format";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}
function formatPercent(value: number) {
  return value.toFixed(2) + "%";
}
function formatDateBR(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
function formatCompact(value: number) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return value.toFixed(0);
}
function displayValue(value: number | undefined | null, formatter: (v: number) => string = formatCurrency): string {
  if (value === undefined || value === null || value === 0) return "—";
  return formatter(value);
}
function displayPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || value === 0) return "—";
  return value.toFixed(1) + "%";
}

const DONUT_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1",
];

const FUNNEL_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#22c55e"];

/** Monta a prop `delta` do StatCard a partir de uma variação percentual já calculada. */
function variationDelta(value: number | null | undefined, invert = false): { label: string; positive?: boolean } | undefined {
  if (value === null || value === undefined) return undefined;
  const positive = invert ? value < 0 : value > 0;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return { label: `${sign}${formatPct(Math.abs(value), 0)}`, positive };
}

function AlertIcon({ type }: { type: AlertItem["type"] }) {
  switch (type) {
    case "critical": return <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    case "highlight": return <Zap className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
    case "info": return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  }
}

function alertBg(type: AlertItem["type"]) {
  switch (type) {
    case "critical": return "bg-red-500/10 border-red-500/20";
    case "warning": return "bg-amber-500/10 border-amber-500/20";
    case "highlight": return "bg-emerald-500/10 border-emerald-500/20";
    case "info": return "bg-blue-500/10 border-blue-500/20";
  }
}

function RankingBadge({ position }: { position: number }) {
  if (position === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
  if (position === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (position === 3) return <Award className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{position}</span>;
}

function QualityBadge({ ranking }: { ranking: string | null }) {
  if (!ranking || ranking === "UNKNOWN") return null;
  const map: Record<string, { label: string; className: string }> = {
    ABOVE_AVERAGE: { label: "Acima da media", className: "bg-emerald-500/15 text-emerald-600 border-0" },
    AVERAGE: { label: "Na media", className: "bg-blue-500/15 text-blue-600 border-0" },
    BELOW_AVERAGE_10: { label: "Abaixo 10%", className: "bg-red-500/15 text-red-600 border-0" },
    BELOW_AVERAGE_20: { label: "Abaixo 20%", className: "bg-red-500/15 text-red-600 border-0" },
    BELOW_AVERAGE_35: { label: "Abaixo 35%", className: "bg-amber-500/15 text-amber-600 border-0" },
  };
  const info = map[ranking];
  if (!info) return null;
  return <Badge variant="outline" className={`text-[10px] px-1.5 ${info.className}`}>{info.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border-0 gap-1">
        <Play className="h-3 w-3" /> Ativo
      </Badge>
    );
  }
  if (status === "PAUSED") {
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 gap-1">
        <Pause className="h-3 w-3" /> Pausado
      </Badge>
    );
  }
  return <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">{status}</Badge>;
}

function CampaignTypeBadge({ tipo }: { tipo: string }) {
  if (tipo === "whatsapp") {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 gap-1">
        <MessageCircle className="h-3 w-3" /> WhatsApp
      </Badge>
    );
  }
  if (tipo === "formulario") {
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1">
        <FileText className="h-3 w-3" /> Formulario
      </Badge>
    );
  }
  return <Badge variant="outline" className="bg-muted text-muted-foreground border-0">Outro</Badge>;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <ShadTooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs">
          {text}
        </TooltipContent>
      </ShadTooltip>
    </TooltipProvider>
  );
}

interface CriativoPerf {
  criativo_uuid: string;
  meta_ad_id: string;
  criativo_nome: string;
  criativo_status: string;
  url_thumbnail: string | null;
  campanha_nome: string | null;
  organization_id: string;
  total_gasto: number;
  total_impressoes: number;
  total_cliques: number;
  ctr_medio: number;
  leads_crm_total: number;
  leads_qualificados: number;
  leads_agendados: number;
  leads_fechados: number;
  scoring_a: number;
  scoring_b: number;
  scoring_c: number;
  scoring_d: number;
  receita_gerada: number;
  cpl_real: number;
  cpa_real: number;
  cpv_real: number;
  roas_real: number;
  taxa_qualificacao: number;
  taxa_agendamento: number;
  taxa_fechamento: number;
}

interface Eficiencia {
  organization_id: string;
  total_investido: number;
  total_leads: number;
  leads_marketing: number;
  qualificados: number;
  agendados: number;
  fechados: number;
  receita_marketing: number;
  cpl_real: number;
  cpa_real: number;
  cpv_real: number;
  roas_real: number;
  taxa_qualificacao: number;
  taxa_agendamento: number;
  taxa_fechamento: number;
}

export default function MarketingTrafego() {
  const { profile, isLoading: isProfileLoading } = useProfile();
  const orgId = profile?.organization_id;
  const isDescompliqueiOrg = orgId === DESCOMPLIQUEI_ORG_ID;
  const { calcularScore, refetch: refetchScore } = useMarketingScore();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  });
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());
  const [adFilter, setAdFilter] = useState<string>("all");
  const [adSort, setAdSort] = useState<"cpl" | "investido" | "leads" | "ctr">("investido");
  const [showInactiveAds, setShowInactiveAds] = useState(false);
  const [scoreConfigOpen, setScoreConfigOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<"all" | "ACTIVE" | "PAUSED">("all");
  const [activeTab, setActiveTab] = useState("dashboard");

  const toggleAdset = (adsetId: string) => {
    setExpandedAdsets(prev => {
      const next = new Set(prev);
      if (next.has(adsetId)) next.delete(adsetId);
      else next.add(adsetId);
      return next;
    });
  };

  const {
    summary, campaignRows, adsetRows, adRows, dailyData, alerts,
    spendByCampaign, integration, isLoading, syncMutation,
  } = useMetaAds(dateRange);

  const { metrics: dashboardMetrics } = useDashboard(dateRange, 'geral');

  const eficiencia = useMemo((): Eficiencia | null => {
    if (!dashboardMetrics) return null;
    const f = dashboardMetrics.descompliqueiFunnel ?? { leads: 0, mql: 0, scheduled: 0, closed: 0, txMql: 0, txAgendamento: 0, txConversao: 0 };
    const aq = dashboardMetrics.acquisitionEfficiency ?? { investment: 0, cpl: null, cpm: null, cpa: null, cpf: null };
    const inv = aq.investment || 0;
    return {
      organization_id: orgId || '',
      total_investido: inv,
      total_leads: f.leads,
      leads_marketing: f.leads,
      qualificados: f.mql,
      agendados: f.scheduled,
      fechados: f.closed,
      receita_marketing: dashboardMetrics.faturamentoTotal || 0,
      cpl_real: aq.cpl || 0,
      cpa_real: aq.cpa || 0,
      cpv_real: aq.cpf || 0,
      roas_real: inv > 0 ? (dashboardMetrics.faturamentoTotal || 0) / inv : 0,
      taxa_qualificacao: f.txMql,
      taxa_agendamento: f.txAgendamento,
      taxa_fechamento: f.txConversao,
    };
  }, [dashboardMetrics, orgId]);

  const { data: criativosPerf } = useQuery({
    queryKey: ['criativo-performance', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('vw_criativo_performance' as any) as any)
        .select('*')
        .eq('organization_id', orgId);
      if (error) throw error;
      return (data || []) as CriativoPerf[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const dataInicio = dateRange?.from ? fnsFormat(dateRange.from, 'yyyy-MM-dd') : null;
  const dataFim = dateRange?.to ? fnsFormat(dateRange.to, 'yyyy-MM-dd') : null;

  const { data: leadsCrmDiario } = useQuery({
    queryKey: ['leads-crm-por-dia', orgId, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('criado_em')
        .eq('organization_id', orgId!)
        .eq('origem', 'marketing')
        .gte('criado_em', dataInicio!)
        .lte('criado_em', dataFim! + 'T23:59:59');
      if (error) throw error;
      const countByDay: Record<string, number> = {};
      (data || []).forEach((l: any) => {
        if (l.criado_em) {
          const day = l.criado_em.substring(0, 10);
          countByDay[day] = (countByDay[day] || 0) + 1;
        }
      });
      return countByDay;
    },
    enabled: !!orgId && !!dataInicio && !!dataFim,
    staleTime: 5 * 60 * 1000,
  });

  const criativoPerfMap = useMemo(() => {
    const map = new Map<string, CriativoPerf>();
    (criativosPerf || []).forEach(cp => map.set(cp.meta_ad_id, cp));
    return map;
  }, [criativosPerf]);

  const sortedAds = useMemo(() => {
    let filtered = adFilter === "all" ? adRows : adRows.filter(a => a.meta_campaign_id === adFilter);
    if (!showInactiveAds) filtered = filtered.filter(a => a.status === "ACTIVE");
    return [...filtered].sort((a, b) => {
      if (adSort === "cpl") return (a.cpl || Infinity) - (b.cpl || Infinity);
      return b[adSort] - a[adSort];
    });
  }, [adRows, adFilter, adSort, showInactiveAds]);

  const topCreatives = useMemo(() => {
    return [...adRows]
      .filter(a => a.leads > 0 && a.investido > 0)
      .sort((a, b) => a.cpl - b.cpl)
      .slice(0, 3);
  }, [adRows]);

  const filteredCampaigns = useMemo(() => {
    if (campaignStatusFilter === "all") return campaignRows;
    return campaignRows.filter(c => c.status === campaignStatusFilter);
  }, [campaignRows, campaignStatusFilter]);

  const activeCampaigns = useMemo(() => campaignRows.filter(c => c.status === "ACTIVE"), [campaignRows]);
  const inactiveCampaigns = useMemo(() => campaignRows.filter(c => c.status !== "ACTIVE"), [campaignRows]);

  const dailyDataWithCrm = useMemo(() => {
    if (!dailyData.length) return [];
    return dailyData.map(d => ({
      ...d,
      leadsCrm: leadsCrmDiario?.[d.data] || 0,
    }));
  }, [dailyData, leadsCrmDiario]);

  const cplPerCampaignDaily = useMemo(() => {
    if (!dailyData.length || !campaignRows.length) return [];
    return dailyData.map(d => {
      const point: Record<string, any> = { data: d.data };
      point.cpl_geral = d.cpl;
      return point;
    });
  }, [dailyData, campaignRows]);

  const gastoVsLeads = useMemo(() => {
    return campaignRows
      .filter(c => c.investido > 0)
      .map(c => ({
        nome: c.nome.length > 20 ? c.nome.substring(0, 20) + "…" : c.nome,
        investido: c.investido,
        leads: c.leads,
        cpl: c.cpl,
      }));
  }, [campaignRows]);

  const cumulativeData = useMemo(() => {
    let accInvestido = 0;
    let accLeads = 0;
    return dailyData.map(d => {
      accInvestido += d.investido;
      accLeads += d.leads;
      return {
        data: d.data,
        investidoAcum: accInvestido,
        leadsAcum: accLeads,
        cplAcum: accLeads > 0 ? accInvestido / accLeads : 0,
      };
    });
  }, [dailyData]);

  const weekdayData = useMemo(() => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    const map = new Map<number, { investido: number; leads: number; count: number }>();
    dailyData.forEach(d => {
      const date = new Date(d.data + "T12:00:00");
      const dow = date.getDay();
      const existing = map.get(dow) || { investido: 0, leads: 0, count: 0 };
      existing.investido += d.investido;
      existing.leads += d.leads;
      existing.count += 1;
      map.set(dow, existing);
    });
    return days.map((name, idx) => {
      const data = map.get(idx) || { investido: 0, leads: 0, count: 0 };
      return {
        dia: name,
        leadsMedia: data.count > 0 ? data.leads / data.count : 0,
        cplMedia: data.leads > 0 ? data.investido / data.leads : 0,
        gastoMedia: data.count > 0 ? data.investido / data.count : 0,
      };
    });
  }, [dailyData]);

  const qualidadePorCriativo = useMemo(() => {
    return (criativosPerf || [])
      .filter(cp => cp.leads_crm_total > 0)
      .sort((a, b) => (b.scoring_a + b.scoring_b) - (a.scoring_a + a.scoring_b))
      .slice(0, 10)
      .map(cp => ({
        nome: cp.criativo_nome.length > 25 ? cp.criativo_nome.substring(0, 25) + "…" : cp.criativo_nome,
        A: cp.scoring_a,
        B: cp.scoring_b,
        C: cp.scoring_c,
        D: cp.scoring_d,
        sem: cp.leads_crm_total - cp.scoring_a - cp.scoring_b - cp.scoring_c - cp.scoring_d,
      }));
  }, [criativosPerf]);

  if (isProfileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isDescompliqueiOrg) {
    return <Navigate to="/crm" replace />;
  }

  const hasData = summary.totalImpressoes > 0 || summary.totalInvestido > 0 || campaignRows.length > 0;

  const handleSaveToken = async () => {
    if (!newToken.trim() || !orgId) return;
    setSavingToken(true);
    try {
      const { data: existing } = await supabase
        .from('integracoes')
        .select('id, credenciais')
        .eq('organization_id', orgId)
        .eq('tipo', 'meta_ads')
        .maybeSingle();

      if (!existing) throw new Error('Integração Meta Ads não encontrada. Configure primeiro.');

      const updatedCreds = { ...(existing.credenciais as any), access_token: newToken.trim() };
      const { error } = await supabase
        .from('integracoes')
        .update({ credenciais: updatedCreds } as any)
        .eq('id', existing.id);
      if (error) throw error;

      toast.success('Token atualizado com sucesso!');
      setTokenDialogOpen(false);
      setNewToken('');
    } catch (err: any) {
      toast.error('Erro ao atualizar token: ' + (err?.message || 'Tente novamente'));
    } finally {
      setSavingToken(false);
    }
  };

  const handleSync = () => {
    toast.info("Sincronizando dados do Meta Ads...");
    syncMutation.mutate(undefined, {
      onSuccess: (data) => {
        const s = data?.synced;
        toast.success(
          `Sincronizado! ${s?.campaigns || 0} campanhas, ${s?.ads || 0} anuncios, ${s?.insights || 0} metricas.` +
          (data?.elapsed_ms ? ` (${(data.elapsed_ms / 1000).toFixed(1)}s)` : "")
        );
      },
      onError: (err: any) => {
        toast.error("Falha na sincronizacao", { description: err?.message || "Erro desconhecido" });
      },
    });
  };

  const lastSync = integration?.ultima_sincronizacao
    ? new Date(integration.ultima_sincronizacao).toLocaleString("pt-BR")
    : "Nunca";

  const ef = eficiencia;

  const funnelSteps = [
    { label: "Leads", value: ef?.leads_marketing || 0, icon: Users, color: FUNNEL_COLORS[0] },
    { label: "Qualificados", value: ef?.qualificados || 0, icon: CheckCircle, color: FUNNEL_COLORS[1] },
    { label: "Agendados", value: ef?.agendados || 0, icon: CalendarCheck, color: FUNNEL_COLORS[2] },
    { label: "Fechados", value: ef?.fechados || 0, icon: Handshake, color: FUNNEL_COLORS[3] },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* === HEADER === */}
      <PageHero
        icon={Megaphone}
        title="Inteligência de Marketing"
        subtitle="Acompanhe performance de campanhas e criativos do Meta Ads em tempo real."
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <DateRangePicker date={dateRange} setDate={setDateRange} className="[&>button]:h-9 [&>button]:text-xs [&>button]:rounded-lg [&>button]:bg-white/10 [&>button]:hover:bg-white/15 [&>button]:border-white/15 [&>button]:text-white" />
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sincronizar
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white"
              onClick={() => setScoreConfigOpen(true)}
              title="Configurar Score"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white"
              onClick={() => setTokenDialogOpen(true)}
              title="Atualizar Token Meta"
            >
              <Key className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        Última sincronização: {lastSync}
        {summary.totalInvestido > 0 && (
          <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
            Meta API: dados com ~24h de atraso
          </span>
        )}
      </p>

      <ConfiguracaoScore isOpen={scoreConfigOpen} onClose={() => { setScoreConfigOpen(false); refetchScore(); }} />

      {/* Dialog para atualizar token Meta */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Atualizar Token Meta Ads</DialogTitle>
            <DialogDescription>
              Cole o novo token do Graph API Explorer. Tokens de usuário expiram a cada ~60 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="meta-token">Access Token</Label>
            <Input
              id="meta-token"
              placeholder="EAAVSH0jI4m8BR..."
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Obtenha em{" "}
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Graph API Explorer
              </a>
              {" "}com permissões: ads_read, ads_management, business_management
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveToken} disabled={!newToken.trim() || savingToken}>
              {savingToken ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !hasData && !syncMutation.isPending ? (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden py-10 text-center">
          <RefreshCw className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Clique em <strong>"Sincronizar"</strong> para carregar os dados do Meta Ads.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeTab === "dashboard" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("criativos")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeTab === "criativos" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Layers className="h-3.5 w-3.5" /> Criativos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("campanhas")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeTab === "campanhas" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Megaphone className="h-3.5 w-3.5" /> Campanhas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("analise")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeTab === "analise" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Análise
            </button>
          </div>

          {/* ══════════ TAB 1: DASHBOARD ══════════ */}
          {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* BLOCO A — Meta Ads */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meta Ads</span>
              </div>
              <StatCardGrid cols={4} className="lg:grid-cols-7">
                {[
                  { title: "Investido", value: formatBRL(summary.totalInvestido), icon: DollarSign, variation: summary.variacao.investido },
                  { title: "Impressões", value: formatInt(summary.totalImpressoes), icon: Eye, variation: summary.variacao.impressoes },
                  { title: "Cliques", value: formatInt(summary.totalCliques), icon: TrendingUp, variation: summary.variacao.cliques },
                  { title: "Leads Meta", value: formatInt(summary.totalLeads), icon: Users, variation: summary.variacao.leads },
                  { title: "CTR Médio", value: formatPct(summary.ctrMedio, 2), icon: MousePointerClick, variation: summary.variacao.ctr },
                  { title: "CPM", value: summary.totalImpressoes > 0 ? formatBRL((summary.totalInvestido / summary.totalImpressoes) * 1000) : "—", icon: Eye, variation: null },
                  { title: "CPL Meta", value: formatBRL(summary.cplMedio), icon: Target, variation: summary.variacao.cpl, invert: true },
                ].map((card) => (
                  <StatCard
                    key={card.title}
                    label={card.title}
                    value={card.value}
                    icon={card.icon}
                    delta={variationDelta(card.variation, card.invert)}
                  />
                ))}
              </StatCardGrid>
            </div>

            {/* BLOCO B — Resultados Reais CRM */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Resultados Reais (CRM)</span>
              </div>
              <StatCardGrid cols={3} className="lg:grid-cols-6">
                {[
                  { title: "Leads CRM", value: displayValue(ef?.leads_marketing, formatInt), icon: Users },
                  { title: "Qualificados", value: displayValue(ef?.qualificados, formatInt), icon: CheckCircle },
                  { title: "Agendados", value: displayValue(ef?.agendados, formatInt), icon: CalendarCheck },
                  { title: "Fechados", value: displayValue(ef?.fechados, formatInt), icon: Handshake },
                  { title: "CPL Real", value: displayValue(ef?.cpl_real, formatBRL), icon: Target },
                  { title: "ROAS Real", value: displayValue(ef?.roas_real, (v) => `${formatNum(v, 2)}x`), icon: TrendingUp, sublabel: "vendas reais do CRM" },
                ].map((card) => (
                  <StatCard
                    key={card.title}
                    label={card.title}
                    value={card.value}
                    icon={card.icon}
                    sublabel={card.sublabel}
                  />
                ))}
              </StatCardGrid>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {alerts.map((alert, idx) => (
                  <div key={idx} className={`flex items-start gap-2.5 p-3 rounded-xl border ${alertBg(alert.type)}`}>
                    <AlertIcon type={alert.type} />
                    <p className="text-sm leading-snug">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Funil de Conversão */}
            {ef && (ef.leads_marketing || 0) > 0 && (
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Funil de Conversão (Marketing)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    {funnelSteps.map((step, idx) => {
                      const maxVal = funnelSteps[0].value || 1;
                      const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
                      const convRate = idx > 0 && funnelSteps[idx - 1].value > 0
                        ? ((step.value / funnelSteps[idx - 1].value) * 100).toFixed(0) + "%"
                        : null;
                      return (
                        <Fragment key={step.label}>
                          {idx > 0 && (
                            <div className="flex flex-col items-center flex-shrink-0">
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[10px] font-medium text-muted-foreground">{convRate || "—"}</span>
                            </div>
                          )}
                          <div className="flex-1 text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                              <step.icon className="h-4 w-4" style={{ color: step.color }} />
                              <span className="text-xs font-medium">{step.label}</span>
                            </div>
                            <p className="text-2xl font-bold font-display tabular-nums" style={{ color: step.color }}>{step.value}</p>
                            <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: step.color }} />
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                    <span>CPL Real: <strong className="text-foreground">{displayValue(ef?.cpl_real)}</strong></span>
                    <span>CPMQL: <strong className="text-foreground">{displayValue(ef?.qualificados && ef.qualificados > 0 ? ef.total_investido / ef.qualificados : null)}</strong>
                      <InfoTooltip text="Custo por Qualificado — investimento / qualificados" />
                    </span>
                    <span>CPR Real: <strong className="text-foreground">{displayValue(ef?.cpa_real)}</strong>
                      <InfoTooltip text="Custo por Reunião — investimento / agendamentos" />
                    </span>
                    <span>CPA Real: <strong className="text-foreground">{displayValue(ef?.cpv_real)}</strong>
                      <InfoTooltip text="Custo por Aquisição — investimento / fechamentos" />
                    </span>
                    <span className="ml-auto text-[10px] italic">Baseado em leads com rastreamento ativo</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Investimento & Leads por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyDataWithCrm.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados no periodo.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={dailyDataWithCrm}>
                        <defs>
                          <linearGradient id="gradInvest" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="data" tickFormatter={formatDateBR} tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                          labelFormatter={formatDateBR}
                          formatter={(value: number, name: string) => {
                            if (name === "investido") return [formatCurrency(value), "Investido"];
                            if (name === "leads") return [formatNumber(value), "Leads Meta (estimativa)"];
                            if (name === "leadsCrm") return [formatNumber(value), "Leads CRM (real)"];
                            return [formatCurrency(value), "CPL"];
                          }}
                        />
                        <Legend formatter={(v) => v === "investido" ? "Investido" : v === "leads" ? "Leads Meta (estimativa)" : "Leads CRM (real)"} />
                        <Area yAxisId="left" type="monotone" dataKey="investido" stroke="#10b981" fill="url(#gradInvest)" strokeWidth={2} />
                        <Area yAxisId="right" type="monotone" dataKey="leads" stroke="#3b82f6" fill="url(#gradLeads)" strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="leadsCrm" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Gasto por Campanha</CardTitle>
                </CardHeader>
                <CardContent>
                  {spendByCampaign.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados.</p>
                  ) : (
                    <div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={spendByCampaign} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                            {spendByCampaign.map((_, idx) => (
                              <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                            formatter={(value: number) => [formatCurrency(value), "Gasto"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-2">
                        {spendByCampaign.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                            <span className="truncate flex-1 text-muted-foreground">{item.name}</span>
                            <span className="font-medium">{formatCurrency(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top 3 Criativos */}
            {topCreatives.length > 0 && (
              <Card className="rounded-xl">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Top 3 Criativos</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setActiveTab("criativos")}>
                    Ver todos <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {topCreatives.map((ad, idx) => (
                      <div key={ad.meta_ad_id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                        <RankingBadge position={idx + 1} />
                        {ad.url_thumbnail ? (
                          <img src={ad.url_thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Image className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ad.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{ad.campanha_nome}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className="text-emerald-600 font-semibold">{formatCurrency(ad.cpl)} CPL</span>
                            <span className="text-muted-foreground">{ad.leads} leads</span>
                          </div>
                        </div>
                        <CriativoScoreCard
                          scoreOutput={calcularScore({ cpl: ad.cpl, ctr: ad.ctr, leads: ad.leads, diasAtivos: ad.diasAtivos, gasto: ad.investido })}
                          ctr={ad.ctr} cpl={ad.cpl} leads={ad.leads} diasAtivos={ad.diasAtivos}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          )}

          {/* ══════════ TAB 2: CRIATIVOS ══════════ */}
          {activeTab === "criativos" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Select value={adFilter} onValueChange={setAdFilter}>
                <SelectTrigger className="h-9 w-[200px] text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Filtrar campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas campanhas</SelectItem>
                  {campaignRows.map((c) => (
                    <SelectItem key={c.meta_campaign_id} value={c.meta_campaign_id}>
                      {c.nome.length > 30 ? c.nome.substring(0, 30) + "…" : c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={adSort} onValueChange={(v) => setAdSort(v as any)}>
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investido">Maior gasto</SelectItem>
                  <SelectItem value="leads">Mais leads</SelectItem>
                  <SelectItem value="cpl">Menor CPL</SelectItem>
                  <SelectItem value="ctr">Maior CTR</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={showInactiveAds ? "secondary" : "outline"}
                size="sm"
                className="h-9 text-xs gap-1.5"
                onClick={() => setShowInactiveAds(!showInactiveAds)}
              >
                <Eye className="h-3.5 w-3.5" />
                {showInactiveAds ? "Ocultar inativos" : "Mostrar inativos"}
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {sortedAds.length} anuncio{sortedAds.length !== 1 ? "s" : ""}
              </span>
            </div>

            {sortedAds.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum anuncio encontrado.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {sortedAds.slice(0, 10).map((ad, idx) => {
                    const cp = criativoPerfMap.get(ad.meta_ad_id);
                    return (
                      <div key={ad.meta_ad_id} className="flex flex-col rounded-xl border bg-card hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-3 p-4">
                          <div className="flex flex-col items-center gap-1 w-8">
                            <RankingBadge position={idx + 1} />
                          </div>
                          {ad.url_thumbnail ? (
                            <img src={ad.url_thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Image className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium truncate">{ad.nome}</p>
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0">...{ad.meta_ad_id?.slice(-6)}</span>
                              <StatusBadge status={ad.status} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate mb-2">{ad.campanha_nome}</p>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div><span className="text-muted-foreground">CPL</span><p className={`font-semibold ${ad.cpl > 0 && ad.cpl < summary.cplMedio * 0.7 ? "text-emerald-600" : ad.cpl > summary.cplMedio * 1.3 ? "text-red-500" : ""}`}>{ad.leads > 0 ? formatCurrency(ad.cpl) : "—"}</p></div>
                              <div><span className="text-muted-foreground">CTR</span><p className="font-semibold">{formatPercent(ad.ctr)}</p></div>
                              <div><span className="text-muted-foreground">Leads</span><p className="font-semibold">{ad.leads}</p></div>
                              <div><span className="text-muted-foreground">Gasto</span><p className="font-semibold">{formatCurrency(ad.investido)}</p></div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${Math.min(ad.ctr / 3 * 100, 100)}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{formatPercent(ad.ctr)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <CriativoScoreCard
                              scoreOutput={calcularScore({ cpl: ad.cpl, ctr: ad.ctr, leads: ad.leads, diasAtivos: ad.diasAtivos, gasto: ad.investido })}
                              ctr={ad.ctr} cpl={ad.cpl} leads={ad.leads} diasAtivos={ad.diasAtivos}
                            />
                            <QualityBadge ranking={ad.quality_ranking} />
                          </div>
                        </div>
                        {/* CRM Performance section */}
                        <div className="border-t px-4 py-3 bg-blue-500/[0.02]">
                          {cp && cp.leads_crm_total > 0 ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Target className="h-3 w-3 text-blue-500" />
                                <span className="text-[11px] font-semibold text-blue-600">Performance Real (CRM)</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Leads: <strong className="text-foreground">{cp.leads_crm_total}</strong></span>
                                <span>Qualif: <strong className="text-foreground">{cp.leads_qualificados}</strong></span>
                                <span>Agend: <strong className="text-foreground">{cp.leads_agendados}</strong></span>
                                <span>Fechados: <strong className="text-foreground">{cp.leads_fechados}</strong></span>
                              </div>
                              {(cp.scoring_a + cp.scoring_b + cp.scoring_c + cp.scoring_d) > 0 && (
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span>Scoring:</span>
                                  {cp.scoring_a > 0 && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1 h-4">A:{cp.scoring_a}</Badge>}
                                  {cp.scoring_b > 0 && <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] px-1 h-4">B:{cp.scoring_b}</Badge>}
                                  {cp.scoring_c > 0 && <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] px-1 h-4">C:{cp.scoring_c}</Badge>}
                                  {cp.scoring_d > 0 && <Badge className="bg-red-100 text-red-700 border-0 text-[10px] px-1 h-4">D:{cp.scoring_d}</Badge>}
                                </div>
                              )}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>CPL Real: <strong className="text-foreground">{displayValue(cp.cpl_real)}</strong></span>
                                <span>ROAS: <strong className="text-foreground">{displayValue(cp.roas_real, (v) => v.toFixed(2) + "x")}</strong></span>
                              </div>
                              {cp.leads_crm_total > 0 && (
                                <div className="flex items-center gap-1 h-2">
                                  <div className="h-full rounded-l bg-emerald-500" style={{ width: `${(cp.leads_qualificados / cp.leads_crm_total) * 100}%` }} />
                                  <div className="h-full bg-blue-500" style={{ width: `${(cp.leads_agendados / cp.leads_crm_total) * 100}%` }} />
                                  <div className="h-full rounded-r bg-green-600" style={{ width: `${(cp.leads_fechados / cp.leads_crm_total) * 100}%` }} />
                                  <div className="h-full rounded-r bg-muted flex-1" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Target className="h-3 w-3" />
                              <span>Performance Real (CRM): aguardando leads rastreados</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {sortedAds.length > 10 && (
                  <Card className="rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Todos os Anuncios ({sortedAds.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-6 w-[50px]"></TableHead>
                            <TableHead>Anuncio</TableHead>
                            <TableHead>Campanha</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Gasto</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                            <TableHead className="text-right">CPL</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                            <TableHead className="text-right">Leads CRM</TableHead>
                            <TableHead className="text-right">Qualif.</TableHead>
                            <TableHead className="text-right">CPL Real</TableHead>
                            <TableHead className="text-right">ROAS</TableHead>
                            <TableHead className="text-right pr-6">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedAds.slice(10).map((ad) => {
                            const cp = criativoPerfMap.get(ad.meta_ad_id);
                            return (
                              <TableRow key={ad.meta_ad_id}>
                                <TableCell className="pl-6">
                                  {ad.url_thumbnail ? (
                                    <img src={ad.url_thumbnail} alt="" className="w-9 h-9 rounded object-cover" />
                                  ) : (
                                    <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                                      <Image className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium max-w-[220px]">
                                  <div className="truncate">{ad.nome}</div>
                                  <span className="text-[10px] text-muted-foreground font-mono">ID: ...{ad.meta_ad_id?.slice(-6)}</span>
                                </TableCell>
                                <TableCell className="text-muted-foreground max-w-[150px] truncate">{ad.campanha_nome}</TableCell>
                                <TableCell><StatusBadge status={ad.status} /></TableCell>
                                <TableCell className="text-right">{formatCurrency(ad.investido)}</TableCell>
                                <TableCell className="text-right">{ad.leads}</TableCell>
                                <TableCell className="text-right">
                                  <span className={ad.cpl > 0 && ad.cpl < summary.cplMedio * 0.7 ? "text-emerald-600 font-medium" : ad.cpl > summary.cplMedio * 1.3 ? "text-red-500" : ""}>
                                    {ad.leads > 0 ? formatCurrency(ad.cpl) : "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">{formatPercent(ad.ctr)}</TableCell>
                                <TableCell className="text-right">{cp && cp.leads_crm_total > 0 ? cp.leads_crm_total : "—"}</TableCell>
                                <TableCell className="text-right">{cp && cp.leads_qualificados > 0 ? cp.leads_qualificados : "—"}</TableCell>
                                <TableCell className="text-right">{cp ? displayValue(cp.cpl_real) : "—"}</TableCell>
                                <TableCell className="text-right">{cp ? displayValue(cp.roas_real, (v) => v.toFixed(2) + "x") : "—"}</TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end">
                                    <CriativoScoreBadge scoreOutput={calcularScore({ cpl: ad.cpl, ctr: ad.ctr, leads: ad.leads, diasAtivos: ad.diasAtivos, gasto: ad.investido })} />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
          )}

          {/* ══════════ TAB 3: CAMPANHAS ══════════ */}
          {activeTab === "campanhas" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant={campaignStatusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCampaignStatusFilter("all")} className="text-xs">
                Todas ({campaignRows.length})
              </Button>
              <Button variant={campaignStatusFilter === "ACTIVE" ? "default" : "outline"} size="sm" onClick={() => setCampaignStatusFilter("ACTIVE")} className="text-xs">
                <Play className="h-3 w-3 mr-1" /> Ativas ({activeCampaigns.length})
              </Button>
              <Button variant={campaignStatusFilter === "PAUSED" ? "default" : "outline"} size="sm" onClick={() => setCampaignStatusFilter("PAUSED")} className="text-xs">
                <Pause className="h-3 w-3 mr-1" /> Pausadas ({inactiveCampaigns.length})
              </Button>
            </div>

            {filteredCampaigns.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-xl">
                <CardContent className="px-0 py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Campanha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Investido</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">CPL</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((c) => {
                        const isExpanded = expandedCampaign === c.meta_campaign_id;
                        const campaignAdsets = adsetRows.filter((as_) => as_.meta_campaign_id === c.meta_campaign_id);
                        const campaignAds = adRows.filter((a) => a.meta_campaign_id === c.meta_campaign_id);
                        return (
                          <Fragment key={c.meta_campaign_id}>
                            <TableRow className="group cursor-pointer hover:bg-muted/30" onClick={() => setExpandedCampaign(isExpanded ? null : c.meta_campaign_id)}>
                              <TableCell className="pl-6 font-medium max-w-[200px] truncate">{c.nome}</TableCell>
                              <TableCell><CampaignTypeBadge tipo={c.tipo} /></TableCell>
                              <TableCell><StatusBadge status={c.status} /></TableCell>
                              <TableCell className="text-right">{formatCurrency(c.investido)}</TableCell>
                              <TableCell className="text-right">{c.leads}</TableCell>
                              <TableCell className="text-right">{formatCurrency(c.cpl)}</TableCell>
                              <TableCell className="text-right">{formatPercent(c.ctr)}</TableCell>
                              <TableCell className="text-right pr-6">
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={8} className="p-0">
                                  {campaignAdsets.length > 0 ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-muted/40">
                                          <TableHead className="pl-10 w-8"></TableHead>
                                          <TableHead className="text-xs">Conjunto de Anuncio</TableHead>
                                          <TableHead className="text-xs">Status</TableHead>
                                          <TableHead className="text-xs">Orcamento</TableHead>
                                          <TableHead className="text-xs text-right">Gasto</TableHead>
                                          <TableHead className="text-xs text-right">Leads</TableHead>
                                          <TableHead className="text-xs text-right">CPL</TableHead>
                                          <TableHead className="text-xs text-right pr-6">CTR</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {campaignAdsets.map((adset) => {
                                          const adsetAds = campaignAds.filter((a) => a.meta_adset_id === adset.meta_adset_id);
                                          const isAdsetOpen = expandedAdsets.has(adset.meta_adset_id);
                                          return (
                                            <Fragment key={adset.meta_adset_id}>
                                              <TableRow className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => toggleAdset(adset.meta_adset_id)}>
                                                <TableCell className="pl-10 w-8">
                                                  {isAdsetOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                                </TableCell>
                                                <TableCell>
                                                  <div>
                                                    <p className="text-sm font-medium truncate max-w-[200px]">{adset.nome}</p>
                                                    <span className="text-[10px] text-muted-foreground">{adsetAds.length} anuncio{adsetAds.length !== 1 ? "s" : ""}</span>
                                                  </div>
                                                </TableCell>
                                                <TableCell><StatusBadge status={adset.status} /></TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                  {adset.budget_diario ? `${formatCurrency(adset.budget_diario)}/dia` : adset.budget_total ? `${formatCurrency(adset.budget_total)} total` : "—"}
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(adset.investido)}</TableCell>
                                                <TableCell className="text-right">{adset.leads}</TableCell>
                                                <TableCell className="text-right">{adset.cpl > 0 ? formatCurrency(adset.cpl) : "—"}</TableCell>
                                                <TableCell className="text-right pr-6">{formatPercent(adset.ctr)}</TableCell>
                                              </TableRow>
                                              {isAdsetOpen && adsetAds.length > 0 && (
                                                <TableRow>
                                                  <TableCell colSpan={8} className="bg-muted/10 px-10 py-2">
                                                    <div className="space-y-1.5">
                                                      {adsetAds.map((ad) => (
                                                        <div key={ad.meta_ad_id} className="flex items-center gap-3 rounded-lg p-2 bg-background border hover:shadow-sm transition-shadow">
                                                          {ad.url_thumbnail ? (
                                                            <img src={ad.url_thumbnail} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                                                          ) : (
                                                            <div className="w-9 h-9 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                                              <Image className="h-3.5 w-3.5 text-muted-foreground" />
                                                            </div>
                                                          )}
                                                          <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{ad.nome}</p>
                                                          </div>
                                                          <StatusBadge status={ad.status} />
                                                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                                            <span>{formatCurrency(ad.investido)}</span>
                                                            <span>{ad.leads} leads</span>
                                                            <span>CPL {ad.leads > 0 ? formatCurrency(ad.cpl) : "—"}</span>
                                                            <span>CTR {formatPercent(ad.ctr)}</span>
                                                          </div>
                                                          <CriativoScoreBadge scoreOutput={calcularScore({ cpl: ad.cpl, ctr: ad.ctr, leads: ad.leads, diasAtivos: ad.diasAtivos, gasto: ad.investido })} />
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </TableCell>
                                                </TableRow>
                                              )}
                                              {isAdsetOpen && adsetAds.length === 0 && (
                                                <TableRow>
                                                  <TableCell colSpan={8} className="bg-muted/10 text-center text-xs text-muted-foreground py-3">
                                                    Nenhum anuncio neste conjunto.
                                                  </TableCell>
                                                </TableRow>
                                              )}
                                            </Fragment>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum conjunto encontrado.</p>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
          )}

          {/* ══════════ TAB 4: ANALISE ══════════ */}
          {activeTab === "analise" && (
          <div className="space-y-6">
            {/* Resumo de Eficiencia */}
            {ef && (
              <Card className="rounded-xl border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Eficiencia do Marketing — Periodo selecionado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Investido:</span> <strong>{displayValue(ef.total_investido)}</strong></div>
                    <div><span className="text-muted-foreground">Leads:</span> <strong>{displayValue(ef.leads_marketing, formatNumber)}</strong></div>
                    <div><span className="text-muted-foreground">Qualificados:</span> <strong>{displayValue(ef.qualificados, formatNumber)}</strong></div>
                    <div><span className="text-muted-foreground">Agendados:</span> <strong>{displayValue(ef.agendados, formatNumber)}</strong></div>
                    <div><span className="text-muted-foreground">Fechados:</span> <strong>{displayValue(ef.fechados, formatNumber)}</strong></div>
                    <div><span className="text-muted-foreground">Receita:</span> <strong>{displayValue(ef.receita_marketing)}</strong></div>
                    <div><span className="text-muted-foreground">CPL Real:</span> <strong>{displayValue(ef.cpl_real)}</strong></div>
                    <div><span className="text-muted-foreground">CPMQL:</span> <strong>{displayValue(ef.qualificados > 0 ? ef.total_investido / ef.qualificados : null)}</strong></div>
                    <div><span className="text-muted-foreground">CPR:</span> <strong>{displayValue(ef.cpa_real)}</strong></div>
                    <div><span className="text-muted-foreground">CPA:</span> <strong>{displayValue(ef.cpv_real)}</strong><InfoTooltip text="Custo por Aquisição — investimento / fechamentos" /></div>
                    <div><span className="text-muted-foreground">ROAS:</span> <strong>{displayValue(ef.roas_real, (v) => v.toFixed(2) + "x")}</strong><InfoTooltip text="Baseado em vendas registradas no CRM vinculadas a leads de marketing" /></div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground border-t mt-3 pt-3">
                    <span>Taxa Qualif: <strong className="text-foreground">{displayPercent(ef.taxa_qualificacao)}</strong></span>
                    <span>Taxa Agend: <strong className="text-foreground">{displayPercent(ef.taxa_agendamento)}</strong></span>
                    <span>Taxa Fecha: <strong className="text-foreground">{displayPercent(ef.taxa_fechamento)}</strong></span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* CPL Evolution */}
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Evolucao do CPL</CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados no periodo.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="data" tickFormatter={formatDateBR} tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                          labelFormatter={formatDateBR}
                          formatter={(value: number) => [formatCurrency(value), "CPL"]}
                        />
                        <Line type="monotone" dataKey="cpl" stroke="#f97316" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Gasto vs Leads per Campaign */}
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Gasto vs Leads por Campanha</CardTitle>
                </CardHeader>
                <CardContent>
                  {gastoVsLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={gastoVsLeads} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                          formatter={(value: number, name: string) => {
                            if (name === "investido") return [formatCurrency(value), "Gasto"];
                            return [value, "Leads"];
                          }}
                        />
                        <Legend formatter={(v) => v === "investido" ? "Gasto" : "Leads"} />
                        <Bar dataKey="investido" fill="#10b981" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="leads" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Cumulative Trend */}
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tendencia Acumulada</CardTitle>
                </CardHeader>
                <CardContent>
                  {cumulativeData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={cumulativeData}>
                        <defs>
                          <linearGradient id="gradAcumInvest" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradAcumLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="data" tickFormatter={formatDateBR} tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${formatCompact(v)}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                          labelFormatter={formatDateBR}
                          formatter={(value: number, name: string) => {
                            if (name === "investidoAcum") return [formatCurrency(value), "Investido Acum."];
                            if (name === "leadsAcum") return [value, "Leads Acum."];
                            return [formatCurrency(value), "CPL Acum."];
                          }}
                        />
                        <Legend formatter={(v) => v === "investidoAcum" ? "Investido Acum." : v === "leadsAcum" ? "Leads Acum." : "CPL Acum."} />
                        <Area yAxisId="left" type="monotone" dataKey="investidoAcum" stroke="#10b981" fill="url(#gradAcumInvest)" strokeWidth={2} />
                        <Area yAxisId="right" type="monotone" dataKey="leadsAcum" stroke="#3b82f6" fill="url(#gradAcumLeads)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Weekday Performance */}
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Performance por Dia da Semana</CardTitle>
                </CardHeader>
                <CardContent>
                  {weekdayData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={weekdayData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                          formatter={(value: number, name: string) => {
                            if (name === "leadsMedia") return [value.toFixed(1), "Leads/dia"];
                            if (name === "cplMedia") return [formatCurrency(value), "CPL medio"];
                            return [formatCurrency(value), "Gasto medio"];
                          }}
                        />
                        <Legend formatter={(v) => v === "leadsMedia" ? "Leads/dia" : v === "cplMedia" ? "CPL medio" : "Gasto/dia"} />
                        <Bar yAxisId="left" dataKey="leadsMedia" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="cplMedia" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Qualidade de Leads por Criativo */}
            {qualidadePorCriativo.length > 0 && (
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Qualidade de Leads por Criativo</CardTitle>
                    <span className="text-[10px] text-muted-foreground">Criativos com rastreamento ativo: {qualidadePorCriativo.length}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(qualidadePorCriativo.length * 40, 200)}>
                    <BarChart data={qualidadePorCriativo} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 10 }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      />
                      <Legend />
                      <Bar dataKey="A" stackId="score" fill="#22c55e" name="A" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="B" stackId="score" fill="#3b82f6" name="B" />
                      <Bar dataKey="C" stackId="score" fill="#f59e0b" name="C" />
                      <Bar dataKey="D" stackId="score" fill="#ef4444" name="D" />
                      <Bar dataKey="sem" stackId="score" fill="#d1d5db" name="Sem scoring" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
