import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { AREA_OPTIONS, type CategoriaKey } from '@/lib/atualizacoesAreas';
import type { AcessoProduto } from '@/contexts/PlataformaContext';

export interface Atualizacao {
  id: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaKey;
  areas: string[];
  rota_destino: string | null;
  tutorial_alvo: string | null;
  publicado: boolean;
  publicado_em: string;
}

function areaVisivel(areas: string[], acesso: AcessoProduto): boolean {
  if (!areas || areas.length === 0) return true;
  return areas.some(area => {
    const opt = AREA_OPTIONS.find(o => o.key === area);
    if (!opt) return false;
    return !!acesso[opt.acessoKey as keyof AcessoProduto];
  });
}

export function useAtualizacoes() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { acesso } = usePlataforma();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['atualizacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atualizacoes' as any)
        .select('*')
        .eq('publicado', true)
        .order('publicado_em', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Atualizacao[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const itens = (data || []).filter(item => areaVisivel(item.areas, acesso));

  const lastSeen = profile?.last_seen_atualizacao_em ? new Date(profile.last_seen_atualizacao_em) : null;
  const itensNaoVistos = lastSeen ? itens.filter(item => new Date(item.publicado_em) > lastSeen) : itens;

  const marcarVistas = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('perfis')
        .update({ last_seen_atualizacao_em: new Date().toISOString() } as any)
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  return {
    itens,
    itensNaoVistos,
    naoVistosCount: itensNaoVistos.length,
    isLoading,
    marcarVistas: marcarVistas.mutate,
  };
}
