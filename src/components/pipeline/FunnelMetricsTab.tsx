import { useState } from "react";
import { useFunnelMetrics } from "@/hooks/useFunnelMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { AlertCircle, TrendingDown, TrendingUp, Filter, ArrowDown, ChevronDown, Target, Zap, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FunnelMetricsTabProps {
  dateRange: DateRange | undefined;
}

export function FunnelMetricsTab({ dateRange }: FunnelMetricsTabProps) {
  const [activeFunnel, setActiveFunnel] = useState<'marketing' | 'organico'>('marketing');
  const { data: funnelData, isLoading, error } = useFunnelMetrics(dateRange, activeFunnel);

  const topCount = funnelData?.[0]?.count || 1;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      );
    }

    if (error || !funnelData || funnelData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted/40 p-6 rounded-2xl mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground/25" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/70">Dados insuficientes</p>
          <p className="text-xs text-muted-foreground/50 mt-1 max-w-sm">
            Não foi possível carregar as etapas do funil para esta seleção.
          </p>
        </div>
      );
    }

    const lastStep = funnelData[funnelData.length - 1];
    const biggestDrop = [...funnelData].slice(0, -1).sort((a, b) => b.dropoffCount - a.dropoffCount)[0];
    const bestConversion = [...funnelData].slice(0, -1).sort((a, b) => b.conversionToNext - a.conversionToNext)[0];

    return (
      <div className="space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-tutorial="pipeline-metrics-kpis">
          {/* Eficiência Global */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-emerald-50">
                <Target className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Eficiência Global</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-display">
                {lastStep?.conversionFromStart.toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {lastStep?.count} de {topCount} leads convertidos
            </p>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(lastStep?.conversionFromStart || 0, 2)}%`,
                  backgroundColor: lastStep?.color || '#10b981'
                }}
              />
            </div>
          </div>

          {/* Maior Ponto de Perda */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-red-50">
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Maior Perda</span>
            </div>
            {biggestDrop && biggestDrop.dropoffCount > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-red-600 font-display">
                    -{biggestDrop.dropoffCount}
                  </span>
                  <span className="text-xs text-muted-foreground">leads</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: biggestDrop.color }} />
                  <span className="text-[11px] text-muted-foreground">{biggestDrop.stageName}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem perdas</p>
            )}
          </div>

          {/* Melhor Conversão */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Zap className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Melhor Conversão</span>
            </div>
            {bestConversion ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground font-display">
                    {bestConversion.conversionToNext.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: bestConversion.color }} />
                  <span className="text-[11px] text-muted-foreground">{bestConversion.stageName}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">-</p>
            )}
          </div>
        </div>

        {/* Funnel Visualization */}
        <div className="rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="pipeline-metrics-funnel">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="text-sm font-semibold text-foreground">Fluxo de Conversão</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Volume de leads por etapa — {activeFunnel === 'marketing' ? 'Marketing' : 'Orgânico'}
            </p>
          </div>

          <div className="p-5 space-y-0">
            {funnelData.map((step, index) => {
              const isLast = index === funnelData.length - 1;
              const widthPercentage = step.count > 0 ? Math.max((step.count / topCount) * 100, 3) : 0;
              const isPositive = step.conversionToNext >= 50;

              return (
                <div key={step.stageId || index}>
                  {/* Stage Row */}
                  <div className="flex items-center gap-4 group">
                    {/* Stage name */}
                    <div className="w-32 flex-shrink-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[12px] font-medium text-muted-foreground truncate" title={step.stageName}>
                          {step.stageName}
                        </span>
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: step.color }} />
                      </div>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-9 bg-muted/30 rounded-lg relative flex items-center overflow-hidden">
                      {step.count > 0 && (
                        <div
                          className="h-full rounded-lg flex items-center transition-all duration-500 ease-out relative"
                          style={{
                            width: `${widthPercentage}%`,
                            backgroundColor: `${step.color}18`,
                          }}
                        >
                          {/* Inner colored accent bar */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                            style={{ backgroundColor: step.color }}
                          />
                          <span
                            className="text-[12px] font-bold ml-3.5 tabular-nums"
                            style={{ color: step.color }}
                          >
                            {step.count}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Percentage */}
                    <div className="w-20 flex-shrink-0 text-right">
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        {step.conversionFromStart.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Conversion connector */}
                  {!isLast && (
                    <div className="flex items-center gap-4 h-8 my-0.5">
                      <div className="w-32" />
                      <div className="flex-1 flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="h-3 w-3 text-muted-foreground/30" />
                          <span className={cn(
                            "text-[10px] font-semibold tabular-nums",
                            isPositive ? "text-emerald-600" : "text-red-500"
                          )}>
                            {step.conversionToNext.toFixed(0)}% conversão
                          </span>
                        </div>
                        {step.dropoffCount > 0 && (
                          <span className="text-[10px] font-medium text-red-400 tabular-nums">
                            -{step.dropoffCount} perdidos
                          </span>
                        )}
                      </div>
                      <div className="w-20" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Info */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-muted/30 border border-border/40">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Exibindo funil de <strong className="text-foreground font-medium">{activeFunnel === 'marketing' ? 'Marketing (Anúncios)' : 'Orgânico (Indicação/Outros)'}</strong>.
            Leads movidos para "Desqualificado" ou "Perdido" são contabilizados até a última etapa válida que alcançaram.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs
        value={activeFunnel}
        onValueChange={(v) => setActiveFunnel(v as 'marketing' | 'organico')}
        className="w-full"
      >
        <div className="flex items-center mb-6">
          <TabsList className="bg-muted/40 border border-border/40 p-0.5 rounded-lg inline-flex">
            <TabsTrigger value="marketing" className="text-xs font-semibold whitespace-nowrap rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Marketing
            </TabsTrigger>
            <TabsTrigger value="organico" className="text-xs font-semibold whitespace-nowrap rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
              Orgânico
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="marketing" className="m-0">
          {renderContent()}
        </TabsContent>

        <TabsContent value="organico" className="m-0">
          {renderContent()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
