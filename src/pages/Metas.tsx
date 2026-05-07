import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target, TrendingUp, TrendingDown, Calendar, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, Plus, Edit2, Loader2, ArrowRight, BarChart3,
  DollarSign, Users, CalendarCheck, Award, Zap, SlidersHorizontal, History, LineChart
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  LineChart as ReLineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend
} from "recharts";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

// ── Types ──────────────────────────────────────────────────────

interface Meta {
  id: string;
  organization_id: string;
  nome: string;
  periodo_tipo: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  meta_receita: number;
  ticket_medio: number;
  tx_mql: number;
  tx_agendamento: number;
  tx_conversao: number;
  cpl_meta: number;
  meta_fechamentos: number;
  meta_reunioes: number;
  meta_mqls: number;
  meta_leads: number;
  meta_bucket: number;
  criado_em: string;
  // View fields
  leads_total?: number;
  mqls_total?: number;
  reunioes_total?: number;
  fechamentos_total?: number;
  receita_total?: number;
  bucket_total?: number;
  leads_hoje?: number;
  mqls_hoje?: number;
  leads_semana?: number;
  mqls_semana?: number;
  dias_restantes?: number;
  dias_decorridos?: number;
  total_dias?: number;
  pct_receita?: number;
  pct_leads?: number;
  pct_mqls?: number;
  pct_reunioes?: number;
  pct_fechamentos?: number;
  meta_leads_dia?: number;
  meta_mqls_dia?: number;
  meta_reunioes_dia?: number;
  meta_receita_dia?: number;
  meta_leads_semana?: number;
  meta_mqls_semana?: number;
  meta_reunioes_semana?: number;
  meta_receita_semana?: number;
  receita_necessaria_por_dia?: number;
  leads_necessarios_por_dia?: number;
}

// ── Helpers ────────────────────────────────────────────────────

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "R$ 0";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtBRL2(v: number | null | undefined): string {
  if (v == null) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return "0";
  return Math.round(v).toLocaleString("pt-BR");
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "0%";
  return `${Number(v).toFixed(1)}%`;
}

