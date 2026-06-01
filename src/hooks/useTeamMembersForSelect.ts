import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { useAuth } from '@/contexts/AuthContext';

export interface MemberSelectOption {
  id: string;       // user_id / auth.users id
  nome: string;
  email: string;
  url_avatar?: string | null;
  role: string;     // 'owner' | 'admin' | 'comercial' | 'atendente' | 'custom'
}

/**
 * Hook leve para popular selects de "Responsável".
 * Retorna todos os membros da org (da tabela team_member_permissions)
 * + o dono (perfis sem entrada na tabela de permissões).
 */
export function useTeamMembersForSelect(): { members: MemberSelectOption[]; isLoading: boolean } {
  const { profile } = useProfile();
  const { user } = useAuth();
  const orgId = profile?.organization_id;

  // Membros cadastrados (não-donos)
  const { data: permMembers = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['team-members-select-perms', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('team_member_permissions' as any)
        .select('user_id, nome, email, role')
        .eq('organization_id', orgId);
      if (error) throw error;
      return (data || []) as { user_id: string; nome: string; email: string; role: string }[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Avatares dos membros (via perfis)
  const memberIds = permMembers.map(m => m.user_id);
  const { data: perfisData = [], isLoading: loadingPerfis } = useQuery({
    queryKey: ['perfis-avatars', memberIds],
    queryFn: async () => {
      if (!memberIds.length) return [];
      const { data } = await supabase
        .from('perfis')
        .select('id, url_avatar')
        .in('id', memberIds);
      return (data || []) as { id: string; url_avatar: string | null }[];
    },
    enabled: memberIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Dono da org (perfil atual — sem entrada em team_member_permissions)
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile-select', orgId, user?.id],
    queryFn: async () => {
      if (!orgId || !user?.id) return null;
      const { data } = await supabase
        .from('perfis')
        .select('id, nome_completo, url_avatar')
        .eq('organization_id', orgId)
        .eq('id', user.id)
        .maybeSingle();
      return data as { id: string; nome_completo: string | null; url_avatar: string | null } | null;
    },
    enabled: !!orgId && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const avatarMap = Object.fromEntries(perfisData.map(p => [p.id, p.url_avatar]));

  const memberOptions: MemberSelectOption[] = permMembers.map(m => ({
    id: m.user_id,
    nome: m.nome || m.email,
    email: m.email,
    url_avatar: avatarMap[m.user_id] ?? null,
    role: m.role,
  }));

  // Inclui o dono se não estiver na lista de membros
  const ownerAlreadyInList = ownerProfile && memberOptions.some(m => m.id === ownerProfile.id);
  const ownerOption: MemberSelectOption | null =
    ownerProfile && !ownerAlreadyInList
      ? {
          id: ownerProfile.id,
          nome: ownerProfile.nome_completo || user?.email || 'Proprietário',
          email: user?.email || '',
          url_avatar: ownerProfile.url_avatar,
          role: 'owner',
        }
      : null;

  const allMembers = ownerOption ? [ownerOption, ...memberOptions] : memberOptions;

  return {
    members: allMembers,
    isLoading: loadingPerms || loadingPerfis,
  };
}
