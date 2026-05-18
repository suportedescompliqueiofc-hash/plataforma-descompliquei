import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, List, BarChart3, Eye, Search, Clock, MapPin, Video, Phone, MessageSquare, Edit2, RefreshCw, Check, X, Loader2, Trash2, TrendingUp, TrendingDown, CheckCircle2, XCircle, AlertCircle, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAgendamentos, Agendamento, AgendamentoInput } from "@/hooks/useAgendamentos";
import { useOutboundProspectos } from "@/hooks/useOutboundProspectos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { ProspectoDetalheModal } from "@/components/outbound/ProspectoDetalheModal";
import { ProspectoFormModal } from "@/components/outbound/ProspectoFormModal";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  agendado: "#3b82f6",
  confirmado: "#10b981",
  realizado: "#6b7280",
  nao_compareceu: "#ef4444",
  cancelado: "#fca5a5",
  remarcado: "#f59e0b",
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
  online: Video,
  presencial: MapPin,
  telefone: Phone,
  whatsapp: MessageSquare,
};

const CORES_PREDEFINIDAS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function getEventColor(ag: Agendamento): string {
  if (ag.status !== "agendado") return STATUS_COLORS[ag.status] || ag.cor;
  return ag.cor || "#3b82f6";
}

function formatDateTimeBR(isoStr: string) {
  return format(parseISO(isoStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function toLocalDatetimeStr(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToISO(localStr: string): string {
  return new Date(localStr).toISOString();
}

export default function OutboundAgendamentos() {
  const { agendamentos, isLoading, criarAgendamento, atualizarAgendamento, deletarAgendamento, buscarNotificacoes, orgId } = useAgendamentos();
  const { prospectos } = useOutboundProspectos();
  const { profile } = useProfile();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(today), to: endOfMonth(today) });
  const [activeTab, setActiveTab] = useState("calendario");
  const [modalCriar, setModalCriar] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalReagendar, setModalReagendar] = useState(false);
  const [modalRealizado, setModalRealizado] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [agendamentoExcluir, setAgendamentoExcluir] = useState<Agendamento | null>(null);

  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");

  const [detalheProspecto, setDetalheProspecto] = useState<any>(null);
  const [editProspecto, setEditProspecto] = useState<any>(null);

  const [form, setForm] = useState<AgendamentoInput>({
    titulo: "",
    data_hora_inicio: "",
    data_hora_fim: "",
    duracao_minutos: 60,
    tipo: "online",
    cor: "#3b82f6",
  });
  const [formLoading, setFormLoading] = useState(false);

  const [obsPos, setObsPos] = useState("");
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  const [notificacoes, setNotificacoes] = useState<any[]>([]);

  const prospectoByLeadId = useMemo(() => {
    const map = new Map<string, any>();
    prospectos.forEach(p => {
      if (p.whatsapp_lead_id) map.set(p.whatsapp_lead_id, p);
    });
    return map;
  }, [prospectos]);

  // Leads outbound para autocomplete
  const outboundLeadIds = useMemo(() => {
    return new Set(prospectos.filter(p => p.whatsapp_lead_id).map(p => p.whatsapp_lead_id!));
  }, [prospectos]);

  const { data: leadsOutbound = [] } = useQuery({
    queryKey: ["leads-outbound-simple", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone")
        .eq("organization_id", orgId!)
        .eq("origem", "outbound")
        .order("nome");
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Filter to outbound agendamentos only
  const outboundAgendamentos = useMemo(() => {
    return agendamentos.filter(a => {
      return (a as any).tipo === 'outbound_call' || prospectoByLeadId.has(a.lead_id);
    });
  }, [agendamentos, prospectoByLeadId]);

  // Filter by dateRange
  const agendamentosFiltrados = useMemo(() => {
    if (!dateRange?.from) return outboundAgendamentos;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return outboundAgendamentos.filter((ag) => {
      const d = parseISO(ag.data_hora_inicio);
      return !isBefore(d, from) && !isAfter(d, to);
    });
  }, [outboundAgendamentos, dateRange]);

  const metricasFiltradas = useMemo(() => {
    const list = agendamentosFiltrados;
    const realizados = list.filter(a => a.status === "realizado").length;
    const noShow = list.filter(a => a.status === "nao_compareceu").length;
    const cancelados = list.filter(a => a.status === "cancelado").length;
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

  // Calendar events (no date filter — calendar has own nav)
  const calendarEvents = useMemo(() =>
    outboundAgendamentos.map(ag => ({
      id: ag.id,
      title: ag.titulo,
      start: ag.data_hora_inicio,
      end: ag.data_hora_fim,
      backgroundColor: getEventColor(ag),
      borderColor: getEventColor(ag),
      extendedProps: { agendamento: ag },
    })),
    [outboundAgendamentos]
  );

  const listaFiltrada = useMemo(() => {
    let filtered = agendamentosFiltrados;
    if (filtroStatus !== "todos") filtered = filtered.filter(a => a.status === filtroStatus);
    if (filtroBusca) {
      const q = filtroBusca.toLowerCase();
      filtered = filtered.filter(a => {
        const prosp = prospectoByLeadId.get(a.lead_id);
        return a.lead?.nome?.toLowerCase().includes(q) || a.titulo.toLowerCase().includes(q) || prosp?.nome?.toLowerCase().includes(q) || prosp?.clinica?.toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [agendamentosFiltrados, filtroStatus, filtroBusca, prospectoByLeadId]);

  // Charts data
  const tendenciaSemanal = useMemo(() => {
    const semanas: Record<string, number> = {};
    agendamentosFiltrados.forEach(ag => {
      const d = parseISO(ag.data_hora_inicio);
      const inicio = startOfWeek(d, { locale: ptBR });
      const key = format(inicio, "dd/MM");
      semanas[key] = (semanas[key] || 0) + 1;
    });
    return Object.entries(semanas).slice(-8).map(([semana, total]) => ({ semana, total }));
  }, [agendamentosFiltrados]);

  const distribuicaoTipo = useMemo(() => {
    const tipos: Record<string, number> = {};
    agendamentosFiltrados.forEach(ag => { tipos[ag.tipo] = (tipos[ag.tipo] || 0) + 1; });
    return Object.entries(tipos).map(([tipo, total]) => ({ tipo, total }));
  }, [agendamentosFiltrados]);

  const donutStatus = useMemo(() => {
    const s: Record<string, number> = {};
    agendamentosFiltrados.forEach(ag => { s[ag.status] = (s[ag.status] || 0) + 1; });
    return Object.entries(s).map(([status, total]) => ({ status, label: STATUS_LABELS[status] || status, total, color: STATUS_COLORS[status] || "#999" }));
  }, [agendamentosFiltrados]);

  const comparecimentoMensal = useMemo(() => {
    const meses: Record<string, { realizados: number; total: number }> = {};
    agendamentosFiltrados.forEach(ag => {
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

  const loadNotificacoes = useCallback(async (agId: string) => {
    try {
      const data = await buscarNotificacoes(agId);
      setNotificacoes(data);
    } catch { setNotificacoes([]); }
  }, [buscarNotificacoes]);

  function resetForm() {
    setForm({ titulo: "", data_hora_inicio: "", data_hora_fim: "", duracao_minutos: 60, tipo: "online", cor: "#3b82f6" });
    setEditMode(false);
  }

  function openCriar(dateStr?: string) {
    resetForm();
    if (dateStr) {
      const inicio = dateStr.includes("T") ? dateStr.substring(0, 16) : `${dateStr}T09:00`;
      const d = new Date(new Date(inicio).getTime() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForm(f => ({ ...f, data_hora_inicio: inicio, data_hora_fim: fim }));
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
    setForm(f => ({ ...f, data_hora_fim: fim, duracao_minutos: minutos }));
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
        await criarAgendamento.mutateAsync(payload);
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
      toast.success("Reunião marcada como realizada!");
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

  function StatusBadge({ status, onClick }: { status: string; onClick?: () => void }) {
    return (
      <Badge
        className="cursor-pointer text-white text-xs"
        style={{ backgroundColor: STATUS_COLORS[status] || "#999" }}
        onClick={onClick}
      >
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-56" />
          <div className="flex gap-2"><Skeleton className="h-9 w-40" /><Skeleton className="h-9 w-44" /></div>
        </div>
        <Skeleton className="h-10 w-72 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[88px] rounded-2xl" />)}
        </div>
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Agendamentos Outbound</h1>
          <p className="text-sm text-muted-foreground mt-1">Calls e reuniões de prospecção ativa</p>
          {metricasFiltradas.total > 0 && (
            <p className="text-xs text-[#E85D24] font-medium mt-1">
              {metricasFiltradas.total} agendamento{metricasFiltradas.total !== 1 ? 's' : ''} no período · {metricasFiltradas.realizados} realizado{metricasFiltradas.realizados !== 1 ? 's' : ''} · {metricasFiltradas.taxa_comparecimento}% comparecimento
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="gap-1.5 text-xs shadow-sm bg-[#E85D24] hover:bg-[#E85D24]/90" onClick={() => openCriar()}>
            <Plus className="h-3.5 w-3.5" /> Novo Agendamento
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5 gap-0.5 self-start w-fit">
          {[
            { value: "calendario", label: "Calendário", icon: CalendarDays },
            { value: "lista", label: "Lista", icon: List },
            { value: "metricas", label: "Métricas", icon: BarChart3 },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                activeTab === value
                  ? "bg-[#E85D24] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ========== ABA CALENDÁRIO ========== */}
        <TabsContent value="calendario" className="mt-6">
          <Card className="rounded-2xl shadow-sm border-border/60">
            <CardContent className="p-5">
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
                              <span className="font-semibold text-xs truncate">{arg.event.title}</span>
                              <span className="text-[10px] opacity-90">{startStr} – {endStr}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="font-medium">{ag?.lead?.nome || arg.event.title}</p>
                            <p className="text-xs text-muted-foreground">{ag?.tipo} · {STATUS_LABELS[ag?.status]}</p>
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
                            className="flex items-center gap-1 px-1.5 py-0.5 overflow-hidden text-xs text-white w-full cursor-pointer rounded"
                            style={{ backgroundColor: bgColor }}
                          >
                            <TipoIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{arg.event.title}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="font-medium">{ag?.lead?.nome || arg.event.title}</p>
                          <p className="text-xs text-muted-foreground">{ag?.tipo} · {STATUS_LABELS[ag?.status]}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ABA LISTA ========== */}
        <TabsContent value="lista" className="mt-6 space-y-6">
          <DateRangePicker date={dateRange} setDate={setDateRange} />

          {/* Métricas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total", value: agendamentosFiltrados.length, icon: CalendarDays, color: "#E85D24" },
              { label: "Realizados", value: metricasFiltradas.realizados, icon: CheckCircle2, color: "#10b981" },
              { label: "No-show", value: metricasFiltradas.no_show, icon: XCircle, color: "#ef4444", alert: metricasFiltradas.no_show > 0 },
              { label: "Comparecimento", value: `${metricasFiltradas.taxa_comparecimento}%`, icon: TrendingUp, color: "#3b82f6" },
            ].map((card) => (
              <Card key={card.label} className="overflow-hidden shadow-sm" style={{ borderTop: `3px solid ${card.alert ? '#ef4444' : card.color}` }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{card.label}</span>
                    <card.icon className={cn("h-3.5 w-3.5 flex-shrink-0", card.alert ? "text-destructive" : "text-muted-foreground/40")} />
                  </div>
                  <div className={cn("text-2xl font-bold", card.alert ? "text-destructive" : "text-foreground")}>{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar por lead, prospecto ou título..." value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} className="pl-9 h-9 text-xs" />
            </div>
          </div>

          {/* Tabela */}
          <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Lead / Prospecto</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Data/Hora</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Tipo</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Duração</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {listaFiltrada.map(ag => {
                    const TipoIcon = TIPO_ICONS[ag.tipo] || CalendarDays;
                    const prosp = prospectoByLeadId.get(ag.lead_id);
                    return (
                      <tr key={ag.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-3.5">
                          {prosp ? (
                            <button className="text-left" onClick={() => setDetalheProspecto(prosp)}>
                              <p className="text-sm font-medium text-[#E85D24] hover:underline">{prosp.nome}</p>
                              {prosp.clinica && <p className="text-xs text-muted-foreground">{prosp.clinica}</p>}
                            </button>
                          ) : (
                            <span className="text-sm font-medium text-foreground">{ag.lead?.nome || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{formatDateTimeBR(ag.data_hora_inicio)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <TipoIcon className="h-3.5 w-3.5" />
                            <span className="capitalize">{ag.tipo}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div><StatusBadge status={ag.status} /></div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <DropdownMenuItem key={k} onClick={() => handleStatusChange(ag, k)}>
                                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: STATUS_COLORS[k] }} />
                                  {v}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{ag.duracao_minutos}min</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDetalhes(ag)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditar(ag)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setAgendamentoExcluir(ag)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {listaFiltrada.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhum agendamento outbound encontrado</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar os filtros ou criar um novo agendamento</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ========== ABA MÉTRICAS ========== */}
        <TabsContent value="metricas" className="mt-6 space-y-8">
          <DateRangePicker date={dateRange} setDate={setDateRange} />

          {/* Visão Geral */}
          <div>
            <div className="flex items-center gap-2 mb-4 pl-3 border-l-[3px] border-[#E85D24]">
              <BarChart3 className="h-4 w-4 text-[#E85D24] flex-shrink-0" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Visão Geral</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Agendados", value: String(metricasFiltradas.total), icon: CalendarDays, color: "#E85D24" },
                { label: "Realizados", value: String(metricasFiltradas.realizados), icon: CheckCircle2, color: "#10b981" },
                { label: "No-show", value: String(metricasFiltradas.no_show), icon: XCircle, color: "#ef4444", alert: metricasFiltradas.no_show > 0 },
                { label: "Cancelados", value: String(metricasFiltradas.cancelados), icon: AlertCircle, color: "#f59e0b" },
              ].map((card) => (
                <Card key={card.label} className="overflow-hidden shadow-sm" style={{ borderTop: `3px solid ${card.alert ? '#ef4444' : card.color}` }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{card.label}</span>
                      <card.icon className={cn("h-3.5 w-3.5 flex-shrink-0", card.alert ? "text-destructive" : "text-muted-foreground/40")} />
                    </div>
                    <div className={cn("text-2xl font-bold", card.alert ? "text-destructive" : "text-foreground")}>{card.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Performance */}
          <div>
            <div className="flex items-center gap-2 mb-4 pl-3 border-l-[3px] border-[#E85D24]">
              <TrendingUp className="h-4 w-4 text-[#E85D24] flex-shrink-0" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Performance</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="overflow-hidden shadow-sm" style={{ borderTop: '3px solid #10b981' }}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Taxa de Comparecimento</span>
                    <TrendingUp className="h-4 w-4 text-green-500/60" />
                  </div>
                  <div className="text-4xl font-bold text-foreground">{metricasFiltradas.taxa_comparecimento}%</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(metricasFiltradas.taxa_comparecimento, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{metricasFiltradas.realizados} de {metricasFiltradas.realizados + metricasFiltradas.no_show} compareceram</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden shadow-sm" style={{ borderTop: `3px solid ${metricasFiltradas.taxa_no_show > 20 ? '#ef4444' : '#6b7280'}` }}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Taxa de No-show</span>
                    <TrendingDown className={cn("h-4 w-4", metricasFiltradas.taxa_no_show > 20 ? "text-red-500/60" : "text-muted-foreground/40")} />
                  </div>
                  <div className={cn("text-4xl font-bold", metricasFiltradas.taxa_no_show > 20 ? "text-destructive" : "text-foreground")}>{metricasFiltradas.taxa_no_show}%</div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
                    <div className={cn("h-full rounded-full transition-all duration-500", metricasFiltradas.taxa_no_show > 20 ? "bg-red-500" : "bg-gray-400")} style={{ width: `${Math.min(metricasFiltradas.taxa_no_show, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{metricasFiltradas.no_show} não compareceram no período</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gráficos */}
          <div>
            <div className="flex items-center gap-2 mb-4 pl-3 border-l-[3px] border-[#E85D24]">
              <BarChart3 className="h-4 w-4 text-[#E85D24] flex-shrink-0" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Análise Visual</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">Agendamentos por Status</CardTitle>
                </CardHeader>
                <CardContent className="pb-5">
                  {donutStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={donutStatus} dataKey="total" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--background))">
                          {donutStatus.map(entry => <Cell key={entry.status} fill={entry.color} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                      <BarChart3 className="h-8 w-8 mb-2" />
                      <p className="text-xs">Sem dados no período</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">Tendência por Semana</CardTitle>
                </CardHeader>
                <CardContent className="pb-5">
                  {tendenciaSemanal.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={tendenciaSemanal}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis dataKey="semana" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis allowDecimals={false} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="total" stroke="#E85D24" strokeWidth={2.5} dot={{ r: 4, fill: '#E85D24', strokeWidth: 2, stroke: 'hsl(var(--background))' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                      <BarChart3 className="h-8 w-8 mb-2" />
                      <p className="text-xs">Sem dados no período</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">Distribuição por Tipo</CardTitle>
                </CardHeader>
                <CardContent className="pb-5">
                  {distribuicaoTipo.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={distribuicaoTipo} dataKey="total" nameKey="tipo" cx="50%" cy="50%" outerRadius={85} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--background))">
                          {distribuicaoTipo.map((_, i) => <Cell key={i} fill={CORES_PREDEFINIDAS[i % CORES_PREDEFINIDAS.length]} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                      <BarChart3 className="h-8 w-8 mb-2" />
                      <p className="text-xs">Sem dados no período</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border-border/60 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">Taxa de Comparecimento por Mês</CardTitle>
                </CardHeader>
                <CardContent className="pb-5">
                  {comparecimentoMensal.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={comparecimentoMensal}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                        <XAxis dataKey="mes" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis unit="%" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                        <Bar dataKey="taxa" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                      <BarChart3 className="h-8 w-8 mb-2" />
                      <p className="text-xs">Sem dados no período</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========== MODAL CRIAR/EDITAR ========== */}
      <Dialog open={modalCriar} onOpenChange={o => { if (!o) { setModalCriar(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? "Editar Agendamento" : "Novo Agendamento Outbound"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lead / Prospecto</Label>
              <Select value={form.lead_id || ""} onValueChange={v => {
                const lead = leadsOutbound.find(l => l.id === v);
                setForm(f => ({ ...f, lead_id: v, titulo: f.titulo || `Reunião - ${lead?.nome || ""}` }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione um lead outbound..." /></SelectTrigger>
                <SelectContent>
                  {leadsOutbound.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Call - João Silva" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Formato</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duração (min)</Label>
                <Input type="number" value={form.duracao_minutos} onChange={e => {
                  const min = parseInt(e.target.value) || 60;
                  setForm(f => ({ ...f, duracao_minutos: min }));
                  updateDuracao(form.data_hora_inicio, min);
                }} />
              </div>
            </div>
            <div>
              <Label>Data e hora de início</Label>
              <Input type="datetime-local" value={form.data_hora_inicio} onChange={e => {
                setForm(f => ({ ...f, data_hora_inicio: e.target.value }));
                updateDuracao(e.target.value, form.duracao_minutos || 60);
              }} />
            </div>
            {form.tipo === "presencial" && (
              <div>
                <Label>Local</Label>
                <Input value={form.local || ""} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="Endereço" />
              </div>
            )}
            {form.tipo === "online" && (
              <div>
                <Label>Link da reunião</Label>
                <Input value={form.link_reuniao || ""} onChange={e => setForm(f => ({ ...f, link_reuniao: e.target.value }))} placeholder="https://meet.google.com/..." />
              </div>
            )}
            <div>
              <Label>Cor do evento</Label>
              <div className="flex gap-2 mt-1">
                {CORES_PREDEFINIDAS.map(c => (
                  <button key={c} className={`w-7 h-7 rounded-full border-2 transition-all ${form.cor === c ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setForm(f => ({ ...f, cor: c }))} />
                ))}
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao || ""} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Observações..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalCriar(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={formLoading} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
              {formLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editMode ? "Salvar" : "Criar Agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MODAL DETALHES ========== */}
      <Dialog open={modalDetalhes} onOpenChange={setModalDetalhes}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{agendamentoSelecionado?.titulo}</DialogTitle>
          </DialogHeader>
          {agendamentoSelecionado && (() => {
            const prosp = prospectoByLeadId.get(agendamentoSelecionado.lead_id);
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={agendamentoSelecionado.status} />
                  <span className="text-sm text-muted-foreground capitalize">{agendamentoSelecionado.tipo}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Lead:</span>{" "}
                    {prosp ? (
                      <button className="text-[#E85D24] hover:underline" onClick={() => { setModalDetalhes(false); setDetalheProspecto(prosp); }}>
                        {prosp.nome}
                      </button>
                    ) : (
                      agendamentoSelecionado.lead?.nome || "—"
                    )}
                  </div>
                  <div><span className="text-muted-foreground">Telefone:</span> {agendamentoSelecionado.lead?.telefone || "—"}</div>
                  <div><span className="text-muted-foreground">Início:</span> {formatDateTimeBR(agendamentoSelecionado.data_hora_inicio)}</div>
                  <div><span className="text-muted-foreground">Duração:</span> {agendamentoSelecionado.duracao_minutos}min</div>
                  {agendamentoSelecionado.local && <div className="col-span-2"><span className="text-muted-foreground">Local:</span> {agendamentoSelecionado.local}</div>}
                  {agendamentoSelecionado.link_reuniao && <div className="col-span-2"><span className="text-muted-foreground">Link:</span> <a href={agendamentoSelecionado.link_reuniao} target="_blank" rel="noreferrer" className="text-blue-600 underline">{agendamentoSelecionado.link_reuniao}</a></div>}
                  {agendamentoSelecionado.descricao && <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span> {agendamentoSelecionado.descricao}</div>}
                  {agendamentoSelecionado.observacoes_pos && <div className="col-span-2"><span className="text-muted-foreground">Obs. pós-reunião:</span> {agendamentoSelecionado.observacoes_pos}</div>}
                </div>
                {notificacoes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Lembretes enviados:</p>
                    <div className="space-y-1">
                      {notificacoes.map(n => (
                        <div key={n.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                          <div className={`w-2 h-2 rounded-full ${n.status === "enviado" ? "bg-green-500" : "bg-red-500"}`} />
                          {n.antecedencia_minutos}min antes — {n.status} {n.enviado_em ? `em ${format(parseISO(n.enviado_em), "dd/MM HH:mm")}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => agendamentoSelecionado && openEditar(agendamentoSelecionado)}>
              <Edit2 className="h-4 w-4 mr-1" /> Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => agendamentoSelecionado && handleStatusChange(agendamentoSelecionado, "remarcado")}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reagendar
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => agendamentoSelecionado && handleStatusChange(agendamentoSelecionado, "realizado")}>
              <Check className="h-4 w-4 mr-1" /> Marcar Realizado
            </Button>
            <Button variant="destructive" size="sm" onClick={() => agendamentoSelecionado && handleStatusChange(agendamentoSelecionado, "cancelado")}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MODAL REALIZADO ========== */}
      <Dialog open={modalRealizado} onOpenChange={setModalRealizado}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como Realizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Observações pós-reunião</Label>
              <Textarea value={obsPos} onChange={e => setObsPos(e.target.value)} placeholder="Como foi a reunião? Quais foram os próximos passos?" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRealizado(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleMarcarRealizado} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MODAL REAGENDAR ========== */}
      <Dialog open={modalReagendar} onOpenChange={setModalReagendar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar</DialogTitle>
          </DialogHeader>
          {agendamentoSelecionado && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Original: {formatDateTimeBR(agendamentoSelecionado.data_hora_inicio)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nova data</Label>
                  <Input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} />
                </div>
                <div>
                  <Label>Nova hora</Label>
                  <Input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalReagendar(false)}>Cancelar</Button>
            <Button onClick={handleReagendar} disabled={formLoading} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
              {formLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CONFIRMAR EXCLUSÃO ========== */}
      <AlertDialog open={!!agendamentoExcluir} onOpenChange={o => { if (!o) setAgendamentoExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agendamento "{agendamentoExcluir?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => {
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

      {/* Prospecto modals */}
      {detalheProspecto && (
        <ProspectoDetalheModal
          open={!!detalheProspecto}
          onOpenChange={o => { if (!o) setDetalheProspecto(null); }}
          prospecto={detalheProspecto}
          onEdit={() => { setEditProspecto(detalheProspecto); setDetalheProspecto(null); }}
        />
      )}
      {editProspecto && (
        <ProspectoFormModal
          open={!!editProspecto}
          onOpenChange={o => { if (!o) setEditProspecto(null); }}
          prospecto={editProspecto}
        />
      )}
    </div>
  );
}
