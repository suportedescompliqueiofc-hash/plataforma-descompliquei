import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

export interface CadenciaOption {
  id: string;
  nome: string;
}

/**
 * Cadências da org (pra popular filtro) + o mapa lead_id -> ids de cadência em
 * que ele está matriculado (qualquer status), pra filtrar a lista de leads por
 * cadência sem precisar de uma tela nova.
 */
export function useLeadCadencias() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: cadencias = [], isLoading: isLoadingCadencias } = useQuery({
    queryKey: ['cadencias_lista', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('cadencias')
        .select('id, nome')
        .eq('organization_id', orgId)
        .order('nome');
      if (error) throw error;
      return data as CadenciaOption[];
    },
    enabled: !!orgId,
    staleTime: Infinity,
  });

  const { data: leadCadenciaMap = {}, isLoading: isLoadingMap } = useQuery({
    queryKey: ['lead_cadencias_mapa', orgId],
    queryFn: async () => {
      if (!orgId) return {};
      const { data, error } = await supabase
        .from('lead_cadencias')
        .select('lead_id, cadencia_id')
        .eq('organization_id', orgId);
      if (error) throw error;

      const mapa: Record<string, Set<string>> = {};
      for (const row of data ?? []) {
        if (!mapa[row.lead_id]) mapa[row.lead_id] = new Set();
        mapa[row.lead_id].add(row.cadencia_id);
      }
      return mapa;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return { cadencias, leadCadenciaMap, isLoading: isLoadingCadencias || isLoadingMap };
}
