// Tipos compartilhados do módulo CS
import { differenceInDays, parseISO } from 'date-fns';

export interface CSClient {
  id: string;
  crm_user_id: string | null;
  organization_id: string;
  clinic_name: string | null;
  nome_completo: string | null;
  product_name: string | null;
  cs_fase: string | null;
  cs_fase_desde: string | null;
  cs_health_status: string | null;
  cs_ultimo_touchpoint: string | null;
  cs_proximo_touchpoint: string | null;
  onboarding_concluido: boolean | null;
  onboarding_complete: boolean | null;
  joined_at: string | null;
  latest_health: {
    score_total: number;
    status_calculado: string;
    avaliado_em: string;
    dim_ativacao: number;
    dim_jornada: number;
    dim_arsenal: number;
    dim_crm: number;
    dim_responsividade: number;
  } | null;
  crm?: CSCrmMetrics | null;
}

export interface CSTouchpoint {
  id: string;
  client_id: string;
  tipo: string;
  data_contato: string;
  resultado: string;
  notas: string | null;
  proximo_contato: string | null;
  duracao_minutos: number | null;
  cliente_faltou?: boolean | null;
  platform_users?: { clinic_name: string | null; nome_completo: string | null } | null;
}

export interface CSNPSResponse {
  id: string;
  client_id: string;
  score: number;
  comentario: string | null;
  respondido_em: string;
  campanha_id: string | null;
  platform_users?: { clinic_name: string | null; nome_completo: string | null } | null;
  cs_nps_campanhas?: { id: string; cs_nps_templates: { nome: string } | null } | null;
}

export type NPSDimensao = 'recomendacao' | 'resultado' | 'experiencia' | 'atendimento' | 'outro';
export type NPSPerguntaTipo = 'escala' | 'texto';

export interface CSNPSPergunta {
  id: string;
  template_id: string;
  ordem: number;
  dimensao: NPSDimensao;
  tipo: NPSPerguntaTipo;
  texto: string;
  variaveis: string[];
  obrigatoria: boolean;
}

export interface CSNPSTemplate {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  cs_nps_perguntas?: CSNPSPergunta[];
}

export interface CSNPSRespostaDetalhe {
  id: string;
  campanha_id: string;
  pergunta_id: string | null;
  dimensao: NPSDimensao;
  texto_pergunta: string;
  valor_numero: number | null;
  valor_texto: string | null;
}

export const NPS_DIMENSAO_LABELS: Record<NPSDimensao, string> = {
  recomendacao: 'Recomendação',
  resultado: 'Resultado',
  experiencia: 'Experiência',
  atendimento: 'Atendimento',
  outro: 'Outro',
};

export const NPS_DIMENSAO_COLORS: Record<NPSDimensao, string> = {
  recomendacao: 'text-blue-700 bg-blue-50 border-blue-200',
  resultado: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  experiencia: 'text-violet-700 bg-violet-50 border-violet-200',
  atendimento: 'text-amber-700 bg-amber-50 border-amber-200',
  outro: 'text-muted-foreground bg-muted border-border/60',
};

export interface CSNPSCampanha {
  id: string;
  client_id: string;
  template_id: string;
  status: 'pendente' | 'respondida' | 'cancelada';
  disparado_por: string | null;
  disparado_em: string;
  respondido_em: string | null;
  snoozed_until: string | null;
  snooze_count: number;
  cancelado_por: string | null;
  cancelado_em: string | null;
  platform_users?: { clinic_name: string | null; nome_completo: string | null } | null;
  cs_nps_templates?: { nome: string; cs_nps_perguntas?: CSNPSPergunta[] } | null;
}

// ── Labels e cores ─────────────────────────────────────────────────────────────

export const FASE_LABELS: Record<string, string> = {
  ativacao: 'Ativação', execucao: 'Execução', tracao: 'Tração', maturidade: 'Maturidade',
};

