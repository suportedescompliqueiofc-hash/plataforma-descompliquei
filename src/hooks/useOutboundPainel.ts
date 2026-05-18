import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { startOfDay, startOfWeek, startOfMonth, endOfDay, eachDayOfInterval, format } from 'date-fns';

export interface PeriodoFiltro {
  tipo: 'hoje' | 'semana' | 'mes' | 'personalizado';
  inicio?: Date;
  fim?: Date;
}

export interface FunilData {
  ligacoes: number;
  conexoes: number;
  qualificados: number;
  calls_agendadas: number;
  fechamentos: number;
  tx_atendimento: number;
  tx_qualificacao: number;
  tx_agendamento: number;
  tx_fechamento: number;
}

export interface SdrPerformance {
  usuario_id: string;
  nome: string;
  ligacoes: number;
  conexoes: number;
  tx_atendimento: number;
  qualificados: number;
  calls_agendadas: number;
  fechamentos: number;
}

export interface MetricasSecundarias {
  tx_atendimento_geral: number;
  media_tentativas_qualificar: number;
  ligacoes_por_dia: number;
  show_rate: number;
}

export interface EvolucaoDiaria {
  dia: string;
  ligacoes: number;
  conexoes: number;
  calls: number;
}

export interface DistribuicaoResultado {
  resultado: string;
  count: number;
}

export interface ScriptComparativo {
  id: string;
  nome: string;
  ligacoes: number;
  tx_atendimento: number;
  tx_qualificacao: number;
  tx_agendamento: number;
  melhor: boolean;
}

export interface FilaAcao {
  id: string;
  nome: string;
  clinica: string | null;
  especialidade: string | null;
  proxima_acao_data: string;
  proxima_acao: string | null;
  total_tentativas: number;
  lead_scoring: string | null;
  stage_nome: string | null;
  stage_cor: string | null;
}

function getDateRange(periodo: PeriodoFiltro): { inicio: Date; fim: Date } {
  const now = new Date();
  switch (periodo.tipo) {
    case 'hoje':
      return { inicio: startOfDay(now), fim: endOfDay(now) };
    case 'semana':
      return { inicio: startOfWeek(now, { weekStartsOn: 1 }), fim: endOfDay(now) };
    case 'mes':
      return { inicio: startOfMonth(now), fim: endOfDay(now) };
    case 'personalizado':
      return {
        inicio: periodo.inicio ? startOfDay(periodo.inicio) : startOfMonth(now),
        fim: periodo.fim ? endOfDay(periodo.fim) : endOfDay(now),
      };
  }
}

