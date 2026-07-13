import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CategoriaKey } from '@/lib/atualizacoesAreas';

export interface AdminAtualizacao {
  id: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaKey;
  areas: string[];
  rota_destino: string | null;
  tutorial_alvo: string | null;
  publicado: boolean;
  publicado_em: string;
  criado_em: string;
}

export type AtualizacaoForm = {
  titulo: string;
  descricao: string;
  categoria: CategoriaKey;
  areas: string[];
  rota_destino: string;
  tutorial_alvo: string;
  publicado: boolean;
  publicado_em: string;
};

const QUERY_KEY = ['admin_atualizacoes'];

export function useAdminAtualizacoesList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atualizacoes' as any)
        .select('*')
        .order('publicado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminAtualizacao[];
    },
    staleTime: 0,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUERY_KEY });
  qc.invalidateQueries({ queryKey: ['atualizacoes'] });
}

export function useCreateAtualizacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: AtualizacaoForm) => {
      const { error } = await supabase.from('atualizacoes' as any).insert({
        titulo: form.titulo,
        descricao: form.descricao,
        categoria: form.categoria,
        areas: form.areas,
        rota_destino: form.rota_destino || null,
        tutorial_alvo: form.tutorial_alvo || null,
        publicado: form.publicado,
        publicado_em: form.publicado_em,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateAtualizacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, form }: { id: string; form: AtualizacaoForm }) => {
      const { error } = await supabase.from('atualizacoes' as any).update({
        titulo: form.titulo,
        descricao: form.descricao,
        categoria: form.categoria,
        areas: form.areas,
        rota_destino: form.rota_destino || null,
        tutorial_alvo: form.tutorial_alvo || null,
        publicado: form.publicado,
        publicado_em: form.publicado_em,
        atualizado_em: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteAtualizacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('atualizacoes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useToggleAtualizacaoPublicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, publicado }: { id: string; publicado: boolean }) => {
      const { error } = await supabase.from('atualizacoes' as any).update({ publicado }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

// Reseta o "último visto" de todo mundo — faz o popup de novidades e o badge
// da sidebar reaparecerem pra todas as orgs, mesmo pra quem já tinha dispensado.
export function useResendAtualizacoes() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_resend_atualizacoes' as any);
      if (error) throw error;
      return data as number;
    },
  });
}