export const FASE_COLORS: Record<string, string> = {
  ativacao: 'bg-blue-100 text-blue-700',
  execucao: 'bg-amber-100 text-amber-700',
  tracao: 'bg-violet-100 text-violet-700',
  maturidade: 'bg-emerald-100 text-emerald-700',
};

export function npsCategory(score: number): { label: string; color: string } {
  if (score >= 9) return { label: 'Promotor', color: 'text-emerald-600 bg-emerald-50' };
  if (score >= 7) return { label: 'Neutro', color: 'text-amber-600 bg-amber-50' };
  return { label: 'Detrator', color: 'text-red-600 bg-red-50' };
}

export const HEALTH_DOT: Record<string, string> = {
  verde: 'bg-emerald-500', amarelo: 'bg-amber-400', vermelho: 'bg-red-500',
};

export const HEALTH_BG: Record<string, string> = {
  verde: 'bg-card text-emerald-700 border-border/60 border-l-[3px] border-l-emerald-400',
  amarelo: 'bg-card text-amber-700 border-border/60 border-l-[3px] border-l-amber-400',
  vermelho: 'bg-card text-rose-600 border-border/60 border-l-[3px] border-l-rose-500',
};

export const TIPO_ICONS_NAMES: Record<string, string> = {
  whatsapp: 'MessageCircle', reuniao: 'Video', email: 'Mail', ligacao: 'Phone', outro: 'Activity',
};

export const TIPO_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', reuniao: 'Reunião', email: 'E-mail', ligacao: 'Ligação', outro: 'Outro',
};

export const RESULTADO_COLORS: Record<string, string> = {
  positivo: 'text-emerald-600', neutro: 'text-muted-foreground',
  negativo: 'text-red-600', sem_resposta: 'text-amber-600',
};

export const RESULTADO_LABELS: Record<string, string> = {
  positivo: 'Positivo', neutro: 'Neutro', negativo: 'Negativo', sem_resposta: 'Sem resposta',
};

// ── Utilitários de nome ────────────────────────────────────────────────────────

export function clientName(c: { clinic_name?: string | null; nome_completo?: string | null }) {
  return c.clinic_name || c.nome_completo || 'Cliente';
}

export function effectiveHealth(c: Pick<CSClient, 'cs_health_status' | 'latest_health'>) {
  return c.cs_health_status || c.latest_health?.status_calculado || null;
}

// ── Helpers de tempo na plataforma ────────────────────────────────────────────

// Limites de dias de cada fase
export const FASE_LIMITES: Record<string, { de: number; ate: number | null }> = {
  ativacao:   { de: 0,   ate: 30  },
  execucao:   { de: 31,  ate: 90  },
  tracao:     { de: 91,  ate: 180 },
  maturidade: { de: 181, ate: null },
};

export function getDiasNaPlataforma(joinedAt: string | null): number {
  if (!joinedAt) return 0;
  return Math.max(0, differenceInDays(new Date(), parseISO(joinedAt)));
}

export function getFaseEsperada(dias: number): string {
  if (dias <= 30)  return 'ativacao';
  if (dias <= 90)  return 'execucao';
  if (dias <= 180) return 'tracao';
  return 'maturidade';
}

export function getSemana(dias: number): number {
  return Math.max(1, Math.ceil((dias + 1) / 7));
}

export function getMes(dias: number): number {
  return Math.max(1, Math.ceil((dias + 1) / 30));
}

export function getDiasRestantesNaFase(fase: string, dias: number): number | null {
  const limite = FASE_LIMITES[fase as keyof typeof FASE_LIMITES];
  if (!limite || limite.ate === null) return null;
  return Math.max(0, limite.ate - dias);
}

export function getDiasSemContato(ultimoContato: string | null): number | null {
  if (!ultimoContato) return null;
  return Math.max(0, differenceInDays(new Date(), parseISO(ultimoContato)));
}

// ── Prescrição de ação ────────────────────────────────────────────────────────

