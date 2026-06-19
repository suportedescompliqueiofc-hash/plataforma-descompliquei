import { useState, useMemo, Fragment } from "react";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target, TrendingUp, Calendar, AlertTriangle,
  CheckCircle2, XCircle, Plus, Edit2, Loader2, ArrowRight, BarChart3,
  DollarSign, Users, CalendarCheck, Award, Zap, SlidersHorizontal, History, LineChart,
  Clock, Flame, Gauge, ArrowUpRight, ChevronRight, ChevronLeft, ChevronDown, Activity, Trash2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, Line,
} from "recharts";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { CurrencyInput } from "@/components/CurrencyInput";

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
  // Sistema de níveis
  tipo_meta?: string;
  meta_receita_piso?: number;
  meta_receita_super?: number;
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
function pctBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  if (pct >= 50) return "bg-amber-50 text-amber-700 border-amber-200/60";
  return "bg-red-50 text-red-700 border-red-200/60";
}
function statusInfo(pct: number) {
  if (pct >= 80) return { label: "No ritmo", color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 };
  if (pct >= 50) return { label: "Atenção", color: "text-amber-600", bg: "bg-amber-50", icon: AlertTriangle };
  return { label: "Crítico", color: "text-red-600", bg: "bg-red-50", icon: XCircle };
}

