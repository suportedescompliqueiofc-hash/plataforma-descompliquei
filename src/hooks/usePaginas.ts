import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export type Visibilidade = "pessoal" | "empresa";
export type Permissao = "visualizar" | "editar";
// Modelo PASTA vs NOTA (2026-07-13): "pasta" é container (aninha pasta/nota,
// sem conteúdo, com descrição curta); "nota" é folha (tem `conteudo`, nunca
// é pai). Imutável após criação — ver useAtualizarPagina.
export type TipoPagina = "pasta" | "nota";

export interface PaginaResumo {
  id: string;
  titulo: string;
  icone: string | null;
  parent_id: string | null;
  visibilidade: Visibilidade;
  categoria: string | null;
  ordem_index: number;
  criado_por: string;
  atualizado_em: string;
  disponivel_atendimento: boolean;
  tipo: TipoPagina;
  descricao: string | null;
}

export interface PaginaCompleta extends PaginaResumo {
  organization_id: string;
  conteudo: any;
  criado_em: string;
  perfis?: { nome_completo: string | null; avatar_url: string | null } | null;
}

export interface Compartilhamento {
  id: string;
  pagina_id: string;
  user_id: string;
  permissao: Permissao;
  perfis?: { nome_completo: string | null; avatar_url: string | null } | null;
}

// Tabelas novas — ainda não refletidas no types.ts gerado do Supabase
// (mesmo padrão usado em useMeusMateriais.ts para "meus_materiais").
const PAGINAS = "paginas" as any;
const COMPARTILHAMENTOS = "pagina_compartilhamentos" as any;

const RESUMO_COLS = "id, titulo, icone, parent_id, visibilidade, categoria, ordem_index, criado_por, atualizado_em, disponivel_atendimento, tipo, descricao";

export function usePaginasArvore() {
  const { profile } = useProfile();
  return useQuery({
    queryKey: ["paginas-arvore", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PAGINAS)
        .select(RESUMO_COLS)
        .order("ordem_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PaginaResumo[];
    },
    enabled: !!profile?.organization_id,
  });
}

// criado_por/user_id apontam pra auth.users, não pra perfis — não há FK entre
// paginas/pagina_compartilhamentos e perfis, então o PostgREST não consegue
// embutir "perfis:coluna(...)" automaticamente. Busca em duas etapas, mesmo
// padrão já usado em LeadNotas.tsx.
export function usePagina(id: string | undefined) {
  return useQuery({
    queryKey: ["pagina", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PAGINAS)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;

      let perfil: { nome_completo: string | null; avatar_url: string | null } | null = null;
      if ((data as any)?.criado_por) {
        const { data: p } = await supabase
          .from("perfis")
          .select("nome_completo, avatar_url")
          .eq("id", (data as any).criado_por)
          .maybeSingle();
        perfil = p ?? null;
      }

      return { ...(data as any), perfis: perfil } as unknown as PaginaCompleta;
    },
    enabled: !!id,
    staleTime: 0,
  });
}

// Páginas marcadas "disponível no atendimento" — alimenta o painel de
// materiais dentro da conversa (MaterialsSidebar.tsx). RLS já limita a
// pessoais-minhas + compartilhadas + empresa da mesma org.
export function usePaginasAtendimento() {
  const { profile } = useProfile();
  return useQuery({
    queryKey: ["paginas-atendimento", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PAGINAS)
        .select(RESUMO_COLS)
        .eq("disponivel_atendimento", true)
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PaginaResumo[];
    },
    enabled: !!profile?.organization_id,
  });
}

// Fetch leve de conteúdo (sem o join de perfil de usePagina) — usado no
// accordion do painel de atendimento, carregado sob demanda ao expandir.
export function usePaginaConteudo(id: string | undefined) {
  return useQuery({
    queryKey: ["pagina-conteudo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PAGINAS)
        .select("conteudo")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return (data as any).conteudo;
    },
    enabled: !!id,
  });
}

