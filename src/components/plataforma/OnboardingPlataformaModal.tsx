import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, PlayCircle, Zap, Rocket, Brain, Target,
  CheckCircle2, BookOpen, Calendar, BarChart3, ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { usePlataforma } from '@/contexts/PlataformaContext';
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

// ─── Componente ───────────────────────────────────────────────────────────────
export default function OnboardingPlataformaModal() {
  const { acesso, plataformaUser, completeOnboarding, isContextLoading } = usePlataforma();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

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
  const clinicName = plataformaUser?.clinic_name ?? '';

  const handleNext = async () => {
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

          {/* Bullets */}
          {currentStep.bullets && currentStep.bullets.length > 0 && (
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

          {/* Ferramenta vazia */}
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
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="h-9 px-4 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                Voltar
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={completing}
              className="h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {completing
                ? 'Carregando...'
                : isLast
                  ? <>Ir para a Trilha <ArrowRight className="h-3.5 w-3.5" /></>
                  : <>Próximo <ChevronRight className="h-3.5 w-3.5" /></>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
