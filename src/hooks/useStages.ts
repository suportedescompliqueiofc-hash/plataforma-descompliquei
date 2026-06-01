import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';

export interface Stage {
  id: number;
  nome: string;
  cor: string;
  posicao_ordem: number;
  criado_em: string;
  em_funil?: boolean;
}

// QueryKey padrão - DEVE ser igual em todo o sistema para invalidação funcionar
export const STAGES_QUERY_KEY = ['stages'];

export function useStages() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: stages = [], isLoading } = useQuery({
    queryKey: [...STAGES_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!user || !orgId) return [];

      const { data, error } = await supabase
        .from('etapas')
        .select('*')
        .eq('organization_id', orgId)
        .order('posicao_ordem', { ascending: true });

      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!user && !!orgId,
    staleTime: 0, // Sem cache - sempre busca dados frescos
  });

  return {
    stages,
    isLoading,
  };
}