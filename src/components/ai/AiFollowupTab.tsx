import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Bot,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Users,
  Pause,
  Send,
  RefreshCw,
  TrendingUp,
  ExternalLink,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { addMinutes, endOfDay, format, formatDistanceToNow, isPast, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { AiFollowupConfig } from "./AiFollowupConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FollowupLog {
  id: string;
  lead_id: string;
  tentativa: number;
  status: string;
  mensagem_enviada: string | null;
  motivo_ia: string | null;
  enviado_em: string;
  leads: { nome: string | null; telefone: string | null; followup_manual?: boolean } | null;
}

interface ActiveLead {
  id: string;
  nome: string | null;
  telefone: string | null;
  followup_tentativas: number;
  followup_ultima_tentativa: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType; iconClass: string; badgeClass: string }
> = {
  enviado: {
    label: "Enviado",
    Icon: CheckCircle2,
    iconClass: "text-green-500",
    badgeClass: "border-green-200/60 bg-green-50 text-green-700",
  },
  ignorado_ia: {
    label: "IA ignorou",
    Icon: Bot,
    iconClass: "text-blue-500",
    badgeClass: "border-blue-200/60 bg-blue-50 text-blue-700",
  },
  fora_horario: {
    label: "Fora do horário",
    Icon: Clock,
    iconClass: "text-amber-500",
    badgeClass: "border-amber-200/60 bg-amber-50 text-amber-700",
  },
  lead_respondeu: {
    label: "Lead respondeu",
    Icon: MessageSquare,
    iconClass: "text-emerald-500",
    badgeClass: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  },
  erro: {
    label: "Erro",
    Icon: XCircle,
    iconClass: "text-red-500",
    badgeClass: "border-red-200/60 bg-red-50 text-red-700",
  },
};

