import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  MessageSquare,
  Mic,
  Database,
  Bell,
  Send,
  AlertTriangle,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type LogStatus = "running" | "success" | "error";

interface AiLog {
  id: string;
  organization_id: string;
  lead_id?: string | null;
  session_id?: string | null;
  status: LogStatus;
  etapa: string;
  detalhe?: string | null;
  duracao_ms?: number | null;
  model?: string | null;
  partes_enviadas?: number | null;
  tool_calls?: unknown;
  erro_detalhe?: string | null;
  criado_em: string;
  atualizado_em: string;
  leads?: { nome?: string | null; telefone?: string | null } | null;
}

// ── Constantes de etapas ──────────────────────────────────────────────────────

const ETAPA_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  iniciando:             { label: "Iniciando",            icon: Zap,          color: "text-yellow-400" },
  aguardando_acumulo:    { label: "Acumulando msgs",      icon: Clock,        color: "text-blue-400" },
  processando_mensagens: { label: "Processando msgs",     icon: MessageSquare,color: "text-blue-400" },
  transcrevendo_audio:   { label: "Transcrevendo áudio",  icon: Mic,          color: "text-purple-400" },
  audio_transcrito:      { label: "Áudio transcrito",     icon: Mic,          color: "text-purple-400" },
  carregando_memoria:    { label: "Carregando memória",   icon: Database,     color: "text-indigo-400" },
  consultando_ia:        { label: "Consultando IA",       icon: Bot,          color: "text-primary" },
  executando_ferramentas:{ label: "Executando ferramentas",icon: Database,    color: "text-orange-400" },
  ferramentas_concluidas:{ label: "Ferramentas ok",       icon: CheckCircle2, color: "text-green-400" },
  enviando_whatsapp:     { label: "Enviando WhatsApp",    icon: Send,         color: "text-green-400" },
  concluido:             { label: "Concluído",            icon: CheckCircle2, color: "text-green-400" },
  concluido_com_erros:   { label: "Concluído c/ erros",  icon: AlertTriangle, color: "text-orange-400" },
  // erros
  erro_lead:             { label: "Lead não encontrado",  icon: XCircle,      color: "text-red-400" },
  bloqueado:             { label: "IA bloqueada",         icon: XCircle,      color: "text-red-400" },
  pausada:               { label: "IA pausada",           icon: Clock,        color: "text-yellow-400" },
  acumulando:            { label: "Acumulando",           icon: RefreshCw,    color: "text-blue-400" },
  erro_config:           { label: "Config. inválida",     icon: XCircle,      color: "text-red-400" },
  mensagem_vazia:        { label: "Mensagem vazia",       icon: AlertTriangle,color: "text-orange-400" },
  resposta_vazia:        { label: "Resposta vazia",       icon: AlertTriangle,color: "text-orange-400" },
  sem_whatsapp:          { label: "Sem WhatsApp",         icon: XCircle,      color: "text-red-400" },
  erro_envio_parte:      { label: "Erro no envio",        icon: XCircle,      color: "text-red-400" },
  erro_whatsapp:         { label: "Erro WhatsApp",        icon: XCircle,      color: "text-red-400" },
  erro_fatal:            { label: "Erro fatal",           icon: XCircle,      color: "text-red-500" },
};

// ── Contador de duração ao vivo ───────────────────────────────────────────────

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const iv = setInterval(() => setElapsed(Date.now() - start), 500);
    return () => clearInterval(iv);
  }, [startedAt]);
  const s = Math.floor(elapsed / 1000);
  const ms = elapsed % 1000;
  return (
    <span className="font-display text-xs text-yellow-400 tabular-nums">
      {s}s {ms.toString().padStart(3, "0")}ms
    </span>
  );
}

// ── Badge de status ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LogStatus }) {
  if (status === "running")
    return (
      <Badge className="gap-1.5 bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs font-medium animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" /> Executando
      </Badge>
    );
  if (status === "success")
    return (
      <Badge className="gap-1.5 bg-green-500/15 text-green-400 border-green-500/30 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" /> Sucesso
      </Badge>
    );
  return (
    <Badge className="gap-1.5 bg-red-500/15 text-red-400 border-red-500/30 text-xs font-medium">
      <XCircle className="h-3 w-3" /> Erro
    </Badge>
  );
}

