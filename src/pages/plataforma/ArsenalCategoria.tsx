import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Search, Tag, MessageSquare, Filter, Trophy, Radio, UserPlus, Settings2,
  ChevronRight, Swords, Loader2, CheckCircle2, Clock, Circle, ArrowRight,
  Crosshair, ArrowLeft,
} from 'lucide-react';
import { useArsenalCategoria, ArsenalStatus } from '@/hooks/useArsenal';

const ICON_MAP: Record<string, React.ElementType> = {
  Search, Tag, MessageSquare, Filter, Trophy, Radio, UserPlus, Settings2,
};

const STATUS_CONFIG: Record<ArsenalStatus, { label: string; icon: React.ElementType; bg: string; text: string; border: string }> = {
  nao_iniciado: { label: 'Não iniciado', icon: Circle,       bg: 'bg-muted',            text: 'text-muted-foreground', border: 'border-border/60' },
  em_andamento: { label: 'Em andamento', icon: Clock,        bg: 'bg-amber-500/10',     text: 'text-amber-600',        border: 'border-amber-500/20' },
  concluido:    { label: 'Concluído',    icon: CheckCircle2, bg: 'bg-emerald-500/10',   text: 'text-emerald-600',      border: 'border-emerald-500/20' },
};

const SLUG_THEMES: Record<string, { gradient: string; accent: string; glow: string }> = {
  'diagnostico-clareza':                { gradient: 'from-violet-600/80 via-violet-900/60 to-slate-900', accent: '#8b5cf6', glow: 'rgba(139,92,246,0.12)' },
  'oferta-precificacao-valor':          { gradient: 'from-amber-600/80 via-amber-900/60 to-slate-900',  accent: '#f59e0b', glow: 'rgba(245,158,11,0.12)' },
  'atendimento-conversao':              { gradient: 'from-cyan-600/80 via-cyan-900/60 to-slate-900',    accent: '#06b6d4', glow: 'rgba(6,182,212,0.12)' },
  'funil-followup-reativacao':          { gradient: 'from-emerald-600/80 via-emerald-900/60 to-slate-900', accent: '#10b981', glow: 'rgba(16,185,129,0.12)' },
  'alto-ticket-protocolos-recorrencia': { gradient: 'from-rose-600/80 via-rose-900/60 to-slate-900',    accent: '#f43f5e', glow: 'rgba(244,63,94,0.12)' },
  'canais-aquisicao':                   { gradient: 'from-blue-600/80 via-blue-900/60 to-slate-900',    accent: '#3b82f6', glow: 'rgba(59,130,246,0.12)' },
  'montando-equipe-comercial':          { gradient: 'from-orange-600/80 via-orange-900/60 to-slate-900', accent: '#f97316', glow: 'rgba(249,115,22,0.12)' },
  'gestao-time-comercial':              { gradient: 'from-indigo-600/80 via-indigo-900/60 to-slate-900', accent: '#6366f1', glow: 'rgba(99,102,241,0.12)' },
};

export default function ArsenalCategoria() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { categoria, ferramentas, concluidas, isLoading } = useArsenalCategoria(slug);

  const Icon = ICON_MAP[categoria?.icone ?? ''] ?? Swords;
  const theme = SLUG_THEMES[slug] ?? SLUG_THEMES['diagnostico-clareza'];
  const pct = ferramentas.length > 0 ? Math.round((concluidas / ferramentas.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ─── Breadcrumb ─── */}
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/plataforma/arsenal" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          Arsenal
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate">
          {categoria?.nome ?? '…'}
        </span>
      </nav>

      {/* ─── Hero da Categoria ─── */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient}`}
        style={{ boxShadow: `0 8px 40px ${theme.glow}` }}
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 blur-[80px]" style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)` }} />

        <div className="relative z-10 px-8 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08]">
                  <Icon className="h-5 w-5 text-white/80" />
                </div>
                <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-white/20 to-transparent" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display leading-[1.15]">
                {isLoading ? '…' : categoria?.nome}
              </h1>
              {categoria && (
                <p className="text-[13px] text-white/35 italic max-w-lg">
                  "{categoria.frase_ancora}"
                </p>
              )}
            </div>

            {/* Stats pill */}
            {!isLoading && (
              <div className="flex items-center gap-4 bg-white/[0.04] backdrop-blur-sm rounded-xl px-5 py-3 border border-white/[0.06] self-start sm:self-auto">
                <div className="relative w-12 h-12">
                  <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    <circle
                      cx="24" cy="24" r="20" fill="none"
                      stroke={theme.accent} strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * 125.7} 125.7`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white font-mono tabular-nums">{pct}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-lg font-bold text-white font-mono tabular-nums leading-none">
                    {concluidas}<span className="text-white/30 text-sm font-normal">/{ferramentas.length}</span>
                  </p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">concluídas</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Lista de Ferramentas ─── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : ferramentas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Swords className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma ferramenta disponível</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Conteúdo em breve.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ferramentas.map((ferr, idx) => {
            const cfg = STATUS_CONFIG[ferr.status];
            const StatusIcon = cfg.icon;

            return (
              <button
                key={ferr.id}
                onClick={() => navigate(`/plataforma/arsenal/${slug}/${ferr.slug}`)}
                className="group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card text-left hover:border-border hover:shadow-md transition-all duration-200"
              >
                {/* Accent line left */}
                <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: theme.accent }} />

                <div className="flex items-center gap-5 px-6 py-5">
                  {/* Número */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground leading-snug truncate font-display">
                      {ferr.nome}
                    </p>
                    {ferr.descricao && (
                      <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                        {ferr.descricao}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <span className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    <StatusIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </span>

                  {/* Arrow */}
                  <ChevronRight className="flex-shrink-0 h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
