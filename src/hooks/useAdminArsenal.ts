import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toSlug(str: string) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Categorias ───────────────────────────────────────────────────────────────

export interface AdminCategoria {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  cor?: string | null;
}

export function useAdminCategorias() {
  return useQuery({
    queryKey: ['admin-arsenal-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_categorias' as any)
        .select('id, nome, slug, ordem, cor')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as AdminCategoria[];
    },
    staleTime: 0,
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { nome: string; slug: string; ordem?: number; cor?: string | null }) => {
      const { error } = await supabase.from('arsenal_categorias' as any).insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-categorias'] });
      qc.invalidateQueries({ queryKey: ['admin-arsenal-ferramentas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-categorias'] });
    },
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('arsenal_categorias' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-categorias'] });
      qc.invalidateQueries({ queryKey: ['admin-arsenal-ferramentas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-categorias'] });
    },
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('arsenal_categorias' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-categorias'] });
      qc.invalidateQueries({ queryKey: ['admin-arsenal-ferramentas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-categorias'] });
    },
  });
}

// ─── Ferramentas ──────────────────────────────────────────────────────────────

export interface AdminFerramenta {
  id: string;
  nome: string;
  descricao: string;
  slug: string;
  ordem: number;
  ativo: boolean;
  video_url: string | null;
  texto_aprenda: string | null;
  template_construa: string | null;
  categoria_id: string;
  arsenal_categorias: { id: string; nome: string; slug: string; ordem: number };
}

export function useAdminFerramentas() {
  return useQuery({
    queryKey: ['admin-arsenal-ferramentas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_ferramentas' as any)
        .select('*, arsenal_categorias(id, nome, slug, ordem)')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as AdminFerramenta[];
    },
    staleTime: 0,
  });
}

export function useCreateFerramenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      nome: string; slug: string; descricao?: string; categoria_id: string;
      ordem?: number; ativo?: boolean; video_url?: string; texto_aprenda?: string; template_construa?: string;
    }) => {
      const { error } = await supabase.from('arsenal_ferramentas' as any).insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-ferramentas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-ferramentas-cat'] });
      qc.invalidateQueries({ queryKey: ['arsenal-ferramentas-cat-id'] });
    },
  });
}

export function useUpdateFerramenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from('arsenal_ferramentas' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-ferramentas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-ferramenta'] });
      qc.invalidateQueries({ queryKey: ['arsenal-ferramentas-cat'] });
      qc.invalidateQueries({ queryKey: ['arsenal-ferramentas-cat-id'] });
    },
  });
}

export function useDeleteFerramenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('arsenal_ferramentas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-ferramentas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-ferramentas-cat'] });
      qc.invalidateQueries({ queryKey: ['arsenal-ferramentas-cat-id'] });
    },
  });
}

// ─── Materiais ────────────────────────────────────────────────────────────────

export interface AdminArsenalMaterial {
  id: string;
  ferramenta_id: string;
  titulo: string;
  tipo: 'pdf' | 'html';
  pdf_url: string | null;
  conteudo_html: string | null;
  ordem: number;
  ativo: boolean;
  arsenal_ferramentas: {
    id: string; nome: string;
    arsenal_categorias: { nome: string; slug: string };
  };
}

export function useAdminArsenalMateriais() {
  return useQuery({
    queryKey: ['admin-arsenal-materiais-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_materiais' as any)
        .select('*, arsenal_ferramentas(id, nome, arsenal_categorias(nome, slug))')
        .order('ferramenta_id')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as AdminArsenalMaterial[];
    },
    staleTime: 0,
  });
}

export function useCreateArsenalMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Omit<AdminArsenalMaterial, 'id' | 'arsenal_ferramentas'>) => {
      const { error } = await supabase.from('arsenal_materiais' as any).insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-materiais-all'] });
      qc.invalidateQueries({ queryKey: ['arsenal-materiais'] });
    },
  });
}

export function useUpdateArsenalMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('arsenal_materiais' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-materiais-all'] });
      qc.invalidateQueries({ queryKey: ['arsenal-materiais'] });
    },
  });
}

