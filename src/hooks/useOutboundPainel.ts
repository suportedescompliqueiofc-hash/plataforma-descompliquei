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
  leads_contatados: number;
  conexoes: number;
  decisores: number;
  calls_agendadas: number;
  fechamentos: number;
  tx_atendimento: number;
  tx_decisor: number;
  tx_agendamento: number;
  tx_fechamento: number;
}

export interface SdrPerformance {
  usuario_id: string;
  nome: string;
  leads_contatados: number;
  ligacoes: number;
  conexoes: number;
  tx_atendimento: number;
  calls_agendadas: number;
  fechamentos: number;
}

export interface MetricasSecundarias {
  tx_atendimento_geral: number;
  media_tentativas_qualificar: number;
  ligacoes_por_dia: number;
  show_rate: number;
}

export interface MetricasTempo {
  tempo_total_seg: number;
  tempo_total_conexoes_seg: number;
  media_duracao_geral_seg: number;
  media_duracao_conexoes_seg: number;
  mediana_duracao_conexoes_seg: number;
  maior_ligacao_seg: number;
  menor_conexao_seg: number;
  ligacoes_curtas: number; // < 30s
  ligacoes_medias: number; // 30s–120s
  ligacoes_longas: number; // > 120s
  tempo_por_sdr: { nome: string; total_seg: number; media_seg: number; ligacoes: number }[];
  distribuicao_faixas: { faixa: string; count: number }[];
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

export interface MetricaHorario {
  hora: number;
  horaLabel: string;
  ligacoes: number;
  conexoes: number;
  tx_atendimento: number;
  qualificados: number;
  agendamentos: number;
  tx_qualificacao: number;
  tx_agendamento: number;
  duracao_media_seg: number;
  resultados_positivos: number; // qualificado + agendou_call
  tx_resultado_positivo: number;
}

export interface LeadsContatoBreakdown {
  total: number; // leads únicos no período
  total_contatos: number; // soma de leads únicos por dia (conta repetições entre dias)
  novos: number; // leads cujo primeiro contato all-time é dentro do período
  recontatados: number; // leads cujo primeiro contato all-time é anterior ao período
}

export interface PersistenciaFaixa {
  faixa: string;
  dias_unicos: number; // min days in this bucket
  leads: number;
  total_tentativas: number;
  media_tentativas: number;
  conexoes: number;
  qualificados: number;
  agendamentos: number;
  tx_atendimento: number;
  tx_resultado_positivo: number;
}

export interface AnalisePersistencia {
  breakdown: LeadsContatoBreakdown;
  porFaixa: PersistenciaFaixa[];
  mediaDiasParaConexao: number;
  mediaTentativasParaConexao: number;
  mediaDiasParaAgendamento: number;
  mediaTentativasParaAgendamento: number;
  leadsMaisContatados: { nome: string; clinica: string | null; dias: number; tentativas: number; resultado: string }[];
}

export interface RitmoSdr {
  usuario_id: string;
  nome: string;
  ligacoes: number;
  leads_contatados: number;
  primeira_ligacao: string;
  ultima_ligacao: string;
  horas_ativas: number; // quantidade de horas distintas em que efetivamente ligou
  lig_por_hora: number;
  leads_por_hora: number;
  lig_por_minuto: number;
  por_hora: { hora: string; count: number }[];
}

export interface RitmoLigacoes {
  geral_lig_por_hora: number;
  geral_leads_por_hora: number;
  geral_lig_por_minuto: number;
  horas_ativas_total: number;
  total_leads_contatados: number;
  por_sdr: RitmoSdr[];
}

export interface AnaliseHorarios {
  porHora: MetricaHorario[];
  melhorHoraConexao: string | null;
  melhorHoraAgendamento: string | null;
  melhorHoraQualificacao: string | null;
  picoLigacoes: string | null;
  horasMaisEficientes: string[]; // top 3 by tx_resultado_positivo
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
        .select('id, data_hora, status, resultado, usuario_id, script_id, numero_tentativa, duracao_segundos, prospecto_id, contato_decisor, contato_secretaria')
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

      // Todas as ligações (all-time) para análise de persistência e novos vs recontatos
      let allTimeLigQuery = (supabase as any)
        .from('outbound_ligacoes')
        .select('id, data_hora, status, resultado, prospecto_id')
        .eq('organization_id', orgId)
        .order('data_hora', { ascending: true });
      if (sdrId) allTimeLigQuery = allTimeLigQuery.eq('usuario_id', sdrId);

