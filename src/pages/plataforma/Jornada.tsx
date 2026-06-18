import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Route, CheckCircle2, Circle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Zap, Calendar, Crosshair, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useJornada, useMarcarPassoConcluido,
  getEstagioStatus, getJornadaProgress,
  type JornadaEstagio, type JornadaPasso, type Jornada,
} from '@/hooks/useJornada';

// ─── Acentos por índice (apenas cor da barra lateral) ────────────────────────

const STAGE_ACCENTS = [
  'bg-violet-500', 'bg-amber-500', 'bg-cyan-500', 'bg-emerald-500',
  'bg-rose-500',   'bg-blue-500',  'bg-orange-500','bg-indigo-500',
];

// ─── Helpers de data ──────────────────────────────────────────────────────────

function calcDeadline(index: number, all: JornadaEstagio[], createdAt: string): Date {
  let cursor = parseISO(createdAt);
  for (let i = 0; i <= index; i++) {
    const e = all[i];
    if (e.data_inicio) cursor = parseISO(e.data_inicio);
    cursor = addDays(cursor, e.prazo_dias);
  }
  return cursor;
}

function fmtDate(d: Date) {
  return format(d, "d 'de' MMM", { locale: ptBR });
}

// ─── Passo row (dentro do card expandido) ─────────────────────────────────────

function PassoRow({ passo, onToggle, estagioDeadline }: {
  passo: JornadaPasso;
  onToggle: (id: string, v: boolean) => void;
  estagioDeadline: Date;
}) {
  const navigate = useNavigate();

  const passoDeadline = passo.prazo_dias
    ? addDays(estagioDeadline, -passo.prazo_dias)
    : null;

  function handleOpen() {
    if (passo.tipo === 'ferramenta_arsenal' && passo.arsenal_ferramentas) {
      const f = passo.arsenal_ferramentas;
      navigate(`/plataforma/arsenal/${f.arsenal_categorias?.slug}/${f.slug}`);
    } else if (passo.aula_id && passo.arsenal_aulas) {
      navigate(`/plataforma/arsenal/aulas/${passo.arsenal_aulas.slug}`);
    } else if (passo.tipo === 'categoria_arsenal' && passo.arsenal_categorias) {
      navigate(`/plataforma/arsenal/${passo.arsenal_categorias.slug}`);
    }
  }

  const hasLink =
    (passo.tipo === 'ferramenta_arsenal' && (!!passo.arsenal_ferramentas || !!passo.aula_id)) ||
    (passo.tipo === 'categoria_arsenal' && !!passo.arsenal_categorias);

  return (
    <div className={cn(
      'group flex items-start gap-3 px-4 py-3 rounded-xl border transition-all',
      passo.concluido
        ? 'bg-emerald-500/[0.04] border-emerald-500/15'
        : 'bg-card border-border/50 hover:border-border/80'
    )}>
      <button
        onClick={() => onToggle(passo.id, !passo.concluido)}
        className="mt-0.5 shrink-0 focus:outline-none"
      >
        {passo.concluido
          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          : <Circle className="h-5 w-5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            'text-[13px] font-medium leading-snug',
            passo.concluido ? 'text-muted-foreground line-through' : 'text-foreground'
          )}>
            {passo.titulo}
          </p>
          {passo.obrigatorio && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
              Obrigatório
            </span>
          )}
        </div>
        {passo.descricao && (
          <p className="text-[12px] text-muted-foreground/60 mt-0.5 leading-relaxed">{passo.descricao}</p>
        )}
        {passoDeadline && !passo.concluido && (
          <p className="text-[11px] text-muted-foreground/40 mt-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Até {fmtDate(passoDeadline)}
          </p>
        )}
      </div>

      {hasLink && !passo.concluido && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpen}
          className="shrink-0 h-7 px-2.5 text-[11px] font-medium gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          {passo.tipo === 'categoria_arsenal' ? 'Ver categoria' : 'Abrir'}
        </Button>
      )}
    </div>
  );
}

// ─── Card de etapa (themed + expandível) ─────────────────────────────────────

