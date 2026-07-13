import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// Jornada 2.0 (visão do cliente) — consultoria mensal montada pelo CS.
// Tarefas com descrição rica (conteudo_md), subtarefas, tipo 'material'
// (construir com o Athos GS). Sem locking. Histórico de todas as jornadas.
// ═══════════════════════════════════════════════════════════════════════════

export interface JornadaSubtarefa {
  id: string;
  titulo: string;
  ordem: number;
  concluido: boolean;
}

export interface JornadaPasso {
  id: string;
  titulo: string;
  conteudo_md: string | null;
  descricao: string | null;
  ordem: number;
  tipo: 'acao_livre' | 'material' | 'ferramenta_arsenal' | 'categoria_arsenal';
  material_categoria: string | null;
  material_brief: string | null;
  material_id: string | null;
  aula_id: string | null;
  prazo_dias: number | null;
  obrigatorio: boolean;
  concluido: boolean;
  concluido_em: string | null;
  jornada_subtarefas: JornadaSubtarefa[];
  meus_materiais: { id: string; titulo: string } | null;
  arsenal_aulas: { id: string; slug: string } | null;
}

export interface JornadaEstagio {
  id: string;
  jornada_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  prazo_dias: number;
  data_inicio: string | null;
  jornada_passos: JornadaPasso[];
}

export interface Jornada {
  id: string;
  titulo: string;
  status: 'rascunho' | 'ativa' | 'concluida';
  tipo: 'onboarding' | 'mensal' | null;
  periodo_ref: string | null;
  created_at: string;
  updated_at: string;
  jornada_estagios: JornadaEstagio[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getJornadaProgress(jornada: Jornada) {
  const passos = jornada.jornada_estagios.flatMap(e => e.jornada_passos ?? []);
  const total = passos.length;
  const done = passos.filter(p => p.concluido).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function getEstagioProgress(estagio: JornadaEstagio) {
  const passos = estagio.jornada_passos ?? [];
  const total = passos.length;
  const done = passos.filter(p => p.concluido).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function sortJornadas(list: Jornada[]): Jornada[] {
  const rank = (j: Jornada) => (j.status === 'ativa' ? 0 : 1);
  return [...list].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    const pa = a.periodo_ref ?? a.created_at;
    const pb = b.periodo_ref ?? b.created_at;
    return pb.localeCompare(pa);
  });
}

// ─── Query: todas as jornadas do cliente (histórico) ──────────────────────────

export function useJornadas() {
  return useQuery({
    queryKey: ['jornadas'],
    queryFn: async (): Promise<Jornada[]> => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select(`
          id, titulo, status, tipo, periodo_ref, created_at, updated_at,
          jornada_estagios (
            id, jornada_id, titulo, descricao, ordem, prazo_dias, data_inicio,
            jornada_passos (
              id, titulo, conteudo_md, descricao, ordem, tipo,
              material_categoria, material_brief, material_id, aula_id,
              prazo_dias, obrigatorio, concluido, concluido_em,
              jornada_subtarefas ( id, titulo, ordem, concluido ),
              meus_materiais ( id, titulo ),
              arsenal_aulas ( id, slug )
            )
          )
        `)
        .in('status', ['ativa', 'concluida']);
      if (error) throw error;
      const list = (data ?? []) as Jornada[];
      list.forEach(j => {
        j.jornada_estagios = (j.jornada_estagios ?? []).sort((a, b) => a.ordem - b.ordem);
        j.jornada_estagios.forEach(e => {
          e.jornada_passos = (e.jornada_passos ?? []).sort((a, b) => a.ordem - b.ordem);
          e.jornada_passos.forEach(p => {
            p.jornada_subtarefas = (p.jornada_subtarefas ?? []).sort((a, b) => a.ordem - b.ordem);
          });
        });
      });
      return sortJornadas(list);
    },
    staleTime: 30_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function patchJornadasCache(qc: ReturnType<typeof useQueryClient>, mutate: (p: JornadaPasso) => JornadaPasso, mutateSub?: (s: JornadaSubtarefa, passoId: string) => JornadaSubtarefa) {
  const prev = qc.getQueryData<Jornada[]>(['jornadas']);
  if (!prev) return prev;
  const next = prev.map(j => ({
    ...j,
    jornada_estagios: j.jornada_estagios.map(e => ({
      ...e,
      jornada_passos: e.jornada_passos.map(p => {
        let np = mutate(p);
        if (mutateSub) np = { ...np, jornada_subtarefas: np.jornada_subtarefas.map(s => mutateSub(s, p.id)) };
        return np;
      }),
    })),
  }));
  qc.setQueryData(['jornadas'], next);
  return prev;
}

export function useMarcarPassoConcluido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ passoId, concluido }: { passoId: string; concluido: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('jornada_passos')
        .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null, concluido_por: concluido ? (user?.id ?? null) : null })
        .eq('id', passoId);
      if (error) throw error;
    },
    onMutate: async ({ passoId, concluido }) => {
      await qc.cancelQueries({ queryKey: ['jornadas'] });
      const prev = patchJornadasCache(qc, p => p.id === passoId ? { ...p, concluido } : p);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['jornadas'], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['jornadas'] }); },
  });
}

export function useMarcarSubtarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subtarefaId, concluido }: { subtarefaId: string; concluido: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('jornada_subtarefas')
        .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null, concluido_por: concluido ? (user?.id ?? null) : null })
        .eq('id', subtarefaId);
      if (error) throw error;
    },
    onMutate: async ({ subtarefaId, concluido }) => {
      await qc.cancelQueries({ queryKey: ['jornadas'] });
      const prev = patchJornadasCache(qc, p => p, s => s.id === subtarefaId ? { ...s, concluido } : s);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['jornadas'], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['jornadas'] }); },
  });
}

// ─── Deep-link para construir material com o Athos GS ─────────────────────────

export function buildMaterialDeepLink(passo: JornadaPasso): string {
  const params = new URLSearchParams();
  params.set('passo', passo.id);
  if (passo.material_categoria) params.set('categoria', passo.material_categoria);
  if (passo.material_brief) params.set('brief', passo.material_brief);
  return `/plataforma/athos-gs?${params.toString()}`;
}
