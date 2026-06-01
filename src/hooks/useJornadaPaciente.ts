import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { differenceInDays } from 'date-fns';

export type EventoTipo =
  | 'entrada'
  | 'mensagem'
  | 'agendamento'
  | 'venda'
  | 'etapa'
  | 'scoring'
  | 'tag'
  | 'nota'
  | 'ia'
  | 'cadencia'
  | 'responsavel';

export interface AutorEvento {
  id: string;
  nome: string;
  url_avatar?: string | null;
}

export interface JornadaEvento {
  id: string;
  tipo: EventoTipo;
  data: string;
  titulo: string;
  descricao?: string;
  metadata?: Record<string, any>;
  autor?: AutorEvento;
}

export interface JornadaLead {
  id: string;
  nome?: string;
  telefone: string;
  email?: string;
  origem?: string;
  fonte?: string;
  status: string;
  posicao_pipeline: number;
  criado_em: string;
  atualizado_em: string;
  lead_scoring?: string | null;
  is_qualified?: boolean;
  is_scheduled?: boolean;
  is_closed?: boolean;
  ia_ativa?: boolean;
  queixa_principal?: string;
  procedimento_interesse?: string;
  resumo?: string;
  leads_tags?: { tags: { name: string; color: string } }[];
}

export interface JornadaStats {
  totalMensagens: number;
  mensagensEnviadas: number;
  mensagensRecebidas: number;
  totalAgendamentos: number;
  totalVendas: number;
  totalFaturamento: number;
  diasNoCRM: number;
  etapaAtual?: string;
  etapaAtualCor?: string;
  tempoRespostaMin?: number;
  totalSessoes: number;
}

// Etapas de IA que são ruído técnico — não exibir individualmente
const AI_ETAPAS_IGNORADAS = new Set([
  'acumulando', 'processando', 'aguardando', 'notificacao_enviada',
  'verificando', 'iniciando', 'token_count',
]);

// Etapas de IA que merecem evento próprio (destacado)
const AI_ETAPAS_DESTACADAS = new Set([
  'handoff', 'follow_up', 'bloqueada', 'pausada', 'reativada',
]);

// Etapas de IA que indicam que a IA respondeu ao paciente
const AI_ETAPAS_RESPOSTA = new Set([
  'concluido', 'resposta_enviada',
]);

