import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subMonths, isAfter, isBefore, startOfDay, endOfDay, isToday, isTomorrow, addDays, eachDayOfInterval, isSameDay, differenceInCalendarDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Settings2, List, BarChart3, Eye, EyeOff, Search, ChevronDown, Clock, MapPin, Video, Phone, MessageSquare, Edit2, RefreshCw, Check, X, Loader2, Trash2, TrendingUp, TrendingDown, Users, CheckCircle2, XCircle, AlertCircle, Stethoscope, ClipboardList, Scissors, RotateCcw, ChevronRight, Sparkles, ArrowRight, DollarSign, Tag, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { useAgendamentos, Agendamento, AgendamentoInput } from "@/hooks/useAgendamentos";
import { useProcedimentos } from "@/hooks/useProcedimentos";
import { useVendas } from "@/hooks/useVendas";
import { Lead } from "@/hooks/useLeads";
import { VendaModal } from "@/components/vendas/VendaModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";
import ConfigNotificacoes from "@/components/agendamentos/ConfigNotificacoes";
import { type Lembrete, chaveLembrete, antecedenciaMinutos, lembreteAtivoValido } from "@/lib/lembretes";
import { CurrencyInput } from "@/components/CurrencyInput";
import { PageHero } from "@/components/PageHero";
import AgendamentoFinanceiroConfig from "@/components/agendamentos/AgendamentoFinanceiroConfig";
import { TimeInput } from "@/components/ui/TimeInput";
import { useAgendamentoFinanceiroConfig } from "@/hooks/useAgendamentoFinanceiroConfig";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { StatCard, StatCardGrid } from "@/components/StatCard";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { aceitaProcedimento, isProcedimentoDeInteresse, labelProcedimento } from "@/lib/agendamentos";
import { ProjecaoFaturamento } from "@/components/agendamentos/ProjecaoFaturamento";

// ── Constants ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  agendado: "#6366f1",
  confirmado: "#0ea5e9",
  realizado: "#10b981",
  nao_compareceu: "#ef4444",
  cancelado: "#fca5a5",
  remarcado: "#f59e0b",
};

const STATUS_BG: Record<string, string> = {
  agendado: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
  confirmado: "bg-sky-50 text-sky-700 border-sky-200/60",
  realizado: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  nao_compareceu: "bg-red-50 text-red-700 border-red-200/60",
  cancelado: "bg-red-50/50 text-red-400 border-red-100/60",
  remarcado: "bg-amber-50 text-amber-700 border-amber-200/60",
};

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  nao_compareceu: "Não compareceu",
  cancelado: "Cancelado",
  remarcado: "Remarcado",
};

const TIPO_ICONS: Record<string, any> = {
  consulta: Stethoscope,
  procedimento: Scissors,
  retorno: RotateCcw,
};

const TIPO_LABELS: Record<string, string> = {
  consulta: "Consulta",
  procedimento: "Procedimento",
  retorno: "Retorno",
};

const CORES_PREDEFINIDAS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const TIPO_TITULOS: Record<string, string> = {
  consulta: "Consulta",
  procedimento: "Procedimento",
  retorno: "Retorno",
};
function defaultTitulo(tipo: string, leadNome: string) {
  return `${TIPO_TITULOS[tipo] ?? tipo} — ${leadNome}`;
}

const DURACOES_RAPIDAS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1h", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2h", value: 120 },
];

// ── Helpers ───────────────────────────────────────────────────

function getEventColor(ag: Agendamento): string {
  if (ag.status !== "agendado") return STATUS_COLORS[ag.status] || ag.cor;
  return ag.cor || "#3b82f6";
}

