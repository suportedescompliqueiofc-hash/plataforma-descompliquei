import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow, startOfDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

interface ExecutionLog {
  id: string;
  lead_id: string | null;
  status: string;
  etapa: string;
  detalhe: string | null;
  erro_detalhe: string | null;
  model: string | null;
  duracao_ms: number | null;
  partes_enviadas: number | null;
  criado_em: string;
  atualizado_em: string;
  leads: { nome: string | null; telefone: string | null } | null;
}

type FilterType = "todos" | "erros" | "hoje" | "semana";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; badgeClass: string }> = {
  running: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  success: {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    badgeClass: "border-green-200 bg-green-50 text-green-700",
  },
  error: {
    icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    badgeClass: "border-red-200 bg-red-50 text-red-700",
  },
};

export function AiExecutionLogsTab() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const [filter, setFilter] = useState<FilterType>("todos");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["ia-execution-logs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("ai_execution_logs")
        .select("*, leads!lead_id(nome, telefone)")
        .eq("organization_id", orgId)
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ExecutionLog[];
    },
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const now = new Date();
    switch (filter) {
      case "erros":
        return logs.filter((l) => l.status === "error");
      case "hoje":
        return logs.filter((l) => new Date(l.criado_em) >= startOfDay(now));
      case "semana":
        return logs.filter((l) => new Date(l.criado_em) >= startOfWeek(now, { weekStartsOn: 1 }));
      default:
        return logs;
    }
  }, [logs, filter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "erros", label: "Erros" },
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Esta semana" },
  ];

  return (
    <Card className="border-sidebar-border shadow-sm">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Logs de Execucao da IA</h3>
          <Badge className="gap-1.5 border-green-500/20 bg-green-500/10 text-[10px] font-bold uppercase tracking-wider text-green-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            Live
          </Badge>
        </div>
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key === "erros" && logs && (
                <span className="ml-1">
                  ({logs.filter((l) => l.status === "error").length})
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredLogs || filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Nenhum log encontrado
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-3">Lead</th>
                  <th className="pb-2 pr-3">Etapa</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Detalhe</th>
                  <th className="pb-2">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const st = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
                  const leadName = (log.leads as any)?.nome || (log.leads as any)?.telefone || "-";
                  const isExpanded = expandedRow === log.id;
                  const hasDetail = log.detalhe || log.erro_detalhe;

                  return (
                    <>
                      <tr
                        key={log.id}
                        className={`border-b border-border/50 transition-colors ${hasDetail ? "cursor-pointer hover:bg-muted/30" : ""}`}
                        onClick={() => hasDetail && setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td className="py-2 pr-3 font-medium">{leadName}</td>
                        <td className="py-2 pr-3">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            {log.etapa}
                          </code>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className={`gap-1 text-[10px] ${st.badgeClass}`}>
                            {st.icon}
                            {log.status}
                          </Badge>
                        </td>
                        <td className="max-w-[300px] truncate py-2 pr-3 text-muted-foreground">
                          {log.erro_detalhe || log.detalhe || "-"}
                        </td>
                        <td className="whitespace-nowrap py-2 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{format(new Date(log.criado_em), "dd/MM HH:mm:ss", { locale: ptBR })}</span>
                            {log.duracao_ms && (
                              <Badge variant="outline" className="text-[9px] font-mono font-normal">
                                {log.duracao_ms}ms
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && hasDetail && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={5} className="bg-muted/20 px-4 py-3">
                            <div className="space-y-2">
                              {log.detalhe && (
                                <div>
                                  <span className="text-[11px] font-semibold text-muted-foreground">Detalhe:</span>
                                  <p className="mt-0.5 text-xs leading-relaxed">{log.detalhe}</p>
                                </div>
                              )}
                              {log.erro_detalhe && (
                                <div>
                                  <span className="text-[11px] font-semibold text-red-600">Erro:</span>
                                  <p className="mt-0.5 text-xs leading-relaxed text-red-700">{log.erro_detalhe}</p>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                                {log.model && <span>Modelo: <strong>{log.model}</strong></span>}
                                {log.partes_enviadas != null && <span>Partes: <strong>{log.partes_enviadas}</strong></span>}
                                {log.duracao_ms != null && <span>Duracao: <strong>{log.duracao_ms}ms</strong></span>}
                              </div>
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
    </Card>
  );
}
