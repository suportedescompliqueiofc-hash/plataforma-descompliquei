import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClubeNivel = {
  id: string;
  nome: string;
  pontos_minimo: number;
  pontos_maximo: number;
  selo: string | null;
};

export type ClubeAtividade = {
  id: string;
  nome: string;
  descricao: string | null;
  pontos_ganho: number;
  pontos_perda: number;
  categoria: 'presenca' | 'execucao' | 'comunidade' | 'penalidade';
  ativa: boolean;
};

export type ClubeMembro = {
  id: string;
  user_id: string | null;
  nome: string;
  foto_url: string | null;
  produto: 'PCA' | 'GCA';
  pontos_total: number;
  nivel: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ClubeRegistro = {
  id: string;
  membro_id: string;
  atividade_id: string;
  pontos: number;
  tipo: 'ganho' | 'perda';
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
  clube_atividades: { nome: string; categoria: string } | null;
};

// ─── Níveis ───────────────────────────────────────────────────────────────────

export function useClubeNiveis() {
  return useQuery({
    queryKey: ['clube-niveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clube_niveis')
        .select('*')
        .order('pontos_minimo', { ascending: true });
      if (error) throw error;
      return data as ClubeNivel[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

// ─── Atividades ───────────────────────────────────────────────────────────────

export function useClubeAtividades(apenasAtivas = true) {
  return useQuery({
    queryKey: ['clube-atividades', apenasAtivas],
    queryFn: async () => {
      let q = supabase
        .from('clube_atividades')
        .select('*')
        .order('categoria')
        .order('nome');
      if (apenasAtivas) q = q.eq('ativa', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as ClubeAtividade[];
    },
  });
}

export function useCreateAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ClubeAtividade, 'id' | 'ativa'> & { ativa?: boolean }) => {
      const { error } = await supabase.from('clube_atividades').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clube-atividades'] });
      toast.success('Atividade criada.');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClubeAtividade> & { id: string }) => {
      const { error } = await supabase.from('clube_atividades').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clube-atividades'] });
      toast.success('Atividade atualizada.');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Membros ──────────────────────────────────────────────────────────────────

export function useClubeMembros(apenasAtivos = true) {
  return useQuery({
    queryKey: ['clube-membros', apenasAtivos],
    queryFn: async () => {
      let q = supabase
        .from('clube_membros')
        .select('*')
        .order('pontos_total', { ascending: false });
      if (apenasAtivos) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as ClubeMembro[];
    },
  });
}

export function useClubeMembro(id: string | null) {
  return useQuery({
    queryKey: ['clube-membro', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clube_membros')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as ClubeMembro;
    },
  });
}

export function useCreateMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nome: string; produto: 'PCA' | 'GCA'; foto_url?: string; user_id?: string }) => {
      const { error } = await supabase.from('clube_membros').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clube-membros'] });
      toast.success('Membro adicionado ao Clube One.');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ClubeMembro> & { id: string }) => {
      const { error } = await supabase.from('clube_membros').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['clube-membros'] });
      qc.invalidateQueries({ queryKey: ['clube-membro', vars.id] });
      toast.success('Membro atualizado.');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Registros ────────────────────────────────────────────────────────────────

export function useClubeRegistros(membroId: string | null) {
  return useQuery({
    queryKey: ['clube-registros', membroId],
    enabled: !!membroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clube_registros')
        .select('*, clube_atividades(nome, categoria)')
        .eq('membro_id', membroId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClubeRegistro[];
    },
  });
}

export function useTodosRegistros() {
  return useQuery({
    queryKey: ['clube-registros-todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clube_registros')
        .select('*, clube_atividades(nome, categoria), clube_membros(nome)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as (ClubeRegistro & { clube_membros: { nome: string } | null })[];
    },
  });
}

export function useRegistrarAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      membro_id: string;
      atividade_id: string;
      pontos: number;
      tipo: 'ganho' | 'perda';
      observacao?: string;
      registrado_por?: string;
    }) => {
      const { error } = await supabase.from('clube_registros').insert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['clube-membros'] });
      qc.invalidateQueries({ queryKey: ['clube-membro', vars.membro_id] });
      qc.invalidateQueries({ queryKey: ['clube-registros', vars.membro_id] });
      qc.invalidateQueries({ queryKey: ['clube-registros-todos'] });
      toast.success('Pontos registrados!');
    },
    onError: (e: any) => {
      const msg = e.message?.includes('já registrada') ? 'Atividade já registrada esta semana.' : e.message;
      toast.error(msg);
    },
  });
}
