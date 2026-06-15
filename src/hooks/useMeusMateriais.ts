import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MeuMaterial {
  id: string;
  user_id: string;
  titulo: string;
  conteudo: string;
  categoria_arsenal_id: string | null;
  ferramenta_id: string | null;
  criado_manualmente: boolean;
  categoria?: string | null;
  created_at: string;
  updated_at: string;
  arsenal_categorias?: { nome: string; slug: string } | null;
  arsenal_ferramentas?: { nome: string } | null;
}

const TABLE = 'meus_materiais' as any;

export function useMeusMateriais() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['meus-materiais', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*, categoria, arsenal_categorias(nome, slug), arsenal_ferramentas(nome)')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MeuMaterial[];
    },
    enabled: !!user?.id,
  });
}

export function useDocumento(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['meu-material', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*, categoria, arsenal_categorias(nome, slug), arsenal_ferramentas(nome)')
        .eq('id', id!)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as MeuMaterial;
    },
    enabled: !!id && !!user?.id,
    staleTime: 0,
  });
}

export function useCreateDocumento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (init?: {
      titulo?: string;
      conteudo?: string;
      ferramenta_id?: string;
      categoria_arsenal_id?: string;
    }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          user_id: user!.id,
          titulo: init?.titulo ?? 'Sem título',
          conteudo: init?.conteudo ?? '',
          ferramenta_id: init?.ferramenta_id ?? null,
          categoria_arsenal_id: init?.categoria_arsenal_id ?? null,
          criado_manualmente: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meus-materiais'] }),
  });
}

export function useUpdateDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, titulo, conteudo }: { id: string; titulo: string; conteudo: string }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ titulo, conteudo, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['meus-materiais'] });
      qc.invalidateQueries({ queryKey: ['meu-material', id] });
    },
  });
}

export function useAssociarFerramenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ferramenta_id, categoria_arsenal_id }: {
      id: string;
      ferramenta_id: string | null;
      categoria_arsenal_id: string | null;
    }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ ferramenta_id, categoria_arsenal_id, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['meus-materiais'] });
      qc.invalidateQueries({ queryKey: ['meu-material', id] });
    },
  });
}

export function useDeleteDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meus-materiais'] }),
  });
}

// Upsert do documento de diagnóstico (categoria fixa) — chamado pelo onboarding
export async function upsertDiagnostico({
  userId, titulo, conteudo,
}: {
  userId: string;
  titulo: string;
  conteudo: string;
}) {
  const { data: existing } = await supabase
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('categoria', 'diagnostico')
    .maybeSingle();

  if (existing) {
    await supabase
      .from(TABLE)
      .update({ titulo, conteudo, updated_at: new Date().toISOString() })
      .eq('id', (existing as any).id);
    return (existing as any).id as string;
  } else {
    const { data } = await supabase
      .from(TABLE)
      .insert({
        user_id: userId,
        titulo,
        conteudo,
        categoria: 'diagnostico',
        criado_manualmente: false,
      })
      .select('id')
      .single();
    return (data as any).id as string;
  }
}

// Called by Arsenal when user saves a construção
export async function upsertFromArsenal({
  userId, ferramentaId, categoriaId, titulo, conteudo,
}: {
  userId: string;
  ferramentaId: string;
  categoriaId: string | null;
  titulo: string;
  conteudo: string;
}) {
  const html = conteudo
    .split('\n')
    .map(l => `<p>${l || '<br>'}</p>`)
    .join('');

  const { data: existing } = await supabase
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('ferramenta_id', ferramentaId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from(TABLE)
      .update({ titulo, conteudo: html, updated_at: new Date().toISOString() })
      .eq('id', (existing as any).id);
  } else {
    await supabase.from(TABLE).insert({
      user_id: userId,
      titulo,
      conteudo: html,
      categoria_arsenal_id: categoriaId,
      ferramenta_id: ferramentaId,
      criado_manualmente: false,
    });
  }
}
