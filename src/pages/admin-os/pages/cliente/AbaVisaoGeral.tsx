import { Bot, BookOpen, BrainCircuit, Activity, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductAccess {
  acesso_crm: boolean; acesso_cerebro: boolean; acesso_sessoes_taticas: boolean;
  acesso_materiais: boolean; acesso_ia_comercial: boolean;
  pilares_liberados: string[]; ias_liberadas: string[];
}

interface Props {
  client: any;
  progress: number;
  modulosConcluidos: number;
  iaTotal: number;
  materiaisTotal: number;
  recentActivity: any[];
  productAccess?: ProductAccess | null;
}

function timeAgo(d: string): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

export default function AbaVisaoGeral({ client, progress, modulosConcluidos, iaTotal, materiaisTotal, recentActivity, productAccess }: Props) {
  const hasTrilha = (productAccess?.pilares_liberados?.length ?? 0) > 0;
  const hasIA = productAccess?.acesso_ia_comercial ?? false;
  const hasMateriais = productAccess?.acesso_materiais ?? false;
  const hasPlatformMetrics = hasTrilha || hasIA || hasMateriais;

  return (
    <div className="space-y-4">
      {/* Informações básicas */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Informações do Cliente</p>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Clínica', value: client.clinic_name },
            { label: 'Especialidade', value: client.specialty },
            { label: 'Cidade / UF', value: client.city_state },
            { label: 'WhatsApp', value: client.whatsapp },
            { label: 'Produto', value: client.product_name || '—' },
            { label: 'Expiração', value: client.trial_ends_at ? new Date(client.trial_ends_at).toLocaleDateString('pt-BR') : client.product_name ? 'Vitalício' : '—' },
          ].map(f => (
            <div key={f.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">{f.label}</p>
              <p className="text-sm text-foreground">{f.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Métricas de plataforma */}
      {hasPlatformMetrics && (
        <div className={cn('grid gap-3', [hasTrilha, hasTrilha, hasIA, hasMateriais].filter(Boolean).length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4')}>
          {hasTrilha && [
            { icon: BookOpen, value: `${progress}%`, label: 'Progresso' },
            { icon: BookOpen, value: modulosConcluidos, label: 'Módulos Concluídos' },
          ].map(m => (
            <div key={m.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col items-center text-center gap-1">
              <div className="p-2 rounded-xl bg-muted">
                <m.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-black tabular-nums font-display text-foreground">{m.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{m.label}</p>
            </div>
          ))}
          {hasIA && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col items-center text-center gap-1">
              <div className="p-2 rounded-xl bg-muted"><Bot className="h-4 w-4 text-muted-foreground" /></div>
              <p className="text-2xl font-black tabular-nums font-display text-foreground">{iaTotal}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">IAs Usadas</p>
            </div>
          )}
          {hasMateriais && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex flex-col items-center text-center gap-1">
              <div className="p-2 rounded-xl bg-muted"><BrainCircuit className="h-4 w-4 text-muted-foreground" /></div>
              <p className="text-2xl font-black tabular-nums font-display text-foreground">{materiaisTotal}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Materiais Gerados</p>
            </div>
          )}
        </div>
      )}

      {/* Atividade recente */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Últimas Atividades</p>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
            </div>
          ) : recentActivity.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
              <div className={cn('h-2 w-2 rounded-full shrink-0', item.tipo === 'ia' ? 'bg-purple-500' : 'bg-blue-500')} />
              <p className="text-sm text-foreground flex-1">{item.descricao}</p>
              <span className="text-[11px] text-muted-foreground/60 shrink-0 flex items-center gap-1">
                <Clock className="h-3 w-3" />{timeAgo(item.date)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
