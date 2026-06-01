import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit2, Check, X, Loader2, CalendarDays, Clock, MapPin, Link2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAgendamentos, Agendamento, AgendamentoInput } from "@/hooks/useAgendamentos";
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "create" | "edit">("create");

  const [form, setForm] = useState<AgendamentoInput>({
    lead_id: leadId,
    titulo: `Consulta - ${leadNome}`,
    data_hora_inicio: "",
    data_hora_fim: "",
    duracao_minutos: 60,
    tipo: "consulta",
    cor: "#3b82f6",
  });
  const [enviarConfirmacao, setEnviarConfirmacao] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (agendamentoExistente) {
      setMode("view");
    } else {
      setMode("create");
      setForm({
        lead_id: leadId,
        titulo: `Consulta - ${leadNome}`,
        data_hora_inicio: "",
        data_hora_fim: "",
        duracao_minutos: 60,
        tipo: "consulta",
        cor: "#3b82f6",
      });
      setEnviarConfirmacao(false);
    }
  }, [isOpen, agendamentoExistente, leadId, leadNome]);

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
    setForm({
      lead_id: agendamentoExistente.lead_id,
      titulo: agendamentoExistente.titulo,
      descricao: agendamentoExistente.descricao,
      data_hora_inicio: toLocalDatetimeStr(agendamentoExistente.data_hora_inicio),
      data_hora_fim: toLocalDatetimeStr(agendamentoExistente.data_hora_fim),
      duracao_minutos: agendamentoExistente.duracao_minutos,
      tipo: agendamentoExistente.tipo,
      local: agendamentoExistente.local,
      link_reuniao: agendamentoExistente.link_reuniao,
      cor: agendamentoExistente.cor,
    });
    setMode("edit");
  }

  function updateDuracao(inicio: string, minutos: number) {
    if (!inicio) return;
    const d = new Date(new Date(inicio).getTime() + minutos * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setForm((f) => ({ ...f, data_hora_fim: fim, duracao_minutos: minutos }));
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
        await criarAgendamento.mutateAsync(payload);
        await supabase.from("leads").update({ is_scheduled: true, posicao_pipeline: 5 }).eq("id", leadId);
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
                  <p className="text-sm font-semibold text-foreground">
                    {format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(ag.data_hora_inicio), "HH:mm", { locale: ptBR })}
                    {" – "}
                    {format(parseISO(ag.data_hora_fim), "HH:mm", { locale: ptBR })}
                    {" · "}
                    {ag.duracao_minutos}min
                  </p>
                </div>
              </div>

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
              <h2 className="text-base font-bold font-display text-foreground">
                {mode === "edit" ? "Editar Agendamento" : "Novo Agendamento"}
              </h2>
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
                  <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                    <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="avaliacao">Avaliação</SelectItem>
                      <SelectItem value="procedimento">Procedimento</SelectItem>
                      <SelectItem value="retorno">Retorno</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Duração (min)</Label>
                  <Input
                    type="number"
                    value={form.duracao_minutos}
                    className="h-10 text-sm rounded-lg border-border/60 mt-1"
                    onChange={(e) => {
                      const min = parseInt(e.target.value) || 60;
                      setForm((f) => ({ ...f, duracao_minutos: min }));
                      updateDuracao(form.data_hora_inicio, min);
                    }}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data e hora de início</Label>
                <Input
                  type="datetime-local"
                  value={form.data_hora_inicio}
                  className="h-10 text-sm rounded-lg border-border/60 mt-1"
                  onChange={(e) => {
                    setForm((f) => ({ ...f, data_hora_inicio: e.target.value }));
                    updateDuracao(e.target.value, form.duracao_minutos || 60);
                  }}
                />
              </div>
              {form.tipo !== "online" && (
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Local / Clínica</Label>
                  <Input
                    value={form.local || ""}
                    className="h-10 text-sm rounded-lg border-border/60 mt-1"
                    onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                    placeholder="Nome ou endereço da clínica"
                  />
                </div>
              )}
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
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cor do evento</Label>
                <div className="flex gap-2 mt-2">
                  {CORES_PREDEFINIDAS.map((c) => (
                    <button
                      key={c}
                      className={cn("w-7 h-7 rounded-full border-2 transition-all", form.cor === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm((f) => ({ ...f, cor: c }))}
                    />
                  ))}
                </div>
              </div>
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
                <div className="flex items-center gap-2">
                  <Checkbox id="enviar-wpp" checked={enviarConfirmacao} onCheckedChange={(c) => setEnviarConfirmacao(!!c)} />
                  <Label htmlFor="enviar-wpp" className="cursor-pointer text-sm">Enviar confirmação via WhatsApp agora</Label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20">
              <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs rounded-lg">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSalvar} disabled={loading} className="h-9 text-xs rounded-lg px-5 font-semibold">
                {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {mode === "edit" ? "Salvar alterações" : "Criar Agendamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