export function useJornadaPaciente(leadId: string | undefined) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['jornada', leadId, orgId],
    queryFn: async () => {
      if (!leadId || !orgId) throw new Error('ID do lead nao encontrado');

      const [
        leadResult,
        mensagensResult,
        agendamentosResult,
        vendasResult,
        stageHistoryResult,
        etapasResult,
        notasResult,
        aiLogsResult,
        cadenciaLogsResult,
        leadsTagsResult,
        atividadesResult,
      ] = await Promise.all([
        supabase
          .from('leads')
          .select('*, leads_tags(tags(name, color))')
          .eq('id', leadId)
          .single(),
        supabase
          .from('mensagens')
          .select('id, criado_em, direcao, conteudo, tipo_conteudo')
          .eq('lead_id', leadId)
          .order('criado_em', { ascending: true }),
        supabase
          .from('agendamentos')
          .select('id, titulo, data_hora_inicio, data_hora_fim, status, resultado, procedimento_interesse, valor_orcado, tipo, observacoes_pos, criado_em')
          .eq('lead_id', leadId)
          .order('data_hora_inicio', { ascending: true }),
        supabase
          .from('vendas')
          .select('id, produto_servico, valor_fechado, data_fechamento, forma_pagamento, criado_em')
          .eq('lead_id', leadId)
          .order('data_fechamento', { ascending: true }),
        supabase
          .from('lead_stage_history')
          .select('id, stage_position, from_stage_position, entered_at')
          .eq('lead_id', leadId)
          .order('entered_at', { ascending: true }),
        supabase
          .from('etapas')
          .select('posicao_ordem, nome, cor')
          .eq('organization_id', orgId),
        supabase
          .from('lead_notas')
          .select('id, conteudo, tipo, criado_em, metadados')
          .eq('lead_id', leadId)
          .order('criado_em', { ascending: true }),
        supabase
          .from('ai_execution_logs')
          .select('id, etapa, detalhe, status, criado_em')
          .eq('lead_id', leadId)
          .order('criado_em', { ascending: true })
          .limit(500),
        supabase
          .from('cadencia_logs')
          .select('id, cadencia_id, passo_ordem, status, enviado_em, cadencias(nome)')
          .eq('lead_id', leadId)
          .eq('status', 'enviado')
          .order('enviado_em', { ascending: true }),
        supabase
          .from('leads_tags')
          .select('tag_id, assigned_at, tags(name, color)')
          .eq('lead_id', leadId)
          .order('assigned_at', { ascending: true }),
        supabase
          .from('lead_atividades' as any)
          .select('id, tipo, descricao, metadados, user_id, criado_em')
          .eq('lead_id', leadId)
          .order('criado_em', { ascending: true }),
      ]);

      const lead = leadResult.data as JornadaLead | null;
      if (!lead) throw new Error('Lead nao encontrado');

      const mensagens       = mensagensResult.data || [];
      const agendamentos    = agendamentosResult.data || [];
      const vendas          = vendasResult.data || [];
      const stageHistory    = stageHistoryResult.data || [];
      const etapas          = etapasResult.data || [];
      const notas           = notasResult.data || [];
      const aiLogs          = aiLogsResult.data || [];
      const cadenciaLogs    = cadenciaLogsResult.data || [];
      const leadsTags       = leadsTagsResult.data || [];
      const atividades      = (atividadesResult.data || []) as {
        id: string; tipo: string; descricao: string;
        metadados: Record<string, any>; user_id: string | null; criado_em: string;
      }[];

      // Buscar perfis dos autores das atividades (batch)
      const autorIds = [...new Set(atividades.map(a => a.user_id).filter(Boolean))] as string[];
      let autorPerfisMap = new Map<string, AutorEvento>();
      if (autorIds.length > 0) {
        const { data: perfisData } = await supabase
          .from('perfis')
          .select('id, nome_completo, url_avatar')
          .in('id', autorIds);
        for (const p of (perfisData || [])) {
          autorPerfisMap.set(p.id, {
            id: p.id,
            nome: p.nome_completo || 'Usuário',
            url_avatar: p.url_avatar,
          });
        }
      }

      // Mapas auxiliares para enriquecer eventos existentes com autor
      // etapaAutorMap: posicao_pipeline → AutorEvento (último registro, caso haja múltiplos)
      const etapaAutorMap = new Map<number, AutorEvento>();
      for (const at of atividades) {
        if (at.tipo === 'etapa' && at.user_id) {
          const autor = autorPerfisMap.get(at.user_id);
          if (autor) etapaAutorMap.set(at.metadados?.posicao_pipeline, autor);
        }
      }
      const criacaoAutor = atividades.find(a => a.tipo === 'criacao' && a.user_id)
        ? autorPerfisMap.get(atividades.find(a => a.tipo === 'criacao')!.user_id!)
        : undefined;

      // stage map: posicao_ordem → { nome, cor }
      const stageMap = new Map<number, { nome: string; cor: string }>();
      for (const e of etapas) stageMap.set(e.posicao_ordem, { nome: e.nome, cor: e.cor || '#888' });

      const eventos: JornadaEvento[] = [];

      // ─────────────────────────────────────────
      // 1. ENTRADA DO LEAD
      // ─────────────────────────────────────────
      eventos.push({
        id: `entrada-${lead.id}`,
        tipo: 'entrada',
        data: lead.criado_em,
        titulo: 'Paciente entrou em contato',
        descricao: [
          lead.origem ? `Origem: ${lead.origem}` : null,
          lead.fonte  ? `Fonte: ${lead.fonte}`   : null,
          lead.procedimento_interesse ? `Interesse: ${lead.procedimento_interesse}` : null,
        ].filter(Boolean).join(' • ') || undefined,
        metadata: { origem: lead.origem, fonte: lead.fonte },
        autor: criacaoAutor,
      });

      // ─────────────────────────────────────────
      // 2. ETAPAS DO PIPELINE (via lead_stage_history + trigger)
      // Backfill entries (from_stage_position = null) são apenas âncoras
      // para o trigger — NÃO exibir na timeline.
      // Etapas de handoff são enriquecidas com duração do pré-atendimento IA.
      // ─────────────────────────────────────────

      // Identificar posições de etapas de handoff para enriquecimento
      const handoffStagePositions = new Set<number>();
      for (const [pos, info] of stageMap.entries()) {
        if (info.nome.toLowerCase().includes('handoff') || info.nome.toLowerCase().includes('humano')) {
          handoffStagePositions.add(pos);
        }
      }

      for (const sh of stageHistory) {
        const fromPos = (sh as any).from_stage_position as number | null;
        // Pular backfill — representa posição atual, não uma transição real
        if (fromPos === null || fromPos === undefined) continue;

        const etapa = stageMap.get(sh.stage_position);
        const fromEtapa = stageMap.get(fromPos);
        const isHandoffStage = handoffStagePositions.has(sh.stage_position);

        // Para etapas de handoff: calcular duração do pré-atendimento IA
        let handoffDescricao: string | undefined;
        if (isHandoffStage) {
          const handoffTime = new Date(sh.entered_at || lead.criado_em).getTime();
          const entradaTime = new Date(lead.criado_em).getTime();
          const diffMin = Math.max(0, Math.round((handoffTime - entradaTime) / 60000));
          const tLabel = diffMin < 1 ? '< 1 min'
            : diffMin < 60 ? `${diffMin} min`
            : `${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? ` ${diffMin % 60}min` : ''}`;
          handoffDescricao = `Pre-atendimento automatizado durou ${tLabel}.`;
        }

        eventos.push({
          id: `etapa-${sh.id}`,
          tipo: 'etapa',
          data: sh.entered_at || lead.criado_em,
          titulo: isHandoffStage
            ? 'IA transferiu para atendente humano'
            : `Movido para "${etapa?.nome || `Posição ${sh.stage_position}`}"`,
          descricao: handoffDescricao,
          metadata: {
            stage_position: sh.stage_position,
            etapa_nome: etapa?.nome,
            etapa_cor: etapa?.cor,
            from_stage_nome: fromEtapa?.nome || undefined,
            from_stage_cor: fromEtapa?.cor || undefined,
            subtipo: isHandoffStage ? 'handoff' : undefined,
          },
          autor: etapaAutorMap.get(sh.stage_position),
        });
      }

      // ─────────────────────────────────────────
      // 3. MENSAGENS — sessões de conversa + marcos-chave
      // ─────────────────────────────────────────
      const primeiraRecebida = mensagens.find(m => m.direcao === 'entrada');
      const primeiraEnviada  = mensagens.find(m => m.direcao === 'saida');
      let tempoRespostaMin: number | undefined;

      // Marco: Primeiro contato do paciente (primeira mensagem recebida, qualquer tipo)
      if (primeiraRecebida) {
        // Só mostrar o tipo quando não for texto (o mais comum)
        const tipoConteudoLabel: Record<string, string> = {
          image: ' (imagem)', audio: ' (áudio)', video: ' (vídeo)',
          document: ' (documento)', sticker: ' (figurinha)', location: ' (localização)',
        };
        const tipoSuffix = primeiraRecebida.tipo_conteudo && primeiraRecebida.tipo_conteudo !== 'text'
          ? (tipoConteudoLabel[primeiraRecebida.tipo_conteudo] ?? ` (${primeiraRecebida.tipo_conteudo})`)
          : '';
        const preview = primeiraRecebida.tipo_conteudo === 'text' && primeiraRecebida.conteudo
          ? `"${primeiraRecebida.conteudo.slice(0, 200)}${primeiraRecebida.conteudo.length > 200 ? '...' : ''}"`
          : undefined;
        eventos.push({
          id: `primeiro-contato-${lead.id}`,
          tipo: 'mensagem',
          data: primeiraRecebida.criado_em,
          titulo: `Primeira mensagem do paciente${tipoSuffix}`,
          descricao: preview,
          metadata: { subtipo: 'primeiro_contato' },
        });
      }

      // Marco: Primeira resposta (KPI comercial + quem respondeu)
      if (primeiraRecebida && primeiraEnviada) {
        const diffMs = new Date(primeiraEnviada.criado_em).getTime() - new Date(primeiraRecebida.criado_em).getTime();
        tempoRespostaMin = Math.max(0, Math.round(diffMs / 60000));
        const tempoLabel = tempoRespostaMin < 1 ? '< 1 min'
          : tempoRespostaMin < 60 ? `${tempoRespostaMin} min`
          : `${Math.floor(tempoRespostaMin / 60)}h${tempoRespostaMin % 60 > 0 ? ` ${tempoRespostaMin % 60}min` : ''}`;

        // Detectar se a IA ou humano respondeu primeiro
        const firstOutTime = new Date(primeiraEnviada.criado_em).getTime();
        const foiIA = aiLogs.some(l =>
          AI_ETAPAS_RESPOSTA.has(l.etapa) &&
          Math.abs(new Date(l.criado_em).getTime() - firstOutTime) < 2 * 60 * 1000
        );

        eventos.push({
          id: `primeira-resposta-${lead.id}`,
          tipo: 'mensagem',
          data: primeiraEnviada.criado_em,
          titulo: `Primeira resposta ${foiIA ? 'pela IA' : 'por humano'} (${tempoLabel})`,
          descricao: primeiraEnviada.tipo_conteudo === 'text' && primeiraEnviada.conteudo
            ? `"${primeiraEnviada.conteudo.slice(0, 150)}${primeiraEnviada.conteudo.length > 150 ? '...' : ''}"` : undefined,
          metadata: { subtipo: 'primeira_resposta', tempo_resposta_min: tempoRespostaMin, atendente: foiIA ? 'ia' : 'humano' },
        });
      }

      // Sessões de conversa (gap > 30 min = nova sessão) — usadas apenas para contagem no stats
      const SESSION_GAP = 30 * 60 * 1000;
      let sessCount = 0;
      let lastMsgTime = 0;
      for (const msg of mensagens) {
        const t = new Date(msg.criado_em).getTime();
        if (!lastMsgTime || t - lastMsgTime > SESSION_GAP) sessCount++;
        lastMsgTime = t;
      }
      // Sessões NÃO geram eventos na timeline — primeiro contato e primeira resposta
      // são os marcos relevantes. O total de mensagens já aparece no sidebar de stats.

      // ─────────────────────────────────────────
      // 4. AGENDAMENTOS
      // ─────────────────────────────────────────
      const statusAgLabel: Record<string, string> = {
        agendado: 'Agendado',
        confirmado: 'Confirmado',
        realizado: 'Realizado',
        cancelado: 'Cancelado',
        nao_compareceu: 'Nao compareceu',
      };
      for (const ag of agendamentos) {
        const parts = [
          ag.resultado ? `Resultado: ${ag.resultado}` : null,
          ag.observacoes_pos ? `Obs: ${ag.observacoes_pos.slice(0, 80)}` : null,
        ].filter(Boolean);

        // Título: procedimento ou tipo + data do agendamento (não data de criação)
        const tipoAgLabel: Record<string, string> = {
          consulta: 'Consulta',
          retorno: 'Retorno',
          avaliacao: 'Avaliação',
          procedimento: 'Procedimento',
          reuniao: 'Reunião',
        };
        const tipoBase = ag.procedimento_interesse
          ? ag.procedimento_interesse
          : (ag.tipo ? tipoAgLabel[ag.tipo] || 'Agendamento' : 'Agendamento');

        // Formatar a data do agendamento para o título
        let dataAgStr = '';
        if (ag.data_hora_inicio) {
          try {
            const d = new Date(ag.data_hora_inicio);
            dataAgStr = ` — ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
          } catch { /* sem data */ }
        }
        const tituloFinal = `Agendamento marcado: ${tipoBase}${dataAgStr}`;

        eventos.push({
          id: `ag-${ag.id}`,
          tipo: 'agendamento',
          data: ag.criado_em,
          titulo: tituloFinal,
          descricao: parts.join(' • ') || undefined,
          metadata: {
            status: ag.status,
            resultado: ag.resultado,
            data_hora: ag.data_hora_inicio,
            data_hora_fim: ag.data_hora_fim,
            valor_orcado: ag.valor_orcado,
            procedimento: ag.procedimento_interesse,
          },
        });
      }

      // ─────────────────────────────────────────
      // 5. VENDAS
      // ─────────────────────────────────────────
      for (const v of vendas) {
        eventos.push({
          id: `venda-${v.id}`,
          tipo: 'venda',
          data: `${v.data_fechamento}T12:00:00.000Z`,
          titulo: `Venda fechada: ${v.produto_servico || 'Procedimento'}`,
          descricao: v.forma_pagamento ? `Pagamento: ${v.forma_pagamento}` : undefined,
          metadata: {
            valor: v.valor_fechado,
            produto: v.produto_servico,
            pagamento: v.forma_pagamento,
          },
        });
      }

      // ─────────────────────────────────────────
      // 6. NOTAS
      // Sistema de notas agora rastreia MQL e scoring com timestamps precisos
      // ─────────────────────────────────────────
      const tipoNotaLabel: Record<string, string> = {
        manual: 'Nota registrada',
        formulario_meta: 'Formulario Meta Ads recebido',
        sistema: 'Nota do sistema',
        reuniao: 'Nota de reuniao',
        ligacao: 'Nota de ligacao',
      };

      // IDs das notas que já geraram eventos de MQL/scoring (para não duplicar na seção 7b/10)
      const notasEventoMqlIds = new Set<string>();
      const notasEventoScoringIds = new Set<string>();

      for (const nota of notas) {
        const meta = nota.metadados as Record<string, any> | null;
        const evento_tipo = meta?.evento;

        // Nota de sistema com evento MQL → evento de scoring com timestamp exato
        if (nota.tipo === 'sistema' && evento_tipo === 'mql') {
          notasEventoMqlIds.add(nota.id);
          eventos.push({
            id: `nota-mql-${nota.id}`,
            tipo: 'scoring',
            data: nota.criado_em,
            titulo: 'Lead qualificado como MQL',
            descricao: 'Lead marcado como qualificado para o comercial.',
            metadata: { subtipo: 'mql', nota_id: nota.id },
          });
          continue;
        }

        // Nota de sistema com evento scoring → evento de scoring com timestamp exato
        if (nota.tipo === 'sistema' && evento_tipo === 'scoring' && meta?.scoring) {
          notasEventoScoringIds.add(nota.id);
          const scoringDescricao: Record<string, string> = {
            A: 'Lead dos Sonhos — perfil ideal para fechamento',
            B: 'Qualificado com Ressalva — boa oportunidade com pontos de atencao',
            C: 'Em Desenvolvimento — precisa de mais nutricao',
            D: 'Fora do ICP — nao e o perfil ideal no momento',
          };
          eventos.push({
            id: `nota-scoring-${nota.id}`,
            tipo: 'scoring',
            data: nota.criado_em,
            titulo: `Scoring definido: ${meta.scoring}`,
            descricao: scoringDescricao[meta.scoring] || undefined,
            metadata: { scoring: meta.scoring, nota_id: nota.id },
          });
          continue;
        }

        // Notas antigas de scoring (sem metadados estruturados)
        const isScoring = nota.tipo === 'sistema' && nota.conteudo?.toLowerCase().includes('scoring');

        // Ignorar notas de sistema que são logs internos sem valor comercial
        if (nota.tipo === 'sistema') {
          if (!nota.conteudo) continue;
          // Ignorar notas de sistema geradas automaticamente pelo CRM (MQL, scoring já tratados acima)
          const conteudoLower = nota.conteudo.toLowerCase();
          if (
            conteudoLower.includes('marcado como qualificado') ||
            conteudoLower.includes('scoring definido') ||
            conteudoLower.includes('ia ativada') ||
            conteudoLower.includes('ia desativada') ||
            conteudoLower.includes('lead atualizado')
          ) continue;
        }

        eventos.push({
          id: `nota-${nota.id}`,
          tipo: isScoring ? 'scoring' : 'nota',
          data: nota.criado_em,
          titulo: isScoring ? 'Qualificacao do lead registrada' : (tipoNotaLabel[nota.tipo] || 'Nota'),
          descricao: nota.conteudo
            ? nota.conteudo.slice(0, 200) + (nota.conteudo.length > 200 ? '...' : '')
            : undefined,
          metadata: { tipo: nota.tipo, conteudo: nota.conteudo },
        });
      }

      // ─────────────────────────────────────────
      // 7. HANDOFF standalone — apenas quando NÃO há transição real no pipeline
      // Se handoffStageEntry existe → já foi tratado na seção 2 (enriquecido no card da etapa)
      // ─────────────────────────────────────────
      const iaRespondeuAlguma = aiLogs.some(l => AI_ETAPAS_RESPOSTA.has(l.etapa));

      const handoffStageEntry = stageHistory.find(sh =>
        handoffStagePositions.has(sh.stage_position) && (sh as any).from_stage_position !== null
      );

      // Só cria evento standalone se NÃO há transição de pipeline registrada
      if (!handoffStageEntry) {
        const handoffLog = aiLogs.find(l => l.etapa === 'handoff');
        let handoffTimestamp: string | null = null;
        let handoffInferido = false;

        if (handoffLog) {
          handoffTimestamp = handoffLog.criado_em;
        } else if (iaRespondeuAlguma) {
          const lastAiLog = [...aiLogs].reverse().find(l => AI_ETAPAS_RESPOSTA.has(l.etapa));
          if (lastAiLog) {
            handoffTimestamp = lastAiLog.criado_em;
            handoffInferido = true;
          }
        }

        if (handoffTimestamp) {
          const handoffTime = new Date(handoffTimestamp).getTime();
          const entradaTime = new Date(lead.criado_em).getTime();
          const diffMin = Math.max(0, Math.round((handoffTime - entradaTime) / 60000));
          const tLabel = diffMin < 1 ? '< 1 min'
            : diffMin < 60 ? `${diffMin} min`
            : `${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? ` ${diffMin % 60}min` : ''}`;
          eventos.push({
            id: `handoff-${handoffLog?.id || lead.id}`,
            tipo: 'etapa',
            data: handoffTimestamp,
            titulo: 'IA transferiu para atendente humano',
            descricao: `Pre-atendimento automatizado durou ${tLabel}.`,
            metadata: {
              subtipo: 'handoff',
              tempo_ia_min: diffMin,
              etapa_nome: 'Handoff',
              etapa_cor: '#8b5cf6',
              inferido: handoffInferido,
            },
          });
        }
      }

      // Timestamp do handoff para calcular "tempo até humano assumir"
      const handoffTimestampFinal = handoffStageEntry?.entered_at
        || aiLogs.find(l => l.etapa === 'handoff')?.criado_em
        || null;

      // ─────────────────────────────────────────
      // 7a. HUMANO ASSUMIU — primeira msg humana após IA
      // ─────────────────────────────────────────
      if (iaRespondeuAlguma) {
        const aiRespTimes = aiLogs
          .filter(l => AI_ETAPAS_RESPOSTA.has(l.etapa))
          .map(l => new Date(l.criado_em).getTime());
        const lastAiRespTime = Math.max(...aiRespTimes);

        // Primeira mensagem de saída que NÃO coincide com resposta de IA (margem 2min)
        const primeiraHumana = mensagens.find(m => {
          if (m.direcao !== 'saida') return false;
          const t = new Date(m.criado_em).getTime();
          // Deve ser depois da última resposta IA E não coincidir com nenhum log de IA
          if (t <= lastAiRespTime) return false;
          const coincideComIA = aiRespTimes.some(at => Math.abs(t - at) < 2 * 60 * 1000);
          return !coincideComIA;
        });

        if (primeiraHumana) {
          const tempoAteHumano = handoffTimestampFinal
            ? Math.max(0, Math.round((new Date(primeiraHumana.criado_em).getTime() - new Date(handoffTimestampFinal).getTime()) / 60000))
            : undefined;
          const tempoLabel = tempoAteHumano !== undefined
            ? (tempoAteHumano < 1 ? '< 1 min'
              : tempoAteHumano < 60 ? `${tempoAteHumano} min`
              : `${Math.floor(tempoAteHumano / 60)}h${tempoAteHumano % 60 > 0 ? ` ${tempoAteHumano % 60}min` : ''}`)
            : null;

          eventos.push({
            id: `humano-assumiu-${lead.id}`,
            tipo: 'mensagem',
            data: primeiraHumana.criado_em,
            titulo: `Atendente humano assumiu${tempoLabel ? ` (${tempoLabel} apos handoff)` : ''}`,
            descricao: primeiraHumana.tipo_conteudo === 'text' && primeiraHumana.conteudo
              ? `"${primeiraHumana.conteudo.slice(0, 150)}${primeiraHumana.conteudo.length > 150 ? '...' : ''}"` : undefined,
            metadata: {
              subtipo: 'humano_assumiu',
              tempo_apos_handoff_min: tempoAteHumano,
            },
          });
        }
      }

      // ─────────────────────────────────────────
      // 7b. MQL fallback — só se não tiver nota do sistema rastreando
      // ─────────────────────────────────────────
      if (lead.is_qualified && notasEventoMqlIds.size === 0) {
        // Lead qualificado mas sem nota rastreada — lead antigo, sem timestamp preciso
        // Não exibir com timestamp errado (atualizado_em é enganoso)
        // O sidebar já mostra o status de qualificado
      }

      // ─────────────────────────────────────────
      // 8. ATIVIDADES DE EQUIPE (responsável, etc.)
      // ─────────────────────────────────────────
      for (const at of atividades) {
        if (at.tipo !== 'responsavel') continue;
        const autor = at.user_id ? autorPerfisMap.get(at.user_id) : undefined;
        const respId = at.metadados?.responsavel_id;
        const respNome = respId ? autorPerfisMap.get(respId)?.nome : undefined;
        eventos.push({
          id: `atividade-${at.id}`,
          tipo: 'responsavel',
          data: at.criado_em,
          titulo: respId
            ? `Responsável atribuído${respNome ? `: ${respNome}` : ''}`
            : 'Responsável removido',
          descricao: autor ? `Por ${autor.nome}` : undefined,
          metadata: { responsavel_id: respId, responsavel_nome: respNome },
          autor,
        });
      }

      // ─────────────────────────────────────────
      // 10. CADENCIAS
      // ─────────────────────────────────────────
      for (const cl of cadenciaLogs) {
        const cadenciaNome = (cl as any).cadencias?.nome || 'Cadencia';
        eventos.push({
          id: `cadencia-${cl.id}`,
          tipo: 'cadencia',
          data: cl.enviado_em || lead.criado_em,
          titulo: `Cadencia disparada: ${cadenciaNome}`,
          descricao: `Passo ${cl.passo_ordem} executado com sucesso`,
          metadata: { cadencia_id: cl.cadencia_id, passo: cl.passo_ordem },
        });
      }

      // ─────────────────────────────────────────
      // 11. TAGS
      // ─────────────────────────────────────────
      for (const lt of leadsTags) {
        if (!lt.assigned_at) continue;
        const tag = (lt as any).tags;
        eventos.push({
          id: `tag-${lt.tag_id}`,
          tipo: 'tag',
          data: lt.assigned_at,
          titulo: `Tag adicionada: ${tag?.name || 'Tag'}`,
          metadata: { tag_name: tag?.name, tag_color: tag?.color },
        });
      }

      // ─────────────────────────────────────────
      // 12. SCORING fallback — só se não tiver nota rastreando
      // ─────────────────────────────────────────
      // Se há nota de sistema com evento='scoring', já foi processado na seção 6.
      // Não usar atualizado_em como fallback pois é enganoso (muda em qualquer update).
      // Leads antigos com scoring mas sem nota: o sidebar já mostra o scoring.

      // Prioridade narrativa para eventos no mesmo timestamp
      const TIPO_PRIORIDADE: Record<string, number> = {
        entrada: 0,
        etapa: 1,
        mensagem: 2,     // primeiro contato, primeira resposta, humano assumiu
        agendamento: 3,
        venda: 4,
        scoring: 5,
        nota: 6,
        tag: 7,
        cadencia: 8,
        responsavel: 9,
        ia: 10,
      };
      const getSubPrioridade = (e: JornadaEvento): number => {
        if (e.metadata?.subtipo === 'primeiro_contato') return 0;
        if (e.metadata?.subtipo === 'primeira_resposta') return 1;
        if (e.metadata?.subtipo === 'handoff') return 2;
        if (e.metadata?.subtipo === 'humano_assumiu') return 3;
        if (e.metadata?.subtipo === 'mql') return 4;
        return 5;
      };

      // Ordenar: cronológico → prioridade de tipo → sub-prioridade
      eventos.sort((a, b) => {
        const timeDiff = new Date(a.data).getTime() - new Date(b.data).getTime();
        if (timeDiff !== 0) return timeDiff;
        const tipoDiff = (TIPO_PRIORIDADE[a.tipo] ?? 9) - (TIPO_PRIORIDADE[b.tipo] ?? 9);
        if (tipoDiff !== 0) return tipoDiff;
        return getSubPrioridade(a) - getSubPrioridade(b);
      });

      // Stats
      const etapaAtual = stageMap.get(lead.posicao_pipeline);
      const stats: JornadaStats = {
        totalMensagens:    mensagens.length,
        mensagensEnviadas: mensagens.filter(m => m.direcao === 'saida').length,
        mensagensRecebidas: mensagens.filter(m => m.direcao === 'entrada').length,
        totalAgendamentos: agendamentos.length,
        totalVendas:       vendas.length,
        totalFaturamento:  vendas.reduce((s, v) => s + v.valor_fechado, 0),
        diasNoCRM:         differenceInDays(new Date(), new Date(lead.criado_em)),
        etapaAtual:        etapaAtual?.nome,
        etapaAtualCor:     etapaAtual?.cor,
        tempoRespostaMin,
        totalSessoes:      sessCount,
      };

      return { lead, eventos, stats };
    },
    enabled: !!leadId && !!orgId,
  });
}
