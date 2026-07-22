import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Plus, Trash2, Clock, MessageSquare, Users, History, Loader2, CheckCircle2, XCircle, CalendarClock, Ban } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type Lembrete,
  lembreteModo,
  chaveLembrete,
  momentoEnvioLembrete,
  antecedenciaMinutos,
  lembreteAtivoValido,
  formatLembrete,
} from "@/lib/lembretes";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ConfigData {
  id?: string;
  organization_id: string;
  notif_ativa: boolean;
  lembretes: Lembrete[];
  mensagem_lembrete: string;
  notif_interna_ativa: boolean;
  notif_interna_minutos_antes: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "2 horas", value: 120 },
  { label: "24 horas", value: 1440 },
  { label: "48 horas", value: 2880 },
];

const DIAS_PRESETS = [
  { label: "No dia", value: 0 },
  { label: "1 dia", value: 1 },
  { label: "2 dias", value: 2 },
  { label: "3 dias", value: 3 },
  { label: "7 dias", value: 7 },
];

const VARIAVEIS = [
  { key: "{nome}", desc: "Nome do lead" },
  { key: "{data}", desc: "Data do atendimento" },
  { key: "{hora}", desc: "Hora do atendimento" },
  { key: "{tempo}", desc: "Tempo relativo" },
  { key: "{titulo}", desc: "Título do agendamento" },
];

const DADOS_FICTICIOS: Record<string, string> = {
  "{nome}": "Maria Silva",
  "{data}": "quarta-feira, 07 de maio",
  "{hora}": "14:30",
  "{tempo}": "amanhã",
  "{titulo}": "Consulta de Avaliação",
};

function substituirPreview(template: string): string {
  let msg = template ?? "";
  for (const [key, val] of Object.entries(DADOS_FICTICIOS)) {
    msg = msg.replaceAll(key, val);
  }
  return msg;
}

const DEFAULT_CONFIG: Omit<ConfigData, "organization_id"> = {
  notif_ativa: true,
  lembretes: [
    { ativo: true, modo: "relativo", minutos_antes: 1440 },
    { ativo: true, modo: "relativo", minutos_antes: 60 },
  ],
  mensagem_lembrete: "Olá {nome}! Lembramos que você tem um atendimento agendado para {data} às {hora} na nossa clínica. Confirme sua presença respondendo SIM.",
  notif_interna_ativa: true,
  notif_interna_minutos_antes: 30,
};