export function useCompartilhamentos(paginaId: string | undefined) {
  return useQuery({
    queryKey: ["pagina-compartilhamentos", paginaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(COMPARTILHAMENTOS)
        .select("id, pagina_id, user_id, permissao")
        .eq("pagina_id", paginaId!);
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((c: any) => c.user_id))];
      const profileMap: Record<string, { nome_completo: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis")
          .select("id, nome_completo, avatar_url")
          .in("id", userIds);
        (perfis ?? []).forEach((p: any) => { profileMap[p.id] = { nome_completo: p.nome_completo, avatar_url: p.avatar_url }; });
      }

      return (data ?? []).map((c: any) => ({ ...c, perfis: profileMap[c.user_id] ?? null })) as unknown as Compartilhamento[];
    },
    enabled: !!paginaId,
  });
}

export function useCriarPagina() {
  const { profile } = useProfile();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (init?: {
      titulo?: string;
      parent_id?: string | null;
      icone?: string | null;
      tipo?: TipoPagina;
      descricao?: string | null;
    }) => {
      const { data, error } = await supabase
        .from(PAGINAS)
        .insert({
          organization_id: profile!.organization_id,
          criado_por: profile!.id,
          titulo: init?.titulo ?? "Sem título",
          parent_id: init?.parent_id ?? null,
          icone: init?.icone ?? null,
          tipo: init?.tipo ?? "nota",
          descricao: init?.descricao ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paginas-arvore"] }),
  });
}

export function useAtualizarPagina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, titulo, conteudo, icone, categoria, visibilidade, disponivel_atendimento, descricao,
    }: {
      id: string;
      titulo?: string;
      conteudo?: any;
      icone?: string | null;
      categoria?: string | null;
      visibilidade?: Visibilidade;
      disponivel_atendimento?: boolean;
      descricao?: string | null;
      // `tipo` é imutável após a criação (não faz parte deste contrato de
      // update) — pasta e nota têm regras de hierarquia diferentes e mudar
      // o tipo em cima de uma página já existente quebraria a garantia da
      // trigger `paginas_valida_hierarquia`.
    }) => {
      const updates: Record<string, any> = { atualizado_em: new Date().toISOString() };
      if (titulo !== undefined) updates.titulo = titulo;
      if (conteudo !== undefined) updates.conteudo = conteudo;
      if (icone !== undefined) updates.icone = icone;
      if (categoria !== undefined) updates.categoria = categoria;
      if (visibilidade !== undefined) updates.visibilidade = visibilidade;
      if (disponivel_atendimento !== undefined) updates.disponivel_atendimento = disponivel_atendimento;
      if (descricao !== undefined) updates.descricao = descricao;
      const { error } = await supabase.from(PAGINAS).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["paginas-arvore"] });
      qc.invalidateQueries({ queryKey: ["pagina", id] });
    },
  });
}

export function useMoverPagina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, parent_id, ordem_index,
    }: { id: string; parent_id: string | null; ordem_index: number }) => {
      const { error } = await supabase
        .from(PAGINAS)
        .update({ parent_id, ordem_index, atualizado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paginas-arvore"] }),
  });
}

export function useExcluirPagina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(PAGINAS).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paginas-arvore"] }),
  });
}

export function useCompartilharPagina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      paginaId, userId, permissao,
    }: { paginaId: string; userId: string; permissao: Permissao }) => {
      const { error } = await supabase
        .from(COMPARTILHAMENTOS)
        .upsert({ pagina_id: paginaId, user_id: userId, permissao }, { onConflict: "pagina_id,user_id" });
      if (error) throw error;
    },
    onSuccess: (_, { paginaId }) => {
      qc.invalidateQueries({ queryKey: ["pagina-compartilhamentos", paginaId] });
      qc.invalidateQueries({ queryKey: ["paginas-arvore"] });
    },
  });
}

export function useRemoverCompartilhamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paginaId }: { id: string; paginaId: string }) => {
      const { error } = await supabase.from(COMPARTILHAMENTOS).delete().eq("id", id);
      if (error) throw error;
      return paginaId;
    },
    onSuccess: (paginaId) => {
      qc.invalidateQueries({ queryKey: ["pagina-compartilhamentos", paginaId] });
      qc.invalidateQueries({ queryKey: ["paginas-arvore"] });
    },
  });
}
