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
  optional?: boolean;       // exibe badge "(Opcional)" — passos não obrigatórios
  path?: string;            // rota de destino
  tutorialId?: string;      // id do tutorial que guia na página
  ctaLabel: string;
  completed?: boolean;      // injetado em runtime
}

// ─── Definição dos passos ─────────────────────────────────────────────────────

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'senha',
    title: 'Crie sua senha de acesso',
    description: 'Defina uma senha para acessar o CRM sem depender do link de e-mail.',
    icon: 'KeyRound',
    mandatory: true,
    ctaLabel: 'Criar senha',
    // Sem path/tutorialId — tratado inline no modal com formulário embutido
  },
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
    key: 'whatsapp',
    title: 'Conecte seu WhatsApp',
    description: 'Vincule seu número para receber e enviar mensagens diretamente pelo CRM. Você só precisa escanear um QR Code — sem instalar nada.',
    icon: 'Smartphone',
    mandatory: true,
    path: '/crm/settings?section=whatsapp',
    ctaLabel: 'Conectar WhatsApp',
  },
  {
    key: 'ia',
    title: 'Configure a Inteligência Artificial',
    description: 'Defina a identidade do assistente, procedimentos e horários de atendimento automático.',
    icon: 'Bot',
    mandatory: true,
    path: '/crm/ia',
    tutorialId: 'ia',
    ctaLabel: 'Configurar IA',
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
    key: 'equipe',
    title: 'Adicione membros da equipe',
    description: 'Convide colaboradores e defina as permissões de acesso de cada um.',
    icon: 'Users',
    mandatory: false,
    optional: true,
    path: '/crm/settings?section=team',
    tutorialId: 'onboarding-equipe',
    ctaLabel: 'Adicionar membros',
  },
  {
    key: 'suporte',
    title: 'Conheça a Central de Suporte',
    description: 'Abra tickets, acompanhe suas solicitações e acesse a base de conhecimento com artigos e tutoriais.',
    icon: 'LifeBuoy',
    mandatory: true,
    path: '/crm/settings?section=suporte',
    tutorialId: 'onboarding-suporte',
    ctaLabel: 'Abrir Central de Suporte',
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
      // Read fresh state from DB to avoid stale-closure race when multiple steps
      // are completed in quick succession (each mutation must see prior writes).
      const { data: fresh, error: readErr } = await supabase
        .from('organizations')
        .select('onboarding_completed_steps')
        .eq('id', orgId)
        .single();
      if (readErr) throw readErr;
      const current = (fresh?.onboarding_completed_steps ?? []) as string[];
      const newSteps = [...new Set([...current, stepKey])];
      const { error } = await supabase
        .from('organizations')
        .update({ onboarding_completed_steps: newSteps } as any)
        .eq('id', orgId);
      if (error) throw error;
      return newSteps;
    },
    onSuccess: (newSteps) => {
      // Optimistic cache update prevents the modal from flashing back to stale state
      queryClient.setQueryData(['onboarding', orgId], (old: any) =>
        old ? { ...old, onboarding_completed_steps: newSteps } : old,
      );
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
