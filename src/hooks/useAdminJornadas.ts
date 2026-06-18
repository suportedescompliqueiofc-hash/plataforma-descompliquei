import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Draft types (editor state) ──────────────────────────────────────────────

export interface DraftPasso {
  _id: string;
  dbId?: string;
  titulo: string;
  descricao: string;
  tipo: 'acao_livre' | 'ferramenta_arsenal' | 'categoria_arsenal' | 'aula_arsenal';
  ferramenta_id: string | null;
  categoria_id: string | null;
  aula_id: string | null;
  prazo_dias: number | null;
  obrigatorio: boolean;
  concluido: boolean;
  concluido_em: string | null;
  concluido_por: string | null;
}

export interface DraftEstagio {
  _id: string;
  dbId?: string;
  titulo: string;
  descricao: string;
  prazo_dias: number;
  data_inicio: string | null;
  passos: DraftPasso[];
}

// ─── DB types (list view) ─────────────────────────────────────────────────────

export interface JornadaResumo {
  id: string;
  user_id: string;
  titulo: string;
  status: 'rascunho' | 'ativa' | 'concluida';
  gerada_por: 'ia' | 'admin';
  created_at: string;
  updated_at: string;
  perfis: { nome_completo: string; email: string } | null;
  _progress?: { total: number; done: number };
  _stages?: { total: number; currentIndex: number; currentTitle: string | null };
}

export interface JornadaFull {
  id: string;
  user_id: string;
  titulo: string;
  status: 'rascunho' | 'ativa' | 'concluida';
  gerada_por: 'ia' | 'admin';
  created_at: string;
  updated_at: string;
  perfis: { nome_completo: string; email: string } | null;
  jornada_estagios: Array<{
    id: string;
    titulo: string;
    descricao: string | null;
    ordem: number;
    prazo_dias: number;
    data_inicio: string | null;
    jornada_passos: Array<{
      id: string;
      titulo: string;
      descricao: string | null;
      ordem: number;
      tipo: 'acao_livre' | 'ferramenta_arsenal';
      ferramenta_id: string | null;
      prazo_dias: number | null;
      obrigatorio: boolean;
      concluido: boolean;
      concluido_em: string | null;
      concluido_por: string | null;
    }>;
  }>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAdminJornadas() {
  return useQuery({
    queryKey: ['admin-jornadas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select(`
          id, user_id, titulo, status, gerada_por, created_at, updated_at,
          perfis ( nome_completo, email ),
          jornada_estagios ( id, titulo, ordem, jornada_passos ( concluido, obrigatorio ) )
        `)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((j: any) => {
        const estagios = [...(j.jornada_estagios ?? [])].sort((a: any, b: any) => a.ordem - b.ordem);

        // Progress: all passos across all stages
        const passos = estagios.flatMap((e: any) => e.jornada_passos ?? []);
        const total = passos.length;
        const done = passos.filter((p: any) => p.concluido).length;

        // Current stage: first stage where not all required (or all) passos are done
        const totalEstagios = estagios.length;
        let currentIndex = totalEstagios; // all done sentinel
        let currentTitle: string | null = null;
        for (let i = 0; i < estagios.length; i++) {
          const ep = estagios[i].jornada_passos ?? [];
          const required = ep.filter((p: any) => p.obrigatorio);
          const check = required.length > 0 ? required : ep;
          const allDone = check.length === 0 || check.every((p: any) => p.concluido);
          if (!allDone) { currentIndex = i; currentTitle = estagios[i].titulo; break; }
        }

        return {
          ...j,
          jornada_estagios: undefined,
          _progress: { total, done },
          _stages: { total: totalEstagios, currentIndex, currentTitle },
        } as JornadaResumo;
      });
    },
    staleTime: 30_000,
  });
}

export function useAdminJornada(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-jornada', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select(`
          *,
          perfis ( nome_completo, email ),
          jornada_estagios (
            *, jornada_passos ( * )
          )
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      const j = data as JornadaFull;
      j.jornada_estagios = (j.jornada_estagios ?? []).sort((a, b) => a.ordem - b.ordem);
      j.jornada_estagios.forEach(e => {
        e.jornada_passos = (e.jornada_passos ?? []).sort((a, b) => a.ordem - b.ordem);
      });
      return j;
    },
    staleTime: 10_000,
  });
}

export function useCreateJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; titulo: string }) => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .insert({ ...payload, status: 'rascunho', gerada_por: 'admin' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-jornadas'] });
      toast.success('Jornada criada');
    },
    onError: () => toast.error('Erro ao criar jornada'),
  });
}

export function useUpdateJornadaMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; titulo?: string; status?: string }) => {
      const { error } = await (supabase as any).from('jornadas').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin-jornadas'] });
      qc.invalidateQueries({ queryKey: ['admin-jornada', v.id] });
    },
    onError: () => toast.error('Erro ao salvar'),
  });
}

export function useDeleteJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('jornadas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-jornadas'] });
      toast.success('Jornada excluída');
    },
    onError: () => toast.error('Erro ao excluir jornada'),
  });
}