export default function ConfigNotificacoes({ isOpen, onClose }: Props) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [activeTextarea, setActiveTextarea] = useState<"lembrete" | null>(null);
  const [cancelandoKey, setCancelandoKey] = useState<string | null>(null);

  const { data: configDb, isLoading } = useQuery({
    queryKey: ["agendamento-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamento_config_notificacoes")
        .select("*")
        .eq("organization_id", orgId!)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!orgId && isOpen,
  });

  const { data: historicoLog = [] } = useQuery({
    queryKey: ["agendamento-notif-log", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamento_notif_log")
        .select("*, lead:leads(nome)")
        .eq("organization_id", orgId!)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && isOpen,
  });

  const { data: agendamentosFuturos = [] } = useQuery({
    queryKey: ["agendamentos-futuros-notif", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, titulo, data_hora_inicio, status, leads(nome)")
        .eq("organization_id", orgId!)
        .in("status", ["agendado", "confirmado"])
        .gt("data_hora_inicio", new Date().toISOString())
        .order("data_hora_inicio", { ascending: true })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && isOpen,
  });

  const agendamentoIds = useMemo(
    () => agendamentosFuturos.map((a) => a.id),
    [agendamentosFuturos]
  );

  const { data: notificacoesExistentes = [], refetch: refetchExistentes } = useQuery({
    queryKey: ["agendamento-notif-existentes", orgId, agendamentoIds.join(",")],
    queryFn: async () => {
      if (!agendamentoIds.length) return [];
      const { data, error } = await supabase
        .from("agendamento_notificacoes")
        .select("agendamento_id, chave_lembrete, status")
        .in("agendamento_id", agendamentoIds)
        .in("status", ["enviado", "cancelado", "pendente"]);
      if (error) throw error;
      return (data || []) as { agendamento_id: string; chave_lembrete: string | null; status: string }[];
    },
    enabled: !!orgId && isOpen && agendamentoIds.length > 0,
  });

  useEffect(() => {
    if (!orgId) return;
    if (configDb) {
      const lembretes = Array.isArray(configDb.lembretes) ? configDb.lembretes : DEFAULT_CONFIG.lembretes;
      setConfig({
        id: configDb.id,
        organization_id: orgId,
        notif_ativa: configDb.notif_ativa ?? true,
        lembretes: lembretes as Lembrete[],
        mensagem_lembrete: configDb.mensagem_lembrete || DEFAULT_CONFIG.mensagem_lembrete,
        notif_interna_ativa: configDb.notif_interna_ativa ?? true,
        notif_interna_minutos_antes: configDb.notif_interna_minutos_antes ?? 30,
      });
    } else if (!isLoading) {
      setConfig({ organization_id: orgId, ...DEFAULT_CONFIG });
    }
  }, [configDb, orgId, isLoading]);

  function updateLembrete(index: number, updates: Partial<Lembrete>) {
    if (!config) return;
    const lembretes = [...config.lembretes];
    lembretes[index] = { ...lembretes[index], ...updates };
    setConfig({ ...config, lembretes });
  }

  function addLembrete() {
    if (!config || config.lembretes.length >= 5) return;
    setConfig({ ...config, lembretes: [...config.lembretes, { ativo: true, modo: "relativo", minutos_antes: 30 }] });
  }

  function removeLembrete(index: number) {
    if (!config) return;
    setConfig({ ...config, lembretes: config.lembretes.filter((_, i) => i !== index) });
  }

  function insertVariable(varKey: string) {
    if (!config || !activeTextarea) return;
    setConfig({ ...config, mensagem_lembrete: config.mensagem_lembrete + varKey });
  }

  async function handleSalvar() {
    if (!config || !orgId) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        notif_ativa: config.notif_ativa,
        lembretes: config.lembretes,
        mensagem_lembrete: config.mensagem_lembrete,
        notif_interna_ativa: config.notif_interna_ativa,
        notif_interna_minutos_antes: config.notif_interna_minutos_antes,
        atualizado_em: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase
          .from("agendamento_config_notificacoes")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agendamento_config_notificacoes")
          .insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["agendamento-config", orgId] });
      toast.success("Configurações salvas com sucesso!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    }
    setSaving(false);
  }

  const previewLembrete = useMemo(() => config ? substituirPreview(config.mensagem_lembrete) : "", [config?.mensagem_lembrete]);

  const handledKeys = useMemo(() => {
    const s = new Set<string>();
    for (const n of notificacoesExistentes) {
      if (n.chave_lembrete) s.add(`${n.agendamento_id}-${n.chave_lembrete}`);
    }
    return s;
  }, [notificacoesExistentes]);

  const proximasNotifs = useMemo(() => {
    if (!config || !agendamentosFuturos.length) return [];
    const lembretes = (Array.isArray(config.lembretes) ? config.lembretes : []).filter(lembreteAtivoValido);
    if (!config.notif_ativa || lembretes.length === 0) return [];

    const agora = new Date();
    const result: {
      agendamento_id: string;
      lead_nome: string;
      titulo: string;
      momento_envio: Date;
      data_atendimento: Date;
      chave: string;
      antecedencia_minutos: number;
      label: string;
    }[] = [];

    for (const ag of agendamentosFuturos) {
      const dataInicio = new Date((ag as any).data_hora_inicio);
      const leadNome = (ag as any).leads?.nome || "Lead";
      for (const l of lembretes) {
        const chave = chaveLembrete(l);
        const key = `${ag.id}-${chave}`;
        if (handledKeys.has(key)) continue;
        const momentoEnvio = momentoEnvioLembrete(l, dataInicio);
        if (momentoEnvio && momentoEnvio > agora) {
          result.push({
            agendamento_id: ag.id,
            lead_nome: leadNome,
            titulo: (ag as any).titulo || "Atendimento",
            momento_envio: momentoEnvio,
            data_atendimento: dataInicio,
            chave,
            antecedencia_minutos: antecedenciaMinutos(l, dataInicio),
            label: formatLembrete(l),
          });
        }
      }
    }

    return result
      .sort((a, b) => a.momento_envio.getTime() - b.momento_envio.getTime())
      .slice(0, 15);
  }, [config, agendamentosFuturos, handledKeys]);

  async function handleCancelarNotif(agendamento_id: string, chave: string, antecedencia: number) {
    const key = `${agendamento_id}-${chave}`;
    setCancelandoKey(key);
    try {
      const { error } = await supabase.from("agendamento_notificacoes").insert({
        agendamento_id,
        organization_id: orgId!,
        tipo_destinatario: "lead",
        canal: "whatsapp",
        antecedencia_minutos: antecedencia,
        chave_lembrete: chave,
        status: "cancelado",
        data_hora_envio: new Date().toISOString(),
      });
      if (error) throw error;
      await refetchExistentes();
      toast.success("Notificação cancelada.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar.");
    }
    setCancelandoKey(null);
  }

  function formatMomentoEnvio(d: Date): string {
    if (isToday(d)) return `Hoje às ${format(d, "HH:mm")}`;
    if (isTomorrow(d)) return `Amanhã às ${format(d, "HH:mm")}`;
    return format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-2xl rounded-2xl border-border/60 p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-foreground font-display">Configurar Notificações</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Lembretes automáticos e confirmação por WhatsApp</p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {isLoading || !config ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : (
            <>
              {/* ━━━ LEMBRETES AUTOMÁTICOS ━━━ */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Lembretes Automáticos</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Mensagens enviadas antes do atendimento</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {config.notif_ativa ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={config.notif_ativa}
                      onCheckedChange={(v) => setConfig({ ...config, notif_ativa: v })}
                    />
                  </div>
                </div>

                {config.notif_ativa && (
                  <div className="px-5 py-4 space-y-3">
                    {config.lembretes.map((lembrete, i) => {
                      const modo = lembreteModo(lembrete);
                      return (
                        <div key={i} className="rounded-xl border border-border/60 bg-muted/[0.02] px-4 py-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Switch
                                checked={lembrete.ativo}
                                onCheckedChange={(v) => updateLembrete(i, { ativo: v })}
                              />
                              <span className="text-[13px] font-medium text-foreground">
                                {formatLembrete(lembrete)}
                              </span>
                            </div>
                            <button
                              onClick={() => removeLembrete(i)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Seletor de modalidade */}
                          <div className="inline-flex items-center gap-1 bg-muted/40 rounded-xl p-1">
                            <button
                              onClick={() => updateLembrete(i, { modo: "relativo" })}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                                modo === "relativo"
                                  ? "bg-foreground text-background shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Tempo antes
                            </button>
                            <button
                              onClick={() => updateLembrete(i, {
                                modo: "fixo",
                                dias_antes: lembrete.dias_antes ?? 1,
                                horario: lembrete.horario ?? "08:00",
                              })}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                                modo === "fixo"
                                  ? "bg-foreground text-background shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Horário fixo
                            </button>
                          </div>

                          {modo === "relativo" ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {PRESETS.map((p) => (
                                <button
                                  key={p.value}
                                  onClick={() => updateLembrete(i, { minutos_antes: p.value })}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                                    lembrete.minutos_antes === p.value
                                      ? "bg-foreground text-background border-foreground shadow-sm"
                                      : "bg-transparent text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                                  )}
                                >
                                  {p.label}
                                </button>
                              ))}
                              <div className="flex items-center gap-1.5 ml-1">
                                <Input
                                  type="number"
                                  className="w-16 h-7 text-[11px] rounded-lg border-border/60 text-center font-display tabular-nums"
                                  value={lembrete.minutos_antes}
                                  onChange={(e) => updateLembrete(i, { minutos_antes: parseInt(e.target.value) || 15 })}
                                  min={1}
                                />
                                <span className="text-[11px] text-muted-foreground">min</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {DIAS_PRESETS.map((p) => (
                                  <button
                                    key={p.value}
                                    onClick={() => updateLembrete(i, { dias_antes: p.value })}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                                      (lembrete.dias_antes ?? 1) === p.value
                                        ? "bg-foreground text-background border-foreground shadow-sm"
                                        : "bg-transparent text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                                    )}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                                <div className="flex items-center gap-1.5 ml-1">
                                  <Input
                                    type="number"
                                    className="w-14 h-7 text-[11px] rounded-lg border-border/60 text-center font-display tabular-nums"
                                    value={lembrete.dias_antes ?? 1}
                                    onChange={(e) => updateLembrete(i, { dias_antes: Math.max(0, parseInt(e.target.value) || 0) })}
                                    min={0}
                                  />
                                  <span className="text-[11px] text-muted-foreground">dias antes</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground">às</span>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <Input
                                    type="time"
                                    step={300}
                                    className="w-[112px] h-8 text-[12px] rounded-lg border-border/60 tabular-nums font-display"
                                    value={lembrete.horario ?? "08:00"}
                                    onChange={(e) => updateLembrete(i, { horario: e.target.value || "08:00" })}
                                  />
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                                Enviado sempre nesse horário (fuso de Brasília), independente da hora do atendimento. Se o horário já tiver passado quando o agendamento for criado, este lembrete não é enviado.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {config.lembretes.length < 5 && (
                      <button
                        onClick={addLembrete}
                        className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border/60 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar lembrete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ━━━ MENSAGEM DO LEMBRETE ━━━ */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Mensagem do Lembrete</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Texto enviado nos lembretes automáticos</p>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <Textarea
                    value={config.mensagem_lembrete}
                    onChange={(e) => setConfig({ ...config, mensagem_lembrete: e.target.value })}
                    onFocus={() => setActiveTextarea("lembrete")}
                    rows={3}
                    placeholder="Escreva a mensagem de lembrete..."
                    className="rounded-xl text-sm border-border/60 resize-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mr-0.5">Variáveis:</span>
                    {VARIAVEIS.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        title={v.desc}
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 border border-border/40 text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-all"
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/50 mb-1.5">Preview</p>
                    <p className="text-[13px] text-emerald-900/80 leading-relaxed">{previewLembrete}</p>
                  </div>
                </div>
              </div>

              {/* ━━━ NOTIFICAÇÃO INTERNA ━━━ */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Notificação Interna do Time</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Alerta para os atendentes antes do horário</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notif_interna_ativa}
                    onCheckedChange={(v) => setConfig({ ...config, notif_interna_ativa: v })}
                  />
                </div>

                {config.notif_interna_ativa && (
                  <div className="px-5 py-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">Alertar</span>
                      <Input
                        type="number"
                        className="w-16 h-8 text-sm rounded-lg border-border/60 text-center font-display tabular-nums"
                        value={config.notif_interna_minutos_antes}
                        onChange={(e) => setConfig({ ...config, notif_interna_minutos_antes: parseInt(e.target.value) || 30 })}
                        min={5}
                      />
                      <span className="text-[13px] text-muted-foreground">minutos antes</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
                      Aparecerá como notificação no CRM para todos os usuários da organização.
                    </p>
                  </div>
                )}
              </div>

              {/* ━━━ PRÓXIMAS NOTIFICAÇÕES ━━━ */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próximas Notificações</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Lembretes programados para os próximos atendimentos</p>
                    </div>
                  </div>
                </div>

                {!config?.notif_ativa ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-2">
                      <CalendarClock className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-[13px] font-medium text-muted-foreground">Lembretes desativados</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Ative os lembretes para ver as notificações programadas</p>
                  </div>
                ) : proximasNotifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-2">
                      <CalendarClock className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-[13px] font-medium text-muted-foreground">Nenhum envio programado</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Crie agendamentos futuros para ver os lembretes aqui</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {proximasNotifs.map((notif) => {
                      const key = `${notif.agendamento_id}-${notif.chave}`;
                      const isCancelling = cancelandoKey === key;
                      return (
                        <div key={key} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center shrink-0">
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {notif.lead_nome}
                              </p>
                              <p className="text-[11px] text-muted-foreground/60 truncate">
                                {notif.titulo}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <div className="text-right">
                              <p className="text-[11px] font-medium text-foreground font-display tabular-nums">
                                {formatMomentoEnvio(notif.momento_envio)}
                              </p>
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                {notif.label}
                              </p>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60">
                              pendente
                            </span>
                            <button
                              onClick={() => handleCancelarNotif(notif.agendamento_id, notif.chave, notif.antecedencia_minutos)}
                              disabled={!!cancelandoKey}
                              title="Cancelar envio"
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all disabled:opacity-30"
                            >
                              {isCancelling
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Ban className="h-3.5 w-3.5" />
                              }
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ━━━ HISTÓRICO RECENTE ━━━ */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico Recente</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Últimas 10 notificações enviadas</p>
                    </div>
                  </div>
                </div>

                {historicoLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-2">
                      <History className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-[13px] font-medium text-muted-foreground">Nenhuma notificação enviada ainda</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">O histórico aparecerá aqui</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {historicoLog.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {log.status === "enviado" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive/60 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">
                              {log.lead?.nome || "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground/60 font-display tabular-nums">
                              {log.criado_em ? format(parseISO(log.criado_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 text-muted-foreground">
                            {log.tipo}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground px-4 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving || isLoading}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 flex items-center disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar configurações
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