export interface AcaoPrescrita {
  tipo: 'pulso' | 'reuniao' | 'urgente';
  titulo: string;
  descricao: string;
  urgencia: 'verde' | 'amarelo' | 'vermelho';
}

export function getAcaoPrescrita(
  fase: string,
  diasNaPlataforma: number,
  diasSemContato: number | null,
): AcaoPrescrita {
  const semana = getSemana(diasNaPlataforma);
  const mes = getMes(diasNaPlataforma);

  // Nunca houve touchpoint E já tem mais de 14 dias na plataforma → urgente
  if (diasSemContato === null && diasNaPlataforma > 14) {
    return {
      tipo: 'urgente',
      titulo: 'Nenhum contato registrado',
      descricao: `${diasNaPlataforma} dias na plataforma sem nenhum touchpoint registrado. Inicie o contato agora e registre aqui.`,
      urgencia: 'vermelho',
    };
  }

  // Nunca houve touchpoint mas cliente é recente (≤14 dias) — fase prescreve a ação
  const dsc = diasSemContato ?? 0;

  // Regra de ouro: 14+ dias sem contato ativo
  if (dsc > 14) {
    return {
      tipo: 'urgente',
      titulo: 'Contato imediato',
      descricao: `${dsc} dias sem contato ativo. Regra de ouro: nenhum cliente fica 14+ dias sem ação do CSM.`,
      urgencia: 'vermelho',
    };
  }

  if (fase === 'ativacao') {
    if (diasNaPlataforma <= 2)
      return { tipo: 'reuniao', titulo: 'Kickoff (D0–D1)', descricao: 'Realizar kickoff (30 min): apresentar a plataforma, definir expectativas, garantir primeiro acesso ao Athos.', urgencia: dsc > 1 ? 'vermelho' : 'amarelo' };
    if (diasNaPlataforma <= 6)
      return { tipo: 'pulso', titulo: 'Pulso D3 — Diagnóstico', descricao: 'WhatsApp individual: "Jornada ativa? Conseguiu acessar o diagnóstico e começar a conversa com o Athos?"', urgencia: dsc >= 2 ? 'amarelo' : 'verde' };
    if (diasNaPlataforma <= 11)
      return { tipo: 'pulso', titulo: 'Pulso D7 — Primeiro passo', descricao: 'WhatsApp individual: "Primeiro passo da jornada — já deu uma olhada? O Athos gerou sua jornada personalizada?"', urgencia: dsc >= 3 ? 'amarelo' : 'verde' };
    if (diasNaPlataforma <= 18)
      return { tipo: 'reuniao', titulo: 'Alinhamento D14', descricao: `Reunião de alinhamento (30 min): revisar progresso, resolver travamentos, definir próximos passos. Semana ${semana}.`, urgencia: dsc >= 10 ? 'vermelho' : dsc >= 6 ? 'amarelo' : 'verde' };
    if (diasNaPlataforma <= 25)
      return { tipo: 'pulso', titulo: 'Pulso D21 — Arsenal', descricao: 'WhatsApp individual: "Como estão as ferramentas do Arsenal? Conseguiu construir a primeira?"', urgencia: dsc >= 4 ? 'amarelo' : 'verde' };
    return { tipo: 'reuniao', titulo: 'Balanço do Mês 1 (D30)', descricao: `Reunião de balanço (45 min): avaliar marcos, resultados iniciais no CRM, ajustar foco para o mês 2. Semana ${semana}.`, urgencia: dsc >= 10 ? 'vermelho' : dsc >= 6 ? 'amarelo' : 'verde' };
  }

  if (fase === 'execucao') {
    if (dsc >= 15)
      return { tipo: 'reuniao', titulo: 'Acompanhamento quinzenal', descricao: `Reunião (30 min): review CRM + progresso na jornada + próximos 15 dias. Semana ${semana} na plataforma.`, urgencia: dsc >= 18 ? 'vermelho' : 'amarelo' };
    if (dsc >= 6)
      return { tipo: 'pulso', titulo: 'Pulso semanal', descricao: `WhatsApp individual de check-in: andamento da jornada e travamentos. Semana ${semana} na plataforma.`, urgencia: dsc >= 9 ? 'amarelo' : 'verde' };
    return { tipo: 'pulso', titulo: 'Em dia', descricao: `Cadência de Execução no ritmo. Próximo pulso em ${Math.max(1, 7 - dsc)} dia(s).`, urgencia: 'verde' };
  }

  if (fase === 'tracao') {
    if (dsc >= 28)
      return { tipo: 'reuniao', titulo: 'Review de resultado', descricao: `Reunião mensal (45 min): resultados do mês, ajuste de foco, próximos 30 dias. Mês ${mes} na plataforma.`, urgencia: dsc >= 32 ? 'vermelho' : 'amarelo' };
    if (dsc >= 13)
      return { tipo: 'pulso', titulo: 'Pulso quinzenal', descricao: `WhatsApp individual de resultado: "Algum número do CRM para compartilhar?" Mês ${mes} na plataforma.`, urgencia: 'amarelo' };
    return { tipo: 'pulso', titulo: 'Em dia', descricao: `Cadência de Tração no ritmo. Próximo pulso em ${Math.max(1, 15 - dsc)} dia(s).`, urgencia: 'verde' };
  }

  // Maturidade
  if (dsc >= 85)
    return { tipo: 'reuniao', titulo: 'QBR Trimestral', descricao: `Reunião (60 min): retrospectiva de resultados, renovação, expansão, indicações. Mês ${mes} na plataforma.`, urgencia: dsc >= 95 ? 'vermelho' : 'amarelo' };
  if (dsc >= 28)
    return { tipo: 'pulso', titulo: 'Pulso mensal', descricao: `WhatsApp individual: manter presença estratégica e identificar oportunidades de expansão. Mês ${mes} na plataforma.`, urgencia: dsc >= 35 ? 'amarelo' : 'verde' };
  return { tipo: 'pulso', titulo: 'Em dia', descricao: `Cadência de Maturidade no ritmo. Próximo pulso em ${Math.max(1, 30 - dsc)} dia(s).`, urgencia: 'verde' };
}

