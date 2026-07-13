// Seção "Resultado no CRM" da ficha do cliente (Admin OS › CS).
// Mostra o que o cliente PERCEBE de resultado: faturamento + crescimento, meta,
// funil de conversão, tempo de atendimento e adoção de funcionalidades.
//
// Separação visual clara em duas zonas:
// 1) DADOS DO PERÍODO — reagem ao filtro Dia/Semana/Mês + navegação ◀▶ (via
//    get_cs_client_crm_period): Resultado no CRM (faturamento+crescimento,
//    fechamentos), Funil, Tempo de atendimento.
// 2) DADOS GERAIS — fixos, não mudam com o filtro (separados por um divisor
//    explícito): Meta ativa, Histórico Geral (faturamento total + 12 meses),
//    Adoção de funcionalidades.
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, isToday, isSameMonth, min as dateMin,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign, TrendingUp, TrendingDown, Target, Filter, Clock, Zap, RefreshCw,
  CheckCircle2, Circle, ChevronLeft, ChevronRight, CalendarDays, History,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/CurrencyInput';
import {
  type CSCrmMetrics, type CSCrmDetail,
  formatBRL, formatBRLCompact, formatMinutes,
} from '../types/cs';
import { useCSClientCrmPeriod, useSetClientMeta } from '@/hooks/useCSCrm';

type PeriodType = 'dia' | 'semana' | 'mes';

