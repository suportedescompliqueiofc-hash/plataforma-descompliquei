import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KbCategoria {
  id: string;
  nome: string;
  icone: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export interface KbArtigo {
  id: string;
  categoria_id: string | null;
  titulo: string;
  conteudo: string;
  tags: string[];
  ativo: boolean;
  visualizacoes: number;
  created_at: string;
  updated_at: string;
  kb_categorias?: KbCategoria | null;
}

// ── Client hooks ──────────────────────────────────────────────────────────────

export function useKbCategorias() {
  return useQuery({
    queryKey: ['kb_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kb_categorias')
        .select('*')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return data as KbCategoria[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useKbArtigos(categoriaId?: string) {
  return useQuery({
    queryKey: ['kb_artigos', categoriaId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('kb_artigos')
        .select('*, kb_categorias(id, nome, icone)')
        .eq('ativo', true)
        .order('created_at', { ascending: false });
      if (categoriaId) query = query.eq('categoria_id', categoriaId);
      const { data, error } = await query;
      if (error) throw error;
      return data as KbArtigo[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Admin hooks ───────────────────────────────────────────────────────────────

export function useAdminKbCategorias() {
  return useQuery({
    queryKey: ['admin_kb_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kb_categorias')
        .select('*')
        .order('ordem');
      if (error) throw error;
      return data as KbCategoria[];
    },
  });
}

export function useAdminKbArtigos() {
  return useQuery({
    queryKey: ['admin_kb_artigos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kb_artigos')
        .select('*, kb_categorias(id, nome, icone)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as KbArtigo[];
    },
  });
}

export function useSalvarArtigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (artigo: Partial<KbArtigo> & { id?: string }) => {
      const { id, kb_categorias: _cat, ...payload } = artigo as any;
      if (id) {
        const { error } = await supabase
          .from('kb_artigos')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kb_artigos').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_kb_artigos'] });
      qc.invalidateQueries({ queryKey: ['kb_artigos'] });
    },
  });
}

export function useToggleArtigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('kb_artigos').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_kb_artigos'] });
      qc.invalidateQueries({ queryKey: ['kb_artigos'] });
    },
  });
}

export function useExcluirArtigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kb_artigos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_kb_artigos'] });
      qc.invalidateQueries({ queryKey: ['kb_artigos'] });
    },
  });
}

export function useSalvarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Partial<KbCategoria> & { id?: string }) => {
      const { id, ...payload } = cat;
      if (id) {
        const { error } = await supabase.from('kb_categorias').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kb_categorias').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_kb_categorias'] });
      qc.invalidateQueries({ queryKey: ['kb_categorias'] });
    },
  });
}
