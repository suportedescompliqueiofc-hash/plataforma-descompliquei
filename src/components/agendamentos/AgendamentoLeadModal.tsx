import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit2, Check, X, Loader2, CalendarDays, MapPin, Link2, DollarSign, ChevronDown, Bell, BellOff, Stethoscope, Scissors, RotateCcw } from "lucide-react";
import { useAgendamentoFinanceiroConfig } from "@/hooks/useAgendamentoFinanceiroConfig";
import { useQueryClient } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import { supabase } from "@/integrations/supabase/client";
import { CurrencyInput } from "@/components/CurrencyInput";
import { TimeInput } from "@/components/ui/TimeInput";
import { useProfile } from "@/hooks/useProfile";
import { useAgendamentos, Agendamento, AgendamentoInput } from "@/hooks/useAgendamentos";
import { useProcedimentos } from "@/hooks/useProcedimentos";
import { cn } from "@/lib/utils";
import { type Lembrete, chaveLembrete, antecedenciaMinutos, lembreteAtivoValido } from "@/lib/lembretes";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  agendado:   { label: "Agendado",        color: "#3b82f6", bg: "#eff6ff" },
  confirmado: { label: "Confirmado",      color: "#10b981", bg: "#f0fdf4" },
  realizado:  { label: "Realizado",       color: "#6b7280", bg: "#f9fafb" },
  no_show:    { label: "Não compareceu",  color: "#ef4444", bg: "#fef2f2" },
  nao_compareceu: { label: "Não compareceu", color: "#ef4444", bg: "#fef2f2" },
  cancelado:  { label: "Cancelado",       color: "#f97316", bg: "#fff7ed" },
  remarcado:  { label: "Remarcado",       color: "#f59e0b", bg: "#fffbeb" },
};

const CORES_PREDEFINIDAS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const DURACOES_RAPIDAS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1h", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2h", value: 120 },
];

const TIPO_TITULOS: Record<string, string> = {
  consulta:     "Consulta",
  procedimento: "Procedimento",
  retorno:      "Retorno",
};

const TIPO_ICONS_MODAL: Record<string, any> = {
  consulta:     Stethoscope,
  procedimento: Scissors,
  retorno:      RotateCcw,
};

import { aceitaProcedimento, isProcedimentoDeInteresse, labelProcedimento } from "@/lib/agendamentos";

function defaultTitulo(tipo: string, nome: string) {
  return `${TIPO_TITULOS[tipo] ?? tipo} — ${nome}`;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadNome: string;
  agendamentoExistente?: Agendamento | null;
  onSaved?: () => void;
}

