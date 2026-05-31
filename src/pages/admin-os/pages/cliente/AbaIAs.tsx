import { Bot, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const IA_LABEL: Record<string, string> = {
  preattendance: 'Pré-Atendimento', objections: 'Objeções',
  remarketing: 'Remarketing', analysis: 'Análise',
  copywriter: 'Copywriter', scripts: 'Scripts',
  strategy: 'Estratégia', reporting: 'Relatórios',
};
const IA_COLOR: Record<string, string> = {
  preattendance: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  objections: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  remarketing: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  analysis: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  copywriter: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  scripts: 'bg-muted text-muted-foreground border-border/40',
};

interface Props { iaHistory: Array<{ id: string; ia_type: string; input_text: string | null; created_at: string }> }

export default function AbaIAs({ iaHistory }: Props) {
  const counts: Record<string, number> = {};
  iaHistory.forEach(h => { counts[h.ia_type] = (counts[h.ia_type] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] || 1;

  return (
    <div className="space-y-4">
      {/* Uso por IA */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><Bot className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Uso por IA</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma consulta realizada.</p>
            </div>
          ) : sorted.map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border w-36 text-center shrink-0', IA_COLOR[type] || 'bg-muted text-muted-foreground border-border/40')}>
                {IA_LABEL[type] || type}
              </span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-foreground/40 rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="text-sm font-bold tabular-nums text-foreground font-mono w-8 text-right shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Últimas consultas */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Últimas 10 Consultas</p>
        </div>
        <div className="divide-y divide-border/40">
          {iaHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma consulta registrada.</p>
            </div>
          ) : iaHistory.slice(0, 10).map(h => (
            <div key={h.id} className="px-5 py-3 flex gap-3 items-start hover:bg-muted/20 transition-colors">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5', IA_COLOR[h.ia_type] || 'bg-muted text-muted-foreground border-border/40')}>
                {IA_LABEL[h.ia_type] || h.ia_type}
              </span>
              <p className="text-sm text-foreground flex-1 line-clamp-2">{h.input_text || '—'}</p>
              <span className="text-[11px] text-muted-foreground/60 shrink-0 flex items-center gap-1 mt-0.5 tabular-nums">
                <Clock className="h-3 w-3" />
                {new Date(h.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