      const [ligRes, prospRes, scriptRes, allTimeLigRes] = await Promise.all([
        ligacoesQuery,
        prospectosQuery,
        scriptsQuery,
        allTimeLigQuery,
      ]);

      if (ligRes.error) throw ligRes.error;
      if (prospRes.error) throw prospRes.error;
      if (scriptRes.error) throw scriptRes.error;
      if (allTimeLigRes.error) throw allTimeLigRes.error;

      const ligacoes: any[] = ligRes.data || [];
      const prospectos: any[] = prospRes.data || [];
      const scripts: any[] = scriptRes.data || [];
      const allTimeLigacoes: any[] = allTimeLigRes.data || [];

      // --- FUNIL ---
      const totalLigacoes = ligacoes.length;
      const leadsContatados = new Set(
        ligacoes.map(l => l.prospecto_id).filter(Boolean)
      ).size;
      const conexoes = ligacoes.filter(l => l.status === 'atendeu').length;
      const decisoresContatados = ligacoes.filter(l => l.contato_decisor === true).length;
      const callsAgendadas = ligacoes.filter(l => (l.resultado || '').includes('agendou_call')).length;

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

      // IDs de prospectos por etapa do funil (para drill-down)
      const idsLeadsContatados = Array.from(new Set(ligacoes.map((l: any) => l.prospecto_id).filter(Boolean)));
      const idsConexoes = Array.from(new Set(ligacoes.filter((l: any) => l.status === 'atendeu').map((l: any) => l.prospecto_id).filter(Boolean)));
      const idsDecisores = Array.from(new Set(ligacoes.filter((l: any) => l.contato_decisor === true).map((l: any) => l.prospecto_id).filter(Boolean)));
      const idsCalls = Array.from(new Set(ligacoes.filter((l: any) => (l.resultado || '').includes('agendou_call')).map((l: any) => l.prospecto_id).filter(Boolean)));
      const idsFechamentos = prospectosNoPeriodo.filter((p: any) => ganhoStageIds.has(p.id)).map((p: any) => p.id);

      const funilProspectoIds = {
        leads_contatados: idsLeadsContatados as string[],
        conexoes: idsConexoes as string[],
        decisores: idsDecisores as string[],
        calls_agendadas: idsCalls as string[],
        fechamentos: idsFechamentos as string[],
      };

      const funil: FunilData = {
        ligacoes: totalLigacoes,
        leads_contatados: leadsContatados,
        conexoes,
        decisores: decisoresContatados,
        calls_agendadas: callsAgendadas,
        fechamentos,
        tx_atendimento: totalLigacoes > 0 ? Math.round((conexoes / totalLigacoes) * 1000) / 10 : 0,
        tx_decisor: conexoes > 0 ? Math.round((decisoresContatados / conexoes) * 1000) / 10 : 0,
        tx_agendamento: decisoresContatados > 0 ? Math.round((callsAgendadas / decisoresContatados) * 1000) / 10 : 0,
        tx_fechamento: callsAgendadas > 0 ? Math.round((fechamentos / callsAgendadas) * 1000) / 10 : 0,
      };

      // --- SDR PERFORMANCE ---
      // Atribuir cada lead ao SDR que fez a última ligação (sem duplicar entre SDRs)
      const leadOwnerMap = new Map<string, { sdrId: string; dataHora: string }>();
      ligacoes.forEach(l => {
        if (!l.usuario_id || !l.prospecto_id) return;
        const current = leadOwnerMap.get(l.prospecto_id);
        if (!current || l.data_hora > current.dataHora) {
          leadOwnerMap.set(l.prospecto_id, { sdrId: l.usuario_id, dataHora: l.data_hora });
        }
      });

      const sdrLeadsMap = new Map<string, Set<string>>();
      leadOwnerMap.forEach(({ sdrId }, prospectoId) => {
        if (!sdrLeadsMap.has(sdrId)) sdrLeadsMap.set(sdrId, new Set());
        sdrLeadsMap.get(sdrId)!.add(prospectoId);
      });

      const sdrMap = new Map<string, { ligacoes: any[] }>();
      ligacoes.forEach(l => {
        if (!l.usuario_id) return;
        if (!sdrMap.has(l.usuario_id)) sdrMap.set(l.usuario_id, { ligacoes: [] });
        sdrMap.get(l.usuario_id)!.ligacoes.push(l);
      });