// ── Resultado no CRM (métricas de performance real do cliente) ──────────────────
// Alimentadas pelas RPCs get_cs_crm_metrics() (resumo por org) e
// get_cs_client_crm_detail(org) (deep dive da ficha).

// Resumo por org — uma linha por cliente do CS.
export interface CSCrmMetrics {
  organization_id: string;
  fat_30d: number;               // faturamento janela móvel 30d
  fat_30d_prev: number;          // faturamento 30d anteriores (base do MoM)
  fat_growth_pct: number | null; // crescimento MoM (null = sem base anterior → "novo")
  fechamentos_30d: number;
  ticket_medio_30d: number | null;
  fat_total_lifetime: number;
  leads_30d: number;
  mql_30d: number;
  agend_30d: number;
  fech_30d: number;
  tx_mql: number | null;
  tx_agend: number | null;
  tx_fech: number | null;
  msgs_30d: number;
  ultima_atividade: string | null;
  tempo_1o_contato_med_min: number | null;
  meta_receita_ativa: number | null;
  meta_realizado: number | null;
  meta_pct: number | null;       // % da meta batida (null = sem meta configurada)
  usa_ia: boolean;
  usa_followup: boolean;
  usa_agenda: boolean;
  tem_meta: boolean;
  registra_vendas: boolean;
}

// Deep dive da ficha do cliente.
export interface CSCrmDetail {
  monthly: Array<{ mes: string; faturamento: number; fechamentos: number }>;
  funil: { leads: number; mql: number; agendamentos: number; fechamentos: number };
  adocao: {
    leads_com_ia: number; leads_followup: number;
    agendamentos: number; vendas: number; metas: number; leads_com_tag: number;
    leads_total: number;
  };
  tempo: { tempo_1o_contato_min: number | null; tempo_resposta_med_min: number | null } | null;
}

