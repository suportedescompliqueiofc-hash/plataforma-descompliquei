import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Video, MapPin, Phone, MessageSquare, Edit2, RefreshCw, Check, X, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAgendamentos, Agendamento, AgendamentoInput } from "@/hooks/useAgendamentos";

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
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "create" | "edit">("create");

  const [form, setForm] = useState<AgendamentoInput>({
    lead_id: leadId,
    titulo: `Reunião - ${leadNome}`,
    data_hora_inicio: "",
    data_hora_fim: "",
    duracao_minutos: 60,
    tipo: "online",
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
        titulo: `Reunião - ${leadNome}`,
        data_hora_inicio: "",
        data_hora_fim: "",
        duracao_minutos: 60,
        tipo: "online",
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

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "view" ? "Agendamento Ativo" : mode === "edit" ? "Editar Agendamento" : "Novo Agendamento"}
          </DialogTitle>
        </DialogHeader>

        {/* ===== VIEW MODE ===== */}
        {mode === "view" && ag && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="text-white" style={{ backgroundColor: STATUS_COLORS[ag.status] }}>
                {STATUS_LABELS[ag.status]}
              </Badge>
              <span className="text-sm text-muted-foreground capitalize">{ag.tipo}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Lead:</span> {leadNome}</div>
              <div><span className="text-muted-foreground">Título:</span> {ag.titulo}</div>
              <div>
                <span className="text-muted-foreground">Início:</span>{" "}
                {format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
              <div><span className="text-muted-foreground">Duração:</span> {ag.duracao_minutos}min</div>
              {ag.local && <div className="col-span-2"><span className="text-muted-foreground">Local:</span> {ag.local}</div>}
              {ag.link_reuniao && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Link:</span>{" "}
                  <a href={ag.link_reuniao} target="_blank" rel="noreferrer" className="text-blue-600 underline">{ag.link_reuniao}</a>
                </div>
              )}
              {ag.descricao && <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span> {ag.descricao}</div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={startEdit}>
                <Edit2 className="h-4 w-4 mr-1" /> Editar
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ===== CREATE / EDIT MODE ===== */}
        {(mode === "create" || mode === "edit") && (
          <>
            <div className="space-y-4">
              <div>
                <Label>Lead</Label>
                <Input value={leadNome} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Título</Label>
                <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Formato</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
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
                  <Input type="number" value={form.duracao_minutos} onChange={(e) => {
                    const min = parseInt(e.target.value) || 60;
                    setForm((f) => ({ ...f, duracao_minutos: min }));
                    updateDuracao(form.data_hora_inicio, min);
                  }} />
                </div>
              </div>
              <div>
                <Label>Data e hora de início</Label>
                <Input type="datetime-local" value={form.data_hora_inicio} onChange={(e) => {
                  setForm((f) => ({ ...f, data_hora_inicio: e.target.value }));
                  updateDuracao(e.target.value, form.duracao_minutos || 60);
                }} />
              </div>
              {form.tipo === "presencial" && (
                <div>
                  <Label>Local</Label>
                  <Input value={form.local || ""} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} placeholder="Endereço" />
                </div>
              )}
              {form.tipo === "online" && (
                <div>
                  <Label>Link da reunião</Label>
                  <Input value={form.link_reuniao || ""} onChange={(e) => setForm((f) => ({ ...f, link_reuniao: e.target.value }))} placeholder="https://meet.google.com/..." />
                </div>
              )}
              <div>
                <Label>Cor do evento</Label>
                <div className="flex gap-2 mt-1">
                  {CORES_PREDEFINIDAS.map((c) => (
                    <button key={c} className={`w-7 h-7 rounded-full border-2 transition-all ${form.cor === c ? "border-black scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setForm((f) => ({ ...f, cor: c }))} />
                  ))}
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.descricao || ""} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Observações..." rows={3} />
              </div>
              {mode === "create" && (
                <div className="flex items-center gap-2">
                  <Checkbox id="enviar-wpp" checked={enviarConfirmacao} onCheckedChange={(c) => setEnviarConfirmacao(!!c)} />
                  <Label htmlFor="enviar-wpp" className="cursor-pointer">Enviar confirmação via WhatsApp agora</Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {mode === "edit" ? "Salvar" : "Criar Agendamento"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
