import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JornadaPasso {
  id: string;
  estagio_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  tipo: 'acao_livre' | 'ferramenta_arsenal' | 'categoria_arsenal';
  ferramenta_id: string | null;
  categoria_id: string | null;
  prazo_dias: number | null;
  obrigatorio: boolean;
  concluido: boolean;
  concluido_em: string | null;
  arsenal_ferramentas: {
    id: string;
    nome: string;
    slug: string;
    arsenal_categorias: { id: string; nome: string; slug: string };
  } | null;
  arsenal_categorias: { id: string; nome: string; slug: string } | null;
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
  user_id: string;
  titulo: string;
  status: 'rascunho' | 'ativa' | 'concluida';
  gerada_por: 'ia' | 'admin';
  created_at: string;
  updated_at: string;
  jornada_estagios: JornadaEstagio[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export type EstagioStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

export function getEstagioStatus(estagio: JornadaEstagio): EstagioStatus {
  const passos = estagio.jornada_passos ?? [];
  if (passos.length === 0) return 'nao_iniciado';
  if (passos.every(p => !p.concluido)) return 'nao_iniciado';
  const obrigatorios = passos.filter(p => p.obrigatorio);
  if (obrigatorios.length > 0 && obrigatorios.every(p => p.concluido)) return 'concluido';
  if (passos.length > 0 && passos.every(p => p.concluido)) return 'concluido';
  return 'em_andamento';
}

export function getJornadaProgress(jornada: Jornada) {
  const allPassos = jornada.jornada_estagios.flatMap(e => e.jornada_passos ?? []);
  const total = allPassos.length;
  const done = allPassos.filter(p => p.concluido).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function getCurrentEstagio(jornada: Jornada): JornadaEstagio | null {
  return (
    jornada.jornada_estagios.find(e => getEstagioStatus(e) === 'em_andamento') ??
    jornada.jornada_estagios.find(e => getEstagioStatus(e) === 'nao_iniciado') ??
    null
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useJornada() {
  return useQuery({
    queryKey: ['minha-jornada'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select(`
          *,
          jornada_estagios (
            *,
            jornada_passos (
              *,
              arsenal_ferramentas ( id, nome, slug, arsenal_categorias ( id, nome, slug ) ),
              arsenal_categorias ( id, nome, slug )
            )
          )
        `)
        .in('status', ['ativa', 'concluida'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const jornada = data as Jornada;
      jornada.jornada_estagios = (jornada.jornada_estagios ?? []).sort((a, b) => a.ordem - b.ordem);
      jornada.jornada_estagios.forEach(e => {
        e.jornada_passos = (e.jornada_passos ?? []).sort((a, b) => a.ordem - b.ordem);
      });
      return jornada;
    },
    staleTime: 30_000,
  });
}

export function useMarcarPassoConcluido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ passoId, concluido }: { passoId: string; concluido: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('jornada_passos')
        .update({
          concluido,
          concluido_em: concluido ? new Date().toISOString() : null,
          concluido_por: concluido ? (user?.id ?? null) : null,
        })
        .eq('id', passoId);
      if (error) throw error;
    },
    onMutate: async ({ passoId, concluido }) => {
      await qc.cancelQueries({ queryKey: ['minha-jornada'] });
      const prev = qc.getQueryData<Jornada>(['minha-jornada']);
      if (prev) {
        qc.setQueryData<Jornada>(['minha-jornada'], {
          ...prev,
          jornada_estagios: prev.jornada_estagios.map(e => ({
            ...e,
            jornada_passos: e.jornada_passos.map(p =>
              p.id === passoId ? { ...p, concluido } : p
            ),
          })),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['minha-jornada'], ctx.prev);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['minha-jornada'] }); },
  });
}
