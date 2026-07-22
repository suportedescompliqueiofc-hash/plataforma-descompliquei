import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, endOfWeek, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target, Plus, Edit2, Loader2, DollarSign, Clock, Flame,
  ChevronDown, ChevronLeft, ChevronRight, Trash2, Info, TrendingUp, SlidersHorizontal, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { CurrencyInput } from "@/components/CurrencyInput";
import { PageHero } from "@/components/PageHero";
import { StatCard } from "@/components/StatCard";
import { formatBRL, formatPct, formatInt } from "@/lib/format";
import { ProjecaoFaturamento } from "@/components/agendamentos/ProjecaoFaturamento";
import { ANNA_CLARA_ORG_ID } from "@/lib/constants";
import { ComposedChart, Bar, Cell, Line, LabelList, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip } from "recharts";

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
  criado_em: string;
  receita_total?: number;
  fechamentos_total?: number;
  leads_total?: number;
  mqls_total?: number;
  reunioes_total?: number;
  dias_restantes?: number;
  dias_decorridos?: number;
  total_dias?: number;
  pct_receita?: number;
  receita_necessaria_por_dia?: number;
  // Sistema de níveis
  tipo_meta?: string;
  meta_receita_piso?: number;
  meta_receita_super?: number;
  // Meta por origem
  usa_meta_origem?: boolean;
}

interface MetaOrigemAcomp {
  id: string;
  meta_id: string;
  organization_id: string;
  origem: string;
  meta_receita: number;
  data_inicio: string;
  data_fim: string;
  receita_total: number;
  pct_receita: number;
}

interface OrigemDef {
  id: string;
  label: string;
  dot: string; // classe tailwind do dot de cor
}

// Espelha EXATAMENTE o Select de "Origem" do LeadModal.tsx.
const ORIGENS_BASE: OrigemDef[] = [
  { id: "marketing", label: "Marketing", dot: "bg-amber-500" },
  { id: "organico", label: "Orgânico", dot: "bg-emerald-500" },
  { id: "reativacao", label: "Reativação", dot: "bg-cyan-500" },
  { id: "paciente", label: "Paciente", dot: "bg-teal-500" },
];
const ORIGEM_CONVENIO: OrigemDef = { id: "convenio", label: "Convênio", dot: "bg-violet-500" };

// ── Helpers ────────────────────────────────────────────────────

const fmtBRL = formatBRL;
const fmtNum = formatInt;
const fmtPct = (v: number | null | undefined): string => formatPct(v, 1);

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

// Rótulo de valor acima de cada "prédio" do gráfico.
const BarValueLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value == null) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 7}
      textAnchor="middle"
      className="font-display"
      style={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--foreground))", fontVariantNumeric: "tabular-nums" }}
    >
      {fmtBRL(value)}
    </text>
  );
};

// ── Main Component ─────────────────────────────────────────────

