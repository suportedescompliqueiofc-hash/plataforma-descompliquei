import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCSNpsResponseDetail } from '@/hooks/useCSNps';
import { clientName, npsCategory, NPS_DIMENSAO_LABELS, NPS_DIMENSAO_COLORS, type CSNPSResponse } from '../types/cs';

export function NpsResponseRow({ response: n, showClientName = true }: { response: CSNPSResponse; showClientName?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cat = npsCategory(n.score);
  const { data: detalhe = [], isLoading } = useCSNpsResponseDetail(expanded ? n.campanha_id : null);
  const outrasDimensoes = detalhe.filter(d => d.dimensao !== 'recomendacao');

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-4">
        <div className={cn('text-lg font-bold tabular-nums w-7 text-center flex-shrink-0', cat.color.split(' ')[0])}>{n.score}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showClientName && <p className="text-sm font-semibold">{clientName(n.platform_users || {})}</p>}
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', cat.color)}>{cat.label}</span>
            {n.cs_nps_campanhas?.cs_nps_templates?.nome ? (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                via pesquisa: {n.cs_nps_campanhas.cs_nps_templates.nome}
              </span>
            ) : (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                registro manual
              </span>
            )}
          </div>
          {n.comentario && <p className="text-xs text-muted-foreground mt-1">{n.comentario}</p>}
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[10px] text-muted-foreground/50">
              {format(parseISO(n.respondido_em), "d 'de' MMM yyyy", { locale: ptBR })}
            </p>
            {n.campanha_id && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                {expanded ? 'Ocultar respostas completas' : 'Ver respostas completas'}
              </button>
            )}
          </div>
          {expanded && (
            <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
              {isLoading && <p className="text-[11px] text-muted-foreground/50">Carregando...</p>}
              {!isLoading && outrasDimensoes.length === 0 && (
                <p className="text-[11px] text-muted-foreground/50">Sem outras dimensões nesta pesquisa.</p>
              )}
              {outrasDimensoes.map(d => (
                <div key={d.id} className="flex items-start gap-2">
                  <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 mt-0.5', NPS_DIMENSAO_COLORS[d.dimensao])}>
                    {NPS_DIMENSAO_LABELS[d.dimensao]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground/70">{d.texto_pergunta}</p>
                    <p className="text-xs font-semibold mt-0.5">
                      {d.valor_numero !== null ? d.valor_numero : d.valor_texto || '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
