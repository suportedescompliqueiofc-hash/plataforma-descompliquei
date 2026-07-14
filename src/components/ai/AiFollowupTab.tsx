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
  UserCheck,
  Zap,
} from "lucide-react";
import { addMinutes, endOfDay, format, formatDistanceToNow, isPast, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { AiFollowupConfig } from "./AiFollowupConfig";
import { FollowupGapWidget } from "@/components/dashboard/FollowupGapWidget";
import { useDashboardLeadsModal } from "@/contexts/DashboardLeadsModalContext";

type FollowupTipo = "automatico" | "manual";

interface FollowupLog {
  id: string;
  lead_id: string;
  tentativa: number;
  status: string;
  mensagem_enviada: string | null;
  motivo_ia: string | null;
  enviado_em: string;
  tipo: FollowupTipo | null;
  leads: { nome: string | null; telefone: string | null } | null;
}

interface TrackLead {
  id: string;
  nome: string | null;
  telefone: string | null;
  followup_tentativas: number;
  followup_ultima_tentativa: string | null;
  followup_pausado?: boolean | null;
  ultimo_contato?: string | null;
}

interface SeqStep {
  ordem: number;
  minutos: number;
  ativo: boolean;
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

/** Config visual de cada trilho (automático x manual) */
const TRACK_META: Record<
  FollowupTipo,
  {
    label: string;
    descricao: string;
    Icon: React.ElementType;
    dot: string;
    activeDot: string;
    accentText: string;
    accentIconBg: string;
  }
> = {
  automatico: {
    label: "Automático",
    descricao: "Disparado sozinho pela IA enquanto ela atende o lead",
    Icon: Zap,
    dot: "bg-blue-500",
    activeDot: "bg-blue-500/30",
    accentText: "text-blue-600",
    accentIconBg: "bg-blue-50",
  },
  manual: {
    label: "Manual",
    descricao: "Resgate ativado no botão \"Follow IA\" pela equipe",
    Icon: UserCheck,
    dot: "bg-amber-500",
    activeDot: "bg-amber-500/30",
    accentText: "text-amber-600",
    accentIconBg: "bg-amber-50",
  },
};

// ————————————————————————————————————————————————————————————————
// Componente de um trilho (Automático OU Manual) — KPIs, recuperação,
// leads no ciclo e histórico, todos filtrados para aquele tipo.
// ————————————————————————————————————————————————————————————————
function TrackPanel({
  variant,
  logs,
  activeLeads,
  pausedLeads,
  seqArray,
  historyTutorialTarget,
}: {
  variant: FollowupTipo;
  logs: FollowupLog[];
  activeLeads: TrackLead[];
  pausedLeads: TrackLead[];
  seqArray: SeqStep[];
  historyTutorialTarget?: boolean;
}) {
  const navigate = useNavigate();
  const { openModal } = useDashboardLeadsModal();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const meta = TRACK_META[variant];

  const enviados = logs.filter((l) => l.status === "enviado");
  const ignorados = logs.filter((l) => l.status === "ignorado_ia");
  const recuperadosLogs = logs.filter((l) => l.status === "lead_respondeu");

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

  const ativosSeq = seqArray.filter((s) => s.ativo);

  // Deduplica leads a partir dos logs (id/nome/telefone) para abrir no painel rico
  const dedupeLogLeads = (arr: FollowupLog[]) => {
    const seen = new Set<string>();
    return arr
      .filter((l) => { if (seen.has(l.lead_id)) return false; seen.add(l.lead_id); return true; })
      .map((l) => ({ id: l.lead_id, nome: l.leads?.nome ?? null, telefone: l.leads?.telefone ?? null }));
  };

  // Abre o mesmo painel rico do dashboard, no contexto follow-up (timeline dos disparos)
  const openLeads = (label: string, list: any[]) => {
    if (!list || list.length === 0) return;
    openModal(`${label} · ${meta.label}`, list, "followup");
  };

  const kpis = [
    {
      label: "Enviados no período",
      value: enviados.length,
      sub: "follow-ups enviados com sucesso",
      Icon: Send,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
      valueColor: "text-green-600",
      leads: dedupeLogLeads(enviados),
    },
    {
      label: "Em acompanhamento",
      value: activeLeads.length,
      sub: "leads no ciclo agora",
      Icon: RefreshCw,
      iconBg: meta.accentIconBg,
      iconColor: meta.accentText,
      valueColor: meta.accentText,
      leads: activeLeads,
    },
    {
      label: "IA ignorou",
      value: ignorados.length,
      sub: "lead já respondeu ou encerrou",
      Icon: Bot,
      iconBg: "bg-muted/60",
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
      leads: dedupeLogLeads(ignorados),
    },
    {
      label: "Esgotaram tentativas",
      value: pausedLeads.length,
      sub: "aguardando nova mensagem",
      Icon: Pause,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      valueColor: "text-amber-600",
      leads: pausedLeads,
    },
  ];

  const renderLeadRow = (lead: TrackLead) => {
    const tentativas = lead.followup_tentativas ?? 0;
    const isPaused = !!lead.followup_pausado;
    const nextStep = seqArray.find((s) => s.ordem === tentativas + 1 && s.ativo);

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
      statusColor = meta.accentText;
    } else if (tentativas === 0 && overdue) {
      statusText = "1ª tentativa pendente · aguardando cron";
      statusColor = "text-amber-500";
    } else if (nextAt && !overdue) {
      statusText = `Próxima (T${tentativas + 1}) ${formatDistanceToNow(nextAt, { addSuffix: true, locale: ptBR })} · ${format(nextAt, "HH:mm")}`;
      statusColor = meta.accentText;
    } else if (overdue) {
      statusText = `T${tentativas + 1} pendente · aguardando cron`;
      statusColor = "text-amber-500";
    } else if (!nextStep && !isPaused) {
      statusText = "Última tentativa enviada · aguardando resposta";
      statusColor = "text-muted-foreground/60";
    }

    const dotTotal = Math.max(ativosSeq.length, 3);

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
          {Array.from({ length: dotTotal }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < tentativas
                  ? meta.dot
                  : isPaused && i < ativosSeq.length
                  ? meta.activeDot
                  : "bg-border"
              }`}
            />
          ))}
          <span className="ml-1.5 text-[10px] font-display text-muted-foreground tabular-nums">
            T{tentativas}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(({ label, value, sub, Icon, iconBg, iconColor, valueColor, leads: cardLeads }) => (
          <button
            key={label}
            onClick={() => openLeads(label, cardLeads)}
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

      {/* Recuperação */}
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
                Leads que responderam após o follow-up {meta.label.toLowerCase()} no período
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
              <p className="text-sm font-medium font-display text-muted-foreground">Sem dados no período</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                Nenhum follow-up {meta.label.toLowerCase()} foi enviado neste intervalo
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => openLeads("Leads alcançados", dedupeLogLeads(enviados))}
                  className="rounded-xl bg-muted/30 p-4 text-left hover:bg-muted/50 hover:shadow-sm transition-all"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                    LEADS ALCANÇADOS
                  </p>
                  <p className="text-2xl font-bold font-display tabular-nums text-foreground">
                    {alcancadosUnicos.size}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    receberam ao menos 1 follow-up
                  </p>
                </button>
                <button
                  onClick={() => openLeads("Leads recuperados", dedupeLogLeads(recuperadosLogs))}
                  className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-left hover:bg-emerald-100/70 hover:shadow-sm transition-all"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-2">
                    LEADS RECUPERADOS
                  </p>
                  <p className="text-2xl font-bold font-display tabular-nums text-emerald-600">
                    {recuperadosUnicos.size}
                  </p>
                  <p className="text-[11px] text-emerald-600/60 mt-1">
                    responderam após o follow-up
                  </p>
                </button>
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
                        <span className="text-[11px] font-display tabular-nums text-foreground font-medium w-4 text-right shrink-0">
                          {count}
                        </span>
                        <span className="text-[10px] font-display tabular-nums text-muted-foreground/50 w-12 shrink-0">
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

      {/* Leads no ciclo */}
      {(activeLeads.length > 0 || pausedLeads.length > 0) && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  LEADS NO CICLO {meta.label.toUpperCase()}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  Em acompanhamento e aguardando a próxima tentativa
                </p>
              </div>
              <span className="ml-auto text-[11px] font-bold font-display tabular-nums bg-muted text-muted-foreground rounded-lg px-2.5 py-1">
                {activeLeads.length + pausedLeads.length}
              </span>
            </div>
          </div>
          <div className="p-4 space-y-1.5">
            {activeLeads.map(renderLeadRow)}
            {pausedLeads.map(renderLeadRow)}
          </div>
        </div>
      )}

      {/* Histórico */}
      <div
        {...(historyTutorialTarget ? { "data-tutorial": "ia-followup-history" } : {})}
        className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                HISTÓRICO DE FOLLOW-UPS {meta.label.toUpperCase()}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                Filtre por período · atualiza a cada 30s
              </p>
            </div>
            <span className="ml-auto text-[11px] text-muted-foreground/60 tabular-nums">
              {logs.length} registro{logs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="p-5">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <Bot className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium font-display text-muted-foreground">
                Nenhum follow-up {meta.label.toLowerCase()} no período
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
                  {logs.map((log) => {
                    const st = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.erro;
                    const { Icon: StatusIcon } = st;
                    const leadName = log.leads?.nome || log.leads?.telefone || "Lead";
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
                            {leadName}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-muted text-[11px] font-bold font-display tabular-nums">
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
                            <p className="text-[11px] text-foreground/70 font-display tabular-nums">
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
  );
}

// ————————————————————————————————————————————————————————————————
export function AiFollowupTab() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const [track, setTrack] = useState<FollowupTipo>("automatico");
  const [autoView, setAutoView] = useState<"analise" | "config">("analise");
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
        .select("id, lead_id, tentativa, status, mensagem_enviada, motivo_ia, enviado_em, tipo, leads!lead_id(nome, telefone)")
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
      return (data || []) as unknown as FollowupLog[];
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  // Leads no ciclo AUTOMÁTICO (IA ativa, sem follow manual, já com ao menos 1 tentativa)
  const { data: autoLeads } = useQuery({
    queryKey: ["followup-auto-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [] as TrackLead[];
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, followup_tentativas, followup_ultima_tentativa, followup_pausado, ultimo_contato")
        .eq("organization_id", orgId)
        .eq("ia_ativa", true)
        .eq("followup_manual", false)
        .gt("followup_tentativas", 0)
        .order("followup_ultima_tentativa", { ascending: false })
        .limit(100);
      return (data || []) as TrackLead[];
    },
    enabled: !!orgId,
    refetchInterval: 60000,
  });

  // Leads no ciclo MANUAL (followup_manual = true, qualquer tentativa)
  const { data: manualLeads } = useQuery({
    queryKey: ["followup-manual-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [] as TrackLead[];
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, followup_tentativas, followup_ultima_tentativa, followup_pausado, ultimo_contato")
        .eq("organization_id", orgId)
        .eq("followup_manual", true)
        .order("atualizado_em", { ascending: false })
        .limit(100);
      return (data || []) as TrackLead[];
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const { data: followupConfig } = useQuery({
    queryKey: ["followup-config-seq", orgId],
    queryFn: async () => {
      if (!orgId) return [] as SeqStep[];
      const { data } = await supabase
        .from("ia_followup_config")
        .select("sequencia")
        .eq("organization_id", orgId)
        .maybeSingle();
      const seq = data?.sequencia;
      return (Array.isArray(seq) ? seq : []) as SeqStep[];
    },
    enabled: !!orgId,
  });

  const seqArray = Array.isArray(followupConfig) ? followupConfig : [];

  const allLogs = logs ?? [];
  const logsAuto = allLogs.filter((l) => l.tipo !== "manual");
  const logsManual = allLogs.filter((l) => l.tipo === "manual");

  const autoActive = (autoLeads ?? []).filter((l) => !l.followup_pausado);
  const autoPaused = (autoLeads ?? []).filter((l) => l.followup_pausado);
  const manualActive = (manualLeads ?? []).filter((l) => !l.followup_pausado);
  const manualPaused = (manualLeads ?? []).filter((l) => l.followup_pausado);

  const showDatePicker = !(track === "automatico" && autoView === "config");

  return (
    <div className="space-y-4">
      {/* Abas principais: Automático | Manual — os dois fluxos são coisas distintas */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex bg-muted/40 rounded-xl p-1 gap-0.5" data-tutorial="ia-followup-tabs">
          {(Object.keys(TRACK_META) as FollowupTipo[]).map((key) => {
            const m = TRACK_META[key];
            const isActive = track === key;
            return (
              <button
                key={key}
                data-tutorial={`ia-followup-tab-${key}`}
                onClick={() => setTrack(key)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.Icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
        {showDatePicker && <DateRangePicker date={dateRange} setDate={setDateRange} />}
      </div>

      {/* Legenda do trilho ativo */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
        <span className={`inline-block w-2 h-2 rounded-full ${TRACK_META[track].dot}`} />
        {TRACK_META[track].descricao}
      </div>

      {/* ————— AUTOMÁTICO ————— */}
      {track === "automatico" && (
        <div className="space-y-4">
          {/* Sub-abas do automático: Análise | Configuração (config é SÓ do automático) */}
          <div className="inline-flex bg-muted/40 rounded-xl p-1 gap-0.5">
            {(
              [
                { key: "analise", label: "Análise", tutorialKey: "ia-followup-tab-analise" },
                { key: "config", label: "Configuração", tutorialKey: "ia-followup-tab-config" },
              ] as const
            ).map(({ key, label, tutorialKey }) => (
              <button
                key={key}
                data-tutorial={tutorialKey}
                onClick={() => setAutoView(key)}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  autoView === key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {autoView === "config" ? (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground/60">
                Estas regras valem para o follow-up <span className="font-semibold text-foreground">automático</span> — o que a IA dispara sozinha durante o atendimento. O follow manual não usa esta configuração.
              </p>
              <AiFollowupConfig />
            </div>
          ) : (
            <TrackPanel
              variant="automatico"
              logs={logsAuto}
              activeLeads={autoActive}
              pausedLeads={autoPaused}
              seqArray={seqArray}
              historyTutorialTarget
            />
          )}
        </div>
      )}

      {/* ————— MANUAL ————— */}
      {track === "manual" && (
        <div className="space-y-6">
          {/* Leads sem retorno — porta de entrada do follow MANUAL */}
          <div className="space-y-3" data-tutorial="athos-followup-gap">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Leads sem retorno
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                Quem esfriou agora — ative o reengajamento manual na hora com o botão "Follow IA"
              </p>
            </div>
            <FollowupGapWidget dateRange={dateRange} />
          </div>

          <TrackPanel
            variant="manual"
            logs={logsManual}
            activeLeads={manualActive}
            pausedLeads={manualPaused}
            seqArray={seqArray}
          />
        </div>
      )}
    </div>
  );
}
