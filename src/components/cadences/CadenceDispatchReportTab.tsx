import { useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  GitMerge, Users, CheckCircle2, MessageSquareReply, XCircle,
  Clock, TrendingUp, Zap, ChevronRight, Filter
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { useCadenceDispatches, DispatchReport } from "@/hooks/useCadenceDispatches";

// ── Barra de progresso ────────────────────────────────────────────────────────
function RateBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

// ── Item de métrica (usado no modal) ──────────────────────────────────────────
function MetricItem({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">{label}</p>
        <p className="text-base font-bold text-foreground leading-tight font-display tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Card resumido (clicável) ──────────────────────────────────────────────────
function DispatchCard({ dispatch, onClick }: { dispatch: DispatchReport; onClick: () => void }) {
  const dataFormatada = format(new Date(dispatch.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const emAndamento = dispatch.leads_ativos > 0;

  return (
    <div
      className="group rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-primary/50 hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Badge
              variant="outline"
              className="w-fit mb-2 text-[10px] uppercase font-bold tracking-widest bg-primary/5 text-primary border-primary/20"
            >
              <Zap className="h-2.5 w-2.5 mr-1" /> Disparo em Massa
            </Badge>
            <p className="text-base font-semibold font-display text-foreground truncate">{dispatch.cadencia_nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{dataFormatada}</p>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold shrink-0 ${emAndamento
              ? 'bg-amber-500/10 text-amber-600 border-amber-200'
              : 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
            }`}
          >
            {emAndamento ? 'Em andamento' : 'Finalizado'}
          </Badge>
        </div>
      </div>

      <div className="px-5 pb-4">
        {/* Resumo mínimo */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground border-t border-dashed pt-3">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> <span className="font-display tabular-nums">{dispatch.total_leads}</span> leads
          </span>
          <span className="flex items-center gap-1.5 text-primary font-medium">
            <MessageSquareReply className="h-3.5 w-3.5" /> <span className="font-display tabular-nums">{dispatch.taxa_resposta}%</span> responderam
          </span>
        </div>
        <div className="mt-2 space-y-1">
          <RateBar value={dispatch.taxa_resposta} color="bg-primary" />
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-3 flex items-center gap-1 group-hover:text-primary transition-colors">
          Ver relatório completo <ChevronRight className="h-3 w-3" />
        </p>
      </div>
    </div>
  );
}

// ── Modal de detalhes ─────────────────────────────────────────────────────────
function DispatchDetailModal({ dispatch, open, onClose }: {
  dispatch: DispatchReport | null; open: boolean; onClose: () => void;
}) {
  if (!dispatch) return null;
  const dataFormatada = format(new Date(dispatch.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const emAndamento = dispatch.leads_ativos > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-bold tracking-widest bg-primary/5 text-primary border-primary/20"
            >
              <Zap className="h-2.5 w-2.5 mr-1" /> Disparo em Massa
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold ${emAndamento
                ? 'bg-amber-500/10 text-amber-600 border-amber-200'
                : 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
              }`}
            >
              {emAndamento ? 'Em andamento' : 'Finalizado'}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-display">{dispatch.cadencia_nome}</DialogTitle>
          <DialogDescription>{dataFormatada}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Métricas de leads */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">
              Status dos leads
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MetricItem icon={Users}               label="Leads disparados" value={dispatch.total_leads}     color="bg-blue-500/10 text-blue-600" />
              <MetricItem icon={Clock}               label="Em andamento"     value={dispatch.leads_ativos}    color="bg-amber-500/10 text-amber-600" />
              <MetricItem icon={MessageSquareReply}  label="Responderam"      value={dispatch.leads_pausados}  color="bg-primary/10 text-primary" />
              <MetricItem icon={CheckCircle2}        label="Concluídos"       value={dispatch.leads_concluidos} color="bg-emerald-500/10 text-emerald-600" />
              {dispatch.leads_cancelados > 0 && (
                <MetricItem icon={XCircle} label="Cancelados" value={dispatch.leads_cancelados} color="bg-destructive/10 text-destructive" />
              )}
            </div>
          </div>

          {/* Taxas com barras */}
          <div className="border-t border-dashed pt-4 space-y-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">
              Taxas de performance
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MessageSquareReply className="h-3.5 w-3.5" /> Taxa de Resposta
                </span>
                <span className="text-sm font-bold text-primary font-display tabular-nums">{dispatch.taxa_resposta}%</span>
              </div>
              <RateBar value={dispatch.taxa_resposta} color="bg-primary" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Taxa de Conclusão
                </span>
                <span className="text-sm font-bold text-emerald-600 font-display tabular-nums">{dispatch.taxa_conclusao}%</span>
              </div>
              <RateBar value={dispatch.taxa_conclusao} color="bg-emerald-500" />
            </div>

            {emAndamento && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Ainda em andamento
                  </span>
                  <span className="text-sm font-bold text-amber-600 font-display tabular-nums">{dispatch.taxa_andamento}%</span>
                </div>
                <RateBar value={dispatch.taxa_andamento} color="bg-amber-400" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────
export function CadenceDispatchReportTab() {
  const { data: dispatches = [], isLoading } = useCadenceDispatches();

  const [selected, setSelected]         = useState<DispatchReport | null>(null);
  const [dateRange, setDateRange]        = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter]  = useState<string>("todos");
  const [cadenceFilter, setCadenceFilter] = useState<string>("todas");

  // Lista única de cadências para o filtro
  const cadenceOptions = useMemo(() => {
    const names = [...new Set(dispatches.map(d => d.cadencia_nome))];
    return names;
  }, [dispatches]);

  // Filtragem client-side
  const filtered = useMemo(() => {
    return dispatches.filter(d => {
      if (cadenceFilter !== "todas" && d.cadencia_nome !== cadenceFilter) return false;

      if (statusFilter === "andamento" && d.leads_ativos === 0) return false;
      if (statusFilter === "finalizado" && d.leads_ativos > 0) return false;

      if (dateRange?.from) {
        const date = new Date(d.criado_em);
        const from = startOfDay(dateRange.from);
        const to   = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        if (!isWithinInterval(date, { start: from, end: to })) return false;
      }

      return true;
    });
  }, [dispatches, cadenceFilter, statusFilter, dateRange]);

  const hasFilters = !!dateRange?.from || statusFilter !== "todos" || cadenceFilter !== "todas";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <DateRangePicker date={dateRange} setDate={setDateRange} />

        <Select value={cadenceFilter} onValueChange={setCadenceFilter}>
          <SelectTrigger className="h-9 w-[180px] bg-background text-sm">
            <SelectValue placeholder="Cadência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as cadências</SelectItem>
            {cadenceOptions.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px] bg-background text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="andamento">Em andamento</SelectItem>
            <SelectItem value="finalizado">Finalizado</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setDateRange(undefined); setStatusFilter("todos"); setCadenceFilter("todas"); }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Contador */}
      {dispatches.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'disparo encontrado' : 'disparos encontrados'}
          {hasFilters && <span className="text-primary"> (filtrado)</span>}
        </p>
      )}

      {/* Estado vazio */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/5 flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted p-4 rounded-full mb-4">
            <GitMerge className="h-10 w-10 text-muted-foreground/40" />
          </div>
          {dispatches.length === 0 ? (
            <>
              <p className="text-sm font-semibold font-display text-muted-foreground mb-1">Nenhum disparo em massa realizado ainda.</p>
              <p className="text-[11px] text-muted-foreground/50">Use o botão "Disparar" em uma cadência para iniciar um envio em massa.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold font-display text-muted-foreground mb-1">Nenhum disparo encontrado para os filtros aplicados.</p>
              <p className="text-[11px] text-muted-foreground/50">Tente ajustar o período ou os filtros selecionados.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(dispatch => (
            <DispatchCard
              key={dispatch.id}
              dispatch={dispatch}
              onClick={() => setSelected(dispatch)}
            />
          ))}
        </div>
      )}

      <DispatchDetailModal
        dispatch={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
