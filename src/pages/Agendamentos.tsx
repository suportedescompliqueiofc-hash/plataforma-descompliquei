import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subMonths, isAfter, isBefore, startOfDay, endOfDay, isToday, isTomorrow, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Settings2, List, BarChart3, Eye, EyeOff, Search, ChevronDown, Clock, MapPin, Video, Phone, MessageSquare, Edit2, RefreshCw, Check, X, Loader2, Trash2, TrendingUp, TrendingDown, Users, CheckCircle2, XCircle, AlertCircle, Stethoscope, ClipboardList, Scissors, RotateCcw, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
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
import { useAgendamentos, Agendamento, AgendamentoInput } from "@/hooks/useAgendamentos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";
import ConfigNotificacoes from "@/components/agendamentos/ConfigNotificacoes";
import { DateRangePicker } from "@/components/reports/DateRangePicker";

// ── Constants ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  agendado: "#3b82f6",
  confirmado: "#10b981",
  realizado: "#6b7280",
  nao_compareceu: "#ef4444",
  cancelado: "#fca5a5",
  remarcado: "#f59e0b",
};

const STATUS_BG: Record<string, string> = {
  agendado: "bg-blue-50 text-blue-700 border-blue-200/60",
  confirmado: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  realizado: "bg-gray-50 text-gray-600 border-gray-200/60",
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
  avaliacao: ClipboardList,
  procedimento: Scissors,
  retorno: RotateCcw,
};

const TIPO_LABELS: Record<string, string> = {
  consulta: "Consulta",
  avaliacao: "Avaliação",
  procedimento: "Procedimento",
  retorno: "Retorno",
};

