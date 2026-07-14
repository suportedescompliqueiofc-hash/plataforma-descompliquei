import { useNavigate } from 'react-router-dom';
import {
  Building2, Bot, Stethoscope, Users, GraduationCap, Tag, Smartphone, KeyRound, LifeBuoy,
  CheckCircle2, Circle, ArrowRight, Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboarding, type OnboardingStep } from '@/hooks/useOnboarding';
import { useTutorialContext } from '@/components/tutorial/TutorialProvider';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ElementType> = {
  Building2, Bot, Stethoscope, Users, GraduationCap, Tag, Smartphone, KeyRound, LifeBuoy,
};

export default function CrmOnboarding() {
  const navigate = useNavigate();
  const { steps, allComplete, completedCount, totalCount, completeStep } = useOnboarding();
  const { startTutorial } = useTutorialContext();

  const progress = Math.round((completedCount / totalCount) * 100);

  const handleComplete = async (stepKey: string) => {
    await completeStep.mutateAsync(stepKey);
    toast.success('Etapa concluída!', { duration: 1500 });
  };

  const handleStartGuide = (step: OnboardingStep) => {
    if (step.path) navigate(step.path);
    if (step.tutorialId) {
      setTimeout(() => startTutorial(step.tutorialId!), 600);
    }
  };

  const renderStep = (step: OnboardingStep & { completed?: boolean }, index: number) => {
    const Icon = ICON_MAP[step.icon] ?? Circle;
    return (
      <div
        key={step.key}
        className={cn(
          'rounded-xl border p-4 transition-all',
          step.completed
            ? 'border-emerald-200/60 bg-emerald-50/50'
            : 'border-border/70 bg-card',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {step.completed ? (
              <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-foreground/10 text-foreground">
                {index + 1}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className={cn(
                'text-[13px] font-semibold',
                step.completed ? 'text-emerald-800 line-through' : 'text-foreground',
              )}>
                {step.title}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{step.description}</p>
            {!step.completed && (
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => handleStartGuide(step)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  {step.ctaLabel}
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleComplete(step.key)}
                  disabled={completeStep.isPending}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Já fiz isso
                </button>
              </div>
            )}
          </div>
          <div className={cn('shrink-0 p-2 rounded-lg', step.completed ? 'bg-emerald-100' : 'bg-muted')}>
            <Icon className={cn('h-4 w-4', step.completed ? 'text-emerald-600' : 'text-muted-foreground')} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Configuração Inicial</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">
          Siga os passos abaixo — o sistema guia você campo por campo em cada página
        </p>
      </div>

      {/* Progresso */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted"><Trophy className="h-3.5 w-3.5 text-muted-foreground" /></span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">PROGRESSO</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{completedCount} de {totalCount} passos concluídos</p>
              </div>
            </div>
            <span className={cn(
              "text-2xl font-extrabold tabular-nums font-display",
              progress >= 100 ? "text-emerald-600" : progress >= 50 ? "text-amber-600" : "text-foreground"
            )}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700", progress >= 100 ? "bg-emerald-500" : "bg-foreground")} style={{ width: `${progress}%` }} />
          </div>
        </div>
        {allComplete && (
          <div className="px-5 py-4 flex items-center gap-3 bg-emerald-50/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[12px] font-semibold text-emerald-800">Configuração completa!</p>
              <p className="text-[11px] text-emerald-700/70">Seu CRM está 100% configurado e pronto para operar.</p>
            </div>
          </div>
        )}
      </div>

      {/* Passos */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><Circle className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">CONFIGURAÇÃO ESSENCIAL</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Complete todos os passos para desbloquear o CRM</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {steps.map((step, i) => renderStep(step, i))}
        </div>
      </div>
    </div>
  );
}
