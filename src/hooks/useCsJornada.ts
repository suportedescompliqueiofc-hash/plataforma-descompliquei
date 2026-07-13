import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════
// Jornada 2.0 — gestão pelo CS (Admin OS). Substitui o antigo AdminJornadaEditor.
// Modelo novo: tarefas com descrição rica (conteudo_md), subtarefas, tipo
// 'material' (categoria + brief). Sem locking. Jornadas mensais + onboarding.
// ═══════════════════════════════════════════════════════════════════════════

export const MATERIAL_CATEGORIAS = [
  'script_atendimento', 'estrutura_processo', 'quebra_objecao',
  'oferta', 'followup_reativacao', 'otimizacao_comercial',
] as const;
export type MaterialCategoria = typeof MATERIAL_CATEGORIAS[number];

export const MATERIAL_CATEGORIA_LABELS: Record<string, string> = {
  script_atendimento: 'Script de atendimento',
  estrutura_processo: 'Estrutura de processo',
  quebra_objecao: 'Quebra de objeções',
  oferta: 'Oferta',
  followup_reativacao: 'Follow-up / reativação',
  otimizacao_comercial: 'Otimização comercial',
  outro: 'Outro',
};

export type PassoTipo = 'acao_livre' | 'material';

// ─── Draft types (editor state) ──────────────────────────────────────────────

export interface DraftSubtarefa {
  _id: string;
  dbId?: string;
  titulo: string;
  concluido: boolean;
}

export interface DraftTarefa {
  _id: string;
  dbId?: string;
  titulo: string;
  conteudo_md: string;
  tipo: PassoTipo;
  material_categoria: string | null;
  material_brief: string | null;
  material_id: string | null;
  prazo_dias: number | null;
  obrigatorio: boolean;
  concluido: boolean;
  concluido_em: string | null;
  concluido_por: string | null;
  subtarefas: DraftSubtarefa[];
}

export interface DraftEstagio {
  _id: string;
  dbId?: string;
  titulo: string;
  descricao: string;
  prazo_dias: number;
  data_inicio: string | null;
  passos: DraftTarefa[];
}

// ─── DB types ─────────────────────────────────────────────────────────────────

export interface CsJornadaResumo {
  id: string;
  titulo: string;
  status: 'rascunho' | 'ativa' | 'concluida';
  gerada_por: 'ia' | 'admin';
  tipo: 'onboarding' | 'mensal' | null;
  periodo_ref: string | null;
  created_at: string;
  updated_at: string;
  _total: number;
  _done: number;
}

// ─── List: todas as jornadas de um cliente (onboarding + mensais) ─────────────

export function useCsClientJornadas(crmUserId: string | null | undefined) {
  return useQuery({
    queryKey: ['cs-client-jornadas', crmUserId],
    enabled: !!crmUserId,
    queryFn: async (): Promise<CsJornadaResumo[]> => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select(`
          id, titulo, status, gerada_por, tipo, periodo_ref, created_at, updated_at,
          jornada_estagios ( jornada_passos ( concluido ) )
        `)
        .eq('user_id', crmUserId)
        .order('periodo_ref', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((j: any) => {
        const passos = (j.jornada_estagios ?? []).flatMap((e: any) => e.jornada_passos ?? []);
        return {
          id: j.id, titulo: j.titulo, status: j.status, gerada_por: j.gerada_por,
          tipo: j.tipo ?? null, periodo_ref: j.periodo_ref ?? null,
          created_at: j.created_at, updated_at: j.updated_at,
          _total: passos.length,
          _done: passos.filter((p: any) => p.concluido).length,
        } as CsJornadaResumo;
      });
    },
    staleTime: 30_000,
  });
}

// ─── Full journey (para o editor) ─────────────────────────────────────────────

