import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Brain, Map, BarChart2, Circle,
  CheckCircle2, ArrowRight, Trophy, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePlataformaOnboarding,
  PLATFORM_ONBOARDING_ALLOWED_PATHS,
  type PlataformaOnboardingStep,
} from '@/hooks/usePlataformaOnboarding';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { useTutorialContext } from '@/components/tutorial/TutorialProvider';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ElementType> = {
  Brain, Map, BarChart2, Circle,
};

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onComplete,
  onStartGuide,
  isCompleting,
}: {
  step: PlataformaOnboardingStep & { completed?: boolean };
  index: number;
  onComplete: () => void;
  onStartGuide: () => void;
  isCompleting: boolean;
}) {
  const Icon = ICON_MAP[step.icon] ?? Circle;

  return (
    <div
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
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold font-display tabular-nums bg-foreground/10 text-foreground">
              {index + 1}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[13px] font-semibold font-display mb-0.5',
            step.completed ? 'text-emerald-800 line-through' : 'text-foreground',
          )}>
            {step.title}
          </p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{step.description}</p>

          {!step.completed && (
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={onStartGuide}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                {step.ctaLabel}
                {step.external
                  ? <ExternalLink className="h-3 w-3" />
                  : <ArrowRight className="h-3 w-3" />
                }
              </button>
              <button
                onClick={onComplete}
                disabled={isCompleting}
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
}

// ─── Celebration ──────────────────────────────────────────────────────────────

function CelebrationScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6 px-4">
      <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
        <CheckCircle2 className="h-7 w-7 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-foreground font-display mb-1">
        Plataforma configurada!
      </h2>
      <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed mb-6">
        Sua clínica está pronta para usar todas as ferramentas. Agora é só explorar e aplicar no dia a dia.
      </p>
      <button
        onClick={onContinue}
        className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 flex items-center gap-1.5 transition-colors"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        Explorar a plataforma
      </button>
    </div>
  );
}

// ─── Main Checklist ───────────────────────────────────────────────────────────

// Mapa: tutorialId → stepKey do onboarding
const TUTORIAL_TO_STEP: Record<string, string> = {
  'platform-tour': 'tour',
};

export function OnboardingPlataformaChecklist() {
  const navigate = useNavigate();
  const location = useLocation();
  const { plataformaUser, isContextLoading, isMember, hasPlataformaAccess } = usePlataforma();
  const { startTutorial, activeTutorialId, isTutorialCompleted } = useTutorialContext();
  const { role } = useProfile();

  const isSuperAdmin = role === 'superadmin';
  const onboardingEnabled = plataformaUser?.platform_onboarding_enabled === true;
  const onboardingConcluido = plataformaUser?.onboarding_concluido === true;
  const phase1Complete = plataformaUser?.onboarding_complete === true;

  // ⚠️ TODOS os hooks devem ficar ANTES de qualquer return condicional (React rules of hooks)
  const { steps, mandatoryComplete, shouldShowChecklist, completeStep } =
    usePlataformaOnboarding(phase1Complete);

  const [celebrating, setCelebrating] = useState(false);
  const [wasVisible, setWasVisible] = useState(false);
  const [prevTutorialId, setPrevTutorialId] = useState<string | null>(null);

  // Detecta quando o modal de passos ficou visível nesta sessão
  useEffect(() => {
    if (shouldShowChecklist) setWasVisible(true);
  }, [shouldShowChecklist]);

  // Celebra apenas se o usuário completou os passos aqui, nesta sessão
  useEffect(() => {
    if (mandatoryComplete && wasVisible) {
      setCelebrating(true);
      setWasVisible(false);
    }
  }, [mandatoryComplete, wasVisible]);

  // Auto-completar step quando o tutorial associado termina (concluído ou pulado)
  useEffect(() => {
    // Tutorial acabou de ficar null → o anterior terminou
    if (prevTutorialId && !activeTutorialId) {
      const stepKey = TUTORIAL_TO_STEP[prevTutorialId];
      if (stepKey) {
        completeStep.mutate(stepKey);
      }
    }
    setPrevTutorialId(activeTutorialId);
  }, [activeTutorialId]);

  // ── Condições de ocultação ──────────────────────────────────────────────────

  // Superadmin nunca vê; clientes antigos (flag false/null) nunca veem; membros não veem Phase 2
  // Exclusivo para produtos com acesso à plataforma — produto CRM isolado não vê este checklist
  if (isSuperAdmin || !onboardingEnabled || isMember || !hasPlataformaAccess) return null;

  // Esconde completamente enquanto um tutorial está ativo (spotlight precisa ficar visível)
  if (activeTutorialId) return null;

  // Só mostra em rotas /plataforma/* — nunca no CRM ou admin
  const isPlataformaRoute = location.pathname.startsWith('/plataforma');
  if (!isPlataformaRoute && !celebrating) return null;

  // Não bloqueia nas páginas onde o usuário está configurando
  const isAllowedPath = PLATFORM_ONBOARDING_ALLOWED_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  if (isAllowedPath && !celebrating) return null;

  // Nunca mostrar antes do Athos concluir — mesmo que onboarding_complete esteja incorretamente setado
  if (!onboardingConcluido) return null;
  if (!shouldShowChecklist && !celebrating) return null;
  if (isContextLoading) return null;

  const handleStartGuide = (step: PlataformaOnboardingStep) => {
    if (step.external && step.path) {
      window.open(step.path, '_blank', 'noopener,noreferrer');
      // Marcar automaticamente ao abrir o CRM
      completeStep.mutate(step.key);
      return;
    }
    if (step.path) navigate(step.path);
    if (step.tutorialId) {
      // startTutorial seta activeTutorialId → checklist retorna null → spotlight fica visível
      setTimeout(() => startTutorial(step.tutorialId!), 300);
    }
  };

  const handleComplete = async (stepKey: string) => {
    await completeStep.mutateAsync(stepKey);
    toast.success('Etapa concluída!', { duration: 1500 });
  };

  const handleCelebrationContinue = () => {
    setCelebrating(false);
    navigate('/plataforma');
  };

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm" />

      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl flex flex-col">

          {celebrating ? (
            <div className="p-6">
              <CelebrationScreen onContinue={handleCelebrationContinue} />
            </div>
          ) : (
            <div className="flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-foreground font-display leading-tight">
                      Configure sua plataforma
                    </h2>
                    <p className="text-[11px] text-muted-foreground/70">
                      Siga os passos abaixo para começar a usar todas as ferramentas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 font-display tabular-nums shrink-0">
                    {completedCount}/{steps.length}
                  </span>
                </div>
              </div>

              {/* Steps */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-4 space-y-3">
                  {steps.map((step, i) => (
                    <StepCard
                      key={step.key}
                      step={step}
                      index={i}
                      onComplete={() => handleComplete(step.key)}
                      onStartGuide={() => handleStartGuide(step)}
                      isCompleting={completeStep.isPending}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