function SectionCard({ id, icon: Icon, title, desc, children }: {
  id?: string; icon: React.ElementType; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div id={id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden scroll-mt-4">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
            {desc && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{desc}</p>}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ResultadoCrmSection({ orgId, metrics, detail, loading }: {
  orgId: string | null | undefined;
  metrics: CSCrmMetrics | null;
  detail: CSCrmDetail | null;
  loading: boolean;
}) {
  // ── Estado do filtro de período ──
  const [periodType, setPeriodType] = useState<PeriodType>('mes');
  const [offset, setOffset] = useState(0); // 0 = período atual, -1 = anterior, ...

  // ── Dialog de configurar meta ──
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaValor, setMetaValor] = useState<number | null>(null);
  const setMeta = useSetClientMeta();

  const today = useMemo(() => new Date(), []);
  const { from, to, toQuery, label, atAtual } = useMemo(() => {
    const base =
      periodType === 'dia' ? addDays(today, offset) :
      periodType === 'semana' ? addWeeks(today, offset) :
      addMonths(today, offset);
    let f: Date, t: Date, lbl: string;
    if (periodType === 'dia') {
      f = base; t = base;
      lbl = isToday(base) ? 'Hoje' : format(base, "d 'de' MMM", { locale: ptBR });
    } else if (periodType === 'semana') {
      f = startOfWeek(base, { locale: ptBR }); t = endOfWeek(base, { locale: ptBR });
      lbl = `${format(f, 'd MMM', { locale: ptBR })} – ${format(t, 'd MMM', { locale: ptBR })}`;
    } else {
      f = startOfMonth(base); t = endOfMonth(base);
      lbl = format(base, 'MMMM', { locale: ptBR });
    }
    // Limita a consulta até hoje (não busca futuro; mantém comparação justa período-a-período)
    const tq = dateMin([t, today]);
    return { from: f, to: t, toQuery: tq, label: lbl, atAtual: offset >= 0 };
  }, [periodType, offset, today]);

  const fromStr = format(from, 'yyyy-MM-dd');
  const toStr = format(toQuery, 'yyyy-MM-dd');
  const { data: period, isFetching: periodLoading } = useCSClientCrmPeriod(orgId, fromStr, toStr);

  const setType = (t: PeriodType) => { setPeriodType(t); setOffset(0); };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center justify-center py-14">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics && !detail) {
    return (
      <SectionCard icon={DollarSign} title="Resultado no CRM">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><DollarSign className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Sem dados de CRM para este cliente</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Nenhuma venda ou lead registrado ainda.</p>
        </div>
      </SectionCard>
    );
  }

  // Crescimento período-a-período (vs. período anterior de mesma duração)
  const pGrowth = period
    ? (period.faturamento_prev > 0
        ? Math.round((period.faturamento - period.faturamento_prev) / period.faturamento_prev * 100)
        : null)
    : null;

  const monthly = detail?.monthly ?? [];
  const maxFat = Math.max(1, ...monthly.map(m => m.faturamento));
  const funil = period?.funil;
  const tempo = period?.tempo;
  const ad = detail?.adocao;
  const ticket = period && period.fechamentos > 0 ? period.faturamento / period.fechamentos : null;

  const funilSteps = funil ? [
    { label: 'Leads', value: funil.leads, base: funil.leads },
    { label: 'MQL', value: funil.mql, base: funil.leads },
    { label: 'Agendamentos', value: funil.agendamentos, base: funil.leads },
    { label: 'Fechamentos', value: funil.fechamentos, base: funil.leads },
  ] : [];

  const features = ad ? [
    { label: 'IA de atendimento', on: ad.leads_com_ia > 0, hint: `${ad.leads_com_ia} leads` },
    { label: 'Follow-up', on: ad.leads_followup > 0, hint: `${ad.leads_followup} leads` },
    { label: 'Agendamentos', on: ad.agendamentos > 0, hint: `${ad.agendamentos} criados` },
    { label: 'Registro de vendas', on: ad.vendas > 0, hint: `${ad.vendas} vendas` },
    { label: 'Metas', on: ad.metas > 0, hint: ad.metas > 0 ? `${ad.metas} configuradas` : 'não configurada' },
    { label: 'Etiquetas', on: ad.leads_com_tag > 0, hint: `${ad.leads_com_tag} leads` },
  ] : [];
  const featOn = features.filter(f => f.on).length;

  return (
    <div className="space-y-5">
      {/* ── Barra de filtro de período (governa os dados do CRM abaixo) ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /></span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Período dos dados do CRM</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
            {(['dia', 'semana', 'mes'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                  periodType === t ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {t === 'mes' ? 'Mês' : t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(o => o - 1)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-xs font-semibold min-w-[112px] text-center capitalize tabular-nums">{label}</span>
            <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={atAtual}
              className={cn('h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 transition-colors',
                atAtual ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted/50')}>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* ══ ZONA 1 — DADOS DO PERÍODO (reagem ao filtro acima) ══════════════ */}

      {/* ── Faturamento + crescimento (período) ── */}
      <SectionCard id="resultado-financeiro" icon={DollarSign} title="Resultado no CRM" desc={`Faturamento e fechamentos do período · ${label}`}>
        <div className={cn('px-5 py-5 grid grid-cols-2 gap-4 transition-opacity', periodLoading && 'opacity-50')}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Faturamento</p>
            <p className="text-2xl font-bold tabular-nums font-display mt-1">{period ? formatBRLCompact(period.faturamento) : '—'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {pGrowth != null && pGrowth > 0 && <TrendingUp className="h-3 w-3 text-emerald-600" />}
              {pGrowth != null && pGrowth < 0 && <TrendingDown className="h-3 w-3 text-rose-600" />}
              <span className={cn('text-[11px] font-semibold',
                pGrowth == null ? 'text-muted-foreground/50' : pGrowth > 0 ? 'text-emerald-600' : pGrowth < 0 ? 'text-rose-600' : 'text-muted-foreground/50'
              )}>
                {pGrowth == null ? 'sem base anterior' : `${pGrowth > 0 ? '+' : ''}${pGrowth}% vs. período anterior`}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Fechamentos</p>
            <p className="text-2xl font-bold tabular-nums font-display mt-1">{period?.fechamentos ?? 0}</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">ticket {ticket != null ? formatBRLCompact(ticket) : '—'}</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Funil + Tempo (período) ── */}
      <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-5 transition-opacity', periodLoading && 'opacity-50')}>
        <SectionCard id="resultado-funil" icon={Filter} title="Funil de conversão" desc={`Leads criados · ${label}`}>
          <div className="px-5 py-4 space-y-2.5">
            {funilSteps.map((s, i) => {
              const pct = s.base > 0 ? Math.round(s.value / s.base * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{s.label}</span>
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                      {s.value}{i > 0 && <span className="text-muted-foreground/40"> · {pct}%</span>}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div className={cn('h-full rounded-full', i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-violet-500' : i === 2 ? 'bg-amber-500' : 'bg-emerald-500')}
                      style={{ width: `${Math.max(pct, s.value > 0 ? 3 : 0)}%` }} />
                  </div>
                </div>
              );
            })}
            {(!funil || funil.leads === 0) && (
              <p className="text-[11px] text-muted-foreground/50 py-2 text-center">Nenhum lead novo neste período.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard id="resultado-tempo" icon={Clock} title="Tempo de atendimento" desc={`Velocidade de resposta ao lead · ${label}`}>
          <div className="px-5 py-5 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className={cn('text-2xl font-bold tabular-nums font-display',
                tempo?.tempo_1o_contato_min == null ? 'text-muted-foreground' :
                tempo.tempo_1o_contato_min <= 15 ? 'text-emerald-600' :
                tempo.tempo_1o_contato_min <= 60 ? 'text-amber-600' : 'text-rose-600'
              )}>{formatMinutes(tempo?.tempo_1o_contato_min)}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">1º contato médio</p>
            </div>
            <div className="text-center">
              <p className={cn('text-2xl font-bold tabular-nums font-display',
                tempo?.tempo_resposta_med_min == null ? 'text-muted-foreground' :
                tempo.tempo_resposta_med_min <= 30 ? 'text-emerald-600' :
                tempo.tempo_resposta_med_min <= 120 ? 'text-amber-600' : 'text-rose-600'
              )}>{formatMinutes(tempo?.tempo_resposta_med_min)}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">resposta média</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ══ ZONA 2 — DADOS GERAIS (fixos, não mudam com o filtro) ═══════════ */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-border/50" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 whitespace-nowrap">Dados gerais — não mudam com o filtro</p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* ── Meta (fixa — meta ativa do cliente) ── */}
      <SectionCard id="resultado-meta" icon={Target} title="Meta de faturamento">
        <div className="px-5 py-5">
          {metrics?.tem_meta && metrics.meta_receita_ativa ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {formatBRL(metrics.meta_realizado ?? 0)} <span className="text-muted-foreground/50">de {formatBRL(metrics.meta_receita_ativa)}</span>
                </span>
                <span className={cn('text-lg font-bold tabular-nums font-display',
                  (metrics.meta_pct ?? 0) >= 100 ? 'text-emerald-600' : (metrics.meta_pct ?? 0) >= 70 ? 'text-amber-600' : 'text-rose-600'
                )}>{metrics.meta_pct != null ? `${metrics.meta_pct}%` : '—'}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
                <div className={cn('h-full rounded-full',
                  (metrics.meta_pct ?? 0) >= 100 ? 'bg-emerald-500' : (metrics.meta_pct ?? 0) >= 70 ? 'bg-amber-400' : 'bg-rose-400'
                )} style={{ width: `${Math.min(100, metrics.meta_pct ?? 0)}%` }} />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 px-4 py-3 flex items-start gap-3">
              <Target className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-800">Cliente sem meta configurada</p>
                <p className="text-[11px] text-amber-700/70 mt-0.5">Ação de CS: ajudar o cliente a definir a meta de faturamento no CRM — sem meta não há régua de sucesso.</p>
              </div>
              {orgId && (
                <Button onClick={() => { setMetaValor(null); setMetaOpen(true); }}
                  className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 flex-shrink-0">
                  Configurar meta
                </Button>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Dialog: configurar meta mensal do cliente */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Configurar meta de faturamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[12px] text-muted-foreground">
              Define a meta mensal de faturamento do cliente para o mês corrente. Ela passa a valer no CRM do cliente e alimenta o score de Resultado.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Meta de receita (mês)</Label>
              <CurrencyInput value={metaValor} onValueChange={v => setMetaValor(v ?? null)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={() => setMetaOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
                disabled={!metaValor || metaValor <= 0 || setMeta.isPending}
                onClick={() => {
                  if (!orgId || !metaValor) return;
                  setMeta.mutate({ orgId, metaReceita: metaValor }, {
                    onSuccess: () => { toast.success('Meta configurada'); setMetaOpen(false); },
                    onError: () => toast.error('Erro ao configurar meta'),
                  });
                }}
              >
                {setMeta.isPending ? 'Salvando...' : 'Salvar meta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Histórico Geral (fixo — faturamento total + série de 12 meses) ── */}
      <SectionCard id="resultado-historico" icon={History} title="Histórico Geral" desc="Faturamento total desde o início — independente do filtro de período">
        <div className="px-5 py-5 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Faturamento total</p>
            <p className="text-2xl font-bold tabular-nums font-display mt-1">{metrics ? formatBRLCompact(metrics.fat_total_lifetime) : '—'}</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">desde o início</p>
          </div>

          {monthly.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Faturamento — últimos 12 meses</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <XAxis
                      dataKey="mes"
                      tickFormatter={(m: string) => format(parseISO(m + '-01'), 'MMM', { locale: ptBR })}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                      formatter={(v: number) => [formatBRL(v), 'Faturamento']}
                      labelFormatter={(m: string) => format(parseISO(m + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="faturamento" radius={[4, 4, 0, 0]}>
                      {monthly.map((m, i) => {
                        const isSel = periodType === 'mes' && isSameMonth(parseISO(m.mes + '-01'), from);
                        return (
                          <Cell key={i}
                            fill={isSel ? '#E85D24' : m.faturamento >= maxFat * 0.66 ? '#059669' : m.faturamento > 0 ? '#f59e0b' : 'hsl(var(--muted))'} />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Adoção de funcionalidades (fixo) ── */}
      {ad && (
        <SectionCard icon={Zap} title="Adoção de funcionalidades" desc={`${featOn} de ${features.length} recursos do CRM em uso`}>
          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {features.map(f => (
              <div key={f.label} className={cn('flex items-start gap-2 px-3 py-2.5 rounded-xl border',
                f.on ? 'border-emerald-200/60 bg-emerald-50/40' : 'border-border/40 bg-muted/[0.02]')}>
                <div className={cn('h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  f.on ? 'text-emerald-600' : 'text-muted-foreground/30')}>
                  {f.on ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[11px] font-semibold leading-tight', f.on ? 'text-foreground' : 'text-muted-foreground/60')}>{f.label}</p>
                  <p className="text-[10px] text-muted-foreground/50">{f.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