export function useCsJornadaFull(jornadaId: string | undefined) {
  return useQuery({
    queryKey: ['cs-jornada-full', jornadaId],
    enabled: !!jornadaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select(`
          id, titulo, status, gerada_por, tipo, periodo_ref, user_id, organization_id, updated_at,
          jornada_estagios (
            id, titulo, descricao, ordem, prazo_dias, data_inicio,
            jornada_passos (
              id, titulo, conteudo_md, descricao, ordem, tipo,
              material_categoria, material_brief, material_id,
              prazo_dias, obrigatorio, concluido, concluido_em, concluido_por,
              jornada_subtarefas ( id, titulo, ordem, concluido )
            )
          )
        `)
        .eq('id', jornadaId)
        .single();
      if (error) throw error;
      const j = data as any;
      j.jornada_estagios = (j.jornada_estagios ?? []).sort((a: any, b: any) => a.ordem - b.ordem);
      j.jornada_estagios.forEach((e: any) => {
        e.jornada_passos = (e.jornada_passos ?? []).sort((a: any, b: any) => a.ordem - b.ordem);
        e.jornada_passos.forEach((p: any) => {
          p.jornada_subtarefas = (p.jornada_subtarefas ?? []).sort((a: any, b: any) => a.ordem - b.ordem);
        });
      });
      return j;
    },
    staleTime: 10_000,
  });
}

export function jornadaToDraft(jornada: any): DraftEstagio[] {
  return (jornada.jornada_estagios ?? []).map((e: any) => ({
    _id: e.id, dbId: e.id,
    titulo: e.titulo, descricao: e.descricao ?? '',
    prazo_dias: e.prazo_dias ?? 7, data_inicio: e.data_inicio,
    passos: (e.jornada_passos ?? []).map((p: any) => ({
      _id: p.id, dbId: p.id,
      titulo: p.titulo,
      conteudo_md: p.conteudo_md ?? p.descricao ?? '',
      tipo: (p.tipo === 'material' ? 'material' : 'acao_livre') as PassoTipo,
      material_categoria: p.material_categoria ?? null,
      material_brief: p.material_brief ?? null,
      material_id: p.material_id ?? null,
      prazo_dias: p.prazo_dias,
      obrigatorio: p.obrigatorio,
      concluido: p.concluido,
      concluido_em: p.concluido_em,
      concluido_por: p.concluido_por,
      subtarefas: (p.jornada_subtarefas ?? []).map((s: any) => ({
        _id: s.id, dbId: s.id, titulo: s.titulo, concluido: s.concluido,
      })),
    })),
  }));
}

// ─── Criar jornada mensal (rascunho em branco) ────────────────────────────────

export function useCreateMonthlyJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ crmUserId, organizationId, titulo, periodoRef }: { crmUserId: string; organizationId?: string | null; titulo: string; periodoRef: string }) => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .insert({ user_id: crmUserId, organization_id: organizationId ?? null, titulo, status: 'rascunho', gerada_por: 'admin', tipo: 'mensal', periodo_ref: periodoRef })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cs-client-jornadas', v.crmUserId] });
      toast.success('Jornada mensal criada');
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-client-jornadas'] });
      qc.invalidateQueries({ queryKey: ['cs-jornada-full'] });
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
      qc.invalidateQueries({ queryKey: ['cs-client-jornadas'] });
      toast.success('Jornada excluída');
    },
    onError: () => toast.error('Erro ao excluir'),
  });
}

// ─── Salvar estrutura (estágios + tarefas + subtarefas), preservando concluído ─