// Métricas do CRM para um intervalo de datas arbitrário (filtro Dia/Semana/Mês da ficha).
export interface CSCrmPeriod {
  faturamento: number;
  fechamentos: number;
  faturamento_prev: number;
  msgs: number;
  funil: { leads: number; mql: number; agendamentos: number; fechamentos: number };
  tempo: { tempo_1o_contato_min: number | null; tempo_resposta_med_min: number | null } | null;
}

export interface Health2Axis {
  adocao: number;
  resultado: number;
  total: number;
  status: 'verde' | 'amarelo' | 'vermelho';
}

// ── Scoring: eixo RESULTADO (0–100) ─────────────────────────────────────────────
// Sinal-mestre = crescimento de faturamento. Rubrica tunável.
export interface ResultadoBreakdown {
  growth: number;
  receita: number;
  conversao: number;
  tempo: number;
  meta: number | null; // null = sem meta configurada (peso redistribuído)
  total: number;
}

export function computeResultadoBreakdown(m: CSCrmMetrics): ResultadoBreakdown {
  // Crescimento de faturamento (MoM). Sem base anterior → proxy pela presença de receita.
  const growth = (() => {
    if (m.fat_growth_pct == null) return m.fat_30d > 0 ? 60 : 30;
    const g = m.fat_growth_pct;
    if (g >= 50) return 100;
    if (g >= 20) return 88;
    if (g >= 5) return 72;
    if (g >= -5) return 55;
    if (g >= -20) return 35;
    return 15;
  })();
  // Volume de receita gerada (o CRM está fechando negócio?).
  const receita = (() => {
    const f = m.fechamentos_30d;
    if (f >= 20) return 100;
    if (f >= 10) return 82;
    if (f >= 5) return 62;
    if (f >= 1) return 42;
    return 8;
  })();
  // Saúde do funil (taxa de fechamento).
  const conversao = (() => {
    const t = m.tx_fech ?? 0;
    if (t >= 15) return 100;
    if (t >= 8) return 82;
    if (t >= 4) return 62;
    if (t >= 1) return 38;
    return 10;
  })();
  // Tempo de atendimento (1º contato médio).
  const tempo = (() => {
    const t = m.tempo_1o_contato_med_min;
    if (t == null) return 50;
    if (t <= 5) return 100;
    if (t <= 15) return 85;
    if (t <= 60) return 65;
    if (t <= 240) return 42;
    return 18;
  })();
  // Meta (apenas quando configurada — senão o peso é redistribuído).
  const meta = (() => {
    if (!m.tem_meta || m.meta_pct == null) return null;
    const p = m.meta_pct;
    if (p >= 100) return 100;
    if (p >= 70) return 80;
    if (p >= 40) return 55;
    return 30;
  })();

  const parts: Array<[number, number]> = [
    [growth, 0.32], [receita, 0.26], [conversao, 0.20], [tempo, 0.14],
  ];
  if (meta != null) parts.push([meta, 0.08]);
  const wsum = parts.reduce((s, [, w]) => s + w, 0);
  const total = Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / wsum);

  return { growth, receita, conversao, tempo, meta, total };
}

export function computeResultadoScore(m: CSCrmMetrics): number {
  return computeResultadoBreakdown(m).total;
}

