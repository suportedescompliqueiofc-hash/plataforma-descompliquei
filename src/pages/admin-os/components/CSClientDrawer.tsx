import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, AlertTriangle, CheckCircle2, Circle, Activity,
  MessageCircle, Video, Mail, Phone, ChevronDown, ChevronRight,
  Star, Plus, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type CSClient,
  FASE_LABELS, FASE_COLORS, HEALTH_BG,
  TIPO_LABELS, RESULTADO_COLORS, RESULTADO_LABELS,
  clientName, effectiveHealth,
} from '../types/cs';

// ── Internal types ─────────────────────────────────────────────────────────

interface ClientDetailData {
  jornada: {
    id: string;
    totalPassos: number;
    passosConcluidos: number;
    pctConcluido: number;
    lastActivity: string | null;
  } | null;
  ferramentasConstruidas: number;
  aulasConcluidas: number;
  touchpoints: Array<{
    id: string;
    tipo: string;
    resultado: string;
    data_contato: string;
    notas: string | null;
    duracao_minutos: number | null;
    proximo_contato: string | null;
    cliente_faltou: boolean | null;
  }>;
  nps: { score: number; comentario: string | null; respondido_em: string } | null;
  healthScores: Array<{
    score_total: number;
    status_calculado: string;
    avaliado_em: string;
    dim_ativacao: number;
    dim_jornada: number;
    dim_arsenal: number;
    dim_crm: number;
    dim_responsividade: number;
  }>;
  marcos: Array<{ marco: string; atingido: boolean; atingido_em: string | null }>;
  protocols: Array<{
    id: string;
    tipo: string;
    passos_concluidos: string[];
    notas: string | null;
    iniciado_em: string;
  }>;
  diasNaPlataforma: number | null;
}

interface AutoScore {
  ativacao: number;
  jornada: number;
  arsenal: number;
  crm: number;
  responsividade: number;
  total: number;
  status: 'verde' | 'amarelo' | 'vermelho';
}

interface RiskSignal {
  id: number;
  descricao: string;
  gravidade: 'critico' | 'alto' | 'medio';
}

interface ProximaAcao {
  prioridade: 'urgente' | 'alta' | 'normal';
  titulo: string;
  descricao: string;
}

// ── Marcos definition ──────────────────────────────────────────────────────

const MARCOS_POR_FASE = [
  { id: 'd3_diagnostico',   label: 'Diagnóstico completo',          descricao: 'Formulário diagnóstico preenchido',       fase: 'ativacao',   dia: 'D3',   auto: true  },
  { id: 'd7_jornada',       label: 'Jornada ativa',                 descricao: 'Jornada personalizada criada e iniciada', fase: 'ativacao',   dia: 'D7',   auto: true  },
  { id: 'd14_ferramenta',   label: 'Primeira ferramenta construída', descricao: '1+ ferramenta do Arsenal salva',          fase: 'ativacao',   dia: 'D14',  auto: true  },
  { id: 'd21_crm_lead',     label: 'CRM com lead ativo',            descricao: 'Ao menos 1 lead cadastrado no CRM',      fase: 'ativacao',   dia: 'D21',  auto: false },
  { id: 'd30_3ferramentas', label: '3+ ferramentas do Arsenal',     descricao: '3 ou mais ferramentas construídas',      fase: 'ativacao',   dia: 'D30',  auto: true  },
  { id: 'd60_30pct',        label: '30% da jornada concluída',      descricao: 'Progresso mínimo na trilha',              fase: 'execucao',   dia: 'D60',  auto: true  },
  { id: 'd60_resultado_crm',label: 'Primeiros resultados no CRM',  descricao: 'Resultado declarado pelo cliente',        fase: 'execucao',   dia: 'D60',  auto: false },
  { id: 'd90_50pct',        label: '50% da jornada concluída',      descricao: 'Metade da trilha completada',             fase: 'execucao',   dia: 'D90',  auto: true  },
  { id: 'd120_70pct',       label: '70% da jornada concluída',      descricao: 'Proximidade da conclusão',                fase: 'tracao',     dia: 'D120', auto: true  },
  { id: 'd120_nps',         label: 'NPS coletado (≥ 8)',            descricao: 'Promotor identificado',                   fase: 'tracao',     dia: 'D120', auto: true  },
  { id: 'd180_concluida',   label: 'Jornada concluída',             descricao: '95%+ da trilha completa',                 fase: 'maturidade', dia: 'D180', auto: true  },
] as const;

