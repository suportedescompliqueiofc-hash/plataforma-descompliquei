import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlataformaOnboardingStep {
  key: string;
  title: string;
  description: string;
  icon: string;
  mandatory: boolean;
  path?: string;
  tutorialId?: string;
  ctaLabel: string;
  external?: boolean;
  completed?: boolean;
}

// ─── Definição dos passos ─────────────────────────────────────────────────────

export const PLATFORM_ONBOARDING_STEPS: PlataformaOnboardingStep[] = [
  {
    key: 'tour',
    title: 'Conheça a plataforma',
    description: 'Tour guiado pelas principais seções — veja o que está disponível e como tudo funciona',
    icon: 'Map',
    mandatory: true,
    path: '/plataforma',
    tutorialId: 'platform-tour',
    ctaLabel: 'Iniciar tour',
  },
  {
    key: 'crm',
    title: 'Configure seu CRM',
    description: 'Acesse o CRM para configurar o pipeline, as etiquetas e o WhatsApp da sua clínica',
    icon: 'BarChart2',
    mandatory: true,
    path: '/crm',
    ctaLabel: 'Ir para o CRM',
    external: true,
  },
];

// Páginas onde o modal NÃO bloqueia (usuário está configurando algo)
export const PLATFORM_ONBOARDING_ALLOWED_PATHS = [
  '/plataforma/trilha',
  '/plataforma/ia-comercial',
  '/plataforma/sessoes-taticas',
  '/plataforma/onboarding',
  '/plataforma/arsenal',
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePlataformaOnboarding(phase1Complete: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: stepsData, isLoading } = useQuery({
    queryKey: ['platform-onboarding-steps', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('platform_users')
        .select('platform_onboarding_steps')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && phase1Complete,
    staleTime: 5 * 60 * 1000,
  });

  const completedSteps = (stepsData?.platform_onboarding_steps ?? []) as string[];

  const completeStep = useMutation({
    mutationFn: async (stepKey: string) => {
      if (!user?.id) throw new Error('No user');
      const newSteps = [...new Set([...completedSteps, stepKey])];
      const { error } = await supabase
        .from('platform_users')
        .update({ platform_onboarding_steps: newSteps } as any)
        .eq('id', user.id);
      if (error) throw error;
      return newSteps;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-onboarding-steps', user?.id] });
    },
  });

  const steps = PLATFORM_ONBOARDING_STEPS.map((step) => ({
    ...step,
    completed: completedSteps.includes(step.key),
  }));

  const mandatorySteps = steps.filter((s) => s.mandatory);
  const mandatoryComplete = mandatorySteps.every((s) => s.completed);
  const completedCount = steps.filter((s) => s.completed).length;

  const shouldShowChecklist = phase1Complete && !isLoading && !mandatoryComplete && !!user?.id;

  return {
    isLoading,
    steps,
    completedSteps,
    mandatoryComplete,
    completedCount,
    totalCount: steps.length,
    shouldShowChecklist,
    completeStep,
  };
}
