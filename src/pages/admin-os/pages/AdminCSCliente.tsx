import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, formatDistanceToNow, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Circle, Activity,
  MessageCircle, Video, Mail, Phone, ChevronDown, ChevronRight,
  Star, Plus, Zap, RefreshCw, TrendingUp, Calendar as CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  type CSClient, type CSCrmMetrics,
  FASE_LABELS, FASE_COLORS, HEALTH_BG,
  TIPO_LABELS, RESULTADO_COLORS, RESULTADO_LABELS,
  clientName, effectiveHealth,
  getFaseEsperada, getSemana, getMes, getDiasRestantesNaFase,
  computeResultadoScore, computeResultadoBreakdown, computeAdocaoFull, computeHealth2Axis, formatMinutes,
} from '../types/cs';
import { useCSCrmMetrics, useCSClientCrmDetail, useCSClientCrmTrend } from '@/hooks/useCSCrm';
import { ResultadoCrmSection } from '../components/ResultadoCrmSection';
import { NpsResponseRow } from '../components/NpsResponseRow';
import { AthosCsChat } from '@/components/admin/AthosCsChat';
import { CsJornadaSection } from '../components/CsJornadaSection';
import { Sparkles } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip as RTooltip } from 'recharts';

// ── Constants ────────────────────────────────────────────────────────────────

const PROTOCOL_CONFIGS: Record<string, { label: string; color: string; bar: string }> = {
  onboarding:  { label: 'Onboarding',     color: 'text-blue-700 bg-blue-50 border-blue-200',     bar: 'bg-blue-500'    },
  risco:       { label: 'Risco de Churn', color: 'text-red-700 bg-red-50 border-red-200',         bar: 'bg-red-500'     },
  engajamento: { label: 'Engajamento',    color: 'text-violet-700 bg-violet-50 border-violet-200',bar: 'bg-violet-500'  },
  escalada:    { label: 'Escalada',       color: 'text-orange-700 bg-orange-50 border-orange-200',bar: 'bg-orange-500'  },
  expansao:    { label: 'Expansão',       color: 'text-emerald-700 bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500' },
};

const PROTOCOL_STEP_COUNT: Record<string, number> = {
  onboarding: 7, risco: 5, engajamento: 4, escalada: 6, expansao: 5,
};

const MARCOS_POR_FASE = [
  { id: 'd3_diagnostico',    label: 'Diagnóstico completo',           descricao: 'Formulário diagnóstico preenchido',       fase: 'ativacao',   dia: 'D3',   auto: true  },
  { id: 'd7_jornada',        label: 'Jornada ativa',                  descricao: 'Jornada personalizada criada e iniciada', fase: 'ativacao',   dia: 'D7',   auto: true  },
  { id: 'd14_ferramenta',    label: 'Primeira ferramenta construída',  descricao: '1+ ferramenta do Arsenal salva',          fase: 'ativacao',   dia: 'D14',  auto: true  },
  { id: 'd21_crm_lead',      label: 'CRM com lead ativo',             descricao: 'Ao menos 1 lead cadastrado no CRM',      fase: 'ativacao',   dia: 'D21',  auto: false },
  { id: 'd30_3ferramentas',  label: '3+ ferramentas do Arsenal',      descricao: '3 ou mais ferramentas construídas',      fase: 'ativacao',   dia: 'D30',  auto: true  },
  { id: 'd60_30pct',         label: '30% da jornada concluída',       descricao: 'Progresso mínimo na trilha',             fase: 'execucao',   dia: 'D60',  auto: true  },
  { id: 'd60_resultado_crm', label: 'Primeiros resultados no CRM',   descricao: 'Resultado declarado pelo cliente',       fase: 'execucao',   dia: 'D60',  auto: false },
  { id: 'd90_50pct',         label: '50% da jornada concluída',       descricao: 'Metade da trilha completada',            fase: 'execucao',   dia: 'D90',  auto: true  },
  { id: 'd120_70pct',        label: '70% da jornada concluída',       descricao: 'Proximidade da conclusão',               fase: 'tracao',     dia: 'D120', auto: true  },
  { id: 'd120_nps',          label: 'NPS coletado (≥ 8)',             descricao: 'Promotor identificado',                  fase: 'tracao',     dia: 'D120', auto: true  },
  { id: 'd180_concluida',    label: 'Jornada concluída',              descricao: '95%+ da trilha completa',                fase: 'maturidade', dia: 'D180', auto: true  },
] as const;

const FASES_ORDER = ['ativacao', 'execucao', 'tracao', 'maturidade'] as const;

const TIPO_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle, reuniao: Video, email: Mail, ligacao: Phone, outro: Activity,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientDetailData {
  jornada: { id: string; totalPassos: number; passosConcluidos: number; pctConcluido: number; lastActivity: string | null } | null;
  ferramentasConstruidas: number;
  aulasConcluidas: number;
  touchpoints: Array<{ id: string; tipo: string; resultado: string; data_contato: string; notas: string | null; duracao_minutos: number | null; proximo_contato: string | null; cliente_faltou: boolean | null }>;
  nps: { score: number; comentario: string | null; respondido_em: string } | null;
  npsHistory: Array<{
    id: string; score: number; comentario: string | null; respondido_em: string; campanha_id: string | null;
    cs_nps_campanhas?: { cs_nps_templates: { nome: string } | null } | null;
  }>;
  healthScores: Array<{ score_total: number; status_calculado: string; avaliado_em: string; dim_ativacao: number; dim_jornada: number; dim_arsenal: number; dim_crm: number; dim_responsividade: number }>;
  marcos: Array<{ marco: string; atingido: boolean; atingido_em: string | null }>;
  protocols: Array<{ id: string; tipo: string; passos_concluidos: string[]; notas: string | null; iniciado_em: string }>;
  diasNaPlataforma: number | null;
  crmCheckinScore: number | null;
  crmCheckinCompleted: number;
  crmCheckinTotal: number;
  crmCheckinDays: string[];
  crmDailyTaskCount: number;
  jornadaEstagios: Array<{ id: string; titulo: string; ordem: number; totalPassos: number; passosConcluidos: number }> | null;
}

interface AutoScore {
  ativacao: number; jornada: number; arsenal: number; crm: number; responsividade: number; total: number;
  status: 'verde' | 'amarelo' | 'vermelho';
}

interface RiskSignal { id: number; descricao: string; gravidade: 'critico' | 'alto' | 'medio' }
interface ProximaAcao { prioridade: 'urgente' | 'alta' | 'normal'; titulo: string; descricao: string }

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useCSClientById(clientId: string) {
  return useQuery({
    queryKey: ['cs-clients'],
    select: (data: CSClient[]) => data.find(c => c.id === clientId) ?? null,
    queryFn: async (): Promise<CSClient[]> => {
      // Mesma fonte da lista de CS: a RPC get_cs_clients (SECURITY DEFINER)
      // devolve o nome correto da clínica e o joined_at (usado no calendário
      // CRM da ficha), sem depender de RLS cross-org.
      const { data: rows, error } = await supabase.rpc('get_cs_clients');
      if (error) throw error;
      return (rows || []).map((r: any) => ({
        id: r.id,
        crm_user_id: r.crm_user_id ?? null,
        organization_id: r.organization_id,
        clinic_name: r.clinic_name ?? null,
        nome_completo: r.nome_completo ?? null,
        product_name: r.product_name ?? null,
        cs_fase: r.cs_fase ?? null,
        cs_fase_desde: r.cs_fase_desde ?? null,
        cs_health_status: r.cs_health_status ?? null,
        cs_ultimo_touchpoint: r.cs_ultimo_touchpoint ?? null,
        cs_proximo_touchpoint: r.cs_proximo_touchpoint ?? null,
        onboarding_concluido: r.onboarding_concluido ?? null,
        onboarding_complete: r.onboarding_complete ?? null,
        joined_at: r.joined_at ?? null,
        latest_health: null,
      } as CSClient));
    },
  });
}

