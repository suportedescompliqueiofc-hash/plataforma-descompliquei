import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  type CSClient,
  FASE_LABELS, FASE_COLORS,
  clientName, effectiveHealth,
  getDiasNaPlataforma, getFaseEsperada, getSemana, getMes,
  getDiasRestantesNaFase, getDiasSemContato, getAcaoPrescrita,
  type AcaoPrescrita,
} from '../types/cs';

// ── Card de cliente na rotina ─────────────────────────────────────────────────

export function ClienteRotinaCard({
  client,
  onRegistrar,
}: {
  client: CSClient;
  onRegistrar: (id: string) => void;
}) {
  const navigate = useNavigate();
  const dias = getDiasNaPlataforma(client.joined_at);
  const faseEfetiva = client.cs_fase || getFaseEsperada(dias);
  const semana = getSemana(dias);
  const mes = getMes(dias);
  const diasRestantes = getDiasRestantesNaFase(faseEfetiva, dias);
  const dsc = getDiasSemContato(client.cs_ultimo_touchpoint);
  const acao = getAcaoPrescrita(faseEfetiva, dias, dsc);

  const urgenciaBg: Record<AcaoPrescrita['urgencia'], string> = {
    verde:    'bg-card border-border/60',
    amarelo:  'bg-card border-border/60 border-l-2 border-l-amber-400',
    vermelho: 'bg-card border-border/60 border-l-2 border-l-rose-400',
  };
  const urgenciaLabel: Record<AcaoPrescrita['urgencia'], string> = {
    verde:   'text-emerald-600',
    amarelo: 'text-amber-600',
    vermelho:'text-rose-600',
  };
  const urgenciaDesc: Record<AcaoPrescrita['urgencia'], string> = {
    verde:   'text-muted-foreground',
    amarelo: 'text-muted-foreground',
    vermelho:'text-muted-foreground',
  };
  const urgenciaDot: Record<AcaoPrescrita['urgencia'], string> = {
    verde:   'bg-emerald-400',
    amarelo: 'bg-amber-400',
    vermelho:'bg-rose-400',
  };

  const name = clientName(client);
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const hs = effectiveHealth(client) ?? 'sem-dado';

  const borderColor = hs === 'verde' ? 'border-emerald-400' : hs === 'vermelho' ? 'border-red-400' : hs === 'amarelo' ? 'border-amber-400' : 'border-border/40';

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Faixa de urgência no topo */}
      <div className={cn('h-0.5', urgenciaDot[acao.urgencia])} />

      <div className="p-4">
        {/* Header do cliente */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className={cn('w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[11px] font-bold bg-muted text-muted-foreground', borderColor)}>
              {initials}
            </div>
            <div className="min-w-0">
              <button
                onClick={() => navigate(`/admin/cs/cliente/${client.id}`)}
                className="text-sm font-semibold truncate hover:text-foreground/80 transition-colors text-left flex items-center gap-1"
              >
                {name}
                <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </button>
              {/* Fase + timing */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', FASE_COLORS[faseEfetiva] ?? 'bg-muted text-muted-foreground')}>
                  {FASE_LABELS[faseEfetiva] ?? faseEfetiva}
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-display tabular-nums">
                  D{dias} · S{semana} · M{mes}
                </span>
                {diasRestantes !== null && diasRestantes <= 10 && (
                  <span className="text-[10px] text-amber-600 font-semibold">
                    {diasRestantes === 0 ? 'Fim da fase hoje' : `${diasRestantes}d na fase`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dias sem contato */}
          <div className="flex-shrink-0 text-right">
            <p className={cn('text-[11px] font-bold tabular-nums',
              dsc === null ? 'text-rose-500' :
              dsc > 10 ? 'text-rose-500' :
              dsc > 5 ? 'text-amber-600' : 'text-muted-foreground'
            )}>
              {dsc === null ? 'Nunca' : dsc === 0 ? 'Hoje' : `${dsc}d`}
            </p>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">sem contato</p>
          </div>
        </div>

        {/* Caixa de ação */}
        <div className={cn('rounded-xl border px-3.5 py-3 mb-3', urgenciaBg[acao.urgencia])}>
          <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', urgenciaLabel[acao.urgencia])}>
            {acao.titulo}
          </p>
          <p className={cn('text-[11px] leading-relaxed', urgenciaDesc[acao.urgencia])}>
            {acao.descricao}
          </p>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between">
          {client.cs_ultimo_touchpoint ? (
            <p className="text-[10px] text-muted-foreground/50">
              Último contato: {format(new Date(client.cs_ultimo_touchpoint), "d 'de' MMM", { locale: ptBR })}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground/50 italic">Nenhum touchpoint registrado ainda</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] rounded-lg border-border/60 gap-1 px-2.5"
            onClick={() => onRegistrar(client.id)}
          >
            <Plus className="h-3 w-3" />
            Registrar touchpoint
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de ação da rotina (compartilhada com o Painel) ────────────────────────

export interface ClienteComAcao {
  client: CSClient;
  acao: AcaoPrescrita;
  dias: number;
}

export function computeRotinaQueue(clients: CSClient[]) {
  const clientesComAcao: ClienteComAcao[] = clients
    .map(c => {
      const dias = getDiasNaPlataforma(c.joined_at);
      const fase = c.cs_fase || getFaseEsperada(dias);
      const dsc = getDiasSemContato(c.cs_ultimo_touchpoint);
      const acao = getAcaoPrescrita(fase, dias, dsc);
      return { client: c, acao, dias };
    })
    .sort((a, b) => {
      const order = { vermelho: 0, amarelo: 1, verde: 2 };
      return order[a.acao.urgencia] - order[b.acao.urgencia];
    });

  return {
    urgentes: clientesComAcao.filter(c => c.acao.urgencia === 'vermelho'),
    atencao: clientesComAcao.filter(c => c.acao.urgencia === 'amarelo'),
    emDia: clientesComAcao.filter(c => c.acao.urgencia === 'verde'),
  };
}
