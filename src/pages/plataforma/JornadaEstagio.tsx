import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Route, ClipboardList } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormattedText } from '@/components/FormattedText';
import { TarefaCard } from '@/components/plataforma/JornadaTarefaCard';
import {
  useJornadas, useMarcarPassoConcluido, useMarcarSubtarefa,
  getEstagioProgress,
  type Jornada, type JornadaEstagio as TEstagio,
} from '@/hooks/useJornada';

function jornadaLabel(j: Jornada): string {
  if (j.tipo === 'onboarding') return 'Onboarding';
  if (j.tipo === 'mensal' && j.periodo_ref) return format(parseISO(j.periodo_ref), "MMMM 'de' yyyy", { locale: ptBR });
  return j.titulo;
}

export default function JornadaEstagioPage() {
  const { estagioId } = useParams<{ estagioId: string }>();
  const navigate = useNavigate();
  const { data: jornadas, isLoading } = useJornadas();
  const marcar = useMarcarPassoConcluido();
  const marcarSub = useMarcarSubtarefa();

  const found = useMemo(() => {
    if (!jornadas) return null;
    for (const j of jornadas) {
      const estagios = j.jornada_estagios ?? [];
      const idx = estagios.findIndex(e => e.id === estagioId);
      if (idx !== -1) return { jornada: j, estagio: estagios[idx] as TEstagio, index: idx, total: estagios.length };
    }
    return null;
  }, [jornadas, estagioId]);

  if (isLoading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!found) {
    return (
      <div className="max-w-3xl mx-auto py-24 flex flex-col items-center text-center px-6">
        <div className="mb-6 p-4 rounded-2xl bg-muted/40"><Route className="h-8 w-8 text-muted-foreground/30" /></div>
        <h2 className="text-xl font-bold text-foreground font-display mb-2">Etapa não encontrada</h2>
        <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed mb-6">Essa etapa pode ter sido removida ou faz parte de outra jornada.</p>
        <Button onClick={() => navigate('/plataforma/jornada')} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a jornada
        </Button>
      </div>
    );
  }

  const { jornada, estagio, index, total: totalEtapas } = found;
  const { total, done, pct } = getEstagioProgress(estagio);
  const isDone = total > 0 && done === total;
  const passos = estagio.jornada_passos ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Voltar */}
      <button onClick={() => navigate('/plataforma/jornada')}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> {jornada.titulo}
      </button>

      {/* Header da etapa */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className={cn('h-1 w-full', isDone ? 'bg-emerald-500' : 'bg-foreground/80')} />
        <div className="px-7 py-6 sm:px-8 sm:py-7">
          <div className="flex items-start gap-4">
            <div className={cn('shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold font-display',
              isDone ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
              {isDone ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1 capitalize">
                {jornadaLabel(jornada)} · Etapa {index + 1} de {totalEtapas}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display leading-[1.2]">{estagio.titulo}</h1>
              {estagio.descricao && <div className="mt-2.5"><FormattedText content={estagio.descricao} /></div>}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden max-w-[280px]">
                  <div className={cn('h-full rounded-full transition-all duration-500', isDone ? 'bg-emerald-500' : 'bg-foreground/70')} style={{ width: `${Math.max(pct, total > 0 ? 3 : 0)}%` }} />
                </div>
                <span className="text-[12px] font-mono tabular-nums text-muted-foreground">{done}/{total} tarefas · {pct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tarefas */}
      <div className="flex items-center gap-2 px-1">
        <ClipboardList className="h-3.5 w-3.5 text-muted-foreground/50" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Tarefas desta etapa</p>
      </div>

      {passos.length > 0 ? (
        <div className="space-y-2.5">
          {passos.map(p => (
            <TarefaCard key={p.id} passo={p} defaultOpen
              onToggle={(id, v) => marcar.mutate({ passoId: id, concluido: v })}
              onToggleSub={(id, v) => marcarSub.mutate({ subtarefaId: id, concluido: v })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-border/60">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><ClipboardList className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma tarefa nesta etapa</p>
        </div>
      )}
    </div>
  );
}