function formatDateTimeBR(isoStr: string) {
  const d = parseISO(isoStr);
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function formatTimeBR(isoStr: string) {
  const d = parseISO(isoStr);
  return format(d, "HH:mm");
}

function formatDateLabel(isoStr: string) {
  const d = parseISO(isoStr);
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

function toLocalDatetimeStr(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToISO(localStr: string): string {
  return new Date(localStr).toISOString();
}

// ── Main Component ────────────────────────────────────────────

export default function Agendamentos() {
  const { agendamentos, metricas, isLoading, criarAgendamento, atualizarAgendamento, deletarAgendamento, buscarNotificacoes, orgId } = useAgendamentos();
  const { profile } = useProfile();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(today), to: endOfMonth(today) });
  const [activeTab, setActiveTab] = useState("calendario");
  const [modalConfig, setModalConfig] = useState(false);
  const [modalFinanceiroConfig, setModalFinanceiroConfig] = useState(false);
  const { config: financeiroConfig } = useAgendamentoFinanceiroConfig();
  const { procedimentos } = useProcedimentos();
  const { vendas: vendasPeriodo } = useVendas(dateRange);
  const [modalCriar, setModalCriar] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalReagendar, setModalReagendar] = useState(false);
  const [modalRealizado, setModalRealizado] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [agendamentoExcluir, setAgendamentoExcluir] = useState<Agendamento | null>(null);
  const [modalDiaEventos, setModalDiaEventos] = useState<{ date: Date; agendamentos: Agendamento[] } | null>(null);

  // Filtros lista
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");

  // Filtros métricas
  const [filtroTipoKpis, setFiltroTipoKpis] = useState("todos");
  const [filtroTipoFunil, setFiltroTipoFunil] = useState("geral");

  // Form state
  const [form, setForm] = useState<AgendamentoInput>({
    titulo: "",
    data_hora_inicio: "",
    data_hora_fim: "",
    duracao_minutos: 60,
    tipo: "consulta",
    cor: "#3b82f6",
  });
  const [enviarConfirmacao, setEnviarConfirmacao] = useState(false);
  const [ativarFluxo, setAtivarFluxo] = useState(true);
  const [dataInicioForm, setDataInicioForm] = useState<Date | undefined>(undefined);
  const [horaInicioForm, setHoraInicioForm] = useState("08");
  const [minutoInicioForm, setMinutoInicioForm] = useState("00");
  const [isDatePickerFormOpen, setIsDatePickerFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);

  // Realizado form
  const [obsPos, setObsPos] = useState("");
  const [fechouProcedimento, setFechouProcedimento] = useState(false);
  const [vendaModalOpen, setVendaModalOpen] = useState(false);
  const [vendaLead, setVendaLead] = useState<Lead | null>(null);
  const [vendaInitialValues, setVendaInitialValues] = useState<{ produto_servico?: string; valor_fechado?: number; agendamento_id?: string; tipo_venda?: string } | undefined>(undefined);

  // Reagendar form
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  // Leads para autocomplete
  const { data: leadsOrg = [] } = useQuery({
    queryKey: ["leads-simple", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone")
        .eq("organization_id", orgId!)
        .order("nome");
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Notificações do agendamento selecionado
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadNotificacoes = useCallback(async (agId: string) => {
    try {
      const data = await buscarNotificacoes(agId);
      setNotificacoes(data);
    } catch { setNotificacoes([]); }
  }, [buscarNotificacoes]);

  // ── Computed data ──────────────────────────────────────────

  const agendamentosFiltrados = useMemo(() => {
    if (!dateRange?.from) return agendamentos;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return agendamentos.filter((ag) => {
      const d = parseISO(ag.data_hora_inicio);
      return !isBefore(d, from) && !isAfter(d, to);
    });
  }, [agendamentos, dateRange]);

  const metricasFiltradas = useMemo(() => {
    const list = agendamentosFiltrados;
    const realizados = list.filter((a) => a.status === "realizado").length;
    const noShow = list.filter((a) => a.status === "nao_compareceu").length;
    const cancelados = list.filter((a) => a.status === "cancelado").length;
    const base = realizados + noShow;

    // Métricas por tipo
    const consultas = list.filter((a) => a.tipo === "consulta");
    const procedimentos = list.filter((a) => a.tipo === "procedimento");
    const consultasRealizadas = consultas.filter((a) => a.status === "realizado").length;
    const procedimentosRealizados = procedimentos.filter((a) => a.status === "realizado").length;

    // Taxa conversão real: leads com consulta ou procedimento realizado (retornos excluídos) que têm venda no período
    const agendamentosRealizados = list.filter((a) => a.status === "realizado" && a.tipo !== "retorno");
    const leadsComAgendamentoRealizado = new Set(agendamentosRealizados.map((a) => a.lead_id).filter(Boolean));
    const vendasDeLeadsComAgendamento = vendasPeriodo.filter((v) => v.lead_id && leadsComAgendamentoRealizado.has(v.lead_id));
    const valorTotalVendas = vendasPeriodo.reduce((s, v) => s + (v.valor_fechado || 0), 0);
    const valorVendasConsulta = vendasDeLeadsComAgendamento.reduce((s, v) => s + (v.valor_fechado || 0), 0);
    const taxaConversaoConsulta = leadsComAgendamentoRealizado.size > 0
      ? Math.round((vendasDeLeadsComAgendamento.length / leadsComAgendamentoRealizado.size) * 100 * 10) / 10
      : 0;

    // Valor orçado nas consultas realizadas (estimativa de potencial)
    const valorTotalConsultas = consultas.filter((a) => a.status === "realizado").reduce((s, a) => s + (a.valor_orcado || 0), 0);
    const valorTotalProcedimentos = valorTotalVendas; // mantido por compatibilidade com renders existentes

    const now = new Date();
    const futuros = list.filter((a) => ["agendado", "confirmado"].includes(a.status) && parseISO(a.data_hora_inicio) > now).length;
    const passadoSemResultado = list.filter((a) => ["agendado", "confirmado"].includes(a.status) && parseISO(a.data_hora_inicio) <= now).length;

    return {
      total: list.length,
      realizados,
      no_show: noShow,
      cancelados,
      futuros,
      passadoSemResultado,
      taxa_comparecimento: base > 0 ? Math.round((realizados / base) * 100 * 10) / 10 : 0,
      taxa_no_show: base > 0 ? Math.round((noShow / base) * 100 * 10) / 10 : 0,
      consultas: consultas.length,
      consultasRealizadas,
      procedimentos: procedimentos.length,
      procedimentosRealizados,
      taxaConversaoConsulta,
      leadsConvertidos: vendasDeLeadsComAgendamento.length,
      leadsComConsultaRealizada: leadsComAgendamentoRealizado.size,
      vendasFechadas: vendasPeriodo.length,
      vendasDeLeadsComConsulta: vendasDeLeadsComAgendamento.length,
      valorTotalVendas,
      valorVendasConsulta,
      valorTotalConsultas,
      valorTotalProcedimentos,
    };
  }, [agendamentosFiltrados, vendasPeriodo]);

  // KPIs filtrados por tipo (para a row de cards)
  const metricasKpisVisiveis = useMemo(() => {
    const list = filtroTipoKpis === "todos"
      ? agendamentosFiltrados
      : agendamentosFiltrados.filter((a) => a.tipo === filtroTipoKpis);
    const realizados = list.filter((a) => a.status === "realizado").length;
    const noShow = list.filter((a) => a.status === "nao_compareceu").length;
    const cancelados = list.filter((a) => a.status === "cancelado").length;
    const base = realizados + noShow;
    const now = new Date();
    const futuros = list.filter((a) => ["agendado", "confirmado"].includes(a.status) && parseISO(a.data_hora_inicio) > now).length;
    const passadoSemResultado = list.filter((a) => ["agendado", "confirmado"].includes(a.status) && parseISO(a.data_hora_inicio) <= now).length;
    const leadsAtendidos = new Set(
      list.filter((a) => a.status === "realizado" && a.tipo !== "retorno").map((a) => a.lead_id).filter(Boolean)
    );
    const vendasDeLeads = vendasPeriodo.filter((v) => v.lead_id && leadsAtendidos.has(v.lead_id));
    const taxaConversao = leadsAtendidos.size > 0
      ? Math.round((vendasDeLeads.length / leadsAtendidos.size) * 100 * 10) / 10
      : 0;
    return {
      total: list.length,
      realizados,
      no_show: noShow,
      cancelados,
      futuros,
      passadoSemResultado,
      taxa_comparecimento: base > 0 ? Math.round((realizados / base) * 100 * 10) / 10 : 0,
      taxa_no_show: base > 0 ? Math.round((noShow / base) * 100 * 10) / 10 : 0,
      vendasDeLeads: vendasDeLeads.length,
      leadsAtendidos: leadsAtendidos.size,
      taxaConversao,
    };
  }, [agendamentosFiltrados, filtroTipoKpis, vendasPeriodo]);

  // Métricas do funil (filtrado por tipo internamente)
  const metricasFunil = useMemo(() => {
    const list = filtroTipoFunil === "geral"
      ? agendamentosFiltrados.filter((a) => a.tipo !== "retorno")
      : agendamentosFiltrados.filter((a) => a.tipo === filtroTipoFunil);
    const realizados = list.filter((a) => a.status === "realizado").length;
    const leadsAtendidos = new Set(list.filter((a) => a.status === "realizado").map((a) => a.lead_id).filter(Boolean));
    const vendasDeLeads = vendasPeriodo.filter((v) => v.lead_id && leadsAtendidos.has(v.lead_id));
    const valorVendas = vendasDeLeads.reduce((s, v) => s + (v.valor_fechado || 0), 0);
    const valorOrcado = list.filter((a) => a.status === "realizado").reduce((s, a) => s + (a.valor_orcado || 0), 0);
    const taxa = leadsAtendidos.size > 0
      ? Math.round((vendasDeLeads.length / leadsAtendidos.size) * 100 * 10) / 10
      : 0;
    return {
      realizados,
      leadsAtendidos: leadsAtendidos.size,
      vendasDeLeads: vendasDeLeads.length,
      totalVendas: vendasPeriodo.length,
      valorVendas,
      valorOrcado,
      taxa,
      isEmpty: realizados === 0,
    };
  }, [agendamentosFiltrados, filtroTipoFunil, vendasPeriodo]);

  // Próximos agendamentos (sidebar do calendário)
  const proximosAgendamentos = useMemo(() => {
    const now = new Date();
    return agendamentos
      .filter((ag) => parseISO(ag.data_hora_inicio) >= startOfDay(now) && ["agendado", "confirmado"].includes(ag.status))
      .sort((a, b) => parseISO(a.data_hora_inicio).getTime() - parseISO(b.data_hora_inicio).getTime())
      .slice(0, 5);
  }, [agendamentos]);

  // Agendamentos de hoje
  const agendamentosHoje = useMemo(() => {
    return agendamentos.filter((ag) => isToday(parseISO(ag.data_hora_inicio)));
  }, [agendamentos]);

  const calendarEvents = useMemo(() =>
    agendamentos.map((ag) => ({
      id: ag.id,
      title: ag.titulo,
      start: ag.data_hora_inicio,
      end: ag.data_hora_fim,
      backgroundColor: getEventColor(ag),
      borderColor: getEventColor(ag),
      extendedProps: { agendamento: ag },
    })),
    [agendamentos]
  );

  const listaFiltrada = useMemo(() => {
    let filtered = agendamentosFiltrados;
    if (filtroTipo !== "todos") filtered = filtered.filter((a) => a.tipo === filtroTipo);
    if (filtroStatus !== "todos") filtered = filtered.filter((a) => a.status === filtroStatus);
    if (filtroBusca) {
      const q = filtroBusca.toLowerCase();
      filtered = filtered.filter((a) => a.lead?.nome?.toLowerCase().includes(q) || a.titulo.toLowerCase().includes(q));
    }
    return filtered;
  }, [agendamentosFiltrados, filtroTipo, filtroStatus, filtroBusca]);

  // Métricas charts
  const tendenciaSemanal = useMemo(() => {
    const semanas: Record<string, number> = {};
    agendamentosFiltrados.forEach((ag) => {
      const d = parseISO(ag.data_hora_inicio);
      const inicio = startOfWeek(d, { locale: ptBR });
      const key = format(inicio, "dd/MM");
      semanas[key] = (semanas[key] || 0) + 1;
    });
    return Object.entries(semanas).slice(-8).map(([semana, total]) => ({ semana, total }));
  }, [agendamentosFiltrados]);

  const distribuicaoTipo = useMemo(() => {
    const tipos: Record<string, number> = {};
    agendamentosFiltrados.forEach((ag) => { tipos[ag.tipo] = (tipos[ag.tipo] || 0) + 1; });
    return Object.entries(tipos).map(([tipo, total]) => ({ tipo, total }));
  }, [agendamentosFiltrados]);

  const donutStatus = useMemo(() => {
    const s: Record<string, number> = {};
    agendamentosFiltrados.forEach((ag) => { s[ag.status] = (s[ag.status] || 0) + 1; });
    return Object.entries(s).map(([status, total]) => ({ status, label: STATUS_LABELS[status] || status, total, color: STATUS_COLORS[status] || "#999" }));
  }, [agendamentosFiltrados]);

  const comparecimentoMensal = useMemo(() => {
    const meses: Record<string, { realizados: number; total: number }> = {};
    agendamentosFiltrados.forEach((ag) => {
      if (!["realizado", "nao_compareceu"].includes(ag.status)) return;
      const key = format(parseISO(ag.data_hora_inicio), "MMM/yy", { locale: ptBR });
      if (!meses[key]) meses[key] = { realizados: 0, total: 0 };
      meses[key].total++;
      if (ag.status === "realizado") meses[key].realizados++;
    });
    return Object.entries(meses).slice(-6).map(([mes, v]) => ({
      mes,
      taxa: v.total > 0 ? Math.round((v.realizados / v.total) * 100) : 0,
    }));
  }, [agendamentosFiltrados]);

  const evolucaoDiaria = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const diffDias = differenceInCalendarDays(dateRange.to, dateRange.from);
    if (diffDias > 90) return [];
    return eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).map(day => {
      const dayAgs = agendamentosFiltrados.filter(ag => isSameDay(parseISO(ag.data_hora_inicio), day));
      return {
        label: format(day, "dd/MM"),
        total: dayAgs.length,
        realizados: dayAgs.filter(a => a.status === "realizado").length,
        noShow: dayAgs.filter(a => a.status === "nao_compareceu").length,
      };
    });
  }, [agendamentosFiltrados, dateRange]);

  const topLeads = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; realizados: number }>();
    agendamentosFiltrados.forEach(ag => {
      if (!ag.lead_id || !ag.lead?.nome) return;
      const ex = map.get(ag.lead_id) || { nome: ag.lead.nome, total: 0, realizados: 0 };
      map.set(ag.lead_id, { nome: ex.nome, total: ex.total + 1, realizados: ex.realizados + (ag.status === "realizado" ? 1 : 0) });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [agendamentosFiltrados]);

  // ── Actions ────────────────────────────────────────────────

  function resetForm() {
    setForm({ titulo: "", data_hora_inicio: "", data_hora_fim: "", duracao_minutos: 60, tipo: "consulta", cor: "#3b82f6", valor_orcado: financeiroConfig?.consulta_valor_padrao ?? undefined, procedimento_id: null, procedimento_interesse: null });
    setEnviarConfirmacao(false);
    setAtivarFluxo(true);
    setDataInicioForm(undefined);
    setHoraInicioForm("08");
    setMinutoInicioForm("00");
    setEditMode(false);
  }

  function openCriar(dateStr?: string) {
    resetForm();
    if (dateStr) {
      const inicio = dateStr.includes("T") ? dateStr.substring(0, 16) : `${dateStr}T09:00`;
      const d = new Date(new Date(inicio).getTime() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForm((f) => ({ ...f, data_hora_inicio: inicio, data_hora_fim: fim }));
    }
    setModalCriar(true);
  }

  function openDetalhes(ag: Agendamento) {
    setAgendamentoSelecionado(ag);
    loadNotificacoes(ag.id);
    setModalDetalhes(true);
  }

  function openEditar(ag: Agendamento) {
    setEditMode(true);
    const localInicio = toLocalDatetimeStr(ag.data_hora_inicio);
    setForm({
      lead_id: ag.lead_id,
      titulo: ag.titulo,
      descricao: ag.descricao,
      data_hora_inicio: localInicio,
      data_hora_fim: toLocalDatetimeStr(ag.data_hora_fim),
      duracao_minutos: ag.duracao_minutos,
      tipo: ag.tipo,
      local: ag.local,
      link_reuniao: ag.link_reuniao,
      cor: ag.cor,
      status: ag.status,
      valor_orcado: ag.valor_orcado,
      procedimento_id: ag.procedimento_id,
      procedimento_interesse: ag.procedimento_interesse,
    });
    parseFormDatetime(localInicio);
    setAgendamentoSelecionado(ag);
    setModalDetalhes(false);
    setModalCriar(true);
  }

  function buildFormDatetimeStr(date: Date, hora: string, minuto: string): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hora}:${minuto}`;
  }

  function handleFormDateChange(date: Date | undefined) {
    setDataInicioForm(date);
    setIsDatePickerFormOpen(false);
    if (!date) { setForm(f => ({ ...f, data_hora_inicio: "" })); return; }
    const str = buildFormDatetimeStr(date, horaInicioForm, minutoInicioForm);
    setForm(f => {
      const d = new Date(new Date(str).getTime() + (f.duracao_minutos || 60) * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { ...f, data_hora_inicio: str, data_hora_fim: fim };
    });
  }

  function handleFormHoraChange(hora: string) {
    setHoraInicioForm(hora);
    if (!dataInicioForm) return;
    const str = buildFormDatetimeStr(dataInicioForm, hora, minutoInicioForm);
    setForm(f => {
      const d = new Date(new Date(str).getTime() + (f.duracao_minutos || 60) * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { ...f, data_hora_inicio: str, data_hora_fim: fim };
    });
  }

  function handleFormMinutoChange(minuto: string) {
    setMinutoInicioForm(minuto);
    if (!dataInicioForm) return;
    const str = buildFormDatetimeStr(dataInicioForm, horaInicioForm, minuto);
    setForm(f => {
      const d = new Date(new Date(str).getTime() + (f.duracao_minutos || 60) * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { ...f, data_hora_inicio: str, data_hora_fim: fim };
    });
  }

  function parseFormDatetime(str: string) {
    if (!str) return;
    const d = new Date(str);
    if (isNaN(d.getTime())) return;
    setDataInicioForm(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setHoraInicioForm(String(d.getHours()).padStart(2, "0"));
    setMinutoInicioForm(String(d.getMinutes()).padStart(2, "0"));
  }

  function updateDuracao(inicio: string, minutos: number) {
    if (!inicio) return;
    const d = new Date(new Date(inicio).getTime() + minutos * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setForm((f) => ({ ...f, data_hora_fim: fim, duracao_minutos: minutos }));
  }

  async function handleSalvar() {
    if (!form.titulo || !form.data_hora_inicio || !form.data_hora_fim) {
      toast.error("Preencha título, data e hora.");
      return;
    }
    setFormLoading(true);
    const payload = {
      ...form,
      data_hora_inicio: localToISO(form.data_hora_inicio),
      data_hora_fim: localToISO(form.data_hora_fim),
    };
    try {
      if (editMode && agendamentoSelecionado) {
        await atualizarAgendamento.mutateAsync({ id: agendamentoSelecionado.id, ...payload });
        toast.success("Agendamento atualizado!");
      } else {
        const novo = await criarAgendamento.mutateAsync(payload);
        if (form.lead_id) {
          await supabase.from("leads").update({ is_scheduled: true }).eq("id", form.lead_id);
        }
        if (!ativarFluxo && novo?.id && orgId) {
          const { data: cfg } = await supabase
            .from("agendamento_config_notificacoes")
            .select("notif_ativa, lembretes")
            .eq("organization_id", orgId)
            .single();
          const lembretes: Lembrete[] =
            cfg?.notif_ativa && Array.isArray(cfg?.lembretes) ? (cfg.lembretes as Lembrete[]) : [];
          const ativos = lembretes.filter(lembreteAtivoValido);
          if (ativos.length > 0) {
            const dataInicioDate = new Date(novo.data_hora_inicio);
            await supabase.from("agendamento_notificacoes").insert(
              ativos.map((l) => ({
                agendamento_id: novo.id,
                organization_id: orgId,
                tipo_destinatario: "lead",
                canal: "whatsapp",
                antecedencia_minutos: antecedenciaMinutos(l, dataInicioDate),
                chave_lembrete: chaveLembrete(l),
                status: "cancelado",
                data_hora_envio: new Date().toISOString(),
              }))
            );
          }
        }
        toast.success("Agendamento criado!");
      }
      setModalCriar(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    }
    setFormLoading(false);
  }

  async function handleStatusChange(ag: Agendamento, novoStatus: string) {
    if (novoStatus === "realizado") {
      setAgendamentoSelecionado(ag);
      setObsPos("");
      setFechouProcedimento(false);
      setModalDetalhes(false);
      setModalRealizado(true);
      return;
    }
    if (novoStatus === "remarcado") {
      setAgendamentoSelecionado(ag);
      setNovaData("");
      setNovaHora("");
      setModalDetalhes(false);
      setModalReagendar(true);
      return;
    }
    try {
      await atualizarAgendamento.mutateAsync({ id: ag.id, titulo: ag.titulo, data_hora_inicio: ag.data_hora_inicio, data_hora_fim: ag.data_hora_fim, status: novoStatus });
      toast.success(`Status alterado para ${STATUS_LABELS[novoStatus]}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleMarcarRealizado() {
    if (!agendamentoSelecionado) return;
    setFormLoading(true);
    try {
      await atualizarAgendamento.mutateAsync({
        id: agendamentoSelecionado.id,
        titulo: agendamentoSelecionado.titulo,
        data_hora_inicio: agendamentoSelecionado.data_hora_inicio,
        data_hora_fim: agendamentoSelecionado.data_hora_fim,
        status: "realizado",
        observacoes_pos: obsPos || null,
      });
      toast.success("Atendimento marcado como realizado!");
      setModalRealizado(false);
      if (fechouProcedimento && agendamentoSelecionado.lead) {
        const isConsulta = agendamentoSelecionado.tipo === "consulta";
        setVendaLead({
          id: agendamentoSelecionado.lead.id,
          nome: agendamentoSelecionado.lead.nome,
          telefone: agendamentoSelecionado.lead.telefone ?? null,
          lead_scoring: agendamentoSelecionado.lead.lead_scoring ?? null,
        } as Lead);
        setVendaInitialValues({
          agendamento_id: agendamentoSelecionado.id,
          tipo_venda: isConsulta ? "consulta" : "procedimento",
          produto_servico: isConsulta ? "Consulta" : (agendamentoSelecionado.procedimento_interesse ?? undefined),
          valor_fechado: isConsulta ? (agendamentoSelecionado.valor_orcado ?? undefined) : undefined,
        });
        setVendaModalOpen(true);
      }
      setFechouProcedimento(false);
    } catch (err: any) {
      toast.error(err.message);
    }
    setFormLoading(false);
  }

  async function handleReagendar() {
    if (!agendamentoSelecionado || !novaData || !novaHora) {
      toast.error("Preencha a nova data e hora.");
      return;
    }
    setFormLoading(true);
    try {
      await atualizarAgendamento.mutateAsync({
        id: agendamentoSelecionado.id,
        titulo: agendamentoSelecionado.titulo,
        data_hora_inicio: agendamentoSelecionado.data_hora_inicio,
        data_hora_fim: agendamentoSelecionado.data_hora_fim,
        status: "remarcado",
      });
      const novoInicioLocal = `${novaData}T${novaHora}`;
      const novoInicioISO = localToISO(novoInicioLocal);
      const dFim = new Date(new Date(novoInicioLocal).getTime() + (agendamentoSelecionado.duracao_minutos || 60) * 60 * 1000);
      const novoFimISO = dFim.toISOString();
      await criarAgendamento.mutateAsync({
        lead_id: agendamentoSelecionado.lead_id,
        usuario_id: agendamentoSelecionado.usuario_id,
        titulo: agendamentoSelecionado.titulo,
        descricao: agendamentoSelecionado.descricao,
        data_hora_inicio: novoInicioISO,
        data_hora_fim: novoFimISO,
        duracao_minutos: agendamentoSelecionado.duracao_minutos,
        tipo: agendamentoSelecionado.tipo,
        local: agendamentoSelecionado.local,
        link_reuniao: agendamentoSelecionado.link_reuniao,
        cor: agendamentoSelecionado.cor,
      });
      toast.success("Agendamento remarcado com sucesso!");
      setModalReagendar(false);
    } catch (err: any) {
      toast.error(err.message);
    }
    setFormLoading(false);
  }

  async function handleEventDrop(info: any) {
    const ag = info.event.extendedProps.agendamento as Agendamento;
    const newStart = info.event.start?.toISOString();
    const newEnd = info.event.end?.toISOString() || new Date(info.event.start!.getTime() + (ag.duracao_minutos || 60) * 60 * 1000).toISOString();
    try {
      await atualizarAgendamento.mutateAsync({ id: ag.id, titulo: ag.titulo, data_hora_inicio: newStart!, data_hora_fim: newEnd });
      toast.success("Agendamento movido!");
    } catch {
      info.revert();
      toast.error("Erro ao mover agendamento.");
    }
  }

  // ── Loading skeleton ───────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-96 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-48 rounded-xl" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  }

  // ── Greeting ───────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profile?.nome_completo?.split(" ")[0] || "Usuário";

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 overflow-hidden">

      {/* ═══════════════ HERO HEADER ═══════════════ */}
      <PageHero
        dataTutorial="agendamentos-header"
        icon={CalendarDays}
        title={`${greeting}, ${firstName}`}
        subtitle={
          (agendamentosHoje.length > 0
            ? `Você tem ${agendamentosHoje.length} agendamento${agendamentosHoje.length !== 1 ? 's' : ''} hoje`
            : "Nenhum agendamento para hoje") +
          (metricasFiltradas.total > 0 ? ` · ${metricasFiltradas.total} no período` : '')
        }
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalFinanceiroConfig(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-white/70 bg-white/10 border border-white/15 hover:bg-white/15 hover:text-white transition-all"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Financeiro
            </button>
            <button
              onClick={() => setModalConfig(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-white/70 bg-white/10 border border-white/15 hover:bg-white/15 hover:text-white transition-all"
              data-tutorial="agendamentos-config"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Notificações
            </button>
            <button
              onClick={() => openCriar()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-all"
              data-tutorial="agendamentos-new"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Agendamento
            </button>
          </div>
        }
      />

      {/* Quick stats — dados de HOJE */}
      {(() => {
        const now = new Date();
        const hojeRealizados = agendamentosHoje.filter((a) => a.status === "realizado").length;
        const hojePendentes = agendamentosHoje.filter((a) => ["agendado", "confirmado"].includes(a.status) && parseISO(a.data_hora_inicio) > now).length;
        const hojeNoShow = agendamentosHoje.filter((a) => a.status === "nao_compareceu").length;
        const hojeBase = hojeRealizados + hojeNoShow;
        const hojeComparecimento = hojeBase > 0 ? Math.round((hojeRealizados / hojeBase) * 100) : null;
        return (
          <div data-tutorial="agendamentos-status">
            <StatCardGrid cols={4}>
              <StatCard label="Hoje" value={formatInt(agendamentosHoje.length)} sublabel="agendamentos" dotColor="#3b82f6" />
              <StatCard label="Realizados" value={formatInt(hojeRealizados)} sublabel="compareceram" dotColor="#10b981" />
              <StatCard label="Pendentes" value={formatInt(hojePendentes)} sublabel="ainda por vir" dotColor="#6366f1" />
              {hojeComparecimento !== null ? (
                <StatCard label="Comparecimento" value={formatPct(hojeComparecimento, 0)} sublabel="taxa do dia" dotColor="#8b5cf6" />
              ) : (
                <StatCard label="No-show" value={formatInt(hojeNoShow)} sublabel="não compareceram" dotColor="#ef4444" />
              )}
            </StatCardGrid>
          </div>
        );
      })()}

      {/* ═══════════════ TAB NAVIGATION ═══════════════ */}
      <div className="flex items-center justify-between gap-4" data-tutorial="agendamentos-tabs">
        <div className="flex rounded-xl bg-muted/40 border border-border/40 p-1 gap-0.5">
          {[
            { value: "calendario", label: "Calendário", icon: CalendarDays },
            { value: "lista", label: "Lista", icon: List },
            { value: "metricas", label: "Métricas", icon: BarChart3 },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all",
                activeTab === value
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {(activeTab === "lista" || activeTab === "metricas") && (
          <div data-tutorial="agendamentos-filters">
            <DateRangePicker date={dateRange} setDate={setDateRange} className="" />
          </div>
        )}
      </div>

      {/* ═══════════════ CALENDÁRIO TAB ═══════════════ */}
      {activeTab === "calendario" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          {/* Calendar main */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="agendamentos-calendar">
            <div className="p-5">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridDay"
                locale={ptBrLocale}
                headerToolbar={{
                  left: "prev,today,next",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                events={calendarEvents}
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={3}
                height="auto"
                moreLinkClick={(info) => {
                  // FullCalendar passes UTC midnight — convert to local midnight to avoid off-by-one in BRT
                  const localDate = new Date(info.date.getUTCFullYear(), info.date.getUTCMonth(), info.date.getUTCDate());
                  const dayAgs = agendamentos.filter(ag =>
                    isSameDay(parseISO(ag.data_hora_inicio), localDate)
                  ).sort((a, b) => parseISO(a.data_hora_inicio).getTime() - parseISO(b.data_hora_inicio).getTime());
                  // Defer state update so FullCalendar finishes mounting its Popover before React re-renders
                  // (avoids "getBoundingClientRect of null" crash — reference element gets destroyed on re-render)
                  setTimeout(() => setModalDiaEventos({ date: localDate, agendamentos: dayAgs }), 0);
                }}
                nowIndicator={true}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                slotDuration="00:30:00"
                slotLabelInterval="01:00:00"
                slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                allDaySlot={false}
                eventDrop={handleEventDrop}
                eventClick={(info) => {
                  const ag = info.event.extendedProps.agendamento as Agendamento;
                  openDetalhes(ag);
                }}
                dateClick={(info) => openCriar(info.dateStr)}
                eventContent={(arg) => {
                  const ag = arg.event.extendedProps.agendamento as Agendamento;
                  const TipoIcon = TIPO_ICONS[ag?.tipo] || CalendarDays;
                  const bgColor = arg.event.backgroundColor || "#3b82f6";
                  const isTimeGrid = arg.view.type.startsWith("timeGrid");
                  const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

                  if (isTimeGrid) {
                    const startStr = arg.event.start ? formatTime(arg.event.start) : "";
                    const endStr = arg.event.end ? formatTime(arg.event.end) : "";
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col gap-0 px-2 py-1.5 overflow-hidden text-white w-full h-full cursor-pointer">
                              <span className="font-semibold text-[11px] truncate">{arg.event.title}</span>
                              <span className="text-[10px] opacity-80">{startStr} – {endStr}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="rounded-lg">
                            <p className="font-medium text-xs">{ag?.lead?.nome || arg.event.title}</p>
                            <p className="text-[10px] text-muted-foreground">{TIPO_LABELS[ag?.tipo] || ag?.tipo} · {STATUS_LABELS[ag?.status]}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="flex items-center gap-1 px-1.5 py-0.5 overflow-hidden text-[11px] text-white w-full cursor-pointer rounded"
                            style={{ backgroundColor: bgColor }}
                          >
                            <TipoIcon className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate font-medium">{arg.event.title}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="rounded-lg">
                          <p className="font-medium text-xs">{ag?.lead?.nome || arg.event.title}</p>
                          <p className="text-[10px] text-muted-foreground">{TIPO_LABELS[ag?.tipo] || ag?.tipo} · {STATUS_LABELS[ag?.status]}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4" data-tutorial="agendamentos-upcoming">

            {/* Card — Resumo do dia */}
            {(() => {
              const now = new Date();
              const hojeTotal = agendamentosHoje.length;
              const hojeRealizados = agendamentosHoje.filter((a) => a.status === "realizado").length;
              const hojePendentes = agendamentosHoje.filter((a) => ["agendado", "confirmado"].includes(a.status) && parseISO(a.data_hora_inicio) > now).length;
              const hojeNoShow = agendamentosHoje.filter((a) => a.status === "nao_compareceu").length;
              const hojeCancelados = agendamentosHoje.filter((a) => a.status === "cancelado").length;
              const progressPct = hojeTotal > 0 ? Math.round((hojeRealizados / hojeTotal) * 100) : 0;
              const proximoHoje = agendamentosHoje
                .filter((a) => ["agendado", "confirmado"].includes(a.status) && parseISO(a.data_hora_inicio) > now)
                .sort((a, b) => parseISO(a.data_hora_inicio).getTime() - parseISO(b.data_hora_inicio).getTime())[0];

              return (
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-muted">
                          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Hoje</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5 capitalize">{format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                        </div>
                      </div>
                      <span className="text-2xl font-extrabold font-display text-foreground tabular-nums">{hojeTotal}</span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {/* Barra de progresso */}
                    {hojeTotal > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-muted-foreground">Progresso do dia</span>
                          <span className="text-[11px] font-bold text-emerald-600 font-display tabular-nums">{progressPct}%</span>
                        </div>
                        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Status breakdown */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Realizados", value: hojeRealizados, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100/60" },
                        { label: "Pendentes", value: hojePendentes, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100/60" },
                        { label: "No-show", value: hojeNoShow, color: "text-red-500", bg: "bg-red-50 border-red-100/60" },
                        { label: "Cancelados", value: hojeCancelados, color: "text-muted-foreground", bg: "bg-muted/30 border-border/30" },
                      ].map((s) => (
                        <div key={s.label} className={cn("rounded-xl border p-2.5 text-center", s.bg)}>
                          <p className={cn("text-lg font-extrabold font-display tabular-nums leading-none", s.color)}>{s.value}</p>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Próximo da fila */}
                    {proximoHoje && (
                      <button
                        onClick={() => openDetalhes(proximoHoje)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left border border-border/40"
                      >
                        <div className="w-1 h-8 rounded-full shrink-0 bg-indigo-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 mb-0.5">Próximo</p>
                          <p className="text-[12px] font-semibold text-foreground truncate font-display">{proximoHoje.lead?.nome || proximoHoje.titulo}</p>
                          <p className="text-[10px] text-muted-foreground font-display tabular-nums">{formatTimeBR(proximoHoje.data_hora_inicio)} · {proximoHoje.duracao_minutos}min</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                      </button>
                    )}

                    {hojeTotal === 0 && (
                      <div className="py-4 text-center">
                        <p className="text-[11px] text-muted-foreground/40">Nenhum agendamento hoje</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Card — Próximos agendamentos */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-muted">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próximos</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Agendamentos futuros confirmados</p>
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-1">
                {proximosAgendamentos.length === 0 ? (
                  <div className="py-8 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/15 mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground/40">Nenhum agendamento futuro</p>
                  </div>
                ) : (
                  proximosAgendamentos.map((ag) => {
                    const TipoIcon = TIPO_ICONS[ag.tipo] || CalendarDays;
                    return (
                      <button
                        key={ag.id}
                        onClick={() => openDetalhes(ag)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                      >
                        <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: getEventColor(ag) }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-bold font-display tabular-nums text-muted-foreground">{formatTimeBR(ag.data_hora_inicio)}</span>
                            <span className="text-[9px] text-muted-foreground/30">·</span>
                            <span className="text-[10px] text-muted-foreground/60">{formatDateLabel(ag.data_hora_inicio)}</span>
                          </div>
                          <p className="text-[12px] font-semibold text-foreground truncate font-display">{ag.lead?.nome || ag.titulo}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <TipoIcon className="h-2.5 w-2.5 text-muted-foreground/40" />
                            <span className="text-[10px] text-muted-foreground/50">{TIPO_LABELS[ag.tipo] || ag.tipo}{ag.duracao_minutos ? ` · ${ag.duracao_minutos}min` : ""}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 shrink-0 transition-colors" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ LISTA TAB ═══════════════ */}
      {activeTab === "lista" && (
        <div className="space-y-5">

          {/* Filtros — tipo + status + busca */}
          <div className="space-y-2.5">

            {/* Linha 1: tipo + busca */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { value: "todos", label: "Todos" },
                  { value: "consulta", label: "Consultas" },
                  { value: "procedimento", label: "Procedimentos" },
                  { value: "retorno", label: "Retornos" },
                ].map((opt) => {
                  const count = opt.value === "todos"
                    ? agendamentosFiltrados.length
                    : agendamentosFiltrados.filter((a) => a.tipo === opt.value).length;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFiltroTipo(opt.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors",
                        filtroTipo === opt.value
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                      )}
                    >
                      {opt.label}
                      <span className={cn("text-[9px] font-bold font-display tabular-nums px-1 rounded", filtroTipo === opt.value ? "bg-background/20" : "bg-muted")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                <Input
                  placeholder="Buscar por lead ou título..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg border-border/60"
              />
              </div>
            </div>

            {/* Linha 2: filtro por status — contagens escopadas pelo tipo selecionado */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(() => {
                const baseTipo = filtroTipo === "todos"
                  ? agendamentosFiltrados
                  : agendamentosFiltrados.filter((a) => a.tipo === filtroTipo);
                return [
                  { value: "todos", label: "Todos os status", color: null },
                  { value: "agendado", label: "Agendado", color: STATUS_COLORS.agendado },
                  { value: "confirmado", label: "Confirmado", color: STATUS_COLORS.confirmado },
                  { value: "realizado", label: "Realizado", color: STATUS_COLORS.realizado },
                  { value: "nao_compareceu", label: "Não compareceu", color: STATUS_COLORS.nao_compareceu },
                  { value: "cancelado", label: "Cancelado", color: STATUS_COLORS.cancelado },
                  { value: "remarcado", label: "Remarcado", color: STATUS_COLORS.remarcado },
                ].map((opt) => {
                const count = opt.value === "todos"
                  ? baseTipo.length
                  : baseTipo.filter((a) => a.status === opt.value).length;
                const isActive = filtroStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFiltroStatus(opt.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors",
                      isActive
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                    )}
                  >
                    {opt.color && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                    )}
                    {opt.label}
                    <span className={cn("text-[9px] font-bold font-display tabular-nums px-1 rounded", isActive ? "bg-background/20" : "bg-muted")}>
                      {count}
                    </span>
                  </button>
                );
              });
              })()}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-left px-5 py-3.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Lead</th>
                    <th className="text-left px-5 py-3.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Data / Hora</th>
                    <th className="text-left px-5 py-3.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Tipo</th>
                    <th className="text-left px-5 py-3.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="text-left px-5 py-3.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Duração</th>
                    <th className="text-right px-5 py-3.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {listaFiltrada.map((ag) => {
                    const TipoIcon = TIPO_ICONS[ag.tipo] || CalendarDays;
                    return (
                      <tr key={ag.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {(ag.lead?.nome || ag.titulo || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold text-foreground font-display">{ag.lead?.nome || ag.titulo}</p>
                              {ag.lead?.telefone && (
                                <p className="text-[10px] text-muted-foreground/50">{ag.lead.telefone}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[12px] font-medium text-foreground">{format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy", { locale: ptBR })}</p>
                          <p className="text-[10px] text-muted-foreground font-display tabular-nums">{formatTimeBR(ag.data_hora_inicio)} – {formatTimeBR(ag.data_hora_fim)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <TipoIcon className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-[11px] font-medium text-muted-foreground">{TIPO_LABELS[ag.tipo] ?? ag.tipo}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors",
                                STATUS_BG[ag.status] || "bg-muted text-muted-foreground border-border/40"
                              )}>
                                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[ag.status] }} />
                                {STATUS_LABELS[ag.status] || ag.status}
                                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl">
                              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <DropdownMenuItem key={k} onClick={() => handleStatusChange(ag, k)} className="text-xs">
                                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: STATUS_COLORS[k] }} />
                                  {v}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[11px] text-muted-foreground font-display tabular-nums">{ag.duracao_minutos}min</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openDetalhes(ag)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => openEditar(ag)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setAgendamentoExcluir(ag)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {listaFiltrada.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="bg-muted/30 p-5 rounded-2xl inline-block mb-3">
                          <CalendarDays className="h-8 w-8 text-muted-foreground/20" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground/60">Nenhum agendamento encontrado</p>
                        <p className="text-[11px] text-muted-foreground/40 mt-1">Tente ajustar os filtros ou crie um novo agendamento</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MÉTRICAS TAB ═══════════════ */}
      {activeTab === "metricas" && (
        <div className="space-y-5" data-tutorial="agendamentos-metrics">

          {/* ═══ Projeção de faturamento ═══ */}
          <div data-tutorial="agendamentos-projecao">
            <ProjecaoFaturamento />
          </div>

          {/* ═══ KPIs — filtro por tipo ═══ */}
          <div className="space-y-3">
            {/* Pills filtro */}
            <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl p-1 w-fit">
              {[
                { value: "todos", label: "Todos" },
                { value: "consulta", label: "Consultas" },
                { value: "procedimento", label: "Procedimentos" },
                { value: "retorno", label: "Retornos" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFiltroTipoKpis(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                    filtroTipoKpis === opt.value
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  label: "Total", value: metricasKpisVisiveis.total,
                  sub: filtroTipoKpis === "todos" ? "agendamentos no período" : `${filtroTipoKpis}s no período`, icon: CalendarDays,
                },
                {
                  label: "Realizados", value: metricasKpisVisiveis.realizados,
                  sub: `${metricasKpisVisiveis.taxa_comparecimento}% de comparecimento`, icon: CheckCircle2, accent: true,
                },
                {
                  label: "No-show", value: metricasKpisVisiveis.no_show,
                  sub: `${metricasKpisVisiveis.taxa_no_show}% taxa`, icon: XCircle, danger: metricasKpisVisiveis.taxa_no_show > 20,
                },
                {
                  label: "Cancelados", value: metricasKpisVisiveis.cancelados,
                  sub: "no período", icon: X,
                },
                {
                  label: "Futuros", value: metricasKpisVisiveis.futuros,
                  sub: metricasKpisVisiveis.passadoSemResultado > 0
                    ? `+${metricasKpisVisiveis.passadoSemResultado} passados sem resultado`
                    : "agendados/confirmados", icon: Clock,
                  future: true,
                  passadoSemResultado: metricasKpisVisiveis.passadoSemResultado,
                },
                {
                  label: "Conversão Real", value: `${metricasKpisVisiveis.taxaConversao}%`,
                  sub: `${metricasKpisVisiveis.vendasDeLeads} de ${metricasKpisVisiveis.leadsAtendidos} leads atendidos`, icon: ArrowRight,
                },
              ].map((kpi: any) => (
                <div
                  key={kpi.label}
                  className={cn(
                    "rounded-2xl px-4 py-3.5 border transition-colors",
                    kpi.accent
                      ? "bg-emerald-50/60 border-emerald-200/50"
                      : kpi.danger
                      ? "bg-red-50/60 border-red-200/50"
                      : kpi.future
                      ? "bg-indigo-50/60 border-indigo-200/50"
                      : "bg-card border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <kpi.icon className={cn("h-3 w-3", kpi.accent ? "text-emerald-600" : kpi.danger ? "text-red-500" : kpi.future ? "text-indigo-500" : "text-muted-foreground")} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</span>
                  </div>
                  <p className={cn("text-lg font-extrabold tracking-tight font-display tabular-nums leading-none", kpi.accent ? "text-emerald-700" : kpi.danger ? "text-red-600" : kpi.future ? "text-indigo-700" : "text-foreground")}>
                    {kpi.value}
                  </p>
                  <p className={cn("text-[10px] mt-1 leading-tight", kpi.passadoSemResultado > 0 ? "text-amber-600/80" : "text-muted-foreground/60")}>{kpi.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Evolução + Status ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

            {/* Evolução diária */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /></span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">EVOLUÇÃO DE AGENDAMENTOS</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Agendamentos e realizados por dia no período</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {evolucaoDiaria.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px]">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3"><BarChart3 className="h-6 w-6 text-muted-foreground/30" /></div>
                    <p className="text-sm font-medium text-muted-foreground">Selecione um período de até 90 dias</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={evolucaoDiaria} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="agGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                      <XAxis dataKey="label" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={24} />
                      <RechartsTooltip
                        cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="rounded-xl border border-border/60 bg-card shadow-[0_4px_16px_rgba(0,0,0,0.08)] px-3.5 py-2.5 min-w-[130px]">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
                              {payload.map((p: any) => (
                                <div key={p.dataKey} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.stroke }} />
                                    <span className="text-[11px] text-muted-foreground">{p.dataKey === "total" ? "Agendados" : "Realizados"}</span>
                                  </div>
                                  <span className="text-[13px] font-bold font-display tabular-nums text-foreground">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#agGradient)" dot={false} name="total" />
                      <Area type="monotone" dataKey="realizados" stroke="#10b981" strokeWidth={2} fill="url(#realGradient)" dot={false} name="realizados" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Distribuição por Status — barras horizontais */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /></span>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">POR STATUS</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {donutStatus.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <p className="text-[11px] text-muted-foreground/40">Sem dados no período</p>
                  </div>
                ) : (
                  donutStatus.sort((a, b) => b.total - a.total).map(s => {
                    const pct = metricasFiltradas.total > 0 ? Math.round((s.total / metricasFiltradas.total) * 100) : 0;
                    return (
                      <div key={s.status}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-[11px] font-medium text-foreground">{s.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold font-display tabular-nums text-foreground">{s.total}</span>
                            <span className="text-[10px] text-muted-foreground/50 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ═══ Funil Consulta→Procedimento + Tipos ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Funil de conversão */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">FUNIL AGENDAMENTO → FECHAMENTO</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Taxa de conversão de leads no período</p>
                    </div>
                  </div>
                  {/* Pills internas */}
                  <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
                    {[
                      { value: "geral", label: "Geral" },
                      { value: "consulta", label: "Consultas" },
                      { value: "procedimento", label: "Proced." },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFiltroTipoFunil(opt.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all",
                          filtroTipoFunil === opt.value
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5">
                {metricasFunil.isEmpty ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3"><TrendingUp className="h-6 w-6 text-muted-foreground/30" /></div>
                    <p className="text-sm font-medium text-muted-foreground">Sem agendamentos realizados no período</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: "Agendamentos realizados", value: metricasFunil.realizados, color: "#6366f1", bg: "bg-indigo-50", text: "text-indigo-700" },
                      { label: "Leads únicos atendidos", value: metricasFunil.leadsAtendidos, color: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" },
                      { label: "Leads que fecharam venda", value: metricasFunil.vendasDeLeads, color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700" },
                    ].map((step, i, arr) => {
                      const base = arr[0].value || 1;
                      const pct = Math.round((step.value / base) * 100);
                      return (
                        <div key={step.label}>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", step.bg)}>
                              <span className={cn("text-[11px] font-bold", step.text)}>{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium text-foreground">{step.label}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[13px] font-bold font-display tabular-nums text-foreground">{step.value}</span>
                                  {i > 0 && <span className="text-[10px] text-muted-foreground/50">{pct}%</span>}
                                </div>
                              </div>
                              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {metricasFunil.leadsAtendidos > 0 && (
                      <div className="mt-4 p-3.5 rounded-xl bg-amber-50/60 border border-amber-100/60 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-amber-700">Taxa de conversão real (CRM)</p>
                          <p className="text-[10px] text-amber-600/70 mt-0.5">{metricasFunil.vendasDeLeads} vendas de {metricasFunil.leadsAtendidos} leads atendidos</p>
                        </div>
                        <span className="text-2xl font-extrabold font-display tabular-nums text-amber-700">{metricasFunil.taxa}%</span>
                      </div>
                    )}
                    {(metricasFunil.valorOrcado > 0 || metricasFunil.valorVendas > 0) && (
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Valor orçado</p>
                          <p className="text-sm font-extrabold font-display text-foreground tabular-nums">
                            {metricasFunil.valorOrcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100/60">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-1">Receita real (CRM)</p>
                          <p className="text-sm font-extrabold font-display text-amber-700 tabular-nums">
                            {metricasFunil.valorVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Top Leads */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted"><Users className="h-3.5 w-3.5 text-muted-foreground" /></span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TOP LEADS</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Leads com mais agendamentos no período</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {topLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3"><Users className="h-6 w-6 text-muted-foreground/30" /></div>
                    <p className="text-sm font-medium text-muted-foreground">Sem agendamentos vinculados a leads</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {topLeads.map((lead, i) => {
                      const maxTotal = topLeads[0]?.total || 1;
                      const pct = Math.round((lead.total / maxTotal) * 100);
                      return (
                        <div key={lead.nome} className="flex items-center gap-3 group">
                          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-muted-foreground">{lead.nome[0]?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-medium text-foreground truncate">{lead.nome}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] text-emerald-600 font-semibold inline-flex items-center gap-0.5">{lead.realizados}<Check className="h-2.5 w-2.5" /></span>
                                <span className="text-[12px] font-bold font-display tabular-nums text-foreground">{lead.total}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                              <div className="h-full bg-foreground/20 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ═══════════════ MODAL CRIAR/EDITAR ═══════════════ */}
      <Dialog open={modalCriar} onOpenChange={(o) => { if (!o) { setModalCriar(false); resetForm(); } }}>
        <DialogContent data-tutorial="agendamento-modal" className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-border/60 p-0">
          {/* Modal header */}
          <div className="px-6 pt-6 pb-4 border-b border-border/40">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold tracking-tight font-display">
                {editMode ? "Editar Agendamento" : "Novo Agendamento"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-[11px] text-muted-foreground mt-1">
              {editMode ? "Atualize os dados do agendamento" : "Preencha os dados para criar um novo agendamento"}
            </p>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Lead select — searchable */}
            <div data-tutorial="agendamento-field-lead" className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lead</Label>
              <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center justify-between w-full h-10 px-3 rounded-lg border border-border/60 bg-background text-sm transition-colors hover:bg-muted/30",
                      !form.lead_id && "text-muted-foreground"
                    )}
                  >
                    {form.lead_id ? (
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-muted-foreground">
                            {(leadsOrg.find((l) => l.id === form.lead_id)?.nome || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="truncate font-medium text-foreground">
                          {leadsOrg.find((l) => l.id === form.lead_id)?.nome || "Lead selecionado"}
                        </span>
                      </div>
                    ) : (
                      <span>Buscar lead...</span>
                    )}
                    <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start" onWheel={(e) => e.stopPropagation()}>
                  <Command className="rounded-xl" shouldFilter={true}>
                    <CommandInput placeholder="Pesquisar por nome..." className="h-10 text-sm" />
                    <CommandList className="max-h-[260px] overflow-y-auto [&>[cmdk-list-sizer]]:overflow-visible">
                      <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">Nenhum lead encontrado</CommandEmpty>
                      <CommandGroup>
                        {leadsOrg.map((l) => (
                          <CommandItem
                            key={l.id}
                            value={l.nome || l.id}
                            onSelect={() => {
                              setForm((f) => ({ ...f, lead_id: l.id, titulo: defaultTitulo(f.tipo || "consulta", l.nome || "") }));
                              setLeadPopoverOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                          >
                            <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-muted-foreground">{(l.nome || "?")[0].toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{l.nome}</p>
                              {l.telefone && <p className="text-[10px] text-muted-foreground/50">{(() => {
                                let p = l.telefone.replace(/\D/g, '');
                                if (p.startsWith('55') && p.length >= 12) p = p.slice(2);
                                if (p.length === 11) return `(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`;
                                if (p.length === 10) return `(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}`;
                                return l.telefone;
                              })()}</p>}
                            </div>
                            {form.lead_id === l.id && <Check className="h-3.5 w-3.5 ml-auto text-foreground shrink-0" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Título */}
            <div data-tutorial="agendamento-field-titulo" className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Consulta - Maria Silva"
                className="rounded-lg border-border/60 h-10"
              />
            </div>

            {/* Tipo + Duração */}
            <div className="grid grid-cols-2 gap-4">
              <div data-tutorial="agendamento-field-tipo" className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => {
                  const leadNome = leadsOrg.find((l) => l.id === form.lead_id)?.nome || "";
                  const valorPadrao = v === "consulta" ? (financeiroConfig?.consulta_valor_padrao ?? undefined) : undefined;
                  setForm((f) => ({
                    ...f,
                    tipo: v,
                    titulo: defaultTitulo(v, leadNome),
                    procedimento_id: aceitaProcedimento(v) ? f.procedimento_id : null,
                    procedimento_interesse: aceitaProcedimento(v) ? f.procedimento_interesse : null,
                    valor_orcado: valorPadrao,
                  }));
                }}>
                  <SelectTrigger className="rounded-lg border-border/60 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(TIPO_LABELS).map(([k, v]) => {
                      const Icon = TIPO_ICONS[k] || CalendarDays;
                      return (
                        <SelectItem key={k} value={k}>
                          <div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{v}</div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div data-tutorial="agendamento-field-duracao" className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Duração</Label>
                <div className="flex gap-1.5">
                  {DURACOES_RAPIDAS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => {
                        setForm((f) => ({ ...f, duracao_minutos: d.value }));
                        updateDuracao(form.data_hora_inicio, d.value);
                      }}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[10px] font-semibold border transition-all",
                        form.duracao_minutos === d.value
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background text-muted-foreground border-border/60 hover:border-border hover:bg-muted/30"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Data/hora */}
            <div data-tutorial="agendamento-field-data" className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" /> Data e Hora de Início
              </Label>
              <div className="flex gap-2">
                <Popover open={isDatePickerFormOpen} onOpenChange={setIsDatePickerFormOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal h-10 rounded-lg text-sm border-border/60",
                        !dataInicioForm && "text-muted-foreground/50"
                      )}
                    >
                      <CalendarDays className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {dataInicioForm
                        ? format(dataInicioForm, "EEE, dd 'de' MMM", { locale: ptBR })
                        : "Selecionar data"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-border/60" align="start">
                    <Calendar
                      mode="single"
                      selected={dataInicioForm}
                      onSelect={handleFormDateChange}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <TimeInput
                  hora={horaInicioForm}
                  minuto={minutoInicioForm}
                  onChange={(h, m) => { handleFormHoraChange(h); handleFormMinutoChange(m); }}
                />
              </div>
            </div>


            {/* Seletor de procedimento — em consulta/avaliação é apenas "de interesse" */}
            {aceitaProcedimento(form.tipo) && (
              <div className="space-y-1.5" data-tutorial="agendamento-field-procedimento">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {labelProcedimento(form.tipo)}
                </Label>
                {procedimentos.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <p className="text-[11px] text-muted-foreground/60">Nenhum procedimento cadastrado</p>
                  </div>
                ) : (
                  <Select
                    value={form.procedimento_id || ""}
                    onValueChange={(v) => {
                      const proc = procedimentos.find((p) => p.id === v);
                      if (!proc) return;
                      const leadNome = leadsOrg.find((l) => l.id === form.lead_id)?.nome || "";
                      const soInteresse = isProcedimentoDeInteresse(form.tipo);
                      setForm((f) => ({
                        ...f,
                        procedimento_id: proc.id,
                        // mantido em sincronia com a FK enquanto o campo legado existir
                        procedimento_interesse: proc.nome,
                        // Numa consulta o procedimento é só interesse: não toca em título,
                        // valor nem duração — o valor_orcado ali é o valor da consulta.
                        ...(soInteresse ? {} : {
                          titulo: `${proc.nome} — ${leadNome}`,
                          valor_orcado: proc.valor_base ?? f.valor_orcado,
                          duracao_minutos: proc.duracao_minutos ?? f.duracao_minutos,
                        }),
                      }));
                    }}
                  >
                    <SelectTrigger className="rounded-lg border-border/60 h-10"><SelectValue placeholder="Selecionar procedimento..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {procedimentos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{p.nome}</span>
                            {p.valor_base && <span className="text-muted-foreground/60 text-[11px]">R$ {p.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Valor orçado */}
            {(form.tipo === "consulta" || form.tipo === "procedimento") && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {form.tipo === "consulta" ? "Valor da Consulta (R$)" : "Valor Orçado (R$)"}
                </Label>
                <CurrencyInput
                  value={form.valor_orcado}
                  onValueChange={(v) => setForm((f) => ({ ...f, valor_orcado: v ?? null }))}
                  className="h-10 text-sm rounded-lg border-border/60"
                />
              </div>
            )}

            {/* Descrição */}
            <div data-tutorial="agendamento-field-obs" className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</Label>
              <Textarea
                value={form.descricao || ""}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes adicionais sobre o agendamento..."
                rows={3}
                className="rounded-lg border-border/60 resize-none text-sm"
              />
            </div>

            {!editMode && (
              <button
                type="button"
                onClick={() => setAtivarFluxo((v) => !v)}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors text-left",
                  ativarFluxo
                    ? "border-blue-200/80 bg-blue-50/60"
                    : "border-border/40 bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2.5">
                  {ativarFluxo
                    ? <Bell className="h-4 w-4 text-blue-500 shrink-0" />
                    : <BellOff className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  }
                  <div>
                    <p className={cn("text-[13px] font-medium", ativarFluxo ? "text-foreground" : "text-muted-foreground")}>
                      Ativar fluxo de notificações
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {ativarFluxo
                        ? "O lead receberá os lembretes automáticos configurados"
                        : "Nenhuma notificação será enviada para este agendamento"}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "h-5 w-9 rounded-full transition-colors relative shrink-0",
                  ativarFluxo ? "bg-blue-500" : "bg-muted-foreground/20"
                )}>
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    ativarFluxo ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2 bg-muted/10">
            <Button variant="ghost" onClick={() => { setModalCriar(false); resetForm(); }} className="text-xs font-semibold rounded-lg">
              Cancelar
            </Button>
            <Button
              data-tutorial="agendamento-submit"
              onClick={handleSalvar}
              disabled={formLoading}
              className="text-xs font-semibold rounded-lg gap-2 bg-foreground text-background hover:bg-foreground/90 px-5"
            >
              {formLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
              {editMode ? "Salvar Alterações" : "Criar Agendamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MODAL DETALHES ═══════════════ */}
      <Dialog open={modalDetalhes} onOpenChange={setModalDetalhes}>
        <DialogContent className="max-w-lg rounded-2xl border-border/60 p-0 overflow-hidden">
          {agendamentoSelecionado && (() => {
            const ag = agendamentoSelecionado;
            const TipoIcon = TIPO_ICONS[ag.tipo] || CalendarDays;
            return (
              <>
                {/* Color accent bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: getEventColor(ag) }} />

                <div className="p-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-foreground tracking-tight font-display">{ag.titulo}</h2>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border",
                          STATUS_BG[ag.status] || "bg-muted text-muted-foreground border-border/40"
                        )}>
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[ag.status] }} />
                          {STATUS_LABELS[ag.status] || ag.status}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <TipoIcon className="h-3 w-3" />{TIPO_LABELS[ag.tipo] || ag.tipo}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Lead</span>
                      <p className="text-[13px] font-semibold text-foreground mt-1 font-display">{ag.lead?.nome || "Sem lead"}</p>
                      {ag.lead?.telefone && <p className="text-[10px] text-muted-foreground">{ag.lead.telefone}</p>}
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Data / Hora</span>
                      <p className="text-[13px] font-semibold text-foreground mt-1 font-display tabular-nums">{format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy")}</p>
                      <p className="text-[10px] text-muted-foreground font-display tabular-nums">{formatTimeBR(ag.data_hora_inicio)} – {formatTimeBR(ag.data_hora_fim)} · {ag.duracao_minutos}min</p>
                    </div>
                  </div>

                  {/* Description */}
                  {ag.descricao && (
                    <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Observações</span>
                      <p className="text-[12px] text-foreground/80 mt-1 leading-relaxed">{ag.descricao}</p>
                    </div>
                  )}

                  {ag.observacoes_pos && (
                    <div className="rounded-xl bg-emerald-50/50 border border-emerald-200/40 p-3.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">Pós-reunião</span>
                      <p className="text-[12px] text-emerald-800 mt-1 leading-relaxed">{ag.observacoes_pos}</p>
                    </div>
                  )}

                  {/* Notifications */}
                  {notificacoes.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lembretes</span>
                      <div className="space-y-1 mt-2">
                        {notificacoes.map((n) => (
                          <div key={n.id} className="text-[11px] flex items-center gap-2 text-muted-foreground py-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full", n.status === "enviado" ? "bg-emerald-500" : "bg-red-500")} />
                            {n.antecedencia_minutos}min antes — {n.status} {n.enviado_em ? `em ${format(parseISO(n.enviado_em), "dd/MM HH:mm")}` : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Status selector */}
                  <div className="rounded-xl border border-border/60 bg-muted/[0.03] p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Alterar Status</p>
                    <Select value={ag.status} onValueChange={(v) => handleStatusChange(ag, v)}>
                      <SelectTrigger className="h-9 text-xs rounded-lg border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[k] }} />
                              {v}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="px-6 py-4 border-t border-border/40 flex items-center gap-2 bg-muted/10 flex-wrap">
                  <button
                    onClick={() => openEditar(ag)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground bg-background border border-border/60 hover:bg-muted/50 transition-colors"
                  >
                    <Edit2 className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => handleStatusChange(ag, "remarcado")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground bg-background border border-border/60 hover:bg-muted/50 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" /> Reagendar
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleStatusChange(ag, "cancelado")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200/60 hover:bg-red-100/80 transition-colors"
                  >
                    <X className="h-3 w-3" /> Cancelar
                  </button>
                  <button
                    onClick={() => handleStatusChange(ag, "realizado")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Check className="h-3 w-3" /> Realizado
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MODAL REALIZADO ═══════════════ */}
      <Dialog open={modalRealizado} onOpenChange={(o) => { setModalRealizado(o); if (!o) setFechouProcedimento(false); }}>
        <DialogContent className="max-w-md rounded-2xl border-border/60 p-0 gap-0 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">CONFIRMAR REALIZAÇÃO</p>
                {agendamentoSelecionado && (
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate max-w-[280px]">{agendamentoSelecionado.titulo}</p>
                )}
              </div>
            </div>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações pós-atendimento</Label>
              <Textarea
                value={obsPos}
                onChange={(e) => setObsPos(e.target.value)}
                placeholder="Como foi o atendimento? Quais os próximos passos com esse lead?"
                rows={3}
                className="rounded-lg border-border/60 resize-none text-sm"
              />
            </div>

            {/* Registrar receita — label adapta ao tipo do agendamento */}
            {(() => {
              const isConsulta = agendamentoSelecionado?.tipo === "consulta";
              const isProcedimento = agendamentoSelecionado?.tipo === "procedimento";
              const temValorOrcado = (agendamentoSelecionado?.valor_orcado ?? 0) > 0;
              const label = isConsulta
                ? "Cobrou pela consulta?"
                : isProcedimento
                  ? "Registrar venda do procedimento?"
                  : "Registrar receita?";
              const sublabel = fechouProcedimento
                ? `Abre o registro de ${isConsulta ? "consulta" : "venda"} automaticamente ao confirmar`
                : isConsulta && temValorOrcado
                  ? `Pré-preenche com R$ ${Number(agendamentoSelecionado!.valor_orcado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : "Marque para registrar uma venda ao confirmar";
              return (
                <button
                  type="button"
                  onClick={() => setFechouProcedimento(v => !v)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left",
                    fechouProcedimento
                      ? isConsulta
                        ? "bg-blue-50 border-blue-200 text-blue-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-muted/30 border-border/30 text-foreground hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                    fechouProcedimento
                      ? isConsulta ? "bg-blue-600 border-blue-600" : "bg-emerald-600 border-emerald-600"
                      : "border-border bg-background"
                  )}>
                    {fechouProcedimento && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">{sublabel}</p>
                  </div>
                  <DollarSign className={cn(
                    "h-4 w-4 shrink-0",
                    fechouProcedimento
                      ? isConsulta ? "text-blue-400" : "text-emerald-500"
                      : "text-muted-foreground/40"
                  )} />
                </button>
              );
            })()}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="ghost" onClick={() => { setModalRealizado(false); setFechouProcedimento(false); }} className="h-9 text-xs font-medium rounded-lg px-4">Cancelar</Button>
            <Button
              className={cn(
                "h-9 text-xs font-semibold rounded-lg gap-1.5 px-5",
                fechouProcedimento
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-foreground hover:bg-foreground/90 text-background"
              )}
              onClick={handleMarcarRealizado}
              disabled={formLoading}
            >
              {formLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {fechouProcedimento
                ? agendamentoSelecionado?.tipo === "consulta"
                  ? "Confirmar e Cobrar Consulta"
                  : "Confirmar e Registrar Venda"
                : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MODAL VENDA (pós-realizado) ═══════════════ */}
      <VendaModal
        open={vendaModalOpen}
        onOpenChange={(o) => { setVendaModalOpen(o); if (!o) setVendaInitialValues(undefined); }}
        lead={vendaLead}
        initialValues={vendaInitialValues}
        onSaved={() => { setVendaModalOpen(false); setVendaInitialValues(undefined); }}
      />

      {/* ═══════════════ MODAL REAGENDAR ═══════════════ */}
      <Dialog open={modalReagendar} onOpenChange={setModalReagendar}>
        <DialogContent className="max-w-md rounded-2xl border-border/60">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Reagendar</DialogTitle>
          </DialogHeader>
          {agendamentoSelecionado && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/30 border border-border/30 p-3.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Data Original</span>
                <p className="text-sm font-medium text-foreground mt-1">{formatDateTimeBR(agendamentoSelecionado.data_hora_inicio)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nova Data</Label>
                  <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="rounded-lg border-border/60 h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nova Hora</Label>
                  <Input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} className="rounded-lg border-border/60 h-10" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalReagendar(false)} className="text-xs font-semibold rounded-lg">Cancelar</Button>
            <Button onClick={handleReagendar} disabled={formLoading} className="text-xs font-semibold rounded-lg gap-2 bg-foreground text-background hover:bg-foreground/90">
              {formLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MODAL DIA — todos os eventos ═══════════════ */}
      <Dialog open={!!modalDiaEventos} onOpenChange={(o) => { if (!o) setModalDiaEventos(null); }}>
        <DialogContent className="max-w-sm p-0 rounded-2xl border-border/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">AGENDAMENTOS DO DIA</p>
                {modalDiaEventos && (
                  <p className="text-[13px] font-semibold text-foreground mt-0.5">
                    {format(modalDiaEventos.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {modalDiaEventos?.agendamentos.map((ag) => {
              const TipoIcon = TIPO_ICONS[ag.tipo] || CalendarDays;
              const bgColor = STATUS_COLORS[ag.status] || ag.cor || "#6366f1";
              return (
                <button
                  key={ag.id}
                  onClick={() => { openDetalhes(ag); setModalDiaEventos(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left group"
                >
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: bgColor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-foreground truncate font-display">{ag.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TipoIcon className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/60">{formatTimeBR(ag.data_hora_inicio)}</span>
                      {ag.lead?.nome && <span className="text-[10px] text-muted-foreground/50 truncate">· {ag.lead.nome}</span>}
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0", STATUS_BG[ag.status])}>
                    {STATUS_LABELS[ag.status]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{modalDiaEventos?.agendamentos.length} agendamento{modalDiaEventos?.agendamentos.length !== 1 ? "s" : ""}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { if (modalDiaEventos) openCriar(format(modalDiaEventos.date, "yyyy-MM-dd")); setModalDiaEventos(null); }}
              className="h-7 text-[11px] gap-1.5"
            >
              <Plus className="h-3 w-3" /> Novo agendamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MODAL CONFIG NOTIFICAÇÕES ═══════════════ */}
      <ConfigNotificacoes isOpen={modalConfig} onClose={() => setModalConfig(false)} />
      <AgendamentoFinanceiroConfig isOpen={modalFinanceiroConfig} onClose={() => setModalFinanceiroConfig(false)} />

      {/* ═══════════════ CONFIRMAR EXCLUSÃO ═══════════════ */}
      <AlertDialog open={!!agendamentoExcluir} onOpenChange={(o) => { if (!o) setAgendamentoExcluir(null); }}>
        <AlertDialogContent className="rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold">Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Tem certeza que deseja excluir "{agendamentoExcluir?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-xs font-semibold">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold" onClick={async () => {
              if (!agendamentoExcluir) return;
              try {
                await deletarAgendamento.mutateAsync(agendamentoExcluir.id);
                toast.success("Agendamento excluído!");
              } catch (err: any) { toast.error(err.message); }
              setAgendamentoExcluir(null);
            }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
