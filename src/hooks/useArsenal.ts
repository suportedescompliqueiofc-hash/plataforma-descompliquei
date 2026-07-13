import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { upsertFromArsenal } from './useMeusMateriais';

export type ArsenalStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

export interface ArsenalCategoria {
  id: string;
  nome: string;
  descricao: string;
  frase_ancora: string;
  icone: string;
  ordem: number;
  slug: string;
}

export interface ArsenalFerramenta {
  id: string;
  categoria_id: string;
  nome: string;
  descricao: string;
  slug: string;
  ordem: number;
  video_url: string | null;
  diagrama_json: Record<string, unknown> | null;
  texto_aprenda: string | null;
  template_construa: string | null;
  ativo: boolean;
}

// ─── Progresso global do usuário (cacheado, compartilhado entre hooks) ────────

function useProgressoGlobal(userId?: string) {
  return useQuery({
    queryKey: ['arsenal-progresso', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_progresso' as any)
        .select('ferramenta_id, status')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []) as { ferramenta_id: string; status: ArsenalStatus }[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Hub: categorias + contagens + progresso ─────────────────────────────────

export function useArsenalHub() {
  const { user } = useAuth();

  const categoriasQ = useQuery({
    queryKey: ['arsenal-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_categorias' as any)
        .select('*')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalCategoria[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const ferrAllQ = useQuery({
    queryKey: ['arsenal-ferramentas-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_ferramentas' as any)
        .select('id, categoria_id')
        .eq('ativo', true);
      if (error) throw error;
      return (data ?? []) as { id: string; categoria_id: string }[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const progressoQ = useProgressoGlobal(user?.id);

  const categorias = categoriasQ.data ?? [];
  const ferrAll = ferrAllQ.data ?? [];
  const progresso = progressoQ.data ?? [];

  const progressoMap = new Map(progresso.map(p => [p.ferramenta_id, p.status]));

  const totalConcluidas = progresso.filter(p => p.status === 'concluido').length;

  const categoriasComStats = categorias.map(cat => {
    const ferrs = ferrAll.filter(f => f.categoria_id === cat.id);
    const concluidas = ferrs.filter(f => progressoMap.get(f.id) === 'concluido').length;
    const em_andamento = ferrs.filter(f => progressoMap.get(f.id) === 'em_andamento').length;
    return { ...cat, total: ferrs.length, concluidas, em_andamento };
  });

  return {
    categorias: categoriasComStats,
    totalConcluidas,
    isLoading: categoriasQ.isLoading || ferrAllQ.isLoading,
  };
}

// ─── Categoria: ferramentas com status ────────────────────────────────────────

export function useArsenalCategoria(slug: string) {
  const { user } = useAuth();

  const catQ = useQuery({
    queryKey: ['arsenal-categoria', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_categorias' as any)
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      return data as ArsenalCategoria;
    },
    enabled: !!slug,
  });

  const ferrQ = useQuery({
    queryKey: ['arsenal-ferramentas-cat', catQ.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_ferramentas' as any)
        .select('*')
        .eq('categoria_id', catQ.data!.id)
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalFerramenta[];
    },
    enabled: !!catQ.data?.id,
  });

  const progressoQ = useProgressoGlobal(user?.id);
  const progressoMap = new Map((progressoQ.data ?? []).map(p => [p.ferramenta_id, p.status]));

  const ferramentas = (ferrQ.data ?? []).map(f => ({
    ...f,
    status: (progressoMap.get(f.id) ?? 'nao_iniciado') as ArsenalStatus,
  }));

  const concluidas = ferramentas.filter(f => f.status === 'concluido').length;

  return {
    categoria: catQ.data,
    ferramentas,
    concluidas,
    isLoading: catQ.isLoading || ferrQ.isLoading,
  };
}

// ─── Ferramenta: detalhe + construção + mutations ─────────────────────────────

export function useArsenalFerramenta(ferrSlug: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const ferrQ = useQuery({
    queryKey: ['arsenal-ferramenta', ferrSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_ferramentas' as any)
        .select('*, arsenal_categorias(*)')
        .eq('slug', ferrSlug)
        .single();
      if (error) throw error;
      return data as ArsenalFerramenta & { arsenal_categorias: ArsenalCategoria };
    },
    enabled: !!ferrSlug,
  });

  const ferrId = ferrQ.data?.id;

  const progressoQ = useQuery({
    queryKey: ['arsenal-progresso-item', user?.id, ferrId],
    queryFn: async () => {
      const { data } = await supabase
        .from('arsenal_progresso' as any)
        .select('status')
        .eq('user_id', user!.id)
        .eq('ferramenta_id', ferrId!)
        .maybeSingle();
      return (data?.status ?? 'nao_iniciado') as ArsenalStatus;
    },
    enabled: !!user?.id && !!ferrId,
  });

  const construcaoQ = useQuery({
    queryKey: ['arsenal-construcao', user?.id, ferrId],
    queryFn: async () => {
      const { data } = await supabase
        .from('arsenal_construcoes' as any)
        .select('conteudo')
        .eq('user_id', user!.id)
        .eq('ferramenta_id', ferrId!)
        .maybeSingle();
      return (data?.conteudo ?? '') as string;
    },
    enabled: !!user?.id && !!ferrId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['arsenal-progresso'] });
    qc.invalidateQueries({ queryKey: ['arsenal-progresso-item', user?.id, ferrId] });
  };

  const marcarEmAndamento = useMutation({
    mutationFn: async () => {
      if (!user?.id || !ferrId || progressoQ.data !== 'nao_iniciado') return;
      const { error } = await supabase
        .from('arsenal_progresso' as any)
        .upsert({ user_id: user.id, ferramenta_id: ferrId, status: 'em_andamento', updated_at: new Date().toISOString() }, { onConflict: 'user_id,ferramenta_id' });
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const salvarConstrucao = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!user?.id || !ferrId) throw new Error('Dados insuficientes');

      const [r1, r2] = await Promise.all([
        supabase.from('arsenal_construcoes' as any).upsert(
          { user_id: user.id, ferramenta_id: ferrId, conteudo, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,ferramenta_id' }
        ),
        supabase.from('arsenal_progresso' as any).upsert(
          { user_id: user.id, ferramenta_id: ferrId, status: 'concluido', updated_at: new Date().toISOString() },
          { onConflict: 'user_id,ferramenta_id' }
        ),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;

      // Sync to Meus Materiais (fire-and-forget — does not block save)
      const ferramenta = ferrQ.data;
      if (ferramenta) {
        upsertFromArsenal({
          userId: user.id,
          ferramentaId: ferrId,
          categoriaId: ferramenta.arsenal_categorias?.id ?? null,
          titulo: ferramenta.nome,
          conteudo,
        }).catch(() => {/* silent — main save already succeeded */});
      }
    },
    onSuccess: () => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['arsenal-construcao', user?.id, ferrId] });
    },
  });

  return {
    ferramenta: ferrQ.data,
    categoria: ferrQ.data?.arsenal_categorias,
    status: progressoQ.data ?? 'nao_iniciado' as ArsenalStatus,
    construcao: construcaoQ.data ?? '',
    isLoading: ferrQ.isLoading,
    marcarEmAndamento,
    salvarConstrucao,
  };
}

// ─── Materiais Complementares por ferramenta ──────────────────────────────────

export interface ArsenalMaterial {
  id: string;
  ferramenta_id: string;
  titulo: string;
  tipo: 'pdf' | 'html';
  pdf_url: string | null;
  ordem: number;
  ativo: boolean;
}

export function useArsenalMateriais(ferramentaId: string | undefined) {
  return useQuery({
    queryKey: ['arsenal-materiais', ferramentaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_materiais' as any)
        .select('id, ferramenta_id, titulo, tipo, pdf_url, ordem, ativo')
        .eq('ferramenta_id', ferramentaId!)
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalMaterial[];
    },
    enabled: !!ferramentaId,
    staleTime: 1000 * 60 * 5,
  });
}

export async function fetchArsenalMaterialHtml(materialId: string): Promise<string> {
  const { data, error } = await supabase
    .from('arsenal_materiais' as any)
    .select('conteudo_html')
    .eq('id', materialId)
    .single();
  if (error) throw error;
  return (data as any)?.conteudo_html ?? '';
}

// ─── Ferramentas por categoria (usado no modal de criação) ────────────────────

export interface ArsenalFerramentaBasica {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  ordem: number;
}

export function useFerramentasByCategoria(categoriaId?: string) {
  return useQuery({
    queryKey: ['arsenal-ferramentas-cat-id', categoriaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_ferramentas' as any)
        .select('id, nome, slug, descricao, ordem')
        .eq('categoria_id', categoriaId!)
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalFerramentaBasica[];
    },
    enabled: !!categoriaId,
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface ArsenalTemplate {
  id: string;
  titulo: string;
  descricao: string | null;
  conteudo: string;
  ferramenta_id: string;
  categoria_arsenal_id: string;
  ordem: number;
}

export interface ArsenalTemplateComJoins extends ArsenalTemplate {
  arsenal_ferramentas: { id: string; nome: string; slug: string };
  arsenal_categorias: { id: string; nome: string; slug: string };
}

export function useArsenalTemplates(ferramentaId?: string) {
  return useQuery({
    queryKey: ['arsenal-templates', ferramentaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_templates' as any)
        .select('id, titulo, descricao, conteudo, ferramenta_id, categoria_arsenal_id, ordem')
        .eq('ferramenta_id', ferramentaId!)
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalTemplate[];
    },
    enabled: !!ferramentaId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllArsenalTemplates() {
  return useQuery({
    queryKey: ['arsenal-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arsenal_templates' as any)
        .select('*, arsenal_ferramentas(id, nome, slug), arsenal_categorias(id, nome, slug)')
        .eq('ativo', true)
        .order('categoria_arsenal_id')
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as ArsenalTemplateComJoins[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
