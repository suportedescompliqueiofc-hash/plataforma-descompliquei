import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, PlayCircle, Zap, Rocket, Brain, Target,
  CheckCircle2, BookOpen, Calendar, BarChart3, ArrowRight,
  ChevronRight, KeyRound, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Bullet {
  icon: React.ElementType;
  text: string;
}

interface Step {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  title: string;
  description: string;
  bullets?: Bullet[];
}

// ─── Passos base ──────────────────────────────────────────────────────────────
const BASE_STEPS: Step[] = [
  {
    id: 'boas-vindas',
    icon: Sparkles,
    iconBg: 'bg-[#E85D24]/10',
    iconColor: 'text-[#E85D24]',
    label: 'Boas-vindas',
    title: 'Bem-vindo(a) à Plataforma!',
    description:
      'Você acabou de acessar o ambiente que vai transformar a captação e conversão de pacientes da sua clínica. Conheça o que está disponível para você.',
    bullets: [
      { icon: Target, text: 'Trilha de aprendizado com os melhores métodos do mercado' },
      { icon: Brain, text: 'Inteligência artificial treinada para clínicas médicas e odontológicas' },
      { icon: Zap, text: 'Ferramentas práticas para o dia a dia comercial' },
    ],
  },
  {
    id: 'senha',
    icon: KeyRound,
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-600',
    label: 'Senha',
    title: 'Crie sua senha de acesso',
    description:
      'Defina uma senha segura para acessar a plataforma sempre que precisar — sem depender do link enviado por e-mail.',
  },
  {
    id: 'trilha',
    icon: PlayCircle,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
    label: 'Trilha',
    title: 'Trilha de Aprendizado',
    description:
      'Módulos práticos e objetivos para você dominar a captação e conversão de pacientes — passo a passo, no seu ritmo.',
    bullets: [
      { icon: BookOpen, text: 'Aulas em vídeo + materiais complementares' },
      { icon: CheckCircle2, text: 'Progresso salvo automaticamente' },
      { icon: Target, text: 'Conteúdo aplicável imediatamente na sua clínica' },
    ],
  },
  {
    id: 'ferramentas',
    icon: Zap,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600',
    label: 'Ferramentas',
    title: 'Suas Ferramentas',
    description:
      'Recursos disponíveis no seu plano para acelerar os resultados da sua clínica.',
    bullets: [],
  },
  {
    id: 'pronto',
    icon: Rocket,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    label: 'Começar',
    title: 'Tudo pronto para começar!',
    description:
      'A jornada começa agora. Recomendamos iniciar pela Trilha de Aprendizado para construir uma base sólida e já sair aplicando.',
    bullets: [
      { icon: PlayCircle, text: 'Comece pela Trilha de Aprendizado' },
      { icon: Brain, text: 'Configure o Cérebro Central com os dados da sua clínica' },
      { icon: Zap, text: 'Explore as IAs Comerciais para atender mais pacientes' },
    ],
  },
];