// ── Custom Tooltip ─────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border/60 p-3 rounded-xl shadow-lg">
        <p className="font-semibold text-foreground mb-1.5 text-xs">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] text-muted-foreground">{entry.name}:</span>
            <span className="text-[11px] font-bold text-foreground tabular-nums">{fmtNum(entry.value)}</span>
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
  const [deletingMetaId, setDeletingMetaId] = useState<string | null>(null);
  const [selectedMetaId, setSelectedMetaId] = useState<string | null>(null);
  const [isMetaSelectorOpen, setIsMetaSelectorOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────

  const { data: todasMetas = [], isLoading } = useQuery({
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
    refetchInterval: 5 * 60 * 1000,
  });

  // Meta selecionada: prioriza selectedMetaId, senão pega a ativa mais recente
  const meta = useMemo(() => {
    if (todasMetas.length === 0) return null;
    if (selectedMetaId) {
      return todasMetas.find(m => m.id === selectedMetaId) || todasMetas[0];
    }
    // Prioriza a meta ativa mais recente
    const ativa = todasMetas.find(m => m.ativo);
    return ativa || todasMetas[0];
  }, [todasMetas, selectedMetaId]);

  // Index da meta selecionada para navegação prev/next
  const selectedIndex = useMemo(() => {
    if (!meta) return -1;
    return todasMetas.findIndex(m => m.id === meta.id);
  }, [meta, todasMetas]);

  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < todasMetas.length - 1;

  function goToMeta(id: string) {
    setSelectedMetaId(id);
    setActiveTab("visao-geral");
    setIsMetaSelectorOpen(false);
  }

  // ── Form state ─────────────────────────────────────────

  const [formNome, setFormNome] = useState("");
  const [formPeriodo, setFormPeriodo] = useState("mensal");
  const [formInicio, setFormInicio] = useState("");
  const [formTipoMeta, setFormTipoMeta] = useState<'simples' | 'niveis'>('simples');
  const [formReceitaPiso, setFormReceitaPiso] = useState(30000);
  const [formReceitaSuper, setFormReceitaSuper] = useState(80000);
  const [formFim, setFormFim] = useState("");
  const [formReceita, setFormReceita] = useState(50000);
  const [formTicket, setFormTicket] = useState(5000);
  const [formTxMql, setFormTxMql] = useState(60);
  const [formTxAgend, setFormTxAgend] = useState(40);
  const [formTxConv, setFormTxConv] = useState(25);
  const [formLoading, setFormLoading] = useState(false);

  // Preview do funil
  const previewFechamentos = formTicket > 0 ? formReceita / formTicket : 0;
  const previewReunioes = formTxConv > 0 ? previewFechamentos / (formTxConv / 100) : 0;
  const previewMqls = formTxAgend > 0 ? previewReunioes / (formTxAgend / 100) : 0;
  const previewLeads = formTxMql > 0 ? previewMqls / (formTxMql / 100) : 0;

  // ── Simulador ──────────────────────────────────────────

  const [simLeadsDia, setSimLeadsDia] = useState(0);
  const [simTxMql, setSimTxMql] = useState(60);
  const [simTxAgend, setSimTxAgend] = useState(40);
  const [simTxConv, setSimTxConv] = useState(25);
  const [simTicket, setSimTicket] = useState(5000);

  const initSimulator = () => {
    if (!meta) return;
    const diasDecorridos = Number(meta.dias_decorridos) || 1;
    const mediaLeadsDia = Math.round(((Number(meta.leads_total) || 0) / diasDecorridos) * 10) / 10;
    const fe = Number(meta.fechamentos_total) || 0;
    const ticketReal = fe > 0 ? Math.round((Number(meta.receita_total) || 0) / fe) : 5000;
    const la = Number(meta.leads_total) || 0;
    const mq = Number(meta.mqls_total) || 0;
    const re = Number(meta.reunioes_total) || 0;
    setSimLeadsDia(mediaLeadsDia || 3);
    setSimTxMql(la > 0 ? Math.round((mq / la) * 100) : 60);
    setSimTxAgend(mq > 0 ? Math.round((re / mq) * 100) : 40);
    setSimTxConv(re > 0 ? Math.round((fe / re) * 100) : 25);
    setSimTicket(ticketReal);
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
        ticket_medio: 0,
        cpl_meta: 0,
        tx_mql: 0,
        tx_agendamento: 0,
        tx_conversao: 0,
        tipo_meta: formTipoMeta,
        meta_receita_piso: formTipoMeta === 'niveis' ? formReceitaPiso : 0,
        meta_receita_super: formTipoMeta === 'niveis' ? formReceitaSuper : 0,
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
      queryClient.invalidateQueries({ queryKey: ["todas-metas", orgId] });
      toast.success(editingMeta ? "Meta atualizada!" : "Meta criada!");
      // Ao criar nova meta, reseta seleção para pegar a mais recente
      if (!editingMeta) setSelectedMetaId(null);
      setModalMeta(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const excluirMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todas-metas", orgId] });
      toast.success("Meta excluida com sucesso!");
      setSelectedMetaId(null);
      setDeletingMetaId(null);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setDeletingMetaId(null);
    },
  });

  // ── Form helpers ───────────────────────────────────────

  function openCriar() {
    setEditingMeta(null);
    const now = new Date();
    setFormNome(`Meta ${fmtBRL(50000)} — ${format(now, "MMMM yyyy", { locale: ptBR })}`);
    setFormPeriodo("mensal");
    setFormInicio(format(startOfMonth(now), "yyyy-MM-dd"));
    setFormFim(format(endOfMonth(now), "yyyy-MM-dd"));
    setFormReceita(50000); setFormTicket(5000);
    setFormTxMql(60); setFormTxAgend(40); setFormTxConv(25);
    setFormTipoMeta('simples');
    setFormReceitaPiso(30000); setFormReceitaSuper(80000);
    setModalMeta(true);
  }

  function openEditar() {
    if (!meta) return;
    setEditingMeta(meta);
    setFormNome(meta.nome); setFormPeriodo(meta.periodo_tipo);
    setFormInicio(meta.data_inicio); setFormFim(meta.data_fim);
    setFormReceita(Number(meta.meta_receita)); setFormTicket(Number(meta.ticket_medio));
    setFormTxMql(Number(meta.tx_mql));
    setFormTxAgend(Number(meta.tx_agendamento)); setFormTxConv(Number(meta.tx_conversao));
    setFormTipoMeta((meta.tipo_meta as 'simples' | 'niveis') || 'simples');
    setFormReceitaPiso(Number(meta.meta_receita_piso) || 30000);
    setFormReceitaSuper(Number(meta.meta_receita_super) || 80000);
    setModalMeta(true);
  }

  function handlePeriodoChange(v: string) {
    setFormPeriodo(v);
    const now = new Date();
    if (v === "mensal") { setFormInicio(format(startOfMonth(now), "yyyy-MM-dd")); setFormFim(format(endOfMonth(now), "yyyy-MM-dd")); }
    else if (v === "semanal") { setFormInicio(format(startOfWeek(now, { locale: ptBR }), "yyyy-MM-dd")); setFormFim(format(endOfWeek(now, { locale: ptBR }), "yyyy-MM-dd")); }
  }

  async function handleSalvar() {
    if (!formNome || !formInicio || !formFim || formReceita <= 0) { toast.error("Preencha todos os campos."); return; }
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
    const points: any[] = [];
    for (let i = 0; i <= Math.min(diasDecorridos, totalDias); i++) {
      points.push({ dia: `D${i}`, "Meta Linear": Math.round((metaLeads / totalDias) * i * 10) / 10, "Leads Reais": i === diasDecorridos ? leadsTotal : Math.round((leadsTotal / Math.max(diasDecorridos, 1)) * i) });
    }
    for (let i = diasDecorridos + 1; i <= totalDias; i++) {
      points.push({ dia: `D${i}`, "Meta Linear": Math.round((metaLeads / totalDias) * i * 10) / 10, "Leads Reais": null });
    }
    return points;
  }, [meta]);

  // ── Projecao ───────────────────────────────────────────

  const projecao = useMemo(() => {
    if (!meta) return null;
    const dr = Math.max(Number(meta.dias_restantes) || 0, 0);
    const la = Number(meta.leads_total) || 0;
    const mq = Number(meta.mqls_total) || 0;
    const re = Number(meta.reunioes_total) || 0;
    const fe = Number(meta.fechamentos_total) || 0;
    const dd = Math.max(Number(meta.dias_decorridos) || 1, 1);
    const mld = la / dd;
    const txM = la > 0 ? (mq / la) * 100 : 0;
    const txA = mq > 0 ? (re / mq) * 100 : 0;
    const txC = re > 0 ? (fe / re) * 100 : 0;
    const lp = la + mld * dr;
    const mp = lp * (txM / 100);
    const rp = mp * (txA / 100);
    const fp = rp * (txC / 100);
    // Ticket médio real do período (evita depender de meta.ticket_medio que pode ser 0)
    const ticketReal = fe > 0 ? Number(meta.receita_total) / fe : 0;
    return { mediaLeadsDia: Math.round(mld * 10) / 10, txMqlReal: Math.round(txM * 10) / 10, txAgendReal: Math.round(txA * 10) / 10, txConvReal: Math.round(txC * 10) / 10, leadsProj: Math.round(lp), mqlsProj: Math.round(mp), reunioesProj: Math.round(rp), fechamentosProj: Math.round(fp), receitaProj: Math.round(fp * ticketReal), ticketReal: Math.round(ticketReal) };
  }, [meta]);

  const simulacao = useMemo(() => {
    if (!meta) return null;
    const dr = Math.max(Number(meta.dias_restantes) || 0, 0);
    const la = Number(meta.leads_total) || 0;
    const lp = la + simLeadsDia * dr;
    const mp = lp * (simTxMql / 100);
    const rp = mp * (simTxAgend / 100);
    const fp = rp * (simTxConv / 100);
    return { leads: Math.round(lp), mqls: Math.round(mp), reunioes: Math.round(rp), fechamentos: Math.round(fp), receita: Math.round(fp * simTicket) };
  }, [meta, simLeadsDia, simTxMql, simTxAgend, simTxConv, simTicket]);

  // ── Loading ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <div className="flex justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-9 w-32" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  // ── No meta ────────────────────────────────────────────

  if (!meta) {
    return (
      <div className="space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Metas</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Defina metas e acompanhe o progresso do funil</p>
          </div>
          <Button data-tutorial="metas-criar" onClick={openCriar} className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 w-full sm:w-auto">
            <Plus className="h-3.5 w-3.5" /> Nova Meta
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="bg-muted/30 p-5 rounded-2xl mb-4"><Target className="h-10 w-10 text-muted-foreground/30" /></div>
          <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma meta ativa</h3>
          <p className="text-sm text-muted-foreground/60 mb-5">Crie sua primeira meta para acompanhar o funil</p>
          <Button data-tutorial="metas-criar" onClick={openCriar} className="gap-1.5 h-9 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-3.5 w-3.5" /> Criar Meta
          </Button>
        </div>
        {renderModal()}
      </div>
    );
  }

  // ── Computed ────────────────────────────────────────────

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
  const pctLeads = Number(m.pct_leads) || 0;
  const pctMqls = Number(m.pct_mqls) || 0;
  const pctReunioes = Number(m.pct_reunioes) || 0;
  const pctFechamentos = Number(m.pct_fechamentos) || 0;
  const pctReceita = Number(m.pct_receita) || 0;

  // Sistema de níveis
  const tipoMeta = (m.tipo_meta || 'simples') as 'simples' | 'niveis';
  const receitaPiso = Number(m.meta_receita_piso) || 0;
  const receitaAlvo = Number(m.meta_receita) || 0;
  const receitaSuper = Number(m.meta_receita_super) || 0;
  const nivelAtingido: 'none' | 'piso' | 'alvo' | 'super' =
    tipoMeta !== 'niveis' ? 'none'
    : receitaT >= receitaSuper && receitaSuper > 0 ? 'super'
    : receitaT >= receitaAlvo && receitaAlvo > 0 ? 'alvo'
    : receitaT >= receitaPiso && receitaPiso > 0 ? 'piso'
    : 'none';

  const txMqlReal = leadsT > 0 ? Math.round((mqlsT / leadsT) * 1000) / 10 : 0;
  const txAgendReal = mqlsT > 0 ? Math.round((reunioesT / mqlsT) * 1000) / 10 : 0;
  const txConvReal = reunioesT > 0 ? Math.round((fechamentosT / reunioesT) * 1000) / 10 : 0;
  const leadsHoje = Number(m.leads_hoje) || 0;
  const mqlsHoje = Number(m.mqls_hoje) || 0;
  const leadsSemana = Number(m.leads_semana) || 0;
  const mqlsSemana = Number(m.mqls_semana) || 0;
  const metaLeadsDia = Number(m.meta_leads_dia) || 0;
  const metaMqlsDia = Number(m.meta_mqls_dia) || 0;
  const metaLeadsSem = Number(m.meta_leads_semana) || 0;
  const metaMqlsSem = Number(m.meta_mqls_semana) || 0;

  // ── Modal ──────────────────────────────────────────────

  function renderModal() {
    return (
      <Dialog open={modalMeta} onOpenChange={(o) => { if (!o) setModalMeta(false); }}>
        <DialogContent data-tutorial="meta-modal" className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border-border/60 p-0 gap-0">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold">{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
              <p className="text-xs text-muted-foreground/70">Configure sua meta de receita e taxas do funil</p>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 space-y-6">
            {/* ── Identificacao ── */}
            <div data-tutorial="meta-field-nome" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da meta</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Ex: Meta 50K — Maio 2026" className="h-10 text-sm rounded-lg border-border/60" />
            </div>

            {/* ── Periodo ── */}
            <div data-tutorial="meta-field-periodo">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Periodo</p>
              <div className="grid grid-cols-3 gap-3">
                <div data-tutorial="meta-field-tipo" className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Tipo</Label>
                  <Select value={formPeriodo} onValueChange={handlePeriodoChange}>
                    <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60">
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Inicio</Label>
                  <Input type="date" value={formInicio} onChange={(e) => setFormInicio(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Fim</Label>
                  <Input type="date" value={formFim} onChange={(e) => setFormFim(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
                </div>
              </div>
            </div>

            {/* ── Tipo de Meta ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Tipo de Meta</p>
              <div className="flex rounded-xl border border-border/60 bg-muted/30 p-1 gap-0.5 w-fit">
                {([
                  { value: 'simples', label: 'Meta Simples' },
                  { value: 'niveis', label: 'Meta com Níveis' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormTipoMeta(value)}
                    className={cn(
                      "px-4 py-2 text-xs font-medium rounded-lg transition-all",
                      formTipoMeta === value
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {formTipoMeta === 'niveis' && (
                <p className="text-[10px] text-muted-foreground/50 mt-2">
                  <span className="font-semibold text-muted-foreground/70">Piso</span> = mínimo obrigatório · <span className="font-semibold text-muted-foreground/70">Alvo</span> = meta principal · <span className="font-semibold text-muted-foreground/70">Super</span> = máximo esforço
                </p>
              )}
            </div>

            {/* ── Valores ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Valores</p>

              {formTipoMeta === 'simples' ? (
                <div data-tutorial="meta-field-receita" className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Meta Receita</Label>
                  <CurrencyInput
                    value={formReceita}
                    onValueChange={(v) => setFormReceita(v ?? 0)}
                    className="h-10 text-sm rounded-lg border-border/60"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 grid-cols-3">
                    {/* Piso */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-amber-400" />
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Piso</Label>
                      </div>
                      <CurrencyInput
                        value={formReceitaPiso}
                        onValueChange={(v) => setFormReceitaPiso(v ?? 0)}
                        className="h-10 text-sm rounded-lg border-amber-200 bg-amber-50/50 focus-visible:ring-amber-300"
                      />
                    </div>
                    {/* Alvo */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Alvo</Label>
                      </div>
                      <CurrencyInput
                        value={formReceita}
                        onValueChange={(v) => setFormReceita(v ?? 0)}
                        className="h-10 text-sm rounded-lg border-emerald-200 bg-emerald-50/50 focus-visible:ring-emerald-300"
                      />
                    </div>
                    {/* Super */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-violet-500" />
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">Super</Label>
                      </div>
                      <CurrencyInput
                        value={formReceitaSuper}
                        onValueChange={(v) => setFormReceitaSuper(v ?? 0)}
                        className="h-10 text-sm rounded-lg border-violet-200 bg-violet-50/50 focus-visible:ring-violet-300"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="ghost" onClick={() => setModalMeta(false)} className="h-9 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground px-4">Cancelar</Button>
            <Button data-tutorial="meta-submit" onClick={handleSalvar} disabled={formLoading} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
              {formLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingMeta ? "Salvar Alteracoes" : "Criar Meta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── RENDER ─────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">
      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex flex-col gap-4" data-tutorial="metas-header">
        {/* Row 1: Nav + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2">
            {/* Meta selector with prev/next */}
            <div className="flex items-center gap-1.5" data-tutorial="metas-month">
              <Button
                variant="ghost"
                size="icon"
                disabled={!canGoPrev}
                onClick={() => canGoPrev && goToMeta(todasMetas[selectedIndex - 1].id)}
                className="h-8 w-8 rounded-lg shrink-0 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={isMetaSelectorOpen} onOpenChange={setIsMetaSelectorOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/60 transition-colors group cursor-pointer">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
                      {m.nome}
                    </h1>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0 rounded-2xl border-border/60 shadow-lg"
                  align="start"
                  sideOffset={8}
                >
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suas Metas</p>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto px-2 pb-2">
                    {todasMetas.map((mt, idx) => {
                      const isSelected = mt.id === m.id;
                      const pctR = Number(mt.pct_receita) || 0;
                      const stInfo = statusInfo(pctR);
                      return (
                        <button
                          key={mt.id}
                          onClick={() => goToMeta(mt.id)}
                          className={cn(
                            "w-full text-left px-3 py-3 rounded-xl transition-all duration-150 flex items-start gap-3 group/item",
                            isSelected
                              ? "bg-foreground/[0.06] ring-1 ring-foreground/10"
                              : "hover:bg-muted/50"
                          )}
                        >
                          {/* Status indicator */}
                          <div className={cn(
                            "mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-foreground text-background" : "bg-muted"
                          )}>
                            {mt.ativo ? (
                              <Target className={cn("h-3.5 w-3.5", !isSelected && "text-muted-foreground")} />
                            ) : (
                              <History className={cn("h-3.5 w-3.5", !isSelected && "text-muted-foreground/50")} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn("text-sm font-semibold truncate", isSelected ? "text-foreground" : "text-foreground/80")}>
                                {mt.nome}
                              </p>
                              {mt.ativo && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/60 shrink-0">
                                  Ativa
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {format(parseISO(mt.data_inicio), "dd/MM", { locale: ptBR })} — {format(parseISO(mt.data_fim), "dd/MM/yy", { locale: ptBR })}
                              </span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] font-semibold tabular-nums" style={{ color: pctColor(pctR) }}>
                                {fmtPct(pctR)}
                              </span>
                            </div>
                            {/* Mini progress bar */}
                            <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5 w-full">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(pctR, 100)}%`, backgroundColor: pctColor(pctR) }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                disabled={!canGoNext}
                onClick={() => canGoNext && goToMeta(todasMetas[selectedIndex + 1].id)}
                className="h-8 w-8 rounded-lg shrink-0 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Tags below title */}
            <div className="flex items-center gap-2 ml-10 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-muted/50 border-border/60 text-muted-foreground capitalize">
                {m.periodo_tipo}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {format(parseISO(m.data_inicio), "dd/MM", { locale: ptBR })} — {format(parseISO(m.data_fim), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              {!m.ativo && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200/60">
                  Encerrada
                </span>
              )}
              {todasMetas.length > 1 && (
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {selectedIndex + 1} de {todasMetas.length}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => setDeletingMetaId(m.id)} className="h-9 gap-1.5 rounded-lg text-xs font-medium px-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="h-3 w-3" /> <span className="hidden sm:inline">Excluir</span>
            </Button>
            <Button variant="outline" onClick={openEditar} className="h-9 gap-1.5 rounded-lg text-xs font-medium px-3" data-tutorial="metas-edit">
              <Edit2 className="h-3 w-3" /> Editar
            </Button>
            <Button data-tutorial="metas-criar" onClick={openCriar} className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4">
              <Plus className="h-3.5 w-3.5" /> Nova Meta
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums font-medium">{diasRestantes}d restantes</span>
          </div>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all duration-700" style={{ width: `${progressoTempo}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums font-medium">{progressoTempo}%</span>
        </div>
      </div>

      {/* ═══ HERO METRIC CARDS ═══ */}
      <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Receita", value: fmtBRL(receitaT), meta: tipoMeta === 'niveis' ? `Alvo: ${fmtBRL(receitaAlvo)}` : `Meta: ${fmtBRL(Number(m.meta_receita))}`, pct: pctReceita, accent: true, icon: DollarSign, tooltip: "Soma do valor fechado de todas as vendas no período", isReceita: true, metaVal: Number(m.meta_receita) },
          { label: "Leads", value: fmtNum(leadsT), meta: `Meta: ${fmtNum(Number(m.meta_leads))}`, pct: pctLeads, icon: Users, tooltip: "Total de novos leads cadastrados no período", isReceita: false, metaVal: Number(m.meta_leads) },
          { label: "Agendamentos", value: fmtNum(reunioesT), meta: `Meta: ${fmtNum(Number(m.meta_reunioes))}`, pct: pctReunioes, icon: CalendarCheck, tooltip: "Leads únicos com pelo menos 1 agendamento realizado no período", isReceita: false, metaVal: Number(m.meta_reunioes) },
          { label: "Fechamentos", value: fmtNum(fechamentosT), meta: `Meta: ${fmtNum(Number(m.meta_fechamentos))}`, pct: pctFechamentos, icon: Award, tooltip: "Leads únicos com pelo menos 1 venda fechada no período", isReceita: false, metaVal: Number(m.meta_fechamentos) },
        ].map((card) => {
          const showNiveis = card.isReceita && tipoMeta === 'niveis' && receitaSuper > 0;
          const nivelBarColor = nivelAtingido === 'super' ? '#8b5cf6' : nivelAtingido === 'alvo' ? '#10b981' : nivelAtingido === 'piso' ? '#f59e0b' : '#ef4444';
          const nivelFill = showNiveis ? Math.min((receitaT / receitaSuper) * 100, 100) : Math.min(card.pct, 100);
          const pisoPct  = showNiveis && receitaSuper > 0 ? (receitaPiso / receitaSuper) * 100 : 0;
          const alvoPct  = showNiveis && receitaSuper > 0 ? (receitaAlvo / receitaSuper) * 100 : 0;
          const nivelLabel = { super: 'Super Meta', alvo: 'Alvo', piso: 'Piso', none: '' }[nivelAtingido];
          const nivelBadgeColor = { super: 'bg-violet-50 text-violet-700 border-violet-200', alvo: 'bg-emerald-50 text-emerald-700 border-emerald-200', piso: 'bg-amber-50 text-amber-700 border-amber-200', none: '' }[nivelAtingido];
          return (
          <div
            key={card.label}
            className={cn(
              "rounded-2xl p-4 sm:p-5 relative overflow-hidden group transition-all duration-200",
              card.accent
                ? "border-2 border-primary/20 bg-primary/[0.04] hover:border-primary/30 hover:shadow-md"
                : "border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-border hover:shadow-md"
            )}
          >
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
              <div className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110",
                card.accent ? "bg-primary/10" : "bg-muted"
              )}>
                <card.icon className={cn("h-4 w-4", card.accent ? "text-primary" : "text-muted-foreground")} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <p className={cn("text-[9px] font-bold uppercase tracking-widest", card.accent ? "text-primary/60" : "text-muted-foreground")}>{card.label}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className={cn("h-3 w-3 cursor-help shrink-0", card.accent ? "text-primary/30" : "text-muted-foreground/30")} />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  {card.tooltip}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-display mt-2 tabular-nums">{card.value}</p>
            {card.metaVal > 0 && <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">{card.meta}</p>}

            {showNiveis ? (
              /* ── Barra de 3 níveis ── */
              <div className="mt-3 space-y-2">
                <div className="relative h-2 bg-primary/10 rounded-full overflow-visible">
                  {/* Preenchimento */}
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${nivelFill}%`, backgroundColor: nivelBarColor }} />
                  {/* Marco Piso */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-amber-400 rounded-full z-10" style={{ left: `${pisoPct}%` }} />
                  {/* Marco Alvo */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-emerald-500 rounded-full z-10" style={{ left: `${alvoPct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground/50">
                    <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />Piso</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />Alvo</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />Super</span>
                  </div>
                  {nivelAtingido !== 'none' && (
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border tabular-nums", nivelBadgeColor)}>
                      {nivelLabel} atingida
                    </span>
                  )}
                </div>
              </div>
            ) : card.metaVal > 0 ? (
              /* ── Barra simples ── */
              <div className="flex items-center gap-2 mt-3">
                <div className={cn("flex-1 h-1.5 rounded-full overflow-hidden", card.accent ? "bg-primary/10" : "bg-muted")}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(card.pct, 100)}%`, backgroundColor: card.accent ? "hsl(var(--primary))" : pctColor(card.pct) }}
                  />
                </div>
                <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md border", pctBg(card.pct))}>{fmtPct(card.pct)}</span>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 px-1">
        <Info className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <p className="text-[11px] text-muted-foreground/50">
          <span className="font-semibold text-muted-foreground/70">Agendamentos</span> e <span className="font-semibold text-muted-foreground/70">Fechamentos</span> contam <span className="font-semibold text-muted-foreground/70">leads únicos</span> com pelo menos 1 evento realizado no período.
        </p>
      </div>
      </TooltipProvider>

      {/* ═══ FUNNEL FLOW — Conversão entre etapas ═══ */}
      <div className="hidden sm:flex items-center justify-center gap-0 -mt-1" data-tutorial="metas-funnel">
        {[
          { label: "Qualif.", rate: txMqlReal },
          { label: "Agend.", rate: txAgendReal },
          { label: "Conv.", rate: txConvReal },
        ].map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            {i === 0 && <div className="w-4" />}
            <div className="flex flex-col items-center px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                <span className={cn(
                  "text-xs font-bold tabular-nums px-2 py-0.5 rounded-md",
                  step.rate >= 40 ? "bg-emerald-50 text-emerald-700" : step.rate >= 20 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                )}>
                  {fmtPct(step.rate)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
              </div>
              <span className="text-[9px] text-muted-foreground/50 mt-0.5 font-medium">{step.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "projecao") initSimulator(); }}>
        <div className="flex rounded-xl border border-border/60 bg-muted/30 p-1 gap-0.5 self-start w-fit" data-tutorial="metas-tabs">
          {[
            { value: "visao-geral", label: "Visão Geral", icon: Target },
            { value: "historico", label: "Histórico", icon: History },
            { value: "projecao", label: "Projeção", icon: LineChart },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setActiveTab(value); if (value === "projecao") initSimulator(); }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-all",
                activeTab === value ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/80"
              )}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        {/* ═════════ VISAO GERAL ═════════ */}
        <TabsContent value="visao-geral" className="mt-6 space-y-6" data-tutorial="metas-cards">

          {/* Acompanhamento — Hoje / Semana / Mes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-muted"><Activity className="h-3.5 w-3.5 text-muted-foreground" /></div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Acompanhamento</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Hoje */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Hoje</p>
                    <p className="text-[10px] text-muted-foreground/60 capitalize">{format(new Date(), "EEEE, dd/MM", { locale: ptBR })}</p>
                  </div>
                  {metaLeadsDia > 0 && (leadsHoje >= metaLeadsDia ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                      <Zap className="h-3 w-3" /> No ritmo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                      <AlertTriangle className="h-3 w-3" /> Abaixo
                    </span>
                  ))}
                </div>
                <div className="space-y-3">
                  {[{ label: "Leads", real: leadsHoje, meta: metaLeadsDia }, { label: "Qualificados", real: mqlsHoje, meta: metaMqlsDia }].map((r) => {
                    const p = r.meta > 0 ? Math.round((r.real / r.meta) * 100) : 0;
                    return (
                      <div key={r.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{r.label}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {r.real}
                            {r.meta > 0 && <span className="text-muted-foreground/40 font-normal"> / {fmtNum(r.meta)}</span>}
                          </span>
                        </div>
                        {r.meta > 0 && (
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(p, 100)}%`, backgroundColor: pctColor(p) }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Semana */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Semana</p>
                    <p className="text-[10px] text-muted-foreground/60">{format(startOfWeek(new Date(), { locale: ptBR }), "dd/MM")} a {format(endOfWeek(new Date(), { locale: ptBR }), "dd/MM")}</p>
                  </div>
                  {metaLeadsSem > 0 && (leadsSemana >= metaLeadsSem ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                      <Zap className="h-3 w-3" /> No ritmo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                      <AlertTriangle className="h-3 w-3" /> Abaixo
                    </span>
                  ))}
                </div>
                <div className="space-y-3">
                  {[{ label: "Leads", real: leadsSemana, meta: metaLeadsSem }, { label: "Qualificados", real: mqlsSemana, meta: metaMqlsSem }].map((r) => {
                    const p = r.meta > 0 ? Math.round((r.real / r.meta) * 100) : 0;
                    return (
                      <div key={r.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{r.label}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {r.real}
                            {r.meta > 0 && <span className="text-muted-foreground/40 font-normal"> / {fmtNum(r.meta)}</span>}
                          </span>
                        </div>
                        {r.meta > 0 && (
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(p, 100)}%`, backgroundColor: pctColor(p) }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pace card — dark premium */}
              <div className="rounded-2xl bg-[#1a1a1a] p-5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-primary/[0.03]" />
                <div className="absolute top-4 right-4">
                  <div className="h-8 w-8 rounded-xl bg-white/[0.06] flex items-center justify-center">
                    <Flame className="h-4 w-4 text-primary/80" />
                  </div>
                </div>
                <div className="relative">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Ritmo Necessario</p>
                  <p className="text-[13px] font-semibold text-white/70 mb-5">Para bater a meta</p>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Receita / dia</p>
                      <p className="text-2xl font-extrabold text-white font-display tabular-nums leading-none">{fmtBRL(Number(m.receita_necessaria_por_dia))}</p>
                    </div>
                    {Number(m.meta_leads) > 0 && (
                      <>
                        <div className="h-px bg-white/[0.06]" />
                        <div>
                          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Leads / dia</p>
                          <p className="text-2xl font-extrabold text-primary font-display tabular-nums leading-none">{fmtNum(Number(m.leads_necessarios_por_dia))}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grafico de Ritmo */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-muted"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /></div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Grafico de Ritmo</span>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden p-5">
              {paceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={paceData}>
                    <defs>
                      <linearGradient id="gradLeadsMeta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis dataKey="dia" fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tick={{ fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    {metaLeadsDia > 0 && <Legend wrapperStyle={{ fontSize: "10px" }} />}
                    {metaLeadsDia > 0 && <Line type="monotone" dataKey="Meta Linear" stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />}
                    <Area type="monotone" dataKey="Leads Reais" stroke="hsl(var(--primary))" fill="url(#gradLeadsMeta)" strokeWidth={2.5} dot={{ r: 2.5, fill: "hsl(var(--primary))" }} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="bg-muted/30 p-4 rounded-2xl mb-3"><BarChart3 className="h-7 w-7 text-muted-foreground/30" /></div>
                  <p className="text-xs text-muted-foreground/50">Sem dados suficientes</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance do Funil */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-muted"><Gauge className="h-3.5 w-3.5 text-muted-foreground" /></div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Performance do Funil</span>
            </div>

            {/* Desktop table */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60">
                    <th className="text-left px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Métrica</th>
                    <th className="text-right px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Valor Real</th>
                    <th className="text-left px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    { label: "Taxa Qualificação", real: txMqlReal, detail: `${mqlsT} de ${leadsT} leads`, isRate: true },
                    { label: "Taxa Agendamento", real: txAgendReal, detail: `${reunioesT} de ${mqlsT} qualificados`, isRate: true },
                    { label: "Taxa Conversão", real: txConvReal, detail: `${fechamentosT} de ${reunioesT} agendados`, isRate: true },
                    { label: "Ticket Médio", real: fechamentosT > 0 ? receitaT / fechamentosT : 0, detail: `${fechamentosT} fechamentos`, isCurrency: true },
                  ].map((row) => (
                    <tr key={row.label} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] font-medium">{row.label}</td>
                      <td className="px-5 py-3.5 text-right">
                        {row.real === 0
                          ? <span className="text-muted-foreground/40 text-xs">—</span>
                          : <span className="text-sm font-bold tabular-nums">{row.isCurrency ? fmtBRL2(row.real) : `${row.real}%`}</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground/60">{row.real > 0 ? row.detail : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {[
                { label: "Taxa Qualificação", real: txMqlReal, detail: `${mqlsT} de ${leadsT} leads`, isRate: true },
                { label: "Taxa Agendamento", real: txAgendReal, detail: `${reunioesT} de ${mqlsT} qualificados`, isRate: true },
                { label: "Taxa Conversão", real: txConvReal, detail: `${fechamentosT} de ${reunioesT} agendados`, isRate: true },
                { label: "Ticket Médio", real: fechamentosT > 0 ? receitaT / fechamentosT : 0, detail: `${fechamentosT} fechamentos`, isCurrency: true },
              ].map((row) => (
                <div key={row.label} className="rounded-xl border border-border/60 bg-card p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">{row.label}</span>
                    {row.real > 0 && <span className="text-[10px] text-muted-foreground/50">{row.detail}</span>}
                  </div>
                  <span className="text-lg font-bold tabular-nums">
                    {row.real === 0 ? <span className="text-muted-foreground/40 text-sm">—</span> : (row as any).isCurrency ? fmtBRL2(row.real) : `${row.real}%`}
                  </span>
                </div>
              ))}
            </div>

            {projecao && (
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] mt-3 p-4 border-l-4 border-l-primary relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-1.5">Insight de Projeção</p>
                <p className="text-xs text-muted-foreground leading-relaxed pr-10">
                  No ritmo atual (<strong className="text-foreground">{projecao.mediaLeadsDia} leads/dia</strong>), você fechará o mês com ~<strong className="text-foreground">{projecao.leadsProj} leads</strong>, ~<strong className="text-foreground">{projecao.reunioesProj} agendamentos</strong> e ~<strong className="text-foreground">{fmtBRL(projecao.receitaProj)}</strong> de receita.
                  {Number(m.leads_necessarios_por_dia) > 0 && (<> Para bater a meta, precisa de <strong className="text-foreground">{fmtNum(Number(m.leads_necessarios_por_dia))} leads/dia</strong>.</>)}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═════════ HISTORICO ═════════ */}
        <TabsContent value="historico" className="mt-6 space-y-6" data-tutorial="metas-historico">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-muted"><History className="h-3.5 w-3.5 text-muted-foreground" /></div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico de Metas</span>
            {todasMetas.length > 0 && <span className="text-[10px] font-bold tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{todasMetas.length}</span>}
          </div>

          {/* Desktop table */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60">
                    <th className="text-left px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Nome</th>
                    <th className="text-left px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Periodo</th>
                    <th className="text-right px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Meta Receita</th>
                    <th className="text-right px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Realizado</th>
                    <th className="text-right px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">%</th>
                    <th className="text-right px-5 py-3 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {todasMetas.map((mt) => {
                    const pctR = Number(mt.pct_receita) || 0;
                    return (
                      <Fragment key={mt.id}>
                        <tr className="hover:bg-muted/20 transition-colors cursor-pointer group/row" onClick={() => setExpandedHistorico(expandedHistorico === mt.id ? null : mt.id)}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground/40 transition-transform", expandedHistorico === mt.id && "rotate-90")} />
                              <span className="text-[13px] font-medium">{mt.nome}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground tabular-nums">{format(parseISO(mt.data_inicio), "dd/MM/yy")} — {format(parseISO(mt.data_fim), "dd/MM/yy")}</td>
                          <td className="px-5 py-3.5 text-right text-xs font-bold tabular-nums">{fmtBRL(Number(mt.meta_receita))}</td>
                          <td className="px-5 py-3.5 text-right text-xs tabular-nums">{fmtBRL(Number(mt.receita_total))}</td>
                          <td className="px-5 py-3.5 text-right"><span className={cn("inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md border tabular-nums", pctBg(pctR))}>{fmtPct(pctR)}</span></td>
                          <td className="px-5 py-3.5 text-right">
                            {mt.ativo ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200/60">Em andamento</span>
                            ) : pctR >= 100 ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200/60">Batida</span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-red-50 text-red-700 border-red-200/60">Nao atingida</span>
                            )}
                          </td>
                          <td className="px-2 py-3.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingMetaId(mt.id); }}
                              className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover/row:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                        {expandedHistorico === mt.id && (
                          <tr>
                            <td colSpan={7} className="px-5 py-4 bg-muted/10">
                              <div className="flex items-center gap-1.5 text-xs flex-wrap justify-center">
                                {[
                                  { l: "Leads", v: `${fmtNum(Number(mt.leads_total))}/${fmtNum(Number(mt.meta_leads))}` },
                                  { l: "Qualificados", v: `${fmtNum(Number(mt.mqls_total))}/${fmtNum(Number(mt.meta_mqls))}` },
                                  { l: "Agendamentos", v: `${fmtNum(Number(mt.reunioes_total))}/${fmtNum(Number(mt.meta_reunioes))}` },
                                  { l: "Fechamentos", v: `${fmtNum(Number(mt.fechamentos_total))}/${fmtNum(Number(mt.meta_fechamentos))}` },
                                ].map((item, i, arr) => (
                                  <Fragment key={item.l}>
                                    <div className="text-center px-3 py-1">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">{item.l}</p>
                                      <p className="text-xs font-bold tabular-nums mt-0.5">{item.v}</p>
                                    </div>
                                    {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/20" />}
                                  </Fragment>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {todasMetas.length === 0 && (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div className="bg-muted/30 p-5 rounded-2xl mb-4 inline-block"><Target className="h-8 w-8 text-muted-foreground/30" /></div>
                      <p className="text-sm font-medium text-foreground">Nenhuma meta encontrada</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {todasMetas.map((mt) => {
              const pctR = Number(mt.pct_receita) || 0;
              const isExpanded = expandedHistorico === mt.id;
              return (
                <div
                  key={mt.id}
                  className={cn(
                    "rounded-2xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all cursor-pointer",
                    isExpanded ? "border-primary/20" : "border-border/60"
                  )}
                  onClick={() => setExpandedHistorico(isExpanded ? null : mt.id)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{mt.nome}</p>
                        <p className="text-[10px] text-muted-foreground/60 tabular-nums mt-0.5">
                          {format(parseISO(mt.data_inicio), "dd/MM/yy")} — {format(parseISO(mt.data_fim), "dd/MM/yy")}
                        </p>
                      </div>
                      {mt.ativo ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200/60 shrink-0">Ativa</span>
                      ) : pctR >= 100 ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200/60 shrink-0">Batida</span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-red-50 text-red-700 border-red-200/60 shrink-0">Nao atingida</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-lg font-extrabold font-display tabular-nums">{fmtBRL(Number(mt.receita_total))}</span>
                      <span className="text-[10px] text-muted-foreground/50">/ {fmtBRL(Number(mt.meta_receita))}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md border tabular-nums ml-auto", pctBg(pctR))}>{fmtPct(pctR)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pctR, 100)}%`, backgroundColor: pctColor(pctR) }} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/30">
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                          { l: "Leads", v: fmtNum(Number(mt.leads_total)), m: fmtNum(Number(mt.meta_leads)) },
                          { l: "Qualificados", v: fmtNum(Number(mt.mqls_total)), m: fmtNum(Number(mt.meta_mqls)) },
                          { l: "Agendamentos", v: fmtNum(Number(mt.reunioes_total)), m: fmtNum(Number(mt.meta_reunioes)) },
                          { l: "Fechamentos", v: fmtNum(Number(mt.fechamentos_total)), m: fmtNum(Number(mt.meta_fechamentos)) },
                        ].map((item) => (
                          <div key={item.l} className="text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">{item.l}</p>
                            <p className="text-xs font-bold tabular-nums mt-0.5">{item.v}</p>
                            <p className="text-[9px] text-muted-foreground/40 tabular-nums">/ {item.m}</p>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingMetaId(mt.id); }}
                        className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/30 text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors w-full justify-center"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir meta
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {todasMetas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-border/60 bg-card">
                <div className="bg-muted/30 p-5 rounded-2xl mb-4"><Target className="h-8 w-8 text-muted-foreground/30" /></div>
                <p className="text-sm font-medium text-foreground">Nenhuma meta encontrada</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═════════ PROJECAO ═════════ */}
        <TabsContent value="projecao" className="mt-6 space-y-8" data-tutorial="metas-projecao">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-muted"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /></div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Projecao do Mes</span>
            </div>

            {projecao && (
              <>
                {/* Nota de base */}
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 border-l-4 border-l-primary mb-4">
                  <p className="text-xs text-muted-foreground">
                    Com base nos últimos <strong className="text-foreground">{diasDecorridos} dias</strong> (média de <strong className="text-foreground">{projecao.mediaLeadsDia} leads/dia</strong>
                    {projecao.ticketReal > 0 && <> · ticket real <strong className="text-foreground">{fmtBRL(projecao.ticketReal)}</strong></>}):
                  </p>
                </div>

                {/* Funil projetado — 4 pills informativos */}
                <div className="rounded-2xl bg-[#1a1a1a] p-5 relative overflow-hidden mb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-primary/[0.03]" />
                  <div className="relative">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-4">Funil Projetado ao Final do Período</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Leads", val: projecao.leadsProj, sub: `${fmtNum(leadsT)} atual` },
                        { label: "Qualificados", val: projecao.mqlsProj, sub: `Taxa ${projecao.txMqlReal}%` },
                        { label: "Agendamentos", val: projecao.reunioesProj, sub: `Taxa ${projecao.txAgendReal}%` },
                        { label: "Fechamentos", val: projecao.fechamentosProj, sub: `Taxa ${projecao.txConvReal}%`, accent: true },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{item.label}</p>
                          <p className={cn("text-2xl font-extrabold font-display tabular-nums leading-none", item.accent ? "text-primary" : "text-white")}>{fmtNum(item.val)}</p>
                          <p className="text-[10px] text-white/30 mt-1">{item.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Receita projetada vs meta */}
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Receita — Meta vs Projeção</p>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Barra visual */}
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-2xl font-extrabold font-display tabular-nums">{fmtBRL(projecao.receitaProj)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">meta: {fmtBRL(Number(m.meta_receita))}</span>
                      </div>
                      {(() => {
                        const pct = Number(m.meta_receita) > 0 ? Math.min((projecao.receitaProj / Number(m.meta_receita)) * 100, 150) : 0;
                        const diff = projecao.receitaProj - Number(m.meta_receita);
                        const isPos = diff >= 0;
                        return (
                          <>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[11px] text-muted-foreground">{Math.round(pct)}% da meta</span>
                              <span className={cn("text-xs font-bold tabular-nums", isPos ? "text-emerald-600" : "text-red-600")}>
                                {isPos ? "+" : ""}{fmtBRL(diff)}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {projecao.ticketReal === 0 && (
                      <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2">
                        Sem fechamentos no período — projeção de receita indisponível.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Simulador */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-muted"><SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" /></div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Simulador Interativo</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Ajuste os parametros</p>
                <div className="space-y-5">
                  {[
                    { label: "Leads por dia", value: simLeadsDia, set: setSimLeadsDia, min: 0, max: 50, step: 0.5, fmt: (v: number) => v.toString() },
                    { label: "Taxa Qualificação (%)", value: simTxMql, set: setSimTxMql, min: 1, max: 100, step: 1, fmt: (v: number) => `${v}%` },
                    { label: "Taxa Agendamento (%)", value: simTxAgend, set: setSimTxAgend, min: 1, max: 100, step: 1, fmt: (v: number) => `${v}%` },
                    { label: "Taxa Conversão (%)", value: simTxConv, set: setSimTxConv, min: 1, max: 100, step: 1, fmt: (v: number) => `${v}%` },
                    { label: "Ticket Medio (R$)", value: simTicket, set: setSimTicket, min: 500, max: 50000, step: 500, fmt: (v: number) => fmtBRL(v) },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs text-muted-foreground">{s.label}</Label>
                        <span className="text-xs font-bold text-foreground tabular-nums">{s.fmt(s.value)}</span>
                      </div>
                      <Slider value={[s.value]} onValueChange={(v) => s.set(v[0])} min={s.min} max={s.max} step={s.step} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {/* Resultado destaque — dark card */}
                {simulacao && (
                  <div className="rounded-2xl bg-[#1a1a1a] p-5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-primary/[0.03]" />
                    <div className="relative">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-4">Resultado da Simulacao</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Receita Projetada</p>
                          <p className="text-xl sm:text-2xl font-extrabold text-white font-display tabular-nums leading-none">{fmtBRL(simulacao.receita)}</p>
                          <p className="text-[10px] text-white/30 mt-1 tabular-nums">Meta: {fmtBRL(Number(m.meta_receita))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Fechamentos</p>
                          <p className="text-xl sm:text-2xl font-extrabold text-primary font-display tabular-nums leading-none">{fmtNum(simulacao.fechamentos)}</p>
                          <p className="text-[10px] text-white/30 mt-1 tabular-nums">Meta: {fmtNum(Number(m.meta_fechamentos))}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detalhamento com barras */}
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Detalhamento do Funil</p>
                  {simulacao && (
                    <div className="space-y-4">
                      {/* Funil — valores projetados sem comparação de meta */}
                      {[
                        { label: "Leads", sim: simulacao.leads },
                        { label: "Qualificados", sim: simulacao.mqls },
                        { label: "Agendamentos", sim: simulacao.reunioes },
                        { label: "Fechamentos", sim: simulacao.fechamentos },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                          <span className="text-sm font-bold tabular-nums">{fmtNum(row.sim)}</span>
                        </div>
                      ))}
                      <div className="h-px bg-border/40" />
                      {/* Receita — única linha com barra de progresso vs meta */}
                      {(() => {
                        const pct = Number(m.meta_receita) > 0 ? Math.round((simulacao.receita / Number(m.meta_receita)) * 100) : 0;
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-muted-foreground">Receita</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold tabular-nums">{fmtBRL(simulacao.receita)}</span>
                                {Number(m.meta_receita) > 0 && <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md border tabular-nums", pctBg(pct))}>{pct}%</span>}
                              </div>
                            </div>
                            {Number(m.meta_receita) > 0 && (
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor(pct) }} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {renderModal()}

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!deletingMetaId} onOpenChange={(o) => { if (!o) setDeletingMetaId(null); }}>
        <DialogContent className="w-[95vw] max-w-sm rounded-2xl border-border/60 p-0 gap-0">
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold text-foreground">Excluir Meta</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-50 shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-foreground font-medium mb-1">Tem certeza que deseja excluir esta meta?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Esta ação não pode ser desfeita. Todos os dados de acompanhamento associados serão perdidos.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="ghost" onClick={() => setDeletingMetaId(null)} className="h-9 rounded-lg text-xs font-medium text-muted-foreground px-4">
              Cancelar
            </Button>
            <Button
              onClick={() => { if (deletingMetaId) excluirMeta.mutate(deletingMetaId); }}
              disabled={excluirMeta.isPending}
              className="h-9 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 px-5 gap-1.5"
            >
              {excluirMeta.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Excluir Meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