function pctColor(pct: number): string {
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function pctBadgeClass(pct: number): string {
  if (pct >= 80) return "bg-green-100 text-green-700 border-green-200";
  if (pct >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function statusIcon(pct: number) {
  if (pct >= 100) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (pct >= 80) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (pct >= 50) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function borderLeftColor(metrics: { pct: number }[]): string {
  const avg = metrics.reduce((s, m) => s + m.pct, 0) / metrics.length;
  if (avg >= 80) return "border-l-green-500";
  if (avg >= 50) return "border-l-yellow-500";
  return "border-l-red-500";
}

// ── Section Header (Dashboard pattern) ─────────────────────────

const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-2 mb-4 pl-3 border-l-[3px] border-primary">
    <Icon className="h-4 w-4 text-primary flex-shrink-0" />
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
  </div>
);

// ── Custom Tooltip ─────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg">
        <p className="font-semibold text-foreground mb-1 text-sm">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-muted-foreground">{entry.name}:</span>
            <span className="text-xs font-bold text-foreground">{
              typeof entry.value === "number" && entry.name?.includes("R$")
                ? fmtBRL(entry.value) : fmtNum(entry.value)
            }</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ── Main Component ─────────────────────────────────────────────

export default function Metas() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [modalMeta, setModalMeta] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [expandedHistorico, setExpandedHistorico] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────

  const { data: meta, isLoading } = useQuery({
    queryKey: ["meta-ativa", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_meta_acompanhamento")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("ativo", true)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return (data as Meta) || null;
    },
    enabled: !!orgId,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: todasMetas = [] } = useQuery({
    queryKey: ["todas-metas", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_meta_acompanhamento")
        .select("*")
        .eq("organization_id", orgId!)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data as Meta[]) || [];
    },
    enabled: !!orgId,
  });

  // ── Form state ─────────────────────────────────────────

  const [formNome, setFormNome] = useState("");
  const [formPeriodo, setFormPeriodo] = useState("mensal");
  const [formInicio, setFormInicio] = useState("");
  const [formFim, setFormFim] = useState("");
  const [formReceita, setFormReceita] = useState(50000);
  const [formTicket, setFormTicket] = useState(5000);
  const [formCpl, setFormCpl] = useState(40);
  const [formTxMql, setFormTxMql] = useState(60);
  const [formTxAgend, setFormTxAgend] = useState(40);
  const [formTxConv, setFormTxConv] = useState(25);
  const [formLoading, setFormLoading] = useState(false);

  // Calculated preview
  const previewFechamentos = formTicket > 0 ? formReceita / formTicket : 0;
  const previewReunioes = formTxConv > 0 ? previewFechamentos / (formTxConv / 100) : 0;
  const previewMqls = formTxAgend > 0 ? previewReunioes / (formTxAgend / 100) : 0;
  const previewLeads = formTxMql > 0 ? previewMqls / (formTxMql / 100) : 0;
  const previewBucket = previewLeads * formCpl;

  // ── Simulador (aba Projeção) ───────────────────────────

  const [simLeadsDia, setSimLeadsDia] = useState(0);
  const [simTxMql, setSimTxMql] = useState(60);
  const [simTxAgend, setSimTxAgend] = useState(40);
  const [simTxConv, setSimTxConv] = useState(25);
  const [simTicket, setSimTicket] = useState(5000);

  // Initialize simulator from meta
  const initSimulator = () => {
    if (!meta) return;
    const diasDecorridos = Number(meta.dias_decorridos) || 1;
    const mediaLeadsDia = Math.round(((Number(meta.leads_total) || 0) / diasDecorridos) * 10) / 10;
    setSimLeadsDia(mediaLeadsDia || 3);
    setSimTxMql(Number(meta.tx_mql) || 60);
    setSimTxAgend(Number(meta.tx_agendamento) || 40);
    setSimTxConv(Number(meta.tx_conversao) || 25);
    setSimTicket(Number(meta.ticket_medio) || 5000);
  };

  // ── Mutations ──────────────────────────────────────────

  const salvarMeta = useMutation({
    mutationFn: async () => {
      const payload = {
        organization_id: orgId!,
        nome: formNome,
        periodo_tipo: formPeriodo,
        data_inicio: formInicio,
        data_fim: formFim,
        meta_receita: formReceita,
        ticket_medio: formTicket,
        cpl_meta: formCpl,
        tx_mql: formTxMql,
        tx_agendamento: formTxAgend,
        tx_conversao: formTxConv,
      };
      if (editingMeta) {
        const { error } = await supabase.from("metas").update(payload).eq("id", editingMeta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("metas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ativa", orgId] });
      queryClient.invalidateQueries({ queryKey: ["todas-metas", orgId] });
      toast.success(editingMeta ? "Meta atualizada!" : "Meta criada!");
      setModalMeta(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Form helpers ───────────────────────────────────────

  function openCriar() {
    setEditingMeta(null);
    const now = new Date();
    const ini = startOfMonth(now);
    const fim = endOfMonth(now);
    setFormNome(`Meta ${fmtBRL(50000)} — ${format(now, "MMMM yyyy", { locale: ptBR })}`);
    setFormPeriodo("mensal");
    setFormInicio(format(ini, "yyyy-MM-dd"));
    setFormFim(format(fim, "yyyy-MM-dd"));
    setFormReceita(50000);
    setFormTicket(5000);
    setFormCpl(40);
    setFormTxMql(60);
    setFormTxAgend(40);
    setFormTxConv(25);
    setModalMeta(true);
  }

  function openEditar() {
    if (!meta) return;
    setEditingMeta(meta);
    setFormNome(meta.nome);
    setFormPeriodo(meta.periodo_tipo);
    setFormInicio(meta.data_inicio);
    setFormFim(meta.data_fim);
    setFormReceita(Number(meta.meta_receita));
    setFormTicket(Number(meta.ticket_medio));
    setFormCpl(Number(meta.cpl_meta));
    setFormTxMql(Number(meta.tx_mql));
    setFormTxAgend(Number(meta.tx_agendamento));
    setFormTxConv(Number(meta.tx_conversao));
    setModalMeta(true);
  }

  function handlePeriodoChange(v: string) {
    setFormPeriodo(v);
    const now = new Date();
    if (v === "mensal") {
      setFormInicio(format(startOfMonth(now), "yyyy-MM-dd"));
      setFormFim(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (v === "semanal") {
      setFormInicio(format(startOfWeek(now, { locale: ptBR }), "yyyy-MM-dd"));
      setFormFim(format(endOfWeek(now, { locale: ptBR }), "yyyy-MM-dd"));
    }
  }

  async function handleSalvar() {
    if (!formNome || !formInicio || !formFim || formReceita <= 0) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setFormLoading(true);
    await salvarMeta.mutateAsync();
    setFormLoading(false);
  }

  // ── Pace chart data ────────────────────────────────────

  const paceData = useMemo(() => {
    if (!meta) return [];
    const totalDias = Number(meta.total_dias) || 30;
    const diasDecorridos = Number(meta.dias_decorridos) || 0;
    const metaLeads = Number(meta.meta_leads) || 0;
    const leadsTotal = Number(meta.leads_total) || 0;
    const points = [];
    for (let i = 0; i <= Math.min(diasDecorridos, totalDias); i++) {
      const metaAcum = Math.round((metaLeads / totalDias) * i * 10) / 10;
      const realAcum = i === diasDecorridos ? leadsTotal : Math.round((leadsTotal / Math.max(diasDecorridos, 1)) * i);
      points.push({
        dia: `Dia ${i}`,
        "Meta Linear": metaAcum,
        "Leads Reais": realAcum,
      });
    }
    // Add remaining days as meta only
    for (let i = diasDecorridos + 1; i <= totalDias; i++) {
      points.push({
        dia: `Dia ${i}`,
        "Meta Linear": Math.round((metaLeads / totalDias) * i * 10) / 10,
        "Leads Reais": null,
      });
    }
    return points;
  }, [meta]);

  // ── Projeção calculations ──────────────────────────────

  const projecao = useMemo(() => {
    if (!meta) return null;
    const diasRestantes = Math.max(Number(meta.dias_restantes) || 0, 0);
    const leadsAtuais = Number(meta.leads_total) || 0;
    const mqls = Number(meta.mqls_total) || 0;
    const reunioes = Number(meta.reunioes_total) || 0;
    const fechamentos = Number(meta.fechamentos_total) || 0;
    const diasDecorridos = Math.max(Number(meta.dias_decorridos) || 1, 1);

    const mediaLeadsDia = leadsAtuais / diasDecorridos;
    const txMqlReal = leadsAtuais > 0 ? (mqls / leadsAtuais) * 100 : 0;
    const txAgendReal = mqls > 0 ? (reunioes / mqls) * 100 : 0;
    const txConvReal = reunioes > 0 ? (fechamentos / reunioes) * 100 : 0;

    const leadsProj = leadsAtuais + mediaLeadsDia * diasRestantes;
    const mqlsProj = leadsProj * (txMqlReal / 100);
    const reunioesProj = mqlsProj * (txAgendReal / 100);
    const fechamentosProj = reunioesProj * (txConvReal / 100);
    const receitaProj = fechamentosProj * Number(meta.ticket_medio);

    return {
      mediaLeadsDia: Math.round(mediaLeadsDia * 10) / 10,
      txMqlReal: Math.round(txMqlReal * 10) / 10,
      txAgendReal: Math.round(txAgendReal * 10) / 10,
      txConvReal: Math.round(txConvReal * 10) / 10,
      leadsProj: Math.round(leadsProj),
      mqlsProj: Math.round(mqlsProj),
      reunioesProj: Math.round(reunioesProj),
      fechamentosProj: Math.round(fechamentosProj),
      receitaProj: Math.round(receitaProj),
    };
  }, [meta]);

  // Simulação
  const simulacao = useMemo(() => {
    if (!meta) return null;
    const diasRestantes = Math.max(Number(meta.dias_restantes) || 0, 0);
    const leadsAtuais = Number(meta.leads_total) || 0;
    const leadsProj = leadsAtuais + simLeadsDia * diasRestantes;
    const mqlsProj = leadsProj * (simTxMql / 100);
    const reunioesProj = mqlsProj * (simTxAgend / 100);
    const fechamentosProj = reunioesProj * (simTxConv / 100);
    const receitaProj = fechamentosProj * simTicket;
    return {
      leads: Math.round(leadsProj),
      mqls: Math.round(mqlsProj),
      reunioes: Math.round(reunioesProj),
      fechamentos: Math.round(fechamentosProj),
      receita: Math.round(receitaProj),
    };
  }, [meta, simLeadsDia, simTxMql, simTxAgend, simTxConv, simTicket]);

  // ── Loading ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64" />
          <div className="flex gap-2"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-40" /></div>
        </div>
        <Skeleton className="h-10 w-72 rounded-lg" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  // ── No meta state ──────────────────────────────────────

  if (!meta) {
    return (
      <div className="space-y-8 max-w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Metas</h1>
            <p className="text-sm text-muted-foreground mt-1">Defina metas e acompanhe o progresso do funil</p>
          </div>
          <Button size="sm" className="gap-1.5 text-xs shadow-sm" onClick={openCriar}>
            <Plus className="h-3.5 w-3.5" /> Nova Meta
          </Button>
        </div>
        <Card className="rounded-2xl shadow-sm border-border/60">
          <CardContent className="py-16 text-center">
            <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma meta ativa</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie sua primeira meta para começar a acompanhar o funil</p>
            <Button onClick={openCriar} className="gap-1.5">
              <Plus className="h-4 w-4" /> Criar Meta
            </Button>
          </CardContent>
        </Card>

        {/* Modal always available */}
        {renderModal()}
      </div>
    );
  }

  // ── Computed values ────────────────────────────────────

  const m = meta;
  const diasRestantes = Math.max(Number(m.dias_restantes) || 0, 0);
  const diasDecorridos = Math.max(Number(m.dias_decorridos) || 0, 0);
  const totalDias = Number(m.total_dias) || 30;
  const progressoTempo = Math.min(Math.round((diasDecorridos / totalDias) * 100), 100);

  const leadsT = Number(m.leads_total) || 0;
  const mqlsT = Number(m.mqls_total) || 0;
  const reunioesT = Number(m.reunioes_total) || 0;
  const fechamentosT = Number(m.fechamentos_total) || 0;
  const receitaT = Number(m.receita_total) || 0;
  const bucketT = Number(m.bucket_total) || 0;

  const pctLeads = Number(m.pct_leads) || 0;
  const pctMqls = Number(m.pct_mqls) || 0;
  const pctReunioes = Number(m.pct_reunioes) || 0;
  const pctFechamentos = Number(m.pct_fechamentos) || 0;
  const pctReceita = Number(m.pct_receita) || 0;
  const pctBucket = Number(m.meta_bucket) > 0 ? Math.round((bucketT / Number(m.meta_bucket)) * 1000) / 10 : 0;

  // Taxas reais
  const txMqlReal = leadsT > 0 ? Math.round((mqlsT / leadsT) * 1000) / 10 : 0;
  const txAgendReal = mqlsT > 0 ? Math.round((reunioesT / mqlsT) * 1000) / 10 : 0;
  const txConvReal = reunioesT > 0 ? Math.round((fechamentosT / reunioesT) * 1000) / 10 : 0;
  const cplReal = leadsT > 0 ? Math.round((bucketT / leadsT) * 100) / 100 : 0;

  // Day/week metrics
  const leadsHoje = Number(m.leads_hoje) || 0;
  const mqlsHoje = Number(m.mqls_hoje) || 0;
  const leadsSemana = Number(m.leads_semana) || 0;
  const mqlsSemana = Number(m.mqls_semana) || 0;

  const metaLeadsDia = Number(m.meta_leads_dia) || 0;
  const metaMqlsDia = Number(m.meta_mqls_dia) || 0;
  const metaReunDia = Number(m.meta_reunioes_dia) || 0;
  const metaReceitaDia = Number(m.meta_receita_dia) || 0;
  const metaLeadsSem = Number(m.meta_leads_semana) || 0;
  const metaMqlsSem = Number(m.meta_mqls_semana) || 0;
  const metaReunSem = Number(m.meta_reunioes_semana) || 0;
  const metaReceitaSem = Number(m.meta_receita_semana) || 0;

  // ── Funil column component ─────────────────────────────

  function FunnelCol({ label, icon: Icon, meta: metaVal, real, pct, sublabel }: {
    label: string; icon: any; meta: string; real: string; pct: number; sublabel?: string;
  }) {
    return (
      <Card className="overflow-hidden shadow-sm rounded-2xl border-border/60 flex-1">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          </div>
          {sublabel && <span className="text-[10px] text-muted-foreground -mt-2">{sublabel}</span>}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Meta</p>
            <p className="text-lg font-bold text-foreground">{metaVal}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Realizado</p>
            <p className="text-lg font-bold text-foreground">{real}</p>
          </div>
          <div className="mt-auto">
            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border", pctBadgeClass(pct))}>
              {fmtPct(pct)}
            </span>
            <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor(pct) }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Tracking card ──────────────────────────────────────

  function TrackingCard({ title, subtitle, metrics, footer }: {
    title: string; subtitle: string;
    metrics: { label: string; real: number; meta: number; pct: number }[];
    footer?: React.ReactNode;
  }) {
    const borderClass = borderLeftColor(metrics.map(m => ({ pct: m.pct })));
    return (
      <Card className={cn("rounded-2xl shadow-sm border-border/60 border-l-4 overflow-hidden", borderClass)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
              <p className="text-[10px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="space-y-2">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.label === "Receita" ? fmtBRL(m.real) : fmtNum(m.real)}</span>
                  <span className="text-muted-foreground/60">/ {m.label === "Receita" ? fmtBRL(m.meta) : fmtNum(m.meta)}</span>
                  <div className="flex items-center gap-1 min-w-[60px] justify-end">
                    {statusIcon(m.pct)}
                    <span className={cn("text-xs font-semibold", m.pct >= 80 ? "text-green-600" : m.pct >= 50 ? "text-yellow-600" : "text-red-600")}>
                      {fmtPct(m.pct)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {footer && <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">{footer}</div>}
        </CardContent>
      </Card>
    );
  }

  // ── Modal render ───────────────────────────────────────

  function renderModal() {
    return (
      <Dialog open={modalMeta} onOpenChange={(o) => { if (!o) setModalMeta(false); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da meta</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Ex: Meta 50K — Maio 2026" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Período</Label>
                <Select value={formPeriodo} onValueChange={handlePeriodoChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Início</Label>
                <Input type="date" value={formInicio} onChange={(e) => setFormInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={formFim} onChange={(e) => setFormFim(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Meta de Receita (R$)</Label>
                <Input type="number" value={formReceita} onChange={(e) => setFormReceita(Number(e.target.value))} />
              </div>
              <div>
                <Label>Ticket Médio (R$)</Label>
                <Input type="number" value={formTicket} onChange={(e) => setFormTicket(Number(e.target.value))} />
              </div>
              <div>
                <Label>CPL Meta (R$)</Label>
                <Input type="number" value={formCpl} onChange={(e) => setFormCpl(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Taxa MQL</Label>
                  <span className="text-sm font-bold text-primary">{formTxMql}%</span>
                </div>
                <Slider value={[formTxMql]} onValueChange={(v) => setFormTxMql(v[0])} min={1} max={100} step={1} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Taxa Agendamento</Label>
                  <span className="text-sm font-bold text-primary">{formTxAgend}%</span>
                </div>
                <Slider value={[formTxAgend]} onValueChange={(v) => setFormTxAgend(v[0])} min={1} max={100} step={1} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Taxa Conversão</Label>
                  <span className="text-sm font-bold text-primary">{formTxConv}%</span>
                </div>
                <Slider value={[formTxConv]} onValueChange={(v) => setFormTxConv(v[0])} min={1} max={100} step={1} />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-muted/30 rounded-xl p-4 border border-border/60">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Funil Calculado</p>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="font-bold text-foreground">{fmtBRL(previewBucket)}</span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="font-bold text-foreground">{Math.round(previewLeads)} leads</span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="font-bold text-foreground">{Math.round(previewMqls)} MQL</span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="font-bold text-foreground">{Math.round(previewReunioes)} reuniões</span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="font-bold text-green-600">{Math.round(previewFechamentos)} fechamentos</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMeta(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingMeta ? "Salvar" : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── RENDER ─────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{m.nome}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs capitalize">{m.periodo_tipo}</Badge>
            <span className="text-sm text-muted-foreground">
              {format(parseISO(m.data_inicio), "dd/MM", { locale: ptBR })} — {format(parseISO(m.data_fim), "dd/MM/yyyy", { locale: ptBR })}
            </span>
            <Badge variant="secondary" className="text-xs gap-1">
              <Calendar className="h-3 w-3" /> {diasRestantes} dias restantes
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 max-w-xs h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressoTempo}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{progressoTempo}% do período</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openEditar}>
            <Edit2 className="h-3.5 w-3.5" /> Editar Meta
          </Button>
          <Button size="sm" className="gap-1.5 text-xs shadow-sm" onClick={openCriar}>
            <Plus className="h-3.5 w-3.5" /> Nova Meta
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "projecao") initSimulator(); }}>
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5 gap-0.5 self-start w-fit">
          {[
            { value: "visao-geral", label: "Visão Geral", icon: Target },
            { value: "historico", label: "Histórico", icon: History },
            { value: "projecao", label: "Projeção", icon: LineChart },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setActiveTab(value); if (value === "projecao") initSimulator(); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                activeTab === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ═════════ ABA 1 — VISÃO GERAL ═════════ */}
        <TabsContent value="visao-geral" className="mt-6 space-y-8">

          {/* Funil */}
          <div>
            <SectionHeader title="Funil de Metas" icon={Target} />
            <div className="flex gap-3 items-stretch">
              <FunnelCol label="Bucket" icon={DollarSign} sublabel={`CPL: ${fmtBRL2(Number(m.cpl_meta))}`} meta={fmtBRL(Number(m.meta_bucket))} real={fmtBRL(bucketT)} pct={pctBucket} />
              <div className="flex items-center"><ArrowRight className="h-5 w-5 text-primary/40" /></div>
              <FunnelCol label="Leads" icon={Users} meta={fmtNum(Number(m.meta_leads))} real={fmtNum(leadsT)} pct={pctLeads} />
              <div className="flex items-center"><ArrowRight className="h-5 w-5 text-primary/40" /></div>
              <FunnelCol label="MQL" icon={CheckCircle2} sublabel={`Tx: ${fmtPct(Number(m.tx_mql))}`} meta={fmtNum(Number(m.meta_mqls))} real={fmtNum(mqlsT)} pct={pctMqls} />
              <div className="flex items-center"><ArrowRight className="h-5 w-5 text-primary/40" /></div>
              <FunnelCol label="Reuniões" icon={CalendarCheck} sublabel={`Tx: ${fmtPct(Number(m.tx_agendamento))}`} meta={fmtNum(Number(m.meta_reunioes))} real={fmtNum(reunioesT)} pct={pctReunioes} />
              <div className="flex items-center"><ArrowRight className="h-5 w-5 text-primary/40" /></div>
              <FunnelCol label="Fechamentos" icon={Award} sublabel={`Tx: ${fmtPct(Number(m.tx_conversao))}`} meta={fmtNum(Number(m.meta_fechamentos))} real={fmtNum(fechamentosT)} pct={pctFechamentos} />
            </div>
          </div>

          {/* Tracking cards */}
          <div>
            <SectionHeader title="Acompanhamento" icon={Calendar} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TrackingCard
                title="Hoje"
                subtitle={format(new Date(), "EEEE, dd/MM", { locale: ptBR })}
                metrics={[
                  { label: "Leads", real: leadsHoje, meta: metaLeadsDia, pct: metaLeadsDia > 0 ? Math.round((leadsHoje / metaLeadsDia) * 100) : 0 },
                  { label: "MQLs", real: mqlsHoje, meta: metaMqlsDia, pct: metaMqlsDia > 0 ? Math.round((mqlsHoje / metaMqlsDia) * 100) : 0 },
                ]}
                footer={
                  leadsHoje >= metaLeadsDia
                    ? <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-green-500" /> Leads no ritmo!</span>
                    : <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-500" /> Abaixo do ritmo diário</span>
                }
              />
              <TrackingCard
                title="Semana"
                subtitle={`${format(startOfWeek(new Date(), { locale: ptBR }), "dd/MM")} a ${format(endOfWeek(new Date(), { locale: ptBR }), "dd/MM")}`}
                metrics={[
                  { label: "Leads", real: leadsSemana, meta: metaLeadsSem, pct: metaLeadsSem > 0 ? Math.round((leadsSemana / metaLeadsSem) * 100) : 0 },
                  { label: "MQLs", real: mqlsSemana, meta: metaMqlsSem, pct: metaMqlsSem > 0 ? Math.round((mqlsSemana / metaMqlsSem) * 100) : 0 },
                ]}
              />
              <TrackingCard
                title="Mês"
                subtitle={`${format(parseISO(m.data_inicio), "dd/MM")} a ${format(parseISO(m.data_fim), "dd/MM")}`}
                metrics={[
                  { label: "Leads", real: leadsT, meta: Number(m.meta_leads), pct: pctLeads },
                  { label: "MQLs", real: mqlsT, meta: Number(m.meta_mqls), pct: pctMqls },
                  { label: "Reuniões", real: reunioesT, meta: Number(m.meta_reunioes), pct: pctReunioes },
                  { label: "Receita", real: receitaT, meta: Number(m.meta_receita), pct: pctReceita },
                ]}
                footer={
                  <span>Pace: <strong>{fmtBRL(Number(m.receita_necessaria_por_dia))}/dia</strong> · {fmtNum(Number(m.leads_necessarios_por_dia))} leads/dia</span>
                }
              />
            </div>
          </div>

          {/* Pace chart */}
          <div>
            <SectionHeader title="Gráfico de Ritmo" icon={TrendingUp} />
            <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
              <CardContent className="p-5">
                {paceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={paceData}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="dia" fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Line type="monotone" dataKey="Meta Linear" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Leads Reais" stroke="hsl(var(--primary))" fill="url(#colorLeads)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} connectNulls={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                    <BarChart3 className="h-8 w-8 mb-2" />
                    <p className="text-xs">Sem dados suficientes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Taxas reais vs meta */}
          <div>
            <SectionHeader title="Taxas Reais vs Meta" icon={BarChart3} />
            <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Métrica</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Meta</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Real Atual</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {[
                      { label: "Taxa MQL", meta: Number(m.tx_mql), real: txMqlReal, detail: `${mqlsT}/${leadsT}` },
                      { label: "Taxa Agendamento", meta: Number(m.tx_agendamento), real: txAgendReal, detail: `${reunioesT}/${mqlsT}` },
                      { label: "Taxa Conversão", meta: Number(m.tx_conversao), real: txConvReal, detail: `${fechamentosT}/${reunioesT}` },
                      { label: "CPL", meta: Number(m.cpl_meta), real: cplReal, isCurrency: true, invertColor: true },
                      { label: "Ticket Médio", meta: Number(m.ticket_medio), real: fechamentosT > 0 ? receitaT / fechamentosT : 0, isCurrency: true },
                    ].map((row) => {
                      const isGood = row.invertColor
                        ? (row.real <= row.meta || row.real === 0)
                        : (row.real >= row.meta * 0.8);
                      const isCritical = row.invertColor
                        ? (row.real > row.meta * 1.5 && row.real > 0)
                        : (row.real < row.meta * 0.5 && row.real > 0);
                      return (
                        <tr key={row.label} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.label}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {row.isCurrency ? fmtBRL2(row.meta) : `${row.meta}%`}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {row.real === 0 && !row.isCurrency ? "—" : row.isCurrency ? fmtBRL2(row.real) : `${row.real}%`}
                            {row.detail && row.real > 0 && <span className="text-muted-foreground ml-1">({row.detail})</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.real === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : isGood ? (
                              <span className="flex items-center gap-1 justify-end text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Ótimo</span>
                            ) : isCritical ? (
                              <span className="flex items-center gap-1 justify-end text-red-600"><XCircle className="h-3.5 w-3.5" /> Crítico</span>
                            ) : (
                              <span className="flex items-center gap-1 justify-end text-yellow-600"><AlertTriangle className="h-3.5 w-3.5" /> Abaixo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Insight */}
            {projecao && (
              <Card className="rounded-2xl shadow-sm border-border/60 mt-4 overflow-hidden" style={{ borderLeft: "4px solid hsl(var(--primary))" }}>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Projeção com ritmo atual:</p>
                  <p>
                    No ritmo atual ({projecao.mediaLeadsDia} leads/dia), você fechará o mês com ~<strong>{projecao.leadsProj} leads</strong> e ~<strong>{projecao.reunioesProj} reuniões</strong>.
                    {Number(m.leads_necessarios_por_dia) > 0 && (
                      <> Para bater a meta, precisa de <strong>{fmtNum(Number(m.leads_necessarios_por_dia))} leads/dia</strong>.</>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═════════ ABA 2 — HISTÓRICO ═════════ */}
        <TabsContent value="historico" className="mt-6 space-y-6">
          <SectionHeader title="Histórico de Metas" icon={History} />
          <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nome</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Período</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Meta Receita</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Realizado</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">%</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {todasMetas.map((mt) => {
                    const pctR = Number(mt.pct_receita) || 0;
                    const isAtiva = mt.ativo;
                    const isBatida = pctR >= 100;
                    return (
                      <>
                        <tr
                          key={mt.id}
                          className="hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => setExpandedHistorico(expandedHistorico === mt.id ? null : mt.id)}
                        >
                          <td className="px-4 py-3 font-medium">{mt.nome}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {format(parseISO(mt.data_inicio), "dd/MM/yy")} — {format(parseISO(mt.data_fim), "dd/MM/yy")}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{fmtBRL(Number(mt.meta_receita))}</td>
                          <td className="px-4 py-3 text-right">{fmtBRL(Number(mt.receita_total))}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border", pctBadgeClass(pctR))}>
                              {fmtPct(pctR)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isAtiva ? (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Em andamento</Badge>
                            ) : isBatida ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Batida</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Não atingida</Badge>
                            )}
                          </td>
                        </tr>
                        {expandedHistorico === mt.id && (
                          <tr key={`${mt.id}-detail`}>
                            <td colSpan={6} className="px-4 py-4 bg-muted/10">
                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                <span className="text-muted-foreground">Bucket:</span>
                                <span className="font-bold">{fmtBRL(Number(mt.bucket_total))}/{fmtBRL(Number(mt.meta_bucket))}</span>
                                <ArrowRight className="h-3 w-3 text-primary" />
                                <span className="text-muted-foreground">Leads:</span>
                                <span className="font-bold">{fmtNum(Number(mt.leads_total))}/{fmtNum(Number(mt.meta_leads))}</span>
                                <ArrowRight className="h-3 w-3 text-primary" />
                                <span className="text-muted-foreground">MQL:</span>
                                <span className="font-bold">{fmtNum(Number(mt.mqls_total))}/{fmtNum(Number(mt.meta_mqls))}</span>
                                <ArrowRight className="h-3 w-3 text-primary" />
                                <span className="text-muted-foreground">Reuniões:</span>
                                <span className="font-bold">{fmtNum(Number(mt.reunioes_total))}/{fmtNum(Number(mt.meta_reunioes))}</span>
                                <ArrowRight className="h-3 w-3 text-primary" />
                                <span className="text-muted-foreground">Fechamentos:</span>
                                <span className="font-bold">{fmtNum(Number(mt.fechamentos_total))}/{fmtNum(Number(mt.meta_fechamentos))}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {todasMetas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhuma meta encontrada</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═════════ ABA 3 — PROJEÇÃO ═════════ */}
        <TabsContent value="projecao" className="mt-6 space-y-8">

          {/* Projeção automática */}
          <div>
            <SectionHeader title="Projeção do Mês" icon={TrendingUp} />
            {projecao && (
              <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden mb-4" style={{ borderLeft: "4px solid hsl(var(--primary))" }}>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Com base nos últimos {diasDecorridos} dias (média de <strong>{projecao.mediaLeadsDia} leads/dia</strong> e <strong>{projecao.txMqlReal}% de qualificação</strong>):
                </CardContent>
              </Card>
            )}
            <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Métrica</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Meta</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Projeção</th>
                      <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {projecao && [
                      { label: "Leads", meta: Number(m.meta_leads), proj: projecao.leadsProj },
                      { label: "MQLs", meta: Number(m.meta_mqls), proj: projecao.mqlsProj },
                      { label: "Reuniões", meta: Number(m.meta_reunioes), proj: projecao.reunioesProj },
                      { label: "Fechamentos", meta: Number(m.meta_fechamentos), proj: projecao.fechamentosProj },
                      { label: "Receita", meta: Number(m.meta_receita), proj: projecao.receitaProj, isCurrency: true },
                    ].map((row) => {
                      const diff = row.proj - row.meta;
                      const isPos = diff >= 0;
                      return (
                        <tr key={row.label} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.label}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{row.isCurrency ? fmtBRL(row.meta) : fmtNum(row.meta)}</td>
                          <td className="px-4 py-3 text-right font-medium">{row.isCurrency ? fmtBRL(row.proj) : fmtNum(row.proj)}</td>
                          <td className={cn("px-4 py-3 text-right font-semibold", isPos ? "text-green-600" : "text-red-600")}>
                            {isPos ? "+" : ""}{row.isCurrency ? fmtBRL(diff) : fmtNum(diff)} {isPos ? <CheckCircle2 className="inline h-3.5 w-3.5 ml-1" /> : <XCircle className="inline h-3.5 w-3.5 ml-1" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Simulador */}
          <div>
            <SectionHeader title="Simulador Interativo" icon={SlidersHorizontal} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Ajuste os parâmetros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Leads por dia</Label>
                      <span className="text-sm font-bold text-primary">{simLeadsDia}</span>
                    </div>
                    <Slider value={[simLeadsDia]} onValueChange={(v) => setSimLeadsDia(v[0])} min={0} max={50} step={0.5} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Taxa MQL (%)</Label>
                      <span className="text-sm font-bold text-primary">{simTxMql}%</span>
                    </div>
                    <Slider value={[simTxMql]} onValueChange={(v) => setSimTxMql(v[0])} min={1} max={100} step={1} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Taxa Agendamento (%)</Label>
                      <span className="text-sm font-bold text-primary">{simTxAgend}%</span>
                    </div>
                    <Slider value={[simTxAgend]} onValueChange={(v) => setSimTxAgend(v[0])} min={1} max={100} step={1} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Taxa Conversão (%)</Label>
                      <span className="text-sm font-bold text-primary">{simTxConv}%</span>
                    </div>
                    <Slider value={[simTxConv]} onValueChange={(v) => setSimTxConv(v[0])} min={1} max={100} step={1} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Ticket Médio (R$)</Label>
                      <span className="text-sm font-bold text-primary">{fmtBRL(simTicket)}</span>
                    </div>
                    <Slider value={[simTicket]} onValueChange={(v) => setSimTicket(v[0])} min={500} max={50000} step={500} />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Cenário Simulado</CardTitle>
                </CardHeader>
                <CardContent>
                  {simulacao && (
                    <div className="space-y-3">
                      {[
                        { label: "Leads", meta: Number(m.meta_leads), sim: simulacao.leads },
                        { label: "MQLs", meta: Number(m.meta_mqls), sim: simulacao.mqls },
                        { label: "Reuniões", meta: Number(m.meta_reunioes), sim: simulacao.reunioes },
                        { label: "Fechamentos", meta: Number(m.meta_fechamentos), sim: simulacao.fechamentos },
                        { label: "Receita", meta: Number(m.meta_receita), sim: simulacao.receita, isCurrency: true },
                      ].map((row) => {
                        const pct = row.meta > 0 ? Math.round((row.sim / row.meta) * 100) : 0;
                        return (
                          <div key={row.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">{row.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">{row.isCurrency ? fmtBRL(row.sim) : fmtNum(row.sim)}</span>
                                <span className="text-xs text-muted-foreground">/ {row.isCurrency ? fmtBRL(row.meta) : fmtNum(row.meta)}</span>
                                <span className={cn("text-xs font-semibold", pct >= 100 ? "text-green-600" : pct >= 80 ? "text-yellow-600" : "text-red-600")}>
                                  {pct}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor(pct) }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      {renderModal()}
    </div>
  );
}
