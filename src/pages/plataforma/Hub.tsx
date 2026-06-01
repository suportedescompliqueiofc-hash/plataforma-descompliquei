import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayCircle, Brain, Zap, Calendar, BarChart, TrendingUp, ArrowRight, ArrowUpRight, X } from "lucide-react";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { supabase } from "@/integrations/supabase/client";

export default function Hub() {
  const { plataformaUser, plan, isCerebroComplete, cerebroPercent, totalModules, completedModules, progressPercent, progress, isContextLoading, acesso, isMember, showOnboarding } = usePlataforma();
  const navigate = useNavigate();
  const [nextModule, setNextModule] = useState<any>(null);
  const [isLoadingModule, setIsLoadingModule] = useState(true);
  const [hideCerebroBanner, setHideCerebroBanner] = useState(() => sessionStorage.getItem('hideCerebroBanner') === 'true');

  useEffect(() => {
    if (isContextLoading) return;

    async function fetchNextModule() {
      const completedIds = progress.filter(p => p.completed).map(p => p.module_id);

      let query = supabase.from('platform_modules')
        .select('*')
        .order('order_index', { ascending: true })
        .limit(1);

      if (completedIds.length > 0) {
        query = query.not('id', 'in', `(${completedIds.join(',')})`);
      }

      if (plan === 'pca') {
        query = query.eq('min_plan', 'pca');
      }

      const { data } = await query.maybeSingle();
      if (data) setNextModule(data);
      setIsLoadingModule(false);
    }
    fetchNextModule();
  }, [progress, plan, isContextLoading]);

  const temTrilha = (acesso.pilares_liberados?.length ?? 0) > 0;
  const temIAs = acesso.acesso_ia_comercial || (acesso.ias_liberadas?.length ?? 0) > 0;
  const temCerebro = acesso.acesso_cerebro;
  const temSessoes = acesso.acesso_sessoes_taticas;
  const temCRM = acesso.acesso_crm;

  const handleDismissBanner = () => {
    sessionStorage.setItem('hideCerebroBanner', 'true');
    setHideCerebroBanner(true);
  };

  if (isContextLoading || !plataformaUser) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-[140px] w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-[160px] rounded-xl" />)}
        </div>
      </div>
    );
  }

  const tools = [
    temTrilha && {
      id: 'trilha',
      icon: PlayCircle,
      title: 'Trilha de Aprendizado',
      description: `${completedModules} de ${totalModules} módulos concluídos`,
      progress: progressPercent,
      action: () => navigate('/plataforma/trilha'),
      actionLabel: 'Continuar',
    },
    temCerebro && {
      id: 'cerebro',
      icon: Brain,
      title: 'Cérebro Central',
      description: 'Memória estratégica da sua clínica',
      progress: cerebroPercent,
      action: () => navigate('/plataforma/cerebro'),
      actionLabel: cerebroPercent >= 100 ? 'Ver' : 'Configurar',
    },
    temIAs && {
      id: 'ias',
      icon: Zap,
      title: 'IAs Comerciais',
      description: `${acesso.ias_liberadas?.length || 0} IAs especialistas disponíveis`,
      action: () => navigate('/plataforma/ia-comercial'),
      actionLabel: 'Acessar',
    },
    temSessoes && {
      id: 'sessoes',
      icon: Calendar,
      title: 'Sessões Táticas',
      description: 'Mentorias semanais ao vivo',
      action: () => navigate('/plataforma/sessoes-taticas'),
      actionLabel: 'Ver agenda',
    },
    (temCRM && !isMember) && {
      id: 'evolucao',
      icon: TrendingUp,
      title: 'Evolução',
      description: 'Sua evolução completa desde o início',
      action: () => navigate('/plataforma/evolucao'),
      actionLabel: 'Ver evolução',
    },
    temCRM && {
      id: 'crm',
      icon: BarChart,
      title: 'CRM e Pipeline',
      description: 'Gerencie leads e funil comercial',
      action: () => window.open('/crm/pipeline', '_blank', 'noopener,noreferrer'),
      actionLabel: 'Abrir CRM',
      external: true,
    },
    temCRM && {
      id: 'metricas',
      icon: TrendingUp,
      title: 'Painel de Métricas',
      description: 'Desempenho da sua clínica',
      action: () => window.open('/crm', '_blank', 'noopener,noreferrer'),
      actionLabel: 'Ver painel',
      external: true,
    },
  ].filter(Boolean) as any[];

  return (
    <>
    <div className="max-w-5xl mx-auto space-y-8 pb-12">

      {/* BANNER CÉREBRO */}
      {temCerebro && !isCerebroComplete && !hideCerebroBanner && (
        <div className="flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 relative dark:border-amber-500/20 dark:bg-amber-500/[0.08]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
            <Brain className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Configure o Cérebro Central para personalizar as IAs.</p>
            <p className="text-xs text-amber-700/70 dark:text-amber-300/50 mt-0.5">Quanto mais completo, mais inteligentes ficam suas ferramentas.</p>
          </div>
          <Button onClick={() => navigate('/plataforma/cerebro')} size="sm" className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-4 dark:bg-amber-500 dark:hover:bg-amber-400">
            Configurar
          </Button>
          <button onClick={handleDismissBanner} className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 transition-colors dark:text-amber-500/50 dark:hover:text-amber-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="space-y-1" data-tutorial="hub-header">
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
          Olá, {plataformaUser?.clinic_name || "Clínica"}
        </h1>
        <p className="text-muted-foreground text-[15px]">
          {progressPercent >= 100
            ? 'Sua trilha está completa. Foque agora em constância no tráfego e no CRM.'
            : progressPercent > 40
            ? 'Sua estrutura comercial está tomando forma. Continue avançando.'
            : 'Vamos construir sua máquina de atração de pacientes.'}
        </p>
      </div>

      {/* PROGRESSO GERAL */}
      {temTrilha && (
        <div className="rounded-xl border border-border bg-card p-6" data-tutorial="hub-progress">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-medium text-foreground">Progresso geral</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{completedModules} de {totalModules} módulos concluídos</p>
            </div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-muted" />
        </div>
      )}

      {/* PRÓXIMO PASSO */}
      {temTrilha && nextModule && progressPercent < 100 && (
        <div
          data-tutorial="hub-nextmodulo"
          onClick={() => navigate(`/plataforma/trilha/${nextModule.id}`)}
          className="group rounded-xl border border-border bg-card p-6 cursor-pointer transition-all hover:border-[#E85D24]/40 hover:shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E85D24]/10 text-[#E85D24] group-hover:bg-[#E85D24]/15 transition-colors">
                <PlayCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#E85D24] uppercase tracking-wider mb-0.5">
                  {progressPercent === 0 ? 'Comece aqui' : 'Próximo módulo'}
                </p>
                <h3 className="text-[15px] font-medium text-foreground truncate">{nextModule.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{nextModule.description}</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-[#E85D24] transition-colors" />
          </div>
        </div>
      )}

      {/* TRILHA COMPLETA */}
      {temTrilha && progressPercent >= 100 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
              <PlayCircle className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Trilha concluída</p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-300/50 mt-0.5">Você absorveu todo o conteúdo base. Foque em constância no Tráfego e no CRM.</p>
            </div>
          </div>
        </div>
      )}

      {/* FERRAMENTAS */}
      <div className="space-y-4" data-tutorial="hub-tools">
        <h2 className="text-[15px] font-medium text-foreground">Ferramentas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((tool) => (
            <Card
              key={tool.id}
              data-tutorial={`hub-tool-${tool.id}`}
              onClick={tool.action}
              className="border-border bg-card cursor-pointer transition-all hover:shadow-md shadow-card group"
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-[#E85D24]/10 group-hover:text-[#E85D24] transition-colors">
                    <tool.icon className="h-[18px] w-[18px]" />
                  </div>
                  {tool.progress !== undefined && (
                    <span className={`text-xs font-medium tabular-nums ${tool.progress >= 100 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {tool.progress}%
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">{tool.title}</h3>
                <p className="text-xs text-muted-foreground mb-4 flex-1">{tool.description}</p>
                {tool.progress !== undefined && (
                  <Progress value={tool.progress} className="h-1 mb-4 bg-muted" />
                )}
                <div className="flex items-center text-xs font-medium text-[#E85D24] group-hover:translate-x-0.5 transition-transform">
                  {tool.actionLabel}
                  {tool.external
                    ? <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    : <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  }
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
