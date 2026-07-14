import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  FileText,
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AiLogsViewer } from "@/components/ai/AiLogsViewer";
import { cn } from "@/lib/utils";

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

type FilterType = "todos" | "erros";
type SubTab = "tempo-real" | "execucoes";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; badgeClass: string }> = {
  running: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200/60",
  },
  success: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  },
  error: {
    icon: <XCircle className="h-3 w-3" />,
    badgeClass: "bg-red-50 text-red-700 border-red-200/60",
  },
};

const SUB_TABS: { id: SubTab; label: string; icon: typeof Radio }[] = [
  { id: "tempo-real", label: "Tempo Real", icon: Radio },
  { id: "execucoes", label: "Execuções", icon: FileText },
];

export function AiExecutionLogsTab() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const [subTab, setSubTab] = useState<SubTab>("tempo-real");
  const [filter, setFilter] = useState<FilterType>("todos");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["ia-execution-logs", orgId, dateRange],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from("ai_execution_logs")
        .select("*, leads!lead_id(nome, telefone)")
        .eq("organization_id", orgId);
      if (dateRange?.from) query = query.gte("criado_em", startOfDay(dateRange.from).toISOString());
      if (dateRange?.to) query = query.lte("criado_em", endOfDay(dateRange.to).toISOString());
      const { data, error } = await query.order("criado_em", { ascending: false }).limit(200);
      if (error) throw error;
      return (data || []) as ExecutionLog[];
    },
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return filter === "erros" ? logs.filter((l) => l.status === "error") : logs;
  }, [logs, filter]);

  const errorCount = useMemo(() => logs?.filter((l) => l.status === "error").length || 0, [logs]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "erros", label: "Erros" },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200",
              subTab === tab.id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.id === "tempo-real" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tempo Real sub-tab */}
      {subTab === "tempo-real" && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Radio className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Monitor em Tempo Real
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  Acompanhe as execuções da IA ao vivo
                </p>
              </div>
              <Badge className="ml-auto gap-1.5 border-emerald-200/60 bg-emerald-50 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </Badge>
            </div>
          </div>
          <div className="p-5">
            <AiLogsViewer />
          </div>
        </div>
      )}

      {/* Execucoes sub-tab */}
      {subTab === "execucoes" && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Logs de Execução
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  Filtre por período · até 200 execuções
                </p>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="px-5 py-3 border-b border-border/40 flex items-center gap-3 flex-wrap">
            <DateRangePicker date={dateRange} setDate={setDateRange} className="w-auto" />
            <div className="w-px h-4 bg-border/40 shrink-0" />
            <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200",
                    filter === f.key
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                  {f.key === "erros" && errorCount > 0 && (
                    <span className="ml-1 text-[9px] opacity-70">({errorCount})</span>
                  )}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground/50 ml-auto">
              {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Content */}
          <div className="p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredLogs || filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-muted/30 p-4 rounded-2xl mb-3">
                  <Activity className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium font-display text-muted-foreground mb-0.5">
                  Nenhum log encontrado
                </p>
                <p className="text-[11px] text-muted-foreground/50">
                  {filter === "erros" ? "Nenhum erro registrado" : "As execuções aparecerão aqui"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left">
                      <th className="px-5 pb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Lead</th>
                      <th className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Etapa</th>
                      <th className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Status</th>
                      <th className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Detalhe</th>
                      <th className="px-5 pb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-right">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredLogs.map((log) => {
                      const st = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
                      const leadName = (log.leads as any)?.nome || (log.leads as any)?.telefone || "-";
                      const isExpanded = expandedRow === log.id;
                      const hasDetail = log.detalhe || log.erro_detalhe;

                      return (
                        <tr
                          key={log.id}
                          className={cn(
                            "group transition-colors",
                            hasDetail && "cursor-pointer hover:bg-muted/30",
                            isExpanded && "bg-muted/20"
                          )}
                          onClick={() => hasDetail && setExpandedRow(isExpanded ? null : log.id)}
                        >
                          <td className="px-5 py-3">
                            <span className="text-[12px] font-medium text-foreground">{leadName}</span>
                          </td>
                          <td className="px-3 py-3">
                            <code className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                              {log.etapa}
                            </code>
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", st.badgeClass)}>
                              {st.icon}
                              {log.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="max-w-[300px]">
                              {isExpanded && hasDetail ? (
                                <div className="space-y-2 py-1">
                                  {log.detalhe && (
                                    <div>
                                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Detalhe</span>
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/80">{log.detalhe}</p>
                                    </div>
                                  )}
                                  {log.erro_detalhe && (
                                    <div>
                                      <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Erro</span>
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-red-700">{log.erro_detalhe}</p>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-3 pt-1">
                                    {log.model && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Modelo: <strong className="text-foreground/70">{log.model}</strong>
                                      </span>
                                    )}
                                    {log.partes_enviadas != null && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Partes: <strong className="text-foreground/70 font-display tabular-nums">{log.partes_enviadas}</strong>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="truncate text-[11px] text-muted-foreground/60">
                                  {log.erro_detalhe || log.detalhe || "-"}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] text-muted-foreground font-display tabular-nums">
                                {format(new Date(log.criado_em), "dd/MM HH:mm:ss", { locale: ptBR })}
                              </span>
                              {log.duracao_ms != null && (
                                <span className="text-[9px] font-medium text-muted-foreground/50 bg-muted/50 px-1.5 py-0.5 rounded-md font-display tabular-nums">
                                  {log.duracao_ms}ms
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
