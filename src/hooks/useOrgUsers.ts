import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

export interface OrgUser {
  id: string;
  nome_completo: string | null;
  email?: string;
}

export function useOrgUsers() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['org_users', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome_completo')
        .eq('organization_id', orgId)
        .order('nome_completo', { ascending: true });
      if (error) throw error;
      return data as OrgUser[];
    },
    enabled: !!orgId,
  });

  return { users, isLoading };
}