export default function Metas() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const isAnnaClaraOrg = orgId === ANNA_CLARA_ORG_ID;
  const origensDisponiveis = useMemo<OrigemDef[]>(
    () => (isAnnaClaraOrg ? [...ORIGENS_BASE, ORIGEM_CONVENIO] : ORIGENS_BASE),
    [isAnnaClaraOrg]
  );
  const [modalMeta, setModalMeta] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [deletingMetaId, setDeletingMetaId] = useState<string | null>(null);
  const [selectedMetaId, setSelectedMetaId] = useState<string | null>(null);
  const [isMetaSelectorOpen, setIsMetaSelectorOpen] = useState(false);
  const [chartGran, setChartGran] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

  const meta = useMemo(() => {
    if (todasMetas.length === 0) return null;
    if (selectedMetaId) return todasMetas.find(m => m.id === selectedMetaId) || todasMetas[0];
    const ativa = todasMetas.find(m => m.ativo);
    return ativa || todasMetas[0];
  }, [todasMetas, selectedMetaId]);

  const selectedIndex = useMemo(() => {
    if (!meta) return -1;
    return todasMetas.findIndex(m => m.id === meta.id);
  }, [meta, todasMetas]);

  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < todasMetas.length - 1;

  function goToMeta(id: string) {
    setSelectedMetaId(id);
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
  const [formLoading, setFormLoading] = useState(false);

  // ── Meta por origem ─────────────────────────────────────
  const [formUsaMetaOrigem, setFormUsaMetaOrigem] = useState(false);
  const [formMetaOrigens, setFormMetaOrigens] = useState<Record<string, number>>({});

  // Enquanto "Meta por origem" está ligado, o alvo total é sempre a soma das origens.
  useEffect(() => {
    if (!formUsaMetaOrigem) return;
    const total = origensDisponiveis.reduce((sum, o) => sum + (formMetaOrigens[o.id] || 0), 0);
    setFormReceita(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formUsaMetaOrigem, formMetaOrigens, origensDisponiveis]);

  // ── Simulador "E se?" ──────────────────────────────────
  const [simLeadsDia, setSimLeadsDia] = useState(0);
  const [simTxMql, setSimTxMql] = useState(60);
  const [simTxAgend, setSimTxAgend] = useState(40);
  const [simTxConv, setSimTxConv] = useState(25);
  const [simTicket, setSimTicket] = useState(5000);

  const initSimulator = () => {
    if (!meta) return;
    const dd = Number(meta.dias_decorridos) || 1;
    const la = Number(meta.leads_total) || 0;
    const mq = Number(meta.mqls_total) || 0;
    const re = Number(meta.reunioes_total) || 0;
    const fe = Number(meta.fechamentos_total) || 0;
    const mediaLeadsDia = Math.round((la / dd) * 10) / 10;
    const ticketReal = fe > 0 ? Math.round((Number(meta.receita_total) || 0) / fe) : (Number(meta.ticket_medio) || 5000);
    setSimLeadsDia(mediaLeadsDia || 3);
    setSimTxMql(la > 0 ? Math.round((mq / la) * 100) : 60);
    setSimTxAgend(mq > 0 ? Math.round((re / mq) * 100) : 40);
    setSimTxConv(re > 0 ? Math.round((fe / re) * 100) : 25);
    setSimTicket(ticketReal);
  };

  useEffect(() => {
    if (meta) initSimulator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.id]);

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

  // ── Projeção de receita — insight ──────────────────────
  const projecaoReceita = useMemo(() => {
    if (!meta) return null;
    const dr = Math.max(Number(meta.dias_restantes) || 0, 0);
    const dd = Math.max(Number(meta.dias_decorridos) || 1, 1);
    const receita = Number(meta.receita_total) || 0;
    // Extrapola a receita mantendo o ritmo diário atual.
    const receitaDia = receita / dd;
    const receitaProj = Math.round(receita + receitaDia * dr);
    return { receitaProj, temDados: receita > 0 };
  }, [meta]);

  // Faturamento real por dia (vendas) dentro do período da meta.
  const { data: dailyRealized } = useQuery({
    queryKey: ["meta-vendas-diarias", orgId, meta?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("data_fechamento, valor_fechado")
        .eq("organization_id", orgId!)
        .gte("data_fechamento", meta!.data_inicio)
        .lte("data_fechamento", meta!.data_fim);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const v of (data ?? []) as { data_fechamento: string; valor_fechado: number }[]) {
        const k = String(v.data_fechamento).slice(0, 10);
        map.set(k, (map.get(k) ?? 0) + Number(v.valor_fechado || 0));
      }
      return map;
    },
    enabled: !!orgId && !!meta?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  // Acompanhamento (realizado × alvo) por origem — só existe linha quando a meta usa origem.
  const { data: metaOrigensAcomp = [] } = useQuery({
    queryKey: ["meta-origens-acomp", orgId, meta?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_meta_origem_acompanhamento" as any)
        .select("*")
        .eq("meta_id", meta!.id)
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data as unknown as MetaOrigemAcomp[]) || [];
    },
    enabled: !!orgId && !!meta?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  // ── Dados do gráfico de projeção (receita: plano ideal × realizado) ─
  const projChart = useMemo(() => {
    if (!meta) return null;
    const target = Number(meta.meta_receita) || 0;
    const start = parseISO(meta.data_inicio);
    const end = parseISO(meta.data_fim);
    const totalD = Math.max(differenceInDays(end, start) + 1, 1);
    const today = new Date();
    const todayKey = format(today, "yyyy-MM-dd");

    const keyFn = chartGran === "dia"
      ? (d: Date) => format(d, "yyyy-MM-dd")
      : chartGran === "semana"
        ? (d: Date) => format(startOfWeek(d, { locale: ptBR }), "yyyy-MM-dd")
        : (d: Date) => format(startOfMonth(d), "yyyy-MM");
    const labelFn = chartGran === "mes"
      ? (d: Date) => format(d, "MMM/yy", { locale: ptBR })
      : (d: Date) => format(d, "dd/MM", { locale: ptBR });

    type Bucket = { key: string; label: string; idealCum: number; realCum: number | null; realInc: number; idx: number; anyPast: boolean };
    const map = new Map<string, Bucket>();
    let cumReal = 0;
    for (let i = 0; i < totalD; i++) {
      const d = addDays(start, i);
      const dayKey = format(d, "yyyy-MM-dd");
      const isPast = dayKey <= todayKey; // comparação lexicográfica funciona p/ yyyy-MM-dd
      const realDay = dailyRealized?.get(dayKey) ?? 0;
      if (isPast) cumReal += realDay;
      const idealCum = target * ((i + 1) / totalD);
      const k = keyFn(d);
      const cur = map.get(k);
      if (!cur) {
        map.set(k, { key: k, label: labelFn(d), idealCum, realCum: isPast ? cumReal : null, realInc: isPast ? realDay : 0, idx: i + 1, anyPast: isPast });
      } else {
        cur.idealCum = idealCum;
        cur.idx = i + 1;
        if (isPast) { cur.realCum = cumReal; cur.realInc += realDay; cur.anyPast = true; }
      }
    }
    const arr = [...map.values()].sort((a, b) => a.idx - b.idx);

    const inPeriod = today >= start && today <= end;
    const hojeKey = inPeriod ? keyFn(today) : null;
    const hojeLabel = hojeKey ? map.get(hojeKey)?.label ?? null : null;
    const todayIdx = differenceInDays(today, start); // 0-based
    const idealHoje = today < start ? 0 : today > end ? target : target * ((todayIdx + 1) / totalD);
    const done = cumReal; // realizado acumulado até hoje (bate com receita_total)

    const data = arr.map((b, i) => ({
      label: b.label,
      ideal: Math.round(b.idealCum * 100) / 100,
      idealInc: Math.round((b.idealCum - (i > 0 ? arr[i - 1].idealCum : 0)) * 100) / 100,
      realizado: b.realCum == null ? null : Math.round(b.realCum * 100) / 100,
      realInc: Math.round(b.realInc * 100) / 100,
      isFuture: !b.anyPast,
    }));

    return { data, target, done, idealHoje, hojeLabel, inPeriod, showLabels: data.length <= 14 };
  }, [meta, chartGran, dailyRealized]);

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
        // Meta é só receita — sem funil de conversão.
        ticket_medio: 0,
        cpl_meta: 0,
        tx_mql: 0,
        tx_agendamento: 0,
        tx_conversao: 0,
        meta_fechamentos: 0,
        meta_reunioes: 0,
        meta_mqls: 0,
        meta_leads: 0,
        tipo_meta: formTipoMeta,
        meta_receita_piso: formTipoMeta === 'niveis' ? formReceitaPiso : 0,
        meta_receita_super: formTipoMeta === 'niveis' ? formReceitaSuper : 0,
        usa_meta_origem: formUsaMetaOrigem,
      };

      let metaId: string;
      if (editingMeta) {
        const { error } = await supabase.from("metas").update(payload).eq("id", editingMeta.id);
        if (error) throw error;
        metaId = editingMeta.id;
      } else {
        const { data, error } = await supabase.from("metas").insert(payload).select("id").single();
        if (error) throw error;
        metaId = data.id;
      }

      // Sincroniza meta_origens: sempre limpa e recria a partir do estado atual do form.
      const { error: delError } = await supabase.from("meta_origens" as any).delete().eq("meta_id", metaId);
      if (delError) throw delError;

      if (formUsaMetaOrigem) {
        const rows = origensDisponiveis
          .map((o) => ({
            meta_id: metaId,
            organization_id: orgId!,
            origem: o.id,
            meta_receita: formMetaOrigens[o.id] || 0,
          }))
          .filter((r) => r.meta_receita > 0);
        if (rows.length > 0) {
          const { error: insError } = await supabase.from("meta_origens" as any).insert(rows);
          if (insError) throw insError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todas-metas", orgId] });
      queryClient.invalidateQueries({ queryKey: ["meta-origens-acomp", orgId] });
      toast.success(editingMeta ? "Meta atualizada!" : "Meta criada!");
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
      toast.success("Meta excluída com sucesso!");
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
    const baseReceita = meta ? Number(meta.meta_receita) || 50000 : 50000;
    const baseTipoMeta = meta ? ((meta.tipo_meta as 'simples' | 'niveis') || 'simples') : 'simples';
    const basePiso = meta ? Number(meta.meta_receita_piso) || Math.round(baseReceita * 0.6) : Math.round(baseReceita * 0.6);
    const baseSuper = meta ? Number(meta.meta_receita_super) || Math.round(baseReceita * 1.6) : Math.round(baseReceita * 1.6);
    setFormNome(`Meta ${fmtBRL(baseReceita)} — ${format(now, "MMMM yyyy", { locale: ptBR })}`);
    setFormPeriodo("mensal");
    setFormInicio(format(startOfMonth(now), "yyyy-MM-dd"));
    setFormFim(format(endOfMonth(now), "yyyy-MM-dd"));
    setFormReceita(baseReceita);
    setFormTipoMeta(baseTipoMeta);
    setFormReceitaPiso(basePiso); setFormReceitaSuper(baseSuper);
    setFormUsaMetaOrigem(false);
    setFormMetaOrigens({});
    setModalMeta(true);
  }

  function openEditar() {
    if (!meta) return;
    setEditingMeta(meta);
    setFormNome(meta.nome); setFormPeriodo(meta.periodo_tipo);
    setFormInicio(meta.data_inicio); setFormFim(meta.data_fim);
    setFormReceita(Number(meta.meta_receita));
    setFormTipoMeta((meta.tipo_meta as 'simples' | 'niveis') || 'simples');
    setFormReceitaPiso(Number(meta.meta_receita_piso) || 30000);
    setFormReceitaSuper(Number(meta.meta_receita_super) || 80000);
    setFormUsaMetaOrigem(false);
    setFormMetaOrigens({});
    setModalMeta(true);

    // Busca async: toggle "usa_meta_origem" (não vem da view) + valores já salvos por origem.
    (async () => {
      const [{ data: metaRow }, { data: origensRows }] = await Promise.all([
        supabase.from("metas" as any).select("usa_meta_origem").eq("id", meta.id).single(),
        supabase.from("meta_origens" as any).select("origem, meta_receita").eq("meta_id", meta.id),
      ]);
      setFormUsaMetaOrigem(!!(metaRow as unknown as { usa_meta_origem?: boolean } | null)?.usa_meta_origem);
      const map: Record<string, number> = {};
      for (const row of (origensRows ?? []) as unknown as { origem: string; meta_receita: number }[]) {
        map[row.origem] = Number(row.meta_receita) || 0;
      }
      setFormMetaOrigens(map);
    })();
  }

  function handleReceitaChange(v: number | undefined) {
    const val = v ?? 0;
    setFormReceita(val);
    if (/^Meta R\$/.test(formNome)) {
      const dataRef = formInicio ? parseISO(formInicio) : new Date();
      setFormNome(`Meta ${fmtBRL(val)} — ${format(dataRef, "MMMM yyyy", { locale: ptBR })}`);
    }
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

  // ── Loading ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <div className="flex justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-9 w-32" /></div>
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  // ── No meta ────────────────────────────────────────────

  if (!meta) {
    return (
      <div className="space-y-6 pb-10">
        <PageHero
          icon={Target}
          title="Metas"
          subtitle="Defina sua meta de receita e veja a projeção até ela"
          right={
            <Button data-tutorial="metas-criar" onClick={openCriar} className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4">
              <Plus className="h-3.5 w-3.5" /> Nova Meta
            </Button>
          }
        />
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="bg-muted/30 p-5 rounded-2xl mb-4"><Target className="h-10 w-10 text-muted-foreground/30" /></div>
          <h3 className="text-base font-semibold text-foreground mb-1 font-display">Nenhuma meta ativa</h3>
          <p className="text-sm text-muted-foreground/60 mb-5">Crie sua primeira meta de receita para projetar o caminho até ela</p>
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

  const receitaT = Number(m.receita_total) || 0;
  const fechamentosT = Number(m.fechamentos_total) || 0;
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

  const faltaReceita = Math.max(receitaAlvo - receitaT, 0);
  const bateuMeta = receitaT >= receitaAlvo && receitaAlvo > 0;

  // ── Modal ──────────────────────────────────────────────

  function renderModal() {
    return (
      <Dialog open={modalMeta} onOpenChange={(o) => { if (!o) setModalMeta(false); }}>
        <DialogContent data-tutorial="meta-modal" className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-border/60 p-0 gap-0">
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold font-display">{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
              <p className="text-xs text-muted-foreground/70">Defina o período e a receita-alvo</p>
            </DialogHeader>
          </div>

          <div className="px-5 py-5 space-y-6">
            {/* ── Identificação ── */}
            <div data-tutorial="meta-field-nome" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da meta</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Ex: Meta 50K — Maio 2026" className="h-10 text-sm rounded-lg border-border/60" />
            </div>

            {/* ── Período ── */}
            <div data-tutorial="meta-field-periodo">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Período</p>
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
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Início</Label>
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
                      formTipoMeta === value ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/80"
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

            {/* ── Meta por origem (toggle) ── */}
            <div data-tutorial="meta-field-origem-toggle" className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-muted shrink-0"><Layers className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Meta por origem</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">Defina quanto da receita-alvo vem de cada origem do lead</p>
                  </div>
                </div>
                <Switch checked={formUsaMetaOrigem} onCheckedChange={setFormUsaMetaOrigem} />
              </div>

              {formUsaMetaOrigem && (
                <div data-tutorial="meta-field-origem-valores" className="mt-4 pt-4 border-t border-border/40 space-y-3">
                  {origensDisponiveis.map((o) => (
                    <div key={o.id} className="flex items-center gap-2.5">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", o.dot)} />
                      <Label className="text-[11px] font-medium text-muted-foreground/70 w-20 shrink-0">{o.label}</Label>
                      <CurrencyInput
                        value={formMetaOrigens[o.id] ?? 0}
                        onValueChange={(v) => setFormMetaOrigens((prev) => ({ ...prev, [o.id]: v ?? 0 }))}
                        className="h-9 text-sm rounded-lg border-border/60"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/30">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total (= receita-alvo)</span>
                    <span className="text-sm font-bold font-display tabular-nums text-foreground">
                      {fmtBRL(origensDisponiveis.reduce((sum, o) => sum + (formMetaOrigens[o.id] || 0), 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Receita ── */}
            <div data-tutorial="meta-field-receita">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{formTipoMeta === 'niveis' ? 'Receita (Piso · Alvo · Super)' : 'Receita-alvo'}</p>
              {formUsaMetaOrigem && (
                <p className="text-[10px] text-muted-foreground/60 mb-2">O alvo agora é a <strong className="text-foreground/80">soma das origens</strong> definida acima — campo travado.</p>
              )}

              {formTipoMeta === 'simples' ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Meta Receita</Label>
                  <CurrencyInput
                    value={formReceita}
                    onValueChange={handleReceitaChange}
                    disabled={formUsaMetaOrigem}
                    className={cn("h-10 text-sm rounded-lg border-border/60", formUsaMetaOrigem && "bg-muted/40 text-muted-foreground")}
                  />
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-400" /><Label className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Piso</Label></div>
                    <CurrencyInput value={formReceitaPiso} onValueChange={(v) => setFormReceitaPiso(v ?? 0)} className="h-10 text-sm rounded-lg border-amber-200 bg-amber-50/50 focus-visible:ring-amber-300" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500" /><Label className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Alvo</Label></div>
                    <CurrencyInput
                      value={formReceita}
                      onValueChange={handleReceitaChange}
                      disabled={formUsaMetaOrigem}
                      className={cn("h-10 text-sm rounded-lg border-emerald-200 bg-emerald-50/50 focus-visible:ring-emerald-300", formUsaMetaOrigem && "opacity-60")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-violet-500" /><Label className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">Super</Label></div>
                    <CurrencyInput value={formReceitaSuper} onValueChange={(v) => setFormReceitaSuper(v ?? 0)} className="h-10 text-sm rounded-lg border-violet-200 bg-violet-50/50 focus-visible:ring-violet-300" />
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
              {editingMeta ? "Salvar Alterações" : "Criar Meta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── RENDER ─────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      {/* ═══ PAGE HERO ═══ */}
      <PageHero
        icon={Target}
        title="Metas"
        subtitle="A projeção da sua receita até a meta — o quanto falta e o ritmo para chegar lá."
      />

      {/* ═══ SELETOR DE META + AÇÕES ═══ */}
      <div className="flex flex-col gap-4" data-tutorial="metas-header">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5" data-tutorial="metas-month">
              <Button variant="ghost" size="icon" disabled={!canGoPrev} onClick={() => canGoPrev && goToMeta(todasMetas[selectedIndex - 1].id)} className="h-8 w-8 rounded-lg shrink-0 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={isMetaSelectorOpen} onOpenChange={setIsMetaSelectorOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/60 transition-colors group cursor-pointer">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">{m.nome}</h1>
                    <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 rounded-2xl border-border/60 shadow-lg" align="start" sideOffset={8}>
                  <div className="px-4 pt-4 pb-2"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suas Metas</p></div>
                  <div className="max-h-[320px] overflow-y-auto px-2 pb-2">
                    {todasMetas.map((mt) => {
                      const isSelected = mt.id === m.id;
                      const pctR = Number(mt.pct_receita) || 0;
                      return (
                        <button
                          key={mt.id}
                          onClick={() => goToMeta(mt.id)}
                          className={cn("w-full text-left px-3 py-3 rounded-xl transition-all duration-150 flex items-start gap-3", isSelected ? "bg-foreground/[0.06] ring-1 ring-foreground/10" : "hover:bg-muted/50")}
                        >
                          <div className={cn("mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0", isSelected ? "bg-foreground text-background" : "bg-muted")}>
                            <Target className={cn("h-3.5 w-3.5", !isSelected && "text-muted-foreground")} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn("text-sm font-semibold truncate", isSelected ? "text-foreground" : "text-foreground/80")}>{mt.nome}</p>
                              {mt.ativo && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/60 shrink-0">Ativa</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground font-display tabular-nums">
                                {format(parseISO(mt.data_inicio), "dd/MM", { locale: ptBR })} — {format(parseISO(mt.data_fim), "dd/MM/yy", { locale: ptBR })}
                              </span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] font-semibold font-display tabular-nums" style={{ color: pctColor(pctR) }}>{fmtPct(pctR)}</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5 w-full">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pctR, 100)}%`, backgroundColor: pctColor(pctR) }} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <Button variant="ghost" size="icon" disabled={!canGoNext} onClick={() => canGoNext && goToMeta(todasMetas[selectedIndex + 1].id)} className="h-8 w-8 rounded-lg shrink-0 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-10 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-muted/50 border-border/60 text-muted-foreground capitalize">{m.periodo_tipo}</span>
              <span className="text-[11px] text-muted-foreground font-display tabular-nums">
                {format(parseISO(m.data_inicio), "dd/MM", { locale: ptBR })} — {format(parseISO(m.data_fim), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              {!m.ativo && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200/60">Encerrada</span>}
              {todasMetas.length > 1 && <span className="text-[10px] text-muted-foreground/50 font-display tabular-nums">{selectedIndex + 1} de {todasMetas.length}</span>}
            </div>
          </div>

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

        {/* Barra de tempo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            <span className="font-display tabular-nums font-medium">{diasRestantes}d restantes</span>
          </div>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all duration-700" style={{ width: `${progressoTempo}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground font-display tabular-nums font-medium">{progressoTempo}%</span>
        </div>
      </div>

      {/* ═══ A META (receita alvo) ═══ */}
      <TooltipProvider delayDuration={200}>
        <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden border-2 border-primary/20 bg-primary/[0.04]">
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center"><DollarSign className="h-4 w-4 text-primary" /></div>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Receita realizada</p>
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-3 w-3 cursor-help shrink-0 text-primary/30" /></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">Soma do valor fechado de todas as vendas no período da meta</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-baseline gap-2 mt-2 flex-wrap">
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-display tabular-nums">{fmtBRL(receitaT)}</p>
            <p className="text-[11px] text-muted-foreground font-display tabular-nums">
              {tipoMeta === 'niveis' ? `Alvo: ${fmtBRL(receitaAlvo)}` : `de ${fmtBRL(receitaAlvo)}`}
            </p>
            {!bateuMeta && faltaReceita > 0 && (
              <span className="text-[11px] font-semibold text-muted-foreground font-display tabular-nums ml-auto">Faltam {fmtBRL(faltaReceita)}</span>
            )}
          </div>

          {tipoMeta === 'niveis' && receitaSuper > 0 ? (
            (() => {
              const nivelBarColor = nivelAtingido === 'super' ? '#8b5cf6' : nivelAtingido === 'alvo' ? '#10b981' : nivelAtingido === 'piso' ? '#f59e0b' : '#ef4444';
              const nivelFill = Math.min((receitaT / receitaSuper) * 100, 100);
              const pisoPct = (receitaPiso / receitaSuper) * 100;
              const alvoPct = (receitaAlvo / receitaSuper) * 100;
              const nivelLabel = { super: 'Super Meta', alvo: 'Alvo', piso: 'Piso', none: '' }[nivelAtingido];
              const nivelBadgeColor = { super: 'bg-violet-50 text-violet-700 border-violet-200', alvo: 'bg-emerald-50 text-emerald-700 border-emerald-200', piso: 'bg-amber-50 text-amber-700 border-amber-200', none: '' }[nivelAtingido];
              return (
                <div className="mt-3 space-y-2">
                  <div className="relative h-2 bg-primary/10 rounded-full overflow-visible">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${nivelFill}%`, backgroundColor: nivelBarColor }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-amber-400 rounded-full z-10" style={{ left: `${pisoPct}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-emerald-500 rounded-full z-10" style={{ left: `${alvoPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground/50">
                      <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />Piso {fmtBRL(receitaPiso)}</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />Alvo {fmtBRL(receitaAlvo)}</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />Super {fmtBRL(receitaSuper)}</span>
                    </div>
                    {nivelAtingido !== 'none' && <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border font-display tabular-nums", nivelBadgeColor)}>{nivelLabel} atingida</span>}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-primary/10">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pctReceita, 100)}%`, backgroundColor: "hsl(var(--primary))" }} />
              </div>
              <span className={cn("text-[10px] font-bold font-display tabular-nums px-1.5 py-0.5 rounded-md border", pctBg(pctReceita))}>{fmtPct(pctReceita)}</span>
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* ═══ META POR ORIGEM (só aparece quando a meta tem valores por origem) ═══ */}
      {metaOrigensAcomp.length > 0 && (
        <div data-tutorial="metas-por-origem">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-muted"><Layers className="h-3.5 w-3.5 text-muted-foreground" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Meta por origem</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Receita realizada × alvo, em cada origem do lead — a soma bate com a meta total</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...metaOrigensAcomp]
              .sort((a, b) => (Number(b.meta_receita) || 0) - (Number(a.meta_receita) || 0))
              .map((row) => {
                const origemDef = origensDisponiveis.find((o) => o.id === row.origem);
                const pct = Number(row.pct_receita) || 0;
                return (
                  <div key={row.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", origemDef?.dot ?? "bg-muted-foreground")} />
                      <p className="text-xs font-semibold text-foreground">{origemDef?.label ?? row.origem}</p>
                      <span className={cn("ml-auto text-[10px] font-bold font-display tabular-nums px-1.5 py-0.5 rounded-md border", pctBg(pct))}>{fmtPct(pct)}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2.5">
                      <p className="text-base font-bold font-display tabular-nums text-foreground">{fmtBRL(Number(row.receita_total) || 0)}</p>
                      <p className="text-[11px] text-muted-foreground font-display tabular-nums">de {fmtBRL(Number(row.meta_receita) || 0)}</p>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor(pct) }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ═══ RECEITA NA MESA (projeção vinda dos agendamentos) ═══ */}
      <div data-tutorial="metas-receita-na-mesa">
        <ProjecaoFaturamento />
      </div>

      {/* ═══ GRÁFICO DE PROJEÇÃO (prédios de receita) ═══ */}
      <div data-tutorial="metas-projecao">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Projeção de receita</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Plano ideal (colunas) × o que você já realizou (linha) — acumulado, período a período</p>
            </div>
          </div>
          <div className="flex bg-muted/40 rounded-xl p-1 gap-0.5 w-fit">
            {([
              { value: 'dia', label: 'Dia' },
              { value: 'semana', label: 'Semana' },
              { value: 'mes', label: 'Mês' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setChartGran(value)}
                className={cn("px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all", chartGran === value ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          {projChart && projChart.target > 0 ? (
            <>
              {/* Resumo ideal vs real */}
              {projChart.inPeriod && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Ideal até hoje</p>
                    <p className="text-lg font-bold font-display tabular-nums text-foreground">{fmtBRL(projChart.idealHoje)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Você tem</p>
                    <p className="text-lg font-bold font-display tabular-nums" style={{ color: projChart.done >= projChart.idealHoje ? '#10b981' : '#ef4444' }}>{fmtBRL(projChart.done)}</p>
                  </div>
                  <div>
                    {projChart.done >= projChart.idealHoje
                      ? <span className="text-[11px] font-semibold text-emerald-600">No ritmo ou à frente</span>
                      : <span className="text-[11px] font-semibold text-red-500">{fmtBRL(projChart.idealHoje - projChart.done)} atrás do ideal</span>}
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Meta</p>
                    <p className="text-lg font-bold font-display tabular-nums text-primary">{fmtBRL(projChart.target)}</p>
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                  data={projChart.data}
                  margin={{ top: 24, right: 8, left: 0, bottom: 0 }}
                  barCategoryGap="18%"
                  onMouseMove={(s: any) => setHoverIdx(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <defs>
                    <linearGradient id="barPast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E85D24" stopOpacity={1} />
                      <stop offset="100%" stopColor="#F2915F" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="barFuture" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E85D24" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#E85D24" stopOpacity={0.12} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis
                    domain={[0, Math.ceil(projChart.target * 1.12)]}
                    tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={52}
                  />
                  <RechartsTooltip
                    cursor={false}
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      const periodo = chartGran === 'dia' ? 'do dia' : chartGran === 'semana' ? 'da semana' : 'do mês';
                      const temReal = p.realizado != null;
                      const aFrente = temReal && p.realizado >= p.ideal;
                      return (
                        <div className="bg-popover/95 backdrop-blur-sm border border-border/60 rounded-xl p-3 shadow-lg min-w-[210px]">
                          <p className="text-[11px] font-semibold text-foreground mb-2">{label}</p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#E85D24' }} />Meta acumulada</span>
                            <span className="text-[13px] font-bold font-display tabular-nums" style={{ color: '#E85D24' }}>{fmtBRL(p.ideal)}</span>
                          </div>
                          {temReal && (
                            <div className="flex items-center justify-between gap-4 mt-1">
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--foreground))' }} />Realizado</span>
                              <span className="text-[13px] font-bold font-display tabular-nums" style={{ color: aFrente ? '#10b981' : '#ef4444' }}>{fmtBRL(p.realizado)}</span>
                            </div>
                          )}
                          {temReal && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[10px] font-semibold font-display tabular-nums" style={{ color: aFrente ? '#10b981' : '#ef4444' }}>
                                {aFrente ? '▲' : '▼'} {fmtBRL(Math.abs(p.realizado - p.ideal))} {aFrente ? 'à frente' : 'atrás'}
                              </span>
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] text-muted-foreground/70">Meta {periodo}</span>
                              <span className="text-[11px] font-semibold font-display tabular-nums text-muted-foreground">{fmtBRL(p.idealInc)}</span>
                            </div>
                            {temReal && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] text-muted-foreground/70">Realizado {periodo}</span>
                                <span className="text-[11px] font-semibold font-display tabular-nums text-foreground">{fmtBRL(p.realInc)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {projChart.hojeLabel && (
                    <ReferenceLine x={projChart.hojeLabel} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5}
                      label={{ value: 'Hoje', position: 'top', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                  )}
                  <Bar dataKey="ideal" radius={[5, 5, 0, 0]} maxBarSize={72} isAnimationActive={false}>
                    {projChart.data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.isFuture ? "url(#barFuture)" : "url(#barPast)"}
                        fillOpacity={hoverIdx === null || hoverIdx === i ? 1 : 0.18}
                        style={{ transition: "fill-opacity 160ms ease" }}
                      />
                    ))}
                    {projChart.showLabels && <LabelList dataKey="ideal" content={<BarValueLabel />} />}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="realizado"
                    name="Realizado"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: 'hsl(var(--foreground))', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'hsl(var(--foreground))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 pl-1">
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(#E85D24,#F2915F)' }} /><span className="text-[10px] text-muted-foreground">Meta até hoje (esperado)</span></div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-primary/20" /><span className="text-[10px] text-muted-foreground">Meta a conquistar</span></div>
                <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-[3px] rounded-full" style={{ background: 'hsl(var(--foreground))' }} /><span className="text-[10px] text-muted-foreground">Realizado</span></div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3"><TrendingUp className="h-6 w-6 text-muted-foreground/40" /></div>
              <p className="text-sm font-medium text-muted-foreground">Defina uma receita-alvo para ver a projeção</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RITMO NECESSÁRIO ═══ */}
      <div data-tutorial="metas-ritmo">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-muted"><Flame className="h-3.5 w-3.5 text-muted-foreground" /></div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Ritmo necessário</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Quanto de receita você precisa gerar por dia e por semana para fechar a meta</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-primary/[0.03]" />
            <div className="absolute top-4 right-4"><div className="h-8 w-8 rounded-xl bg-white/[0.06] flex items-center justify-center"><Flame className="h-4 w-4 text-primary/80" /></div></div>
            <div className="relative">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Ritmo Necessário</p>
              <p className="text-[11px] text-white/50 mb-4">Para bater {tipoMeta === 'niveis' ? 'o alvo' : 'a meta'} de {fmtBRL(receitaAlvo)}</p>
              {bateuMeta ? (
                <p className="text-2xl font-extrabold text-emerald-400 font-display tabular-nums leading-none">Meta batida! 🎯</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Receita / dia</p>
                    <p className="text-xl font-extrabold text-white font-display tabular-nums leading-none">{fmtBRL(Number(m.receita_necessaria_por_dia) || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Receita / semana</p>
                    <p className="text-xl font-extrabold text-white font-display tabular-nums leading-none">{fmtBRL((Number(m.receita_necessaria_por_dia) || 0) * 7)}</p>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-white/30 mt-3">{diasRestantes}d restantes no período</p>
            </div>
          </div>

          <StatCard
            standalone
            icon={Target}
            dotColor={bateuMeta ? "#10b981" : undefined}
            label={bateuMeta ? "Meta batida" : "Falta para a meta"}
            value={bateuMeta ? "Meta atingida" : fmtBRL(faltaReceita)}
            sublabel={bateuMeta ? `+${fmtBRL(receitaT - receitaAlvo)} acima do alvo` : `de ${fmtBRL(receitaAlvo)} no total`}
          />
        </div>

        {/* Insight de projeção */}
        {projecaoReceita && projecaoReceita.temDados && !bateuMeta && (
          <div className="mt-3 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 border-l-4 border-l-primary relative overflow-hidden">
            <div className="absolute top-3 right-3"><div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="h-3.5 w-3.5 text-primary" /></div></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-1.5">Insight de Projeção</p>
            <p className="text-xs text-muted-foreground leading-relaxed pr-10">
              No ritmo atual, você fechará o período com ~<strong className="text-foreground">{fmtBRL(projecaoReceita.receitaProj)}</strong>
              {projecaoReceita.receitaProj >= receitaAlvo
                ? <> — <strong className="text-emerald-600">acima da meta</strong> em {fmtBRL(projecaoReceita.receitaProj - receitaAlvo)}.</>
                : <> — faltarão <strong className="text-red-600">{fmtBRL(receitaAlvo - projecaoReceita.receitaProj)}</strong> para bater a meta.</>}
              {Number(m.receita_necessaria_por_dia) > 0 && <> Para bater, precisa de <strong className="text-foreground">{fmtBRL(Number(m.receita_necessaria_por_dia))}/dia</strong>.</>}
            </p>
          </div>
        )}
      </div>

      {/* ═══ SIMULADOR ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-muted"><SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" /></div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Simulador — E se?</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Ajuste os parâmetros e veja o impacto na projeção do período atual</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="space-y-5">
              {[
                { label: "Leads por dia", value: simLeadsDia, set: setSimLeadsDia, min: 0, max: 50, step: 0.5, fmt: (v: number) => v.toString() },
                { label: "Taxa Qualificação", value: simTxMql, set: setSimTxMql, min: 1, max: 100, step: 1, fmt: (v: number) => `${v}%` },
                { label: "Taxa Agendamento", value: simTxAgend, set: setSimTxAgend, min: 1, max: 100, step: 1, fmt: (v: number) => `${v}%` },
                { label: "Taxa Conversão", value: simTxConv, set: setSimTxConv, min: 1, max: 100, step: 1, fmt: (v: number) => `${v}%` },
                { label: "Ticket Médio", value: simTicket, set: setSimTicket, min: 500, max: 50000, step: 500, fmt: (v: number) => fmtBRL(v) },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-muted-foreground">{s.label}</Label>
                    <span className="text-xs font-bold text-foreground font-display tabular-nums">{s.fmt(s.value)}</span>
                  </div>
                  <Slider value={[s.value]} onValueChange={(v) => s.set(v[0])} min={s.min} max={s.max} step={s.step} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {simulacao && (
              <>
                <div className="rounded-2xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] p-5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-primary/[0.03]" />
                  <div className="relative grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Receita Projetada</p>
                      <p className="text-2xl font-extrabold text-white font-display tabular-nums leading-none">{fmtBRL(simulacao.receita)}</p>
                      {(() => {
                        const pct = receitaAlvo > 0 ? Math.round((simulacao.receita / receitaAlvo) * 100) : 0;
                        return <p className={cn("text-[10px] mt-1 font-display tabular-nums font-bold", pct >= 100 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400")}>{pct}% da meta</p>;
                      })()}
                    </div>
                    <div>
                      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Fechamentos</p>
                      <p className="text-2xl font-extrabold text-primary font-display tabular-nums leading-none">{fmtNum(simulacao.fechamentos)}</p>
                      <p className="text-[10px] text-white/30 mt-1 font-display tabular-nums">Ticket: {fmtBRL(simulacao.fechamentos > 0 ? simulacao.receita / simulacao.fechamentos : 0)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: "Leads", val: simulacao.leads },
                      { label: "Qualificados", val: simulacao.mqls },
                      { label: "Agendamentos", val: simulacao.reunioes },
                      { label: "Fechamentos", val: simulacao.fechamentos },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-bold font-display tabular-nums">{fmtNum(row.val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {renderModal()}

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!deletingMetaId} onOpenChange={(o) => { if (!o) setDeletingMetaId(null); }}>
        <DialogContent className="w-[95vw] max-w-sm rounded-2xl border-border/60 p-0 gap-0">
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold text-foreground font-display">Excluir Meta</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-50 shrink-0"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-foreground font-medium mb-1">Tem certeza que deseja excluir esta meta?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Esta ação não pode ser desfeita. Todos os dados de acompanhamento associados serão perdidos.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="ghost" onClick={() => setDeletingMetaId(null)} className="h-9 rounded-lg text-xs font-medium text-muted-foreground px-4">Cancelar</Button>
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