// ── Linha de etapa (timeline item) ───────────────────────────────────────────

function EtapaRow({ etapa, detalhe, isLast }: { etapa: string; detalhe?: string | null; isLast: boolean }) {
  const meta = ETAPA_META[etapa] ?? { label: etapa, icon: Activity, color: "text-muted-foreground" };
  const Icon = meta.icon;
  return (
    <div className="flex gap-2 text-xs">
      <div className="flex flex-col items-center pt-0.5">
        <div className={`rounded-full p-0.5 ${meta.color.replace("text-", "bg-").replace("-400", "-400/15")}`}>
          <Icon className={`h-3 w-3 ${meta.color}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border/50 mt-1" />}
      </div>
      <div className="pb-3 flex-1 min-w-0">
        <span className={`font-medium ${meta.color}`}>{meta.label}</span>
        {detalhe && (
          <p className="text-muted-foreground mt-0.5 leading-relaxed break-words">{detalhe}</p>
        )}
      </div>
    </div>
  );
}

// ── Card de execução ──────────────────────────────────────────────────────────

function ExecutionCard({ log }: { log: AiLog }) {
  const [expanded, setExpanded] = useState(log.status === "running");
  const [cancelling, setCancelling] = useState(false);
  
  const toolCalls = log.tool_calls as Array<{ tool: string; args: Record<string, unknown> }> | null;
  const leadName = log.leads?.nome || log.leads?.telefone || "Lead desconhecido";

  const etapasMock = [
    { etapa: log.etapa, detalhe: log.detalhe },
  ];

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cancelling) return;
    try {
      setCancelling(true);
      const { error } = await supabase
        .from('ai_execution_logs')
        .update({ 
          status: 'error', 
          etapa: 'erro_fatal', 
          erro_detalhe: 'Execução interrompida manualmente pelo usuário no painel.',
          atualizado_em: new Date().toISOString()
        })
        .eq('id', log.id);
        
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao cancelar execução", err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-all ${
        log.status === "running"
          ? "border-yellow-500/40 shadow-yellow-500/5 cursor-default"
          : log.status === "success"
          ? "border-green-500/20"
          : "border-red-500/20"
      }`}
    >
      {/* Header do card */}
      <div
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Ícone status */}
        <div
          className={`flex-shrink-0 rounded-full p-1.5 ${
            log.status === "running"
              ? "bg-yellow-500/15"
              : log.status === "success"
              ? "bg-green-500/15"
              : "bg-red-500/15"
          }`}
        >
          {log.status === "running" ? (
            <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
          ) : log.status === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
        </div>

        {/* Infos principais */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              IA → {leadName}
            </span>
            <StatusBadge status={log.status} />
            {log.model && (
              <Badge variant="outline" className="font-mono text-[10px] hidden sm:flex">
                {log.model}
              </Badge>
            )}
            {toolCalls && toolCalls.length > 0 && (
              <Badge className="gap-1 bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px]">
                <Database className="h-2.5 w-2.5" />
                {toolCalls.map((t) => t.tool).join(", ")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-display tabular-nums">{format(new Date(log.criado_em), "dd/MM 'às' HH:mm:ss", { locale: ptBR })}</span>
            {log.status === "running" ? (
              <LiveTimer startedAt={log.criado_em} />
            ) : log.duracao_ms ? (
              <span className="font-display tabular-nums text-xs">
                {log.duracao_ms >= 1000
                  ? `${(log.duracao_ms / 1000).toFixed(1)}s`
                  : `${log.duracao_ms}ms`}
              </span>
            ) : null}
            {log.partes_enviadas != null && log.partes_enviadas > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <Send className="h-2.5 w-2.5" />
                {log.partes_enviadas} parte(s) enviada(s)
              </span>
            )}
          </div>
        </div>

        {/* Controles da Direita */}
        <div className="flex items-center gap-3 flex-shrink-0 text-muted-foreground">
          {log.status === "running" && (
            <Button
              variant="destructive"
              className="h-6 px-2.5 text-[10px] font-bold tracking-wider relative z-10 transition-all hover:bg-red-600"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <XCircle className="h-3 w-3 mr-1.5" />}
              PARAR IA
            </Button>
          )}
          <div className="flex-shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="border-t border-border/50 px-4 pt-3 pb-4 bg-muted/10">
          {/* Timeline de etapas */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
              Última etapa
            </p>
            <EtapaRow etapa={log.etapa} detalhe={log.detalhe} isLast={true} />
          </div>

          {/* Erro */}
          {log.erro_detalhe && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mt-2">
              <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1">
                Detalhe do erro
              </p>
              <p className="text-xs text-red-300 font-mono break-words">{log.erro_detalhe}</p>
            </div>
          )}

          {/* Tool calls detalhadas */}
          {toolCalls && toolCalls.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Ferramentas acionadas
              </p>
              <div className="space-y-2">
                {toolCalls.map((tc, i) => (
                  <div key={i} className="rounded-lg bg-orange-500/5 border border-orange-500/15 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="h-3 w-3 text-orange-400" />
                      <span className="text-xs font-semibold text-orange-400 font-mono">{tc.tool}</span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(tc.args || {}).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-[11px]">
                          <span className="text-muted-foreground font-mono w-36 flex-shrink-0 truncate">{k}:</span>
                          <span className="text-foreground/80 break-words">
                            {typeof v === "string" ? v.slice(0, 120) + (v.length > 120 ? "..." : "") : JSON.stringify(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AiLogsViewer() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const [logs, setLogs] = useState<AiLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carrega logs iniciais e exclui antigos
  useEffect(() => {
    if (!user || !orgId) return;

    const fetchLogsAndClean = async () => {
      setIsLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("ai_execution_logs")
        .select(`
          *,
          leads(nome, telefone)
        `)
        .eq("organization_id", orgId)
        .gte("criado_em", today.toISOString())
        .order("criado_em", { ascending: false })
        .limit(80);

      if (!error && data) {
        setLogs(data as AiLog[]);
        setActiveCount((data as AiLog[]).filter((l) => l.status === "running").length);
      }
      setIsLoading(false);

      // Limpeza automática (Garbage Collection): Exclui logs de dias anteriores
      supabase
        .from("ai_execution_logs")
        .delete()
        .eq("organization_id", orgId)
        .lt("criado_em", today.toISOString())
        .then(({ error }) => {
          if (error) console.error("Erro ao limpar logs antigos:", error);
        });
    };

    fetchLogsAndClean();
  }, [user, orgId]);

  // Realtime: atualiza logs em tempo real
  useEffect(() => {
    if (!user || !orgId) return;

    const channel = supabase
      .channel(`ai_logs_${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_execution_logs",
          filter: `organization_id=eq.${orgId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // Busca com join do lead
            const { data } = await supabase
              .from("ai_execution_logs")
              .select("*, leads(nome, telefone)")
              .eq("id", (payload.new as AiLog).id)
              .single();

            if (data) {
              setLogs((prev) => [data as AiLog, ...prev.slice(0, 79)]);
              setActiveCount((c) => (data.status === "running" ? c + 1 : c));
            }
          } else if (payload.eventType === "UPDATE") {
            setLogs((prev) =>
              prev.map((l) =>
                l.id === (payload.new as AiLog).id
                  ? { ...l, ...(payload.new as AiLog) }
                  : l
              )
            );
            // Recalcula ativos
            setLogs((prev) => {
              setActiveCount(prev.filter((l) => l.status === "running").length);
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, orgId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <div className="rounded-full bg-muted/30 p-5 mb-4">
          <Activity className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-semibold font-display text-foreground mb-1">Nenhuma execução registrada</h3>
        <p className="text-xs max-w-xs">
          Quando a IA for acionada por uma mensagem no WhatsApp, os logs de execução em tempo real aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Barra de status ao vivo */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${activeCount > 0 ? "bg-yellow-400 animate-pulse" : "bg-green-400"}`} />
          <span className="text-xs text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} execução(ões) em andamento`
              : `${logs.length} execução(ões) registradas`}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono gap-1">
          <Activity className="h-2.5 w-2.5" />
          Tempo real
        </Badge>
      </div>

      {/* Lista de execuções */}
      <ScrollArea className="flex-1 pr-1" ref={scrollRef as any}>
        <div className="space-y-2 pb-4">
          {logs.map((log) => (
            <ExecutionCard key={log.id} log={log} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