function EstagioCard({ estagio, index, defaultOpen, onTogglePasso, jornada, isLocked }: {
  estagio: JornadaEstagio;
  index: number;
  defaultOpen: boolean;
  onTogglePasso: (id: string, v: boolean) => void;
  jornada: Jornada;
  isLocked: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen && !isLocked);
  const status = getEstagioStatus(estagio);
  const passos = estagio.jornada_passos ?? [];
  const done = passos.filter(p => p.concluido).length;
  const total = passos.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const deadline = calcDeadline(index, jornada.jornada_estagios, jornada.created_at);
  const isConcluido = status === 'concluido';

  return (
    <div className={cn(
      'overflow-hidden rounded-2xl border transition-shadow',
      isLocked
        ? 'border-border/30 bg-muted/20 opacity-60'
        : 'border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md'
    )}>
      {/* Barra de acento no topo */}
      <div className={cn(
        'h-[3px] w-full',
        isLocked ? 'bg-border/40' : isConcluido ? 'bg-emerald-500' : 'bg-foreground/80'
      )} />

      {/* ── Cabeçalho ── */}
      <button
        onClick={() => !isLocked && setOpen(v => !v)}
        className={cn('w-full text-left px-5 py-4 flex items-center gap-4', isLocked && 'cursor-not-allowed')}
      >
        {/* Número / ícone */}
        <div className={cn(
          'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold',
          isLocked
            ? 'bg-muted/60 text-muted-foreground/40'
            : isConcluido
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-muted text-muted-foreground'
        )}>
          {isLocked
            ? <Lock className="h-3.5 w-3.5" />
            : isConcluido
              ? <CheckCircle2 className="h-4 w-4" />
              : index + 1
          }
        </div>

        <div className="flex-1 min-w-0">
          {/* Título + status */}
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className={cn(
              'text-[14px] font-semibold leading-snug font-display',
              isLocked ? 'text-muted-foreground/50' : 'text-foreground'
            )}>{estagio.titulo}</h3>
            {isLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground/50 text-[10px] font-semibold">
                <Lock className="h-2.5 w-2.5" /> Bloqueada
              </span>
            )}
            {!isLocked && isConcluido && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold">
                <CheckCircle2 className="h-2.5 w-2.5" /> Concluída
              </span>
            )}
            {!isLocked && status === 'em_andamento' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-semibold">
                <Zap className="h-2.5 w-2.5" /> Em andamento
              </span>
            )}
          </div>

          {isLocked ? (
            <p className="text-[11px] text-muted-foreground/40">Conclua a etapa anterior para desbloquear</p>
          ) : (
            <>
              <div className="flex items-center gap-3 text-[12px] text-muted-foreground/60">
                {!isConcluido && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Até {fmtDate(deadline)}
                  </span>
                )}
                <span className="font-mono tabular-nums">{done}/{total} passos</span>
              </div>
              <div className="mt-2.5 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', isConcluido ? 'bg-emerald-500' : 'bg-foreground/70')}
                  style={{ width: `${Math.max(pct, total > 0 ? 2 : 0)}%` }}
                />
              </div>
            </>
          )}
        </div>

        {!isLocked && (
          <div className="shrink-0 ml-1">
            {open
              ? <ChevronUp className="h-4 w-4 text-muted-foreground/30" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground/30" />
            }
          </div>
        )}
      </button>

      {/* ── Passos ── */}
      {!isLocked && open && (
        <div className="border-t border-border/40 bg-muted/[0.02]">
          {passos.length > 0 ? (
            <div className="p-4 space-y-2">
              {passos.map(p => (
                <PassoRow
                  key={p.id}
                  passo={p}
                  onToggle={onTogglePasso}
                  estagioDeadline={deadline}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-[12px] text-muted-foreground/40">Nenhum passo nesta etapa.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="mb-6 p-4 rounded-2xl bg-muted/40">
        <Route className="h-8 w-8 text-muted-foreground/30" />
      </div>
      <h2 className="text-xl font-bold text-foreground font-display mb-2">Sua jornada está sendo preparada</h2>
      <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed">
        Nossa equipe está estruturando um plano personalizado com base no seu diagnóstico.
        Em breve você terá acesso completo.
      </p>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Jornada() {
  const { data: jornada, isLoading } = useJornada();
  const marcar = useMarcarPassoConcluido();

  function handleToggle(passoId: string, concluido: boolean) {
    marcar.mutate({ passoId, concluido });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!jornada) return <EmptyState />;

  const { total, done, pct } = getJornadaProgress(jornada);
  const estagios = jornada.jornada_estagios ?? [];
  const currentEstagioIdx = estagios.findIndex(e => getEstagioStatus(e) !== 'concluido');

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ─── Hero (mesmo padrão do Arsenal) ─── */}
      <div data-tutorial="jornada-header" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] px-8 py-10 sm:px-12 sm:py-12">
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        {/* Glow blobs */}
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full opacity-55 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #ea580c, transparent 65%)' }} />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-35 blur-[80px]"
          style={{ background: 'radial-gradient(circle, #d97706, transparent 65%)' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08]">
                <Crosshair className="h-5 w-5 text-white/80" />
              </div>
              <div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-white/20 to-transparent" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display leading-[1.15]">
              {jornada.titulo}
            </h1>
            <p className="text-[13px] text-white/40 max-w-sm leading-relaxed">
              Sua jornada personalizada · {estagios.length} {estagios.length === 1 ? 'etapa' : 'etapas'} · {total} {total === 1 ? 'passo' : 'passos'}
            </p>
          </div>

          {/* Progress ring */}
          <div className="flex items-center gap-5 bg-white/[0.04] backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/[0.06] self-start sm:self-auto shrink-0">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none"
                  stroke="url(#jornadaGrad)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 175.9} 175.9`}
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="jornadaGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-white font-mono tabular-nums">{pct}%</span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono tabular-nums leading-none">
                {done}<span className="text-white/30 text-base font-normal">/{total}</span>
              </p>
              <p className="text-[11px] text-white/30 uppercase tracking-wider mt-1">concluídos</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Etapas ─── */}
      {estagios.length > 0 ? (
        <div className="space-y-3">
          {estagios.map((estagio, i) => (
            <EstagioCard
              key={estagio.id}
              estagio={estagio}
              index={i}
              defaultOpen={i === currentEstagioIdx || (currentEstagioIdx === -1 && i === 0)}
              onTogglePasso={handleToggle}
              jornada={jornada}
              isLocked={i > 0 && getEstagioStatus(estagios[i - 1]) !== 'concluido'}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-border/60">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Route className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma etapa cadastrada</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Sua jornada ainda está sendo estruturada.</p>
        </div>
      )}

      {/* ─── Rodapé ─── */}
      <div className="flex items-center justify-center gap-3 pt-2 pb-4">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-border/40" />
        <Route className="h-3.5 w-3.5 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/30 font-medium tracking-wider uppercase">
          {estagios.length} etapas · {total} passos
        </p>
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-border/40" />
      </div>
    </div>
  );
}
