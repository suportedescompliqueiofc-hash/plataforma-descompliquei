import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

export interface OutboundHistorico {
  id: string;
  organization_id: string;
  prospecto_id: string;
  usuario_id: string | null;
  tipo: string;
  campo_alterado: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  descricao: string | null;
  metadados: any;
  criado_em: string;
  perfil_nome?: string;
}

export function useOutboundHistorico(prospectoId: string | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ['outbound_historico', prospectoId],
    queryFn: async () => {
      if (!prospectoId) return [];
      const { data, error } = await (supabase as any)
        .from('outbound_historico')
        .select(`
          *,
          perfis:usuario_id ( nome_completo )
        `)
        .eq('prospecto_id', prospectoId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data || []).map((h: any) => ({
        ...h,
        perfil_nome: h.perfis?.nome_completo || null,
      })) as OutboundHistorico[];
    },
    enabled: !!prospectoId && !!orgId,
  });

  return { historico, isLoading };
}
