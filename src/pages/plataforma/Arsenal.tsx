import { useNavigate } from 'react-router-dom';
import {
  Search, Tag, MessageSquare, Filter, Trophy, Radio, UserPlus, Settings2,
  ChevronRight, Swords, Loader2, ArrowRight, Crosshair,
} from 'lucide-react';
import { useArsenalHub } from '@/hooks/useArsenal';

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

export default function Arsenal() {
  const navigate = useNavigate();
  const { categorias, totalConcluidas, isLoading } = useArsenalHub();
  const pctGlobal = Math.round((totalConcluidas / 43) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* ─── Hero Header ─── */}
      <div data-tutorial="arsenal-header" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] px-8 py-10 sm:px-12 sm:py-14">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        {/* Accent glow */}
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full opacity-55 blur-[100px]" style={{ background: 'radial-gradient(circle, #ea580c, transparent 65%)' }} />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-35 blur-[80px]" style={{ background: 'radial-gradient(circle, #d97706, transparent 65%)' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08]">
                <Crosshair className="h-5 w-5 text-white/80" />
              </div>
              <div className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-white/20 to-transparent" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display leading-[1.1]">
              Arsenal<br />
              <span className="text-white/50">Comercial</span>
            </h1>
            <p className="text-[14px] text-white/40 max-w-md leading-relaxed">
              43 ferramentas que constroem processos reais na sua clínica.
              Sem sequência. Sem bloqueio. Acesse o que precisa, quando precisa.
            </p>
          </div>

          {/* Progress ring */}
          {!isLoading && (
            <div className="flex items-center gap-5 bg-white/[0.04] backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/[0.06] self-start sm:self-auto">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke="url(#arsenalGrad)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${(pctGlobal / 100) * 175.9} 175.9`}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="arsenalGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white font-mono tabular-nums">{pctGlobal}%</span>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-white font-mono tabular-nums leading-none">
                  {totalConcluidas}<span className="text-white/30 text-base font-normal">/43</span>
                </p>
                <p className="text-[11px] text-white/30 uppercase tracking-wider mt-1">utilizadas</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Grid de Categorias ─── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {categorias.map((cat, idx) => {
            const Icon = ICON_MAP[cat.icone] ?? Swords;
            const theme = CATEGORY_THEMES[idx % CATEGORY_THEMES.length];
            const pct = cat.total > 0 ? Math.round((cat.concluidas / cat.total) * 100) : 0;
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/plataforma/arsenal/${cat.slug}`)}
                className={`group relative overflow-hidden rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ring-1 ${theme.ring} hover:ring-2`}
                style={{ boxShadow: `0 4px 30px ${theme.glow}` }}
              >
                {/* Card background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />

                {/* Subtle texture */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 40%)`,
                }} />

                {/* Content */}
                <div className="relative z-10 p-6 flex flex-col h-full min-h-[200px]">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-auto">
                    <div className={`p-2.5 rounded-xl ${theme.iconBg} backdrop-blur-sm border border-white/[0.06]`}>
                      <Icon className={`h-5 w-5 ${theme.iconText}`} />
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                      <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Explorar</span>
                      <ArrowRight className="h-4 w-4 text-white/50" />
                    </div>
                  </div>

                  {/* Category info */}
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-px flex-1 bg-white/[0.06]" />
                      <span className="text-[11px] text-white/25 font-mono tabular-nums">{cat.total} ferramentas</span>
                    </div>

                    <h3 className="text-[17px] font-bold text-white leading-snug font-display pr-8">
                      {cat.nome}
                    </h3>

                    <p className="text-[12px] text-white/35 leading-relaxed italic">
                      {cat.frase_ancora}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/30 font-medium">
                        {cat.concluidas}/{cat.total} utilizadas
                      </span>
                      <span className="text-[11px] font-bold text-white/50 font-mono tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${theme.bar} transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Bottom accent ─── */}
      <div className="flex items-center justify-center gap-3 pt-4 pb-2">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-border/40" />
        <Swords className="h-3.5 w-3.5 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/30 font-medium tracking-wider uppercase">
          8 categorias · 43 ferramentas
        </p>
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-border/40" />
      </div>
    </div>
  );
}