// ── Scoring: eixo ADOÇÃO — versão leve (lista/base) ─────────────────────────────
// Usa apenas onboarding + atividade/adoção do CRM (sem jornada/arsenal, que exigem
// o detalhe por cliente). A ficha usa a versão completa (computeAdocaoFull).
export function computeAdocaoLight(
  c: { onboarding_complete?: boolean | null; onboarding_concluido?: boolean | null },
  m: CSCrmMetrics | null,
): number {
  const ativacao = c.onboarding_complete ? 100 : c.onboarding_concluido ? 65 : 25;
  let vivo = 10;
  if (m) {
    if (m.msgs_30d >= 500) vivo = 100;
    else if (m.msgs_30d >= 100) vivo = 80;
    else if (m.msgs_30d >= 20) vivo = 55;
    else if (m.msgs_30d >= 1) vivo = 30;
    else vivo = 10;
  }
  let feats = 0, tot = 0;
  if (m) [m.usa_ia, m.usa_followup, m.usa_agenda, m.registra_vendas, m.tem_meta].forEach(f => { tot++; if (f) feats++; });
  const featScore = tot > 0 ? Math.round(feats / tot * 100) : 50;
  return Math.round(ativacao * 0.35 + vivo * 0.40 + featScore * 0.25);
}

// ── Scoring: eixo ADOÇÃO — versão completa (ficha) ──────────────────────────────
// Condensa os sinais de plataforma que a ficha já calcula (ativação, jornada,
// arsenal, rotina no CRM, responsividade) num único score de Adoção.
export function computeAdocaoFull(parts: {
  ativacao: number; jornada: number; arsenal: number; rotinaCrm: number; responsividade: number;
}): number {
  return Math.round(
    parts.ativacao * 0.25 + parts.jornada * 0.25 + parts.arsenal * 0.15 +
    parts.rotinaCrm * 0.20 + parts.responsividade * 0.15
  );
}

// Health total = 40% Adoção + 60% Resultado (Resultado pesa mais — o que o cliente percebe).
export function computeHealth2Axis(adocao: number, resultado: number): Health2Axis {
  const total = Math.round(adocao * 0.40 + resultado * 0.60);
  const status: Health2Axis['status'] = total >= 70 ? 'verde' : total >= 45 ? 'amarelo' : 'vermelho';
  return { adocao, resultado, total, status };
}

// Health 2-eixos de um cliente da lista (Adoção leve + Resultado). null se sem métricas CRM.
export function clientHealth2Axis(c: CSClient): Health2Axis | null {
  if (!c.crm) return null;
  const resultado = computeResultadoScore(c.crm);
  const adocao = computeAdocaoLight(c, c.crm);
  return computeHealth2Axis(adocao, resultado);
}

// Status de saúde priorizando o modelo 2-eixos (Resultado no CRM); cai no health
// manual/legado apenas quando não há métricas de CRM para o cliente.
export function effectiveHealthV2(c: CSClient): 'verde' | 'amarelo' | 'vermelho' | null {
  return clientHealth2Axis(c)?.status ?? effectiveHealth(c);
}

// ── Formatação ──────────────────────────────────────────────────────────────────
export function formatBRLCompact(n: number | null | undefined): string {
  const v = n ?? 0;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

export function formatBRL(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Minutos → "9 min" / "3h 20min" / "1d 4h"
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) { const r = m % 60; return r > 0 ? `${h}h ${r}min` : `${h}h`; }
  const d = Math.floor(h / 24); const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

// Badge de crescimento MoM (null = cliente novo, sem base de comparação).
// Crescimentos acima de +300% quase sempre são artefato de base quase-zero (o
// período anterior mal teve faturamento) — capamos o rótulo para não exibir
// números absurdos tipo "+4761%".
export function growthBadge(pct: number | null): { label: string; dir: 'up' | 'down' | 'flat' | 'new' } {
  if (pct == null) return { label: 'novo', dir: 'new' };
  if (pct >= 300) return { label: '+300%+', dir: 'up' };
  const s = pct > 0 ? '+' : '';
  if (pct >= 3) return { label: `${s}${pct}%`, dir: 'up' };
  if (pct <= -3) return { label: `${pct}%`, dir: 'down' };
  return { label: `${s}${pct}%`, dir: 'flat' };
}

// Tendência do Resultado (snapshots diários) — série de get_cs_client_crm_trend.
export interface CSCrmTrendPoint {
  snapshot_date: string;
  resultado_score: number | null;
  fat_30d: number;
  fat_growth_pct: number | null;
}