export function useOutboundPainel(periodo: PeriodoFiltro, sdrId: string | null) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const { inicio, fim } = getDateRange(periodo);
  const inicioISO = inicio.toISOString();
  const fimISO = fim.toISOString();

  return useQuery({
    queryKey: ['outbound_painel', orgId, periodo.tipo, inicioISO, fimISO, sdrId],
    queryFn: async () => {
      if (!orgId) return null;

      let ligacoesQuery = (supabase as any)
        .from('outbound_ligacoes')
        .select('id, data_hora, status, resultado, usuario_id, script_id, numero_tentativa, duracao_segundos, prospecto_id')
        .eq('organization_id', orgId)
        .gte('data_hora', inicioISO)
        .lte('data_hora', fimISO);
      if (sdrId) ligacoesQuery = ligacoesQuery.eq('usuario_id', sdrId);

      let prospectosQuery = (supabase as any)
        .from('outbound_prospectos')
        .select('id, lead_scoring, total_tentativas, stage_id, proxima_acao_data, proxima_acao, nome, clinica, especialidade, criado_em, outbound_stages:stage_id(nome, cor, tipo)')
        .eq('organization_id', orgId);
      if (sdrId) prospectosQuery = prospectosQuery.eq('usuario_id', sdrId);

      const scriptsQuery = (supabase as any)
        .from('outbound_scripts')
        .select('id, nome, status')
        .eq('organization_id', orgId)
        .in('status', ['aprovado', 'em_teste']);

      const [ligRes, prospRes, scriptRes] = await Promise.all([
        ligacoesQuery,
        prospectosQuery,
        scriptsQuery,
      ]);

      if (ligRes.error) throw ligRes.error;
      if (prospRes.error) throw prospRes.error;
      if (scriptRes.error) throw scriptRes.error;

      const ligacoes: any[] = ligRes.data || [];
      const prospectos: any[] = prospRes.data || [];
      const scripts: any[] = scriptRes.data || [];

      // --- FUNIL ---
      const totalLigacoes = ligacoes.length;
      const conexoes = ligacoes.filter(l => l.status === 'atendeu').length;
      const qualificadosLig = ligacoes.filter(l => l.resultado === 'qualificado').length;
      const callsAgendadas = ligacoes.filter(l => l.resultado === 'agendou_call').length;

      const ganhoStageIds = new Set(
        prospectos
          .filter((p: any) => p.outbound_stages?.tipo === 'ganho')
          .map((p: any) => p.id)
      );
      const prospectosNoPeriodo = prospectos.filter((p: any) => {
        const d = new Date(p.criado_em);
        return d >= inicio && d <= fim;
      });
      const fechamentos = prospectosNoPeriodo.filter((p: any) => ganhoStageIds.has(p.id)).length;

      const funil: FunilData = {
        ligacoes: totalLigacoes,
        conexoes,
        qualificados: qualificadosLig,
        calls_agendadas: callsAgendadas,
        fechamentos,
        tx_atendimento: totalLigacoes > 0 ? Math.round((conexoes / totalLigacoes) * 1000) / 10 : 0,
        tx_qualificacao: conexoes > 0 ? Math.round((qualificadosLig / conexoes) * 1000) / 10 : 0,
        tx_agendamento: conexoes > 0 ? Math.round((callsAgendadas / conexoes) * 1000) / 10 : 0,
        tx_fechamento: callsAgendadas > 0 ? Math.round((fechamentos / callsAgendadas) * 1000) / 10 : 0,
      };

      // --- SDR PERFORMANCE ---
      const sdrMap = new Map<string, { ligacoes: any[] }>();
      ligacoes.forEach(l => {
        if (!l.usuario_id) return;
        if (!sdrMap.has(l.usuario_id)) sdrMap.set(l.usuario_id, { ligacoes: [] });
        sdrMap.get(l.usuario_id)!.ligacoes.push(l);
      });

      const { data: perfisData } = await supabase
        .from('perfis')
        .select('id, nome_completo')
        .eq('organization_id', orgId);
      const perfisMap = new Map((perfisData || []).map(p => [p.id, p.nome_completo || 'Sem nome']));

      const sdrPerformance: SdrPerformance[] = Array.from(sdrMap.entries())
        .map(([uid, data]) => {
          const ligs = data.ligacoes;
          const con = ligs.filter(l => l.status === 'atendeu').length;
          return {
            usuario_id: uid,
            nome: perfisMap.get(uid) || 'Sem nome',
            ligacoes: ligs.length,
            conexoes: con,
            tx_atendimento: ligs.length > 0 ? Math.round((con / ligs.length) * 1000) / 10 : 0,
            qualificados: ligs.filter(l => l.resultado === 'qualificado').length,
            calls_agendadas: ligs.filter(l => l.resultado === 'agendou_call').length,
            fechamentos: 0,
          };
        })
        .sort((a, b) => b.ligacoes - a.ligacoes);

      // --- MÉTRICAS SECUNDÁRIAS ---
      const diasNoPeriodo = Math.max(1, Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
      const prospectosQualificados = prospectos.filter(p => p.lead_scoring === 'A' || p.lead_scoring === 'B');
      const mediaTentativas = prospectosQualificados.length > 0
        ? Math.round((prospectosQualificados.reduce((s: number, p: any) => s + (p.total_tentativas || 0), 0) / prospectosQualificados.length) * 10) / 10
        : 0;

      const metricas: MetricasSecundarias = {
        tx_atendimento_geral: funil.tx_atendimento,
        media_tentativas_qualificar: mediaTentativas,
        ligacoes_por_dia: Math.round((totalLigacoes / diasNoPeriodo) * 10) / 10,
        show_rate: 0,
      };

      // --- EVOLUÇÃO DIÁRIA ---
      const days = eachDayOfInterval({ start: inicio, end: fim > new Date() ? new Date() : fim });
      const evolucao: EvolucaoDiaria[] = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayLigs = ligacoes.filter(l => format(new Date(l.data_hora), 'yyyy-MM-dd') === dayStr);
        return {
          dia: format(day, 'dd/MM'),
          ligacoes: dayLigs.length,
          conexoes: dayLigs.filter(l => l.status === 'atendeu').length,
          calls: dayLigs.filter(l => l.resultado === 'agendou_call').length,
        };
      });

      // --- DISTRIBUIÇÃO RESULTADOS ---
      const resultadoMap = new Map<string, number>();
      ligacoes.forEach(l => {
        const key = l.resultado || l.status || 'sem_resultado';
        resultadoMap.set(key, (resultadoMap.get(key) || 0) + 1);
      });
      const distribuicao: DistribuicaoResultado[] = Array.from(resultadoMap.entries())
        .map(([resultado, count]) => ({ resultado, count }))
        .sort((a, b) => b.count - a.count);

      // --- SCRIPTS COMPARATIVO ---
      const scriptComparativo: ScriptComparativo[] = scripts.map((s: any) => {
        const sLigs = ligacoes.filter(l => l.script_id === s.id);
        const sCon = sLigs.filter(l => l.status === 'atendeu').length;
        const sQual = sLigs.filter(l => l.resultado === 'qualificado').length;
        const sCall = sLigs.filter(l => l.resultado === 'agendou_call').length;
        return {
          id: s.id,
          nome: s.nome,
          ligacoes: sLigs.length,
          tx_atendimento: sLigs.length > 0 ? Math.round((sCon / sLigs.length) * 1000) / 10 : 0,
          tx_qualificacao: sCon > 0 ? Math.round((sQual / sCon) * 1000) / 10 : 0,
          tx_agendamento: sCon > 0 ? Math.round((sCall / sCon) * 1000) / 10 : 0,
          melhor: false,
        };
      });
      if (scriptComparativo.length > 0) {
        const melhorIdx = scriptComparativo.reduce((best, s, i) =>
          s.tx_agendamento > scriptComparativo[best].tx_agendamento ? i : best, 0);
        if (scriptComparativo[melhorIdx].ligacoes > 0) {
          scriptComparativo[melhorIdx].melhor = true;
        }
      }

      // --- FILA DE AÇÃO ---
      const hoje = startOfDay(new Date());
      const fila: FilaAcao[] = prospectos
        .filter((p: any) => {
          if (!p.proxima_acao_data) return false;
          if (p.outbound_stages?.tipo !== 'ativo') return false;
          return new Date(p.proxima_acao_data) <= endOfDay(new Date());
        })
        .sort((a: any, b: any) => new Date(a.proxima_acao_data).getTime() - new Date(b.proxima_acao_data).getTime())
        .slice(0, 10)
        .map((p: any) => ({
          id: p.id,
          nome: p.nome,
          clinica: p.clinica,
          especialidade: p.especialidade,
          proxima_acao_data: p.proxima_acao_data,
          proxima_acao: p.proxima_acao,
          total_tentativas: p.total_tentativas || 0,
          lead_scoring: p.lead_scoring,
          stage_nome: p.outbound_stages?.nome || null,
          stage_cor: p.outbound_stages?.cor || null,
        }));

      return { funil, sdrPerformance, metricas, evolucao, distribuicao, scriptComparativo, fila };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