// Smart upsert: preserves concluido state, never deletes existing passos/estagios by id
export function useSaveJornadaEstrutura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jornadaId,
      estagios,
    }: {
      jornadaId: string;
      estagios: DraftEstagio[];
    }) => {
      // 1. Upsert estagios
      const estagioRows = estagios.map((e, i) => ({
        ...(e.dbId ? { id: e.dbId } : {}),
        jornada_id: jornadaId,
        titulo: e.titulo,
        descricao: e.descricao || null,
        ordem: i,
        prazo_dias: e.prazo_dias,
        data_inicio: e.data_inicio,
      }));
      const { data: savedEstagios, error: eErr } = await (supabase as any)
        .from('jornada_estagios')
        .upsert(estagioRows, { onConflict: 'id' })
        .select('id, titulo');
      if (eErr) throw eErr;

      // Build map _id → real db id
      const estagioIdMap: Record<string, string> = {};
      estagios.forEach((e, i) => {
        estagioIdMap[e._id] = (savedEstagios as any[])[i]?.id ?? e.dbId!;
      });

      // IDs that should now exist in DB (pre-existing + newly inserted)
      const savedEstagioIds = (savedEstagios as any[]).map((e: any) => e.id);

      // 2. Upsert passos per estagio + collect saved passo IDs per estagio
      const savedPassoIdsByEstagioId: Record<string, string[]> = {};
      for (let i = 0; i < estagios.length; i++) {
        const estagio = estagios[i];
        const realEstagioId = estagioIdMap[estagio._id];
        if (!realEstagioId) continue;
        const passoRows = estagio.passos.map((p, j) => ({
          ...(p.dbId ? { id: p.dbId } : {}),
          estagio_id: realEstagioId,
          titulo: p.titulo,
          descricao: p.descricao || null,
          ordem: j,
          tipo: p.tipo,
          ferramenta_id: p.tipo === 'ferramenta_arsenal' ? p.ferramenta_id : null,
          categoria_id: p.tipo === 'categoria_arsenal' ? p.categoria_id : null,
          aula_id: p.tipo === 'aula_arsenal' ? p.aula_id : null,
          prazo_dias: p.prazo_dias,
          obrigatorio: p.obrigatorio,
          ...(p.dbId ? {} : { concluido: false }),
        }));
        if (passoRows.length > 0) {
          const { data: savedPassos, error: pErr } = await (supabase as any)
            .from('jornada_passos')
            .upsert(passoRows, { onConflict: 'id' })
            .select('id');
          if (pErr) throw pErr;
          savedPassoIdsByEstagioId[realEstagioId] = (savedPassos as any[]).map((p: any) => p.id);
        } else {
          savedPassoIdsByEstagioId[realEstagioId] = [];
        }
      }

      // 3. Delete estagios that no longer exist (compare against savedEstagioIds from upsert)
      const { data: allEstagios } = await (supabase as any)
        .from('jornada_estagios')
        .select('id')
        .eq('jornada_id', jornadaId);
      const toDeleteEstagios = (allEstagios ?? [])
        .map((e: any) => e.id)
        .filter((id: string) => !savedEstagioIds.includes(id));
      if (toDeleteEstagios.length > 0) {
        await (supabase as any).from('jornada_estagios').delete().in('id', toDeleteEstagios);
      }

      // 4. Delete passos that were removed within each estagio
      for (const [realEstagioId, currentPassoIds] of Object.entries(savedPassoIdsByEstagioId)) {
        const { data: allPassos } = await (supabase as any)
          .from('jornada_passos')
          .select('id')
          .eq('estagio_id', realEstagioId);
        const toDeletePassos = (allPassos ?? [])
          .map((p: any) => p.id)
          .filter((id: string) => !currentPassoIds.includes(id));
        if (toDeletePassos.length > 0) {
          await (supabase as any).from('jornada_passos').delete().in('id', toDeletePassos);
        }
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin-jornada', v.jornadaId] });
      toast.success('Estrutura salva');
    },
    onError: (e) => {
      console.error(e);
      toast.error('Erro ao salvar estrutura');
    },
  });
}

// Helper: convert JornadaFull estagios → DraftEstagio[]
export function jornadaToDraft(jornada: JornadaFull): DraftEstagio[] {
  return jornada.jornada_estagios.map(e => ({
    _id: e.id,
    dbId: e.id,
    titulo: e.titulo,
    descricao: e.descricao ?? '',
    prazo_dias: e.prazo_dias,
    data_inicio: e.data_inicio,
    passos: e.jornada_passos.map(p => ({
      _id: p.id,
      dbId: p.id,
      titulo: p.titulo,
      descricao: p.descricao ?? '',
      tipo: p.tipo as DraftPasso['tipo'],
      ferramenta_id: p.ferramenta_id,
      categoria_id: (p as any).categoria_id ?? null,
      aula_id: (p as any).aula_id ?? null,
      prazo_dias: p.prazo_dias,
      obrigatorio: p.obrigatorio,
      concluido: p.concluido,
      concluido_em: p.concluido_em,
      concluido_por: p.concluido_por,
    })),
  }));
}
