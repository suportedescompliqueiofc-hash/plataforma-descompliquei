import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  icon: string;
  mandatory: boolean;
  path?: string;            // rota de destino
  tutorialId?: string;      // id do tutorial que guia na página
  ctaLabel: string;
  completed?: boolean;      // injetado em runtime
}

// ─── Definição dos passos ─────────────────────────────────────────────────────

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'perfil',
    title: 'Complete o perfil da clínica',
    description: 'Adicione o logo, nome do sistema e personalize as cores da marca',
    icon: 'Building2',
    mandatory: true,
    path: '/crm/settings?section=marca',
    tutorialId: 'onboarding-perfil',
    ctaLabel: 'Configurar marca',
  },
  {
    key: 'etiquetas',
    title: 'Sincronize as etiquetas do WhatsApp',
    description: 'Importe suas etiquetas do WhatsApp Business para organizar os leads',
    icon: 'Tag',
    mandatory: true,
    path: '/crm/settings?section=tags',
    tutorialId: 'onboarding-etiquetas',
    ctaLabel: 'Sincronizar etiquetas',
  },
  {
    key: 'procedimentos',
    title: 'Cadastre seus procedimentos',
    description: 'Monte o catálogo de serviços para rastrear vendas e faturamento',
    icon: 'Stethoscope',
    mandatory: true,
    path: '/crm/procedimentos',
    tutorialId: 'onboarding-procedimentos',
    ctaLabel: 'Cadastrar procedimentos',
  },
  {
    key: 'tutorial',
    title: 'Faça o tour pelo CRM',
    description: 'Tutorial interativo que percorre todas as funcionalidades em 10 minutos',
    icon: 'GraduationCap',
    mandatory: true,
    path: '/crm',
    tutorialId: 'welcome',
    ctaLabel: 'Iniciar tour',
  },
];

// Páginas onde o modal NÃO bloqueia (usuário está configurando algo)
export const ONBOARDING_ALLOWED_PATHS = [
  '/crm/settings',
  '/crm/ia',
  '/crm/procedimentos',
  '/crm/onboarding',
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboarding() {
  const { profile, role } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const isAdmin = role === 'superadmin' || role === 'admin';
  // Onboarding só aparece para 'admin' (dono da clínica) — não para superadmin nem atendente
  const isOrgOwner = role === 'admin';

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['onboarding', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('onboarding_completed_steps, onboarding_enabled')
        .eq('id', orgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isOrgOwner,
    staleTime: 5 * 60 * 1000,
  });

  const completedSteps = (orgData?.onboarding_completed_steps ?? []) as string[];
  const onboardingEnabled = orgData?.onboarding_enabled ?? false;

  const completeStep = useMutation({
    mutationFn: async (stepKey: string) => {
      if (!orgId) throw new Error('No org');
      const newSteps = [...new Set([...completedSteps, stepKey])];
      const { error } = await supabase
        .from('organizations')
        .update({ onboarding_completed_steps: newSteps } as any)
        .eq('id', orgId);
      if (error) throw error;
      return newSteps;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', orgId] });
    },
  });

  const steps = ONBOARDING_STEPS.map((step) => ({
    ...step,
    completed: completedSteps.includes(step.key),
  }));

  const mandatorySteps = steps.filter((s) => s.mandatory);
  const mandatoryComplete = mandatorySteps.every((s) => s.completed);
  const allComplete = steps.every((s) => s.completed);
  const completedCount = steps.filter((s) => s.completed).length;

  const shouldShowModal = isOrgOwner && onboardingEnabled && !isLoading && !mandatoryComplete && !!orgId;
  const showInSidebar = isOrgOwner && onboardingEnabled && !isLoading && !allComplete && !!orgId;

  return {
    isLoading,
    isAdmin,
    steps,
    completedSteps,
    mandatoryComplete,
    allComplete,
    completedCount,
    totalCount: steps.length,
    shouldShowModal,
    showInSidebar,
    completeStep,
  };
}
