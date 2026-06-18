import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Bot, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface AiExecLog {
  id: string;
  status: "running" | "success" | "error";
  etapa: string;
  detalhe: string | null;
  duracao_ms: number | null;
  criado_em: string;
  atualizado_em: string;
}

const ETAPA_META: Record<string, { label: string; color: string }> = {
  iniciando:              { label: "Iniciando",            color: "text-yellow-600 dark:text-yellow-400" },
  aguardando_acumulo:     { label: "Aguardando mensagens", color: "text-blue-600 dark:text-blue-400" },
  processando_mensagens:  { label: "Processando",          color: "text-blue-600 dark:text-blue-400" },
  transcrevendo_audio:    { label: "Transcrevendo áudio",  color: "text-purple-600 dark:text-purple-400" },
  audio_transcrito:       { label: "Áudio transcrito",     color: "text-purple-600 dark:text-purple-400" },
  analisando_imagem:      { label: "Analisando imagem",    color: "text-purple-600 dark:text-purple-400" },
  carregando_memoria:     { label: "Carregando memória",   color: "text-indigo-600 dark:text-indigo-400" },
  consultando_ia:         { label: "Consultando IA",       color: "text-foreground" },
  executando_ferramentas: { label: "Buscando informações", color: "text-orange-600 dark:text-orange-400" },
  ferramentas_concluidas: { label: "Informações obtidas",  color: "text-orange-600 dark:text-orange-400" },
  enviando_whatsapp:      { label: "Enviando resposta",    color: "text-green-600 dark:text-green-400" },
  concluido:              { label: "Concluído",            color: "text-green-600 dark:text-green-400" },
  concluido_com_erros:    { label: "Concluído c/ erros",   color: "text-orange-600 dark:text-orange-400" },
  bloqueado:              { label: "IA bloqueada",         color: "text-red-500" },
  pausada:                { label: "IA pausada",           color: "text-yellow-600 dark:text-yellow-400" },
};

function parseWaitSeconds(detalhe: string | null): number | null {
  if (!detalhe) return null;
  const match = detalhe.match(/(\d+)\s*s/i);
  return match ? parseInt(match[1]) : null;
}

function CountdownTimer({ startedAt, totalSeconds }: { startedAt: string; totalSeconds: number }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => setRemaining(Math.max(0, totalSeconds - (Date.now() - start) / 1000));
    update();
    const iv = setInterval(update, 200);
    return () => clearInterval(iv);
  }, [startedAt, totalSeconds]);
  return <span className="font-mono tabular-nums">{Math.ceil(remaining)}s</span>;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const iv = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(iv);
  }, [startedAt]);
  const s = Math.floor(elapsed / 1000);
  const ms = String(elapsed % 1000).padStart(3, "0");
  return <span className="font-mono tabular-nums">{s}s {ms}ms</span>;
}

export function AiStatusBar({ leadId }: { leadId: string }) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const [log, setLog] = useState<AiExecLog | null>(null);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Reset ao trocar de conversa
    setLog(null);
    setVisible(false);
    setFading(false);

    if (!orgId || !leadId) return;

    const fetchRunningLog = () =>
      supabase
        .from("ai_execution_logs")
        .select("id, status, etapa, detalhe, duracao_ms, criado_em, atualizado_em")
        .eq("organization_id", orgId)
        .eq("lead_id", leadId)
        .eq("status", "running")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

    fetchRunningLog().then(({ data }) => {
      if (data) {
        setLog(data as AiExecLog);
        setVisible(true);
      }
    });

    const channel = supabase
      .channel(`ai-status-${leadId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ai_execution_logs",
        filter: `lead_id=eq.${leadId}`,
      }, (payload) => {
        const data = payload.new as AiExecLog;
        if (data.status === "running") {
          setLog(data);
          setFading(false);
          setVisible(true);
        } else {
          // Antes de sumir, verifica se ainda existe outra execução rodando
          fetchRunningLog().then(({ data: running }) => {
            if (running) {
              setLog(running as AiExecLog);
              setFading(false);
              setVisible(true);
            } else {
              setLog(data);
              setFading(false);
              setVisible(true);
              setTimeout(() => setFading(true), 2500);
              setTimeout(() => setVisible(false), 3200);
            }
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, leadId]);

  if (!visible || !log) return null;

  const isRunning = log.status === "running";
  const isSuccess = log.status === "success";
  const isAccumulating = log.etapa === "aguardando_acumulo";
  const waitSeconds = isAccumulating ? (parseWaitSeconds(log.detalhe) || 45) : null;
  const meta = ETAPA_META[log.etapa];
  const label = meta?.label ?? log.etapa;
  const color = meta?.color ?? "text-muted-foreground";

  return (
    <div className={`border-b border-border/40 bg-muted/[0.02] px-4 py-1.5 flex items-center gap-2 flex-shrink-0 transition-opacity duration-700 ${fading ? "opacity-0" : "opacity-100"}`}>
      {/* Ícone status */}
      <div className="shrink-0">
        {isRunning
          ? <Loader2 className={`h-3 w-3 animate-spin ${color}`} />
          : isSuccess
          ? <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
          : <XCircle className="h-3 w-3 text-red-500" />
        }
      </div>

      {/* Label da etapa */}
      <span className={`text-[11px] font-semibold ${color}`}>{label}</span>

      {/* Detalhe (só para etapas não-acumulo) */}
      {log.detalhe && !isAccumulating && (
        <span className="text-[11px] text-muted-foreground/55 truncate max-w-[240px] hidden sm:block">
          · {log.detalhe}
        </span>
      )}

      {/* Timer / countdown */}
      <span className={`text-[11px] ml-auto ${color}`}>
        {isRunning && isAccumulating && waitSeconds != null
          ? <span>respondendo em <CountdownTimer startedAt={log.atualizado_em} totalSeconds={waitSeconds} /></span>
          : isRunning
          ? <ElapsedTimer startedAt={log.criado_em} />
          : log.duracao_ms != null
          ? `${(log.duracao_ms / 1000).toFixed(1)}s`
          : null
        }
      </span>

      {/* Badge IA */}
      <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/60 border border-border/30">
        <Bot className="h-2.5 w-2.5 text-muted-foreground/50" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">IA</span>
      </div>
    </div>
  );
}
