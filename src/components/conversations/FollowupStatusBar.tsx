import { useState, useEffect } from "react";
import { Bot, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { formatDistanceToNow, addMinutes, isPast, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowupStatusBarProps {
  leadId: string;
  followupManual?: boolean;
  followupTentativas?: number;
  followupUltimaTentativa?: string | null;
  followupPausado?: boolean;
  ultimoContato?: string | null;
}

function CountdownToNext({ targetDate }: { targetDate: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const diff = targetDate.getTime() - now;
  if (diff <= 0) return <span className="font-mono tabular-nums">aguardando cron</span>;

  const totalMin = Math.floor(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return <span className="font-mono tabular-nums">{h}h {m}min</span>;
  return <span className="font-mono tabular-nums">{m}min</span>;
}

export function FollowupStatusBar({
  leadId,
  followupManual,
  followupTentativas,
  followupUltimaTentativa,
  followupPausado,
  ultimoContato,
}: FollowupStatusBarProps) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

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
    enabled: !!leadId && !!followupManual,
    refetchInterval: 30000,
  });

  if (!followupManual) return null;

  const tentativas = followupTentativas ?? 0;
  const seqArray: Array<{ ordem: number; minutos: number; ativo: boolean }> = Array.isArray(config?.sequencia) ? config.sequencia : [];
  const seqAtiva = seqArray.filter(s => s.ativo).sort((a, b) => a.ordem - b.ordem);
  const totalTentativas = seqAtiva.length;

  if (followupPausado) {
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/[0.04] px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
        <CheckCircle2 className="h-3 w-3 text-amber-500 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-600">
          Follow-up concluído — {tentativas}/{totalTentativas} tentativas enviadas
        </span>
        <span className="text-[11px] text-muted-foreground/50 ml-auto">aguardando resposta do lead</span>
        <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
          <Bot className="h-2.5 w-2.5 text-amber-500/50" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500/50">FOLLOW</span>
        </div>
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
  const badgeBg = overdue ? "bg-amber-500/10 border-amber-500/20" : "bg-blue-500/10 border-blue-500/20";
  const badgeText = overdue ? "text-amber-500/50" : "text-blue-500/50";

  return (
    <div className={`border-b ${borderColor} ${bgColor} px-4 py-1.5 flex items-center gap-2 flex-shrink-0`}>
      {overdue ? (
        <Loader2 className={`h-3 w-3 animate-spin ${statusColor} shrink-0`} />
      ) : (
        <Clock className={`h-3 w-3 ${statusColor} shrink-0`} />
      )}

      <span className={`text-[11px] font-semibold ${statusColor}`}>
        Follow-up IA ativo — tentativa {nextTentativa}/{totalTentativas}
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

      <div className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full ${badgeBg} border`}>
        <Bot className={`h-2.5 w-2.5 ${badgeText}`} />
        <span className={`text-[9px] font-bold uppercase tracking-widest ${badgeText}`}>FOLLOW</span>
      </div>
    </div>
  );
}
