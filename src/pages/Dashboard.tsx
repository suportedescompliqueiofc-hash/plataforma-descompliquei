import {
  UserPlus, TrendingUp, DollarSign, Tag, AlertTriangle, RefreshCw,
  Megaphone, Users, CalendarCheck, BadgeCheck, Bot, Timer, ArrowRight,
  Target, Filter, BarChart2, Stethoscope, Wallet, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { useDashboard, type OrigemFilter } from "@/hooks/useDashboard";
import { useProfile } from "@/hooks/useProfile";
import { DESCOMPLIQUEI_ORG_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Button } from "@/components/ui/button";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg">
        <p className="font-semibold text-foreground mb-1 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-muted-foreground capitalize">{entry.name}:</span>
            <span className="text-xs font-bold text-foreground">
              {entry.name === 'Faturamento'
                ? `R$ ${Number(entry.value).toLocaleString('pt-BR')}`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-2 mb-4 pl-3 border-l-[3px] border-primary">
    <Icon className="h-4 w-4 text-primary flex-shrink-0" />
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
  </div>
);

interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  icon: any;
  topColor?: string;
  alert?: boolean;
}

const MetricCard = ({ title, value, description, icon: Icon, topColor = 'hsl(var(--primary))', alert = false }: MetricCardProps) => (
  <Card className="overflow-hidden shadow-sm" style={{ borderTop: `3px solid ${alert ? '#ef4444' : topColor}` }}>
    <CardContent className="p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest leading-tight pr-1">{title}</span>
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${alert ? 'text-destructive' : 'text-muted-foreground/40'}`} />
      </div>
      <div className={`text-2xl font-bold truncate ${alert && value !== '0' ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
      {description && <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>}
    </CardContent>
  </Card>
);

interface FunnelStepCardProps {
  from: string;
  to: string;
  rate: number;
  fromCount: number;
  toCount: number;
}

const FunnelStepCard = ({ from, to, rate, fromCount, toCount }: FunnelStepCardProps) => (
  <Card className="overflow-hidden shadow-sm">
    <CardContent className="p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[10px] text-muted-foreground truncate">{from}</span>
        <ArrowRight className="h-2.5 w-2.5 text-primary flex-shrink-0" />
        <span className="text-[10px] text-muted-foreground truncate">{to}</span>
      </div>
      <div className="text-2xl font-bold text-primary">{rate ?? 0}%</div>
      <div className="text-xs text-muted-foreground">{toCount ?? 0} de {fromCount ?? 0}</div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rate ?? 0, 100)}%` }}
        />
      </div>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const today = new Date();
  const initialDateRange: DateRange = { from: startOfMonth(today), to: endOfMonth(today) };
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const [origemFilter, setOrigemFilter] = useState<OrigemFilter>('geral');

  const { profile } = useProfile();
  const isDescompliqueiOrg = profile?.organization_id === DESCOMPLIQUEI_ORG_ID;

  const { metrics, isLoading, error: metricsError, refetch } = useDashboard(dateRange, origemFilter);

  const GRADIENTS = (
    <defs>
      <linearGradient id="colorCaptados" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="colorConvertidos" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="colorMqls" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="colorAgendamentos" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="colorFechamentos" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
      </linearGradient>
    </defs>
  );

  if (metricsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-4 text-center">
        <div className="bg-destructive/10 p-6 rounded-full">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold">Erro ao carregar o painel</h3>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const faturamento = metrics.faturamentoTotal ?? 0;
  const summaryText = `${metrics.totalContatos ?? 0} leads captados · R$ ${faturamento.toLocaleString('pt-BR')} faturados · ${metrics.conversionRate ?? '0'}% de conversão`;

  const funnelConversion: FunnelStepCardProps[] = metrics.funnelConversion ?? [];
  const pipelineDistribution: { name: string; value: number; color: string }[] = metrics.pipelineDistribution ?? [];
  const topProcedimentos: { name: string; count: number }[] = metrics.topProcedimentos ?? [];

  const taxaMQL = metrics.taxaMQL ?? 0;
  const taxaAgendamento = metrics.taxaAgendamento ?? 0;
  const taxaFechamento = metrics.taxaFechamento ?? 0;
  const taxaConversaoGlobal = metrics.taxaConversaoGlobal ?? 0;
  const ticketMedio = metrics.ticketMedio ?? 0;
  const custoPerLead = metrics.custoPerLead ?? 0;
  const leadsAtendidosIA = metrics.leadsAtendidosIA ?? 0;
  const taxaHandoffIA = metrics.taxaHandoffIA ?? 0;
  const tempoMedioIA = metrics.tempoMedioIA ?? 0;
  const aguardandoContato = metrics.aguardandoContatoHumano ?? 0;

  return (
    <div className="space-y-8 max-w-full overflow-hidden">

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Painel de Controle</h1>
          <p className="text-sm text-muted-foreground mt-1">Relatório de performance comercial</p>
          <p className="text-xs text-primary font-medium mt-1">{summaryText}</p>
        </div>
        <div className="flex flex-col gap-2 items-stretch md:items-end w-full md:w-auto">
          <div className="flex rounded-lg border border-border bg-muted/50 p-0.5 gap-0.5 self-start md:self-end">
            {([
              { key: 'geral', label: 'Geral' },
              { key: 'marketing', label: 'Marketing' },
              { key: 'organico', label: 'Orgânico' },
            ] as { key: OrigemFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setOrigemFilter(key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  origemFilter === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <DateRangePicker date={dateRange} setDate={setDateRange} className="w-full" />
        </div>
      </div>

      {/* Funil Descompliquei (exclusivo org Descompliquei) */}
      {isDescompliqueiOrg && (() => {
        const f = metrics.descompliqueiFunnel ?? { leads: 0, mql: 0, scheduled: 0, closed: 0, txMql: 0, txAgendamento: 0, txConversao: 0 };
        const steps = [
          { label: 'Leads', value: f.leads, desc: 'Captados via marketing', color: '#6366f1' },
          { label: 'MQL', value: f.mql, desc: 'Qualificados', color: '#8b5cf6' },
          { label: 'Reuniões', value: f.scheduled, desc: 'Agendadas', color: '#3b82f6' },
          { label: 'Fechamentos', value: f.closed, desc: 'Vendas fechadas', color: '#10b981' },
        ];
        const rates = [
          { label: 'Tx MQL', value: f.txMql },
          { label: 'Tx Agendamento', value: f.txAgendamento },
          { label: 'Tx Conversão', value: f.txConversao },
        ];
        return (
          <div>
            <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-stretch flex-1 min-w-0">
                  <Card className="flex-1 overflow-hidden shadow-sm min-w-[140px]" style={{ borderTop: `3px solid ${step.color}` }}>
                    <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{step.label}</span>
                      <div className="text-3xl sm:text-4xl font-black text-foreground mt-1">{step.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                    </CardContent>
                  </Card>
                  {i < steps.length - 1 && (
                    <div className="flex flex-col items-center justify-center px-2 sm:px-3 shrink-0">
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-[9px] sm:text-[10px] font-bold text-primary whitespace-nowrap mt-0.5">{rates[i].label}</span>
                      <span className="text-sm sm:text-base font-black text-primary">{rates[i].value}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Seção — Qualidade dos Leads (exclusivo Descompliquei, logo abaixo do funil) */}
      {isDescompliqueiOrg && (() => {
        const scoring = metrics.scoringDistribution ?? [];
        const totalQualified = scoring.reduce((sum: number, s: any) => sum + s.count, 0);

        const SCORING_META: Record<string, { label: string; bg: string; text: string; bar: string }> = {
          A: { label: 'Lead dos sonhos', bg: '#E1F5EE', text: '#085041', bar: '#1D9E75' },
          B: { label: 'Qualificado com ressalva', bg: '#E6F1FB', text: '#0C447C', bar: '#378ADD' },
          C: { label: 'Em desenvolvimento', bg: '#FAEEDA', text: '#633806', bar: '#BA7517' },
          D: { label: 'Fora do ICP', bg: '#FCEBEB', text: '#791F1F', bar: '#E24B4A' },
        };

        return (
          <div>
            <SectionHeader title="Qualidade dos Leads" icon={BadgeCheck} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {scoring.map((s: any) => {
                const meta = SCORING_META[s.scoring];
                const pct = totalQualified > 0 ? Math.round((s.count / totalQualified) * 100) : 0;
                return (
                  <Card key={s.scoring} className="overflow-hidden shadow-sm border-0" style={{ backgroundColor: meta.bg }}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span
                          className="flex items-center justify-center h-9 w-9 rounded-lg text-base font-black flex-shrink-0"
                          style={{ backgroundColor: meta.bar, color: '#fff' }}
                        >
                          {s.scoring}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: meta.text }}>{meta.label}</p>
                          <p className="text-[10px] uppercase tracking-widest font-semibold opacity-60" style={{ color: meta.text }}>Scoring {s.scoring}</p>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black" style={{ color: meta.text }}>{s.count}</span>
                        <span className="text-sm font-bold" style={{ color: meta.bar }}>{pct}%</span>
                        <span className="text-[10px] opacity-60" style={{ color: meta.text }}>dos MQLs</span>
                      </div>
                      <div className="h-2 bg-white/60 rounded-full overflow-hidden mt-3">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: meta.bar }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Seção — Eficiência de Aquisição (exclusivo Descompliquei) */}
      {isDescompliqueiOrg && (() => {
        const aq = metrics.acquisitionEfficiency ?? { investment: 0, cpl: null, cpm: null, cpa: null, cpf: null };
        const fmt = (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : '—';
        const roas = (aq.investment && aq.investment > 0 && faturamento > 0)
          ? (faturamento / aq.investment).toFixed(2) + 'x'
          : '—';
        const cards = [
          { label: 'CPL', title: 'Custo por Lead', value: fmt(aq.cpl), color: '#6366f1' },
          { label: 'CPMQL', title: 'Custo por MQL', value: fmt(aq.cpm), color: '#8b5cf6' },
          { label: 'CPR', title: 'Custo por Reunião', value: fmt(aq.cpa), color: '#3b82f6' },
          { label: 'CPA', title: 'Custo de Aquisição', value: fmt(aq.cpf), color: '#10b981' },
          { label: 'ROAS', title: 'Retorno sobre Anúncios', value: roas, color: '#f59e0b' },
        ];
        return (
          <div>
            <SectionHeader title="Eficiência de Aquisição" icon={DollarSign} />
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              {cards.map((c) => (
                <Card key={c.label} className="overflow-hidden shadow-sm" style={{ borderTop: `3px solid ${c.color}` }}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{c.label}</span>
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-foreground mt-1">{c.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{c.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Seção 1 — Visão Geral de Captação (oculta para Descompliquei — dados já no funil) */}
      {!isDescompliqueiOrg && (
        <div>
          <SectionHeader title="Visão Geral de Captação" icon={Target} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              title="Total de Leads"
              value={(metrics.totalContatos ?? 0).toString()}
              description="Captados no período"
              icon={UserPlus}
              topColor="hsl(var(--primary))"
            />
            <MetricCard
              title="Leads Marketing"
              value={(metrics.marketingLeads ?? 0).toString()}
              description="Via anúncios (Ads)"
              icon={Megaphone}
              topColor="#8b5cf6"
            />
            <MetricCard
              title="Leads Orgânico"
              value={(metrics.organicLeads ?? 0).toString()}
              description="Indicação, manual..."
              icon={Users}
              topColor="#3b82f6"
            />
            <MetricCard
              title="Custo por Lead"
              value={custoPerLead > 0
                ? `R$ ${custoPerLead.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
                : 'R$ 0,00'}
              description="Investimento / leads marketing"
              icon={DollarSign}
              topColor="#10b981"
            />
          </div>
        </div>
      )}

      {/* Seção 2 — Funil de Conversão por pipeline (oculta para Descompliquei — usa funil próprio) */}
      {!isDescompliqueiOrg && (
        <div>
          <SectionHeader title="Funil de Conversão" icon={Filter} />
          {funnelConversion.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {funnelConversion.map((step, i) => (
                <FunnelStepCard key={i} {...step} />
              ))}
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                Sem dados de funil para o período selecionado
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Seção 3 — Performance Comercial */}
      <div>
        <SectionHeader title={isDescompliqueiOrg ? "Performance Comercial Global" : "Performance Comercial"} icon={BarChart2} />
        {(() => {
          const total = metrics.totalContatos ?? 0;
          const mql = metrics.mqlCount ?? 0;
          const sched = metrics.scheduledCount ?? 0;
          const closed = metrics.closedCount ?? 0;
          const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0';

          return (
            <div className={cn("grid gap-3 sm:gap-4", isDescompliqueiOrg ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6")}>
              <MetricCard
                title="Taxa de MQL"
                value={`${isDescompliqueiOrg ? pct(mql) : taxaMQL}%`}
                description={`${mql} qualificados / ${total} leads`}
                icon={Tag}
                topColor="#8b5cf6"
              />
              <MetricCard
                title="Taxa Agendamento"
                value={`${isDescompliqueiOrg ? pct(sched) : taxaAgendamento}%`}
                description={`${sched} agendados / ${total} leads`}
                icon={CalendarCheck}
                topColor="#3b82f6"
              />
              <MetricCard
                title="Taxa Fechamento"
                value={`${isDescompliqueiOrg ? pct(closed) : taxaFechamento}%`}
                description={`${closed} fechados / ${total} leads`}
                icon={BadgeCheck}
                topColor="#10b981"
              />
              {!isDescompliqueiOrg && (
                <MetricCard
                  title="Conversão Global"
                  value={`${taxaConversaoGlobal}%`}
                  description="Fechados / marketing"
                  icon={TrendingUp}
                  topColor="hsl(var(--primary))"
                />
              )}
              {!isDescompliqueiOrg && (
                <>
                  <MetricCard
                    title="Ticket Médio"
                    value={ticketMedio > 0
                      ? `R$ ${ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
                      : 'R$ 0'}
                    description="Por venda fechada"
                    icon={Wallet}
                    topColor="#f59e0b"
                  />
                  <MetricCard
                    title="Faturamento Total"
                    value={`R$ ${faturamento.toLocaleString('pt-BR')}`}
                    description="Vendas fechadas"
                    icon={DollarSign}
                    topColor="#22c55e"
                  />
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Seção 4 — Performance da IA */}
      <div>
        <SectionHeader title="Performance da IA" icon={Bot} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            title="Atendidos pela IA"
            value={leadsAtendidosIA.toString()}
            description="Marketing com IA ativa"
            icon={Bot}
            topColor="#6366f1"
          />
          <MetricCard
            title={isDescompliqueiOrg ? "Taxa de Passagem para Humano" : "Taxa de Handoff IA"}
            value={`${taxaHandoffIA}%`}
            description="Chegaram ao Handoff"
            icon={ArrowRight}
            topColor="#8b5cf6"
          />
          <MetricCard
            title="Tempo Médio IA"
            value={tempoMedioIA > 0 ? `${tempoMedioIA}s` : '—'}
            description="Por atendimento (seg)"
            icon={Timer}
            topColor="#3b82f6"
          />
          <MetricCard
            title="Aguardando Humano"
            value={aguardandoContato.toString()}
            description="Leads no Handoff sem IA"
            icon={AlertTriangle}
            topColor={aguardandoContato > 0 ? '#ef4444' : undefined}
            alert={aguardandoContato > 0}
          />
        </div>
      </div>

      {/* Seção 5 — Gráficos */}
      {isDescompliqueiOrg ? (
        <div>
          <SectionHeader title="Evolução no Tempo" icon={Activity} />
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="px-4 pt-4 pb-1">
              <CardTitle className="text-base">Leads, MQLs, Agendamentos e Fechamentos</CardTitle>
              <p className="text-xs text-muted-foreground">Evolução diária no período selecionado (marketing)</p>
            </CardHeader>
            <CardContent className="p-2 pt-0 pb-3">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.descompliqueiOverTime ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    {GRADIENTS}
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                    <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    <Area type="monotone" dataKey="leads" name="Leads Captados" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorCaptados)" />
                    <Area type="monotone" dataKey="mqls" name="MQLs" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorMqls)" />
                    <Area type="monotone" dataKey="agendamentos" name="Agendamentos" stroke="#3b82f6" strokeWidth={2} fill="url(#colorAgendamentos)" />
                    <Area type="monotone" dataKey="fechamentos" name="Fechamentos" stroke="#10b981" strokeWidth={2} fill="url(#colorFechamentos)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div>
          <SectionHeader title="Evolução & Distribuição" icon={Activity} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="px-4 pt-4 pb-1">
                <CardTitle className="text-base">Evolução de Leads</CardTitle>
                <p className="text-xs text-muted-foreground">Captados vs Convertidos no período</p>
              </CardHeader>
              <CardContent className="p-2 pt-0 pb-3">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.leadsOverTime ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      {GRADIENTS}
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                      <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                      <Area type="monotone" dataKey="captados" name="Captados" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorCaptados)" />
                      <Area type="monotone" dataKey="convertidos" name="Convertidos" stroke="#10b981" strokeWidth={2} fill="url(#colorConvertidos)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="px-4 pt-4 pb-1">
                <CardTitle className="text-base">Distribuição do Funil</CardTitle>
                <p className="text-xs text-muted-foreground">Leads por etapa no período</p>
              </CardHeader>
              <CardContent className="p-2 pt-0 pb-3">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.15} />
                      <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={85} />
                      <Tooltip content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover/95 backdrop-blur-sm border border-border p-2 rounded-lg shadow-lg">
                              <p className="text-xs font-semibold text-foreground">{label}</p>
                              <p className="text-xs text-primary">{payload[0].value} leads</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
                        {pipelineDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Seção 6 — Top Procedimentos (oculta para Descompliquei) */}
      {!isDescompliqueiOrg && (
        <div>
          <SectionHeader title="Top Procedimentos" icon={Stethoscope} />
          {topProcedimentos.length > 0 ? (
            <Card className="shadow-sm overflow-hidden">
              <div className="divide-y divide-border">
                {topProcedimentos.map((proc, i) => {
                  const maxCount = topProcedimentos[0]?.count || 1;
                  const pct = Math.round((proc.count / maxCount) * 100);
                  return (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                      <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">#{i + 1}</span>
                      <span className="text-sm text-foreground flex-1 min-w-0 truncate">{proc.name}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-bold text-primary w-8 text-right">{proc.count}</span>
                        <span className="text-xs text-muted-foreground">leads</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                Sem dados de procedimentos para o período selecionado
              </CardContent>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}