export function useSaveCsJornadaEstrutura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jornadaId, estagios }: { jornadaId: string; estagios: DraftEstagio[] }) => {
      // 1. Upsert estágios
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
        .from('jornada_estagios').upsert(estagioRows, { onConflict: 'id' }).select('id');
      if (eErr) throw eErr;

      const estagioIdMap: Record<string, string> = {};
      estagios.forEach((e, i) => { estagioIdMap[e._id] = (savedEstagios as any[])[i]?.id ?? e.dbId!; });
      const savedEstagioIds = (savedEstagios as any[]).map((e: any) => e.id);

      // 2. Upsert tarefas por estágio + coletar ids salvos
      const savedPassoIdsByEstagio: Record<string, string[]> = {};
      // (estagioId, passoDraft) → para depois tratar subtarefas
      const passoDraftBySavedId: Array<{ savedId: string; draft: DraftTarefa }> = [];

      for (let i = 0; i < estagios.length; i++) {
        const estagio = estagios[i];
        const realEstagioId = estagioIdMap[estagio._id];
        if (!realEstagioId) continue;
        const passoRows = estagio.passos.map((p, j) => ({
          ...(p.dbId ? { id: p.dbId } : {}),
          estagio_id: realEstagioId,
          titulo: p.titulo,
          conteudo_md: p.conteudo_md || null,
          descricao: null,
          ordem: j,
          tipo: p.tipo,
          material_categoria: p.tipo === 'material' ? p.material_categoria : null,
          material_brief: p.tipo === 'material' ? (p.material_brief || null) : null,
          material_id: p.tipo === 'material' ? p.material_id : null,
          prazo_dias: p.prazo_dias,
          obrigatorio: p.obrigatorio,
          ...(p.dbId ? {} : { concluido: false }),
        }));
        if (passoRows.length > 0) {
          const { data: savedPassos, error: pErr } = await (supabase as any)
            .from('jornada_passos').upsert(passoRows, { onConflict: 'id' }).select('id');
          if (pErr) throw pErr;
          const ids = (savedPassos as any[]).map((p: any) => p.id);
          savedPassoIdsByEstagio[realEstagioId] = ids;
          estagio.passos.forEach((p, j) => passoDraftBySavedId.push({ savedId: ids[j], draft: p }));
        } else {
          savedPassoIdsByEstagio[realEstagioId] = [];
        }
      }

      // 3. Deletar estágios removidos
      const { data: allEstagios } = await (supabase as any)
        .from('jornada_estagios').select('id').eq('jornada_id', jornadaId);
      const toDelEstagios = (allEstagios ?? []).map((e: any) => e.id).filter((id: string) => !savedEstagioIds.includes(id));
      if (toDelEstagios.length > 0) await (supabase as any).from('jornada_estagios').delete().in('id', toDelEstagios);

      // 4. Deletar tarefas removidas por estágio
      for (const [realEstagioId, currentIds] of Object.entries(savedPassoIdsByEstagio)) {
        const { data: allPassos } = await (supabase as any)
          .from('jornada_passos').select('id').eq('estagio_id', realEstagioId);
        const toDel = (allPassos ?? []).map((p: any) => p.id).filter((id: string) => !currentIds.includes(id));
        if (toDel.length > 0) await (supabase as any).from('jornada_passos').delete().in('id', toDel);
      }

      // 5. Subtarefas por tarefa (upsert + delete removidas)
      for (const { savedId, draft } of passoDraftBySavedId) {
        const subRows = draft.subtarefas.map((s, k) => ({
          ...(s.dbId ? { id: s.dbId } : {}),
          passo_id: savedId,
          titulo: s.titulo,
          ordem: k,
          ...(s.dbId ? {} : { concluido: false }),
        }));
        let currentSubIds: string[] = [];
        if (subRows.length > 0) {
          const { data: savedSubs, error: sErr } = await (supabase as any)
            .from('jornada_subtarefas').upsert(subRows, { onConflict: 'id' }).select('id');
          if (sErr) throw sErr;
          currentSubIds = (savedSubs as any[]).map((s: any) => s.id);
        }
        const { data: allSubs } = await (supabase as any)
          .from('jornada_subtarefas').select('id').eq('passo_id', savedId);
        const toDelSubs = (allSubs ?? []).map((s: any) => s.id).filter((id: string) => !currentSubIds.includes(id));
        if (toDelSubs.length > 0) await (supabase as any).from('jornada_subtarefas').delete().in('id', toDelSubs);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cs-jornada-full', v.jornadaId] });
      qc.invalidateQueries({ queryKey: ['cs-client-jornadas'] });
      toast.success('Jornada salva');
    },
    onError: (e) => { console.error(e); toast.error('Erro ao salvar estrutura'); },
  });
}