      const userIds = Array.from(new Set(ligacoes.map((l: any) => l.usuario_id).filter(Boolean)));
      const { data: perfisData } = userIds.length > 0
        ? await supabase.from('perfis').select('id, nome_completo').in('id', userIds)
        : { data: [] };
      const perfisMap = new Map((perfisData || []).map(p => [p.id, p.nome_completo || 'Sem nome']));

      const sdrPerformance: SdrPerformance[] = Array.from(sdrMap.entries())
        .map(([uid, data]) => {
          const ligs = data.ligacoes;
          const con = ligs.filter(l => l.status === 'atendeu').length;
          return {
            usuario_id: uid,
            nome: perfisMap.get(uid) || 'Sem nome',
            leads_contatados: sdrLeadsMap.get(uid)?.size || 0,
            ligacoes: ligs.length,
            conexoes: con,
            tx_atendimento: ligs.length > 0 ? Math.round((con / ligs.length) * 1000) / 10 : 0,
            calls_agendadas: ligs.filter(l => (l.resultado || '').includes('agendou_call')).length,
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
          calls: dayLigs.filter(l => (l.resultado || '').includes('agendou_call')).length,
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
        const sQual = sLigs.filter(l => (l.resultado || '').includes('qualificado')).length;
        const sCall = sLigs.filter(l => (l.resultado || '').includes('agendou_call')).length;
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

      // --- MÉTRICAS DE TEMPO ---
      const ligsComDuracao = ligacoes.filter(l => l.duracao_segundos != null && l.duracao_segundos > 0);
      const conexoesComDuracao = ligacoes.filter(l => l.status === 'atendeu' && l.duracao_segundos != null && l.duracao_segundos > 0);

      const tempoTotalSeg = ligsComDuracao.reduce((s: number, l: any) => s + l.duracao_segundos, 0);
      const tempoTotalConexoesSeg = conexoesComDuracao.reduce((s: number, l: any) => s + l.duracao_segundos, 0);

      const mediaDuracaoGeral = ligsComDuracao.length > 0 ? Math.round(tempoTotalSeg / ligsComDuracao.length) : 0;
      const mediaDuracaoConexoes = conexoesComDuracao.length > 0 ? Math.round(tempoTotalConexoesSeg / conexoesComDuracao.length) : 0;

      // Mediana das conexões
      const duracaoConexoesSorted = conexoesComDuracao.map((l: any) => l.duracao_segundos).sort((a: number, b: number) => a - b);
      let medianaConexoes = 0;
      if (duracaoConexoesSorted.length > 0) {
        const mid = Math.floor(duracaoConexoesSorted.length / 2);
        medianaConexoes = duracaoConexoesSorted.length % 2 !== 0
          ? duracaoConexoesSorted[mid]
          : Math.round((duracaoConexoesSorted[mid - 1] + duracaoConexoesSorted[mid]) / 2);
      }

      const maiorLigacao = ligsComDuracao.length > 0 ? Math.max(...ligsComDuracao.map((l: any) => l.duracao_segundos)) : 0;
      const menorConexao = conexoesComDuracao.length > 0 ? Math.min(...conexoesComDuracao.map((l: any) => l.duracao_segundos)) : 0;

      const ligacoesCurtas = ligsComDuracao.filter((l: any) => l.duracao_segundos < 30).length;
      const ligacoesMedias = ligsComDuracao.filter((l: any) => l.duracao_segundos >= 30 && l.duracao_segundos <= 120).length;
      const ligacoesLongas = ligsComDuracao.filter((l: any) => l.duracao_segundos > 120).length;

      // Faixas detalhadas de distribuição
      const faixas = [
        { faixa: '0–15s', min: 0, max: 15 },
        { faixa: '16–30s', min: 16, max: 30 },
        { faixa: '31–60s', min: 31, max: 60 },
        { faixa: '1–2min', min: 61, max: 120 },
        { faixa: '2–5min', min: 121, max: 300 },
        { faixa: '5–10min', min: 301, max: 600 },
        { faixa: '10min+', min: 601, max: Infinity },
      ];
      const distribuicaoFaixas = faixas.map(f => ({
        faixa: f.faixa,
        count: ligsComDuracao.filter((l: any) => l.duracao_segundos >= f.min && l.duracao_segundos <= f.max).length,
      }));

      // Tempo por SDR
      const sdrTempoMap = new Map<string, { total: number; count: number }>();
      ligsComDuracao.forEach((l: any) => {
        if (!l.usuario_id) return;
        const cur = sdrTempoMap.get(l.usuario_id) || { total: 0, count: 0 };
        cur.total += l.duracao_segundos;
        cur.count += 1;
        sdrTempoMap.set(l.usuario_id, cur);
      });
      const tempoPorSdr = Array.from(sdrTempoMap.entries())
        .map(([uid, d]) => ({
          nome: perfisMap.get(uid) || 'Sem nome',
          total_seg: d.total,
          media_seg: Math.round(d.total / d.count),
          ligacoes: d.count,
        }))
        .sort((a, b) => b.total_seg - a.total_seg);

      const metricasTempo: MetricasTempo = {
        tempo_total_seg: tempoTotalSeg,
        tempo_total_conexoes_seg: tempoTotalConexoesSeg,
        media_duracao_geral_seg: mediaDuracaoGeral,
        media_duracao_conexoes_seg: mediaDuracaoConexoes,
        mediana_duracao_conexoes_seg: medianaConexoes,
        maior_ligacao_seg: maiorLigacao,
        menor_conexao_seg: menorConexao,
        ligacoes_curtas: ligacoesCurtas,
        ligacoes_medias: ligacoesMedias,
        ligacoes_longas: ligacoesLongas,
        tempo_por_sdr: tempoPorSdr,
        distribuicao_faixas: distribuicaoFaixas,
      };

      // --- ANÁLISE POR HORÁRIO ---
      const horaMap = new Map<number, { ligacoes: any[] }>();
      for (let h = 0; h < 24; h++) horaMap.set(h, { ligacoes: [] });

      ligacoes.forEach((l: any) => {
        const hora = new Date(l.data_hora).getHours();
        horaMap.get(hora)!.ligacoes.push(l);
      });

      const porHora: MetricaHorario[] = Array.from(horaMap.entries())
        .map(([hora, data]) => {
          const ligs = data.ligacoes;
          const total = ligs.length;
          const con = ligs.filter((l: any) => l.status === 'atendeu').length;
          const qual = ligs.filter((l: any) => (l.resultado || '').includes('qualificado')).length;
          const agend = ligs.filter((l: any) => (l.resultado || '').includes('agendou_call')).length;
          const positivos = ligs.filter((l: any) => {
            const r = l.resultado || '';
            return r.includes('qualificado') || r.includes('agendou_call');
          }).length;
          const ligsComDur = ligs.filter((l: any) => l.duracao_segundos != null && l.duracao_segundos > 0);
          const durMedia = ligsComDur.length > 0
            ? Math.round(ligsComDur.reduce((s: number, l: any) => s + l.duracao_segundos, 0) / ligsComDur.length)
            : 0;

          return {
            hora,
            horaLabel: `${hora.toString().padStart(2, '0')}:00`,
            ligacoes: total,
            conexoes: con,
            tx_atendimento: total > 0 ? Math.round((con / total) * 1000) / 10 : 0,
            qualificados: qual,
            agendamentos: agend,
            tx_qualificacao: con > 0 ? Math.round((qual / con) * 1000) / 10 : 0,
            tx_agendamento: con > 0 ? Math.round((agend / con) * 1000) / 10 : 0,
            duracao_media_seg: durMedia,
            resultados_positivos: positivos,
            tx_resultado_positivo: con > 0 ? Math.round((positivos / con) * 1000) / 10 : 0,
          };
        })
        .filter(h => h.ligacoes > 0)
        .sort((a, b) => a.hora - b.hora);

      // Determinar melhores horários (mínimo 3 ligações para relevância)
      const horasRelevantes = porHora.filter(h => h.ligacoes >= 3);
      const melhorConexao = horasRelevantes.length > 0
        ? horasRelevantes.reduce((best, h) => h.tx_atendimento > best.tx_atendimento ? h : best)
        : null;
      const melhorAgend = horasRelevantes.length > 0
        ? horasRelevantes.reduce((best, h) => h.tx_agendamento > best.tx_agendamento ? h : best)
        : null;
      const melhorQual = horasRelevantes.length > 0
        ? horasRelevantes.reduce((best, h) => h.tx_qualificacao > best.tx_qualificacao ? h : best)
        : null;
      const picoLig = porHora.length > 0
        ? porHora.reduce((best, h) => h.ligacoes > best.ligacoes ? h : best)
        : null;
      const horasMaisEficientes = [...horasRelevantes]
        .sort((a, b) => b.tx_resultado_positivo - a.tx_resultado_positivo)
        .slice(0, 3)
        .map(h => h.horaLabel);

      const analiseHorarios: AnaliseHorarios = {
        porHora,
        melhorHoraConexao: melhorConexao && melhorConexao.tx_atendimento > 0 ? melhorConexao.horaLabel : null,
        melhorHoraAgendamento: melhorAgend && melhorAgend.tx_agendamento > 0 ? melhorAgend.horaLabel : null,
        melhorHoraQualificacao: melhorQual && melhorQual.tx_qualificacao > 0 ? melhorQual.horaLabel : null,
        picoLigacoes: picoLig ? picoLig.horaLabel : null,
        horasMaisEficientes,
      };

      // --- ANÁLISE DE PERSISTÊNCIA (NOVOS vs RECONTATOS) ---
      // Primeiro contato de cada prospecto (all-time)
      const primeiroContatoMap = new Map<string, string>(); // prospecto_id → first data_hora
      allTimeLigacoes.forEach((l: any) => {
        if (!primeiroContatoMap.has(l.prospecto_id)) {
          primeiroContatoMap.set(l.prospecto_id, l.data_hora); // already sorted asc
        }
      });

      // Prospectos contatados no período
      const prospectosNoPeriodoIds = new Set(ligacoes.map((l: any) => l.prospecto_id).filter(Boolean));
      let recontatados = 0;
      prospectosNoPeriodoIds.forEach((pid) => {
        const primeiroContato = primeiroContatoMap.get(pid);
        if (primeiroContato && new Date(primeiroContato) < inicio) {
          recontatados++;
        }
      });
      const novosCount = prospectosNoPeriodoIds.size - recontatados;

      // Total de contatos: soma de leads únicos por dia (um lead contatado em 3 dias = conta 3x)
      const leadsPorDiaMap = new Map<string, Set<string>>();
      ligacoes.forEach((l: any) => {
        if (!l.prospecto_id) return;
        const dia = l.data_hora.slice(0, 10);
        if (!leadsPorDiaMap.has(dia)) leadsPorDiaMap.set(dia, new Set());
        leadsPorDiaMap.get(dia)!.add(l.prospecto_id);
      });
      let totalContatos = 0;
      leadsPorDiaMap.forEach((leads) => { totalContatos += leads.size; });

      const breakdown: LeadsContatoBreakdown = {
        total: prospectosNoPeriodoIds.size,
        total_contatos: totalContatos,
        novos: novosCount,
        recontatados,
      };

      // Persistência: agrupar ALL-TIME ligações por prospecto
      const leadPersistMap = new Map<string, { ligs: any[]; diasSet: Set<string> }>();
      allTimeLigacoes.forEach((l: any) => {
        if (!l.prospecto_id) return;
        if (!leadPersistMap.has(l.prospecto_id)) {
          leadPersistMap.set(l.prospecto_id, { ligs: [], diasSet: new Set() });
        }
        const entry = leadPersistMap.get(l.prospecto_id)!;
        entry.ligs.push(l);
        entry.diasSet.add(l.data_hora.slice(0, 10));
      });

      // Faixas de dias de contato
      const faixasDias = [
        { faixa: '1 dia', min: 1, max: 1 },
        { faixa: '2 dias', min: 2, max: 2 },
        { faixa: '3 dias', min: 3, max: 3 },
        { faixa: '4–5 dias', min: 4, max: 5 },
        { faixa: '6–10 dias', min: 6, max: 10 },
        { faixa: '10+ dias', min: 11, max: Infinity },
      ];

      const porFaixa: PersistenciaFaixa[] = faixasDias.map(f => {
        const leadsNaFaixa: { ligs: any[]; diasSet: Set<string> }[] = [];
        leadPersistMap.forEach((data) => {
          const dias = data.diasSet.size;
          if (dias >= f.min && dias <= f.max) leadsNaFaixa.push(data);
        });

        const totalLeads = leadsNaFaixa.length;
        const totalTentativas = leadsNaFaixa.reduce((s, d) => s + d.ligs.length, 0);
        const totalConexoes = leadsNaFaixa.reduce((s, d) => s + d.ligs.filter((l: any) => l.status === 'atendeu').length, 0);
        const totalQual = leadsNaFaixa.reduce((s, d) => s + d.ligs.filter((l: any) => (l.resultado || '').includes('qualificado')).length, 0);
        const totalAgend = leadsNaFaixa.reduce((s, d) => s + d.ligs.filter((l: any) => (l.resultado || '').includes('agendou_call')).length, 0);

        return {
          faixa: f.faixa,
          dias_unicos: f.min,
          leads: totalLeads,
          total_tentativas: totalTentativas,
          media_tentativas: totalLeads > 0 ? Math.round((totalTentativas / totalLeads) * 10) / 10 : 0,
          conexoes: totalConexoes,
          qualificados: totalQual,
          agendamentos: totalAgend,
          tx_atendimento: totalTentativas > 0 ? Math.round((totalConexoes / totalTentativas) * 1000) / 10 : 0,
          tx_resultado_positivo: totalConexoes > 0 ? Math.round(((totalQual + totalAgend) / totalConexoes) * 1000) / 10 : 0,
        };
      });

      // Médias de dias/tentativas para atingir resultados
      let somasDiasConexao = 0, countConexao = 0;
      let somasTentConexao = 0;
      let somasDiasAgend = 0, countAgend = 0;
      let somasTentAgend = 0;

      leadPersistMap.forEach((data) => {
        const ligs = data.ligs;
        // Primeira conexão
        const primeiraConexao = ligs.find((l: any) => l.status === 'atendeu');
        if (primeiraConexao) {
          const idx = ligs.indexOf(primeiraConexao);
          const diasAte = new Set(ligs.slice(0, idx + 1).map((l: any) => l.data_hora.slice(0, 10))).size;
          somasDiasConexao += diasAte;
          somasTentConexao += idx + 1;
          countConexao++;
        }
        // Primeiro agendamento
        const primeiroAgend = ligs.find((l: any) => (l.resultado || '').includes('agendou_call'));
        if (primeiroAgend) {
          const idx = ligs.indexOf(primeiroAgend);
          const diasAte = new Set(ligs.slice(0, idx + 1).map((l: any) => l.data_hora.slice(0, 10))).size;
          somasDiasAgend += diasAte;
          somasTentAgend += idx + 1;
          countAgend++;
        }
      });

      // Top leads mais contatados (no período)
      const prospectosNomeMap = new Map<string, { nome: string; clinica: string | null }>();
      prospectos.forEach((p: any) => prospectosNomeMap.set(p.id, { nome: p.nome, clinica: p.clinica }));

      const leadsMaisContatados = Array.from(leadPersistMap.entries())
        .filter(([pid]) => prospectosNoPeriodoIds.has(pid))
        .map(([pid, data]) => {
          const info = prospectosNomeMap.get(pid);
          const temConexao = data.ligs.some((l: any) => l.status === 'atendeu');
          const temAgend = data.ligs.some((l: any) => (l.resultado || '').includes('agendou_call'));
          const temQual = data.ligs.some((l: any) => (l.resultado || '').includes('qualificado'));
          let resultado = 'Sem resultado';
          if (temAgend) resultado = 'Agendou call';
          else if (temQual) resultado = 'Qualificado';
          else if (temConexao) resultado = 'Atendeu';
          return {
            nome: info?.nome || 'Desconhecido',
            clinica: info?.clinica || null,
            dias: data.diasSet.size,
            tentativas: data.ligs.length,
            resultado,
          };
        })
        .sort((a, b) => b.tentativas - a.tentativas)
        .slice(0, 10);

      const analisePersistencia: AnalisePersistencia = {
        breakdown,
        porFaixa,
        mediaDiasParaConexao: countConexao > 0 ? Math.round((somasDiasConexao / countConexao) * 10) / 10 : 0,
        mediaTentativasParaConexao: countConexao > 0 ? Math.round((somasTentConexao / countConexao) * 10) / 10 : 0,
        mediaDiasParaAgendamento: countAgend > 0 ? Math.round((somasDiasAgend / countAgend) * 10) / 10 : 0,
        mediaTentativasParaAgendamento: countAgend > 0 ? Math.round((somasTentAgend / countAgend) * 10) / 10 : 0,
        leadsMaisContatados,
      };

      // --- RITMO DE LIGAÇÕES POR SDR ---
      // Horas ativas = horas distintas em que efetivamente foram feitas ligações
      const ritmoSdrs: RitmoSdr[] = Array.from(sdrMap.entries()).map(([uid, data]) => {
        const ligs = data.ligacoes.sort((a: any, b: any) => a.data_hora.localeCompare(b.data_hora));
        const primeira = ligs[0]?.data_hora || '';
        const ultima = ligs[ligs.length - 1]?.data_hora || '';

        // Horas distintas efetivas (ex: "2026-05-21-09", "2026-05-21-10")
        const horasDistintas = new Set<string>();
        const leadsSet = new Set<string>();
        ligs.forEach((l: any) => {
          const d = new Date(l.data_hora);
          horasDistintas.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`);
          if (l.prospecto_id) leadsSet.add(l.prospecto_id);
        });
        const horasAtivas = horasDistintas.size;
        const leadsContatados = leadsSet.size;
        const ligPorHora = horasAtivas > 0 ? Math.round((ligs.length / horasAtivas) * 10) / 10 : ligs.length;
        const leadsPorHora = horasAtivas > 0 ? Math.round((leadsContatados / horasAtivas) * 10) / 10 : leadsContatados;
        const minutosAtivos = horasAtivas * 60;
        const ligPorMinuto = minutosAtivos > 0 ? Math.round((ligs.length / minutosAtivos) * 100) / 100 : 0;

        // Distribuição por hora do dia
        const horaMap = new Map<number, number>();
        ligs.forEach((l: any) => {
          const h = new Date(l.data_hora).getHours();
          horaMap.set(h, (horaMap.get(h) || 0) + 1);
        });
        const porHoraArr = Array.from(horaMap.entries())
          .map(([h, count]) => ({ hora: `${h.toString().padStart(2, '0')}:00`, count }))
          .sort((a, b) => a.hora.localeCompare(b.hora));

        return {
          usuario_id: uid,
          nome: perfisMap.get(uid) || 'Sem nome',
          ligacoes: ligs.length,
          leads_contatados: leadsContatados,
          primeira_ligacao: primeira,
          ultima_ligacao: ultima,
          horas_ativas: horasAtivas,
          lig_por_hora: ligPorHora,
          leads_por_hora: leadsPorHora,
          lig_por_minuto: ligPorMinuto,
          por_hora: porHoraArr,
        };
      }).sort((a, b) => b.ligacoes - a.ligacoes);

      // Geral
      const horasDistintasGeral = new Set<string>();
      const leadsGeralSet = new Set<string>();
      ligacoes.forEach((l: any) => {
        const d = new Date(l.data_hora);
        horasDistintasGeral.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`);
        if (l.prospecto_id) leadsGeralSet.add(l.prospecto_id);
      });
      const horasAtivasTotal = horasDistintasGeral.size;
      const totalLeadsContatados = leadsGeralSet.size;
      const geralLigPorHora = horasAtivasTotal > 0 ? Math.round((ligacoes.length / horasAtivasTotal) * 10) / 10 : ligacoes.length;
      const geralLeadsPorHora = horasAtivasTotal > 0 ? Math.round((totalLeadsContatados / horasAtivasTotal) * 10) / 10 : totalLeadsContatados;
      const geralMinutos = horasAtivasTotal * 60;
      const geralLigPorMinuto = geralMinutos > 0 ? Math.round((ligacoes.length / geralMinutos) * 100) / 100 : 0;

      const ritmoLigacoes: RitmoLigacoes = {
        geral_lig_por_hora: geralLigPorHora,
        geral_leads_por_hora: geralLeadsPorHora,
        geral_lig_por_minuto: geralLigPorMinuto,
        horas_ativas_total: horasAtivasTotal,
        total_leads_contatados: totalLeadsContatados,
        por_sdr: ritmoSdrs,
      };

      // --- ÚLTIMA LIGAÇÃO POR PROSPECTO (para drilldown) ---
      const lastLigacaoMap = new Map<string, { sdr_nome: string; horario: string }>();
      ligacoes.forEach((l: any) => {
        if (!l.prospecto_id) return;
        const existing = lastLigacaoMap.get(l.prospecto_id);
        if (!existing || l.data_hora > existing.horario) {
          lastLigacaoMap.set(l.prospecto_id, {
            sdr_nome: perfisMap.get(l.usuario_id) || 'Sem nome',
            horario: l.data_hora,
          });
        }
      });

      return { funil, funilProspectoIds, sdrPerformance, metricas, metricasTempo, evolucao, distribuicao, scriptComparativo, fila, analiseHorarios, analisePersistencia, lastLigacaoMap, ritmoLigacoes };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
