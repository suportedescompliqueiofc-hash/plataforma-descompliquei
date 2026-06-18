import { Bot, BookOpen, Layers, CalendarDays, Clock, Infinity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformData {
  onboardingConcluido: boolean;
  onboardingComplete: boolean;
  jornada: { id: string; titulo: string; status: string } | null;
  passosTotal: number;
  passosConcluidos: number;
  aulasArsenalConcluidas: number;
  osConversas: number;
}

interface Props {
  client: any;
  platformData: PlatformData | null;
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SubscriptionCard({ client }: { client: any }) {
  const now = new Date();
  const start = client.tenant_created_at ? new Date(client.tenant_created_at) : null;
  const end = client.trial_ends_at ? new Date(client.trial_ends_at) : null;
  const isVitalicio = !end;

  const diasDecorridos = start ? Math.max(0, diffDays(start, now)) : null;
  const diasRestantes = end ? diffDays(now, end) : null;
  const totalDias = start && end ? diffDays(start, end) : null;
  const pct = totalDias && diasDecorridos !== null
    ? Math.min(100, Math.max(0, Math.round((diasDecorridos / totalDias) * 100)))
    : null;

  const expired = diasRestantes !== null && diasRestantes < 0;
  const urgent = !expired && diasRestantes !== null && diasRestantes <= 7;
  const warning = !expired && !urgent && diasRestantes !== null && diasRestantes <= 30;

  const barColor = expired ? 'bg-red-500' : urgent ? 'bg-red-400' : warning ? 'bg-amber-400' : 'bg-emerald-500';
  const remainingColor = expired ? 'text-red-600' : urgent ? 'text-red-500' : warning ? 'text-amber-600' : 'text-emerald-600';
  const remainingBg = expired ? 'bg-red-50 border-red-200/60' : urgent ? 'bg-red-50 border-red-200/60' : warning ? 'bg-amber-50 border-amber-200/60' : 'bg-emerald-50 border-emerald-200/60';

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Assinatura</p>
        </div>
        {isVitalicio ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200/60">
            <Infinity className="h-3 w-3" /> Vitalício
          </span>
        ) : expired ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200/60">
            <AlertTriangle className="h-3 w-3" /> Expirado
          </span>
        ) : urgent ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200/60">
            <Clock className="h-3 w-3" /> Vence em breve
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200/60">
            Ativo
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Datas + destaque de dias restantes */}
        <div className="flex items-start gap-4 flex-wrap">
          {/* Início */}
          {start && (
            <div className="flex-1 min-w-[120px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Início</p>
              <p className="text-sm font-semibold text-foreground">{fmtDate(client.tenant_created_at)}</p>
              {diasDecorridos !== null && (
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">{diasDecorridos} dias atrás</p>
              )}
            </div>
          )}

          {/* Encerramento */}
          {end ? (
            <div className="flex-1 min-w-[120px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Encerramento</p>
              <p className={cn('text-sm font-semibold', expired ? 'text-red-600' : 'text-foreground')}>{fmtDate(client.trial_ends_at)}</p>
              {totalDias !== null && (
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">{totalDias} dias no total</p>
              )}
            </div>
          ) : (
            <div className="flex-1 min-w-[120px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Encerramento</p>
              <p className="text-sm font-semibold text-muted-foreground">Sem prazo</p>
            </div>
          )}

          {/* Dias restantes — destaque */}
          {!isVitalicio && diasRestantes !== null && (
            <div className={cn('shrink-0 rounded-xl border px-4 py-2.5 text-center', remainingBg)}>
              <p className={cn('text-3xl font-black tabular-nums font-display leading-none', remainingColor)}>
                {expired ? Math.abs(diasRestantes) : diasRestantes}
              </p>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest mt-1', remainingColor)}>
                {expired ? 'dias expirado' : 'dias restantes'}
              </p>
            </div>
          )}
        </div>

        {/* Barra de progresso temporal */}
        {pct !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground/50">
              <span>Início</span>
              <span className={cn('font-bold', expired ? 'text-red-500' : 'text-muted-foreground/70')}>{pct}% do período decorrido</span>
              <span>Fim</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor)}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AbaVisaoGeral({ client, platformData }: Props) {
  const infoFields = [
    { label: 'Clínica', value: client.clinic_name || client.org_name },
    { label: 'Especialidade', value: client.specialty },
    { label: 'Cidade / UF', value: client.city_state },
    { label: 'E-mail', value: client.email },
    { label: 'Produto', value: client.product_name },
  ].filter(f => f.value);

  const jornadaPct = platformData?.passosTotal
    ? Math.round((platformData.passosConcluidos / platformData.passosTotal) * 100)
    : 0;

  const onboardingStatus = platformData
    ? platformData.onboardingComplete
      ? { label: 'Plataforma configurada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' }
      : platformData.onboardingConcluido
        ? { label: 'Jornada criada', cls: 'bg-blue-50 text-blue-700 border-blue-200/60' }
        : { label: 'Onboarding pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200/60' }
    : null;

  return (
    <div className="space-y-4">
      {/* Informações do cliente */}
      {infoFields.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Informações do Cliente</p>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            {infoFields.map(f => (
              <div key={f.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">{f.label}</p>
                <p className="text-[13px] text-foreground">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assinatura */}
      {(client.tenant_created_at || client.trial_ends_at || client.product_name) && (
        <SubscriptionCard client={client} />
      )}

      {/* Plataforma */}
      {platformData && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Plataforma</p>
            {onboardingStatus && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', onboardingStatus.cls)}>
                {onboardingStatus.label}
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {/* Jornada */}
            {platformData.jornada ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">{platformData.jornada.titulo}</p>
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                      platformData.jornada.status === 'ativa' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
                      platformData.jornada.status === 'concluida' ? 'bg-blue-50 text-blue-700 border-blue-200/60' :
                      'bg-muted text-muted-foreground border-border/60'
                    )}>
                      {platformData.jornada.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold tabular-nums text-muted-foreground">
                    {platformData.passosConcluidos}/{platformData.passosTotal} passos
                  </p>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', jornadaPct === 100 ? 'bg-emerald-500' : 'bg-foreground/50')}
                    style={{ width: `${jornadaPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground/50">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <p className="text-xs">Jornada ainda não criada pelo Athos</p>
              </div>
            )}

            {/* Arsenal + Athos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/[0.03] p-3">
                <div className="p-1.5 rounded-lg bg-muted shrink-0">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-black tabular-nums font-display leading-none">{platformData.aulasArsenalConcluidas}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-0.5">Aulas do Arsenal</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/[0.03] p-3">
                <div className="p-1.5 rounded-lg bg-muted shrink-0">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-black tabular-nums font-display leading-none">{platformData.osConversas}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-0.5">Conversas Athos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
