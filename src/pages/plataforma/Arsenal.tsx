import { useNavigate } from 'react-router-dom';
import {
  Search, Tag, MessageSquare, Filter, Trophy, Radio, UserPlus, Settings2,
  ChevronRight, Swords, Loader2, ArrowRight, Crosshair, GraduationCap,
  PlayCircle, CheckCircle2, Clock, Circle,
} from 'lucide-react';
import { useArsenalAulasHub, AulaStatus } from '@/hooks/useArsenalAulas';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/PageHero';

const ICON_MAP: Record<string, React.ElementType> = {
  Search, Tag, MessageSquare, Filter, Trophy, Radio, UserPlus, Settings2,
};

const CATEGORY_THEMES = [
  { gradient: 'from-violet-600/90 via-violet-800/80 to-slate-900', accent: '#8b5cf6', glow: 'rgba(139,92,246,0.15)', ring: 'ring-violet-500/20', bar: 'bg-violet-400', iconBg: 'bg-violet-500/20', iconText: 'text-violet-300' },
  { gradient: 'from-amber-600/90 via-amber-800/80 to-slate-900', accent: '#f59e0b', glow: 'rgba(245,158,11,0.15)', ring: 'ring-amber-500/20', bar: 'bg-amber-400', iconBg: 'bg-amber-500/20', iconText: 'text-amber-300' },
  { gradient: 'from-cyan-600/90 via-cyan-800/80 to-slate-900', accent: '#06b6d4', glow: 'rgba(6,182,212,0.15)', ring: 'ring-cyan-500/20', bar: 'bg-cyan-400', iconBg: 'bg-cyan-500/20', iconText: 'text-cyan-300' },
  { gradient: 'from-emerald-600/90 via-emerald-800/80 to-slate-900', accent: '#10b981', glow: 'rgba(16,185,129,0.15)', ring: 'ring-emerald-500/20', bar: 'bg-emerald-400', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-300' },
  { gradient: 'from-rose-600/90 via-rose-800/80 to-slate-900', accent: '#f43f5e', glow: 'rgba(244,63,94,0.15)', ring: 'ring-rose-500/20', bar: 'bg-rose-400', iconBg: 'bg-rose-500/20', iconText: 'text-rose-300' },
  { gradient: 'from-blue-600/90 via-blue-800/80 to-slate-900', accent: '#3b82f6', glow: 'rgba(59,130,246,0.15)', ring: 'ring-blue-500/20', bar: 'bg-blue-400', iconBg: 'bg-blue-500/20', iconText: 'text-blue-300' },
  { gradient: 'from-orange-600/90 via-orange-800/80 to-slate-900', accent: '#f97316', glow: 'rgba(249,115,22,0.15)', ring: 'ring-orange-500/20', bar: 'bg-orange-400', iconBg: 'bg-orange-500/20', iconText: 'text-orange-300' },
  { gradient: 'from-indigo-600/90 via-indigo-800/80 to-slate-900', accent: '#6366f1', glow: 'rgba(99,102,241,0.15)', ring: 'ring-indigo-500/20', bar: 'bg-indigo-400', iconBg: 'bg-indigo-500/20', iconText: 'text-indigo-300' },
];

const AULA_STATUS_CFG: Record<AulaStatus, { label: string; Icon: React.ElementType; text: string; bg: string; border: string }> = {
  nao_iniciado: { label: 'Não iniciada', Icon: Circle, text: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border/60' },
  em_andamento: { label: 'Em andamento', Icon: Clock, text: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  concluido:    { label: 'Concluída',    Icon: CheckCircle2, text: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

export default function Arsenal() {
  const navigate = useNavigate();
  const activeTab = 'aulas';
  const { blocosComAulas, totalConcluidas: aulasConcluidas, totalAulas, isLoading: aulasLoading } = useArsenalAulasHub();

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* ─── Hero Header ─── */}
      <PageHero
        dataTutorial="arsenal-header"
        icon={Crosshair}
        title="Arsenal"
        titleAccent="Comercial"
        subtitle="Sem sequência. Sem bloqueio. Acesse o que precisa, quando precisa."
      />

      {/* ─── Aulas ─── */}
      {activeTab === 'aulas' && (
        aulasLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-10">
            {blocosComAulas.map(bloco => (
              <div key={bloco.id}>
                {/* Bloco header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {bloco.nome}
                      </p>
                      {bloco.descricao && (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{bloco.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-[11px] text-muted-foreground/50 font-mono tabular-nums flex-shrink-0">
                    {bloco.concluidas}/{bloco.aulas.length} concluídas
                  </span>
                </div>

                {/* Aula cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bloco.aulas.map((aula, idx) => {
                    const cfg = AULA_STATUS_CFG[aula.status];
                    const Icon = cfg.Icon;
                    return (
                      <button
                        key={aula.id}
                        onClick={() => navigate(`/plataforma/arsenal/aulas/${aula.slug}`)}
                        className="group rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden text-left transition-all duration-200 hover:shadow-md hover:border-border/80 hover:scale-[1.01]"
                      >
                        {/* Card top */}
                        <div className="px-5 pt-5 pb-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[12px] font-bold text-muted-foreground font-mono">
                              {idx + 1}
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border font-medium px-1.5 py-0.5 text-[10px]',
                              cfg.bg, cfg.text, cfg.border,
                            )}>
                              <Icon className="h-2.5 w-2.5" />
                              {cfg.label}
                            </span>
                          </div>
                          <h3 className="text-[14px] font-semibold text-foreground leading-snug font-display">
                            {aula.nome}
                          </h3>
                          {aula.descricao && (
                            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                              {aula.descricao}
                            </p>
                          )}
                        </div>
                        {/* Card footer */}
                        <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/20">
                          <span className="text-[11px] text-muted-foreground/60">
                            {aula.video_url ? 'Vídeo disponível' : 'Em breve'}
                          </span>
                          <div className="flex items-center gap-1.5 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors">
                            <PlayCircle className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium">Acessar</span>
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bottom accent — aulas */}
            <div className="flex items-center justify-center gap-3 pt-4 pb-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-border/40" />
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/20" />
              <p className="text-[11px] text-muted-foreground/30 font-medium tracking-wider uppercase">
                {blocosComAulas.length} blocos · {totalAulas} aulas · {aulasConcluidas} concluídas
              </p>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-border/40" />
            </div>
          </div>
        )
      )}
    </div>
  );
}