export function useDeleteArsenalMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('arsenal_materiais' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-materiais-all'] });
      qc.invalidateQueries({ queryKey: ['arsenal-materiais'] });
    },
  });
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface AdminArsenalTemplate {
  id: string;
  titulo: string;
  descricao: string | null;
  conteudo: string;
  ferramenta_id: string;
  categoria_arsenal_id: string;
  ordem: number;
  ativo: boolean;
  arsenal_ferramentas: {
    id: string; nome: string;
    arsenal_categorias: { id: string; nome: string; slug: string };
  };
  arsenal_categorias: { id: string; nome: string; slug: string };
}

export function useAdminArsenalTemplates() {
  return useQuery({
    queryKey: ['admin-arsenal-templates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_templates' as any)
        .select('*, arsenal_ferramentas(id, nome, arsenal_categorias(id, nome, slug)), arsenal_categorias(id, nome, slug)')
        .order('ferramenta_id')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as AdminArsenalTemplate[];
    },
    staleTime: 0,
  });
}

export function useCreateArsenalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      titulo: string; descricao?: string; conteudo: string;
      ferramenta_id: string; categoria_arsenal_id: string; ordem?: number;
    }) => {
      const { error } = await supabase.from('arsenal_templates' as any).insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-templates-list'] });
      qc.invalidateQueries({ queryKey: ['arsenal-templates-all'] });
      qc.invalidateQueries({ queryKey: ['arsenal-templates'] });
    },
  });
}

export function useUpdateArsenalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('arsenal_templates' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-templates-list'] });
      qc.invalidateQueries({ queryKey: ['arsenal-templates-all'] });
      qc.invalidateQueries({ queryKey: ['arsenal-templates'] });
    },
  });
}

export function useDeleteArsenalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('arsenal_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-templates-list'] });
      qc.invalidateQueries({ queryKey: ['arsenal-templates-all'] });
      qc.invalidateQueries({ queryKey: ['arsenal-templates'] });
    },
  });
}

// ─── Blocos de Aulas ──────────────────────────────────────────────────────────

export interface AdminBloco {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  tipo: string;
}

export function useAdminBlocos() {
  return useQuery({
    queryKey: ['admin-arsenal-blocos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_blocos' as any)
        .select('id, nome, slug, ordem, tipo')
        .eq('tipo', 'aulas')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as AdminBloco[];
    },
    staleTime: 0,
  });
}

export function useCreateBloco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { nome: string; slug: string; descricao?: string; ordem: number }) => {
      const { error } = await supabase.from('arsenal_blocos' as any).insert({ ...p, tipo: 'aulas' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-blocos'] });
      qc.invalidateQueries({ queryKey: ['arsenal-blocos'] });
    },
  });
}

export function useUpdateBloco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('arsenal_blocos' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-blocos'] });
      qc.invalidateQueries({ queryKey: ['arsenal-blocos'] });
    },
  });
}

export function useDeleteBloco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('arsenal_blocos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-blocos'] });
      qc.invalidateQueries({ queryKey: ['arsenal-blocos'] });
    },
  });
}

// ─── Aulas ────────────────────────────────────────────────────────────────────

export interface AdminAula {
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

export function useAdminAulas() {
  return useQuery({
    queryKey: ['admin-arsenal-aulas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_aulas' as any)
        .select('id, bloco_id, nome, descricao, slug, ordem, video_url, texto_aprenda, ativo')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as AdminAula[];
    },
    staleTime: 0,
  });
}

export function useCreateAula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Omit<AdminAula, 'id'>) => {
      const { error } = await supabase.from('arsenal_aulas' as any).insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-aulas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-aulas'] });
    },
  });
}

export function useUpdateAula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('arsenal_aulas' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-aulas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-aulas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-aula'] });
    },
  });
}

export function useDeleteAula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('arsenal_aulas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-arsenal-aulas'] });
      qc.invalidateQueries({ queryKey: ['arsenal-aulas'] });
    },
  });
}
