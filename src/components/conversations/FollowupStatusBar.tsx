import { useState, useEffect } from "react";
import { Clock, CheckCircle2, Loader2, UserCheck, Square } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { formatDistanceToNow, addMinutes, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowupStatusBarProps {
  leadId: string;
  followupManual?: boolean;
  followupTentativas?: number;
  followupUltimaTentativa?: string | null;
  followupPausado?: boolean;
  ultimoContato?: string | null;
  iaAtiva?: boolean;
}

function CountdownToNext({ targetDate }: { targetDate: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const diff = targetDate.getTime() - now;
  if (diff <= 0) return <span className="font-display tabular-nums">aguardando cron</span>;

  const totalMin = Math.floor(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return <span className="font-display tabular-nums">{h}h {m}min</span>;
  return <span className="font-display tabular-nums">{m}min</span>;
}

export function FollowupStatusBar({
  leadId,
  followupManual,
  followupTentativas,
  followupUltimaTentativa,
  followupPausado,
  ultimoContato,
  iaAtiva,
}: FollowupStatusBarProps) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [isStopping, setIsStopping] = useState(false);

  // A barra aparece tanto no follow MANUAL quanto no follow AUTOMÁTICO em execução
  // (IA ativa e já com ao menos 1 tentativa disparada).
  const isManualFollow = !!followupManual;
  const isAutoFollow = !!iaAtiva && !isManualFollow && (followupTentativas ?? 0) > 0;
  const showBar = isManualFollow || isAutoFollow;

  // Parar o follow-up: encerra o ciclo de disparos SEM desligar o atendimento da IA.
  const handleStop = async () => {
    setIsStopping(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          followup_manual: false,
          followup_pausado: true,
          followup_tentativas: 0,
          followup_ultima_tentativa: null,
        })
        .eq("id", leadId);
      if (error) throw error;
      toast.success("Follow-up interrompido");
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["followup-gap"] });
    } catch (err: any) {
      toast.error("Erro ao parar follow-up: " + (err.message || String(err)));
    } finally {
      setIsStopping(false);
    }
  };

  const StopButton = () => (
    <button
      onClick={handleStop}
      disabled={isStopping}
      title="Parar follow-up"
      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/[0.06] text-red-600 hover:bg-red-500/15 transition-colors text-[9px] font-bold uppercase tracking-widest disabled:opacity-50"
    >
      {isStopping ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Square className="h-2.5 w-2.5" fill="currentColor" />}
      Parar
    </button>
  );

  const { data: config } = useQuery({
    queryKey: ["followup-config-bar", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase
        .from("ia_followup_config")
        .select("sequencia, respeitar_horario_atendimento")
        .eq("organization_id", orgId)
        .maybeSingle();
      return data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: lastLog } = useQuery({
    queryKey: ["followup-last-log", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ia_followup_log")
        .select("id, tentativa, status, motivo_ia, mensagem_enviada, enviado_em")
        .eq("lead_id", leadId)
        .order("enviado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!leadId && showBar,
    refetchInterval: 30000,
  });

  const { data: lastOutbound } = useQuery({
    queryKey: ["followup-last-outbound", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mensagens")
        .select("remetente")
        .eq("lead_id", leadId)
        .eq("direcao", "saida")
        .not("remetente", "eq", "ia")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!leadId && showBar && !followupPausado,
    refetchInterval: 30000,
  });

  if (!showBar) return null;

  const tentativas = followupTentativas ?? 0;
  const seqArray: Array<{ ordem: number; minutos: number; ativo: boolean }> = Array.isArray(config?.sequencia) ? config.sequencia : [];
  const seqAtiva = seqArray.filter(s => s.ativo).sort((a, b) => a.ordem - b.ordem);
  const totalTentativas = seqAtiva.length;

  if (followupPausado) {
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/[0.04] px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
        <CheckCircle2 className="h-3 w-3 text-amber-500 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-600">
          Follow-up concluído — <span className="font-display tabular-nums">{tentativas}/{totalTentativas}</span> tentativas enviadas
        </span>
        <span className="text-[11px] text-muted-foreground/50 ml-auto">aguardando resposta do lead</span>
        <StopButton />
      </div>
    );
  }

  const humanManaging = !followupPausado && !!lastOutbound && lastOutbound.remetente !== "bot";

  if (humanManaging) {
    return (
      <div className="border-b border-indigo-500/30 bg-indigo-500/[0.04] px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
        <UserCheck className="h-3 w-3 text-indigo-500 shrink-0" />
        <span className="text-[11px] font-semibold text-indigo-600">
          Em atendimento humano — follow-up suspenso
        </span>
        <span className="text-[11px] text-muted-foreground/50 ml-auto hidden sm:block">
          retoma quando o lead responder
        </span>
        <StopButton />
      </div>
    );
  }

  const nextTentativa = tentativas + 1;
  const nextConfig = seqAtiva[tentativas];

  let referenciaStr = tentativas === 0 ? ultimoContato : followupUltimaTentativa;
  if (!referenciaStr && ultimoContato) referenciaStr = ultimoContato;

  let nextAt: Date | null = null;
  let overdue = false;
  if (nextConfig && referenciaStr) {
    nextAt = addMinutes(new Date(referenciaStr), nextConfig.minutos);
    overdue = isPast(nextAt);
  }

  const statusColor = overdue ? "text-amber-600" : "text-blue-600";
  const borderColor = overdue ? "border-amber-500/30" : "border-blue-500/30";
  const bgColor = overdue ? "bg-amber-500/[0.04]" : "bg-blue-500/[0.04]";

  return (
    <div className={`border-b ${borderColor} ${bgColor} px-4 py-1.5 flex items-center gap-2 flex-shrink-0`}>
      {overdue ? (
        <Loader2 className={`h-3 w-3 animate-spin ${statusColor} shrink-0`} />
      ) : (
        <Clock className={`h-3 w-3 ${statusColor} shrink-0`} />
      )}

      <span className={`text-[11px] font-semibold ${statusColor}`}>
        Follow-up IA ativo — tentativa <span className="font-display tabular-nums">{nextTentativa}/{totalTentativas}</span>
      </span>

      {lastLog && (
        <span className="text-[11px] text-muted-foreground/50 hidden sm:block truncate max-w-[200px]">
          · último: {lastLog.status === "enviado" ? "enviado" : lastLog.status}{" "}
          {formatDistanceToNow(new Date(lastLog.enviado_em), { addSuffix: true, locale: ptBR })}
        </span>
      )}

      <span className={`text-[11px] ml-auto ${statusColor}`}>
        {nextAt && !overdue ? (
          <span>próximo em <CountdownToNext targetDate={nextAt} /></span>
        ) : overdue ? (
          <span>pendente — aguardando próximo cron</span>
        ) : (
          <span>configurando...</span>
        )}
      </span>

      <StopButton />
    </div>
  );
}