export function AiFollowupTab() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"config" | "analise">("analise");
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const { data: logs } = useQuery({
    queryKey: ["followup-logs-full", orgId, dateRange],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from("ia_followup_log")
        .select("*, leads!lead_id(nome, telefone, followup_manual)")
        .eq("organization_id", orgId)
        .order("enviado_em", { ascending: false })
        .limit(500);

      if (dateRange?.from) {
        query = query.gte("enviado_em", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("enviado_em", endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FollowupLog[];
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const { data: activeLeads } = useQuery({
    queryKey: ["followup-active-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, followup_tentativas, followup_ultima_tentativa")
        .eq("organization_id", orgId)
        .eq("ia_ativa", true)
        .eq("followup_pausado", false)
        .gt("followup_tentativas", 0)
        .order("followup_ultima_tentativa", { ascending: false })
        .limit(10);
      return (data || []) as ActiveLead[];
    },
    enabled: !!orgId,
    refetchInterval: 60000,
  });

  const { data: manualLeads } = useQuery({
    queryKey: ["followup-manual-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, followup_tentativas, followup_ultima_tentativa, followup_pausado, ultimo_contato")
        .eq("organization_id", orgId)
        .eq("followup_manual", true)
        .order("atualizado_em", { ascending: false })
        .limit(50);
      return (data || []) as (ActiveLead & { followup_pausado?: boolean; ultimo_contato?: string | null })[];
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const { data: followupConfig } = useQuery({
    queryKey: ["followup-config-seq", orgId],
    queryFn: async () => {
      if (!orgId) return [] as Array<{ ordem: number; minutos: number; ativo: boolean }>;
      const { data } = await supabase
        .from("ia_followup_config")
        .select("sequencia")
        .eq("organization_id", orgId)
        .maybeSingle();
      const seq = data?.sequencia;
      return (Array.isArray(seq) ? seq : []) as Array<{ ordem: number; minutos: number; ativo: boolean }>;
    },
    enabled: !!orgId,
  });

  const seqArray = Array.isArray(followupConfig) ? followupConfig : [];

  const { data: pausedLeads } = useQuery({
    queryKey: ["followup-paused-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [] as ActiveLead[];
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, followup_tentativas, followup_ultima_tentativa")
        .eq("organization_id", orgId)
        .eq("ia_ativa", true)
        .eq("followup_pausado", true)
        .order("followup_ultima_tentativa", { ascending: false })
        .limit(100);
      return (data ?? []) as ActiveLead[];
    },
    enabled: !!orgId,
    refetchInterval: 60000,
  });
  const pausedCount = pausedLeads?.length ?? 0;

  const enviados = logs?.filter((l) => l.status === "enviado") ?? [];
  const ignorados = logs?.filter((l) => l.status === "ignorado_ia") ?? [];
  const erros = logs?.filter((l) => l.status === "erro") ?? [];
  const recuperadosLogs = logs?.filter((l) => l.status === "lead_respondeu") ?? [];

  const alcancadosUnicos = new Set(enviados.map((l) => l.lead_id));
  const recuperadosUnicos = new Set(recuperadosLogs.map((l) => l.lead_id));
  const taxaRecuperacao =
    alcancadosUnicos.size > 0
      ? Math.round((recuperadosUnicos.size / alcancadosUnicos.size) * 100)
      : 0;

  const recuperacaoPorTentativa = recuperadosLogs.reduce<Record<number, number>>((acc, l) => {
    acc[l.tentativa] = (acc[l.tentativa] ?? 0) + 1;
    return acc;
  }, {});
  const maxTentativas = Math.max(
    ...enviados.map((l) => l.tentativa),
    3,
  );

  const kpis = [
    {
      label: "Enviados no período",
      value: enviados.length,
      sub: "follow-ups enviados com sucesso",
      Icon: Send,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
      valueColor: "text-green-600",
    },
    {
      label: "Em acompanhamento",
      value: activeLeads?.length ?? 0,
      sub: "leads ativos no ciclo agora",
      Icon: RefreshCw,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      valueColor: "text-blue-600",
    },
    {
      label: "IA ignorou",
      value: ignorados.length,
      sub: "lead já respondeu ou encerrou",
      Icon: Bot,
      iconBg: "bg-muted/60",
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    {
      label: "Esgotaram tentativas",
      value: pausedCount ?? 0,
      sub: "aguardando nova mensagem",
      Icon: Pause,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      valueColor: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="inline-flex bg-muted/40 rounded-xl p-1 gap-0.5">
          {(
            [
              { key: "analise", label: "Análise" },
              { key: "config", label: "Configuração" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                activeTab === key
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === "analise" && (
          <DateRangePicker date={dateRange} setDate={setDateRange} />
        )}
      </div>

      {/* Config tab */}
      {activeTab === "config" && <AiFollowupConfig />}

      {/* Análise tab */}
      {activeTab === "analise" && (
        <div className="space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {kpis.map(({ label, value, sub, Icon, iconBg, iconColor, valueColor }) => (
              <button
                key={label}
                onClick={() => setOpenCard(label)}
                className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 text-left hover:shadow-md hover:border-border/80 transition-all group"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                </div>
                <p className={`text-2xl font-bold font-display tabular-nums leading-none ${valueColor}`}>
                  {value}
                </p>
                <p className="text-[12px] font-semibold text-foreground mt-1">{label}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>

      {/* Recovery section */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                RECUPERAÇÃO DE LEADS
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                Leads que responderam após receber follow-up no período
              </p>
            </div>
          </div>
        </div>
        <div className="p-5">
          {alcancadosUnicos.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Sem dados no período</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                Follow-ups ainda não foram enviados neste intervalo
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Métricas principais */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-muted/30 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                    LEADS ALCANÇADOS
                  </p>
                  <p className="text-2xl font-bold font-display tabular-nums text-foreground">
                    {alcancadosUnicos.size}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    receberam ao menos 1 follow-up
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-2">
                    LEADS RECUPERADOS
                  </p>
                  <p className="text-2xl font-bold font-display tabular-nums text-emerald-600">
                    {recuperadosUnicos.size}
                  </p>
                  <p className="text-[11px] text-emerald-600/60 mt-1">
                    responderam após o follow-up
                  </p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                    TAXA DE RECUPERAÇÃO
                  </p>
                  <p className={`text-2xl font-bold font-display tabular-nums ${taxaRecuperacao >= 20 ? "text-emerald-600" : taxaRecuperacao >= 10 ? "text-amber-500" : "text-foreground"}`}>
                    {taxaRecuperacao}%
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {taxaRecuperacao >= 20 ? "acima da média" : taxaRecuperacao >= 10 ? "dentro da média" : "abaixo da média"}
                  </p>
                </div>
              </div>

              {/* Distribuição por tentativa */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
                  RECUPERAÇÕES POR TENTATIVA
                </p>
                <div className="space-y-2">
                  {seqArray.map((s) => {
                    const t = s.ordem;
                    const count = recuperacaoPorTentativa[t] ?? 0;
                    const enviadosNaTentativa = enviados.filter((l) => l.tentativa === t).length;
                    const pct = enviadosNaTentativa > 0 ? Math.round((count / enviadosNaTentativa) * 100) : 0;
                    const barWidth = recuperadosLogs.length > 0 ? Math.round((count / recuperadosLogs.length) * 100) : 0;
                    return (
                      <div key={t} className="flex items-center gap-3">
                        <span className="text-[11px] font-mono font-semibold text-muted-foreground w-6 shrink-0">
                          T{t}
                        </span>
                        <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-foreground font-medium w-4 text-right shrink-0">
                          {count}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 w-12 shrink-0">
                          ({pct}% env.)
                        </span>
                      </div>
                    );
                  })}
                </div>
                {recuperadosLogs.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/50 text-center py-3">
                    Nenhuma recuperação registrada no período
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual follow-ups */}
      {manualLeads && manualLeads.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.02] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-500/20 bg-amber-500/[0.04]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10">
                <UserCheck className="h-3.5 w-3.5 text-amber-600" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700/80">
                  FOLLOW-UPS MANUAIS
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  Leads ativados manualmente para follow-up com IA
                </p>
              </div>
              <span className="ml-auto text-[11px] font-bold tabular-nums bg-amber-500/10 text-amber-700 rounded-lg px-2.5 py-1">
                {manualLeads.length}
              </span>
            </div>
          </div>
          <div className="p-4 space-y-1.5">
            {manualLeads.map((lead) => {
              const tentativas = lead.followup_tentativas ?? 0;
              const isPaused = lead.followup_pausado;
              const nextStep = seqArray.find(
                (s) => s.ordem === tentativas + 1 && s.ativo,
              );

              let referenciaStr = tentativas === 0 ? lead.ultimo_contato : lead.followup_ultima_tentativa;
              if (!referenciaStr && lead.ultimo_contato) referenciaStr = lead.ultimo_contato;

              let nextAt: Date | null = null;
              let overdue = false;
              if (nextStep && referenciaStr) {
                nextAt = addMinutes(new Date(referenciaStr), nextStep.minutos);
                overdue = isPast(nextAt);
              }

              let statusText = "";
              let statusColor = "text-muted-foreground/60";
              if (isPaused) {
                statusText = "Tentativas esgotadas · aguardando resposta";
                statusColor = "text-amber-500";
              } else if (tentativas === 0 && nextAt && !overdue) {
                statusText = `1ª tentativa ${formatDistanceToNow(nextAt, { addSuffix: true, locale: ptBR })} · ${format(nextAt, "HH:mm")}`;
                statusColor = "text-blue-500";
              } else if (tentativas === 0 && overdue) {
                statusText = "1ª tentativa pendente · aguardando cron";
                statusColor = "text-amber-500";
              } else if (nextAt && !overdue) {
                statusText = `Próxima (T${tentativas + 1}) ${formatDistanceToNow(nextAt, { addSuffix: true, locale: ptBR })} · ${format(nextAt, "HH:mm")}`;
                statusColor = "text-blue-500";
              } else if (overdue) {
                statusText = `T${tentativas + 1} pendente · aguardando cron`;
                statusColor = "text-amber-500";
              } else if (!nextStep && !isPaused) {
                statusText = "Ativado · aguardando processamento";
                statusColor = "text-blue-500";
              }

              return (
                <div
                  key={lead.id}
                  onClick={() => navigate(`/crm/leads/${lead.id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate">
                      {lead.nome || lead.telefone || "—"}
                    </p>
                    <p className={`text-[10px] ${statusColor}`}>{statusText}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.max(seqArray.filter(s => s.ativo).length, 3) }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i < tentativas
                            ? "bg-amber-500"
                            : isPaused && i < seqArray.filter(s => s.ativo).length
                            ? "bg-amber-500/30"
                            : "bg-border"
                        }`}
                      />
                    ))}
                    <span className="ml-1.5 text-[10px] font-mono text-muted-foreground tabular-nums">
                      T{tentativas}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active leads */}
      {activeLeads && activeLeads.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  LEADS EM ACOMPANHAMENTO
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  Receberam follow-up e aguardam próxima tentativa
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-1.5">
            {activeLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate">
                    {lead.nome || lead.telefone || "—"}
                  </p>
                  {lead.followup_ultima_tentativa && (() => {
                    const nextStep = seqArray.find(
                      (s) => s.ordem === (lead.followup_tentativas ?? 0) + 1 && s.ativo,
                    );
                    if (!nextStep) {
                      return (
                        <p className="text-[10px] text-muted-foreground/60">
                          Última tentativa enviada · aguardando resposta
                        </p>
                      );
                    }
                    const nextAt = addMinutes(new Date(lead.followup_ultima_tentativa), nextStep.minutos);
                    const overdue = isPast(nextAt);
                    return (
                      <p className={`text-[10px] ${overdue ? "text-amber-500" : "text-muted-foreground/60"}`}>
                        {overdue
                          ? "Próxima tentativa pendente · aguardando cron"
                          : `Próxima tentativa ${formatDistanceToNow(nextAt, { addSuffix: true, locale: ptBR })} · ${format(nextAt, "HH:mm", { locale: ptBR })}`}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i < (lead.followup_tentativas ?? 0)
                          ? "bg-foreground"
                          : "bg-border"
                      }`}
                    />
                  ))}
                  <span className="ml-1.5 text-[10px] font-mono text-muted-foreground tabular-nums">
                    T{lead.followup_tentativas ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div
        data-tutorial="ia-followup-history"
        className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                HISTÓRICO DE FOLLOW-UPS
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                Filtre por período · atualiza a cada 30s
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-4">
          <span className="text-[11px] text-muted-foreground/60 tabular-nums">
            {(logs ?? []).length} registro{(logs ?? []).length !== 1 ? "s" : ""} no período
          </span>
        </div>

        <div className="p-5">
          {(logs ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <Bot className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum follow-up no período selecionado
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                Tente selecionar um intervalo de datas diferente
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="pb-2.5 pr-2 w-4" />
                    <th className="pb-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      Lead
                    </th>
                    <th className="pb-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      Tent.
                    </th>
                    <th className="pb-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      Status
                    </th>
                    <th className="pb-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      Mensagem
                    </th>
                    <th className="pb-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(logs ?? []).map((log) => {
                    const st = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.erro;
                    const { Icon: StatusIcon } = st;
                    const leadName =
                      (log.leads as any)?.nome ||
                      (log.leads as any)?.telefone ||
                      "Lead";
                    const isManual = (log.leads as any)?.followup_manual === true;
                    const isExpanded = expandedRow === log.id;
                    const hasDetail =
                      (log.status === "enviado" && log.mensagem_enviada) ||
                      (log.status === "ignorado_ia" && log.motivo_ia);

                    return (
                      <>
                        <tr
                          key={log.id}
                          onClick={() =>
                            hasDetail && setExpandedRow(isExpanded ? null : log.id)
                          }
                          className={`group transition-colors ${
                            hasDetail ? "cursor-pointer hover:bg-muted/20" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-2 w-4">
                            {hasDetail && (
                              <div className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-semibold text-[12px]">
                            <span className="flex items-center gap-1.5">
                              {leadName}
                              {isManual && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-amber-200/60 bg-amber-50 text-amber-600">
                                  Manual
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-muted text-[11px] font-bold tabular-nums">
                              {log.tentativa}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-medium ${st.badgeClass}`}
                            >
                              <StatusIcon className={`h-3 w-3 ${st.iconClass}`} />
                              {st.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 max-w-[200px]">
                            <span className="truncate block text-[11px] text-muted-foreground">
                              {log.mensagem_enviada || log.motivo_ia || "—"}
                            </span>
                          </td>
                          <td className="py-2.5 whitespace-nowrap">
                            <p className="text-[11px] text-foreground/70">
                              {format(new Date(log.enviado_em), "dd/MM HH:mm")}
                            </p>
                            <p className="text-[10px] text-muted-foreground/50">
                              {formatDistanceToNow(new Date(log.enviado_em), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </td>
                        </tr>

                        {isExpanded && hasDetail && (
                          <tr key={`${log.id}-detail`}>
                            <td colSpan={6} className="py-0">
                              <div className="mx-5 mb-3 mt-0.5 rounded-xl bg-muted/30 border border-border/40 px-4 py-3">
                                {log.status === "enviado" && log.mensagem_enviada && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Mensagem enviada
                                      </span>
                                    </div>
                                    <p className="text-[12px] leading-relaxed text-foreground">
                                      "{log.mensagem_enviada}"
                                    </p>
                                  </div>
                                )}
                                {log.status === "ignorado_ia" && log.motivo_ia && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <Bot className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Decisão da IA
                                      </span>
                                    </div>
                                    <p className="text-[12px] leading-relaxed text-foreground">
                                      {log.motivo_ia}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
        </div>
      )}

      {/* Dialog de leads por card */}
      {(() => {
        const cardLeads: { id: string; nome: string | null; telefone: string | null }[] = (() => {
          if (openCard === "Enviados no período") {
            const seen = new Set<string>();
            return enviados
              .filter((l) => { if (seen.has(l.lead_id)) return false; seen.add(l.lead_id); return true; })
              .map((l) => ({ id: l.lead_id, nome: (l.leads as any)?.nome ?? null, telefone: (l.leads as any)?.telefone ?? null }));
          }
          if (openCard === "Em acompanhamento") return activeLeads ?? [];
          if (openCard === "IA ignorou") {
            const seen = new Set<string>();
            return ignorados
              .filter((l) => { if (seen.has(l.lead_id)) return false; seen.add(l.lead_id); return true; })
              .map((l) => ({ id: l.lead_id, nome: (l.leads as any)?.nome ?? null, telefone: (l.leads as any)?.telefone ?? null }));
          }
          if (openCard === "Esgotaram tentativas") return pausedLeads ?? [];
          return [];
        })();

        return (
          <Dialog open={!!openCard} onOpenChange={(o) => !o && setOpenCard(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">{openCard}</DialogTitle>
              </DialogHeader>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {cardLeads.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-6">Nenhum lead neste grupo</p>
                ) : (
                  cardLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => { setOpenCard(null); navigate(`/crm/leads/${lead.id}`); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div>
                        <p className="text-[12px] font-semibold">{lead.nome || lead.telefone || "—"}</p>
                        {lead.nome && lead.telefone && (
                          <p className="text-[10px] text-muted-foreground/60">{lead.telefone}</p>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
