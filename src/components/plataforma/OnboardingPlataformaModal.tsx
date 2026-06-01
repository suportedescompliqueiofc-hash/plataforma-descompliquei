import { useState } from 'react';
import {
  Sparkles, Brain, Target, Zap,
  KeyRound, Eye, EyeOff, ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Bullet { icon: React.ElementType; text: string }
interface Step {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  bullets?: Bullet[];
}

// ─── Passos (apenas 2) ────────────────────────────────────────────────────────
const STEPS: Step[] = [
  {
    id: 'boas-vindas',
    icon: Sparkles,
    iconBg: 'bg-[#E85D24]/10',
    iconColor: 'text-[#E85D24]',
    title: 'Bem-vindo(a) à Plataforma!',
    description:
      'Você acabou de acessar o ambiente que vai transformar a captação e conversão de pacientes da sua clínica.',
    bullets: [
      { icon: Target, text: 'Trilha de aprendizado com os melhores métodos do mercado' },
      { icon: Brain, text: 'IAs treinadas para clínicas médicas e odontológicas' },
      { icon: Zap, text: 'Ferramentas práticas para o dia a dia comercial' },
    ],
  },
  {
    id: 'senha',
    icon: KeyRound,
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-600',
    title: 'Crie sua senha de acesso',
    description:
      'Defina uma senha segura para acessar a plataforma sempre que precisar — sem depender do link enviado por e-mail.',
  },
];

// ─── Campo de senha ───────────────────────────────────────────────────────────
function SenhaStep({
  password, confirm, onPasswordChange, onConfirmChange, error,
}: {
  password: string; confirm: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  error: string | null;
}) {
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Nova senha
        </label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
          />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Confirmar senha
        </label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirm}
            onChange={e => onConfirmChange(e.target.value)}
            placeholder="Repita a senha"
            className={cn(
              'h-10 w-full rounded-lg border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 transition',
              confirm && confirm !== password
                ? 'border-red-300 focus:ring-red-200'
                : 'border-border/60 focus:ring-foreground/20',
            )}
          />
          <button type="button" onClick={() => setShowConfirm(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm && confirm !== password && (
          <p className="text-[11px] text-red-500 mt-0.5">As senhas não coincidem.</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
        Use pelo menos 8 caracteres. Após criar sua senha, você poderá entrar com e-mail e senha normalmente.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[12px] text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function OnboardingPlataformaModal() {
  const { plataformaUser, completeOnboarding, isContextLoading } = usePlataforma();
  const { role } = useProfile();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  // ⚠️ TODOS os hooks devem ficar ANTES de qualquer return condicional (React rules of hooks)
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // Nunca mostrar para superadmins ou clientes antigos
  const isSuperAdmin = role === 'superadmin';
  const onboardingEnabled = plataformaUser?.platform_onboarding_enabled === true;
  if (isSuperAdmin || !onboardingEnabled) return null;
  if (isContextLoading) return null;

  const currentStep = STEPS[step];
  const isSenhaStep = currentStep.id === 'senha';
  const clinicName = plataformaUser?.clinic_name ?? '';

  const handleNext = async () => {
    if (isSenhaStep) {
      setSenhaError(null);
      if (password.length < 8) { setSenhaError('A senha deve ter pelo menos 8 caracteres.'); return; }
      if (password !== confirm) { setSenhaError('As senhas não coincidem.'); return; }
      setSavingPwd(true);
      const { error } = await supabase.auth.updateUser({ password });
      setSavingPwd(false);
      if (error) {
        if (error.message.includes('different from the old password')) {
          setSenhaError('Essa senha já está registrada. Escolha uma senha diferente.');
        } else {
          setSenhaError('Erro ao salvar senha: ' + error.message);
        }
        return;
      }
      // Senha salva — conclui a fase 1 do onboarding
      setCompleting(true);
      await completeOnboarding();
      // Modal fecha automaticamente pois showOnboarding torna-se false
      return;
    }
    setStep(s => s + 1);
  };

  const handleSkip = async () => {
    setCompleting(true);
    await completeOnboarding();
  };

  const Icon = currentStep.icon;

  const nextLabel = () => {
    if (savingPwd || completing) return 'Carregando...';
    if (isSenhaStep) return <><ShieldCheck className="h-3.5 w-3.5" /> Criar senha e continuar</>;
    return <>Próximo <ChevronRight className="h-3.5 w-3.5" /></>;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>

      <div className="w-full max-w-[520px] rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden flex flex-col">

        {/* Barra de progresso */}
        <div className="h-1 bg-muted/40 w-full">
          <div
            className="h-full bg-[#E85D24] transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Dots */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s.id} className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'w-6 bg-[#E85D24]' : i < step ? 'w-3 bg-[#E85D24]/40' : 'w-3 bg-muted/40',
              )} />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground/50 font-mono">{step + 1} / {STEPS.length}</span>
        </div>

        {/* Conteúdo */}
        <div className="px-8 pt-4 pb-6 flex flex-col gap-5">

          {/* Ícone + título */}
          <div className="flex items-start gap-4">
            <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', currentStep.iconBg)}>
              <Icon className={cn('h-7 w-7', currentStep.iconColor)} />
            </div>
            <div className="pt-0.5">
              {step === 0 && clinicName && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                  {clinicName}
                </p>
              )}
              <h2 className="text-[22px] font-bold tracking-tight text-foreground font-display leading-tight">
                {currentStep.title}
              </h2>
            </div>
          </div>

          <p className="text-[13px] text-muted-foreground leading-relaxed">{currentStep.description}</p>

          {/* Bullets (boas-vindas) */}
          {currentStep.bullets && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-border/40 bg-muted/[0.04] px-4 py-4">
              {currentStep.bullets.map((bullet, i) => {
                const BulletIcon = bullet.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                      <BulletIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <span className="text-[13px] text-foreground/80">{bullet.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulário de senha */}
          {isSenhaStep && (
            <>
              <SenhaStep
                password={password} confirm={confirm}
                onPasswordChange={setPassword} onConfirmChange={setConfirm}
                error={senhaError}
              />
              <button
                onClick={handleSkip}
                className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors text-left"
              >
                Já tenho senha cadastrada — pular este passo
              </button>
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-border/40 bg-muted/[0.03]">
          {!isSenhaStep ? (
            <button
              onClick={handleSkip}
              className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Pular introdução
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={savingPwd || completing}
                className="h-9 px-4 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                Voltar
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={savingPwd || completing}
              className="h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {nextLabel()}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