function useClientDetail(client: CSClient | null) {
  return useQuery({
    queryKey: ['cs-client-detail', client?.id, client?.crm_user_id],
    enabled: !!client,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ClientDetailData> => {
      const clientId = client!.id;
      const crmUserId = client!.crm_user_id;
      const orgId = client!.organization_id;

      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd');

      const [tpRes, npsRes, hsRes, tenantRes, marcosRes, protocolsRes, dailyTasksRes, checkinsRes] = await Promise.all([
        supabase.from('cs_touchpoints')
          .select('id, tipo, resultado, data_contato, notas, duracao_minutos, proximo_contato, cliente_faltou')
          .eq('client_id', clientId)
          .order('data_contato', { ascending: false })
          .limit(20),
        supabase.from('cs_nps_responses')
          .select('id, score, comentario, respondido_em, campanha_id, cs_nps_campanhas(id, cs_nps_templates(nome))')
          .eq('client_id', clientId)
          .order('respondido_em', { ascending: false })
          .limit(50),
        supabase.from('cs_health_scores')
          .select('score_total, status_calculado, avaliado_em, dim_ativacao, dim_jornada, dim_arsenal, dim_crm, dim_responsividade')
          .eq('client_id', clientId)
          .order('avaliado_em', { ascending: false })
          .limit(5),
        supabase.from('platform_tenants')
          .select('created_at')
          .eq('organization_id', orgId)
          .limit(1)
          .maybeSingle(),
        supabase.from('cs_marcos')
          .select('marco, atingido, atingido_em')
          .eq('client_id', clientId),
        supabase.from('cs_client_protocols')
          .select('id, tipo, passos_concluidos, notas, iniciado_em')
          .eq('client_id', clientId)
          .eq('status', 'ativo'),
        supabase.from('performance_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('frequency', 'daily'),
        supabase.from('performance_checkins')
          .select('period_key')
          .eq('organization_id', orgId)
          .gte('period_key', ninetyDaysAgo)
          .lte('period_key', format(new Date(), 'yyyy-MM-dd'))
          .order('period_key'),
      ]);

      let jornada: ClientDetailData['jornada'] = null;
      let jornadaEstagios: ClientDetailData['jornadaEstagios'] = null;
      let ferramentasConstruidas = 0;
      let aulasConcluidas = 0;

      if (crmUserId) {
        const [jornadaRes, materiaisRes, aulasRes] = await Promise.allSettled([
          supabase.from('jornadas')
            .select('id, status, jornada_estagios(id, titulo, ordem, jornada_passos(id, titulo, concluido, concluido_em, obrigatorio))')
            .eq('user_id', crmUserId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('meus_materiais').select('id').eq('user_id', crmUserId),
          supabase.from('arsenal_aulas_progresso').select('id').eq('user_id', crmUserId).eq('concluido', true),
        ]);

        if (jornadaRes.status === 'fulfilled' && jornadaRes.value.data) {
          const j = jornadaRes.value.data;
          const estagios = (j as any).jornada_estagios || [];
          const allPassos = estagios.flatMap((e: any) => e.jornada_passos || []);
          const total = allPassos.length;
          const concluidos = allPassos.filter((p: any) => p.concluido).length;
          const lastAct = allPassos
            .filter((p: any) => p.concluido && p.concluido_em)
            .map((p: any) => p.concluido_em as string)
            .sort().reverse()[0] ?? null;
          jornada = { id: (j as any).id, totalPassos: total, passosConcluidos: concluidos, pctConcluido: total > 0 ? Math.round(concluidos / total * 100) : 0, lastActivity: lastAct };
          jornadaEstagios = [...estagios]
            .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
            .map((e: any) => ({
              id: e.id,
              titulo: e.titulo ?? `Etapa ${e.ordem ?? ''}`,
              ordem: e.ordem ?? 0,
              totalPassos: (e.jornada_passos || []).length,
              passosConcluidos: (e.jornada_passos || []).filter((p: any) => p.concluido).length,
            }));
        }
        if (materiaisRes.status === 'fulfilled') ferramentasConstruidas = (materiaisRes.value.data || []).length;
        if (aulasRes.status === 'fulfilled') aulasConcluidas = (aulasRes.value.data || []).length;
      }

      const dailyTaskCount = dailyTasksRes.count ?? 0;
      const crmCheckinDays = (checkinsRes.data || []).map((r: any) => r.period_key as string);
      // Score uses only last 30 days; crmCheckinDays stores up to 90 days for the detail dialog
      const crmCheckinDays30 = crmCheckinDays.filter(d => d >= thirtyDaysAgo);
      const crmCheckinCompleted = crmCheckinDays30.length;
      const crmCheckinTotal = dailyTaskCount * 30;
      const crmCheckinScore = crmCheckinTotal > 0
        ? Math.min(100, Math.round((crmCheckinCompleted / crmCheckinTotal) * 100))
        : null;

      return {
        jornada, ferramentasConstruidas, aulasConcluidas,
        touchpoints: (tpRes.data || []) as ClientDetailData['touchpoints'],
        nps: (npsRes.data || [])[0] ?? null,
        npsHistory: (npsRes.data || []) as unknown as ClientDetailData['npsHistory'],
        healthScores: (hsRes.data || []) as ClientDetailData['healthScores'],
        marcos: (marcosRes.data || []) as ClientDetailData['marcos'],
        protocols: (protocolsRes.data || []).map(p => ({
          id: p.id, tipo: p.tipo,
          passos_concluidos: (p.passos_concluidos as unknown as string[]) ?? [],
          notas: p.notas, iniciado_em: p.iniciado_em,
        })) as ClientDetailData['protocols'],
        diasNaPlataforma: tenantRes.data?.created_at
          ? differenceInDays(new Date(), new Date(tenantRes.data.created_at))
          : null,
        crmCheckinScore,
        crmCheckinCompleted,
        crmCheckinTotal,
        crmCheckinDays,
        crmDailyTaskCount: dailyTaskCount,
        jornadaEstagios,
      };
    },
  });
}

// ── Computation ───────────────────────────────────────────────────────────────

function calcAutoScore(client: CSClient, d: ClientDetailData): AutoScore {
  let ativacao = client.onboarding_complete ? 100 : client.onboarding_concluido ? 70 : 30;
  let jornada = 0;
  if (d.jornada) {
    const pct = d.jornada.pctConcluido;
    jornada = pct >= 75 ? 100 : pct >= 50 ? 80 : pct >= 25 ? 55 : pct >= 5 ? 30 : 0;
    if (d.jornada.lastActivity) {
      const days = differenceInDays(new Date(), new Date(d.jornada.lastActivity));
      if (days <= 7) jornada = Math.min(100, jornada + 10);
      else if (days >= 21) jornada = Math.max(0, jornada - 15);
    }
  }
  const t = d.ferramentasConstruidas;
  const arsenal = t >= 5 ? 100 : t >= 3 ? 75 : t >= 1 ? 45 : d.aulasConcluidas >= 3 ? 25 : d.aulasConcluidas >= 1 ? 10 : 0;
  const crm = d.crmCheckinScore ?? d.healthScores[0]?.dim_crm ?? 50;
  let responsividade = 30;
  if (client.cs_ultimo_touchpoint) {
    const days = differenceInDays(new Date(), new Date(client.cs_ultimo_touchpoint));
    responsividade = days <= 3 ? 100 : days <= 7 ? 80 : days <= 14 ? 50 : days <= 21 ? 20 : 0;
  } else { responsividade = 15; }
  if (d.touchpoints.slice(0, 3).filter(tp => tp.resultado === 'sem_resposta').length >= 2) {
    responsividade = Math.min(responsividade, 25);
  }
  const total = Math.round(ativacao * 0.20 + jornada * 0.25 + arsenal * 0.20 + crm * 0.25 + responsividade * 0.10);
  return { ativacao, jornada, arsenal, crm, responsividade, total, status: total >= 70 ? 'verde' : total >= 40 ? 'amarelo' : 'vermelho' };
}

function detectRiskSignals(client: CSClient, d: ClientDetailData, crm: CSCrmMetrics | null = null): RiskSignal[] {
  const out: RiskSignal[] = [];
  // ── Sinais de RESULTADO no CRM (prioritários — é o que o cliente percebe) ──
  if (crm) {
    if (crm.fat_growth_pct != null && crm.fat_growth_pct <= -15)
      out.push({ id: 10, descricao: `Faturamento caiu ${Math.abs(crm.fat_growth_pct)}% vs. período anterior`, gravidade: 'critico' });
    else if (crm.fat_growth_pct != null && crm.fat_growth_pct <= -5)
      out.push({ id: 10, descricao: `Faturamento em queda (${crm.fat_growth_pct}%)`, gravidade: 'alto' });
    if (crm.ultima_atividade) {
      const inativoDias = differenceInDays(new Date(), new Date(crm.ultima_atividade));
      if (inativoDias >= 14) out.push({ id: 11, descricao: `CRM sem atividade há ${inativoDias} dias`, gravidade: inativoDias >= 30 ? 'critico' : 'alto' });
    }
    if (crm.fechamentos_30d === 0 && crm.leads_30d > 0)
      out.push({ id: 12, descricao: 'Nenhum fechamento nos últimos 30 dias com leads ativos', gravidade: 'alto' });
    if (crm.tempo_1o_contato_med_min != null && crm.tempo_1o_contato_med_min > 240)
      out.push({ id: 13, descricao: `1º contato lento (${formatMinutes(crm.tempo_1o_contato_med_min)} em média)`, gravidade: 'medio' });
    if (!crm.tem_meta)
      out.push({ id: 14, descricao: 'Cliente sem meta de faturamento configurada', gravidade: 'medio' });
  }
  if (d.jornada?.lastActivity) {
    const days = differenceInDays(new Date(), new Date(d.jornada.lastActivity));
    if (days >= 21) out.push({ id: 2, descricao: `Jornada parada há ${days} dias`, gravidade: 'critico' });
    else if (days >= 14) out.push({ id: 2, descricao: `Jornada parada há ${days} dias`, gravidade: 'alto' });
  } else if (d.jornada && d.jornada.totalPassos > 0 && d.jornada.passosConcluidos === 0) {
    out.push({ id: 2, descricao: 'Jornada ativa sem nenhum passo concluído', gravidade: 'medio' });
  }
  if (client.cs_ultimo_touchpoint) {
    const days = differenceInDays(new Date(), new Date(client.cs_ultimo_touchpoint));
    if (days >= 21) out.push({ id: 4, descricao: `${days} dias sem contato`, gravidade: 'critico' });
    else if (days >= 14) out.push({ id: 4, descricao: `${days} dias sem contato`, gravidade: 'alto' });
  } else if (d.touchpoints.length === 0) {
    out.push({ id: 4, descricao: 'Nenhum touchpoint registrado ainda', gravidade: 'medio' });
  }
  const meetings = d.touchpoints.filter(tp => tp.tipo === 'reuniao').slice(0, 3);
  if (meetings.length >= 2 && meetings.slice(0, 2).every(tp => tp.resultado === 'sem_resposta' || tp.cliente_faltou)) {
    out.push({ id: 5, descricao: '2+ reuniões consecutivas sem comparecimento', gravidade: 'alto' });
  }
  const negatives = d.touchpoints.filter(tp => tp.resultado === 'negativo');
  if (negatives.length >= 2) out.push({ id: 6, descricao: `${negatives.length} interações com resultado negativo`, gravidade: 'medio' });
  return out;
}

function getProximasAcoes(client: CSClient, d: ClientDetailData, signals: RiskSignal[]): ProximaAcao[] {
  const out: ProximaAcao[] = [];
  if (signals.length > 0) {
    out.push({ prioridade: 'urgente', titulo: signals.length === 1 ? '1 sinal de risco ativo' : `${signals.length} sinais de risco ativos`, descricao: signals[0].descricao });
  }
  if (client.cs_proximo_touchpoint) {
    const today = new Date().toISOString().slice(0, 10);
    if (client.cs_proximo_touchpoint <= today) {
      out.push({ prioridade: 'alta', titulo: 'Touchpoint em atraso', descricao: `Previsto para ${format(parseISO(client.cs_proximo_touchpoint), "d 'de' MMM", { locale: ptBR })}` });
    }
  }
  const fase = client.cs_fase || 'ativacao';
  if (fase === 'ativacao') {
    if (!client.onboarding_complete) out.push({ prioridade: 'normal', titulo: 'Onboarding pendente', descricao: 'Cliente ainda não concluiu o checklist da plataforma' });
    if (d.ferramentasConstruidas < 1) out.push({ prioridade: 'normal', titulo: 'Nenhuma ferramenta do Arsenal construída', descricao: 'Meta D14: primeira ferramenta concluída' });
    else if (d.ferramentasConstruidas < 3) out.push({ prioridade: 'normal', titulo: `Arsenal: ${d.ferramentasConstruidas}/3 ferramentas`, descricao: 'Meta D30: 3+ ferramentas construídas' });
  }
  if (['tracao', 'maturidade'].includes(fase) && !d.nps) {
    out.push({ prioridade: 'normal', titulo: 'NPS não coletado', descricao: 'Coletar NPS trimestral é meta da fase Tração' });
  }
  if (d.jornada && d.jornada.pctConcluido < 30 && fase === 'execucao') {
    out.push({ prioridade: 'normal', titulo: `Jornada: ${d.jornada.pctConcluido}% concluída`, descricao: 'Meta D60: 30% — identificar travamentos na trilha' });
  }
  return out.slice(0, 4);
}

function getMarcoAtingido(marcoId: string, client: CSClient, d: ClientDetailData): boolean {
  const dbMarco = d.marcos.find(m => m.marco === marcoId);
  if (dbMarco?.atingido) return true;
  switch (marcoId) {
    case 'd3_diagnostico':   return client.onboarding_concluido === true;
    case 'd7_jornada':       return d.jornada !== null;
    case 'd14_ferramenta':   return d.ferramentasConstruidas >= 1;
    case 'd30_3ferramentas': return d.ferramentasConstruidas >= 3;
    case 'd60_30pct':        return (d.jornada?.pctConcluido ?? 0) >= 30;
    case 'd90_50pct':        return (d.jornada?.pctConcluido ?? 0) >= 50;
    case 'd120_70pct':       return (d.jornada?.pctConcluido ?? 0) >= 70;
    case 'd120_nps':         return !!(d.nps && d.nps.score >= 8);
    case 'd180_concluida':   return (d.jornada?.pctConcluido ?? 0) >= 95;
    default:                 return false;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const DIM_META: Record<string, { desc: string; weight: string }> = {
  'Ativação':       { desc: 'Conclusão do onboarding e checklist da plataforma',           weight: '20%' },
  'Jornada':        { desc: 'Progresso e atividade recente na jornada personalizada',       weight: '25%' },
  'Arsenal':        { desc: 'Ferramentas construídas e aulas concluídas no Arsenal',        weight: '20%' },
  'CRM':            { desc: 'Taxa de conclusão dos checkins de performance (automático)',    weight: '25%' },
  'Responsividade': { desc: 'Regularidade de resposta aos touchpoints do CSM',              weight: '10%' },
  'Crescimento':    { desc: 'Faturamento vs. período anterior (sinal-mestre)',              weight: '32%' },
  'Receita':        { desc: 'Volume de fechamentos gerados nos últimos 30 dias',            weight: '26%' },
  'Conversão':      { desc: 'Taxa de fechamento do funil (lead → venda)',                   weight: '20%' },
  'Tempo':          { desc: 'Velocidade do 1º contato ao lead',                             weight: '14%' },
  'Meta':           { desc: '% da meta de faturamento batida no mês',                       weight: '8%'  },
};

function DimBar({ label, value, color, auto, detalhe, onClick }: {
  label: string; value: number; color: string; auto?: boolean; detalhe?: string;
  onClick?: () => void;
}) {
  const meta = DIM_META[label] ?? { desc: '', weight: '' };
  const scoreColor = value >= 70 ? 'text-emerald-600' : value >= 40 ? 'text-amber-600' : 'text-rose-600';
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border/40 px-4 py-3 space-y-1.5 hover:bg-muted/[0.04] hover:border-border/60 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-foreground">{label}</span>
            {auto && <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-muted text-muted-foreground/50">Auto</span>}
            <span className="text-[9px] text-muted-foreground/30 tabular-nums">{meta.weight}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60">{meta.desc}</p>
          {detalhe && <p className="text-[10px] text-muted-foreground/40 mt-0.5 italic">{detalhe}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
          <span className={cn('text-sm font-bold tabular-nums font-display', scoreColor)}>{value}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25" />
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </button>
  );
}

function DimDetailDialog({ dim, detail, client, autoScore, onClose }: {
  dim: string | null; detail: ClientDetailData; client: CSClient; autoScore: AutoScore; onClose: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  const [crmView, setCrmView] = useState<'mes' | 'semana' | 'dia'>('mes');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Reset month drill-down whenever a different dimension dialog is opened/closed
  useEffect(() => { setSelectedMonth(null); }, [dim]);

  // Client's platform join date — never show/count days before this
  const joinDateStr = useMemo(
    () => client.joined_at ? format(parseISO(client.joined_at), 'yyyy-MM-dd') : null,
    [client.joined_at]
  );

  // All 90 days (already fetched)
  const allPeriodDays = useMemo(
    () => Array.from({ length: 90 }, (_, i) => format(subDays(today, 89 - i), 'yyyy-MM-dd')),
    [today]
  );

  // Weekdays only (Mon-Fri), from join date up to today
  const workDays = useMemo(
    () => allPeriodDays.filter(d => {
      if (d > todayStr) return false;
      if (joinDateStr && d < joinDateStr) return false;
      const dow = parseISO(d).getDay();
      return dow >= 1 && dow <= 5;
    }),
    [allPeriodDays, todayStr, joinDateStr]
  );

  const crmByDate = useMemo(() => {
    const map = new Map<string, number>();
    detail.crmCheckinDays.forEach(d => map.set(d, (map.get(d) ?? 0) + 1));
    return map;
  }, [detail.crmCheckinDays]);

  // Metrics — weekdays only
  const crmUniqueDays = useMemo(() => workDays.filter(d => (crmByDate.get(d) ?? 0) > 0).length, [workDays, crmByDate]);
  const crmActiveDaysTotal = workDays.length;
  const crmDailyAdoptionRate = crmActiveDaysTotal > 0 ? Math.round(crmUniqueDays / crmActiveDaysTotal * 100) : 0;

  const crmCurrentStreak = useMemo(() => {
    let s = 0;
    for (let i = workDays.length - 1; i >= 0; i--) {
      if ((crmByDate.get(workDays[i]) ?? 0) > 0) s++;
      else break;
    }
    return s;
  }, [workDays, crmByDate]);

  const crmBestStreak = useMemo(() => {
    let best = 0, cur = 0;
    workDays.forEach(d => {
      if ((crmByDate.get(d) ?? 0) > 0) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    });
    return best;
  }, [workDays, crmByDate]);

  const crmTrend = useMemo(() => {
    const mid = Math.floor(workDays.length / 2);
    const first = workDays.slice(0, mid);
    const second = workDays.slice(mid);
    const fp = first.length > 0 ? Math.round(first.filter(d => (crmByDate.get(d) ?? 0) > 0).length / first.length * 100) : 0;
    const sp = second.length > 0 ? Math.round(second.filter(d => (crmByDate.get(d) ?? 0) > 0).length / second.length * 100) : 0;
    return { firstPct: fp, secondPct: sp, diff: sp - fp };
  }, [workDays, crmByDate]);

  // ── Mês view ──────────────────────────────────────────────────────────────
  const crmMonthStats = useMemo(() => {
    const months = new Map<string, { key: string; label: string; total: number; done: number }>();
    workDays.forEach(d => {
      const key = d.slice(0, 7);
      const label = format(parseISO(key + '-01'), "MMMM 'de' yyyy", { locale: ptBR });
      if (!months.has(key)) months.set(key, { key, label, total: 0, done: 0 });
      const m = months.get(key)!;
      m.total++;
      if ((crmByDate.get(d) ?? 0) > 0) m.done++;
    });
    return [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ ...v, pct: v.total > 0 ? Math.round(v.done / v.total * 100) : 0 }));
  }, [workDays, crmByDate]);

  // Days of the currently drilled-down month (Mon-Fri, join-date-aware)
  const selectedMonthDays = useMemo(() => {
    if (!selectedMonth) return [];
    return workDays.filter(d => d.slice(0, 7) === selectedMonth);
  }, [workDays, selectedMonth]);

  // ── Semana view ───────────────────────────────────────────────────────────
  const crmWeekStats = useMemo(() => {
    const weeks = new Map<string, { days: string[] }>();
    workDays.forEach(d => {
      const dow = parseISO(d).getDay(); // 1=Mon…5=Fri
      const monDate = new Date(parseISO(d));
      monDate.setDate(monDate.getDate() - (dow - 1));
      const monStr = format(monDate, 'yyyy-MM-dd');
      if (!weeks.has(monStr)) weeks.set(monStr, { days: [] });
      weeks.get(monStr)!.days.push(d);
    });
    return [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monStr, { days }]) => {
        const friDate = new Date(parseISO(monStr));
        friDate.setDate(friDate.getDate() + 4);
        const done = days.filter(d => (crmByDate.get(d) ?? 0) > 0).length;
        const pct = days.length > 0 ? Math.round(done / days.length * 100) : 0;
        return {
          monStr,
          label: `${format(parseISO(monStr), 'd/MM', { locale: ptBR })} – ${format(friDate, 'd/MM', { locale: ptBR })}`,
          total: days.length, done, pct,
        };
      });
  }, [workDays, crmByDate]);

  // ── Dia view (Mon-Fri calendar grid) ──────────────────────────────────────
  // Only renders weeks that intersect the client's actual time on the platform
  const crmCalendarWeeks = useMemo(() => {
    const weeks = new Map<string, string[]>();
    allPeriodDays.forEach(d => {
      if (joinDateStr && d < joinDateStr) return;
      const dow = parseISO(d).getDay();
      if (dow === 0 || dow === 6) return;
      const monDate = new Date(parseISO(d));
      monDate.setDate(monDate.getDate() - (dow - 1));
      const monStr = format(monDate, 'yyyy-MM-dd');
      if (!weeks.has(monStr)) weeks.set(monStr, []);
      weeks.get(monStr)!.push(d);
    });
    return [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monStr, days]) => ({ monStr, days: days.sort() }));
  }, [allPeriodDays, joinDateStr]);

  const diasSemContato = client.cs_ultimo_touchpoint
    ? differenceInDays(today, new Date(client.cs_ultimo_touchpoint))
    : null;

  const positivoResults = ['respondeu', 'realizada', 'atendeu', 'positivo', 'reuniao_marcada', 'callback'];
  const responseRate = detail.touchpoints.length > 0
    ? Math.round(detail.touchpoints.filter(tp => positivoResults.includes(tp.resultado)).length / detail.touchpoints.length * 100)
    : null;

  const dimValue = dim === 'Ativação' ? autoScore.ativacao : dim === 'Jornada' ? autoScore.jornada : dim === 'Arsenal' ? autoScore.arsenal : dim === 'CRM' ? autoScore.crm : autoScore.responsividade;
  const scoreColor = dimValue >= 70 ? 'text-emerald-600' : dimValue >= 40 ? 'text-amber-600' : 'text-rose-600';
  const barColor = dimValue >= 70 ? 'bg-emerald-500' : dimValue >= 40 ? 'bg-amber-500' : 'bg-rose-500';

  const tipoLabel: Record<string, string> = { whatsapp: 'WhatsApp', reuniao: 'Reunião', ligacao: 'Ligação', email: 'E-mail', outro: 'Outro' };

  return (
    <Dialog open={!!dim} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-bold">{dim}</DialogTitle>
            <span className={cn('text-2xl font-bold tabular-nums font-display', scoreColor)}>{dimValue}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{DIM_META[dim ?? '']?.desc}</p>
          <div className="h-2 rounded-full bg-muted/60 overflow-hidden mt-2">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${dimValue}%` }} />
          </div>
        </DialogHeader>

        {/* ── ATIVAÇÃO ── */}
        {dim === 'Ativação' && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              {([
                { label: 'Conversa com Athos concluída', done: !!client.onboarding_concluido, desc: 'Diagnóstico preenchido e jornada personalizada gerada', pts: '→ 70 pts' },
                { label: 'Checklist de configuração completo', done: !!client.onboarding_complete, desc: 'Todas as etapas de setup da plataforma finalizadas', pts: '→ 100 pts' },
              ] as { label: string; done: boolean; desc: string; pts: string }[]).map(({ label, done, desc, pts }) => (
                <div key={label} className={cn('flex items-start gap-3 p-3.5 rounded-xl border', done ? 'border-emerald-200/60 bg-emerald-50/40' : 'border-border/40 bg-muted/[0.02]')}>
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', done ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground/30')}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-xs font-semibold', done ? 'text-foreground' : 'text-muted-foreground/60')}>{label}</p>
                      {done && <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">{pts}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1.5">Próximo passo</p>
              <p className="text-xs text-muted-foreground">
                {client.onboarding_complete
                  ? 'Score máximo atingido. Cliente totalmente ativado na plataforma.'
                  : client.onboarding_concluido
                  ? 'Falta concluir o checklist de configuração para atingir score 100.'
                  : 'O cliente ainda não completou a conversa com o Athos. Verificar se houve algum bloqueio no onboarding.'}
              </p>
            </div>
          </div>
        )}

        {/* ── JORNADA ── */}
        {dim === 'Jornada' && (
          detail.jornada ? (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/40 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums font-display text-violet-600">{detail.jornada.pctConcluido}%</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Progresso geral</p>
                </div>
                <div className="rounded-xl border border-border/40 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums font-display">{detail.jornada.passosConcluidos}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Concluídos</p>
                </div>
                <div className="rounded-xl border border-border/40 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums font-display">{detail.jornada.totalPassos - detail.jornada.passosConcluidos}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Pendentes</p>
                </div>
              </div>
              {detail.jornada.lastActivity && (() => {
                const daysAgo = differenceInDays(today, new Date(detail.jornada!.lastActivity!));
                return (
                  <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', daysAgo >= 14 ? 'border-amber-200/60 bg-amber-50/30' : 'border-border/40')}>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">Última atividade</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {format(parseISO(detail.jornada.lastActivity), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        {' — '}{formatDistanceToNow(parseISO(detail.jornada.lastActivity), { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                    {daysAgo >= 14 && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-md flex-shrink-0">Parada há {daysAgo}d</span>
                    )}
                  </div>
                );
              })()}
              {detail.jornadaEstagios && detail.jornadaEstagios.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Progresso por etapa</p>
                  {detail.jornadaEstagios.map((estagio, i) => {
                    const pct = estagio.totalPassos > 0 ? Math.round(estagio.passosConcluidos / estagio.totalPassos * 100) : 0;
                    const done = pct === 100;
                    const started = estagio.passosConcluidos > 0;
                    return (
                      <div key={estagio.id} className={cn('rounded-xl border p-3.5 space-y-2', done ? 'border-emerald-200/60 bg-emerald-50/30' : started ? 'border-violet-200/60 bg-violet-50/20' : 'border-border/40')}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0', done ? 'bg-emerald-100 text-emerald-700' : started ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground/40')}>{i + 1}</div>
                            <span className="text-xs font-medium">{estagio.titulo}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground/40 tabular-nums">{estagio.passosConcluidos}/{estagio.totalPassos}</span>
                            <span className={cn('text-xs font-bold tabular-nums w-8 text-right', done ? 'text-emerald-600' : started ? 'text-violet-600' : 'text-muted-foreground/30')}>{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div className={cn('h-full rounded-full', done ? 'bg-emerald-500' : started ? 'bg-violet-500' : '')} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3"><Activity className="h-6 w-6 text-muted-foreground/40" /></div>
              <p className="text-sm font-medium text-muted-foreground">Jornada não gerada</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1">O cliente ainda não completou a conversa com o Athos GS.</p>
            </div>
          )
        )}

        {/* ── ARSENAL ── */}
        {dim === 'Arsenal' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/40 p-4 text-center">
                <p className="text-3xl font-bold tabular-nums font-display text-amber-600">{detail.ferramentasConstruidas}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ferramentas construídas</p>
              </div>
              <div className="rounded-xl border border-border/40 p-4 text-center">
                <p className="text-3xl font-bold tabular-nums font-display">{detail.aulasConcluidas}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Aulas concluídas</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Marcos</p>
              {([
                { label: 'Primeira ferramenta construída', done: detail.ferramentasConstruidas >= 1 },
                { label: '3+ ferramentas construídas', done: detail.ferramentasConstruidas >= 3 },
                { label: '5+ ferramentas construídas', done: detail.ferramentasConstruidas >= 5 },
                { label: 'Primeira aula concluída', done: detail.aulasConcluidas >= 1 },
                { label: '5+ aulas concluídas', done: detail.aulasConcluidas >= 5 },
              ] as { label: string; done: boolean }[]).map(({ label, done }) => (
                <div key={label} className={cn('flex items-center gap-3 px-3.5 py-2.5 rounded-xl border', done ? 'border-emerald-200/60 bg-emerald-50/40' : 'border-border/40')}>
                  <div className={cn('h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0', done ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground/30')}>
                    {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                  </div>
                  <span className={cn('text-xs flex-1', done ? 'text-foreground font-medium' : 'text-muted-foreground/60')}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CRM ── */}
        {dim === 'CRM' && (
          <div className="space-y-5 pt-2">

            {/* View tabs: Mês / Semana / Dia */}
            <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
              {(['mes', 'semana', 'dia'] as const).map(v => {
                const lbl = { mes: 'Mês', semana: 'Semana', dia: 'Dia' }[v];
                return (
                  <button key={v} onClick={() => setCrmView(v)}
                    className={cn('flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all',
                      crmView === v ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}>
                    {lbl}
                  </button>
                );
              })}
            </div>

            {/* Stats — always visible, based on 90 working days */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/40 p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums font-display', crmUniqueDays > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>{crmUniqueDays}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Dias úteis com uso</p>
                <p className="text-[9px] text-muted-foreground/40 tabular-nums">de {crmActiveDaysTotal} (90 dias)</p>
              </div>
              <div className="rounded-xl border border-border/40 p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums font-display', crmDailyAdoptionRate >= 70 ? 'text-emerald-600' : crmDailyAdoptionRate >= 40 ? 'text-amber-600' : 'text-rose-600')}>{crmDailyAdoptionRate}%</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Taxa de adoção</p>
                <p className="text-[9px] text-muted-foreground/40">{crmDailyAdoptionRate >= 70 ? 'Excelente' : crmDailyAdoptionRate >= 40 ? 'Em desenvolvimento' : 'Abaixo do esperado'}</p>
              </div>
              <div className="rounded-xl border border-border/40 p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums font-display', crmCurrentStreak >= 7 ? 'text-emerald-600' : crmCurrentStreak >= 3 ? 'text-amber-600' : 'text-muted-foreground')}>{crmCurrentStreak}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Sequência atual</p>
                <p className="text-[9px] text-muted-foreground/40">dias úteis seguidos</p>
              </div>
              <div className="rounded-xl border border-border/40 p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums font-display', crmBestStreak >= 7 ? 'text-emerald-600' : crmBestStreak >= 3 ? 'text-amber-600' : 'text-muted-foreground')}>{crmBestStreak}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Melhor sequência</p>
                <p className="text-[9px] text-muted-foreground/40">nos últimos 90 dias</p>
              </div>
            </div>

            {/* Trend */}
            {workDays.length >= 14 && (
              <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3',
                crmTrend.diff > 5 ? 'border-emerald-200/60 bg-emerald-50/30' :
                crmTrend.diff < -5 ? 'border-rose-200/60 bg-rose-50/30' :
                'border-border/40'
              )}>
                <TrendingUp className={cn('h-4 w-4 flex-shrink-0', crmTrend.diff > 5 ? 'text-emerald-600' : crmTrend.diff < -5 ? 'text-rose-500 rotate-180' : 'text-muted-foreground/40')} />
                <div className="flex-1">
                  <p className="text-xs font-semibold">{crmTrend.diff > 5 ? 'Tendência positiva' : crmTrend.diff < -5 ? 'Tendência de queda' : 'Uso estável'}</p>
                  <p className="text-[10px] text-muted-foreground/60">
                    1ª metade: {crmTrend.firstPct}% → 2ª metade: {crmTrend.secondPct}%
                    {crmTrend.diff !== 0 && <span className={cn('font-semibold ml-1', crmTrend.diff > 0 ? 'text-emerald-600' : 'text-rose-600')}>{crmTrend.diff > 0 ? `+${crmTrend.diff}` : crmTrend.diff}pp</span>}
                  </p>
                </div>
              </div>
            )}

            {/* ── VIEW: MÊS ── */}
            {crmView === 'mes' && (
              selectedMonth ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedMonth(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Voltar para os meses
                  </button>
                  {(() => {
                    const m = crmMonthStats.find(mm => mm.key === selectedMonth);
                    if (!m) return null;
                    const text = m.pct >= 70 ? 'text-emerald-600' : m.pct >= 40 ? 'text-amber-600' : m.pct > 0 ? 'text-rose-600' : 'text-muted-foreground/40';
                    return (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold capitalize">{m.label}</p>
                        <span className={cn('text-[11px] font-semibold tabular-nums', text)}>{m.done}/{m.total} dias úteis · {m.pct > 0 ? `${m.pct}%` : '—'}</span>
                      </div>
                    );
                  })()}
                  <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="divide-y divide-border/40">
                      {selectedMonthDays.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground/50 py-6 text-center">Sem dias úteis neste mês.</p>
                      ) : selectedMonthDays.map(d => {
                        const count = crmByDate.get(d) ?? 0;
                        const max = detail.crmDailyTaskCount;
                        const done = count > 0;
                        const full = max > 0 ? count >= max : done;
                        const dot = full ? 'bg-emerald-500' : done ? 'bg-amber-400' : 'bg-muted-foreground/20';
                        const statusLabel = full ? 'Completo' : done ? 'Parcial' : 'Sem uso';
                        const statusColor = full ? 'text-emerald-600' : done ? 'text-amber-600' : 'text-muted-foreground/40';
                        return (
                          <div key={d} className="px-4 py-2.5 flex items-center gap-3">
                            <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
                            <span className="text-xs font-medium capitalize flex-1">
                              {format(parseISO(d), "EEEE, d 'de' MMM", { locale: ptBR })}
                            </span>
                            {max > 1 && <span className="text-[10px] text-muted-foreground/40 tabular-nums">{count}/{max}</span>}
                            <span className={cn('text-[11px] font-semibold w-16 text-right flex-shrink-0', statusColor)}>{statusLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Desempenho mensal — dias úteis (seg–sex)</p>
                  {crmMonthStats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="p-3 rounded-xl bg-muted/40 mb-3"><CalendarIcon className="h-6 w-6 text-muted-foreground/40" /></div>
                      <p className="text-sm font-medium text-muted-foreground">Sem registros de uso</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                      <div className="divide-y divide-border/40">
                        {crmMonthStats.map(m => {
                          const dot = m.pct >= 70 ? 'bg-emerald-500' : m.pct >= 40 ? 'bg-amber-400' : m.pct > 0 ? 'bg-rose-400' : 'bg-muted-foreground/20';
                          const bar = m.pct >= 70 ? 'bg-emerald-500' : m.pct >= 40 ? 'bg-amber-400' : m.pct > 0 ? 'bg-rose-400' : 'bg-muted';
                          const text = m.pct >= 70 ? 'text-emerald-600' : m.pct >= 40 ? 'text-amber-600' : m.pct > 0 ? 'text-rose-600' : 'text-muted-foreground/30';
                          const barWidth = m.pct > 0 ? Math.max(m.pct, 4) : 0;
                          return (
                            <button
                              key={m.key}
                              onClick={() => setSelectedMonth(m.key)}
                              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/[0.04] transition-colors"
                            >
                              <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="text-xs font-semibold capitalize truncate">{m.label}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] text-muted-foreground/40 tabular-nums">{m.done}/{m.total}</span>
                                    <span className={cn('text-xs font-bold tabular-nums font-display w-9 text-right', text)}>{m.pct > 0 ? `${m.pct}%` : '—'}</span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                                  <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${barWidth}%` }} />
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25 flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* ── VIEW: SEMANA ── */}
            {crmView === 'semana' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Desempenho semanal — seg a sex</p>
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="divide-y divide-border/40">
                    {crmWeekStats.map(ws => {
                      const dot = ws.pct >= 70 ? 'bg-emerald-500' : ws.pct >= 40 ? 'bg-amber-400' : ws.pct > 0 ? 'bg-rose-400' : 'bg-muted-foreground/20';
                      const bar = ws.pct >= 70 ? 'bg-emerald-500' : ws.pct >= 40 ? 'bg-amber-400' : ws.pct > 0 ? 'bg-rose-400' : 'bg-muted';
                      const text = ws.pct >= 70 ? 'text-emerald-600' : ws.pct >= 40 ? 'text-amber-600' : ws.pct > 0 ? 'text-rose-600' : 'text-muted-foreground/30';
                      const barWidth = ws.pct > 0 ? Math.max(ws.pct, 4) : 0;
                      return (
                        <div key={ws.monStr} className="px-4 py-3 flex items-center gap-3">
                          <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-semibold tabular-nums">{ws.label}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] text-muted-foreground/40 tabular-nums">{ws.done}/{ws.total}</span>
                                <span className={cn('text-xs font-bold tabular-nums font-display w-9 text-right', text)}>{ws.pct > 0 ? `${ws.pct}%` : '—'}</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${barWidth}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── VIEW: DIA (Mon-Fri grid) ── */}
            {crmView === 'dia' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Calendário de uso — dias úteis</p>
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 space-y-3">
                  {/* Day header */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 flex-shrink-0" />
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map(d => (
                      <span key={d} className="flex-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground/30">{d}</span>
                    ))}
                    <span className="w-8 flex-shrink-0" />
                  </div>
                  <div className="space-y-1.5">
                    {crmCalendarWeeks.map(({ monStr, days }) => {
                      const weekWorkDays = days.filter(d => d <= todayStr && (!joinDateStr || d >= joinDateStr));
                      const weekDone = weekWorkDays.filter(d => (crmByDate.get(d) ?? 0) > 0).length;
                      const weekPct = weekWorkDays.length > 0 ? Math.round(weekDone / weekWorkDays.length * 100) : null;
                      return (
                        <div key={monStr} className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground/30 w-14 flex-shrink-0 tabular-nums">
                            {format(parseISO(monStr), 'd MMM', { locale: ptBR })}
                          </span>
                          <div className="flex gap-1 flex-1">
                            {[0, 1, 2, 3, 4].map(offset => {
                              const dayDate = new Date(parseISO(monStr));
                              dayDate.setDate(dayDate.getDate() + offset);
                              const day = format(dayDate, 'yyyy-MM-dd');
                              const isFuture = day > todayStr;
                              const isBeforeJoin = !!joinDateStr && day < joinDateStr;
                              const count = crmByDate.get(day) ?? 0;
                              const max = detail.crmDailyTaskCount;
                              const ratio = max > 0 ? count / max : (count > 0 ? 1 : 0);
                              return (
                                <div key={day}
                                  title={isFuture || isBeforeJoin ? '' : `${format(dayDate, "EEE, d MMM", { locale: ptBR })}: ${count}/${max}`}
                                  className={cn('flex-1 h-8 rounded-md flex items-end justify-center pb-0.5 transition-colors',
                                    isBeforeJoin ? 'bg-transparent' :
                                    isFuture ? 'bg-muted/20' :
                                    ratio >= 1 ? 'bg-emerald-500' :
                                    ratio > 0 ? 'bg-amber-400' :
                                    'bg-muted/60',
                                    day === todayStr && 'ring-2 ring-foreground/30 ring-offset-1'
                                  )}>
                                  {!isFuture && !isBeforeJoin && max > 1 && count > 0 && (
                                    <span className="text-[8px] font-bold text-white/80 tabular-nums leading-none">{count}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <span className={cn('text-[10px] font-semibold tabular-nums w-8 text-right flex-shrink-0',
                            weekPct === null ? 'text-muted-foreground/20' :
                            weekPct >= 70 ? 'text-emerald-600' :
                            weekPct >= 40 ? 'text-amber-600' :
                            weekPct > 0 ? 'text-rose-500' : 'text-muted-foreground/20'
                          )}>
                            {weekPct !== null && weekPct > 0 ? `${weekPct}%` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 pt-1 flex-wrap border-t border-border/40 mt-1">
                    <div className="flex items-center gap-1.5 pt-2.5"><div className="h-3 w-4 rounded bg-emerald-500" /><span className="text-[10px] text-muted-foreground/60">Completo</span></div>
                    {detail.crmDailyTaskCount > 1 && <div className="flex items-center gap-1.5 pt-2.5"><div className="h-3 w-4 rounded bg-amber-400" /><span className="text-[10px] text-muted-foreground/60">Parcial</span></div>}
                    <div className="flex items-center gap-1.5 pt-2.5"><div className="h-3 w-4 rounded bg-muted/60" /><span className="text-[10px] text-muted-foreground/60">Sem uso</span></div>
                  </div>
                </div>
              </div>
            )}

            {detail.crmCheckinScore === null && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 px-4 py-3">
                <p className="text-xs text-amber-800">Nenhum checkin registrado. O score usa valor padrão (50). Verifique se o cliente está utilizando o CRM.</p>
              </div>
            )}
          </div>
        )}

        {/* ── RESPONSIVIDADE ── */}
        {dim === 'Responsividade' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/40 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums font-display">{detail.touchpoints.length}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Total de contatos</p>
              </div>
              <div className="rounded-xl border border-border/40 p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums font-display', responseRate !== null ? (responseRate >= 70 ? 'text-emerald-600' : responseRate >= 40 ? 'text-amber-600' : 'text-rose-600') : 'text-muted-foreground')}>
                  {responseRate !== null ? `${responseRate}%` : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Taxa de resposta</p>
              </div>
              <div className="rounded-xl border border-border/40 p-3 text-center">
                <p className={cn('text-2xl font-bold tabular-nums font-display', diasSemContato !== null ? (diasSemContato <= 7 ? 'text-emerald-600' : diasSemContato <= 14 ? 'text-amber-600' : 'text-rose-600') : 'text-muted-foreground')}>
                  {diasSemContato ?? '—'}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Dias s/ contato</p>
              </div>
            </div>

            {detail.touchpoints.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Histórico de contatos</p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {detail.touchpoints.map(tp => {
                    const respondeu = positivoResults.includes(tp.resultado);
                    const TipoIcon = TIPO_ICONS[tp.tipo] ?? Activity;
                    return (
                      <div key={tp.id} className={cn('flex items-start gap-3 px-3 py-2.5 rounded-xl border', respondeu ? 'border-emerald-200/50 bg-emerald-50/30' : 'border-border/40')}>
                        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0', respondeu ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground/50')}>
                          <TipoIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold">{tipoLabel[tp.tipo] ?? tp.tipo}</span>
                            <span className="text-[10px] text-muted-foreground/60 capitalize">{tp.resultado.replace(/_/g, ' ')}</span>
                            {tp.duracao_minutos && <span className="text-[10px] text-muted-foreground/40">{tp.duracao_minutos}min</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground/50">{format(parseISO(tp.data_contato), "d 'de' MMM 'de' yyyy", { locale: ptBR })}</p>
                          {tp.notas && <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic line-clamp-2">{tp.notas}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3"><MessageCircle className="h-6 w-6 text-muted-foreground/40" /></div>
                <p className="text-sm font-medium text-muted-foreground">Sem touchpoints registrados</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Registre o primeiro contato com o cliente.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Inline modals ──────────────────────────────────────────────────────────────

const TP_TIPOS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'reuniao',  label: 'Reunião',  icon: Video         },
  { value: 'ligacao',  label: 'Ligação',  icon: Phone         },
  { value: 'email',    label: 'E-mail',   icon: Mail          },
  { value: 'outro',    label: 'Outro',    icon: Activity      },
];

interface TipoConfig {
  resultados: Array<{ value: string; label: string; activeColor: string }>;
  duracoes: string[] | null;
  notasPlaceholder: string;
  autoDias: number;
}

const TIPO_CONFIG: Record<string, TipoConfig> = {
  whatsapp: {
    resultados: [
      { value: 'respondeu',     label: 'Respondeu',      activeColor: 'bg-emerald-600 border-emerald-600 text-white' },
      { value: 'nao_respondeu', label: 'Não respondeu',  activeColor: 'bg-amber-500 border-amber-500 text-white' },
      { value: 'positivo',      label: 'Positivo',       activeColor: 'bg-blue-600 border-blue-600 text-white' },
      { value: 'negativo',      label: 'Negativo',       activeColor: 'bg-rose-600 border-rose-600 text-white' },
    ],
    duracoes: null,
    notasPlaceholder: 'O que foi discutido? Principais pontos e próximos passos...',
    autoDias: 7,
  },
  reuniao: {
    resultados: [
      { value: 'realizada',      label: 'Realizada',       activeColor: 'bg-emerald-600 border-emerald-600 text-white' },
      { value: 'cliente_faltou', label: 'Cliente faltou',  activeColor: 'bg-amber-500 border-amber-500 text-white' },
      { value: 'cancelada',      label: 'Cancelada',       activeColor: 'bg-rose-600 border-rose-600 text-white' },
      { value: 'reagendada',     label: 'Reagendada',      activeColor: 'bg-blue-600 border-blue-600 text-white' },
    ],
    duracoes: ['30', '45', '60', '90'],
    notasPlaceholder: 'Pauta, pontos discutidos, decisões tomadas e próximos passos...',
    autoDias: 14,
  },
  ligacao: {
    resultados: [
      { value: 'atendeu',      label: 'Atendeu',          activeColor: 'bg-emerald-600 border-emerald-600 text-white' },
      { value: 'nao_atendeu', label: 'Não atendeu',       activeColor: 'bg-amber-500 border-amber-500 text-white' },
      { value: 'caixa_postal', label: 'Caixa postal',     activeColor: 'bg-slate-500 border-slate-500 text-white' },
      { value: 'callback',     label: 'Callback pedido',  activeColor: 'bg-blue-600 border-blue-600 text-white' },
    ],
    duracoes: ['5', '10', '15', '30'],
    notasPlaceholder: 'Objetivo da ligação, o que foi discutido e próximos passos...',
    autoDias: 3,
  },
  email: {
    resultados: [
      { value: 'respondeu',       label: 'Respondeu',        activeColor: 'bg-emerald-600 border-emerald-600 text-white' },
      { value: 'sem_resposta',    label: 'Sem resposta',     activeColor: 'bg-amber-500 border-amber-500 text-white' },
      { value: 'reuniao_marcada', label: 'Reunião marcada',  activeColor: 'bg-blue-600 border-blue-600 text-white' },
    ],
    duracoes: null,
    notasPlaceholder: 'Assunto do e-mail e principais pontos comunicados...',
    autoDias: 5,
  },
  outro: {
    resultados: [
      { value: 'positivo', label: 'Positivo', activeColor: 'bg-emerald-600 border-emerald-600 text-white' },
      { value: 'neutro',   label: 'Neutro',   activeColor: 'bg-foreground border-foreground text-background' },
      { value: 'negativo', label: 'Negativo', activeColor: 'bg-rose-600 border-rose-600 text-white' },
    ],
    duracoes: ['15', '30', '60'],
    notasPlaceholder: 'Descreva o contato e o que foi tratado...',
    autoDias: 7,
  },
};

function TouchpointDialog({ open, onClose, clientId, clientName }: { open: boolean; onClose: () => void; clientId: string; clientName: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    tipo: 'whatsapp', resultado: 'respondeu', notas: '',
    duracao_minutos: '', proximo_contato: undefined as Date | undefined,
  });
  const [saving, setSaving] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  const config = TIPO_CONFIG[form.tipo] ?? TIPO_CONFIG.outro;

  const handleTipoChange = (tipo: string) => {
    const cfg = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.outro;
    setForm(f => ({
      ...f,
      tipo,
      resultado: cfg.resultados[0].value,
      duracao_minutos: '',
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const proxDt = form.proximo_contato
        ? form.proximo_contato.toISOString().slice(0, 10)
        : addDays(new Date(), config.autoDias).toISOString().slice(0, 10);
      const { error } = await supabase.from('cs_touchpoints').insert({
        client_id: clientId, tipo: form.tipo, resultado: form.resultado,
        notas: form.notas || null,
        duracao_minutos: form.duracao_minutos ? Number(form.duracao_minutos) : null,
        data_contato: new Date().toISOString(),
        proximo_contato: proxDt,
        realizado_por: user?.id,
        cliente_faltou: form.resultado === 'cliente_faltou' ? true : null,
      });
      if (error) throw error;
      await supabase.from('platform_users')
        .update({ cs_ultimo_touchpoint: new Date().toISOString(), cs_proximo_touchpoint: proxDt })
        .eq('id', clientId);
      toast.success('Touchpoint registrado');
      qc.invalidateQueries({ queryKey: ['cs-client-detail'] });
      qc.invalidateQueries({ queryKey: ['cs-clients'] });
      qc.invalidateQueries({ queryKey: ['cs-touchpoints'] });
      onClose();
    } catch { toast.error('Erro ao salvar touchpoint'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border border-border/60 shadow-xl p-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-3">
            <span className="p-1.5 rounded-lg bg-muted">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <DialogTitle className="text-sm font-bold font-display">Novo touchpoint</DialogTitle>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{clientName}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Tipo — pills com ícone */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de contato</p>
            <div className="flex flex-wrap gap-2">
              {TP_TIPOS.map(t => {
                const Icon = t.icon;
                const active = form.tipo === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => handleTipoChange(t.value)}
                    className={cn(
                      'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors',
                      active
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resultado — pills contextuais por tipo */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resultado</p>
            <div className="flex flex-wrap gap-2">
              {config.resultados.map(r => {
                const active = form.resultado === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => setForm(f => ({ ...f, resultado: r.value }))}
                    className={cn(
                      'h-8 px-3 rounded-lg border text-xs font-medium transition-colors',
                      active ? r.activeColor : 'border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas — placeholder contextual */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas</p>
            <Textarea
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={3}
              placeholder={config.notasPlaceholder}
              className="text-sm rounded-lg border-border/60 resize-none"
            />
          </div>

          {/* Duração + Próximo contato */}
          <div className={cn('gap-4', config.duracoes ? 'grid grid-cols-2' : 'flex flex-col')}>
            {/* Duração — apenas para tipos que fazem sentido */}
            {config.duracoes && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Duração (min)</p>
                <div className="flex gap-1.5">
                  {config.duracoes.map(min => (
                    <button
                      key={min}
                      onClick={() => setForm(f => ({ ...f, duracao_minutos: f.duracao_minutos === min ? '' : min }))}
                      className={cn(
                        'flex-1 h-8 rounded-lg border text-xs font-medium tabular-nums transition-colors',
                        form.duracao_minutos === min
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border/60 text-muted-foreground hover:border-foreground/30'
                      )}
                    >
                      {min}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Próximo contato</p>
                {!form.proximo_contato && (
                  <span className="text-[10px] text-muted-foreground/40">Auto +{config.autoDias}d</span>
                )}
              </div>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button className={cn(
                    'w-full h-10 px-3 rounded-lg border border-border/60 text-xs text-left flex items-center gap-2 hover:border-foreground/30 transition-colors',
                    !form.proximo_contato ? 'text-muted-foreground' : 'text-foreground font-medium'
                  )}>
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    {form.proximo_contato
                      ? format(form.proximo_contato, "d 'de' MMM", { locale: ptBR })
                      : `Automático (${format(addDays(new Date(), config.autoDias), "d 'de' MMM", { locale: ptBR })})`
                    }
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.proximo_contato}
                    onSelect={d => { setForm(f => ({ ...f, proximo_contato: d ?? undefined })); setCalOpen(false); }}
                    locale={ptBR}
                    disabled={(d) => d < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs border-border/60">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
            {saving ? 'Salvando...' : 'Salvar touchpoint'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

function NPSDialog({ open, onClose, clientId, clientName }: { open: boolean; onClose: () => void; clientId: string; clientName: string }) {
  const qc = useQueryClient();
  const [score, setScore] = useState(9);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  const category = score >= 9
    ? { label: 'Promotor',  desc: 'Recomendaria ativamente — candidato a advocacy', color: 'text-emerald-700', border: 'border-emerald-300', bg: 'bg-emerald-50/60' }
    : score >= 7
    ? { label: 'Neutro',    desc: 'Satisfeito mas sem entusiasmo suficiente para indicar', color: 'text-amber-700', border: 'border-amber-300', bg: 'bg-amber-50/60' }
    : { label: 'Detrator',  desc: 'Risco de churn e possível feedback negativo', color: 'text-rose-600', border: 'border-border/60', bg: 'bg-card' };

  const btnActive = (i: number) =>
    i >= 9 ? 'bg-emerald-600 text-white border-emerald-600'
    : i >= 7 ? 'bg-amber-400 text-white border-amber-400'
    : 'bg-rose-500 text-white border-rose-500';

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('cs_nps_responses').insert({
        client_id: clientId, score, comentario: comentario || null,
        respondido_em: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success('NPS registrado');
      qc.invalidateQueries({ queryKey: ['cs-client-detail'] });
      onClose();
    } catch { toast.error('Erro ao salvar NPS'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border border-border/60 shadow-xl p-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-3">
            <span className="p-1.5 rounded-lg bg-muted">
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <DialogTitle className="text-sm font-bold font-display">Coletar NPS</DialogTitle>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{clientName}</p>
            </div>
          </div>
        </div>

        {/* Categoria reativa */}
        <div className={cn('mx-6 mt-5 px-4 py-3 rounded-xl border flex items-center justify-between', category.bg, category.border)}>
          <div>
            <p className={cn('text-sm font-bold', category.color)}>{category.label}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{category.desc}</p>
          </div>
          <span className={cn('text-4xl font-bold font-display tabular-nums', category.color)}>{score}</span>
        </div>

        <div className="px-6 pb-5 space-y-5 mt-4">

          {/* Botões 0–10 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/40">0 — Péssimo</p>
              <p className="text-[10px] text-muted-foreground/40">10 — Incrível</p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setScore(i)}
                  className={cn(
                    'flex-1 h-9 rounded-lg text-xs font-bold border transition-all',
                    score === i ? btnActive(i) : 'border-border/60 text-muted-foreground hover:border-foreground/30'
                  )}
                >{i}</button>
              ))}
            </div>
          </div>

          {/* Comentário */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comentário</p>
            <Textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              rows={2}
              placeholder="O que o cliente disse sobre a experiência com a plataforma?"
              className="text-sm rounded-lg border-border/60 resize-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs border-border/60">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
            {saving ? 'Salvando...' : 'Registrar NPS'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminCSCliente() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [marcosOpen, setMarcosOpen] = useState<Record<string, boolean>>({ ativacao: true });
  const [tpModal, setTpModal] = useState(false);
  const [npsModal, setNpsModal] = useState(false);
  const [npsHistoryOpen, setNpsHistoryOpen] = useState(false);
  const [athosOpen, setAthosOpen] = useState(false);
  const [dimDetailOpen, setDimDetailOpen] = useState<string | null>(null);

  const { data: client, isLoading: loadingClient } = useCSClientById(clientId);
  const { data: detail, isLoading: loadingDetail } = useClientDetail(client ?? null);
  const { data: crmMap = {} } = useCSCrmMetrics();
  const crmMetrics = client ? (crmMap[client.organization_id] ?? null) : null;
  const { data: crmDetail = null, isLoading: loadingCrmDetail } = useCSClientCrmDetail(client?.organization_id);
  const { data: crmTrend = [] } = useCSClientCrmTrend(client?.organization_id);

  const markMutation = useMutation({
    mutationFn: async (marco: string) => {
      const { error } = await supabase.from('cs_marcos').upsert({
        client_id: clientId, marco, atingido: true, atingido_em: new Date().toISOString(), automatico: false,
      }, { onConflict: 'client_id,marco' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marco marcado como atingido');
      qc.invalidateQueries({ queryKey: ['cs-client-detail', clientId] });
    },
    onError: () => toast.error('Erro ao marcar marco'),
  });

  if (loadingClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button onClick={() => navigate('/admin/cs')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para CS
        </button>
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  const name = clientName(client);
  const autoScore = detail ? calcAutoScore(client, detail) : null;
  // Modelo 2-eixos: Adoção (uso da plataforma) + Resultado (resultado no CRM).
  const adocaoScore = autoScore
    ? computeAdocaoFull({
        ativacao: autoScore.ativacao, jornada: autoScore.jornada, arsenal: autoScore.arsenal,
        rotinaCrm: autoScore.crm, responsividade: autoScore.responsividade,
      })
    : null;
  const resultadoBreakdown = crmMetrics ? computeResultadoBreakdown(crmMetrics) : null;
  const resultadoScore = resultadoBreakdown?.total ?? null;
  const health2 = (adocaoScore != null && resultadoScore != null)
    ? computeHealth2Axis(adocaoScore, resultadoScore)
    : null;
  const signals = detail ? detectRiskSignals(client, detail, crmMetrics) : [];
  // Tendência do Resultado (snapshots): delta na janela + alerta de deterioração.
  const trendPts = crmTrend.filter(p => p.resultado_score != null);
  const trendDelta = trendPts.length >= 2
    ? (trendPts[trendPts.length - 1].resultado_score! - trendPts[0].resultado_score!)
    : null;
  if (trendDelta != null && trendDelta <= -8) {
    signals.unshift({
      id: 15,
      descricao: `Resultado no CRM caiu ${Math.abs(trendDelta)} pts nas últimas semanas`,
      gravidade: trendDelta <= -15 ? 'critico' : 'alto',
    });
  }
  const acoes = detail ? getProximasAcoes(client, detail, signals) : [];
  const hs = health2?.status ?? effectiveHealth(client);
  const displayScore = health2?.total ?? autoScore?.total ?? client.latest_health?.score_total ?? null;

  type HealthKey = 'verde' | 'amarelo' | 'vermelho';
  const statusMap: Record<HealthKey, { strip: string; dot: string; badge: string; scoreBadge: string; label: string }> = {
    verde:    { strip: 'bg-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',   scoreBadge: 'bg-card border-2 border-emerald-400 text-emerald-700', label: 'Saudável'   },
    amarelo:  { strip: 'bg-amber-400',   dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',         scoreBadge: 'bg-card border-2 border-amber-400 text-amber-700',   label: 'Atenção'     },
    vermelho: { strip: 'bg-red-500',     dot: 'bg-red-500',     badge: 'bg-muted text-rose-600 border-border/60',             scoreBadge: 'bg-card border-2 border-rose-400 text-rose-600',     label: 'Em risco'    },
  };
  const statusStyle = statusMap[hs as HealthKey] ?? { strip: 'bg-border/60', dot: 'bg-muted-foreground/25', badge: 'bg-muted text-muted-foreground border-border/60', scoreBadge: 'bg-muted border-2 border-border/60 text-muted-foreground', label: 'Sem avaliação' };

  const diasSemContato = client.cs_ultimo_touchpoint
    ? differenceInDays(new Date(), new Date(client.cs_ultimo_touchpoint))
    : null;

  // Rola até a seção correspondente em "Resultado no CRM" (acima), que já traz
  // o detalhe completo (gráfico, funil, tempo, meta) — evita duplicar dialogs.
  const scrollToResultado = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Back */}
      <button onClick={() => navigate('/admin/cs')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para CS
      </button>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Health status strip */}
        <div className={cn('h-1', statusStyle.strip)} />

        <div className="px-6 py-5">
          <div className="flex items-start gap-5">
            {/* Left: identity */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-display mb-2">{name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border', statusStyle.badge)}>
                  <div className={cn('w-1.5 h-1.5 rounded-full', statusStyle.dot)} />
                  {statusStyle.label}
                </span>
                {client.cs_fase && (
                  <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-lg border', FASE_COLORS[client.cs_fase])}>
                    {FASE_LABELS[client.cs_fase]}
                  </span>
                )}
                {client.product_name && (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border/40">
                    {client.product_name.split('—')[0].trim()}
                  </span>
                )}
              </div>
            </div>

            {/* Right: score box */}
            {displayScore != null && (
              <div className={cn('flex flex-col items-center justify-center min-w-[72px] h-[72px] rounded-2xl border-2 flex-shrink-0', statusStyle.scoreBadge)}>
                <span className="text-2xl font-bold tabular-nums font-display leading-none">{displayScore}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-50 mt-1">score</span>
              </div>
            )}
          </div>

          {/* Linha do tempo de fase */}
          {detail?.diasNaPlataforma != null && (() => {
            const dias = detail.diasNaPlataforma!;
            const faseEsp = getFaseEsperada(dias);
            const semana = getSemana(dias);
            const mes = getMes(dias);
            const diasRestantes = getDiasRestantesNaFase(faseEsp, dias);
            const totalRef = 240;
            const pctPos = Math.min(99, Math.max(1, (dias / totalRef) * 100));

            const marcos = [
              { d: 0,   pct: 0,                      label: 'D0'   },
              { d: 30,  pct: (30/totalRef)*100,       label: 'D30'  },
              { d: 90,  pct: (90/totalRef)*100,       label: 'D90'  },
              { d: 180, pct: (180/totalRef)*100,      label: 'D180' },
            ];

            const segmentos = [
              { key: 'ativacao',   label: 'Ativação',    de: 0,   ate: 30,  cor: 'bg-blue-400',   pctStart: 0,                  pctWidth: (30/totalRef)*100 },
              { key: 'execucao',   label: 'Execução',    de: 31,  ate: 90,  cor: 'bg-amber-400',  pctStart: (30/totalRef)*100,  pctWidth: (60/totalRef)*100 },
              { key: 'tracao',     label: 'Tração',      de: 91,  ate: 180, cor: 'bg-violet-400', pctStart: (90/totalRef)*100,  pctWidth: (90/totalRef)*100 },
              { key: 'maturidade', label: 'Maturidade',  de: 181, ate: null,cor: 'bg-emerald-400',pctStart: (180/totalRef)*100, pctWidth: (60/totalRef)*100 },
            ];

            return (
              <div className="mt-4 pt-4 border-t border-border/40">
                {/* Contadores de tempo em linha */}
                <div className="flex items-center gap-5 mb-4 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Dia</span>
                    <span className="text-lg font-bold tabular-nums font-display text-foreground leading-none">D{dias}</span>
                  </div>
                  <div className="w-px h-8 bg-border/40 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Semana</span>
                    <span className="text-lg font-bold tabular-nums font-display text-foreground leading-none">{semana}</span>
                  </div>
                  <div className="w-px h-8 bg-border/40 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Mês</span>
                    <span className="text-lg font-bold tabular-nums font-display text-foreground leading-none">{mes}</span>
                  </div>
                  {diasRestantes !== null && (
                    <>
                      <div className="w-px h-8 bg-border/40 flex-shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Restam na fase</span>
                        <span className={cn('text-lg font-bold tabular-nums font-display leading-none', diasRestantes <= 7 ? 'text-amber-600' : 'text-foreground')}>
                          {diasRestantes === 0 ? '—' : `${diasRestantes}d`}
                        </span>
                      </div>
                    </>
                  )}
                  {client.cs_fase && client.cs_fase !== faseEsp && (
                    <span className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/70 font-medium ml-auto">
                      Fase manual: {FASE_LABELS[client.cs_fase]} (esperada: {FASE_LABELS[faseEsp]})
                    </span>
                  )}
                </div>

                {/* Barra de progresso limpa */}
                <div className="relative pt-2 pb-5">
                  {/* Track */}
                  <div className="relative h-2 rounded-full bg-muted/50 overflow-visible">
                    {/* Segmentos coloridos */}
                    {segmentos.map(seg => (
                      <div
                        key={seg.key}
                        className={cn('absolute top-0 h-full rounded-full opacity-20', seg.cor)}
                        style={{ left: `${seg.pctStart}%`, width: `${seg.pctWidth}%` }}
                      />
                    ))}
                    {/* Progresso preenchido até o dia atual */}
                    <div
                      className={cn('absolute top-0 left-0 h-full rounded-full opacity-70', segmentos.find(s => s.key === faseEsp)?.cor ?? 'bg-foreground')}
                      style={{ width: `${pctPos}%` }}
                    />
                    {/* Marcadores de marco (ticks) */}
                    {marcos.map(m => (
                      <div
                        key={m.d}
                        className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-border/60"
                        style={{ left: `${m.pct}%` }}
                      />
                    ))}
                    {/* Dot da posição atual */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-foreground border-2 border-background shadow-sm"
                      style={{ left: `${pctPos}%`, transform: 'translate(-50%, -50%)' }}
                    />
                  </div>

                  {/* Labels dos marcos */}
                  <div className="relative h-4 mt-1">
                    {marcos.map(m => (
                      <span
                        key={m.d}
                        className="absolute text-[9px] font-display font-bold text-muted-foreground/40 tabular-nums"
                        style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}
                      >
                        {m.label}
                      </span>
                    ))}
                    {/* Label da posição atual */}
                    <span
                      className="absolute text-[9px] font-display font-bold text-foreground tabular-nums -top-0.5"
                      style={{ left: `${pctPos}%`, transform: 'translateX(-50%)' }}
                    >
                      D{dias}
                    </span>
                  </div>

                  {/* Nomes das fases abaixo */}
                  <div className="relative h-3 mt-0.5">
                    {segmentos.map(seg => (
                      <span
                        key={seg.key}
                        className={cn('absolute text-[8px] font-bold uppercase tracking-wider',
                          seg.key === faseEsp ? 'text-foreground/60' : 'text-muted-foreground/30'
                        )}
                        style={{ left: `${seg.pctStart + seg.pctWidth / 2}%`, transform: 'translateX(-50%)' }}
                      >
                        {seg.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Info strip */}
          {detail && (
            <div className="flex items-center gap-0 mt-4 pt-4 border-t border-border/40">
              {[
                diasSemContato != null && { label: 'Sem contato', value: `${diasSemContato}d`, alert: diasSemContato >= 14 },
                detail.jornada && { label: 'Jornada', value: `${detail.jornada.pctConcluido}%` },
                detail.ferramentasConstruidas > 0 && { label: 'Arsenal', value: `${detail.ferramentasConstruidas} ferramentas` },
                detail.nps && { label: 'NPS', value: String(detail.nps.score), nps: true, score: detail.nps.score },
              ].filter(Boolean).map((item: any, i, arr) => (
                <div key={i} className={cn('flex flex-col gap-0.5 pr-5', i < arr.length - 1 && 'border-r border-border/40 mr-5')}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{item.label}</span>
                  <span className={cn('text-sm font-bold tabular-nums',
                    item.alert ? 'text-amber-600' :
                    item.nps ? (item.score >= 9 ? 'text-emerald-600' : item.score >= 7 ? 'text-amber-600' : 'text-red-600') :
                    'text-foreground'
                  )}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3 border-t border-border/40 bg-muted/20 flex items-center gap-2">
          <Button onClick={() => setTpModal(true)} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-4">
            <MessageCircle className="h-3.5 w-3.5" /> Novo touchpoint
          </Button>
          <Button onClick={() => setNpsModal(true)} variant="outline" className="h-9 rounded-lg text-xs font-medium border-border/60 gap-1.5 px-3">
            <Star className="h-3.5 w-3.5" /> Coletar NPS
          </Button>
          <Button onClick={() => setAthosOpen(true)} variant="outline" className="h-9 rounded-lg text-xs font-medium border-border/60 gap-1.5 px-3 ml-auto">
            <Sparkles className="h-3.5 w-3.5" /> Perguntar ao Athos
          </Button>
        </div>
      </div>

      <Dialog open={athosOpen} onOpenChange={setAthosOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Athos CS — {name}</DialogTitle></DialogHeader>
          <div className="p-3">
            <AthosCsChat clientOrgId={client.organization_id} clientName={name} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── RESULTADO NO CRM (destaque — o que o cliente percebe) ── */}
      <ResultadoCrmSection orgId={client.organization_id} metrics={crmMetrics} detail={crmDetail} loading={loadingCrmDetail} />

      {/* ── JORNADA DO CLIENTE (consultoria mensal dirigida pelo CS) ── */}
      <CsJornadaSection crmUserId={client.crm_user_id} clientOrgId={client.organization_id} clientName={name} />

      {loadingDetail ? (
        <div className="flex items-center justify-center py-16">
          <Activity className="h-5 w-5 animate-pulse text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">

          {/* ── Coluna esquerda ─────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Sinais de risco */}
            {signals.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="h-0.5 bg-rose-500" />
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-muted">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sinais de Risco</p>
                    <p className="text-[10px] text-rose-500/60 mt-0.5">{signals.length} sinal{signals.length > 1 ? 'is' : ''} detectado{signals.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {signals.map((s, i) => (
                    <div key={i} className={cn(
                      'flex items-start gap-3 px-4 py-3 rounded-xl border border-border/60',
                      s.gravidade === 'critico' ? 'border-l-[3px] border-l-rose-500' :
                      s.gravidade === 'alto' ? 'border-l-[3px] border-l-orange-400' :
                      'border-l-[3px] border-l-amber-400'
                    )}>
                      <div className={cn('w-2 h-2 rounded-full mt-1 flex-shrink-0',
                        s.gravidade === 'critico' ? 'bg-red-500' :
                        s.gravidade === 'alto' ? 'bg-orange-500' : 'bg-amber-500'
                      )} />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{s.descricao}</p>
                        <p className={cn('text-[10px] font-medium mt-0.5 uppercase tracking-wider',
                          s.gravidade === 'critico' ? 'text-rose-600' :
                          s.gravidade === 'alto' ? 'text-orange-600' : 'text-amber-600'
                        )}>
                          {s.gravidade === 'critico' ? 'Crítico' : s.gravidade === 'alto' ? 'Alta prioridade' : 'Média prioridade'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Próximas ações */}
            {acoes.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próximas Ações</p>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {acoes.map((a, i) => (
                    <div key={i} className={cn(
                      'flex items-start gap-3 px-4 py-3 rounded-xl border border-border/60',
                      a.prioridade === 'urgente' ? 'border-l-[3px] border-l-rose-500' :
                      a.prioridade === 'alta' ? 'border-l-[3px] border-l-amber-400' :
                      ''
                    )}>
                      <span className={cn('mt-0.5 flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                        a.prioridade === 'urgente' ? 'bg-muted text-rose-600' :
                        a.prioridade === 'alta' ? 'bg-muted text-amber-600' :
                        'bg-muted text-muted-foreground/60'
                      )}>
                        {a.prioridade === 'urgente' ? 'Urgente' : a.prioridade === 'alta' ? 'Alta' : 'Normal'}
                      </span>
                      <div>
                        <p className="text-xs font-semibold">{a.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{a.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Protocolo Ativo */}
            {detail?.protocols && detail.protocols.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted"><Zap className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Protocolo Ativo</p>
                  </div>
                </div>
                <div className="px-4 py-4 space-y-3">
                  {detail.protocols.map(p => {
                    const cfg = PROTOCOL_CONFIGS[p.tipo];
                    const daysActive = differenceInDays(new Date(), parseISO(p.iniciado_em));
                    const totalSteps = PROTOCOL_STEP_COUNT[p.tipo] ?? 0;
                    const doneSoFar = p.passos_concluidos.length;
                    const pct = totalSteps > 0 ? Math.round(doneSoFar / totalSteps * 100) : 0;
                    return (
                      <div key={p.id} className={cn('rounded-xl border px-5 py-4', cfg?.color ?? 'border-border/60 bg-muted/20')}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                            <p className="text-sm font-bold">{cfg?.label ?? p.tipo}</p>
                          </div>
                          <span className="text-[11px] font-semibold tabular-nums opacity-50">Dia {daysActive}</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="opacity-60">{doneSoFar} de {totalSteps} passos</span>
                            <span className="font-bold tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                            <div className={cn('h-full rounded-full', cfg?.bar ?? 'bg-foreground')} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        {p.notas && <p className="text-xs mt-2.5 opacity-60 line-clamp-2">{p.notas.split('\n')[0]}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Health Score */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted"><Activity className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Health Score</p>
                  </div>
                  {detail?.healthScores[0] && (
                    <span className="text-[10px] text-muted-foreground/40">
                      Avaliado {formatDistanceToNow(parseISO(detail.healthScores[0].avaliado_em), { addSuffix: true, locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-5 py-5">
                {autoScore && detail ? (
                  <div className="space-y-4">
                    {health2 && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {([
                            { label: 'Adoção', sub: 'uso da plataforma', value: health2.adocao, bar: 'bg-sky-500' },
                            { label: 'Resultado', sub: 'resultado no CRM', value: health2.resultado, bar: 'bg-emerald-500' },
                          ] as const).map(ax => {
                            const c = ax.value >= 70 ? 'text-emerald-600' : ax.value >= 45 ? 'text-amber-600' : 'text-rose-600';
                            return (
                              <div key={ax.label} className="rounded-xl border border-border/50 p-3.5">
                                <div className="flex items-baseline justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{ax.label}</p>
                                  <span className={cn('text-lg font-bold tabular-nums font-display', c)}>{ax.value}</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground/50 mb-2">{ax.sub}</p>
                                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                                  <div className={cn('h-full rounded-full', ax.bar)} style={{ width: `${ax.value}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className={cn('rounded-xl border px-5 py-4 flex items-center justify-between gap-4', HEALTH_BG[health2.status])}>
                          <div>
                            <p className="text-sm font-bold">Health Score</p>
                            <p className="text-[10px] font-medium mt-0.5 opacity-70">40% Adoção · 60% Resultado — o cliente percebe resultado</p>
                          </div>
                          <span className="text-4xl font-bold tabular-nums font-display flex-shrink-0">{health2.total}</span>
                        </div>

                        {/* Tendência do Resultado no CRM (snapshots diários) */}
                        <div className="rounded-xl border border-border/50 px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tendência do Resultado</p>
                            {trendDelta != null && (
                              <span className={cn('text-[11px] font-bold tabular-nums flex items-center gap-0.5',
                                trendDelta > 0 ? 'text-emerald-600' : trendDelta < 0 ? 'text-rose-600' : 'text-muted-foreground/50')}>
                                {trendDelta > 0 ? <TrendingUp className="h-3 w-3" /> : trendDelta < 0 ? <ArrowLeft className="h-3 w-3 -rotate-90" /> : null}
                                {trendDelta > 0 ? '+' : ''}{trendDelta} pts
                              </span>
                            )}
                          </div>
                          {trendPts.length >= 2 ? (
                            <div className="h-14">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendPts} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                                      <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <YAxis domain={[0, 100]} hide />
                                  <RTooltip
                                    formatter={(v: number) => [`${v}`, 'Resultado']}
                                    labelFormatter={(_: unknown, p: readonly { payload?: { snapshot_date?: string } }[]) =>
                                      p?.[0]?.payload?.snapshot_date
                                        ? format(parseISO(p[0].payload.snapshot_date), "d 'de' MMM", { locale: ptBR }) : ''}
                                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid hsl(var(--border))' }}
                                  />
                                  <Area type="monotone" dataKey="resultado_score" stroke="#059669" strokeWidth={2} fill="url(#trendGrad)" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground/50 py-2">
                              Começamos a registrar o Resultado hoje. A curva de evolução aparece à medida que os dias passam.
                            </p>
                          )}
                        </div>

                        <div className="border-t border-border/40" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Detalhe da adoção</p>
                      </>
                    )}
                    <DimBar
                      label="Ativação"
                      value={autoScore.ativacao}
                      color="bg-blue-500"
                      auto
                      detalhe={
                        client.onboarding_complete ? 'Checklist da plataforma completo' :
                        client.onboarding_concluido ? 'Diagnóstico concluído — checklist pendente' :
                        'Onboarding ainda não iniciado'
                      }
                      onClick={() => setDimDetailOpen('Ativação')}
                    />
                    <DimBar
                      label="Jornada"
                      value={autoScore.jornada}
                      color="bg-violet-500"
                      auto
                      detalhe={
                        detail.jornada
                          ? `${detail.jornada.pctConcluido}% concluída · ${detail.jornada.passosConcluidos} de ${detail.jornada.totalPassos} passos`
                          : 'Jornada ainda não gerada pelo Athos'
                      }
                      onClick={() => setDimDetailOpen('Jornada')}
                    />
                    <DimBar
                      label="Arsenal"
                      value={autoScore.arsenal}
                      color="bg-amber-500"
                      auto
                      detalhe={`${detail.ferramentasConstruidas} ferramenta${detail.ferramentasConstruidas !== 1 ? 's' : ''} construída${detail.ferramentasConstruidas !== 1 ? 's' : ''} · ${detail.aulasConcluidas} aula${detail.aulasConcluidas !== 1 ? 's' : ''} concluída${detail.aulasConcluidas !== 1 ? 's' : ''}`}
                      onClick={() => setDimDetailOpen('Arsenal')}
                    />
                    <DimBar
                      label="CRM"
                      value={autoScore.crm}
                      color="bg-emerald-500"
                      auto={detail.crmCheckinScore !== null}
                      detalhe={
                        detail.crmCheckinScore !== null
                          ? `${detail.crmCheckinCompleted} de ${detail.crmCheckinTotal} checkins nos últimos 30 dias`
                          : 'Sem checkins registrados — usando valor padrão (50)'
                      }
                      onClick={() => setDimDetailOpen('CRM')}
                    />
                    <DimBar
                      label="Responsividade"
                      value={autoScore.responsividade}
                      color="bg-sky-500"
                      auto
                      detalhe={
                        diasSemContato !== null
                          ? `Último contato há ${diasSemContato} dia${diasSemContato !== 1 ? 's' : ''}`
                          : 'Nenhum touchpoint registrado ainda'
                      }
                      onClick={() => setDimDetailOpen('Responsividade')}
                    />

                    {resultadoBreakdown && crmMetrics && (
                      <>
                        <div className="border-t border-border/40" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Detalhe do resultado</p>
                        <DimBar
                          label="Crescimento"
                          value={resultadoBreakdown.growth}
                          color="bg-emerald-500"
                          auto
                          detalhe={
                            crmMetrics.fat_growth_pct != null
                              ? `${crmMetrics.fat_growth_pct > 0 ? '+' : ''}${crmMetrics.fat_growth_pct}% vs. período anterior`
                              : crmMetrics.fat_30d > 0
                              ? 'Cliente novo — ainda sem período anterior para comparar'
                              : 'Sem faturamento registrado ainda'
                          }
                          onClick={() => scrollToResultado('resultado-financeiro')}
                        />
                        <DimBar
                          label="Receita"
                          value={resultadoBreakdown.receita}
                          color="bg-teal-500"
                          auto
                          detalhe={`${crmMetrics.fechamentos_30d} fechamento${crmMetrics.fechamentos_30d !== 1 ? 's' : ''} nos últimos 30 dias`}
                          onClick={() => scrollToResultado('resultado-financeiro')}
                        />
                        <DimBar
                          label="Conversão"
                          value={resultadoBreakdown.conversao}
                          color="bg-indigo-500"
                          auto
                          detalhe={
                            crmMetrics.tx_fech != null
                              ? `${crmMetrics.tx_fech}% de taxa de fechamento (lead → venda)`
                              : 'Sem leads suficientes para calcular'
                          }
                          onClick={() => scrollToResultado('resultado-funil')}
                        />
                        <DimBar
                          label="Tempo"
                          value={resultadoBreakdown.tempo}
                          color="bg-cyan-500"
                          auto
                          detalhe={
                            crmMetrics.tempo_1o_contato_med_min != null
                              ? `${formatMinutes(crmMetrics.tempo_1o_contato_med_min)} até o 1º contato, em média`
                              : 'Sem dados de tempo de resposta ainda'
                          }
                          onClick={() => scrollToResultado('resultado-tempo')}
                        />
                        <DimBar
                          label="Meta"
                          value={resultadoBreakdown.meta ?? 0}
                          color="bg-orange-500"
                          auto={resultadoBreakdown.meta != null}
                          detalhe={
                            resultadoBreakdown.meta != null
                              ? `${crmMetrics.meta_pct}% da meta de faturamento batida`
                              : 'Meta de faturamento não configurada'
                          }
                          onClick={() => scrollToResultado('resultado-meta')}
                        />
                      </>
                    )}

                    {!health2 && (
                      <>
                        <div className="border-t border-border/40" />
                        <div className={cn('rounded-xl border px-5 py-4 flex items-center justify-between gap-4', HEALTH_BG[autoScore.status])}>
                          <div>
                            <p className="text-sm font-bold">Score calculado</p>
                            <p className="text-[10px] font-medium mt-0.5 opacity-70 capitalize">
                              {autoScore.status === 'verde' ? 'Saudável' : autoScore.status === 'amarelo' ? 'Atenção' : 'Em risco'}
                            </p>
                            <p className="text-[9px] text-muted-foreground/40 mt-1.5 font-mono">{'≥70 saudável · ≥40 atenção · <40 em risco'}</p>
                          </div>
                          <span className="text-4xl font-bold tabular-nums font-display flex-shrink-0">{autoScore.total}</span>
                        </div>
                      </>
                    )}

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <Activity className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Sem dados de checkin ainda</p>
                    <p className="text-[11px] text-muted-foreground/50">O score CRM é calculado automaticamente quando o cliente registrar checkins de performance</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Coluna direita ──────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Marcos da Jornada */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Marcos da Jornada</p>
              </div>
              <div className="px-4 py-4">
                {detail ? (
                  <div className="space-y-2">
                    {FASES_ORDER.map(fase => {
                      const marcosDoFase = MARCOS_POR_FASE.filter(m => m.fase === fase);
                      const atingidos = marcosDoFase.filter(m => getMarcoAtingido(m.id, client, detail)).length;
                      const total = marcosDoFase.length;
                      const isCurrent = client.cs_fase === fase;
                      const expanded = marcosOpen[fase] ?? isCurrent;
                      const allDone = atingidos === total;
                      return (
                        <div key={fase} className={cn(
                          'rounded-xl border overflow-hidden',
                          isCurrent ? 'border-foreground/20 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]' : 'border-border/40'
                        )}>
                          <button
                            onClick={() => setMarcosOpen(e => ({ ...e, [fase]: !expanded }))}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                          >
                            {allDone
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                              : <div className={cn('w-4 h-4 rounded-full border-2 flex-shrink-0',
                                  isCurrent ? 'border-foreground/40' : 'border-muted-foreground/25')} />
                            }
                            <span className={cn('flex-1 text-xs font-bold', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                              {FASE_LABELS[fase]}
                            </span>
                            <div className="flex items-center gap-2 mr-1">
                              <div className="flex h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div className="bg-emerald-500 rounded-full h-full" style={{ width: `${Math.round(atingidos / total * 100)}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground/50 w-6 text-right tabular-nums">{atingidos}/{total}</span>
                            </div>
                            {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          </button>
                          {expanded && (
                            <div className="border-t border-border/40 px-4 pb-3 pt-2">
                              {marcosDoFase.map(marco => {
                                const atingido = getMarcoAtingido(marco.id, client, detail);
                                return (
                                  <div key={marco.id} className="flex items-center gap-2.5 py-2">
                                    {atingido
                                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                      : <Circle className="h-3.5 w-3.5 text-muted-foreground/20 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider w-8">{marco.dia}</span>
                                        <span className={cn('text-xs', atingido ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                          {marco.label}
                                        </span>
                                      </div>
                                      {!atingido && <p className="text-[10px] text-muted-foreground/40 mt-0.5 ml-9">{marco.descricao}</p>}
                                    </div>
                                    {!marco.auto && !atingido && (
                                      <button
                                        onClick={() => markMutation.mutate(marco.id)}
                                        disabled={markMutation.isPending}
                                        className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                                      >
                                        Marcar
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50 text-center py-4">Carregando...</p>
                )}
              </div>
            </div>

            {/* Histórico de Contatos */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico de Contatos</p>
                  <button onClick={() => setTpModal(true)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border/60 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                    <Plus className="h-3 w-3" /> Novo
                  </button>
                </div>
              </div>

              {detail && detail.touchpoints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-3 rounded-xl bg-muted/40 mb-2">
                    <MessageCircle className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum touchpoint registrado</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">Registre o primeiro contato com este cliente</p>
                </div>
              ) : (
                <div className="px-5 py-4">
                  {/* Timeline */}
                  <div className="relative">
                    <div className="absolute left-[18px] top-3 bottom-3 w-px bg-border/40" />
                    <div className="space-y-0">
                      {(detail?.touchpoints || []).map((tp, i) => {
                        const Icon = TIPO_ICONS[tp.tipo] || Activity;
                        return (
                          <div key={tp.id} className={cn('flex items-start gap-3 pb-4', i === 0 ? 'pt-0' : 'pt-0')}>
                            <div className="relative z-10 flex-shrink-0">
                              <div className="w-9 h-9 rounded-full bg-card border border-border/60 flex items-center justify-center">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold">{TIPO_LABELS[tp.tipo]}</span>
                                <span className={cn('text-[10px] font-semibold', RESULTADO_COLORS[tp.resultado])}>
                                  {RESULTADO_LABELS[tp.resultado]}
                                </span>
                              </div>
                              {tp.notas && <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{tp.notas}</p>}
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-muted-foreground/40">
                                  {formatDistanceToNow(parseISO(tp.data_contato), { addSuffix: true, locale: ptBR })}
                                </p>
                                {tp.duracao_minutos && (
                                  <span className="text-[10px] text-muted-foreground/40">· {tp.duracao_minutos}min</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* NPS */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted"><Star className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">NPS</p>
                  </div>
                  <button onClick={() => setNpsModal(true)}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    Coletar NPS
                  </button>
                </div>
              </div>
              <div className="px-5 py-5">
                {detail?.nps ? (
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      'w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 flex-shrink-0 bg-card',
                      detail.nps.score >= 9 ? 'border-emerald-400' :
                      detail.nps.score >= 7 ? 'border-amber-400' : 'border-rose-400'
                    )}>
                      <span className={cn('text-2xl font-bold tabular-nums font-display leading-none',
                        detail.nps.score >= 9 ? 'text-emerald-700' :
                        detail.nps.score >= 7 ? 'text-amber-700' : 'text-rose-600'
                      )}>{detail.nps.score}</span>
                      <span className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5',
                        detail.nps.score >= 9 ? 'text-emerald-600/60' :
                        detail.nps.score >= 7 ? 'text-amber-600/60' : 'text-rose-600/60'
                      )}>NPS</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-bold',
                        detail.nps.score >= 9 ? 'text-emerald-700' :
                        detail.nps.score >= 7 ? 'text-amber-700' : 'text-rose-600'
                      )}>
                        {detail.nps.score >= 9 ? 'Promotor' : detail.nps.score >= 7 ? 'Neutro' : 'Detrator'}
                      </p>
                      {detail.nps.comentario && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">"{detail.nps.comentario}"</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/40 mt-2">
                        {format(parseISO(detail.nps.respondido_em), "d 'de' MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <Star className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">NPS não coletado</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Registre a avaliação do cliente</p>
                  </div>
                )}
                {(detail?.npsHistory?.length ?? 0) > 1 && (
                  <>
                    <button
                      onClick={() => setNpsHistoryOpen(o => !o)}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 mt-4"
                    >
                      {npsHistoryOpen ? 'Ocultar histórico completo' : `Ver histórico completo (${detail!.npsHistory.length})`}
                    </button>
                    {npsHistoryOpen && (
                      <div className="mt-3 -mx-5 border-t border-border/40 divide-y divide-border/40">
                        {detail!.npsHistory.map(h => (
                          <NpsResponseRow
                            key={h.id}
                            response={{ ...h, client_id: clientId, platform_users: null }}
                            showClientName={false}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modals */}
      <TouchpointDialog open={tpModal} onClose={() => setTpModal(false)} clientId={clientId} clientName={name} />
      <NPSDialog open={npsModal} onClose={() => setNpsModal(false)} clientId={clientId} clientName={name} />
      {autoScore && detail && (
        <DimDetailDialog
          dim={dimDetailOpen}
          detail={detail}
          client={client}
          autoScore={autoScore}
          onClose={() => setDimDetailOpen(null)}
        />
      )}
    </div>
  );
}