const FASES_ORDER = ['ativacao', 'execucao', 'tracao', 'maturidade'] as const;

const TIPO_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle, reuniao: Video, email: Mail, ligacao: Phone, outro: Activity,
};

const PROTOCOL_CONFIGS: Record<string, { label: string; color: string }> = {
  onboarding: { label: 'Onboarding', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  risco: { label: 'Risco de Churn', color: 'text-red-700 bg-red-50 border-red-200' },
  engajamento: { label: 'Engajamento', color: 'text-violet-700 bg-violet-50 border-violet-200' },
  escalada: { label: 'Escalada', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  expansao: { label: 'Expansão', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
};

const PROTOCOL_STEP_COUNT: Record<string, number> = {
  onboarding: 7, risco: 5, engajamento: 4, escalada: 6, expansao: 5,
};

// ── Hook ──────────────────────────────────────────────────────────────────

function useClientDetail(client: CSClient | null) {
  return useQuery({
    queryKey: ['cs-client-detail', client?.id, client?.crm_user_id],
    enabled: !!client,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ClientDetailData> => {
      const clientId = client!.id;
      const crmUserId = client!.crm_user_id;
      const orgId = client!.organization_id;

      const [tpRes, npsRes, hsRes, tenantRes, marcosRes, protocolsRes] = await Promise.all([
        supabase.from('cs_touchpoints')
          .select('id, tipo, resultado, data_contato, notas, duracao_minutos, proximo_contato, cliente_faltou')
          .eq('client_id', clientId)
          .order('data_contato', { ascending: false })
          .limit(10),
        supabase.from('cs_nps_responses')
          .select('score, comentario, respondido_em')
          .eq('client_id', clientId)
          .order('respondido_em', { ascending: false })
          .limit(1),
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
      ]);

      let jornada: ClientDetailData['jornada'] = null;
      let ferramentasConstruidas = 0;
      let aulasConcluidas = 0;

      if (crmUserId) {
        const [jornadaRes, materiaisRes, aulasRes] = await Promise.allSettled([
          supabase.from('jornadas')
            .select('id, status, jornada_estagios(id, jornada_passos(id, concluido, concluido_em, obrigatorio))')
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
          jornada = {
            id: (j as any).id,
            totalPassos: total,
            passosConcluidos: concluidos,
            pctConcluido: total > 0 ? Math.round(concluidos / total * 100) : 0,
            lastActivity: lastAct,
          };
        }

        if (materiaisRes.status === 'fulfilled') {
          ferramentasConstruidas = (materiaisRes.value.data || []).length;
        }
        if (aulasRes.status === 'fulfilled') {
          aulasConcluidas = (aulasRes.value.data || []).length;
        }
      }

      return {
        jornada,
        ferramentasConstruidas,
        aulasConcluidas,
        touchpoints: (tpRes.data || []) as ClientDetailData['touchpoints'],
        nps: (npsRes.data || [])[0] ?? null,
        healthScores: (hsRes.data || []) as ClientDetailData['healthScores'],
        marcos: (marcosRes.data || []) as ClientDetailData['marcos'],
        protocols: (protocolsRes.data || []).map(p => ({
          id: p.id,
          tipo: p.tipo,
          passos_concluidos: (p.passos_concluidos as unknown as string[]) ?? [],
          notas: p.notas,
          iniciado_em: p.iniciado_em,
        })) as ClientDetailData['protocols'],
        diasNaPlataforma: tenantRes.data?.created_at
          ? differenceInDays(new Date(), new Date(tenantRes.data.created_at))
          : null,
      };
    },
  });
}

// ── Computation functions ─────────────────────────────────────────────────

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

  const crm = d.healthScores[0]?.dim_crm ?? 50;

  let responsividade = 30;
  if (client.cs_ultimo_touchpoint) {
    const days = differenceInDays(new Date(), new Date(client.cs_ultimo_touchpoint));
    responsividade = days <= 3 ? 100 : days <= 7 ? 80 : days <= 14 ? 50 : days <= 21 ? 20 : 0;
  } else {
    responsividade = 15;
  }
  if (d.touchpoints.slice(0, 3).filter(tp => tp.resultado === 'sem_resposta').length >= 2) {
    responsividade = Math.min(responsividade, 25);
  }

  const total = Math.round(ativacao * 0.20 + jornada * 0.25 + arsenal * 0.20 + crm * 0.25 + responsividade * 0.10);
  return {
    ativacao, jornada, arsenal, crm, responsividade, total,
    status: total >= 70 ? 'verde' : total >= 40 ? 'amarelo' : 'vermelho',
  };
}

function detectRiskSignals(client: CSClient, d: ClientDetailData): RiskSignal[] {
  const out: RiskSignal[] = [];

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
  if (negatives.length >= 2) {
    out.push({ id: 6, descricao: `${negatives.length} interações com resultado negativo`, gravidade: 'medio' });
  }

  return out;
}

function getProximasAcoes(client: CSClient, d: ClientDetailData, signals: RiskSignal[]): ProximaAcao[] {
  const out: ProximaAcao[] = [];

  if (signals.length > 0) {
    out.push({
      prioridade: 'urgente',
      titulo: signals.length === 1 ? '1 sinal de risco ativo' : `${signals.length} sinais de risco ativos`,
      descricao: signals[0].descricao,
    });
  }

  if (client.cs_proximo_touchpoint) {
    const today = new Date().toISOString().slice(0, 10);
    if (client.cs_proximo_touchpoint <= today) {
      out.push({
        prioridade: 'alta',
        titulo: 'Touchpoint em atraso',
        descricao: `Previsto para ${format(parseISO(client.cs_proximo_touchpoint), "d 'de' MMM", { locale: ptBR })}`,
      });
    }
  }

  const fase = client.cs_fase || 'ativacao';
  if (fase === 'ativacao') {
    if (!client.onboarding_complete) {
      out.push({ prioridade: 'normal', titulo: 'Onboarding pendente', descricao: 'Cliente ainda não concluiu o checklist da plataforma' });
    }
    if (d.ferramentasConstruidas < 1) {
      out.push({ prioridade: 'normal', titulo: 'Nenhuma ferramenta do Arsenal construída', descricao: 'Meta D14: primeira ferramenta concluída' });
    } else if (d.ferramentasConstruidas < 3) {
      out.push({ prioridade: 'normal', titulo: `Arsenal: ${d.ferramentasConstruidas}/3 ferramentas`, descricao: 'Meta D30: 3+ ferramentas construídas' });
    }
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
    case 'd3_diagnostico':    return client.onboarding_concluido === true;
    case 'd7_jornada':        return d.jornada !== null;
    case 'd14_ferramenta':    return d.ferramentasConstruidas >= 1;
    case 'd30_3ferramentas':  return d.ferramentasConstruidas >= 3;
    case 'd60_30pct':         return (d.jornada?.pctConcluido ?? 0) >= 30;
    case 'd90_50pct':         return (d.jornada?.pctConcluido ?? 0) >= 50;
    case 'd120_70pct':        return (d.jornada?.pctConcluido ?? 0) >= 70;
    case 'd120_nps':          return !!(d.nps && d.nps.score >= 8);
    case 'd180_concluida':    return (d.jornada?.pctConcluido ?? 0) >= 95;
    default:                  return false;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────

function DimBar({ label, value, weight, color, auto }: {
  label: string; value: number; weight: string; color: string; auto?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
          {auto && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-muted text-muted-foreground/60">Auto</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground/40">{weight}</span>
          <span className="text-xs font-bold tabular-nums w-6 text-right">{value}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

interface Props {
  client: CSClient | null;
  onClose: () => void;
  onNewTouchpoint: (clientId: string) => void;
  onNewHealth: (clientId: string) => void;
  onNewNPS: (clientId: string) => void;
}

export function CSClientDrawer({ client, onClose, onNewTouchpoint, onNewHealth, onNewNPS }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [marcosOpen, setMarcosOpen] = useState<Record<string, boolean>>({ ativacao: true });
  const { data: detail, isLoading } = useClientDetail(client);

  const markMutation = useMutation({
    mutationFn: async ({ clientId, marco }: { clientId: string; marco: string }) => {
      const { error } = await supabase.from('cs_marcos').upsert({
        client_id: clientId, marco, atingido: true, atingido_em: new Date().toISOString(), automatico: false,
      }, { onConflict: 'client_id,marco' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marco marcado como atingido');
      qc.invalidateQueries({ queryKey: ['cs-client-detail', client?.id] });
    },
    onError: () => toast.error('Erro ao marcar marco'),
  });

  if (!client) return null;

  const name = clientName(client);
  const autoScore = detail ? calcAutoScore(client, detail) : null;
  const signals = detail ? detectRiskSignals(client, detail) : [];
  const acoes = detail ? getProximasAcoes(client, detail, signals) : [];
  const hs = effectiveHealth(client);
  const displayScore = autoScore?.total ?? client.latest_health?.score_total ?? null;

  const healthDotClass =
    hs === 'verde' ? 'bg-emerald-500' :
    hs === 'amarelo' ? 'bg-amber-400' :
    hs === 'vermelho' ? 'bg-red-500' : 'bg-muted-foreground/20';

  const scoreBadgeClass =
    (autoScore?.status || hs) === 'verde' ? 'bg-emerald-50 text-emerald-700' :
    (autoScore?.status || hs) === 'amarelo' ? 'bg-amber-50 text-amber-700' :
    (autoScore?.status || hs) === 'vermelho' ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[500px] z-50 flex flex-col bg-background border-l border-border/60 shadow-2xl">

        {/* Header sticky */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', healthDotClass)} />
                <h2 className="text-base font-bold text-foreground truncate font-display">{name}</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap ml-4.5">
                {client.product_name && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {client.product_name.split('—')[0].trim()}
                  </span>
                )}
                {client.cs_fase && (
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', FASE_COLORS[client.cs_fase])}>
                    {FASE_LABELS[client.cs_fase]}
                  </span>
                )}
                {detail?.diasNaPlataforma != null && (
                  <span className="text-[10px] text-muted-foreground/50">
                    Dia {detail.diasNaPlataforma} na plataforma
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {displayScore != null && (
                <div className={cn('px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums', scoreBadgeClass)}>
                  {displayScore}
                </div>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Activity className="h-5 w-5 animate-pulse text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border/40">

              {/* Sinais de risco */}
              {signals.length > 0 && (
                <div className="px-5 py-4 bg-red-50/60 dark:bg-red-950/20">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-700 mb-1.5">
                        {signals.length === 1 ? '1 sinal de risco detectado' : `${signals.length} sinais de risco detectados`}
                      </p>
                      <div className="space-y-1">
                        {signals.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                              s.gravidade === 'critico' ? 'bg-red-500' :
                              s.gravidade === 'alto' ? 'bg-orange-400' : 'bg-amber-400'
                            )} />
                            <p className="text-[11px] text-red-700/80">{s.descricao}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Próximas ações */}
              {acoes.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Próximas Ações</p>
                  <div className="space-y-2">
                    {acoes.map((a, i) => (
                      <div key={i} className={cn(
                        'rounded-xl border px-3.5 py-2.5',
                        a.prioridade === 'urgente' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' :
                        a.prioridade === 'alta' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900' :
                        'border-border/60 bg-muted/20'
                      )}>
                        <div className="flex items-start gap-2">
                          <span className={cn('mt-0.5 flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                            a.prioridade === 'urgente' ? 'bg-red-100 text-red-700' :
                            a.prioridade === 'alta' ? 'bg-amber-100 text-amber-700' :
                            'bg-muted text-muted-foreground/60'
                          )}>
                            {a.prioridade === 'urgente' ? 'Urgente' : a.prioridade === 'alta' ? 'Alta' : 'Normal'}
                          </span>
                          <div>
                            <p className="text-xs font-semibold">{a.titulo}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{a.descricao}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Protocolo Ativo */}
              {detail?.protocols && detail.protocols.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Protocolo Ativo</p>
                  <div className="space-y-2">
                    {detail.protocols.map(p => {
                      const cfg = PROTOCOL_CONFIGS[p.tipo];
                      const daysActive = differenceInDays(new Date(), parseISO(p.iniciado_em));
                      const totalSteps = PROTOCOL_STEP_COUNT[p.tipo] ?? 0;
                      const doneSoFar = p.passos_concluidos.length;
                      const pct = totalSteps > 0 ? Math.round(doneSoFar / totalSteps * 100) : 0;
                      return (
                        <div key={p.id} className={cn('rounded-xl border px-4 py-3', cfg?.color ?? 'border-border/60 bg-muted/20')}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Zap className="h-3 w-3 flex-shrink-0" />
                              <p className="text-xs font-bold">{cfg?.label ?? p.tipo}</p>
                            </div>
                            <span className="text-[10px] tabular-nums opacity-60">Dia {daysActive}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                              <div className="h-full bg-current opacity-50 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] tabular-nums opacity-70 flex-shrink-0">{doneSoFar}/{totalSteps}</span>
                          </div>
                          {p.tipo === 'escalada' && p.notas && (
                            <p className="text-[10px] mt-1.5 opacity-60 truncate">{p.notas.split('\n')[0]}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Health Score */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Health Score</p>
                  {detail?.healthScores[0] && (
                    <span className="text-[10px] text-muted-foreground/40">
                      Última avaliação: {format(parseISO(detail.healthScores[0].avaliado_em), "d MMM", { locale: ptBR })}
                    </span>
                  )}
                </div>

                {autoScore && detail ? (
                  <div className="space-y-3">
                    <DimBar label="Ativação"      value={autoScore.ativacao}      weight="20%" color="bg-blue-400"    auto />
                    <DimBar label="Jornada"        value={autoScore.jornada}        weight="25%" color="bg-violet-400"  auto />
                    <DimBar label="Arsenal"        value={autoScore.arsenal}        weight="20%" color="bg-amber-400"   auto />
                    <DimBar label="CRM"            value={autoScore.crm}            weight="25%" color="bg-emerald-400"      />
                    <DimBar label="Responsividade" value={autoScore.responsividade} weight="10%" color="bg-sky-400"     auto />

                    <div className={cn('mt-1 rounded-xl border px-4 py-3 flex items-center justify-between', HEALTH_BG[autoScore.status])}>
                      <span className="text-sm font-semibold">Score calculado</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold tabular-nums font-display">{autoScore.total}</span>
                        <span className="text-xs font-medium capitalize">{autoScore.status}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground/40 text-center leading-relaxed">
                      Dimensões "Auto" calculadas com dados reais da plataforma.<br />
                      CRM usa o último valor salvo manualmente.
                    </p>
                    <button
                      onClick={() => onNewHealth(client.id)}
                      className="w-full h-8 rounded-lg text-[11px] font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >
                      Atualizar avaliação completa
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-5 text-center">
                    <div className="p-2.5 rounded-xl bg-muted/40 mb-2">
                      <Activity className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Sem avaliação registrada</p>
                    <button
                      onClick={() => onNewHealth(client.id)}
                      className="h-8 px-4 rounded-lg text-[11px] font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Fazer primeira avaliação
                    </button>
                  </div>
                )}
              </div>

              {/* Marcos por fase */}
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Marcos da Jornada</p>
                {detail ? (
                  <div className="space-y-1.5">
                    {FASES_ORDER.map(fase => {
                      const marcosDoFase = MARCOS_POR_FASE.filter(m => m.fase === fase);
                      const atingidos = marcosDoFase.filter(m => getMarcoAtingido(m.id, client, detail)).length;
                      const total = marcosDoFase.length;
                      const isCurrent = client.cs_fase === fase;
                      const expanded = marcosOpen[fase] ?? isCurrent;
                      const allDone = atingidos === total;

                      return (
                        <div key={fase} className={cn(
                          'rounded-xl border overflow-hidden transition-colors',
                          isCurrent ? 'border-foreground/20' : 'border-border/40'
                        )}>
                          <button
                            onClick={() => setMarcosOpen(e => ({ ...e, [fase]: !expanded }))}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
                          >
                            {allDone
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                              : <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                            }
                            <span className={cn('flex-1 text-xs font-semibold', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                              {FASE_LABELS[fase]}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50 mr-1">{atingidos}/{total}</span>
                            {expanded
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            }
                          </button>
                          {expanded && (
                            <div className="px-4 pb-3 pt-1 border-t border-border/40">
                              {marcosDoFase.map(marco => {
                                const atingido = getMarcoAtingido(marco.id, client, detail);
                                return (
                                  <div key={marco.id} className="flex items-center gap-2.5 py-1.5">
                                    {atingido
                                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                      : <Circle className="h-3.5 w-3.5 text-muted-foreground/25 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">{marco.dia}</span>
                                        <span className={cn('text-xs', atingido ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                          {marco.label}
                                        </span>
                                      </div>
                                      {!atingido && (
                                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{marco.descricao}</p>
                                      )}
                                    </div>
                                    {!marco.auto && !atingido && (
                                      <button
                                        onClick={() => markMutation.mutate({ clientId: client.id, marco: marco.id })}
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

              {/* Touchpoints recentes */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Histórico de Contatos</p>
                  <button
                    onClick={() => onNewTouchpoint(client.id)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border/60 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Novo
                  </button>
                </div>
                {detail && detail.touchpoints.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-5 text-center">
                    <MessageCircle className="h-5 w-5 text-muted-foreground/25 mb-1.5" />
                    <p className="text-xs text-muted-foreground">Nenhum touchpoint registrado</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {(detail?.touchpoints || []).slice(0, 6).map(tp => {
                      const Icon = TIPO_ICONS[tp.tipo] || Activity;
                      return (
                        <div key={tp.id} className="flex items-start gap-3 py-2.5">
                          <div className="p-1.5 rounded-lg bg-muted flex-shrink-0 mt-0.5">
                            <Icon className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{TIPO_LABELS[tp.tipo]}</span>
                              <span className={cn('text-[10px] font-medium', RESULTADO_COLORS[tp.resultado])}>
                                {RESULTADO_LABELS[tp.resultado]}
                              </span>
                            </div>
                            {tp.notas && (
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{tp.notas}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                              {formatDistanceToNow(parseISO(tp.data_contato), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* NPS */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">NPS</p>
                  <button
                    onClick={() => onNewNPS(client.id)}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Coletar NPS
                  </button>
                </div>
                {detail?.nps ? (
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'text-3xl font-bold tabular-nums font-display w-12 text-center',
                      detail.nps.score >= 9 ? 'text-emerald-600' :
                      detail.nps.score >= 7 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {detail.nps.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold',
                        detail.nps.score >= 9 ? 'text-emerald-700' :
                        detail.nps.score >= 7 ? 'text-amber-700' : 'text-red-700'
                      )}>
                        {detail.nps.score >= 9 ? 'Promotor' : detail.nps.score >= 7 ? 'Neutro' : 'Detrator'}
                      </p>
                      {detail.nps.comentario && (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{detail.nps.comentario}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/40 mt-1">
                        {format(parseISO(detail.nps.respondido_em), "d 'de' MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Star className="h-5 w-5 text-muted-foreground/25 mb-1.5" />
                    <p className="text-xs text-muted-foreground">NPS não coletado</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer sticky */}
        <div className="flex-shrink-0 px-5 py-3.5 border-t border-border/40 bg-muted/20 flex items-center gap-2">
          <Button
            onClick={() => onNewTouchpoint(client.id)}
            className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Novo touchpoint
          </Button>
          <Button
            onClick={() => onNewHealth(client.id)}
            variant="outline"
            className="h-9 rounded-lg text-xs font-medium border-border/60 gap-1.5 px-4"
          >
            <Activity className="h-3.5 w-3.5" />
            Avaliar health
          </Button>
        </div>
      </div>
    </>
  );
}