export default function AgendamentoLeadModal({ isOpen, onClose, leadId, leadNome, agendamentoExistente, onSaved }: Props) {
  const { profile } = useProfile();
  const { criarAgendamento, atualizarAgendamento } = useAgendamentos();
  const { config: financeiroConfig } = useAgendamentoFinanceiroConfig();
  const { procedimentos } = useProcedimentos();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "create" | "edit">("create");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [horaInicio, setHoraInicio] = useState("08");
  const [minutoInicio, setMinutoInicio] = useState("00");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [form, setForm] = useState<AgendamentoInput>({
    lead_id: leadId,
    titulo: defaultTitulo("consulta", leadNome),
    data_hora_inicio: "",
    data_hora_fim: "",
    duracao_minutos: 60,
    tipo: "consulta",
    cor: "#3b82f6",
  });
  const [ativarFluxo, setAtivarFluxo] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    if (agendamentoExistente) {
      setMode("view");
    } else {
      setMode("create");
      setDataInicio(undefined);
      setHoraInicio("08");
      setMinutoInicio("00");
      setForm({
        lead_id: leadId,
        titulo: defaultTitulo("consulta", leadNome),
        data_hora_inicio: "",
        data_hora_fim: "",
        duracao_minutos: 60,
        tipo: "consulta",
        cor: "#3b82f6",
        valor_orcado: financeiroConfig?.consulta_valor_padrao ?? null,
        procedimento_id: null,
        procedimento_interesse: null,
      });
      setAtivarFluxo(true);
    }
  }, [isOpen, agendamentoExistente, leadId, leadNome, financeiroConfig]);

  function toLocalDatetimeStr(isoStr: string): string {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function localToISO(localStr: string): string {
    return new Date(localStr).toISOString();
  }

  function startEdit() {
    if (!agendamentoExistente) return;
    const localInicio = toLocalDatetimeStr(agendamentoExistente.data_hora_inicio);
    setForm({
      lead_id: agendamentoExistente.lead_id,
      titulo: agendamentoExistente.titulo,
      descricao: agendamentoExistente.descricao,
      data_hora_inicio: localInicio,
      data_hora_fim: toLocalDatetimeStr(agendamentoExistente.data_hora_fim),
      duracao_minutos: agendamentoExistente.duracao_minutos,
      tipo: agendamentoExistente.tipo,
      local: agendamentoExistente.local,
      link_reuniao: agendamentoExistente.link_reuniao,
      cor: agendamentoExistente.cor,
      valor_orcado: agendamentoExistente.valor_orcado,
      procedimento_id: agendamentoExistente.procedimento_id,
      procedimento_interesse: agendamentoExistente.procedimento_interesse,
    });
    parseDatetimeLocal(localInicio);
    setMode("edit");
  }

  function updateDuracao(inicio: string, minutos: number) {
    if (!inicio) return;
    const d = new Date(new Date(inicio).getTime() + minutos * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setForm((f) => ({ ...f, data_hora_fim: fim, duracao_minutos: minutos }));
  }

  function buildDatetimeStr(date: Date, hora: string, minuto: string): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hora}:${minuto}`;
  }

  function applyDatetime(date: Date | undefined, hora: string, minuto: string) {
    if (!date) { setForm(f => ({ ...f, data_hora_inicio: "" })); return; }
    const str = buildDatetimeStr(date, hora, minuto);
    setForm(f => {
      const d = new Date(new Date(str).getTime() + (f.duracao_minutos || 60) * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { ...f, data_hora_inicio: str, data_hora_fim: fim };
    });
  }

  function handleDateChange(date: Date | undefined) {
    setDataInicio(date);
    setIsDatePickerOpen(false);
    applyDatetime(date, horaInicio, minutoInicio);
  }

  function handleHoraChange(hora: string) {
    setHoraInicio(hora);
    applyDatetime(dataInicio, hora, minutoInicio);
  }

  function handleMinutoChange(minuto: string) {
    setMinutoInicio(minuto);
    applyDatetime(dataInicio, horaInicio, minuto);
  }

  function parseDatetimeLocal(str: string) {
    if (!str) return;
    const d = new Date(str);
    if (isNaN(d.getTime())) return;
    setDataInicio(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setHoraInicio(String(d.getHours()).padStart(2, "0"));
    setMinutoInicio(String(d.getMinutes()).padStart(2, "0"));
  }

  async function handleChangeStatus(newStatus: string) {
    if (!agendamentoExistente) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: newStatus, atualizado_em: new Date().toISOString() })
        .eq("id", agendamentoExistente.id);
      if (error) throw error;
      const cfg = STATUS_CONFIG[newStatus];
      toast.success(`Status alterado para: ${cfg?.label ?? newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["agendamentos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-metricas", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status.");
    }
    setLoading(false);
  }

  async function handleSalvar() {
    if (!form.titulo || !form.data_hora_inicio || !form.data_hora_fim) {
      toast.error("Preencha título, data e hora.");
      return;
    }
    setLoading(true);
    const payload = {
      ...form,
      data_hora_inicio: localToISO(form.data_hora_inicio),
      data_hora_fim: localToISO(form.data_hora_fim),
    };
    try {
      if (mode === "edit" && agendamentoExistente) {
        await atualizarAgendamento.mutateAsync({ id: agendamentoExistente.id, ...payload });
        toast.success("Agendamento atualizado!");
      } else {
        const ag = await criarAgendamento.mutateAsync(payload);
        await supabase.from("leads").update({ is_scheduled: true }).eq("id", leadId);
        if (!ativarFluxo && ag?.id && orgId) {
          // Pré-cancela todos os lembretes (relativos e de horário fixo) para este agendamento
          const { data: cfg } = await supabase
            .from("agendamento_config_notificacoes")
            .select("notif_ativa, lembretes")
            .eq("organization_id", orgId)
            .single();
          const lembretes: Lembrete[] =
            cfg?.notif_ativa && Array.isArray(cfg?.lembretes) ? (cfg.lembretes as unknown as Lembrete[]) : [];
          const ativos = lembretes.filter(lembreteAtivoValido);
          if (ativos.length > 0) {
            const dataInicioDate = new Date(ag.data_hora_inicio);
            await supabase.from("agendamento_notificacoes").insert(
              ativos.map((l) => ({
                agendamento_id: ag.id,
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
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    }
    setLoading(false);
  }

  if (!isOpen) return null;

  const ag = agendamentoExistente;
  const statusCfg = ag ? (STATUS_CONFIG[ag.status] ?? { label: ag.status, color: "#6b7280", bg: "#f9fafb" }) : null;

  /* Status que ainda permitem transição */
  const podeConfirmar  = ag && !["confirmado", "realizado", "cancelado"].includes(ag.status);
  const podeRealizar   = ag && !["realizado", "cancelado"].includes(ag.status);
  const podeNoShow     = ag && !["no_show", "nao_compareceu", "realizado", "cancelado"].includes(ag.status);
  const podeRemarcar   = ag && !["remarcado", "realizado", "cancelado"].includes(ag.status);
  const podeCancelar   = ag && !["cancelado", "realizado"].includes(ag.status);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">

        {/* ===== VIEW MODE ===== */}
        {mode === "view" && ag && statusCfg && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border/40">
              <h2 className="text-lg font-bold font-display text-foreground leading-tight">{ag.titulo}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ color: statusCfg.color, backgroundColor: statusCfg.color + '18' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusCfg.color }} />
                  {statusCfg.label}
                </span>
                <span className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> {ag.tipo}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/30 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">LEAD</p>
                  <p className="text-sm font-semibold text-foreground">{leadNome}</p>
                  {ag.lead?.telefone && (
                    <p className="text-xs text-muted-foreground mt-0.5">{ag.lead.telefone}</p>
                  )}
                </div>
                <div className="rounded-xl bg-muted/30 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">DATA / HORA</p>
                  <p className="text-sm font-semibold text-foreground font-display tabular-nums">
                    {format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-display tabular-nums">
                    {format(parseISO(ag.data_hora_inicio), "HH:mm", { locale: ptBR })}
                    {" – "}
                    {format(parseISO(ag.data_hora_fim), "HH:mm", { locale: ptBR })}
                    {" · "}
                    {ag.duracao_minutos}min
                  </p>
                </div>
              </div>

              {ag.valor_orcado != null && ag.valor_orcado > 0 && (
                <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/60 mb-0.5">Valor Orçado</p>
                    <p className="text-lg font-bold text-emerald-700 font-display tabular-nums">
                      R$ {Number(ag.valor_orcado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
              )}
              {ag.local && (
                <div className="rounded-xl bg-muted/30 p-3.5 flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">LOCAL</p>
                    <p className="text-sm text-foreground">{ag.local}</p>
                  </div>
                </div>
              )}

              {ag.link_reuniao && (
                <div className="rounded-xl bg-muted/30 p-3.5 flex items-start gap-2">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">LINK</p>
                    <a href={ag.link_reuniao} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">{ag.link_reuniao}</a>
                  </div>
                </div>
              )}

              {ag.descricao && (
                <div className="rounded-xl bg-muted/30 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">OBSERVAÇÕES</p>
                  <p className="text-sm text-foreground">{ag.descricao}</p>
                </div>
              )}

              {/* ── Alterar Status ── */}
              {(podeConfirmar || podeRealizar || podeNoShow || podeRemarcar || podeCancelar) && (
                <div className="rounded-xl border border-border/60 bg-muted/[0.03] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">ALTERAR STATUS</p>
                  <div className="flex flex-wrap gap-2">
                    {podeConfirmar && (
                      <button
                        onClick={() => handleChangeStatus("confirmado")}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Confirmar presença
                      </button>
                    )}
                    {podeRealizar && (
                      <button
                        onClick={() => handleChangeStatus("realizado")}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Realizado
                      </button>
                    )}
                    {podeNoShow && (
                      <button
                        onClick={() => handleChangeStatus("no_show")}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        Não compareceu
                      </button>
                    )}
                    {podeRemarcar && (
                      <button
                        onClick={() => handleChangeStatus("remarcado")}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        Remarcar
                      </button>
                    )}
                    {podeCancelar && (
                      <button
                        onClick={() => handleChangeStatus("cancelado")}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3 w-3" /> Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20">
              <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs rounded-lg">
                Fechar
              </Button>
              <Button size="sm" variant="outline" onClick={startEdit} className="h-8 text-xs rounded-lg gap-1.5">
                <Edit2 className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          </div>
        )}

        {/* ===== CREATE / EDIT MODE ===== */}
        {(mode === "create" || mode === "edit") && (
          <div className="flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-border/40">
              <h2 className="text-lg font-bold tracking-tight font-display text-foreground">
                {mode === "edit" ? "Editar Agendamento" : "Novo Agendamento"}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {mode === "edit" ? "Atualize os dados do agendamento" : "Preencha os dados para criar um novo agendamento"}
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead</Label>
                <Input value={leadNome} disabled className="bg-muted h-10 text-sm rounded-lg border-border/60 mt-1" />
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  className="h-10 text-sm rounded-lg border-border/60 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => {
                      setForm((f) => ({
                        ...f,
                        tipo: v,
                        titulo: defaultTitulo(v, leadNome),
                        procedimento_id: aceitaProcedimento(v) ? f.procedimento_id : null,
                        procedimento_interesse: aceitaProcedimento(v) ? f.procedimento_interesse : null,
                        valor_orcado: v === "consulta"
                          ? (financeiroConfig?.consulta_valor_padrao ?? null)
                          : v === "procedimento" ? f.valor_orcado : null,
                        duracao_minutos: v === "procedimento" ? f.duracao_minutos : 60,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {Object.entries(TIPO_TITULOS).map(([k, v]) => {
                        const Icon = TIPO_ICONS_MODAL[k] || CalendarDays;
                        return (
                          <SelectItem key={k} value={k}>
                            <div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{v}</div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Duração</Label>
                  <div className="flex gap-1.5 mt-1">
                    {DURACOES_RAPIDAS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
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
              {aceitaProcedimento(form.tipo) && (
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {labelProcedimento(form.tipo)}
                  </Label>
                  <Select
                    value={form.procedimento_id ?? ""}
                    onValueChange={(v) => {
                      const proc = procedimentos.find((p) => p.id === v);
                      const soInteresse = isProcedimentoDeInteresse(form.tipo);
                      setForm((f) => ({
                        ...f,
                        procedimento_id: proc?.id ?? null,
                        // mantido em sincronia com a FK enquanto o campo legado existir
                        procedimento_interesse: proc?.nome ?? null,
                        // Numa consulta o procedimento é só interesse: não toca em título,
                        // valor nem duração — o valor_orcado ali é o valor da consulta.
                        ...(soInteresse ? {} : {
                          titulo: proc ? `Procedimento — ${proc.nome}` : defaultTitulo("procedimento", leadNome),
                          valor_orcado: proc?.valor_base ?? f.valor_orcado,
                          duracao_minutos: proc?.duracao_minutos ?? f.duracao_minutos,
                        }),
                      }));
                    }}
                  >
                    <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 mt-1">
                      <SelectValue placeholder="Selecionar procedimento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {procedimentos.filter((p) => p.ativo).length === 0 ? (
                        <div className="px-3 py-4 text-center">
                          <p className="text-[11px] text-muted-foreground">Nenhum procedimento cadastrado.</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Cadastre em Configurações → Procedimentos</p>
                        </div>
                      ) : (
                        procedimentos.filter((p) => p.ativo).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span>{p.nome}</span>
                              {p.valor_base && (
                                <span className="text-[10px] text-muted-foreground font-display tabular-nums ml-4">
                                  R$ {Number(p.valor_base).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(form.tipo === "consulta" || form.tipo === "procedimento") && (
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {form.tipo === "consulta" ? "Valor da Consulta (R$)" : "Valor Orçado (R$)"}
                  </Label>
                  <CurrencyInput
                    value={form.valor_orcado}
                    onValueChange={(v) => setForm((f) => ({ ...f, valor_orcado: v ?? null }))}
                    className="h-10 text-sm rounded-lg border-border/60 mt-1"
                  />
                </div>
              )}
              {/* ── Data e Hora ── */}
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Data e Hora de Início
                </Label>
                <div className="flex gap-2 mt-1">
                  {/* Calendar */}
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal h-10 rounded-lg text-sm border-border/60",
                          !dataInicio && "text-muted-foreground/50"
                        )}
                      >
                        <CalendarDays className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {dataInicio
                          ? format(dataInicio, "EEE, dd 'de' MMM", { locale: ptBR })
                          : "Selecionar data"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-border/60" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={handleDateChange}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Hour : Minute */}
                  <TimeInput
                    hora={horaInicio}
                    minuto={minutoInicio}
                    onChange={(h, m) => { handleHoraChange(h); handleMinutoChange(m); }}
                  />
                </div>
              </div>
              {form.tipo === "online" && (
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Link da videochamada</Label>
                  <Input
                    value={form.link_reuniao || ""}
                    className="h-10 text-sm rounded-lg border-border/60 mt-1"
                    onChange={(e) => setForm((f) => ({ ...f, link_reuniao: e.target.value }))}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              )}
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</Label>
                <Textarea
                  value={form.descricao || ""}
                  className="text-sm rounded-lg border-border/60 mt-1"
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Observações sobre o agendamento..."
                  rows={3}
                />
              </div>
              {mode === "create" && (
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

            <div className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2 bg-muted/10">
              <Button variant="ghost" onClick={onClose} className="text-xs font-semibold rounded-lg">
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={loading}
                className="text-xs font-semibold rounded-lg gap-2 bg-foreground text-background hover:bg-foreground/90 px-5"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
                {mode === "edit" ? "Salvar Alterações" : "Criar Agendamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
