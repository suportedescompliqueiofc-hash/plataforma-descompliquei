import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Building2, Bot, Stethoscope, Users, GraduationCap, Tag, Smartphone, LifeBuoy,
  CheckCircle2, Circle, ArrowRight, Trophy, X, KeyRound, Eye, EyeOff, Loader2, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboarding, ONBOARDING_ALLOWED_PATHS, type OnboardingStep } from '@/hooks/useOnboarding';
import { useTutorialContext } from '@/components/tutorial/TutorialProvider';
import { useWhatsAppMonitor } from '@/hooks/useWhatsAppMonitor';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ElementType> = {
  Building2, Bot, Stethoscope, Users, GraduationCap, Tag, Smartphone, KeyRound, HelpCircle, LifeBuoy,
};

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onComplete,
  onStartGuide,
  isCompleting,
}: {
  step: OnboardingStep & { completed?: boolean };
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
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className={cn(
              'text-[13px] font-semibold font-display',
              step.completed ? 'text-emerald-800 line-through' : 'text-foreground',
            )}>
              {step.title}
            </p>
            {step.optional && !step.completed && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/60 border border-border/40">
                Opcional
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{step.description}</p>

          {!step.completed && (
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={onStartGuide}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                {step.ctaLabel}
                <ArrowRight className="h-3 w-3" />
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

// ─── PasswordStepCard ─────────────────────────────────────────────────────────

function PasswordStepCard({
  step,
  index,
  onComplete,
  isCompleting,
}: {
  step: OnboardingStep & { completed?: boolean };
  index: number;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  if (step.completed) {
    return (
      <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold font-display text-emerald-800 line-through">{step.title}</p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{step.description}</p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-100 shrink-0">
            <KeyRound className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setError('');
    if (password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm)  { setError('As senhas não coincidem.'); return; }
    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateErr) { setError(updateErr.message); return; }
    onComplete();
    toast.success('Senha criada com sucesso!', { duration: 2000 });
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold font-display tabular-nums bg-foreground/10 text-foreground shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold font-display text-foreground">{step.title}</p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-0.5">{step.description}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            placeholder="Nova senha (mín. 6 caracteres)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 pr-9 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
          <button
            type="button"
            onClick={() => setShowPwd(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <input
          type={showPwd ? 'text' : 'password'}
          placeholder="Confirmar senha"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
        {error && <p className="text-[11px] text-destructive">{error}</p>}

        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={handleSave}
            disabled={saving || !password || !confirm}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40"
          >
            {saving
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <KeyRound className="h-3 w-3" />}
            Criar senha
          </button>
          <button
            onClick={onComplete}
            disabled={isCompleting}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
          >
            <CheckCircle2 className="h-3 w-3" />
            Já tenho senha
          </button>
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
        CRM configurado com sucesso!
      </h2>
      <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed mb-6">
        Sua clínica está pronta para operar. Agora é só usar o CRM para atrair, atender e fechar mais pacientes.
      </p>
      <button
        onClick={onContinue}
        className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 flex items-center justify-center transition-colors"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        Acessar o CRM
      </button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function OnboardingModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { steps, mandatoryComplete, shouldShowModal, completeStep, isLoading } = useOnboarding();
  const { profile } = useProfile();
  const { startTutorial } = useTutorialContext();
  const { status: waStatus } = useWhatsAppMonitor();
  const [celebrating, setCelebrating] = useState(false);
  const [wasModalVisible, setWasModalVisible] = useState(false);

  const dismissedKey = profile?.organization_id ? `onboarding_dismissed_${profile.organization_id}` : null;
  const [dismissed, setDismissed] = useState(() =>
    dismissedKey ? localStorage.getItem(dismissedKey) === '1' : false
  );

  const handleDismiss = () => {
    if (dismissedKey) localStorage.setItem(dismissedKey, '1');
    setDismissed(true);
  };

  // Sincroniza o dismissed quando o orgId carrega (profile pode não estar pronto no primeiro render)
  useEffect(() => {
    if (dismissedKey) {
      setDismissed(localStorage.getItem(dismissedKey) === '1');
    }
  }, [dismissedKey]);

  // Auto-completa o passo WhatsApp quando a conexão é detectada
  useEffect(() => {
    const waStep = steps.find(s => s.key === 'whatsapp');
    if (waStatus === 'connected' && waStep && !waStep.completed && !completeStep.isPending) {
      completeStep.mutate('whatsapp');
    }
  }, [waStatus]);

  // Marca que o modal de passos foi exibido nesta sessão
  useEffect(() => {
    if (shouldShowModal) setWasModalVisible(true);
  }, [shouldShowModal]);

  // Só celebra se o modal de passos estava visível E o usuário completou tudo agora
  useEffect(() => {
    if (mandatoryComplete && wasModalVisible) {
      if (dismissedKey) localStorage.removeItem(dismissedKey);
      setDismissed(false);
      setCelebrating(true);
      setWasModalVisible(false);
    }
  }, [mandatoryComplete, wasModalVisible]);

  const isAllowedPath = ONBOARDING_ALLOWED_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );

  // Só mostrar em rotas do CRM — nunca na plataforma, admin ou outras áreas
  const isCrmRoute = location.pathname.startsWith('/crm');
  if (!isCrmRoute && !celebrating) return null;

  if (isAllowedPath && !celebrating) return null;
  if (!shouldShowModal && !celebrating) return null;
  if (dismissed && !celebrating) return null;

  const handleStartGuide = (step: OnboardingStep) => {
    if (step.path) navigate(step.path);
    if (step.tutorialId) {
      setTimeout(() => startTutorial(step.tutorialId!), 600);
    }
  };

  const handleComplete = async (stepKey: string) => {
    await completeStep.mutateAsync(stepKey);
    toast.success('Etapa concluída!', { duration: 1500 });
  };

  const handleCelebrationContinue = () => {
    setCelebrating(false);
    navigate('/crm');
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
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[15px] font-bold text-foreground font-display leading-tight">
                      Configure seu CRM
                    </h2>
                    <p className="text-[11px] text-muted-foreground/70">
                      Siga os passos abaixo — o sistema guia você campo por campo
                    </p>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    title="Fechar por agora (volta na próxima sessão)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-foreground transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 font-display tabular-nums shrink-0">
                    {completedCount}/{steps.length}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-4 space-y-3">
                  {steps.map((step, i) =>
                    step.key === 'senha' ? (
                      <PasswordStepCard
                        key={step.key}
                        step={step}
                        index={i}
                        onComplete={() => handleComplete(step.key)}
                        isCompleting={completeStep.isPending}
                      />
                    ) : (
                      <StepCard
                        key={step.key}
                        step={step}
                        index={i}
                        onComplete={() => handleComplete(step.key)}
                        onStartGuide={() => handleStartGuide(step)}
                        isCompleting={completeStep.isPending}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
