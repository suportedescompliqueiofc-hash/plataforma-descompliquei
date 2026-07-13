import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, AlertTriangle, CheckCircle2, MessageCircle, Star,
  Activity, Calendar, ChevronDown, Clock, DollarSign, TrendingUp, TrendingDown,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  type CSClient, type CSTouchpoint, type CSNPSResponse,
  FASE_LABELS, clientName, effectiveHealthV2, formatBRLCompact,
} from '../types/cs';
import { ClienteRotinaCard, computeRotinaQueue } from './RotinaTab';
import {
  useRenovacoes, EditRenovacaoModal, RenovacoesTab,
  type RenovacaoRow, getUrgency, URGENCY_BADGE,
} from './RenovacoesTab';

// ── Widget de Renovações (compacto, com atalho para a lista completa) ──────

function RenovacoesWidget({ clients, onOpenDrawer }: { clients: CSClient[]; onOpenDrawer: (c: CSClient) => void }) {
  const { data: rows = [], isLoading } = useRenovacoes(clients);
  const [editRow, setEditRow] = useState<RenovacaoRow | null>(null);
  const [showAll, setShowAll] = useState(false);

  const withDate = rows.filter(r => r.trialEndsAt !== null);
  const prioritarias = withDate
    .filter(r => r.renovacao?.status !== 'confirmado')
    .filter(r => r.daysUntil !== null && r.daysUntil <= 45)
    .slice(0, 5);

  if (isLoading || withDate.length === 0) return null;

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><Clock className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Renovações</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{withDate.length} no pipeline</p>
            </div>
          </div>
          <button
            onClick={() => setShowAll(true)}
            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-muted px-2 py-1 rounded-lg border border-border/60 transition-colors"
          >
            Ver todas
          </button>
        </div>
        {prioritarias.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-[11px] text-muted-foreground/50">Nenhuma renovação urgente no momento</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {prioritarias.map(row => {
              const urgency = getUrgency(row.daysUntil);
              const daysLabel = row.daysUntil === null ? '—' : row.daysUntil < 0 ? `${Math.abs(row.daysUntil)}d atraso` : `${row.daysUntil}d`;
              return (
                <button
                  key={row.client.id}
                  onClick={() => setEditRow(row)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/[0.03] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{clientName(row.client)}</p>
                    {row.trialEndsAt && (
                      <p className="text-[10px] text-muted-foreground/50">
                        Vence {format(parseISO(row.trialEndsAt), "d 'de' MMM", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-lg border flex-shrink-0', URGENCY_BADGE[urgency])}>
                    {daysLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {editRow && <EditRenovacaoModal row={editRow} onClose={() => setEditRow(null)} />}

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Renovações</DialogTitle>
          </DialogHeader>
          <RenovacoesTab clients={clients} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── PainelTab ────────────────────────────────────────────────────────────────

export function PainelTab({ clients, touchpoints, nps, onRegistrarTouchpoint, onOpenDrawer }: {
  clients: CSClient[];
  touchpoints: CSTouchpoint[];
  nps: CSNPSResponse[];
  onRegistrarTouchpoint: (clientId: string) => void;
  onOpenDrawer: (c: CSClient) => void;
}) {
  const [emDiaOpen, setEmDiaOpen] = useState(false);

  const active = clients.filter(c => c.onboarding_complete || c.onboarding_concluido);
  const verde = active.filter(c => effectiveHealthV2(c) === 'verde').length;
  const amarelo = active.filter(c => effectiveHealthV2(c) === 'amarelo').length;
  const vermelho = active.filter(c => effectiveHealthV2(c) === 'vermelho').length;
  const semScore = active.length - verde - amarelo - vermelho;

  // ── Resultado da base (Resultado no CRM) ──
  const withCrm = clients.filter(c => c.crm);
  const fatBase30d = withCrm.reduce((s, c) => s + c.crm!.fat_30d, 0);
  const growths = withCrm.map(c => c.crm!.fat_growth_pct).filter((g): g is number => g != null);
  const growthMed = growths.length > 0 ? Math.round(growths.reduce((s, g) => s + g, 0) / growths.length) : null;
  const emQueda = withCrm.filter(c => (c.crm!.fat_growth_pct ?? 0) < -3);

  // ── Fila proativa: clientes em risco de RESULTADO (não só de contato) ──
  const resultadoRisco = withCrm
    .map(c => {
      const m = c.crm!;
      const inativoDias = m.ultima_atividade ? differenceInDays(new Date(), new Date(m.ultima_atividade)) : null;
      const motivos: string[] = [];
      if ((m.fat_growth_pct ?? 0) < -3) motivos.push(`faturamento ${m.fat_growth_pct}%`);
      if (inativoDias != null && inativoDias >= 14) motivos.push(`CRM parado há ${inativoDias}d`);
      if (m.fech_30d === 0 && m.leads_30d > 0) motivos.push('0 fechamentos em 30d');
      if (effectiveHealthV2(c) === 'vermelho' && motivos.length === 0) motivos.push('health em risco');
      return { client: c, motivos };
    })
    .filter(r => r.motivos.length > 0)
    .sort((a, b) => (a.client.crm!.fat_growth_pct ?? 0) - (b.client.crm!.fat_growth_pct ?? 0));

  const weekAgo = subDays(new Date(), 7);
  const tpThisWeek = touchpoints.filter(t => new Date(t.data_contato) >= weekAgo).length;
  const promoters = nps.filter(n => n.score >= 9).length;
  const detractors = nps.filter(n => n.score <= 6).length;
  const npsValue = nps.length > 0 ? Math.round((promoters - detractors) / nps.length * 100) : null;

  const today = new Date().toISOString().slice(0, 10);

  // Agenda da semana (próximos 7 dias)
  const nextWeek = addDays(new Date(), 7).toISOString().slice(0, 10);
  const agenda = clients
    .filter(c => c.cs_proximo_touchpoint && c.cs_proximo_touchpoint > today && c.cs_proximo_touchpoint <= nextWeek)
    .sort((a, b) => (a.cs_proximo_touchpoint!).localeCompare(b.cs_proximo_touchpoint!));

  // NPS map para candidatos advocacy
  const npsMap: Record<string, number> = {};
  nps.forEach(n => { npsMap[n.client_id] = Math.max(npsMap[n.client_id] ?? 0, n.score); });
  const advocacy = clients.filter(c => effectiveHealthV2(c) === 'verde' && (npsMap[c.id] ?? 0) >= 8);

  // Fila de ação da rotina (substitui os "Alertas urgentes" / "Sem contato 14+" do Central)
  const { urgentes, atencao, emDia } = computeRotinaQueue(clients);

  return (
    <div className="space-y-6">
      {/* Resultado da base — faturamento e crescimento (o que o cliente percebe) */}
      {withCrm.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-muted"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /></span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Faturamento da base</p>
            </div>
            <p className="text-2xl font-bold tabular-nums font-display">{formatBRLCompact(fatBase30d)}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">últimos 30 dias · {withCrm.length} clientes</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-muted">
                {growthMed != null && growthMed < 0
                  ? <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                  : <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Crescimento médio</p>
            </div>
            <p className={cn('text-2xl font-bold tabular-nums font-display',
              growthMed == null ? 'text-muted-foreground' : growthMed > 0 ? 'text-emerald-600' : growthMed < 0 ? 'text-rose-600' : ''
            )}>{growthMed != null ? `${growthMed > 0 ? '+' : ''}${growthMed}%` : '—'}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">faturamento mês a mês (móvel)</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <TrendingDown className={cn('h-3.5 w-3.5', emQueda.length > 0 ? 'text-rose-500' : 'text-muted-foreground')} />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Em queda de faturamento</p>
            </div>
            <p className={cn('text-2xl font-bold tabular-nums font-display', emQueda.length > 0 ? 'text-rose-600' : 'text-foreground')}>{emQueda.length}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5 truncate">
              {emQueda.length > 0 ? emQueda.map(c => clientName(c)).slice(0, 2).join(', ') + (emQueda.length > 2 ? '…' : '') : 'nenhum cliente caindo'}
            </p>
          </div>
        </div>
      )}

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><Users className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Ativos</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums font-display">{active.length}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">{clients.length} total na base</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Saudáveis</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums font-display text-emerald-600">{verde}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">{active.length > 0 ? Math.round(verde / active.length * 100) : 0}% dos ativos</p>
          </div>
        </div>

        {(() => {
          const emAtencao = amarelo + vermelho;
          const hasRisk = emAtencao > 0;
          const isCritical = vermelho > 0;
          return (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <AlertTriangle className={cn('h-3.5 w-3.5', hasRisk ? isCritical ? 'text-rose-500' : 'text-amber-500' : 'text-muted-foreground')} />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Em Atenção</p>
              </div>
              <div>
                <p className={cn('text-2xl font-bold tabular-nums font-display', hasRisk ? isCritical ? 'text-rose-600' : 'text-amber-600' : 'text-foreground')}>{emAtencao}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                  {vermelho} crítico · {amarelo} atenção
                </p>
              </div>
            </div>
          );
        })()}

        {(() => {
          const hasNps = npsValue !== null;
          const isGood = hasNps && npsValue! >= 50;
          const isBad = hasNps && npsValue! < 0;
          return (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted"><Star className="h-3.5 w-3.5 text-muted-foreground" /></span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">NPS</p>
              </div>
              <div>
                <p className={cn('text-2xl font-bold tabular-nums font-display',
                  hasNps ? isGood ? 'text-emerald-600' : isBad ? 'text-rose-600' : 'text-amber-600' : ''
                )}>{npsValue !== null ? npsValue : '—'}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{nps.length} respostas coletadas</p>
              </div>
            </div>
          );
        })()}

        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Touchpoints</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums font-display">{tpThisWeek}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">últimos 7 dias</p>
          </div>
        </div>
      </div>

      {/* Main content: 2 colunas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">

        {/* ── Coluna esquerda: fila de ação do CSM (Rotina) ── */}
        <div className="space-y-5">
          {resultadoRisco.length > 0 && (
            <div className="rounded-2xl border border-rose-200/60 bg-rose-50/30 overflow-hidden">
              <div className="px-5 py-3 border-b border-rose-200/50 flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Resultado em risco</p>
                <span className="text-[10px] text-rose-500/60 tabular-nums">{resultadoRisco.length}</span>
              </div>
              <div className="divide-y divide-rose-200/40">
                {resultadoRisco.map(({ client, motivos }) => (
                  <button key={client.id} onClick={() => onOpenDrawer(client)}
                    className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-rose-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{clientName(client)}</p>
                      <p className="text-[11px] text-rose-600/80 truncate">{motivos.join(' · ')}</p>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-rose-600 flex-shrink-0">{formatBRLCompact(client.crm!.fat_30d)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {urgentes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Ação Imediata</p>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">{urgentes.length}</span>
              </div>
              {urgentes.map(({ client }) => (
                <ClienteRotinaCard key={client.id} client={client} onRegistrar={onRegistrarTouchpoint} />
              ))}
            </div>
          )}

          {atencao.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Atenção — Ação Pendente</p>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">{atencao.length}</span>
              </div>
              {atencao.map(({ client }) => (
                <ClienteRotinaCard key={client.id} client={client} onRegistrar={onRegistrarTouchpoint} />
              ))}
            </div>
          )}

          {emDia.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setEmDiaOpen(o => !o)}
                className="flex items-center gap-2 w-full"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Em Dia</p>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">{emDia.length}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/40 transition-transform ml-auto', emDiaOpen && 'rotate-180')} />
              </button>
              {emDiaOpen && emDia.map(({ client }) => (
                <ClienteRotinaCard key={client.id} client={client} onRegistrar={onRegistrarTouchpoint} />
              ))}
            </div>
          )}

          {clients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-border/60 bg-card">
              <div className="p-4 rounded-2xl bg-muted/40 mb-4">
                <CheckCircle2 className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Nenhum cliente ativo</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1">Quando houver clientes na plataforma, a fila de ação aparece aqui.</p>
            </div>
          )}

          {urgentes.length === 0 && atencao.length === 0 && emDia.length === 0 && clients.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-8 flex flex-col items-center justify-center text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Tudo sob controle</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Nenhuma ação pendente no momento</p>
            </div>
          )}
        </div>

        {/* ── Coluna direita: agenda + renovações + advocacy + saúde ── */}
        <div className="space-y-4">

          {/* Agenda da semana */}
          {agenda.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /></span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Agenda da Semana</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{agenda.length} touchpoint{agenda.length > 1 ? 's' : ''} planejado{agenda.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {agenda.map(c => {
                  const hs = effectiveHealthV2(c);
                  const daysUntil = differenceInDays(new Date(c.cs_proximo_touchpoint!), new Date());
                  const initials = clientName(c).split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
                  return (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/[0.03] transition-colors cursor-pointer" onClick={() => onOpenDrawer(c)}>
                      <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[11px] font-bold bg-muted text-muted-foreground',
                        hs === 'verde' ? 'border-emerald-400' : hs === 'amarelo' ? 'border-amber-400' : hs === 'vermelho' ? 'border-red-400' : 'border-border/40'
                      )}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{clientName(c)}</p>
                        {c.cs_fase && <p className="text-[10px] text-muted-foreground/50">{FASE_LABELS[c.cs_fase]}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold tabular-nums">
                          {format(parseISO(c.cs_proximo_touchpoint!), "d 'de' MMM", { locale: ptBR })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40">em {daysUntil}d</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Renovações */}
          <RenovacoesWidget clients={clients} onOpenDrawer={onOpenDrawer} />

          {/* Candidatos a advocacy */}
          {advocacy.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted"><Star className="h-3.5 w-3.5 text-emerald-500" /></span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Candidatos a Advocacy</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Health verde + NPS ≥ 8 — prontos para indicar</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {advocacy.map(c => (
                  <div key={c.id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-muted/[0.03] transition-colors cursor-pointer" onClick={() => onOpenDrawer(c)}>
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-muted flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-emerald-700">
                      {clientName(c).split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{clientName(c)}</p>
                      {c.cs_fase && <p className="text-[10px] text-muted-foreground/50">{FASE_LABELS[c.cs_fase]}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.latest_health && (
                        <span className="text-[11px] font-bold tabular-nums text-emerald-700 bg-muted px-2 py-0.5 rounded-lg">{c.latest_health.score_total}</span>
                      )}
                      {npsMap[c.id] && (
                        <span className="text-[11px] font-bold tabular-nums text-emerald-700 bg-muted px-2 py-0.5 rounded-lg">NPS {npsMap[c.id]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distribuição de saúde */}
          {active.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted"><Activity className="h-3.5 w-3.5 text-muted-foreground" /></span>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Distribuição de Saúde</p>
                </div>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {verde > 0 && <div className="bg-emerald-500" style={{ flex: verde }} />}
                  {amarelo > 0 && <div className="bg-amber-400" style={{ flex: amarelo }} />}
                  {vermelho > 0 && <div className="bg-red-500" style={{ flex: vermelho }} />}
                  {semScore > 0 && <div className="bg-muted-foreground/20" style={{ flex: semScore }} />}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Saudáveis',     count: verde,    dot: 'bg-emerald-500', text: 'text-emerald-600' },
                    { label: 'Em atenção',    count: amarelo,  dot: 'bg-amber-400',   text: 'text-amber-600'   },
                    { label: 'Em risco',      count: vermelho, dot: 'bg-red-500',     text: 'text-rose-600'    },
                    { label: 'Sem avaliação', count: semScore, dot: 'bg-muted-foreground/20', text: 'text-muted-foreground' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/40">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', item.dot)} />
                      <div>
                        <p className={cn('text-lg font-bold tabular-nums font-display leading-none', item.text)}>{item.count}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{item.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
