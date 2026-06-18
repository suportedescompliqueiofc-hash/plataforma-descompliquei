import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AulaStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

export interface ArsenalBloco {
  id: string;
  nome: string;
  descricao: string | null;
  slug: string;
  ordem: number;
  tipo: 'aulas' | 'ferramentas';
}

export interface ArsenalAula {
  id: string;
  bloco_id: string;
  nome: string;
  descricao: string | null;
  slug: string;
  ordem: number;
  video_url: string | null;
  texto_aprenda: string | null;
  ativo: boolean;
}

// ─── Shared: all user progresso (cache key shared across hooks) ───────────────

function useProgressoAulasGlobal(userId?: string) {
  return useQuery({
    queryKey: ['arsenal-aulas-progresso', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_aulas_progresso' as any)
        .select('aula_id, status, anotacoes')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []) as { aula_id: string; status: AulaStatus; anotacoes: string | null }[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Hub: blocos + aulas + progresso (used in Arsenal.tsx) ───────────────────

export function useArsenalAulasHub() {
  const { user } = useAuth();

  const blocosQ = useQuery({
    queryKey: ['arsenal-blocos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_blocos' as any)
        .select('*')
        .eq('tipo', 'aulas')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalBloco[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const aulasQ = useQuery({
    queryKey: ['arsenal-aulas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_aulas' as any)
        .select('*')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalAula[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const progressoQ = useProgressoAulasGlobal(user?.id);

  const blocos = blocosQ.data ?? [];
  const aulas = aulasQ.data ?? [];
  const progresso = progressoQ.data ?? [];
  const progressoMap = new Map(progresso.map(p => [p.aula_id, p.status]));

  const totalConcluidas = progresso.filter(p => p.status === 'concluido').length;
  const totalAulas = aulas.length;

  const blocosComAulas = blocos.map(bloco => {
    const aulasBloco = aulas
      .filter(a => a.bloco_id === bloco.id)
      .map(a => ({ ...a, status: (progressoMap.get(a.id) ?? 'nao_iniciado') as AulaStatus }));
    const concluidas = aulasBloco.filter(a => a.status === 'concluido').length;
    return { ...bloco, aulas: aulasBloco, concluidas };
  });

  return {
    blocosComAulas,
    totalConcluidas,
    totalAulas,
    isLoading: blocosQ.isLoading || aulasQ.isLoading,
  };
}

// ─── Detalhe de aula (used in ArsenalAula.tsx) ───────────────────────────────

export function useArsenalAulaDetalhe(slug: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const aulaQ = useQuery({
    queryKey: ['arsenal-aula', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_aulas' as any)
        .select('*, arsenal_blocos(*)')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      return data as ArsenalAula & { arsenal_blocos: ArsenalBloco };
    },
    enabled: !!slug,
  });

  const blocoId = aulaQ.data?.bloco_id;
  const aulaId = aulaQ.data?.id;

  const aulasIrmasQ = useQuery({
    queryKey: ['arsenal-aulas-bloco', blocoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_aulas' as any)
        .select('id, nome, slug, ordem')
        .eq('bloco_id', blocoId!)
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as Pick<ArsenalAula, 'id' | 'nome' | 'slug' | 'ordem'>[];
    },
    enabled: !!blocoId,
  });

  const progressoQ = useProgressoAulasGlobal(user?.id);

  const progressoMap = new Map((progressoQ.data ?? []).map(p => [p.aula_id, p]));
  const meuProgresso = aulaId ? progressoMap.get(aulaId) : undefined;

  const aulasIrmas = (aulasIrmasQ.data ?? []).map(a => ({
    ...a,
    status: (progressoMap.get(a.id)?.status ?? 'nao_iniciado') as AulaStatus,
  }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['arsenal-aulas-progresso', user?.id] });
  };

  const marcarEmAndamento = useMutation({
    mutationFn: async () => {
      if (!user?.id || !aulaId) return;
      const status = meuProgresso?.status;
      if (status && status !== 'nao_iniciado') return;
      const { error } = await supabase
        .from('arsenal_aulas_progresso' as any)
        .upsert(
          { user_id: user.id, aula_id: aulaId, status: 'em_andamento', updated_at: new Date().toISOString() },
          { onConflict: 'user_id,aula_id' }
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const salvarAnotacoes = useMutation({
    mutationFn: async (anotacoes: string) => {
      if (!user?.id || !aulaId) throw new Error('Dados insuficientes');
      const { error } = await supabase
        .from('arsenal_aulas_progresso' as any)
        .upsert(
          {
            user_id: user.id,
            aula_id: aulaId,
            status: 'concluido',
            anotacoes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,aula_id' }
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    aula: aulaQ.data,
    bloco: aulaQ.data?.arsenal_blocos,
    status: (meuProgresso?.status ?? 'nao_iniciado') as AulaStatus,
    anotacoes: meuProgresso?.anotacoes ?? '',
    aulasIrmas,
    isLoading: aulaQ.isLoading,
    marcarEmAndamento,
    salvarAnotacoes,
  };
}