const CORES_PREDEFINIDAS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

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
  const [modalCriar, setModalCriar] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalReagendar, setModalReagendar] = useState(false);
  const [modalRealizado, setModalRealizado] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [agendamentoExcluir, setAgendamentoExcluir] = useState<Agendamento | null>(null);

  // Filtros lista
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");

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
  const [formLoading, setFormLoading] = useState(false);
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);

  // Realizado form
  const [obsPos, setObsPos] = useState("");
  const [leadAvancou, setLeadAvancou] = useState(false);

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
    return {
      total: list.length,
      realizados,
      no_show: noShow,
      cancelados,
      taxa_comparecimento: base > 0 ? Math.round((realizados / base) * 100 * 10) / 10 : 0,
      taxa_no_show: base > 0 ? Math.round((noShow / base) * 100 * 10) / 10 : 0,
    };
  }, [agendamentosFiltrados]);

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
    if (filtroStatus !== "todos") filtered = filtered.filter((a) => a.status === filtroStatus);
    if (filtroBusca) {
      const q = filtroBusca.toLowerCase();
      filtered = filtered.filter((a) => a.lead?.nome?.toLowerCase().includes(q) || a.titulo.toLowerCase().includes(q));
    }
    return filtered;
  }, [agendamentosFiltrados, filtroStatus, filtroBusca]);

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

  // ── Actions ────────────────────────────────────────────────

  function resetForm() {
    setForm({ titulo: "", data_hora_inicio: "", data_hora_fim: "", duracao_minutos: 60, tipo: "consulta", cor: "#3b82f6" });
    setEnviarConfirmacao(false);
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
    setForm({
      lead_id: ag.lead_id,
      titulo: ag.titulo,
      descricao: ag.descricao,
      data_hora_inicio: toLocalDatetimeStr(ag.data_hora_inicio),
      data_hora_fim: toLocalDatetimeStr(ag.data_hora_fim),
      duracao_minutos: ag.duracao_minutos,
      tipo: ag.tipo,
      local: ag.local,
      link_reuniao: ag.link_reuniao,
      cor: ag.cor,
      status: ag.status,
    });
    setAgendamentoSelecionado(ag);
    setModalDetalhes(false);
    setModalCriar(true);
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
      setLeadAvancou(false);
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
      toast.success("Consulta marcada como realizada!");
      setModalRealizado(false);
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
      <div className="space-y-8 max-w-full overflow-hidden">
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
    <div className="space-y-6 max-w-full overflow-hidden">

      {/* ═══════════════ HERO HEADER ═══════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1a1a1a] p-6 md:p-8" data-tutorial="agendamentos-header">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.01]" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight font-display">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-white/50 mt-1">
              {agendamentosHoje.length > 0
                ? `Você tem ${agendamentosHoje.length} agendamento${agendamentosHoje.length !== 1 ? 's' : ''} hoje`
                : "Nenhum agendamento para hoje"
              }
              {metricasFiltradas.total > 0 && ` · ${metricasFiltradas.total} no período`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalConfig(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-white/60 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] hover:text-white/80 transition-all"
              data-tutorial="agendamentos-config"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Notificações
            </button>
            <button
              onClick={() => openCriar()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-[#1a1a1a] hover:bg-white/90 transition-all shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
              data-tutorial="agendamentos-new"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Agendamento
            </button>
          </div>
        </div>

        {/* Quick stats inside hero */}
        {metricasFiltradas.total > 0 && (
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-6" data-tutorial="agendamentos-status">
            {[
              { label: "Agendados", value: metricasFiltradas.total, color: "#3b82f6" },
              { label: "Realizados", value: metricasFiltradas.realizados, color: "#10b981" },
              { label: "No-show", value: metricasFiltradas.no_show, color: "#ef4444" },
              { label: "Comparecimento", value: `${metricasFiltradas.taxa_comparecimento}%`, color: "#8b5cf6" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/[0.06] border border-white/[0.08] px-4 py-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">{stat.label}</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stat.color }} />
                  <span className="text-lg font-bold text-white tabular-nums">{stat.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                initialView="dayGridMonth"
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

          {/* Sidebar — Próximos agendamentos */}
          <div className="space-y-4" data-tutorial="agendamentos-upcoming">
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-muted">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próximos</h3>
                    <p className="text-[10px] text-muted-foreground/50">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-1.5">
                {proximosAgendamentos.length === 0 ? (
                  <div className="py-8 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/15 mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground/40">Nenhum agendamento futuro</p>
                  </div>
                ) : (
                  proximosAgendamentos.map((ag) => {
                    const TipoIcon = TIPO_ICONS[ag.tipo] || CalendarDays;
                    const initials = (ag.lead?.nome || ag.titulo || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                    return (
                      <button
                        key={ag.id}
                        onClick={() => openDetalhes(ag)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                      >
                        {/* Color bar + time */}
                        <div className="flex flex-col items-center gap-1 pt-0.5">
                          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: getEventColor(ag) }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                              {formatTimeBR(ag.data_hora_inicio)}
                            </span>
                            <span className="text-[9px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatDateLabel(ag.data_hora_inicio)}
                            </span>
                          </div>
                          <p className="text-[12px] font-semibold text-foreground truncate">{ag.lead?.nome || ag.titulo}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <TipoIcon className="h-2.5 w-2.5 text-muted-foreground/50" />
                            <span className="text-[10px] text-muted-foreground/60">{TIPO_LABELS[ag.tipo] || ag.tipo}</span>
                            {ag.duracao_minutos && (
                              <>
                                <span className="text-[10px] text-muted-foreground/30">·</span>
                                <span className="text-[10px] text-muted-foreground/60">{ag.duracao_minutos}min</span>
                              </>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors mt-1.5" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Today summary */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Resumo de Hoje</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center">
                  <span className="text-xl font-bold text-foreground tabular-nums">{agendamentosHoje.length}</span>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Agendados</p>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center">
                  <span className="text-xl font-bold text-foreground tabular-nums">
                    {agendamentosHoje.filter((a) => a.status === "realizado").length}
                  </span>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Realizados</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ LISTA TAB ═══════════════ */}
      {activeTab === "lista" && (
        <div className="space-y-5">
          {/* Filtros */}
          <div className="flex items-center gap-3">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[180px] h-9 text-xs rounded-lg border-border/60">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[k] }} />
                      {v}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input
                placeholder="Buscar por lead ou título..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg border-border/60"
              />
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
                              <p className="text-[12px] font-semibold text-foreground">{ag.lead?.nome || ag.titulo}</p>
                              {ag.lead?.telefone && (
                                <p className="text-[10px] text-muted-foreground/50">{ag.lead.telefone}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[12px] font-medium text-foreground">{format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy", { locale: ptBR })}</p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">{formatTimeBR(ag.data_hora_inicio)} – {formatTimeBR(ag.data_hora_fim)}</p>
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
                          <span className="text-[11px] text-muted-foreground tabular-nums">{ag.duracao_minutos}min</span>
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
        <div className="space-y-8" data-tutorial="agendamentos-metrics">
          {/* Performance cards */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-muted">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Performance</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Comparecimento */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Taxa de Comparecimento</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <span className="text-4xl font-extrabold tracking-tight text-foreground font-display">{metricasFiltradas.taxa_comparecimento}%</span>
                <div className="h-2 bg-muted/60 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(metricasFiltradas.taxa_comparecimento, 100)}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{metricasFiltradas.realizados} de {metricasFiltradas.realizados + metricasFiltradas.no_show} compareceram</p>
              </div>

              {/* No-show */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Taxa de No-show</span>
                  <div className={cn("p-1.5 rounded-lg", metricasFiltradas.taxa_no_show > 20 ? "bg-red-50" : "bg-muted")}>
                    <TrendingDown className={cn("h-3.5 w-3.5", metricasFiltradas.taxa_no_show > 20 ? "text-red-600" : "text-muted-foreground")} />
                  </div>
                </div>
                <span className={cn("text-4xl font-extrabold tracking-tight font-display", metricasFiltradas.taxa_no_show > 20 ? "text-red-600" : "text-foreground")}>{metricasFiltradas.taxa_no_show}%</span>
                <div className="h-2 bg-muted/60 rounded-full overflow-hidden mt-4">
                  <div className={cn("h-full rounded-full transition-all duration-700 ease-out", metricasFiltradas.taxa_no_show > 20 ? "bg-red-500" : "bg-gray-400")} style={{ width: `${Math.min(metricasFiltradas.taxa_no_show, 100)}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{metricasFiltradas.no_show} não compareceram no período</p>
              </div>
            </div>
          </div>

          {/* Charts grid */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-muted">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Análise Visual</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status donut */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40">
                  <h3 className="text-sm font-semibold text-foreground">Distribuição por Status</h3>
                </div>
                <div className="p-5">
                  {donutStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={donutStatus} dataKey="total" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--background))">
                          {donutStatus.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="bg-muted/30 p-4 rounded-2xl mb-2"><BarChart3 className="h-6 w-6 text-muted-foreground/20" /></div>
                      <p className="text-[11px] text-muted-foreground/40">Sem dados no período</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Weekly trend */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40">
                  <h3 className="text-sm font-semibold text-foreground">Tendência Semanal</h3>
                </div>
                <div className="p-5">
                  {tendenciaSemanal.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={tendenciaSemanal}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                        <XAxis dataKey="semana" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis allowDecimals={false} fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                        <Line type="monotone" dataKey="total" stroke="hsl(var(--foreground))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--foreground))', strokeWidth: 2, stroke: 'hsl(var(--background))' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="bg-muted/30 p-4 rounded-2xl mb-2"><BarChart3 className="h-6 w-6 text-muted-foreground/20" /></div>
                      <p className="text-[11px] text-muted-foreground/40">Sem dados no período</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo distribution */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40">
                  <h3 className="text-sm font-semibold text-foreground">Distribuição por Tipo</h3>
                </div>
                <div className="p-5">
                  {distribuicaoTipo.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={distribuicaoTipo} dataKey="total" nameKey="tipo" cx="50%" cy="50%" outerRadius={85} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--background))">
                          {distribuicaoTipo.map((_, i) => <Cell key={i} fill={CORES_PREDEFINIDAS[i % CORES_PREDEFINIDAS.length]} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="bg-muted/30 p-4 rounded-2xl mb-2"><BarChart3 className="h-6 w-6 text-muted-foreground/20" /></div>
                      <p className="text-[11px] text-muted-foreground/40">Sem dados no período</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly attendance */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40">
                  <h3 className="text-sm font-semibold text-foreground">Comparecimento Mensal</h3>
                </div>
                <div className="p-5">
                  {comparecimentoMensal.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={comparecimentoMensal}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                        <XAxis dataKey="mes" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis unit="%" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                        <Bar dataKey="taxa" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="bg-muted/30 p-4 rounded-2xl mb-2"><BarChart3 className="h-6 w-6 text-muted-foreground/20" /></div>
                      <p className="text-[11px] text-muted-foreground/40">Sem dados no período</p>
                    </div>
                  )}
                </div>
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
                              setForm((f) => ({ ...f, lead_id: l.id, titulo: f.titulo || `Consulta - ${l.nome || ""}` }));
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
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
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
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data e Hora</Label>
              <Input
                type="datetime-local"
                value={form.data_hora_inicio}
                onChange={(e) => {
                  setForm((f) => ({ ...f, data_hora_inicio: e.target.value }));
                  updateDuracao(e.target.value, form.duracao_minutos || 60);
                }}
                className="rounded-lg border-border/60 h-10"
              />
            </div>


            {/* Cor */}
            <div data-tutorial="agendamento-field-cor" className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cor do Evento</Label>
              <div className="flex gap-2">
                {CORES_PREDEFINIDAS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all hover:scale-105",
                      form.cor === c ? "border-foreground scale-110 shadow-md" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, cor: c }))}
                  />
                ))}
              </div>
            </div>

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

            {/* WhatsApp */}
            {!editMode && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/30">
                <Checkbox id="enviar-confirm" checked={enviarConfirmacao} onCheckedChange={(c) => setEnviarConfirmacao(!!c)} />
                <div>
                  <Label htmlFor="enviar-confirm" className="cursor-pointer text-sm font-medium">Enviar confirmação via WhatsApp</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">O lead receberá uma mensagem com os detalhes do agendamento</p>
                </div>
              </div>
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
                      <p className="text-[13px] font-semibold text-foreground mt-1">{ag.lead?.nome || "Sem lead"}</p>
                      {ag.lead?.telefone && <p className="text-[10px] text-muted-foreground">{ag.lead.telefone}</p>}
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Data / Hora</span>
                      <p className="text-[13px] font-semibold text-foreground mt-1">{format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy")}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{formatTimeBR(ag.data_hora_inicio)} – {formatTimeBR(ag.data_hora_fim)} · {ag.duracao_minutos}min</p>
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
      <Dialog open={modalRealizado} onOpenChange={setModalRealizado}>
        <DialogContent className="max-w-md rounded-2xl border-border/60">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Marcar como Realizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações pós-reunião</Label>
              <Textarea
                value={obsPos}
                onChange={(e) => setObsPos(e.target.value)}
                placeholder="Como foi a reunião? Quais foram os próximos passos?"
                rows={4}
                className="rounded-lg border-border/60 resize-none"
              />
            </div>
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/30">
              <Checkbox id="lead-avancou" checked={leadAvancou} onCheckedChange={(c) => setLeadAvancou(!!c)} />
              <Label htmlFor="lead-avancou" className="cursor-pointer text-sm font-medium">Lead avançou no pipeline?</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalRealizado(false)} className="text-xs font-semibold rounded-lg">Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold rounded-lg gap-2" onClick={handleMarcarRealizado} disabled={formLoading}>
              {formLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* ═══════════════ MODAL CONFIG NOTIFICAÇÕES ═══════════════ */}
      <ConfigNotificacoes isOpen={modalConfig} onClose={() => setModalConfig(false)} />

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
