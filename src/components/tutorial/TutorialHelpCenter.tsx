import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Users, UsersRound, GitBranch, CalendarDays,
  ShoppingCart, Target, Bot, Zap, GitMerge, Settings, Sparkles,
  TrendingUp, CheckCircle2, Play, RotateCcw, GraduationCap, X, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTutorialContext } from './TutorialProvider';
import { tutorials, tutorialCategories, Tutorial } from './tutorialData';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, any> = {
  Sparkles, LayoutDashboard, MessageSquare, Users, UsersRound, GitBranch,
  CalendarDays, ShoppingCart, Target, Bot, Zap, GitMerge,
  Settings, TrendingUp, GraduationCap,
};

function TutorialCard({ tutorial, isCompleted, onStart, onReset }: {
  tutorial: Tutorial;
  isCompleted: boolean;
  onStart: () => void;
  onReset: () => void;
}) {
  const Icon = ICON_MAP[tutorial.icon] || GraduationCap;

  return (
    <div className={cn(
      "group rounded-xl border p-3.5 transition-all duration-200 cursor-pointer hover:shadow-sm",
      isCompleted
        ? "border-border/40 bg-muted/20 hover:bg-muted/30"
        : "border-border/60 bg-card hover:border-foreground/20 hover:bg-muted/10"
    )}
      onClick={onStart}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg flex-shrink-0 transition-colors",
          isCompleted ? "bg-emerald-50" : "bg-muted"
        )}>
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "text-[13px] font-semibold truncate",
              isCompleted ? "text-foreground/75" : "text-foreground"
            )}>
              {tutorial.title}
            </h4>
            {isCompleted && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                Concluído
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
            {tutorial.description}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-muted-foreground/60">
              {tutorial.steps.length} {tutorial.steps.length === 1 ? 'passo' : 'passos'}
            </span>
            {isCompleted ? (
              <button
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Refazer
              </button>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-foreground/70 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-2.5 w-2.5" />
                Iniciar
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

export function TutorialHelpCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    helpCenterOpen,
    setHelpCenterOpen,
    startTutorial,
    isTutorialCompleted,
    resetTutorial,
    resetAllTutorials,
  } = useTutorialContext();

  const visibleTutorials = tutorials.filter(t => t.category !== 'onboarding');
  const completedCount = visibleTutorials.filter(t => isTutorialCompleted(t.id)).length;
  const totalCount = visibleTutorials.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleStart = (tutorial: Tutorial) => {
    // Navigate to the tutorial's page first if not already there
    const currentPath = location.pathname;
    const targetRoute = tutorial.pageRoute;

    // For the welcome tutorial, stay on current page
    if (tutorial.id === 'welcome') {
      startTutorial(tutorial.id);
      return;
    }

    if (!currentPath.startsWith(targetRoute) || (targetRoute === '/crm' && currentPath !== '/crm')) {
      navigate(targetRoute);
      // Wait for navigation, then start
      setTimeout(() => startTutorial(tutorial.id), 500);
    } else {
      startTutorial(tutorial.id);
    }
  };

  const handleReset = (tutorialId: string) => {
    resetTutorial(tutorialId);
  };

  return (
    <Dialog open={helpCenterOpen} onOpenChange={setHelpCenterOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogHeader className="mb-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-foreground">
                <GraduationCap className="h-5 w-5 text-background" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-display">Central de Tutoriais</DialogTitle>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Aprenda a usar cada recurso do seu CRM</p>
              </div>
            </div>
          </DialogHeader>

          {/* Progress */}
          <div className="mt-4 rounded-xl bg-muted/30 border border-border/40 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Seu progresso</span>
              <span className="text-[11px] font-bold text-foreground tabular-nums">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {completedCount === totalCount && totalCount > 0 ? (
              <p className="text-[10px] text-emerald-600 font-medium mt-1.5">Parabéns! Você completou todos os tutoriais.</p>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 mt-1.5">Complete os tutoriais para dominar seu CRM.</p>
            )}
          </div>
        </div>

        {/* Tutorial List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {tutorialCategories.map(category => {
            const categoryTutorials = tutorials.filter(t => t.category === category.id);
            if (categoryTutorials.length === 0) return null;
            const CategoryIcon = ICON_MAP[category.icon] || LayoutDashboard;

            return (
              <div key={category.id}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <CategoryIcon className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                    {category.label}
                  </span>
                </div>
                <div className="space-y-2">
                  {categoryTutorials.map(tutorial => (
                    <TutorialCard
                      key={tutorial.id}
                      tutorial={tutorial}
                      isCompleted={isTutorialCompleted(tutorial.id)}
                      onStart={() => handleStart(tutorial)}
                      onReset={() => handleReset(tutorial.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {completedCount > 0 && (
          <div className="px-6 py-3 border-t border-border/40 bg-muted/20">
            <button
              onClick={resetAllTutorials}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Resetar todos os tutoriais
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
