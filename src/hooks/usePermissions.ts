import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';

export type PageKey =
  | 'painel' | 'conversas' | 'notificacoes' | 'leads' | 'pipeline'
  | 'agendamentos' | 'vendas' | 'procedimentos' | 'metas'
  | 'msgs_rapidas' | 'cadencias' | 'ia' | 'configuracoes' | 'plataforma';

export interface UserPermissions {
  isOwner: boolean;
  role: string;
  pages: Record<PageKey, boolean>;
  readOnly: Record<string, boolean>;
  canAccess: (page: PageKey) => boolean;
  isReadOnly: (page: PageKey) => boolean;
  isLoaded: boolean;
}

const ALL_ACCESS: Record<PageKey, boolean> = {
  painel: true, conversas: true, notificacoes: true, leads: true, pipeline: true,
  agendamentos: true, vendas: true, procedimentos: true, metas: true,
  msgs_rapidas: true, cadencias: true, ia: true, configuracoes: true, plataforma: true,
};

export function usePermissions(): UserPermissions {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: permData, isLoading } = useQuery({
    queryKey: ['user-permissions', user?.id, orgId],
    queryFn: async () => {
      if (!user?.id || !orgId) return null;
      const { data } = await supabase
        .from('team_member_permissions' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id && !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Sem entrada = dono da org = acesso total
  if (!isLoading && !permData) {
    return {
      isOwner: true,
      role: 'owner',
      pages: ALL_ACCESS,
      readOnly: {},
      canAccess: () => true,
      isReadOnly: () => false,
      isLoaded: true,
    };
  }

  const pages = (permData?.pages as Record<PageKey, boolean>) || ALL_ACCESS;
  const readOnly = (permData?.read_only as Record<string, boolean>) || {};

  return {
    isOwner: false,
    role: permData?.role ?? 'atendente',
    pages,
    readOnly,
    canAccess: (page) => pages[page] ?? false,
    isReadOnly: (page) => readOnly[page] ?? false,
    isLoaded: !isLoading,
  };
}