// ─── Monitoramento: % de execução da jornada ATUAL de cada cliente (para o console CS) ─

export interface JornadaProgresso { done: number; total: number; pct: number }

export function useCsJornadasProgress() {
  return useQuery({
    queryKey: ['cs-jornadas-progress'],
    queryFn: async (): Promise<Record<string, JornadaProgresso>> => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select('user_id, periodo_ref, created_at, jornada_estagios ( jornada_passos ( concluido ) )')
        .in('status', ['ativa', 'concluida']);
      if (error) throw error;
      // Uma entrada por cliente = a jornada mais recente (por periodo_ref, senão created_at).
      const latestKey: Record<string, string> = {};
      const out: Record<string, JornadaProgresso> = {};
      for (const j of (data ?? [])) {
        const key = (j.periodo_ref ?? j.created_at) as string;
        if (latestKey[j.user_id] && key <= latestKey[j.user_id]) continue;
        const passos = (j.jornada_estagios ?? []).flatMap((e: any) => e.jornada_passos ?? []);
        const total = passos.length;
        const done = passos.filter((p: any) => p.concluido).length;
        latestKey[j.user_id] = key;
        out[j.user_id] = { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
      }
      return out;
    },
    staleTime: 60_000,
  });
}

// ─── Overview: TODAS as jornadas de TODOS os clientes (para a aba Jornadas) ────

export interface JornadaOverviewItem {
  id: string;
  titulo: string;
  status: 'rascunho' | 'ativa' | 'concluida';
  tipo: 'onboarding' | 'mensal' | null;
  periodo_ref: string | null;
  created_at: string;
  done: number;
  total: number;
  pct: number;
}

export function useCsJornadasOverview() {
  return useQuery({
    queryKey: ['cs-jornadas-overview'],
    queryFn: async (): Promise<Record<string, JornadaOverviewItem[]>> => {
      const { data, error } = await (supabase as any)
        .from('jornadas')
        .select('id, user_id, titulo, status, tipo, periodo_ref, created_at, jornada_estagios ( jornada_passos ( concluido ) )')
        .order('periodo_ref', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      const out: Record<string, JornadaOverviewItem[]> = {};
      for (const j of (data ?? [])) {
        const passos = (j.jornada_estagios ?? []).flatMap((e: any) => e.jornada_passos ?? []);
        const total = passos.length;
        const done = passos.filter((p: any) => p.concluido).length;
        const item: JornadaOverviewItem = {
          id: j.id, titulo: j.titulo, status: j.status, tipo: j.tipo ?? null,
          periodo_ref: j.periodo_ref ?? null, created_at: j.created_at,
          done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0,
        };
        (out[j.user_id] ||= []).push(item);
      }
      return out;
    },
    staleTime: 60_000,
  });
}

// ─── Rascunhar com o Athos CS (chama a edge function cs-athos em modo estruturado) ─

export function useRascunharComAthosCs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientOrgId, crmUserId, periodoRef }: { clientOrgId: string; crmUserId: string; periodoRef: string }) => {
      const { data, error } = await supabase.functions.invoke('cs-athos', {
        body: { mode: 'rascunhar_jornada', client_org_id: clientOrgId, crm_user_id: crmUserId, periodo_ref: periodoRef },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { jornada_id: string; titulo: string };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cs-client-jornadas', v.crmUserId] });
      toast.success('Rascunho gerado pelo Athos CS');
    },
    onError: (e: any) => toast.error('Erro ao gerar rascunho: ' + (e?.message ?? '')),
  });
}
