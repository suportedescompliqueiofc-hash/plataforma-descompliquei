import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Bot,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AiFollowupConfig } from "./AiFollowupConfig";

interface FollowupLog {
  id: string;
  lead_id: string;
  tentativa: number;
  status: string;
  mensagem_enviada: string | null;
  motivo_ia: string | null;
  enviado_em: string;
  leads: { nome: string | null; telefone: string | null } | null;
}

const STATUS_CONFIG: Record<string, { label: string; emoji: string; badgeClass: string }> = {
  enviado: { label: "Enviado", emoji: "✅", badgeClass: "border-green-200 bg-green-50 text-green-700" },
  ignorado_ia: { label: "IA ignorou", emoji: "🤖", badgeClass: "border-gray-200 bg-gray-50 text-gray-700" },
  fora_horario: { label: "Fora do horario", emoji: "🕐", badgeClass: "border-amber-200 bg-amber-50 text-amber-700" },
  lead_respondeu: { label: "Lead respondeu", emoji: "💬", badgeClass: "border-blue-200 bg-blue-50 text-blue-700" },
  erro: { label: "Erro", emoji: "❌", badgeClass: "border-red-200 bg-red-50 text-red-700" },
};

export function AiFollowupTab() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs } = useQuery({
    queryKey: ["followup-logs-full", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("ia_followup_log")
        .select("*, leads!lead_id(nome, telefone)")
        .eq("organization_id", orgId)
        .order("enviado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as FollowupLog[];
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const enviados = logs?.filter((l) => l.status === "enviado").length ?? 0;
  const ignorados = logs?.filter((l) => l.status === "ignorado_ia").length ?? 0;
  const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 });
  const estaSemana = logs?.filter((l) => new Date(l.enviado_em) >= inicioSemana).length ?? 0;

  return (
    <div className="space-y-4">
      <AiFollowupConfig />

      <Card className="border-sidebar-border shadow-sm">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Historico de Follow-ups</h3>
          </div>
          {logs && logs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[11px] font-normal">
                {enviados} enviados
              </Badge>
              <Badge variant="outline" className="text-[11px] font-normal">
                {ignorados} ignorados pela IA
              </Badge>
              <Badge variant="outline" className="text-[11px] font-normal">
                {estaSemana} esta semana
              </Badge>
            </div>
          )}
        </div>

        <div className="p-4">
          {!logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bot className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhum follow-up registrado ainda
              </p>
              <p className="text-xs text-muted-foreground/60">
                Os follow-ups aparecerao aqui quando forem processados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3" />
                    <th className="pb-2 pr-3">Lead</th>
                    <th className="pb-2 pr-3">Tentativa</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Mensagem</th>
                    <th className="pb-2">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const st = STATUS_CONFIG[log.status] || STATUS_CONFIG.erro;
                    const leadName = (log.leads as any)?.nome || (log.leads as any)?.telefone || "Lead";
                    const isExpanded = expandedRow === log.id;
                    const hasDetail = (log.status === "enviado" && log.mensagem_enviada) ||
                      (log.status === "ignorado_ia" && log.motivo_ia);

                    return (
                      <>
                        <tr
                          key={log.id}
                          className={`border-b border-border/50 transition-colors ${hasDetail ? "cursor-pointer hover:bg-muted/30" : ""}`}
                          onClick={() => hasDetail && setExpandedRow(isExpanded ? null : log.id)}
                        >
                          <td className="py-2 pr-1">
                            {hasDetail && (
                              isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </td>
                          <td className="py-2 pr-3 font-medium">{leadName}</td>
                          <td className="py-2 pr-3">{log.tentativa}a</td>
                          <td className="py-2 pr-3">
                            <Badge variant="outline" className={`text-[10px] ${st.badgeClass}`}>
                              {st.emoji} {st.label}
                            </Badge>
                          </td>
                          <td className="max-w-[200px] truncate py-2 pr-3 text-muted-foreground">
                            {log.mensagem_enviada || log.motivo_ia || "-"}
                          </td>
                          <td className="whitespace-nowrap py-2 text-muted-foreground">
                            {format(new Date(log.enviado_em), "dd/MM HH:mm", { locale: ptBR })}
                            <span className="ml-1 text-[10px] text-muted-foreground/60">
                              ({formatDistanceToNow(new Date(log.enviado_em), { addSuffix: true, locale: ptBR })})
                            </span>
                          </td>
                        </tr>
                        {isExpanded && hasDetail && (
                          <tr key={`${log.id}-detail`}>
                            <td colSpan={6} className="bg-muted/20 px-4 py-3">
                              {log.status === "enviado" && log.mensagem_enviada && (
                                <div>
                                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                                    <MessageSquare className="h-3 w-3" />
                                    Mensagem enviada
                                  </div>
                                  <p className="text-xs leading-relaxed">{log.mensagem_enviada}</p>
                                </div>
                              )}
                              {log.status === "ignorado_ia" && log.motivo_ia && (
                                <div>
                                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                                    <Bot className="h-3 w-3" />
                                    Motivo da IA
                                  </div>
                                  <p className="text-xs leading-relaxed">{log.motivo_ia}</p>
                                </div>
                              )}
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
      </Card>
    </div>
  );
}
