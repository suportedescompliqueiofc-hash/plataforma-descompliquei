import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useProfile } from "@/hooks/useProfile";

export type AcessoProduto = {
  pilares_liberados: string[];
  ias_liberadas: string[];
  acesso_cerebro: boolean;
  acesso_crm: boolean;
  acesso_arsenal: boolean;
  acesso_sessoes_taticas: boolean;
  acesso_materiais: boolean;
  acesso_ia_comercial: boolean;
  acesso_os: boolean;
  max_leads: number;
  max_usuarios_crm: number;
};

const ACESSO_TOTAL: AcessoProduto = {
  pilares_liberados: [],
  ias_liberadas: [],
  acesso_cerebro: true,
  acesso_crm: true,
  acesso_arsenal: true,
  acesso_sessoes_taticas: true,
  acesso_materiais: true,
  acesso_ia_comercial: true,
  acesso_os: true,
  max_leads: 999999,
  max_usuarios_crm: 999,
};

// Usado quando o usuário não tem registro em platform_tenants — acessa só o CRM
const ACESSO_CRM_ONLY: AcessoProduto = {
  pilares_liberados: [],
  ias_liberadas: [],
  acesso_cerebro: false,
  acesso_crm: true,
  acesso_arsenal: false,
  acesso_sessoes_taticas: false,
  acesso_materiais: false,
  acesso_ia_comercial: false,
  acesso_os: false,
  max_leads: 999999,
  max_usuarios_crm: 999,
};

type PlataformaContextType = {
  plataformaUser: any;
  plan: 'gca' | 'pca' | null;
  progress: any[];
  totalModules: number;
  completedModules: number;
  progressPercent: number;
  isContextLoading: boolean;
  tenant: any | null;
  diasRestantes: number | null;
  acesso: AcessoProduto;
  isMember: boolean;
  hasPlataformaAccess: boolean;
  showOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  setConcluido: () => void;
  markModuleComplete: (moduleId: string) => Promise<void>;
  refreshProgress: () => Promise<void>;
};

const PlataformaContext = createContext<PlataformaContextType | undefined>(undefined);

