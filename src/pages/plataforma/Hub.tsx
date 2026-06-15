import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, BarChart, Layers,
  ArrowRight, ArrowUpRight, Swords, BookMarked, Route,
  Crosshair,
} from "lucide-react";
import { usePlataforma } from "@/contexts/PlataformaContext";

// ─── Cores por ferramenta ──────────────────────────────────────────────────────

const TOOL_ACCENTS: Record<string, string> = {
  trilha:   'bg-violet-500',
  arsenal:  'bg-amber-500',
  jornada:  'bg-cyan-500',
  materiais:'bg-emerald-500',
  sessoes:  'bg-rose-500',
  evolucao: 'bg-blue-500',
  crm:      'bg-orange-500',
  metricas: 'bg-indigo-500',
  os:       'bg-violet-500',
};

export default function Hub() {
  const {
    plataformaUser,
    isContextLoading, acesso,
  } = usePlataforma();
  const navigate = useNavigate();

  const temSessoes   = acesso.acesso_sessoes_taticas;
  const temCRM       = acesso.acesso_crm;
  const temMateriais = acesso.acesso_materiais;
  const temOS        = acesso.acesso_os;

  const tools = [
    {
      id: 'arsenal', icon: Swords,
      title: 'Arsenal Comercial',
      description: '43 ferramentas para construir processos reais',
      action: () => navigate('/plataforma/arsenal'),
      actionLabel: 'Explorar',
    },
    {
      id: 'jornada', icon: Route,
      title: 'Minha Jornada',
      description: 'Seu plano personalizado com a Descompliquei',
      action: () => navigate('/plataforma/jornada'),
      actionLabel: 'Ver jornada',
    },
    temMateriais && {
      id: 'materiais', icon: BookMarked,
      title: 'Meus Materiais',
      description: 'Seus processos e scripts prontos para usar',
      action: () => navigate('/plataforma/materiais'),
      actionLabel: 'Acessar',
    },
    temOS && {
      id: 'os', icon: Layers,
      title: 'Athos GS',
      description: 'Seu sistema operacional de gestão da clínica',
      action: () => navigate('/plataforma/os'),
      actionLabel: 'Acessar',
    },
    temSessoes && {
      id: 'sessoes', icon: Calendar,
      title: 'Sessões Táticas',
      description: 'Mentorias semanais ao vivo',
      action: () => navigate('/plataforma/sessoes-taticas'),
      actionLabel: 'Ver agenda',
    },
    temCRM && {
      id: 'crm', icon: BarChart,
      title: 'CRM e Pipeline',
      description: 'Gerencie leads e funil comercial',
      action: () => window.open('/crm/pipeline', '_blank', 'noopener,noreferrer'),
      actionLabel: 'Abrir CRM',
      external: true,
    },
  ].filter(Boolean) as any[];

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (!plataformaUser) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* ─── Hero ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] px-8 py-10 sm:px-12 sm:py-12">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full opacity-55 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #ea580c, transparent 65%)' }} />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-35 blur-[80px]"
          style={{ background: 'radial-gradient(circle, #d97706, transparent 65%)' }} />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08]">
              <Crosshair className="h-5 w-5 text-white/80" />
            </div>
            <div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-white/20 to-transparent" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display leading-[1.15]">
              Olá, {plataformaUser?.clinic_name || 'Clínica'}
            </h1>
            <p className="text-[13px] text-white/40 mt-2 max-w-sm leading-relaxed">
              Aqui estão todas as ferramentas da sua plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Grade de ferramentas ─── */}
      <div className="space-y-3" data-tutorial="hub-tools">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Ferramentas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(tool => {
            const accent = TOOL_ACCENTS[tool.id] ?? 'bg-foreground/80';
            return (
              <button
                key={tool.id}
                data-tutorial={`hub-tool-${tool.id}`}
                onClick={tool.action}
                className="group relative w-full text-left overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-border hover:shadow-md transition-all duration-200"
              >
                {/* Barra de acento no topo */}
                <div className={`h-[3px] w-full ${accent}`} />

                <div className="p-5 flex flex-col h-full min-h-[148px]">
                  {/* Ícone + progresso */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-muted group-hover:bg-muted/70 transition-colors">
                      <tool.icon className="h-[18px] w-[18px] text-muted-foreground" />
                    </div>
                    {tool.progress !== undefined && (
                      <span className={`text-[11px] font-bold tabular-nums ${tool.progress >= 100 ? 'text-emerald-500' : 'text-muted-foreground/50'}`}>
                        {tool.progress}%
                      </span>
                    )}
                  </div>

                  {/* Título + descrição */}
                  <h3 className="text-[14px] font-semibold text-foreground mb-1 font-display">{tool.title}</h3>
                  <p className="text-[12px] text-muted-foreground leading-relaxed flex-1">{tool.description}</p>

                  {/* Barra de progresso */}
                  {tool.progress !== undefined && (
                    <div className="mt-3 h-1 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${tool.progress >= 100 ? 'bg-emerald-500' : accent}`}
                        style={{ width: `${Math.max(tool.progress, tool.progress > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  )}

                  {/* CTA */}
                  <div className="flex items-center gap-1 mt-4 text-[12px] font-semibold text-foreground/60 group-hover:text-foreground transition-colors">
                    {tool.actionLabel}
                    {tool.external
                      ? <ArrowUpRight className="h-3.5 w-3.5" />
                      : <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    }
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Rodapé ─── */}
      <div className="flex items-center justify-center gap-3 pt-2 pb-4">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-border/40" />
        <Crosshair className="h-3.5 w-3.5 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/30 font-medium tracking-wider uppercase">
          Descompliquei · Plataforma
        </p>
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-border/40" />
      </div>
    </div>
  );
}