// ─── Step de senha ────────────────────────────────────────────────────────────
function SenhaStep({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  error,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  error: string | null;
}) {
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Campo senha */}
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
          <button
            type="button"
            onClick={() => setShowPwd(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Campo confirmação */}
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
          <button
            type="button"
            onClick={() => setShowConfirm(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm && confirm !== password && (
          <p className="text-[11px] text-red-500 mt-0.5">As senhas não coincidem.</p>
        )}
      </div>

      {/* Dica */}
      <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
        Use pelo menos 8 caracteres. Após criar sua senha, você poderá entrar com e-mail e senha normalmente.
      </p>

      {/* Erro geral */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[12px] text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OnboardingPlataformaModal() {
  const { acesso, plataformaUser, completeOnboarding, isContextLoading } = usePlataforma();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  // Estado do passo de senha
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [senhaSalva, setSenhaSalva] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Monta bullets dinâmicos do passo "ferramentas"
  const ferramentasBullets: Bullet[] = [];
  if ((acesso.pilares_liberados?.length ?? 0) > 0)
    ferramentasBullets.push({ icon: PlayCircle, text: 'Trilha de Aprendizado — módulos estruturados' });
  if (acesso.acesso_cerebro)
    ferramentasBullets.push({ icon: Brain, text: 'Cérebro Central — IA com a identidade da sua clínica' });
  if (acesso.acesso_ia_comercial)
    ferramentasBullets.push({ icon: Zap, text: 'IAs Comerciais — assistentes para captação e vendas' });
  if (acesso.acesso_sessoes_taticas)
    ferramentasBullets.push({ icon: Calendar, text: 'Sessões Táticas — encontros ao vivo com especialistas' });
  if (acesso.acesso_crm)
    ferramentasBullets.push({ icon: BarChart3, text: 'CRM — gestão completa de leads e conversões' });

  // Injeta bullets dinâmicos na step ferramentas
  const steps: Step[] = BASE_STEPS.map(s =>
    s.id === 'ferramentas' ? { ...s, bullets: ferramentasBullets } : s
  );

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;
  const isSenhaStep = currentStep.id === 'senha';
  const clinicName = plataformaUser?.clinic_name ?? '';

  const handleNext = async () => {
    // Passo de senha — salvar antes de avançar
    if (isSenhaStep && !senhaSalva) {
      setSenhaError(null);
      if (password.length < 8) {
        setSenhaError('A senha deve ter pelo menos 8 caracteres.');
        return;
      }
      if (password !== confirm) {
        setSenhaError('As senhas não coincidem.');
        return;
      }
      setSavingPwd(true);
      const { error } = await supabase.auth.updateUser({ password });
      setSavingPwd(false);
      if (error) {
        // Traduzir erros comuns do Supabase
        if (error.message.includes('different from the old password')) {
          setSenhaError('Essa senha já está registrada na sua conta. Escolha uma senha diferente.');
        } else {
          setSenhaError('Erro ao salvar senha: ' + error.message);
        }
        return;
      }
      // Avança imediatamente — sem setTimeout para evitar remontagem por evento de auth
      setSenhaSalva(true);
      setStep(s => s + 1);
      return;
    }

    if (isLast) {
      setCompleting(true);
      await completeOnboarding();
      navigate('/plataforma/trilha');
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  if (isContextLoading) return null;

  const Icon = currentStep.icon;

  // Label e estado do botão próximo
  const nextLabel = () => {
    if (savingPwd) return 'Salvando...';
    if (completing) return 'Carregando...';
    if (isSenhaStep && !senhaSalva) return <>Criar senha <ShieldCheck className="h-3.5 w-3.5" /></>;
    if (isLast) return <>Ir para a Trilha <ArrowRight className="h-3.5 w-3.5" /></>;
    return <>Próximo <ChevronRight className="h-3.5 w-3.5" /></>;
  };

  return (
    /* Overlay */
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>

      <div className="w-full max-w-[560px] rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden flex flex-col">

        {/* ── Barra de progresso ── */}
        <div className="h-1 bg-muted/40 w-full">
          <div
            className="h-full bg-[#E85D24] transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* ── Indicador de passos ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step
                    ? 'w-6 bg-[#E85D24]'
                    : i < step
                      ? 'w-3 bg-[#E85D24]/40 cursor-pointer hover:bg-[#E85D24]/60'
                      : 'w-3 bg-muted/40 cursor-default'
                )}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground/50 font-mono">
            {step + 1} / {steps.length}
          </span>
        </div>

        {/* ── Conteúdo ── */}
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

          {/* Descrição */}
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {currentStep.description}
          </p>

          {/* Passo de senha — formulário */}
          {isSenhaStep && (
            <>
              <SenhaStep
                password={password}
                confirm={confirm}
                onPasswordChange={setPassword}
                onConfirmChange={setConfirm}
                error={senhaError}
              />
              <button
                onClick={() => setStep(s => s + 1)}
                className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors text-left"
              >
                Já tenho senha cadastrada — pular este passo
              </button>
            </>
          )}

          {/* Bullets (outros passos) */}
          {!isSenhaStep && currentStep.bullets && currentStep.bullets.length > 0 && (
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

          {/* Ferramentas vazia */}
          {currentStep.id === 'ferramentas' && ferramentasBullets.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/[0.04] px-4 py-3">
              <span className="text-[13px] text-muted-foreground/60">
                Nenhuma ferramenta adicional disponível no plano atual.
              </span>
            </div>
          )}
        </div>

        {/* ── Rodapé ── */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-border/40 bg-muted/[0.03]">
          <button
            onClick={handleSkip}
            className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Pular introdução
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && !senhaSalva && (
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
              disabled={savingPwd || completing || senhaSalva}
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