export function PlataformaProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [plataformaUser, setPlataformaUser] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [totalModules, setTotalModules] = useState(0);
  const [isContextLoading, setIsContextLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [acesso, setAcesso] = useState<AcessoProduto>(ACESSO_TOTAL);

  const refreshProgress = async () => {
    if (!user) return;
    const { data: prog } = await supabase.from('platform_progress').select('*').eq('user_id', user.id);
    if (prog) setProgress(prog);
  };

  const { role, profile } = useProfile();
  const roleRef = useRef(role);
  roleRef.current = role;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setPlataformaUser(null);
      setTenant(null);
      setAcesso(ACESSO_CRM_ONLY);
      setDiasRestantes(null);
      setIsContextLoading(false);
      return;
    }

    async function loadPlatformData() {
      setIsContextLoading(true);
      try {
        // Load user — filtrar explicitamente pelo id do usuário logado
        let { data: pUser, error: userError } = await supabase
          .from('platform_users')
          .select('*')
          .eq('id', user!.id)
          .maybeSingle();

        // Só cria se realmente não existe (sem erro de RLS)
        if (!pUser && !userError) {
          const { data: newUser, error } = await supabase.from('platform_users').insert({
            id: user!.id,
            plan: 'pca',
            crm_user_id: user!.id
          }).select().single();
          if (!error && newUser) pUser = newUser;
        }
        setPlataformaUser(pUser);

        // Carrega tenant + acesso via RPC (SECURITY DEFINER — ignora RLS cross-table)
        // ⚠️ Deve ser feito ANTES do redirect check para saber se a org já está configurada
        const { data: platformAccess } = await supabase.rpc('get_my_platform_access');

        const tenantData = platformAccess?.tenant ?? null;
        const acessoData = platformAccess?.acesso ?? null;

        setTenant(tenantData);

        // Onboarding é mostrado via modal no Hub — não bloqueia nem redireciona aqui.
        // A flag onboarding_complete é marcada pelo próprio modal quando o usuário conclui.

        if (!tenantData) {
          // Sem registro na plataforma → apenas CRM
          setAcesso(ACESSO_CRM_ONLY);
        } else if (acessoData) {
          // Produto vinculado → usa permissões retornadas
          setAcesso({
            pilares_liberados: acessoData.pilares_liberados ?? [],
            ias_liberadas: acessoData.ias_liberadas ?? [],
            acesso_cerebro: acessoData.acesso_cerebro ?? false,
            acesso_crm: acessoData.acesso_crm ?? false,
            acesso_arsenal: acessoData.acesso_arsenal ?? false,
            acesso_sessoes_taticas: acessoData.acesso_sessoes_taticas ?? false,
            acesso_materiais: acessoData.acesso_materiais ?? false,
            acesso_ia_comercial: acessoData.acesso_ia_comercial ?? false,
            acesso_os: acessoData.acesso_os ?? false,
            max_leads: acessoData.max_leads ?? 999999,
            max_usuarios_crm: acessoData.max_usuarios_crm ?? 999,
          });
        } else {
          // Tenant existe mas sem produto atribuído → acesso total
          setAcesso(ACESSO_TOTAL);
        }

        // Superadmin sempre tem acesso total a tudo
        if (roleRef.current === 'superadmin') {
          const { data: allPilares } = await supabase
            .from('platform_modules')
            .select('pilar_id')
            .eq('active', true);
          const uniquePilares = [...new Set((allPilares || []).map((m: any) => m.pilar_id).filter(Boolean))];
          setAcesso({
            ...ACESSO_TOTAL,
            pilares_liberados: uniquePilares,
            ias_liberadas: ['preattendance', 'objections', 'remarketing', 'analysis', 'copywriter', 'scripts', 'strategy', 'reporting', 'followup'],
          });
        }

        if (tenantData?.trial_ends_at) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const trialEnd = new Date(tenantData.trial_ends_at);
          trialEnd.setHours(0, 0, 0, 0);
          const dias = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          setDiasRestantes(dias);
        } else {
          setDiasRestantes(null);
        }

        // ── Detectar se é membro da equipe (não dono) ────────────────────────
        // Consulta direta ao banco — profileRef pode ainda estar vazio pois
        // useProfile usa TanStack Query (assíncrono) e pode não ter carregado
        // quando este efeito roda pela primeira vez.
        const { data: perfil } = await supabase
          .from('perfis')
          .select('organization_id')
          .eq('id', user!.id)
          .maybeSingle();
        const orgId = perfil?.organization_id ?? profileRef.current?.organization_id;
        let isTeamMember = false;

        if (orgId) {
          const { data: memberEntry } = await supabase
            .from('team_member_permissions')
            .select('user_id')
            .eq('user_id', user!.id)
            .eq('organization_id', orgId)
            .maybeSingle();

          isTeamMember = !!memberEntry;

          if (isTeamMember) {
            // Membros não acessam Materiais
            setAcesso(prev => ({ ...prev, acesso_materiais: false }));
          }
        }

        setIsMember(isTeamMember);

        const { count: modulesCount } = await supabase
          .from('platform_modules')
          .select('id', { count: 'exact', head: true })
          .eq('active', true);

        setTotalModules(modulesCount || 0);
        await refreshProgress();
      } catch (err) {
        console.error('PlataformaContext load error:', err);
      } finally {
        setIsContextLoading(false);
      }
    }

    loadPlatformData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const completeOnboarding = async () => {
    if (!user) return;
    await supabase.from('platform_users').update({ onboarding_complete: true }).eq('id', user.id);
    setPlataformaUser((prev: any) => prev ? { ...prev, onboarding_complete: true } : prev);
  };

  const setConcluido = () => {
    setPlataformaUser((prev: any) => prev ? { ...prev, onboarding_concluido: true } : prev);
  };

  const markModuleComplete = async (moduleId: string) => {
    if (!user) return;
    const existing = progress.find(p => p.module_id === moduleId);
    if (existing) {
      await supabase.from('platform_progress').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('platform_progress').insert({
        user_id: user.id,
        module_id: moduleId,
        completed: true,
        completed_at: new Date().toISOString()
      });
    }
    await refreshProgress();
  };

  const completedModules = progress.filter(p => p.completed).length;
  const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const hasPlataformaAccess = acesso.acesso_arsenal || acesso.acesso_os ||
    acesso.acesso_sessoes_taticas || acesso.acesso_materiais;

  return (
    <PlataformaContext.Provider value={{
      plataformaUser,
      plan: plataformaUser?.plan || null,
      progress,
      totalModules,
      completedModules,
      progressPercent,
      isContextLoading,
      tenant,
      diasRestantes,
      acesso,
      isMember,
      hasPlataformaAccess,
      showOnboarding: hasPlataformaAccess && plataformaUser?.platform_onboarding_enabled === true && plataformaUser?.onboarding_complete === false && plataformaUser?.onboarding_concluido === true && !isContextLoading,
      completeOnboarding,
      setConcluido,
      markModuleComplete,
      refreshProgress
    }}>
      {children}
    </PlataformaContext.Provider>
  );
}

export function usePlataforma() {
  const context = useContext(PlataformaContext);
  if (context === undefined) throw new Error("usePlataforma must be used within a PlataformaProvider");
  return context;
}
