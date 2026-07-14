import { useState, useMemo } from "react";
import { Bot, CheckCircle2, XCircle, Clock, RefreshCw, Filter, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow, format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { useTriageLogs } from "@/hooks/useTriageLogs";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";

type Filtro = "todos" | "ativou" | "nao_ativou";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "ativou", label: "IA Ativada" },
  { key: "nao_ativou", label: "Não Ativada" },
];

const ORIGEM_LABEL: Record<string, string> = {
  marketing: "Marketing",
  indicacao: "Indicação",
  organico: "Orgânico",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  site: "Site",
};

export function AiTriageLogsTab() {
  const { data: logs = [], isLoading, isFetching } = useTriageLogs();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const logsByPeriod = useMemo(() => {
    if (!dateRange?.from) return logs;
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to ?? dateRange.from);
    return logs.filter(l => isWithinInterval(new Date(l.created_at), { start: from, end: to }));
  }, [logs, dateRange]);

  const filtered = useMemo(() => {
    if (filtro === "ativou") return logsByPeriod.filter(l => l.decisao);
    if (filtro === "nao_ativou") return logsByPeriod.filter(l => !l.decisao);
    return logsByPeriod;
  }, [logsByPeriod, filtro]);

  const stats = useMemo(() => {
    const ativados = logsByPeriod.filter(l => l.decisao).length;
    return {
      total: logsByPeriod.length,
      ativados,
      naoAtivados: logsByPeriod.length - ativados,
      taxaAtivacao: logsByPeriod.length > 0 ? Math.round((ativados / logsByPeriod.length) * 100) : 0,
    };
  }, [logsByPeriod]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["triage_ia_logs", profile?.organization_id] });
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TRIAGEM DE ATIVAÇÃO</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Decisões de ativação da IA por lead</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 divide-x divide-border/40">
          {[
            { label: "Total analisados", value: stats.total, color: "text-foreground" },
            { label: "IA ativada", value: stats.ativados, color: "text-emerald-600" },
            { label: "Não ativada", value: stats.naoAtivados, color: "text-amber-600" },
            { label: "Taxa de ativação", value: `${stats.taxaAtivacao}%`, color: "text-foreground" },
          ].map((s) => (
            <div key={s.label} className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{s.label}</p>
              <p className={`text-2xl font-bold font-display tabular-nums mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Filters */}
        <div className="px-5 py-3 border-b border-border/40 flex items-center gap-3 flex-wrap">
          <DateRangePicker date={dateRange} setDate={setDateRange} className="w-auto" />
          <div className="w-px h-4 bg-border/40 shrink-0" />
          <Filter className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  filtro === f.key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground/50 ml-auto">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium font-display text-muted-foreground">Nenhum registro encontrado</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {filtro === "todos"
                ? "Nenhum registro neste período"
                : "Nenhum lead nesta categoria no período"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_2fr_1fr_2fr_80px_90px] gap-4 px-5 py-2.5 bg-muted/[0.03]">
              {["Lead", "Mensagem", "Decisão", "Motivo", "Duração", "Data"].map((h) => (
                <p key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{h}</p>
              ))}
            </div>

            {filtered.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-[1fr_2fr_1fr_2fr_80px_90px] gap-4 px-5 py-3.5 items-start hover:bg-muted/[0.03] transition-colors"
              >
                {/* Lead */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {log.lead_nome || "—"}
                  </p>
                  {log.origem_lead && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {ORIGEM_LABEL[log.origem_lead] ?? log.origem_lead}
                    </p>
                  )}
                </div>

                {/* Mensagem */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {log.mensagem
                    ? `"${log.mensagem.length > 120 ? log.mensagem.slice(0, 120) + "…" : log.mensagem}"`
                    : <span className="italic opacity-50">{log.tipo_mensagem ?? "sem texto"}</span>
                  }
                </p>

                {/* Decisão */}
                <div>
                  {log.decisao ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      IA ativada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <XCircle className="h-3 w-3" />
                      Humano
                    </span>
                  )}
                </div>

                {/* Motivo */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {log.motivo ?? "—"}
                </p>

                {/* Duração */}
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 font-display tabular-nums">
                  <Clock className="h-3 w-3 shrink-0" />
                  {log.duracao_ms != null ? `${log.duracao_ms}ms` : "—"}
                </div>

                {/* Data */}
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5 font-display tabular-nums">
                    {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
