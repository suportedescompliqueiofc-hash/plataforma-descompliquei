import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const openrouter = new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" });

const DEFAULT_MODEL = "openai/gpt-5.4-nano";
const MAX_TOOL_ITERATIONS = 25;

// ── ADMIN OS ────────────────────────────────────────────────────────────────
// Org master da plataforma. Apenas superadmins desta org podem usar o Athos admin.
const MASTER_ORG_ID = "aa787cc8-787a-4774-bd80-ffbf78c0cf5f";

// Tools de LEITURA herdadas do Athos do cliente — único conjunto exposto ao admin.
// Todas as tools de escrita ficam de fora (o Athos admin é read-only / insights).
// Operam sobre a org "em foco" (effectiveOrgId): o cliente travado no seletor
// ou o cliente focado via focar_cliente durante a conversa.
const ADMIN_READ_TOOLS = new Set<string>([
  "buscar_leads", "obter_lead_completo", "obter_metricas_funil",
  "obter_agendamentos", "obter_vendas_recentes", "obter_metas", "obter_procedimentos",
  "obter_tags", "obter_notificacoes", "analisar_leads_parados", "analisar_ranking_procedimentos",
  "obter_resumo_geral", "obter_metricas_receita", "obter_blacklist", "analisar_atendimento_ia",
  "buscar_conversas_lead", "analisar_nao_leads", "listar_cadencias", "obter_cadencia_detalhes",
  "listar_materiais_complementares", "ler_material_complementar", "listar_arsenal",
  "obter_arsenal_ferramenta", "obter_config_ia",
]);

// Tools cross-org exclusivas do admin (não precisam de uma org em foco)
const ADMIN_GLOBAL_TOOLS = new Set<string>([
  "listar_clientes", "ranking_clientes", "comparar_clientes",
  "obter_visao_geral_plataforma", "focar_cliente", "obter_evolucao_cliente",
]);

// ── Resolve e VALIDA o chamador como superadmin da org master ─────────────────
// Retorna o orgId master se válido; null caso contrário (bloqueia não-admins).
async function resolveAdminCaller(userId: string): Promise<{ masterOrgId: string } | null> {
  // platform_users.id === auth.uid(); crm_user_id também === auth.uid()
  const { data: pu } = await supabase
    .from("platform_users").select("crm_user_id").eq("id", userId).maybeSingle();
  const crmUserId = pu?.crm_user_id ?? userId;

  const { data: perfil } = await supabase
    .from("perfis").select("organization_id").eq("id", crmUserId).maybeSingle();
  if (perfil?.organization_id !== MASTER_ORG_ID) return null;

  // Confirma papel superadmin
  const { data: papel } = await supabase
    .from("usuarios_papeis").select("papel").eq("usuario_id", crmUserId).eq("papel", "superadmin").maybeSingle();
  if (!papel) return null;

  return { masterOrgId: MASTER_ORG_ID };
}

// ── Resolve um cliente (org) por nome/identificador para o modo foco ─────────
// Busca em organizations.name, platform_users.clinic_name e perfis.nome_completo.
async function resolveClienteOrg(termo: string): Promise<{ orgId: string; nome: string } | null> {
  const t = (termo ?? "").trim().toLowerCase();
  if (!t) return null;
  const clientes = await listarClientesBase();
  const exato = clientes.find(c => c.nome.toLowerCase() === t || (c.email ?? "").toLowerCase() === t);
  if (exato) return { orgId: exato.organization_id, nome: exato.nome };
  const parcial = clientes.find(c =>
    c.nome.toLowerCase().includes(t) || (c.email ?? "").toLowerCase().includes(t) || (c.clinica ?? "").toLowerCase().includes(t));
  return parcial ? { orgId: parcial.organization_id, nome: parcial.nome } : null;
}

const ALLOWED_MODELS = new Set([
  // OpenAI 2026
  "openai/gpt-5.4-nano",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4",
  "openai/gpt-5.5",
  // Anthropic 2026
  "anthropic/claude-fable-5",
  "anthropic/claude-opus-4.8",
  "anthropic/claude-opus-4.8-fast",
  // Google 2026
  "google/gemini-3.5-flash",
  // xAI 2026
  "x-ai/grok-4.3",
  "x-ai/grok-4.20",
  // DeepSeek 2026
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4-pro",
  // Qwen 2026
  "qwen/qwen3.7-max",
  // Mistral 2026
  "mistralai/mistral-medium-3-5",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Remetentes considerados humanos — espelha exatamente o useDashboard.ts
const isHumanRemetente = (r: string) =>
  r === "agente" || r === "humano" || r === "atendente";

// ── Resolve a org DO TENANT correto ─────────────────────────────────────────
// Cadeia: platform_users.crm_user_id → perfis.organization_id
// Validação: a org TEM que existir em platform_tenants
// Se não for um tenant válido (ex: admin na master org), retorna null
async function resolveOrgId(userId: string): Promise<{ orgId: string; platformUserId: string } | null> {
  const { data: pu } = await supabase
    .from("platform_users").select("id, crm_user_id").eq("id", userId).maybeSingle();

  const crmUserId = pu?.crm_user_id ?? userId;

  const { data: perfil } = await supabase
    .from("perfis").select("organization_id").eq("id", crmUserId).maybeSingle();
  const orgId = perfil?.organization_id ?? null;
  if (!orgId) return null;

  // VALIDAÇÃO OBRIGATÓRIA: a org deve ser um tenant válido da plataforma
  const { data: tenant } = await supabase
    .from("platform_tenants").select("organization_id")
    .eq("organization_id", orgId).maybeSingle();

  if (!tenant) return null;

  return { orgId: tenant.organization_id, platformUserId: pu?.id ?? userId };
}

function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, "").replace(/^0/, "");
}

// Converte timestamp UTC do banco para horário de Brasília (BRT = UTC-3)
// Usa offset manual para garantir funcionamento em Deno sem depender de ICU
function toHoraBRT(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(brt.getUTCDate())}/${pad(brt.getUTCMonth() + 1)}/${brt.getUTCFullYear()} ${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`;
  } catch {
    return iso;
  }
}

// ── Helpers de período ───────────────────────────────────────────────────────
// Aceita: número de dias, objeto {from, to}, ou strings ISO "YYYY-MM-DD"
function buildPeriod(periodoOuDias: number | { from: Date; to: Date } | { fromStr: string; toStr: string }) {
  let from: Date, to: Date;
  if (typeof periodoOuDias === "number") {
    to = new Date();
    from = new Date(to);
    from.setDate(from.getDate() - periodoOuDias);
  } else if ("fromStr" in periodoOuDias) {
    // Datas explícitas no formato YYYY-MM-DD (fuso local do servidor = UTC)
    from = new Date(periodoOuDias.fromStr + "T00:00:00.000Z");
    to   = new Date(periodoOuDias.toStr   + "T23:59:59.999Z");
  } else {
    from = periodoOuDias.from;
    to   = periodoOuDias.to;
  }
  const startDate = new Date(from); startDate.setUTCHours(0, 0, 0, 0);
  const endDate   = new Date(to);   endDate.setUTCHours(23, 59, 59, 999);
  return {
    startDate:   startDate.toISOString(),
    endDate:     endDate.toISOString(),
    startDayStr: startDate.toISOString().slice(0, 10),
    endDayStr:   endDate.toISOString().slice(0, 10),
  };
}

// Períodos de calendário BRT — espelha DateRangePicker.tsx (ptBR: semana = dom–sáb)
function buildCalendarPeriod(tipo: "hoje" | "semana" | "mes" | "ano") {
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const brtNow = new Date(Date.now() - BRT_OFFSET_MS);
  const yr  = brtNow.getUTCFullYear();
  const mo  = brtNow.getUTCMonth();   // 0-based
  const dy  = brtNow.getUTCDate();
  const dow = brtNow.getUTCDay();     // 0=Dom em BRT

  function pad(n: number) { return String(n).padStart(2, "0"); }
  function brtDateStr(y: number, m: number, d: number) {
    const dt = new Date(Date.UTC(y, m, d));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }
  function brtMidnight(y: number, m: number, d: number) {
    return new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
  }
  function brtEndOfDay(y: number, m: number, d: number) {
    return new Date(Date.UTC(y, m, d + 1, 2, 59, 59, 999));
  }

  let startUTC: Date, endUTC: Date, startDayStr: string, endDayStr: string;

  if (tipo === "hoje") {
    startUTC = brtMidnight(yr, mo, dy);
    endUTC   = brtEndOfDay(yr, mo, dy);
    startDayStr = endDayStr = brtDateStr(yr, mo, dy);
  } else if (tipo === "semana") {
    const startDy = dy - dow; // domingo da semana atual
    const endDy   = startDy + 6; // sábado
    startUTC = brtMidnight(yr, mo, startDy);
    endUTC   = brtEndOfDay(yr, mo, endDy);
    startDayStr = brtDateStr(yr, mo, startDy);
    endDayStr   = brtDateStr(yr, mo, endDy);
  } else if (tipo === "mes") {
    const lastDay = new Date(Date.UTC(yr, mo + 1, 0)).getUTCDate();
    startUTC = brtMidnight(yr, mo, 1);
    endUTC   = brtEndOfDay(yr, mo, lastDay);
    startDayStr = brtDateStr(yr, mo, 1);
    endDayStr   = brtDateStr(yr, mo, lastDay);
  } else { // ano
    startUTC = brtMidnight(yr, 0, 1);
    endUTC   = brtEndOfDay(yr, 11, 31);
    startDayStr = `${yr}-01-01`;
    endDayStr   = `${yr}-12-31`;
  }

  return { startDate: startUTC.toISOString(), endDate: endUTC.toISOString(), startDayStr, endDayStr };
}

// ── Lógica central de métricas (espelha useDashboard.ts) ────────────────────
async function calcularMetricasPainel(
  orgId: string,
  startDate: string, endDate: string,
  startDayStr: string, endDayStr: string,
  apenasMarketing = false
) {
  const PAGE = 1000;
  let leadsRaw: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("leads")
      .select("id, nome, telefone, origem, fonte, is_qualified, is_scheduled, is_closed, criado_em, atualizado_em, excluir_metricas")
      .eq("organization_id", orgId)
      .or(`and(criado_em.gte.${startDate},criado_em.lte.${endDate}),and(atualizado_em.gte.${startDate},atualizado_em.lte.${endDate})`)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    leadsRaw = leadsRaw.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const leads = leadsRaw
    .filter((l: any) => !l.excluir_metricas)
    .filter((l: any) => l.fonte !== "importado");

  const filterOrigem = (l: any) => {
    if (apenasMarketing) return l.origem === "marketing";
    return l.origem !== "paciente";
  };

  const [stageHistoryRes, mqlNotasRes, agendamentosRes, vendasRes] = await Promise.all([
    supabase.from("lead_stage_history").select("lead_id")
      .eq("organization_id", orgId).not("from_stage_position", "is", null)
      .gte("entered_at", startDate).lte("entered_at", endDate),
    supabase.from("lead_notas").select("lead_id")
      .eq("organization_id", orgId).eq("tipo", "sistema")
      .filter("metadados->>evento", "eq", "mql")
      .gte("criado_em", startDate).lte("criado_em", endDate),
    supabase.from("agendamentos").select("lead_id")
      .eq("organization_id", orgId)
      .gte("data_hora_inicio", startDate).lte("data_hora_inicio", endDate),
    // FIX v10: coluna correta é valor_fechado (não existe coluna "valor" na tabela vendas)
    supabase.from("vendas").select("lead_id, valor_fechado")
      .eq("organization_id", orgId)
      .gte("data_fechamento", startDayStr).lte("data_fechamento", endDayStr),
  ]);

  const stageHistory  = stageHistoryRes.data  ?? [];
  const mqlNotas      = mqlNotasRes.data      ?? [];
  const agendamentos  = agendamentosRes.data  ?? [];
  const vendas        = vendasRes.data        ?? [];

  const atividadeReal = new Set<string>();
  for (const l of leads) {
    const t = new Date(l.criado_em).getTime();
    if (t >= new Date(startDate).getTime() && t <= new Date(endDate).getTime()) atividadeReal.add(l.id);
  }
  for (const sh of stageHistory) atividadeReal.add(sh.lead_id);
  for (const n  of mqlNotas)     atividadeReal.add(n.lead_id);
  for (const ag of agendamentos) if (ag.lead_id) atividadeReal.add(ag.lead_id);
  for (const v  of vendas)       if (v.lead_id)  atividadeReal.add(v.lead_id);

  const leadsById = new Map(leads.map((l: any) => [l.id, l]));

  const filteredLeads = leads
    .filter(filterOrigem)
    .filter((l: any) => atividadeReal.has(l.id));

  const mqlLeadIds = new Set<string>(
    mqlNotas.map((n: any) => n.lead_id).filter((id: string) => {
      const l = leadsById.get(id); return !l || filterOrigem(l);
    })
  );
  const scheduledLeadIds = new Set<string>(agendamentos.map((a: any) => a.lead_id).filter(Boolean));
  const closedLeadIds    = new Set<string>(vendas.map((v: any) => v.lead_id).filter(Boolean));

  const totalLeads     = filteredLeads.length;
  const mqlCount       = mqlLeadIds.size;
  const scheduledCount = scheduledLeadIds.size;
  const closedCount    = closedLeadIds.size || vendas.length;
  // FIX v10: valor_fechado (não existe coluna "valor" na tabela vendas)
  const receita        = vendas.reduce((s: number, v: any) => s + (Number(v.valor_fechado) || 0), 0);

  const pct = (n: number, d: number) => d > 0 ? parseFloat(((n / d) * 100).toFixed(1)) : 0;
  const _t = totalLeads || 1;

  return {
    total_leads:    totalLeads, mqls: mqlCount,
    agendamentos:   scheduledCount, fechamentos: closedCount, receita,
    tx_mql:         pct(mqlCount, _t),
    tx_agendamento: pct(scheduledCount, mqlCount),
    tx_fechamento:  pct(closedCount, scheduledCount),
    tx_global:      pct(closedCount, _t),
  };
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_leads",
      description: "Busca e lista leads do CRM com filtros.",
      parameters: {
        type: "object",
        properties: {
          limite: { type: "number" }, busca: { type: "string" },
          is_qualified: { type: "boolean" }, is_scheduled: { type: "boolean" }, is_closed: { type: "boolean" },
          origem: { type: "string" },
          tag: { type: "string" }, dias_sem_atividade: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_lead_completo",
      description: "Detalhes completos de um lead: dados, etapas, notas, agendamentos, vendas, mensagens e atendimento IA vs humano. Aceita lead_id, telefone (com/sem 55) ou nome.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          telefone: { type: "string" },
          nome: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_metricas_funil",
      description: "Métricas do funil idênticas ao painel: leads, MQLs, agendamentos, fechamentos. Use periodo_nome para calendário ('hoje'/'semana'/'mes'/'ano'), data_inicial+data_final para períodos passados, periodo_dias para 'últimos X dias'.",
      parameters: {
        type: "object",
        properties: {
          periodo_nome: { type: "string", enum: ["hoje", "semana", "mes", "ano"] },
          periodo_dias: { type: "number" },
          data_inicial: { type: "string", description: "YYYY-MM-DD" },
          data_final:   { type: "string", description: "YYYY-MM-DD" },
          apenas_marketing: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_agendamentos",
      description: "Proximos agendamentos da clinica.",
      parameters: {
        type: "object",
        properties: {
          periodo_dias: { type: "number" },
          status: { type: "string", enum: ["agendado", "realizado", "cancelado", "remarcado"] },
          limite: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_vendas_recentes",
      description: "Vendas fechadas com valores, produtos e leads associados.",
      parameters: {
        type: "object",
        properties: { limite: { type: "number" }, periodo_dias: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_metas",
      description: "Metas ativas com progresso atual.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_procedimentos",
      description: "Lista os procedimentos/servicos cadastrados na clinica.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_tags",
      description: "Lista todas as tags disponiveis.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_notificacoes",
      description: "Notificacoes pendentes.",
      parameters: {
        type: "object",
        properties: { apenas_nao_lidas: { type: "boolean" }, limite: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisar_leads_parados",
      description: "Identifica leads sem atividade recente.",
      parameters: {
        type: "object",
        properties: {
          dias_sem_atividade: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisar_ranking_procedimentos",
      description: "Ranking de procedimentos mais vendidos por volume e receita.",
      parameters: {
        type: "object",
        properties: { periodo_dias: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_resumo_geral",
      description: "Resumo executivo do dia: novos leads, agendamentos, vendas, alertas, leads quentes e parados.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_metricas_receita",
      description: "Analise de receita: total, ticket medio, evolucao diaria, projecao do mes.",
      parameters: {
        type: "object",
        properties: { periodo_dias: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_blacklist",
      description: "Lista os numeros permanentemente bloqueados.",
      parameters: {
        type: "object",
        properties: { busca: { type: "string" }, limite: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisar_atendimento_ia",
      description: "Analisa a distribuicao de atendimentos entre IA (bot) e humanos (agente/humano). Mostra leads apenas pela IA, handoffs, tempo medio e leads aguardando resposta humana.",
      parameters: {
        type: "object",
        properties: {
          periodo_dias: { type: "number" }, incluir_aguardando: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_lead",
      description: "Cria um novo lead no CRM.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" }, telefone: { type: "string" }, email: { type: "string" },
          origem: { type: "string" }, fonte: { type: "string" },
          procedimento_interesse: { type: "string" },
          observacoes: { type: "string" },
        },
        required: ["nome", "telefone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_lead",
      description: "Atualiza dados cadastrais de um lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" }, nome: { type: "string" }, telefone: { type: "string" },
          email: { type: "string" }, procedimento_interesse: { type: "string" },
          origem: { type: "string" }, fonte: { type: "string" }, observacoes: { type: "string" },
          is_closed: { type: "boolean" }, is_scheduled: { type: "boolean" },
          lead_scoring: { type: "string", enum: ["A", "B", "C", "D"] },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "qualificar_lead",
      description: "Marca ou desmarca um lead como MQL (qualificado).",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" }, is_qualified: { type: "boolean" },
        },
        required: ["lead_id", "is_qualified"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionar_nota",
      description: "Adiciona uma nota ao historico de um lead.",
      parameters: {
        type: "object",
        properties: { lead_id: { type: "string" }, conteudo: { type: "string" } },
        required: ["lead_id", "conteudo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerenciar_tags_lead",
      description: "Adiciona ou remove tags de um lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          adicionar_tags: { type: "array", items: { type: "string" } },
          remover_tags: { type: "array", items: { type: "string" } },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_agendamento",
      description: "Cria um agendamento para um lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" }, titulo: { type: "string" },
          tipo: { type: "string" }, data_hora_inicio: { type: "string" },
          data_hora_fim: { type: "string" }, observacoes: { type: "string" },
        },
        required: ["lead_id", "titulo", "data_hora_inicio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_venda",
      description: "Registra uma venda fechada para um lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" }, produto_servico: { type: "string" }, valor: { type: "number" },
          data_fechamento: { type: "string" }, forma_pagamento: { type: "string" }, observacoes: { type: "string" },
        },
        required: ["lead_id", "produto_servico", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_conversas_lead",
      description: "Retorna as ultimas mensagens WhatsApp de um lead. Remetentes: 'bot'=IA, 'agente'/'humano'/'atendente'=Humano, 'lead'=cliente.",
      parameters: {
        type: "object",
        properties: { lead_id: { type: "string" }, limite: { type: "number" } },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bloquear_numero",
      description: "Bloqueia permanentemente um numero de telefone.",
      parameters: {
        type: "object",
        properties: {
          telefone: { type: "string" }, motivo: { type: "string" }, arquivar_lead: { type: "boolean" },
        },
        required: ["telefone", "motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desbloquear_numero",
      description: "Remove um numero da blacklist.",
      parameters: {
        type: "object",
        properties: { telefone: { type: "string" } },
        required: ["telefone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_lead_permanente",
      description: "EXCLUSAO DEFINITIVA e irreversivel de um lead. Requer confirmado=true. Pode localizar o lead por lead_id, nome ou telefone.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" }, nome: { type: "string" }, telefone: { type: "string" },
          confirmado: { type: "boolean" }, motivo: { type: "string" }, bloquear_telefone: { type: "boolean" },
        },
        required: ["confirmado"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisar_nao_leads",
      description: "Identifica contatos que não são leads reais (spam, fornecedores, candidatos, etc). Use antes de exclusão em lote.",
      parameters: {
        type: "object",
        properties: {
          periodo_dias: { type: "number" },
          data_inicial: { type: "string" },
          data_final:   { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_lote",
      description: "Exclui múltiplos leads permanentemente. Use após analisar_nao_leads com confirmação do usuário.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" } },
          bloquear_telefones: { type: "boolean" },
          motivo: { type: "string" },
        },
        required: ["lead_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_mensagem",
      description: "Envia mensagem WhatsApp para um lead. Requer lead_id (use obter_lead_completo se só tiver telefone/nome).",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          mensagem: { type: "string" },
        },
        required: ["lead_id", "mensagem"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_cadencias",
      description: "Lista as cadências da clínica com nome, descrição e número de passos.",
      parameters: {
        type: "object",
        properties: {
          apenas_com_passos: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "disparar_cadencia",
      description: "Ativa uma cadência para um lead. Use listar_cadencias para obter cadencia_id.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          cadencia_id: { type: "string" },
        },
        required: ["lead_id", "cadencia_id"],
      },
    },
  },

  // ── CADÊNCIAS — CRUD ─────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "obter_cadencia_detalhes",
      description: "Retorna uma cadência com todos os seus passos detalhados (conteúdo, tempo de espera, ordem). Use para revisar antes de editar.",
      parameters: {
        type: "object",
        properties: {
          cadencia_id: { type: "string", description: "UUID da cadência. Use listar_cadencias para obter." },
        },
        required: ["cadencia_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_cadencia",
      description: "Cria uma cadência com nome, descrição e passos de mensagens automáticas.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome da cadência." },
          descricao: { type: "string", description: "Descrição do objetivo da cadência." },
          passos: {
            type: "array",
            description: "Lista de passos da cadência em ordem.",
            items: {
              type: "object",
              properties: {
                conteudo: { type: "string", description: "Texto da mensagem WhatsApp." },
                tempo_espera: { type: "number", description: "Quantidade de tempo a aguardar antes de enviar." },
                unidade_tempo: { type: "string", enum: ["minutos", "horas", "dias"], description: "Unidade do tempo de espera." },
              },
              required: ["conteudo", "tempo_espera", "unidade_tempo"],
            },
          },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_cadencia",
      description: "Atualiza o nome ou descrição de uma cadência existente. Para alterar passos, use excluir_cadencia e criar_cadencia novamente.",
      parameters: {
        type: "object",
        properties: {
          cadencia_id: { type: "string", description: "UUID da cadência a atualizar." },
          nome: { type: "string", description: "Novo nome (opcional)." },
          descricao: { type: "string", description: "Nova descrição (opcional)." },
        },
        required: ["cadencia_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_cadencia",
      description: "Exclui permanentemente uma cadência e todos os seus passos. Ação irreversível — confirme com o usuário antes.",
      parameters: {
        type: "object",
        properties: {
          cadencia_id: { type: "string", description: "UUID da cadência a excluir." },
        },
        required: ["cadencia_id"],
      },
    },
  },

  // ── PLATAFORMA — Materiais Complementares ────────────────────────────────────
  {
    type: "function",
    function: {
      name: "listar_materiais_complementares",
      description: "Lista todas as pastas e materiais complementares disponíveis na plataforma. Use para descobrir quais conteúdos de conhecimento comercial existem antes de ler um específico.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "ler_material_complementar",
      description: "Lê o conteúdo HTML completo de um material complementar específico. Use o material_id obtido de listar_materiais_complementares. Apenas materiais do tipo 'html' têm conteúdo legível — PDFs retornam só a URL.",
      parameters: {
        type: "object",
        properties: {
          material_id: { type: "string", description: "UUID do material. Use listar_materiais_complementares para obter." },
        },
        required: ["material_id"],
      },
    },
  },

  // ── PLATAFORMA — Jornada ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "obter_minha_jornada",
      description: "Retorna a jornada do cliente com todos os estagios e passos, incluindo progresso percentual. Use para visualizar, analisar e orientar o cliente sobre sua jornada de aprendizado.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "marcar_passo_jornada",
      description: "Marca ou desmarca um passo da jornada como concluido. Use passo_id obtido de obter_minha_jornada.",
      parameters: {
        type: "object",
        properties: {
          passo_id: { type: "string", description: "UUID do passo (jornada_passos.id)." },
          concluido: { type: "boolean", description: "true para marcar concluido, false para desmarcar." },
        },
        required: ["passo_id", "concluido"],
      },
    },
  },

  // ── PLATAFORMA — Arsenal ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "listar_arsenal",
      description: "Lista as categorias e ferramentas do Arsenal. Use categoria_slug para filtrar por categoria especifica. Use busca para pesquisar por nome.",
      parameters: {
        type: "object",
        properties: {
          categoria_slug: { type: "string", description: "Slug da categoria para filtrar ferramentas (ex: 'posicionamento', 'vendas')." },
          busca: { type: "string", description: "Texto para pesquisar no nome das ferramentas." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_arsenal_ferramenta",
      description: "Retorna detalhes completos de uma ferramenta do Arsenal, incluindo texto de aprendizado e template HTML para construcao. Use para mostrar o conteudo completo de uma ferramenta ao usuario.",
      parameters: {
        type: "object",
        properties: {
          ferramenta_id: { type: "string", description: "UUID da ferramenta." },
          ferramenta_slug: { type: "string", description: "Slug da ferramenta (alternativa ao ID)." },
        },
      },
    },
  },

  // ── PLATAFORMA — Meus Materiais ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "listar_meus_materiais",
      description: "Lista os materiais criados pelo usuario na plataforma (Meus Materiais). Inclui titulo, conteudo, categoria e ferramenta associada.",
      parameters: {
        type: "object",
        properties: {
          busca: { type: "string", description: "Pesquisar por titulo do material." },
          limite: { type: "number", description: "Maximo de resultados (padrao 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_material",
      description: "Cria material em Meus Materiais. Conteúdo DEVE ser HTML (TipTap).",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          conteudo: { type: "string", description: "HTML rico: <h2>, <p>, <strong>, <ul><li>, <ol><li>, <hr>." },
          categoria_arsenal_id: { type: "string" },
          ferramenta_id: { type: "string" },
        },
        required: ["titulo", "conteudo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_material",
      description: "Atualiza título, conteúdo HTML ou associação de ferramenta de um material.",
      parameters: {
        type: "object",
        properties: {
          material_id: { type: "string" },
          titulo: { type: "string" },
          conteudo: { type: "string", description: "HTML rico (TipTap)." },
          ferramenta_id: { type: "string" },
          categoria_arsenal_id: { type: "string" },
        },
        required: ["material_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_material",
      description: "Exclui permanentemente um material de Meus Materiais. Acao irreversivel — confirme com o usuario antes.",
      parameters: {
        type: "object",
        properties: {
          material_id: { type: "string", description: "UUID do material a excluir." },
        },
        required: ["material_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_progresso_arsenal",
      description: "Atualiza progresso do usuário em uma ferramenta do Arsenal.",
      parameters: {
        type: "object",
        properties: {
          ferramenta_id: { type: "string" },
          status: { type: "string", enum: ["em_andamento", "concluido"] },
        },
        required: ["ferramenta_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_construcao_ferramenta",
      description: "Salva construção do usuário em uma ferramenta do Arsenal. Conteúdo DEVE ser HTML (TipTap).",
      parameters: {
        type: "object",
        properties: {
          ferramenta_id: { type: "string" },
          titulo: { type: "string" },
          conteudo: { type: "string", description: "HTML rico: <h2>, <p>, <strong>, <ul><li>." },
        },
        required: ["ferramenta_id", "conteudo"],
      },
    },
  },

  // ── AGENDAMENTOS — Atualização e Exclusão ───────────────────────────────────
  {
    type: "function",
    function: {
      name: "atualizar_agendamento",
      description: "Atualiza dados de um agendamento existente: título, tipo, data/hora, status ou observações. Use para remarcar, cancelar ou marcar como realizado.",
      parameters: {
        type: "object",
        properties: {
          agendamento_id: { type: "string" },
          titulo: { type: "string" },
          tipo: { type: "string" },
          data_hora_inicio: { type: "string" },
          data_hora_fim: { type: "string" },
          status: { type: "string", enum: ["agendado", "realizado", "cancelado", "remarcado"] },
          observacoes: { type: "string" },
        },
        required: ["agendamento_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_agendamento",
      description: "Exclui permanentemente um agendamento. Ação irreversível — confirme com o usuário antes.",
      parameters: {
        type: "object",
        properties: {
          agendamento_id: { type: "string" },
          confirmado: { type: "boolean" },
        },
        required: ["agendamento_id", "confirmado"],
      },
    },
  },

  // ── VENDAS — Atualização e Exclusão ─────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "atualizar_venda",
      description: "Atualiza dados de uma venda registrada: produto, valor, data, forma de pagamento ou observações.",
      parameters: {
        type: "object",
        properties: {
          venda_id: { type: "string" },
          produto_servico: { type: "string" },
          valor: { type: "number" },
          data_fechamento: { type: "string" },
          forma_pagamento: { type: "string" },
          observacoes: { type: "string" },
        },
        required: ["venda_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_venda",
      description: "Exclui permanentemente uma venda. Ação irreversível — confirme com o usuário antes.",
      parameters: {
        type: "object",
        properties: {
          venda_id: { type: "string" },
          confirmado: { type: "boolean" },
        },
        required: ["venda_id", "confirmado"],
      },
    },
  },

  // ── NOTIFICAÇÕES — Marcar como lida ─────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "marcar_notificacao_lida",
      description: "Marca uma ou todas as notificações como lidas.",
      parameters: {
        type: "object",
        properties: {
          notificacao_id: { type: "string" },
          todas: { type: "boolean" },
        },
      },
    },
  },

  // ── TAGS — Gestão da org ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "criar_tag",
      description: "Cria uma nova tag na organização.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          cor: { type: "string" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_tag",
      description: "Exclui uma tag da organização (remove de todos os leads automaticamente). Aceita tag_id ou nome.",
      parameters: {
        type: "object",
        properties: {
          tag_id: { type: "string" },
          nome: { type: "string" },
        },
      },
    },
  },

  // ── METAS — CRUD ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "criar_meta",
      description: "Cria uma meta de desempenho para a clínica com projeções de receita e funil.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          periodo_tipo: { type: "string", enum: ["mes", "semana", "ano", "personalizado"] },
          data_inicio: { type: "string" },
          data_fim: { type: "string" },
          meta_receita: { type: "number" },
          ticket_medio: { type: "number" },
          tx_mql: { type: "number" },
          tx_agendamento: { type: "number" },
          tx_conversao: { type: "number" },
          cpl_meta: { type: "number" },
        },
        required: ["nome", "data_inicio", "data_fim", "meta_receita"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_meta",
      description: "Atualiza uma meta existente.",
      parameters: {
        type: "object",
        properties: {
          meta_id: { type: "string" },
          nome: { type: "string" },
          meta_receita: { type: "number" },
          ticket_medio: { type: "number" },
          tx_mql: { type: "number" },
          tx_agendamento: { type: "number" },
          tx_conversao: { type: "number" },
          cpl_meta: { type: "number" },
          data_inicio: { type: "string" },
          data_fim: { type: "string" },
        },
        required: ["meta_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_meta",
      description: "Exclui uma meta permanentemente.",
      parameters: {
        type: "object",
        properties: {
          meta_id: { type: "string" },
          confirmado: { type: "boolean" },
        },
        required: ["meta_id", "confirmado"],
      },
    },
  },

  // ── MENSAGENS — Agendamento ───────────────────────────────────────────────────
  // ── CADÊNCIAS — Cancelar de lead ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "cancelar_cadencia_lead",
      description: "Cancela uma cadência ativa em andamento para um lead. Use listar_cadencias ou obter_lead_completo para obter cadencia_id.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          cadencia_id: { type: "string" },
        },
        required: ["lead_id"],
      },
    },
  },

  // ── PROCEDIMENTOS — CRUD ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "criar_procedimento",
      description: "Cria um novo procedimento/serviço no catálogo da clínica.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          categoria: { type: "string" },
          descricao: { type: "string" },
          valor_base: { type: "number" },
          duracao_minutos: { type: "number" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_procedimento",
      description: "Atualiza dados de um procedimento existente no catálogo.",
      parameters: {
        type: "object",
        properties: {
          procedimento_id: { type: "string" },
          nome: { type: "string" },
          categoria: { type: "string" },
          descricao: { type: "string" },
          valor_base: { type: "number" },
          duracao_minutos: { type: "number" },
          ativo: { type: "boolean" },
        },
        required: ["procedimento_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_procedimento",
      description: "Exclui um procedimento do catálogo. Ação irreversível — confirme com o usuário antes.",
      parameters: {
        type: "object",
        properties: {
          procedimento_id: { type: "string" },
          confirmado: { type: "boolean" },
        },
        required: ["procedimento_id", "confirmado"],
      },
    },
  },

  // ── NOTAS — Edição e Exclusão ────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "editar_nota",
      description: "Edita o conteúdo de uma nota manual de um lead.",
      parameters: {
        type: "object",
        properties: {
          nota_id: { type: "string" },
          conteudo: { type: "string" },
        },
        required: ["nota_id", "conteudo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_nota",
      description: "Exclui uma nota de um lead. Apenas notas manuais podem ser excluídas.",
      parameters: {
        type: "object",
        properties: {
          nota_id: { type: "string" },
        },
        required: ["nota_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obter_config_ia",
      description: "Lê a configuração completa da IA de pré-atendimento desta clínica: prompt base (override da org ou global), instruções específicas, horário, formas de pagamento, contraindicações, palavras proibidas, modelo e status. Use antes de qualquer alteração ou diagnóstico da IA.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_prompt_base_ia",
      description: "Salva um prompt base personalizado para a IA de pré-atendimento DESTA clínica especificamente, sem afetar nenhuma outra clínica da plataforma. Se já existir um override, substitui. Se não existir, cria. Use obter_config_ia primeiro para ver o prompt atual antes de alterar.",
      parameters: {
        type: "object",
        properties: {
          prompt_base: { type: "string", description: "Novo texto completo do prompt base da IA de pré-atendimento para esta clínica." },
          motivo: { type: "string", description: "Motivo da alteração (para registro interno)." },
        },
        required: ["prompt_base"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "configurar_dados_clinica_ia",
      description: "Configura TODOS os dados específicos da clínica usados pela IA de pré-atendimento: identidade, emojis, procedimentos, FAQ, contato, horário de atendimento e formas de pagamento. Os procedimentos do CRM são importados automaticamente — você só precisa das descrições (sem preços). Use quando o cliente quiser configurar ou atualizar qualquer dado da clínica na IA.",
      parameters: {
        type: "object",
        properties: {
          nome_agente: { type: "string", description: "Nome da IA (ex: Sofia, Bia, Clara)" },
          nome_clinica: { type: "string", description: "Nome da clínica" },
          nome_profissional: { type: "string", description: "Nome do profissional (ex: Dra. Ana Lima)" },
          especialidade: { type: "string", description: "Especialidade (ex: Odontologia Estética, Medicina Estética)" },
          usar_emojis: { type: "boolean", description: "Se a IA deve usar emojis nas mensagens" },
          emojis_permitidos: { type: "string", description: "Emojis permitidos quando usar_emojis=true (ex: 😊 ✨ 💙)" },
          quem_chamar: { type: "string", enum: ["equipe", "secretaria", "doutor"], description: "Quem a IA deve chamar ao fazer handoff" },
          nome_pessoa_chamada: { type: "string", description: "Nome da pessoa que assume o atendimento (quando quem_chamar != equipe)" },
          tom_de_voz: { type: "string", description: "Descrição do tom de voz e personalidade do agente" },
          descricoes_procedimentos: {
            type: "array",
            description: "Descrições opcionais para cada procedimento (sem preços). Os nomes são importados do CRM automaticamente.",
            items: {
              type: "object",
              properties: {
                nome: { type: "string", description: "Nome exato do procedimento conforme cadastrado no CRM" },
                descricao: { type: "string", description: "Descrição do procedimento para a IA (sem preços)" },
              },
              required: ["nome"],
            },
          },
          faq: {
            type: "array",
            description: "Perguntas frequentes da clínica",
            items: {
              type: "object",
              properties: {
                pergunta: { type: "string" },
                resposta: { type: "string" },
              },
              required: ["pergunta", "resposta"],
            },
          },
          instagram: { type: "string", description: "Link do Instagram da clínica (ex: https://instagram.com/clinica)" },
          endereco: { type: "string", description: "Endereço da clínica" },
          instrucoes_pontuais: { type: "string", description: "Instruções específicas adicionais para o agente" },
          contraindicacoes: { type: "string", description: "Situações ou condições em que a IA NÃO deve atender ou deve encaminhar imediatamente (ex: 'gestantes', 'menores de 18 anos sem responsável', 'emergências odontológicas'). Texto livre." },
          palavras_proibidas: {
            type: "array",
            description: "Palavras ou expressões que a IA NUNCA pode usar nas mensagens (ex: 'barato', 'promoção', 'desconto', 'amiga')",
            items: { type: "string" },
          },
          ia_ativa: { type: "boolean", description: "true = ativar a IA de pré-atendimento, false = desativar. Use true quando o cliente confirmar que quer ligar a IA." },
          horario_atendimento: {
            type: "object",
            description: "Horário de atendimento da clínica. Informe apenas os campos que souber.",
            properties: {
              weekday_open:    { type: "string", description: "Hora de abertura de segunda a sexta (formato HH:MM, ex: 09:00)" },
              weekday_close:   { type: "string", description: "Hora de fechamento de segunda a sexta (formato HH:MM, ex: 18:00)" },
              saturday_open:   { type: "string", description: "Hora de abertura no sábado (formato HH:MM). Deixar vazio se sábado_fechado=true" },
              saturday_close:  { type: "string", description: "Hora de fechamento no sábado (formato HH:MM). Deixar vazio se sábado_fechado=true" },
              saturday_closed: { type: "boolean", description: "true = clínica fechada no sábado" },
              sunday_closed:   { type: "boolean", description: "true = clínica fechada no domingo (quase sempre true)" },
            },
          },
          formas_pagamento: {
            type: "object",
            description: "Formas de pagamento aceitas pela clínica",
            properties: {
              pix:          { type: "boolean", description: "Aceita Pix" },
              dinheiro:     { type: "boolean", description: "Aceita dinheiro" },
              credito:      { type: "boolean", description: "Aceita cartão de crédito" },
              debito:       { type: "boolean", description: "Aceita cartão de débito" },
              parcelamento: { type: "string", description: "Condições de parcelamento (ex: 'até 12x no crédito'). Deixar vazio se não parcelar." },
              observacoes:  { type: "string", description: "Observações adicionais sobre pagamento" },
            },
          },
        },
        required: ["nome_agente", "nome_clinica", "nome_profissional", "especialidade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_jornada",
      description: "Cria a jornada personalizada do cliente na plataforma. Use quando precisar salvar a jornada com estágios e passos. Retorna o ID da jornada criada.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título da jornada (ex: 'Jornada Estratégica — Clínica Bella')" },
          estagios: {
            type: "array",
            description: "Lista de estágios da jornada (3 a 8 estágios recomendados)",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string", description: "Nome do estágio" },
                descricao: { type: "string", description: "Descrição curta do objetivo do estágio" },
                prazo_dias: { type: "number", description: "Duração em dias (padrão: 7)" },
                passos: {
                  type: "array",
                  description: "Passos dentro deste estágio",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string", description: "Nome do passo" },
                      descricao: { type: "string", description: "O que o cliente deve fazer neste passo" },
                      tipo: { type: "string", enum: ["acao_livre", "ferramenta_arsenal"], description: "Tipo do passo. Use 'ferramenta_arsenal' tanto para ferramentas quanto para aulas do arsenal." },
                      ferramenta_slug: { type: "string", description: "Slug da ferramenta OU da aula do arsenal (se tipo=ferramenta_arsenal). O sistema resolve automaticamente se é ferramenta ou aula." },
                      obrigatorio: { type: "boolean", description: "Se o passo é obrigatório (padrão: true)" },
                    },
                    required: ["titulo"],
                  },
                },
              },
              required: ["titulo"],
            },
          },
        },
        required: ["titulo", "estagios"],
      },
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// ADMIN OS — Tools cross-org (read-only / insights)
// ════════════════════════════════════════════════════════════════════════════
interface ClienteBase {
  organization_id: string;
  nome: string;
  clinica: string | null;
  nome_completo: string | null;
  email: string | null;
  status: string;
  produto: string | null;
  trial_ends_at: string | null;
  dias_restantes: number | null;
  onboarding: string;
  criado_em: string | null;
}

let _clientesCache: { ts: number; data: ClienteBase[] } | null = null;

async function listarClientesBase(): Promise<ClienteBase[]> {
  if (_clientesCache && Date.now() - _clientesCache.ts < 60_000) return _clientesCache.data;

  const [{ data: papeis }, { data: tenants }, { data: prods }, { data: perfis }, { data: pus }] = await Promise.all([
    supabase.from("usuarios_papeis").select("usuario_id").eq("papel", "superadmin"),
    supabase.from("platform_tenants").select("organization_id, status, trial_ends_at, product_id, created_at, organizations(name)"),
    supabase.from("platform_products").select("id, nome"),
    supabase.from("perfis").select("id, organization_id, nome_completo, email"),
    supabase.from("platform_users").select("crm_user_id, clinic_name, onboarding_concluido, onboarding_complete, platform_onboarding_enabled"),
  ]);

  const superIds = new Set((papeis ?? []).map((p: any) => p.usuario_id));
  const superPerfilOrgs = new Set((perfis ?? []).filter((p: any) => superIds.has(p.id)).map((p: any) => p.organization_id).filter(Boolean));
  const orgsComUsuarioReal = new Set((perfis ?? []).filter((p: any) => p.organization_id && !superIds.has(p.id)).map((p: any) => p.organization_id));
  const soSuperadminOrgs = new Set([...superPerfilOrgs].filter(id => !orgsComUsuarioReal.has(id)));

  const prodMap: Record<string, string> = {};
  (prods ?? []).forEach((p: any) => { prodMap[p.id] = p.nome; });

  const perfilByOrg: Record<string, any> = {};
  (perfis ?? []).forEach((p: any) => {
    if (!p.organization_id) return;
    const ex = perfilByOrg[p.organization_id];
    if (!ex || (superIds.has(ex.id) && !superIds.has(p.id))) perfilByOrg[p.organization_id] = p;
  });
  const puByCrm: Record<string, any> = {};
  (pus ?? []).forEach((pu: any) => { if (pu.crm_user_id) puByCrm[pu.crm_user_id] = pu; });

  const norm = (s: string | null) => {
    const v = (s ?? "").toLowerCase();
    if (v === "active" || v === "ativo") return "ativo";
    if (v === "blocked" || v === "bloqueado") return "bloqueado";
    return v || "ativo";
  };

  const out: ClienteBase[] = (tenants ?? [])
    .filter((t: any) => !soSuperadminOrgs.has(t.organization_id) && t.organization_id !== MASTER_ORG_ID)
    .map((t: any) => {
      const perfil = perfilByOrg[t.organization_id];
      const pu = perfil?.id ? puByCrm[perfil.id] : null;
      const clinica = pu?.clinic_name ?? (t.organizations as any)?.name ?? null;
      const nome = clinica || perfil?.nome_completo || (t.organizations as any)?.name || "Sem nome";
      let dias: number | null = null;
      if (t.trial_ends_at) dias = Math.floor((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000);
      let onb = "completo";
      if (!pu) onb = "nunca_acessou";
      else if (pu.platform_onboarding_enabled && !pu.onboarding_complete) onb = pu.onboarding_concluido ? "checklist_pendente" : "pendente";
      return {
        organization_id: t.organization_id, nome, clinica,
        nome_completo: perfil?.nome_completo ?? null, email: perfil?.email ?? null,
        status: norm(t.status), produto: t.product_id ? (prodMap[t.product_id] ?? null) : null,
        trial_ends_at: t.trial_ends_at ?? null, dias_restantes: dias, onboarding: onb,
        criado_em: t.created_at ?? null,
      };
    });
  _clientesCache = { ts: Date.now(), data: out };
  return out;
}

// Agrega métricas-chave por org num período (1 query por tabela, sem N+1)
async function aggregateByOrg(periodoDias: number): Promise<Map<string, { leads: number; leads_mql: number; agendamentos: number; vendas: number; receita: number }>> {
  const from = new Date(Date.now() - periodoDias * 86400000).toISOString();
  const [{ data: leads }, { data: ags }, { data: vendas }] = await Promise.all([
    supabase.from("leads").select("organization_id, is_qualified, excluir_metricas, criado_em").gte("criado_em", from),
    supabase.from("agendamentos").select("organization_id, data_hora_inicio").gte("data_hora_inicio", from),
    supabase.from("vendas").select("organization_id, valor_fechado, data_fechamento").gte("data_fechamento", from),
  ]);
  const m = new Map<string, any>();
  const get = (org: string) => { if (!m.has(org)) m.set(org, { leads: 0, leads_mql: 0, agendamentos: 0, vendas: 0, receita: 0 }); return m.get(org); };
  (leads ?? []).forEach((l: any) => { if (l.excluir_metricas) return; const e = get(l.organization_id); e.leads++; if (l.is_qualified) e.leads_mql++; });
  (ags ?? []).forEach((a: any) => { get(a.organization_id).agendamentos++; });
  (vendas ?? []).forEach((v: any) => { const e = get(v.organization_id); e.vendas++; e.receita += Number(v.valor_fechado) || 0; });
  return m;
}

const ADMIN_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  { type: "function", function: { name: "listar_clientes", description: "Lista todos os clientes da plataforma com status, produto, vencimento e estado de onboarding. Use para visão geral da carteira e para descobrir os nomes exatos dos clientes.", parameters: { type: "object", properties: { status: { type: "string", enum: ["ativo", "bloqueado"], description: "Filtra por status" }, onboarding_pendente: { type: "boolean", description: "Apenas clientes que ainda não concluíram o onboarding" }, busca: { type: "string", description: "Filtra por nome ou email" }, limite: { type: "number", description: "Máx. de resultados (default 100)" } } } } },
  { type: "function", function: { name: "obter_visao_geral_plataforma", description: "Panorama agregado de TODA a plataforma: total de clientes (ativos/bloqueados/expirados/vencendo), onboarding pendente e soma de leads, MQLs, agendamentos, vendas e receita de todos os clientes no período.", parameters: { type: "object", properties: { periodo_dias: { type: "number", description: "Janela em dias para os agregados (default 30)" } } } } },
  { type: "function", function: { name: "ranking_clientes", description: "Rankeia os clientes ativos por uma métrica no período. Use para responder 'quem está indo melhor/pior'. ordem='pior' traz os piores primeiro.", parameters: { type: "object", properties: { metrica: { type: "string", enum: ["receita", "vendas", "leads", "agendamentos", "conversao"], description: "Métrica de ordenação (default receita)" }, ordem: { type: "string", enum: ["melhor", "pior"], description: "melhor = decrescente; pior = crescente (default melhor)" }, periodo_dias: { type: "number", description: "Janela em dias (default 30)" }, limite: { type: "number", description: "Quantos clientes retornar (default 10)" } } } } },
  { type: "function", function: { name: "comparar_clientes", description: "Compara 2 ou mais clientes lado a lado nas métricas-chave (leads, MQL, agendamentos, vendas, receita, taxa de conversão) no período.", parameters: { type: "object", properties: { clientes: { type: "array", items: { type: "string" }, description: "Nomes dos clientes a comparar (mín. 2)" }, periodo_dias: { type: "number", description: "Janela em dias (default 30)" } }, required: ["clientes"] } } },
  { type: "function", function: { name: "focar_cliente", description: "Define um cliente como FOCO da conversa. Depois de chamar isto, todas as tools de dados (buscar_leads, obter_metricas_funil, obter_vendas_recentes, etc.) passam a operar SOBRE ESSE CLIENTE. Use sempre que o usuário pedir uma análise profunda de um cliente específico.", parameters: { type: "object", properties: { cliente: { type: "string", description: "Nome ou email do cliente" } }, required: ["cliente"] } } },
  { type: "function", function: { name: "obter_evolucao_cliente", description: "Evolução de um cliente: status/produto/vencimento, progresso da jornada de implementação, estado do onboarding e variação de leads e receita do período atual vs o período anterior (crescendo ou caindo).", parameters: { type: "object", properties: { cliente: { type: "string", description: "Nome ou email do cliente" }, periodo_dias: { type: "number", description: "Tamanho de cada janela comparada (default 30)" } }, required: ["cliente"] } } },
];

function buildAdminSystemPrompt(focoNome: string | null): string {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });
  return `Você é o **Athos**, a inteligência estratégica operacional da Descompliquei Growth Company — agora no **modo administrativo**, assistindo a EQUIPE interna na gestão de TODOS os clientes da plataforma.

Data de hoje: ${hoje}.

## Seu papel
Você ajuda a equipe a tomar decisões operacionais sobre a carteira de clientes: identificar quem precisa de atenção, quem está evoluindo, quem está estagnado, comparar desempenho e recomendar as próximas ações. Você é consultivo e direto — entrega insights acionáveis, não só números.

## Modos de operação
Você opera em DOIS modos:

1. **Modo global (carteira inteira)** — quando nenhum cliente está em foco. Aqui você usa as ferramentas cross-org:
   - \`listar_clientes\` — toda a carteira (status, produto, vencimento, onboarding)
   - \`obter_visao_geral_plataforma\` — panorama agregado de todos os clientes
   - \`ranking_clientes\` — quem está indo melhor/pior por métrica
   - \`comparar_clientes\` — dois ou mais clientes lado a lado
   - \`obter_evolucao_cliente\` — evolução de um cliente (atual vs período anterior)

2. **Modo foco (um cliente)** — quando o usuário pede análise profunda de um cliente específico, chame \`focar_cliente\` com o nome dele. A partir daí, TODAS as ferramentas de dados (buscar_leads, obter_metricas_funil, obter_vendas_recentes, obter_agendamentos, analisar_leads_parados, analisar_atendimento_ia, etc.) passam a operar SOBRE ESSE CLIENTE — exatamente como o Athos opera dentro do CRM dele.
${focoNome ? `\n>>> CLIENTE EM FOCO AGORA: **${focoNome}**. As ferramentas de dados já estão apontando para ele. Não precisa chamar focar_cliente de novo, a menos que o usuário troque de cliente.\n` : ""}
## Regras
- Você é **somente leitura**: analisa, compara e recomenda, mas NUNCA altera dados de nenhum cliente (não cria leads, não registra vendas). Se pedirem para alterar algo, explique que a ação deve ser feita pela equipe no CRM do cliente.
- Se for analisar um cliente específico e ainda não estiver em foco, chame \`focar_cliente\` ANTES das ferramentas de dados detalhadas.
- Para descobrir o nome exato de um cliente, use \`listar_clientes\`.
- Seja objetivo: traga o número E a leitura ("caiu 30% vs mês anterior — vale investigar a origem dos leads").
- Zero emojis. Português correto com todos os acentos. Nunca use "Agente" para se referir a humanos — use "atendente" ou "a equipe".`;
}

async function executeAdminTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "listar_clientes": {
      let cs = await listarClientesBase();
      const status = (input.status ?? "").toLowerCase();
      if (status === "ativo" || status === "bloqueado") cs = cs.filter(c => c.status === status);
      if (input.onboarding_pendente) cs = cs.filter(c => c.onboarding !== "completo");
      if (input.busca) { const q = String(input.busca).toLowerCase(); cs = cs.filter(c => c.nome.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q)); }
      const lim = Math.min(input.limite ?? 100, 200);
      return JSON.stringify({
        total: cs.length,
        clientes: cs.slice(0, lim).map(c => ({
          nome: c.nome, email: c.email, status: c.status, produto: c.produto,
          vencimento: c.dias_restantes == null ? "vitalício" : (c.dias_restantes < 0 ? `expirado há ${Math.abs(c.dias_restantes)}d` : `${c.dias_restantes}d restantes`),
          onboarding: c.onboarding,
        })),
      });
    }
    case "obter_visao_geral_plataforma": {
      const cs = await listarClientesBase();
      const periodo = input.periodo_dias ?? 30;
      const agg = await aggregateByOrg(periodo);
      let leads = 0, mql = 0, ags = 0, vendas = 0, receita = 0;
      for (const v of agg.values()) { leads += v.leads; mql += v.leads_mql; ags += v.agendamentos; vendas += v.vendas; receita += v.receita; }
      return JSON.stringify({
        periodo_dias: periodo,
        clientes: {
          total: cs.length,
          ativos: cs.filter(c => c.status === "ativo").length,
          bloqueados: cs.filter(c => c.status === "bloqueado").length,
          expirados: cs.filter(c => c.dias_restantes != null && c.dias_restantes < 0).length,
          vencendo_30d: cs.filter(c => c.dias_restantes != null && c.dias_restantes >= 0 && c.dias_restantes <= 30).length,
          onboarding_pendente: cs.filter(c => c.onboarding !== "completo").length,
        },
        agregado: { leads, leads_mql: mql, agendamentos: ags, vendas, receita: Math.round(receita) },
      });
    }
    case "ranking_clientes": {
      const periodo = input.periodo_dias ?? 30;
      const metrica = input.metrica ?? "receita";
      const ordem = input.ordem ?? "melhor";
      const cs = (await listarClientesBase()).filter(c => c.status === "ativo");
      const agg = await aggregateByOrg(periodo);
      const rows = cs.map(c => {
        const a = agg.get(c.organization_id) ?? { leads: 0, leads_mql: 0, agendamentos: 0, vendas: 0, receita: 0 };
        const taxaConv = a.leads > 0 ? Math.round((a.vendas / a.leads) * 100) : 0;
        const valor = metrica === "leads" ? a.leads : metrica === "agendamentos" ? a.agendamentos : metrica === "vendas" ? a.vendas : metrica === "conversao" ? taxaConv : a.receita;
        return { nome: c.nome, produto: c.produto, valor, detalhe: { leads: a.leads, mql: a.leads_mql, agendamentos: a.agendamentos, vendas: a.vendas, receita: Math.round(a.receita), taxa_conversao: `${taxaConv}%` } };
      });
      rows.sort((x, y) => ordem === "pior" ? x.valor - y.valor : y.valor - x.valor);
      const lim = Math.min(input.limite ?? 10, 50);
      return JSON.stringify({ metrica, periodo_dias: periodo, ordem, ranking: rows.slice(0, lim) });
    }
    case "comparar_clientes": {
      const nomes: string[] = Array.isArray(input.clientes) ? input.clientes : [];
      if (nomes.length < 2) return JSON.stringify({ erro: "Informe ao menos 2 clientes para comparar." });
      const periodo = input.periodo_dias ?? 30;
      const agg = await aggregateByOrg(periodo);
      const res: any[] = [];
      for (const n of nomes) {
        const r = await resolveClienteOrg(n);
        if (!r) { res.push({ cliente: n, erro: "não encontrado" }); continue; }
        const a = agg.get(r.orgId) ?? { leads: 0, leads_mql: 0, agendamentos: 0, vendas: 0, receita: 0 };
        res.push({ cliente: r.nome, leads: a.leads, leads_mql: a.leads_mql, agendamentos: a.agendamentos, vendas: a.vendas, receita: Math.round(a.receita), taxa_conversao: a.leads > 0 ? `${Math.round((a.vendas / a.leads) * 100)}%` : "0%" });
      }
      return JSON.stringify({ periodo_dias: periodo, comparacao: res });
    }
    case "focar_cliente": {
      const r = await resolveClienteOrg(input.cliente ?? "");
      if (!r) return JSON.stringify({ ok: false, erro: `Cliente "${input.cliente}" não encontrado. Use listar_clientes para ver os nomes disponíveis.` });
      return JSON.stringify({ ok: true, org_id: r.orgId, cliente: r.nome, mensagem: `Foco definido em ${r.nome}. As próximas consultas usarão os dados deste cliente.` });
    }
    case "obter_evolucao_cliente": {
      const r = await resolveClienteOrg(input.cliente ?? "");
      if (!r) return JSON.stringify({ erro: `Cliente "${input.cliente}" não encontrado.` });
      const periodo = input.periodo_dias ?? 30;
      const base = (await listarClientesBase()).find(c => c.organization_id === r.orgId);
      const aggNow = await aggregateByOrg(periodo);
      const fromPrev = new Date(Date.now() - 2 * periodo * 86400000).toISOString();
      const toPrev = new Date(Date.now() - periodo * 86400000).toISOString();
      const [{ data: leadsPrev }, { data: vendasPrev }] = await Promise.all([
        supabase.from("leads").select("id, excluir_metricas").eq("organization_id", r.orgId).gte("criado_em", fromPrev).lt("criado_em", toPrev),
        supabase.from("vendas").select("valor_fechado").eq("organization_id", r.orgId).gte("data_fechamento", fromPrev).lt("data_fechamento", toPrev),
      ]);
      const now = aggNow.get(r.orgId) ?? { leads: 0, leads_mql: 0, agendamentos: 0, vendas: 0, receita: 0 };
      const prevLeads = (leadsPrev ?? []).filter((l: any) => !l.excluir_metricas).length;
      const prevReceita = (vendasPrev ?? []).reduce((s: number, v: any) => s + (Number(v.valor_fechado) || 0), 0);
      const { data: jornadas } = await supabase.from("jornadas").select("id, titulo, status").eq("organization_id", r.orgId);
      let passosTotal = 0, passosConcl = 0;
      if (jornadas?.length) {
        const jids = jornadas.map((j: any) => j.id);
        const { data: estagios } = await supabase.from("jornada_estagios").select("id").in("jornada_id", jids);
        const eids = (estagios ?? []).map((e: any) => e.id);
        if (eids.length) {
          const { data: passos } = await supabase.from("jornada_passos").select("concluido").in("estagio_id", eids);
          passosTotal = (passos ?? []).length;
          passosConcl = (passos ?? []).filter((p: any) => p.concluido).length;
        }
      }
      const pct = (a: number, b: number) => b === 0 ? (a > 0 ? "+100%" : "0%") : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`;
      return JSON.stringify({
        cliente: r.nome, status: base?.status, produto: base?.produto,
        vencimento: base?.dias_restantes == null ? "vitalício" : `${base?.dias_restantes}d restantes`,
        onboarding: base?.onboarding,
        jornada: jornadas?.length ? { titulo: jornadas[0].titulo, status: jornadas[0].status, progresso: passosTotal > 0 ? `${passosConcl}/${passosTotal} passos (${Math.round((passosConcl / passosTotal) * 100)}%)` : "sem passos" } : "sem jornada",
        periodo_dias: periodo,
        evolucao: {
          leads: { atual: now.leads, anterior: prevLeads, variacao: pct(now.leads, prevLeads) },
          receita: { atual: Math.round(now.receita), anterior: Math.round(prevReceita), variacao: pct(now.receita, prevReceita) },
          agendamentos: now.agendamentos, vendas: now.vendas, taxa_conversao: now.leads > 0 ? `${Math.round((now.vendas / now.leads) * 100)}%` : "0%",
        },
      });
    }
    default:
      return JSON.stringify({ erro: `Tool admin desconhecida: ${name}` });
  }
}

async function executeTool(name: string, input: any, orgId: string, platformUserId: string): Promise<string> {
  try {
    switch (name) {

      case "buscar_leads": {
        let q = supabase
          .from("leads")
          .select("id, nome, telefone, email, origem, fonte, is_qualified, is_scheduled, is_closed, procedimento_interesse, excluir_metricas, criado_em, atualizado_em")
          .eq("organization_id", orgId)
          .order("atualizado_em", { ascending: false })
          .limit(Math.min(input.limite ?? 15, 50));
        if (input.busca) q = q.or(`nome.ilike.%${input.busca}%,telefone.ilike.%${input.busca}%`);
        if (input.is_qualified !== undefined) q = q.eq("is_qualified", input.is_qualified);
        if (input.is_scheduled !== undefined) q = q.eq("is_scheduled", input.is_scheduled);
        if (input.is_closed !== undefined) q = q.eq("is_closed", input.is_closed);
        if (input.origem) q = q.eq("origem", input.origem);
        if (input.dias_sem_atividade) {
          const corte = new Date(); corte.setDate(corte.getDate() - input.dias_sem_atividade);
          q = q.lt("atualizado_em", corte.toISOString());
        }
        if (input.tag) {
          const { data: tagData } = await supabase.from("tags").select("id").eq("organization_id", orgId).ilike("nome", `%${input.tag}%`).limit(1).maybeSingle();
          if (tagData) {
            const { data: ltIds } = await supabase.from("leads_tags").select("lead_id").eq("tag_id", tagData.id);
            const ids = (ltIds || []).map((r: any) => r.lead_id);
            if (ids.length > 0) q = q.in("id", ids); else return JSON.stringify({ total: 0, leads: [] });
          }
        }
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        // Batch count de mensagens (exclui mensagens de IA)
        const leadIds = (data ?? []).map((l: any) => l.id);
        let msgCountMap: Record<string, number> = {};
        if (leadIds.length > 0) {
          const { data: msgRows } = await supabase.from("mensagens")
            .select("lead_id").in("lead_id", leadIds).not("remetente", "eq", "ia");
          for (const m of msgRows ?? []) msgCountMap[m.lead_id] = (msgCountMap[m.lead_id] ?? 0) + 1;
        }
        const leadsComCount = (data ?? []).map((l: any) => ({
          ...l,
          criado_em: toHoraBRT(l.criado_em),
          atualizado_em: toHoraBRT(l.atualizado_em),
          total_mensagens: msgCountMap[l.id] ?? 0,
        }));
        return JSON.stringify({ total: leadsComCount.length, leads: leadsComCount });
      }

      case "obter_lead_completo": {
        let leadId = input.lead_id;
        if (!leadId && input.telefone) {
          const tel = input.telefone.replace(/\D/g, "");
          const { data: l } = await supabase.from("leads").select("id").eq("organization_id", orgId).ilike("telefone", `%${tel}%`).limit(1).maybeSingle();
          leadId = l?.id;
        }
        if (!leadId && input.nome) {
          const { data: l } = await supabase.from("leads").select("id").eq("organization_id", orgId).ilike("nome", `%${input.nome}%`).limit(1).maybeSingle();
          leadId = l?.id;
        }
        if (!leadId) return JSON.stringify({ error: "Lead nao encontrado" });
        const [leadRes, notasRes, etapasRes, agRes, vendasRes, tagsRes, msgsRes, cadenciasAtivasRes] = await Promise.all([
          supabase.from("leads").select("id, nome, telefone, email, origem, fonte, is_qualified, is_scheduled, is_closed, procedimento_interesse, excluir_metricas, observacoes, lead_scoring, criado_em, atualizado_em").eq("id", leadId).eq("organization_id", orgId).single(),
          supabase.from("lead_notas").select("id, conteudo, tipo, criado_em, metadados").eq("lead_id", leadId).order("criado_em", { ascending: false }).limit(10),
          supabase.from("lead_stage_history").select("stage_position, from_stage_position, entered_at").eq("lead_id", leadId).not("from_stage_position", "is", null).order("entered_at", { ascending: false }).limit(10),
          supabase.from("agendamentos").select("id, titulo, tipo, data_hora_inicio, data_hora_fim, status, descricao").eq("lead_id", leadId).order("data_hora_inicio", { ascending: false }).limit(5),
          supabase.from("vendas").select("id, produto_servico, valor_fechado, data_fechamento, forma_pagamento").eq("lead_id", leadId).order("data_fechamento", { ascending: false }).limit(5),
          supabase.from("leads_tags").select("tag:tags(nome, cor)").eq("lead_id", leadId),
          supabase.from("mensagens").select("conteudo, remetente, criado_em").eq("lead_id", leadId).not("remetente", "eq", "ia").order("criado_em", { ascending: false }).limit(30),
          supabase.from("lead_cadencias").select("cadencia_id, status, passo_atual_ordem, proxima_execucao, cadencia:cadencias(nome)").eq("lead_id", leadId).eq("status", "ativo"),
        ]);
        const todasMsgs   = msgsRes.data ?? [];
        const msgBot      = todasMsgs.filter((m: any) => m.remetente === "bot");
        const msgHumano   = todasMsgs.filter((m: any) => isHumanRemetente(m.remetente));
        const msgLead     = todasMsgs.filter((m: any) => m.remetente === "lead");
        const primeiroHumano = [...todasMsgs].reverse().find((m: any) => isHumanRemetente(m.remetente));
        const primeiroBot    = [...todasMsgs].reverse().find((m: any) => m.remetente === "bot");
        const ultimaMsg = todasMsgs[0] ?? null;
        let tempoAteHandoffMin: number | null = null;
        if (primeiroBot && primeiroHumano) {
          const diff = (new Date(primeiroHumano.criado_em).getTime() - new Date(primeiroBot.criado_em).getTime()) / 60000;
          if (diff >= 0) tempoAteHandoffMin = Math.round(diff);
        }
        const leadData = leadRes.data ? {
          ...leadRes.data,
          criado_em: toHoraBRT(leadRes.data.criado_em),
          atualizado_em: toHoraBRT(leadRes.data.atualizado_em),
        } : null;
        return JSON.stringify({
          lead: leadData,
          notas: (notasRes.data ?? []).map((n: any) => ({ ...n, criado_em: toHoraBRT(n.criado_em) })),
          historico_etapas: (etapasRes.data ?? []).map((e: any) => ({ ...e, entered_at: toHoraBRT(e.entered_at) })),
          agendamentos: (agRes.data ?? []).map((a: any) => ({ ...a, data_hora_inicio: toHoraBRT(a.data_hora_inicio) })),
          vendas: (vendasRes.data ?? []).map((v: any) => ({ ...v, data_fechamento: toHoraBRT(v.data_fechamento) })),
          tags: (tagsRes.data ?? []).map((t: any) => t.tag),
          cadencias_ativas: (cadenciasAtivasRes.data ?? []).map((c: any) => ({
            cadencia_id: c.cadencia_id, nome: c.cadencia?.nome, passo_atual: c.passo_atual_ordem,
            proxima_execucao: toHoraBRT(c.proxima_execucao),
          })),
          atendimento: {
            atendido_por: msgHumano.length > 0 ? "IA + Humano" : (msgBot.length > 0 ? "Apenas IA" : "Sem atendimento registrado"),
            mensagens_ia: msgBot.length, mensagens_humano: msgHumano.length, mensagens_lead: msgLead.length,
            handoff_ocorreu: msgHumano.length > 0, handoff_quando: toHoraBRT(primeiroHumano?.criado_em),
            tempo_ate_handoff_min: tempoAteHandoffMin,
            aguardando_resposta_humana: ultimaMsg?.remetente === "lead" && msgHumano.length === 0,
            ultima_mensagem_de: ultimaMsg?.remetente ?? null, ultima_mensagem_em: toHoraBRT(ultimaMsg?.criado_em),
          },
          ultimas_mensagens: todasMsgs.slice(0, 10).map((m: any) => ({
            conteudo: m.conteudo, remetente: m.remetente,
            tipo_remetente: m.remetente === "bot" ? "IA" : isHumanRemetente(m.remetente) ? "Humano" : "Lead",
            criado_em: toHoraBRT(m.criado_em),
          })),
          mensagens_exibidas: todasMsgs.length,
          mensagens_limite: 30,
          aviso_mensagens: todasMsgs.length >= 30
            ? "ATENÇÃO: limite de 30 mensagens atingido. Use buscar_conversas_lead(lead_id, limite=100) para obter o histórico completo antes de analisar a conversa."
            : null,
        });
      }

      case "obter_metricas_funil": {
        let period: ReturnType<typeof buildPeriod>;
        if (input.periodo_nome) {
          period = buildCalendarPeriod(input.periodo_nome);
        } else if (input.data_inicial && input.data_final) {
          period = buildPeriod({ fromStr: input.data_inicial, toStr: input.data_final });
        } else {
          const dias = input.periodo_dias ?? 30;
          period = buildPeriod(dias);
        }
        const { startDate, endDate, startDayStr, endDayStr } = period;
        const metricas = await calcularMetricasPainel(orgId, startDate, endDate, startDayStr, endDayStr, input.apenas_marketing ?? false);
        return JSON.stringify({
          periodo: { inicio: startDayStr, fim: endDayStr },
          filtro: input.apenas_marketing ? "apenas marketing" : "geral (excluindo pacientes)",
          metodologia: "Igual ao painel: MQL via lead_notas evento=mql, agendamentos via data_hora_inicio, fechamentos via data_fechamento",
          ...metricas,
          taxas_formatadas: {
            tx_mql: metricas.tx_mql + "%", tx_agendamento: metricas.tx_agendamento + "%",
            tx_fechamento: metricas.tx_fechamento + "%", tx_global: metricas.tx_global + "%",
          },
        });
      }

      case "obter_agendamentos": {
        const dias = input.periodo_dias ?? 7;
        const futuro = new Date(); futuro.setDate(futuro.getDate() + dias);
        let q = supabase.from("agendamentos")
          .select("id, titulo, tipo, data_hora_inicio, data_hora_fim, status, descricao, lead:leads(id, nome, telefone)")
          .eq("organization_id", orgId).gte("data_hora_inicio", new Date().toISOString())
          .lte("data_hora_inicio", futuro.toISOString()).order("data_hora_inicio").limit(input.limite ?? 20);
        if (input.status) q = q.eq("status", input.status);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        const agendamentosBRT = (data ?? []).map((a: any) => ({
          ...a,
          data_hora_inicio: toHoraBRT(a.data_hora_inicio),
          data_hora_fim: toHoraBRT(a.data_hora_fim),
        }));
        return JSON.stringify({ total: agendamentosBRT.length, agendamentos: agendamentosBRT });
      }

      case "obter_vendas_recentes": {
        const desde = new Date(); desde.setDate(desde.getDate() - (input.periodo_dias ?? 30));
        // FIX v10: valor_fechado (não existe coluna "valor" na tabela vendas)
        const { data, error } = await supabase.from("vendas")
          .select("id, produto_servico, valor_fechado, data_fechamento, forma_pagamento, observacoes, lead:leads(nome, telefone)")
          .eq("organization_id", orgId).gte("data_fechamento", desde.toISOString().slice(0, 10))
          .order("data_fechamento", { ascending: false }).limit(input.limite ?? 10);
        if (error) return JSON.stringify({ error: error.message });
        const total = data?.reduce((s: number, v: any) => s + (v.valor_fechado ?? 0), 0) ?? 0;
        const vendasBRT = (data ?? []).map((v: any) => ({ ...v, data_fechamento: toHoraBRT(v.data_fechamento) }));
        return JSON.stringify({ total_vendas: vendasBRT.length, total_receita: total, vendas: vendasBRT });
      }

      case "obter_metas": {
        const hoje = new Date().toISOString().slice(0, 10);
        const { startDate, endDate, startDayStr, endDayStr } = buildPeriod(30);
        const [metasRes, metricas] = await Promise.all([
          supabase.from("metas").select("*").eq("organization_id", orgId).eq("ativo", true).lte("data_inicio", hoje).gte("data_fim", hoje),
          calcularMetricasPainel(orgId, startDate, endDate, startDayStr, endDayStr, false),
        ]);
        return JSON.stringify({ metas: metasRes.data ?? [], progresso_atual_30d: metricas });
      }

      case "obter_procedimentos": {
        const { data, error } = await supabase.from("procedimentos")
          .select("id, nome, descricao, valor_base, ativo").eq("organization_id", orgId).eq("ativo", true).order("nome");
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ total: data?.length ?? 0, procedimentos: data });
      }

      case "obter_tags": {
        const { data, error } = await supabase.from("tags").select("id, nome, cor").eq("organization_id", orgId).order("nome");
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ total: data?.length ?? 0, tags: data });
      }

      case "obter_notificacoes": {
        const apenasPendentes = input.apenas_nao_lidas !== false;
        let q = supabase.from("notificacoes").select("id, tipo, titulo, mensagem, criado_em, lida")
          .eq("organization_id", orgId).order("criado_em", { ascending: false }).limit(input.limite ?? 20);
        if (apenasPendentes) q = q.eq("lida", false);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        const notifs = (data ?? []).map((n: any) => ({ ...n, criado_em: toHoraBRT(n.criado_em) }));
        return JSON.stringify({ total: notifs.length, notificacoes: notifs });
      }

      case "analisar_leads_parados": {
        const dias = input.dias_sem_atividade ?? 3;
        const corte = new Date(); corte.setDate(corte.getDate() - dias);
        let q = supabase.from("leads").select("id, nome, telefone, atualizado_em, is_qualified, is_scheduled")
          .eq("organization_id", orgId).eq("is_closed", false)
          .lt("atualizado_em", corte.toISOString()).order("atualizado_em").limit(30);
        const { data: leadsParados } = await q;
        const result = (leadsParados ?? []).map((l: any) => ({
          id: l.id, nome: l.nome, telefone: l.telefone,
          is_qualified: l.is_qualified, is_scheduled: l.is_scheduled,
          dias_parado: Math.floor((Date.now() - new Date(l.atualizado_em).getTime()) / 86400000),
          ultima_atividade: toHoraBRT(l.atualizado_em),
        }));
        return JSON.stringify({ total_parados: result.length, dias_corte: dias, leads: result });
      }

      case "analisar_ranking_procedimentos": {
        const dias = input.periodo_dias ?? 30;
        const desde = new Date(); desde.setDate(desde.getDate() - dias);
        // FIX v10: valor_fechado (não existe coluna "valor" na tabela vendas)
        const { data } = await supabase.from("vendas").select("produto_servico, valor_fechado")
          .eq("organization_id", orgId).gte("data_fechamento", desde.toISOString().slice(0, 10));
        const ranking: Record<string, { count: number; receita: number }> = {};
        data?.forEach((v: any) => {
          const p = v.produto_servico ?? "Sem nome";
          if (!ranking[p]) ranking[p] = { count: 0, receita: 0 };
          ranking[p].count++; ranking[p].receita += v.valor_fechado ?? 0;
        });
        const sorted = Object.entries(ranking)
          .map(([nome, s]) => ({ nome, volume: s.count, receita: s.receita }))
          .sort((a, b) => b.receita - a.receita);
        return JSON.stringify({ periodo_dias: dias, total_vendas: data?.length ?? 0, ranking: sorted });
      }

      case "obter_resumo_geral": {
        // Deno roda em UTC; Brasil é UTC-3 — calcular "hoje" no fuso correto
        const agora = new Date();
        const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
        const brtNow = new Date(agora.getTime() - BRT_OFFSET_MS);
        const yr = brtNow.getUTCFullYear(), mo = brtNow.getUTCMonth(), dy = brtNow.getUTCDate();
        const startDayStr = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;
        const endDayStr   = startDayStr;
        // Meia-noite BRT = 03:00 UTC; 23:59:59.999 BRT = próximo dia 02:59:59.999 UTC
        const inicioDia = new Date(Date.UTC(yr, mo, dy, 3, 0, 0, 0));
        const fimDia    = new Date(Date.UTC(yr, mo, dy + 1, 2, 59, 59, 999));
        const startDate = inicioDia.toISOString();
        const endDate   = fimDia.toISOString();
        const metricasHoje = await calcularMetricasPainel(orgId, startDate, endDate, startDayStr, endDayStr, false);
        const [agHojeRes, vendasHojeRes, notifRes, leadsQuentesRes, leadsParadosRes] = await Promise.all([
          supabase.from("agendamentos").select("id, titulo, tipo, data_hora_inicio, status, lead:leads(nome)")
            .eq("organization_id", orgId).gte("data_hora_inicio", inicioDia.toISOString()).lte("data_hora_inicio", fimDia.toISOString()),
          // FIX v10: valor_fechado (não existe coluna "valor" na tabela vendas)
          supabase.from("vendas").select("produto_servico, valor_fechado")
            .eq("organization_id", orgId).gte("data_fechamento", startDayStr).lte("data_fechamento", endDayStr),
          supabase.from("notificacoes").select("tipo, titulo").eq("organization_id", orgId).eq("lida", false).limit(5),
          supabase.from("leads").select("id, nome, telefone, is_qualified")
            .eq("organization_id", orgId).eq("is_qualified", true).eq("is_closed", false)
            .not("excluir_metricas", "eq", true).order("atualizado_em", { ascending: false }).limit(5),
          supabase.from("leads").select("id, nome, is_qualified, is_scheduled")
            .eq("organization_id", orgId).eq("is_closed", false)
            .lt("atualizado_em", new Date(Date.now() - 3 * 86400000).toISOString()).limit(5),
        ]);
        const agendamentosHoje = (agHojeRes.data ?? []).map((a: any) => ({
          ...a,
          data_hora_inicio: toHoraBRT(a.data_hora_inicio),
        }));
        return JSON.stringify({
          data_hora_brt: toHoraBRT(agora.toISOString()),
          funil_hoje: metricasHoje,
          agendamentos_hoje: agendamentosHoje,
          vendas_hoje: vendasHojeRes.data ?? [],
          receita_hoje: (vendasHojeRes.data ?? []).reduce((s: number, v: any) => s + (v.valor_fechado ?? 0), 0),
          alertas: notifRes.data ?? [],
          leads_quentes: leadsQuentesRes.data ?? [],
          leads_parados: leadsParadosRes.data ?? [],
        });
      }

      case "obter_metricas_receita": {
        const dias = input.periodo_dias ?? 30;
        const desde = new Date(); desde.setDate(desde.getDate() - dias);
        // FIX v10: valor_fechado (não existe coluna "valor" na tabela vendas)
        const { data } = await supabase.from("vendas").select("valor_fechado, data_fechamento, produto_servico")
          .eq("organization_id", orgId).gte("data_fechamento", desde.toISOString().slice(0, 10)).order("data_fechamento");
        const total = data?.reduce((s: number, v: any) => s + (v.valor_fechado ?? 0), 0) ?? 0;
        const porDia: Record<string, number> = {};
        data?.forEach((v: any) => { const d = v.data_fechamento.slice(0, 10); porDia[d] = (porDia[d] ?? 0) + (v.valor_fechado ?? 0); });
        return JSON.stringify({
          periodo_dias: dias, total_vendas: data?.length ?? 0,
          receita_total: total, ticket_medio: data?.length ? total / data.length : 0,
          projecao_mes: dias > 0 ? (total / dias) * 30 : 0,
          evolucao_diaria: porDia,
        });
      }

      case "obter_blacklist": {
        let q = supabase.from("lead_blacklist")
          .select("id, telefone, telefone_normalizado, motivo, created_at")
          .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(input.limite ?? 50);
        if (input.busca) {
          const tel = input.busca.replace(/\D/g, "");
          q = q.or(`telefone.ilike.%${input.busca}%,telefone_normalizado.ilike.%${tel}%`);
        }
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ total: data?.length ?? 0, numeros_bloqueados: data });
      }

      case "analisar_atendimento_ia": {
        const dias = input.periodo_dias ?? 30;
        const inicio = new Date(); inicio.setHours(0, 0, 0, 0); inicio.setDate(inicio.getDate() - dias);
        const { data: msgs } = await supabase.from("mensagens")
          .select("lead_id, remetente, criado_em").eq("organization_id", orgId)
          .in("remetente", ["lead", "bot", "agente", "humano", "atendente"])
          .gte("criado_em", inicio.toISOString()).order("criado_em", { ascending: true });
        if (!msgs || msgs.length === 0) {
          return JSON.stringify({ periodo_dias: dias, total_leads_com_conversa: 0, atendidos_apenas_ia: 0, com_handoff_humano: 0, taxa_handoff: "0%", tempo_medio_ate_handoff_min: null, leads_aguardando_humano: [] });
        }
        const leadMap: Record<string, { temBot: boolean; temHumano: boolean; primeiroBot: string | null; primeiroHumano: string | null; ultimaMsg: any }> = {};
        for (const m of msgs) {
          if (!leadMap[m.lead_id]) leadMap[m.lead_id] = { temBot: false, temHumano: false, primeiroBot: null, primeiroHumano: null, ultimaMsg: m };
          if (m.remetente === "bot") { leadMap[m.lead_id].temBot = true; if (!leadMap[m.lead_id].primeiroBot) leadMap[m.lead_id].primeiroBot = m.criado_em; }
          if (isHumanRemetente(m.remetente)) { leadMap[m.lead_id].temHumano = true; if (!leadMap[m.lead_id].primeiroHumano) leadMap[m.lead_id].primeiroHumano = m.criado_em; }
          leadMap[m.lead_id].ultimaMsg = m;
        }
        const ids = Object.keys(leadMap);
        const comHandoff  = ids.filter(id => leadMap[id].temHumano);
        const apenasIA    = ids.filter(id => !leadMap[id].temHumano);
        const handoffTimes: number[] = [];
        for (const id of comHandoff) {
          const { primeiroBot, primeiroHumano } = leadMap[id];
          if (primeiroBot && primeiroHumano) {
            const diff = (new Date(primeiroHumano).getTime() - new Date(primeiroBot).getTime()) / 60000;
            if (diff >= 0) handoffTimes.push(diff);
          }
        }
        const avgHandoff = handoffTimes.length > 0 ? Math.round(handoffTimes.reduce((a, b) => a + b, 0) / handoffTimes.length) : null;
        const aguardandoIds = apenasIA.filter(id => leadMap[id].ultimaMsg?.remetente === "lead");
        let leadsAguardando: any[] = [];
        if (input.incluir_aguardando !== false && aguardandoIds.length > 0) {
          const { data: ld } = await supabase.from("leads").select("id, nome, telefone").in("id", aguardandoIds.slice(0, 20));
          leadsAguardando = (ld ?? []).map((l: any) => ({
            ...l,
            ultima_mensagem_em: toHoraBRT(leadMap[l.id]?.ultimaMsg?.criado_em),
            minutos_sem_resposta: leadMap[l.id]?.ultimaMsg ? Math.round((Date.now() - new Date(leadMap[l.id].ultimaMsg.criado_em).getTime()) / 60000) : null,
          })).sort((a: any, b: any) => (b.minutos_sem_resposta ?? 0) - (a.minutos_sem_resposta ?? 0));
        }
        return JSON.stringify({
          periodo_dias: dias, total_leads_com_conversa: ids.length,
          atendidos_apenas_ia: apenasIA.length, com_handoff_humano: comHandoff.length,
          taxa_handoff: ids.length > 0 ? ((comHandoff.length / ids.length) * 100).toFixed(1) + "%" : "0%",
          tempo_medio_ate_handoff_min: avgHandoff,
          aguardando_resposta_humana: aguardandoIds.length, leads_aguardando_humano: leadsAguardando,
        });
      }

      case "criar_lead": {
        const { data, error } = await supabase.from("leads").insert({
          organization_id: orgId, nome: input.nome, telefone: input.telefone, email: input.email,
          origem: input.origem ?? "organico", fonte: input.fonte,
          procedimento_interesse: input.procedimento_interesse,
          observacoes: input.observacoes,
        }).select("id, nome, telefone").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, lead: data });
      }

      case "atualizar_lead": {
        const updates: Record<string, unknown> = {};
        ["nome","telefone","email","procedimento_interesse","origem","fonte","observacoes","is_closed","is_scheduled","lead_scoring"]
          .forEach(f => { if (input[f] !== undefined) updates[f] = input[f]; });
        if (!Object.keys(updates).length) return JSON.stringify({ error: "Nenhum campo para atualizar" });
        const { error } = await supabase.from("leads").update(updates).eq("id", input.lead_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, lead_id: input.lead_id, atualizacoes: updates });
      }

      case "qualificar_lead": {
        const { error } = await supabase.from("leads")
          .update({ is_qualified: input.is_qualified }).eq("id", input.lead_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, lead_id: input.lead_id, acao: input.is_qualified ? "marcado como MQL" : "removido do MQL" });
      }

      case "adicionar_nota": {
        const { error } = await supabase.from("lead_notas").insert({ lead_id: input.lead_id, organization_id: orgId, conteudo: input.conteudo, tipo: "os", metadados: { evento: "os" } });
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true });
      }

      case "gerenciar_tags_lead": {
        const { data: allTags } = await supabase.from("tags").select("id, nome").eq("organization_id", orgId);
        const tagMap: Record<string, string> = {};
        allTags?.forEach((t: any) => { tagMap[t.nome.toLowerCase()] = t.id; });
        if (input.adicionar_tags?.length) {
          const inserts = (input.adicionar_tags as string[]).map((n: string) => tagMap[n.toLowerCase()]).filter(Boolean).map((tag_id: string) => ({ lead_id: input.lead_id, tag_id }));
          if (inserts.length) await supabase.from("leads_tags").upsert(inserts, { onConflict: "lead_id,tag_id" });
        }
        if (input.remover_tags?.length) {
          const removeIds = (input.remover_tags as string[]).map((n: string) => tagMap[n.toLowerCase()]).filter(Boolean);
          if (removeIds.length) await supabase.from("leads_tags").delete().eq("lead_id", input.lead_id).in("tag_id", removeIds);
        }
        return JSON.stringify({ sucesso: true });
      }

      case "criar_agendamento": {
        const { data, error } = await supabase.from("agendamentos").insert({
          organization_id: orgId, lead_id: input.lead_id, titulo: input.titulo,
          tipo: input.tipo ?? "consulta", data_hora_inicio: input.data_hora_inicio,
          data_hora_fim: input.data_hora_fim, status: "agendado", descricao: input.observacoes,
        }).select("id, titulo, data_hora_inicio").single();
        if (error) return JSON.stringify({ error: error.message });
        await supabase.from("leads").update({ is_scheduled: true }).eq("id", input.lead_id).eq("organization_id", orgId);
        return JSON.stringify({ sucesso: true, agendamento: { ...data, data_hora_inicio: toHoraBRT(data?.data_hora_inicio) } });
      }

      case "registrar_venda": {
        const hoje = new Date().toISOString().slice(0, 10);
        // FIX v10: coluna correta é valor_fechado (não existe "valor" na tabela vendas)
        const { data, error } = await supabase.from("vendas").insert({
          organization_id: orgId, lead_id: input.lead_id, produto_servico: input.produto_servico,
          valor_fechado: input.valor,
          data_fechamento: input.data_fechamento ?? hoje,
          forma_pagamento: input.forma_pagamento, observacoes: input.observacoes,
        }).select("id, produto_servico, valor_fechado").single();
        if (error) return JSON.stringify({ error: error.message });
        await supabase.from("leads").update({ is_closed: true }).eq("id", input.lead_id).eq("organization_id", orgId);
        return JSON.stringify({ sucesso: true, venda: data });
      }

      case "buscar_conversas_lead": {
        const { data, error } = await supabase.from("mensagens")
          .select("id, conteudo, remetente, criado_em").eq("lead_id", input.lead_id)
          .in("remetente", ["lead", "bot", "agente", "humano", "atendente"])
          .order("criado_em", { ascending: false }).limit(Math.min(input.limite ?? 30, 50));
        if (error) return JSON.stringify({ error: error.message });
        const msgs = (data ?? []).reverse().map((m: any) => ({
          ...m,
          criado_em: toHoraBRT(m.criado_em),
          tipo_remetente: m.remetente === "bot" ? "IA" : isHumanRemetente(m.remetente) ? "Humano" : "Lead",
        }));
        const primeiroHumano = msgs.find((m: any) => isHumanRemetente(m.remetente));
        return JSON.stringify({
          total: msgs.length,
          atendimento: !primeiroHumano ? "Apenas IA (sem handoff ainda)" : "IA + Humano (handoff ocorreu)",
          handoff_em: toHoraBRT(primeiroHumano?.criado_em), mensagens: msgs,
        });
      }

      case "bloquear_numero": {
        const telNorm = normalizarTelefone(input.telefone);
        const { data: existing } = await supabase.from("lead_blacklist").select("id").eq("organization_id", orgId).eq("telefone_normalizado", telNorm).maybeSingle();
        if (existing) return JSON.stringify({ aviso: "Numero ja esta na blacklist." });
        const { error } = await supabase.from("lead_blacklist").insert({ organization_id: orgId, telefone: input.telefone, telefone_normalizado: telNorm, motivo: input.motivo });
        if (error) return JSON.stringify({ error: error.message });
        let leadsArquivados = 0;
        if (input.arquivar_lead !== false) {
          const { data: la } = await supabase.from("leads").select("id").eq("organization_id", orgId).ilike("telefone", `%${telNorm}%`);
          if (la?.length) {
            await supabase.from("leads").update({ status: "Inativo" }).in("id", la.map((l: any) => l.id));
            for (const lead of la) await supabase.from("lead_notas").insert({ lead_id: lead.id, organization_id: orgId, conteudo: "Numero bloqueado permanentemente — " + input.motivo, tipo: "sistema", metadados: { evento: "bloqueado" } });
            leadsArquivados = la.length;
          }
        }
        return JSON.stringify({ sucesso: true, telefone: input.telefone, leads_excluidos: leadsArquivados });
      }

      case "desbloquear_numero": {
        const telNorm = normalizarTelefone(input.telefone);
        const { error, count } = await supabase.from("lead_blacklist").delete({ count: "exact" }).eq("organization_id", orgId).eq("telefone_normalizado", telNorm);
        if (error) return JSON.stringify({ error: error.message });
        if (!count) return JSON.stringify({ aviso: "Numero nao estava na blacklist." });
        return JSON.stringify({ sucesso: true, telefone: input.telefone });
      }

      case "excluir_lead_permanente": {
        if (!input.confirmado) return JSON.stringify({ aguardando_confirmacao: true, aviso: "ATENCAO: irreversivel. Repita com confirmado=true." });
        let leadId = input.lead_id;
        if (!leadId && input.telefone) {
          const tel = input.telefone.replace(/\D/g, "");
          const { data: l } = await supabase.from("leads").select("id").eq("organization_id", orgId).ilike("telefone", `%${tel}%`).limit(1).maybeSingle();
          leadId = l?.id;
        }
        if (!leadId && input.nome) {
          const { data: l } = await supabase.from("leads").select("id").eq("organization_id", orgId).ilike("nome", `%${input.nome}%`).order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
          leadId = l?.id;
        }
        if (!leadId) return JSON.stringify({ error: "Lead nao encontrado. Informe lead_id, nome ou telefone." });
        const { data: lead } = await supabase.from("leads").select("id, nome, telefone").eq("id", leadId).eq("organization_id", orgId).single();
        if (!lead) return JSON.stringify({ error: "Lead nao encontrado." });
        if (input.bloquear_telefone && lead.telefone) {
          const telNorm = normalizarTelefone(lead.telefone);
          await supabase.from("lead_blacklist").upsert({ organization_id: orgId, telefone: lead.telefone, telefone_normalizado: telNorm, motivo: input.motivo ?? "Lead excluido" }, { onConflict: "organization_id,telefone_normalizado" });
        }
        await Promise.all([
          supabase.from("mensagens").delete().eq("lead_id", leadId),
          supabase.from("lead_notas").delete().eq("lead_id", leadId),
          supabase.from("leads_tags").delete().eq("lead_id", leadId),
          supabase.from("lead_stage_history").delete().eq("lead_id", leadId),
          supabase.from("lead_cadencias").delete().eq("lead_id", leadId),
          supabase.from("agendamentos").delete().eq("lead_id", leadId),
          supabase.from("vendas").delete().eq("lead_id", leadId),
        ]);
        const { error } = await supabase.from("leads").delete().eq("id", leadId).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, mensagem: "Lead " + (lead.nome ?? lead.telefone) + " excluido.", telefone_bloqueado: !!input.bloquear_telefone });
      }

      case "analisar_nao_leads": {
        // Calcula período
        const now = new Date();
        let dateFrom: string;
        let dateTo: string;
        if (input.data_inicial && input.data_final) {
          dateFrom = new Date(input.data_inicial + "T00:00:00.000Z").toISOString();
          dateTo   = new Date(input.data_final   + "T23:59:59.999Z").toISOString();
        } else {
          const dias = input.periodo_dias ?? 7;
          const from = new Date(now); from.setDate(from.getDate() - (dias - 1)); from.setHours(0, 0, 0, 0);
          dateFrom = from.toISOString();
          dateTo   = new Date(now.setHours(23, 59, 59, 999)).toISOString();
        }
        // Chama o analyze-non-leads como sub-agente especializado
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-non-leads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({ organization_id: orgId, date_from: dateFrom, date_to: dateTo }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return JSON.stringify({ error: `analyze-non-leads falhou (${res.status}): ${txt}` });
        }
        const data = await res.json();
        return JSON.stringify({
          total_analisados: data.total_analyzed ?? 0,
          nao_leads: data.non_leads ?? [],
          leads_ok: data.ok_leads ?? [],
          instrucao: "Apresente a lista de nao_leads ao usuario com nome, telefone, motivo e confianca. Pergunte quais ele quer excluir e use excluir_lote com os IDs confirmados.",
        });
      }

      case "excluir_lote": {
        const ids: string[] = input.lead_ids ?? [];
        if (ids.length === 0) return JSON.stringify({ error: "Nenhum ID fornecido." });
        // Busca telefones para blacklist
        const { data: leadsData } = await supabase.from("leads").select("id, nome, telefone").in("id", ids).eq("organization_id", orgId);
        const phones = (leadsData ?? []).map((l: any) => l.telefone).filter(Boolean);
        // Deleta relacionamentos em paralelo
        await Promise.all([
          supabase.from("mensagens").delete().in("lead_id", ids),
          supabase.from("lead_notas").delete().in("lead_id", ids),
          supabase.from("leads_tags").delete().in("lead_id", ids),
          supabase.from("lead_stage_history").delete().in("lead_id", ids),
          supabase.from("lead_cadencias").delete().in("lead_id", ids),
          supabase.from("agendamentos").delete().in("lead_id", ids),
          supabase.from("vendas").delete().in("lead_id", ids),
        ]);
        // Deleta os leads
        const { error } = await supabase.from("leads").delete().in("id", ids).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        // Blacklist
        if (input.bloquear_telefones !== false && phones.length > 0) {
          const rows = phones.map((tel: string) => ({
            organization_id: orgId,
            telefone_normalizado: tel.replace(/\D/g, ""),
            motivo: input.motivo ?? "Excluido via analise de nao-leads",
          }));
          await supabase.from("lead_blacklist").upsert(rows, { onConflict: "organization_id,telefone_normalizado", ignoreDuplicates: true });
        }
        return JSON.stringify({ sucesso: true, excluidos: ids.length, telefones_bloqueados: phones.length });
      }

      case "enviar_mensagem": {
        const { data: lead } = await supabase.from("leads")
          .select("id, nome, telefone").eq("id", input.lead_id).eq("organization_id", orgId).maybeSingle();
        if (!lead?.telefone) return JSON.stringify({ error: "Lead nao encontrado ou sem telefone cadastrado." });
        const { data: conn } = await supabase.from("whatsapp_connections")
          .select("uazapi_url, uazapi_token").eq("organization_id", orgId).eq("status", "connected").maybeSingle();
        if (!conn?.uazapi_url) return JSON.stringify({ error: "WhatsApp nao conectado para esta clinica." });
        const telDigits = lead.telefone.replace(/\D/g, "");
        const phone = telDigits.startsWith("55") && telDigits.length >= 12 ? telDigits : `55${telDigits}`;
        const uazapiUrl = conn.uazapi_url.replace(/\/$/, "");
        const res = await fetch(`${uazapiUrl}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json", "token": conn.uazapi_token },
          body: JSON.stringify({ number: phone, text: input.mensagem }),
        });
        if (!res.ok) return JSON.stringify({ error: `Erro UAZAPI ao enviar: ${res.status}` });
        await supabase.from("mensagens").insert({
          lead_id: input.lead_id, organization_id: orgId,
          conteudo: input.mensagem, direcao: "saida",
          remetente: "agente", tipo_conteudo: "texto",
        });
        return JSON.stringify({ sucesso: true, mensagem_enviada: input.mensagem, destinatario: lead.nome ?? lead.telefone });
      }

      case "listar_cadencias": {
        const { data, error } = await supabase.from("cadencias")
          .select("id, nome, descricao, passos:cadencia_passos(id)")
          .eq("organization_id", orgId).order("criado_em", { ascending: false });
        if (error) return JSON.stringify({ error: error.message });
        const cadencias = (data ?? []).map((c: any) => ({
          id: c.id, nome: c.nome, descricao: c.descricao,
          total_passos: (c.passos ?? []).length,
        }));
        const resultado = input.apenas_com_passos ? cadencias.filter((c: any) => c.total_passos > 0) : cadencias;
        return JSON.stringify({ total: resultado.length, cadencias: resultado });
      }

      case "disparar_cadencia": {
        const { data: firstStep } = await supabase.from("cadencia_passos")
          .select("tempo_espera, unidade_tempo").eq("cadencia_id", input.cadencia_id)
          .order("posicao_ordem", { ascending: true }).limit(1).maybeSingle();
        if (!firstStep) return JSON.stringify({ error: "Cadencia nao encontrada ou sem passos configurados." });
        const { data: lead } = await supabase.from("leads")
          .select("id, nome").eq("id", input.lead_id).eq("organization_id", orgId).maybeSingle();
        if (!lead) return JSON.stringify({ error: "Lead nao encontrado." });
        let execDate = new Date();
        if (firstStep.unidade_tempo === "minutos") execDate = new Date(execDate.getTime() + firstStep.tempo_espera * 60000);
        else if (firstStep.unidade_tempo === "horas") execDate = new Date(execDate.getTime() + firstStep.tempo_espera * 3600000);
        else execDate = new Date(execDate.getTime() + firstStep.tempo_espera * 86400000);
        const { error } = await supabase.from("lead_cadencias").upsert({
          organization_id: orgId, lead_id: input.lead_id, cadencia_id: input.cadencia_id,
          passo_atual_ordem: 0, status: "ativo", proxima_execucao: execDate.toISOString(),
        }, { onConflict: "lead_id,cadencia_id" });
        if (error) return JSON.stringify({ error: error.message });
        const { data: cad } = await supabase.from("cadencias").select("nome").eq("id", input.cadencia_id).maybeSingle();
        return JSON.stringify({
          sucesso: true, lead: lead.nome, cadencia: cad?.nome ?? input.cadencia_id,
          proxima_execucao: execDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        });
      }

      // ── CADÊNCIAS — CRUD ─────────────────────────────────────────────────────

      case "obter_cadencia_detalhes": {
        const { data, error } = await supabase
          .from("cadencias")
          .select("id, nome, descricao, criado_em, atualizado_em, cadencia_passos(id, posicao_ordem, tempo_espera, unidade_tempo, tipo_mensagem, conteudo)")
          .eq("id", input.cadencia_id)
          .eq("organization_id", orgId)
          .maybeSingle();
        if (error) return JSON.stringify({ error: error.message });
        if (!data) return JSON.stringify({ error: "Cadência não encontrada." });
        const cadencia = { ...data, cadencia_passos: (data.cadencia_passos ?? []).sort((a: any, b: any) => a.posicao_ordem - b.posicao_ordem) };
        return JSON.stringify(cadencia);
      }

      case "criar_cadencia": {
        const { data: cad, error: cadErr } = await supabase
          .from("cadencias")
          .insert({ organization_id: orgId, nome: input.nome, descricao: input.descricao ?? null, atualizado_em: new Date().toISOString() })
          .select("id")
          .single();
        if (cadErr) return JSON.stringify({ error: cadErr.message });
        const cadenciaId = (cad as any).id;
        const passos = input.passos ?? [];
        if (passos.length > 0) {
          const rows = passos.map((p: any, i: number) => ({
            cadencia_id: cadenciaId,
            posicao_ordem: i + 1,
            tempo_espera: p.tempo_espera,
            unidade_tempo: p.unidade_tempo,
            tipo_mensagem: "texto",
            conteudo: p.conteudo,
          }));
          const { error: passosErr } = await supabase.from("cadencia_passos").insert(rows);
          if (passosErr) return JSON.stringify({ error: passosErr.message, cadencia_id: cadenciaId });
        }
        return JSON.stringify({ sucesso: true, cadencia_id: cadenciaId, nome: input.nome, total_passos: passos.length });
      }

      case "atualizar_cadencia": {
        const updates: Record<string, any> = { atualizado_em: new Date().toISOString() };
        if (input.nome !== undefined) updates.nome = input.nome;
        if (input.descricao !== undefined) updates.descricao = input.descricao;
        if (Object.keys(updates).length === 1) return JSON.stringify({ error: "Nenhum campo para atualizar." });
        const { error } = await supabase.from("cadencias").update(updates).eq("id", input.cadencia_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, cadencia_id: input.cadencia_id });
      }

      case "excluir_cadencia": {
        const { data: cad } = await supabase.from("cadencias").select("nome").eq("id", input.cadencia_id).eq("organization_id", orgId).maybeSingle();
        if (!cad) return JSON.stringify({ error: "Cadência não encontrada." });
        const { error } = await supabase.from("cadencias").delete().eq("id", input.cadencia_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, cadencia_excluida: (cad as any).nome });
      }

      // ── PLATAFORMA — Materiais Complementares ─────────────────────────────────

      case "listar_materiais_complementares": {
        const { data: folders, error: fErr } = await (supabase as any)
          .from("platform_complementary_folders")
          .select("id, nome, parent_id, ordem_index, platform_complementary_materials(id, titulo, tipo, pdf_url, ordem_index)")
          .eq("ativo", true)
          .order("ordem_index");
        if (fErr) return JSON.stringify({ error: fErr.message });
        const raiz = (folders ?? []).filter((f: any) => !f.parent_id).map((f: any) => ({
          ...f,
          subpastas: (folders ?? []).filter((s: any) => s.parent_id === f.id),
          materiais: (f.platform_complementary_materials ?? []).filter((m: any) => m).sort((a: any, b: any) => a.ordem_index - b.ordem_index),
        }));
        return JSON.stringify({ total_pastas: raiz.length, pastas: raiz });
      }

      case "ler_material_complementar": {
        const { data, error } = await (supabase as any)
          .from("platform_complementary_materials")
          .select("id, titulo, tipo, conteudo_html, pdf_url")
          .eq("id", input.material_id)
          .single();
        if (error) return JSON.stringify({ error: error.message });
        if (!data) return JSON.stringify({ error: "Material não encontrado." });
        if (data.tipo === "pdf") return JSON.stringify({ titulo: data.titulo, tipo: "pdf", pdf_url: data.pdf_url, aviso: "PDFs não são legíveis diretamente — apenas a URL está disponível." });
        return JSON.stringify({ titulo: data.titulo, tipo: "html", conteudo_html: data.conteudo_html ?? "" });
      }

      // ── PLATAFORMA — Jornada ──────────────────────────────────────────────────

      case "obter_minha_jornada": {
        const { data: jornada, error } = await (supabase as any)
          .from("jornadas")
          .select(`
            id, titulo, status, gerada_por, created_at, updated_at,
            jornada_estagios (
              id, titulo, descricao, ordem, prazo_dias, data_inicio,
              jornada_passos ( id, titulo, descricao, ordem, tipo, obrigatorio, concluido, concluido_em, prazo_dias )
            )
          `)
          .eq("user_id", platformUserId)
          .in("status", ["ativa", "concluida"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) return JSON.stringify({ error: error.message });
        if (!jornada) return JSON.stringify({ jornada: null, mensagem: "Nenhuma jornada ativa encontrada para este usuario." });
        const estagios = (jornada.jornada_estagios ?? [])
          .sort((a: any, b: any) => a.ordem - b.ordem)
          .map((e: any) => ({ ...e, jornada_passos: (e.jornada_passos ?? []).sort((a: any, b: any) => a.ordem - b.ordem) }));
        const allPassos = estagios.flatMap((e: any) => e.jornada_passos ?? []);
        const total = allPassos.length;
        const done = allPassos.filter((p: any) => p.concluido).length;
        return JSON.stringify({
          jornada: { ...jornada, jornada_estagios: estagios },
          progresso: { total_passos: total, concluidos: done, percentual: total > 0 ? Math.round((done / total) * 100) : 0 },
        });
      }

      case "marcar_passo_jornada": {
        const { error } = await (supabase as any)
          .from("jornada_passos")
          .update({
            concluido: input.concluido,
            concluido_em: input.concluido ? new Date().toISOString() : null,
            concluido_por: input.concluido ? platformUserId : null,
          })
          .eq("id", input.passo_id);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, passo_id: input.passo_id, concluido: input.concluido });
      }

      // ── PLATAFORMA — Arsenal ──────────────────────────────────────────────────

      case "listar_arsenal": {
        const { data: categorias, error: catErr } = await (supabase as any)
          .from("arsenal_categorias")
          .select("id, nome, descricao, frase_ancora, icone, slug, ordem")
          .order("ordem");
        if (catErr) return JSON.stringify({ error: catErr.message });
        let ferramentas: any[] = [];
        if (input.categoria_slug) {
          const cat = (categorias ?? []).find((c: any) => c.slug === input.categoria_slug);
          if (cat) {
            let q = (supabase as any).from("arsenal_ferramentas").select("id, nome, descricao, slug, ordem, video_url").eq("categoria_id", cat.id).eq("ativo", true).order("ordem");
            if (input.busca) q = q.ilike("nome", `%${input.busca}%`);
            const { data } = await q;
            ferramentas = data ?? [];
          }
        } else {
          let q = (supabase as any).from("arsenal_ferramentas").select("id, nome, descricao, slug, categoria_id, ordem").eq("ativo", true).order("ordem");
          if (input.busca) q = q.ilike("nome", `%${input.busca}%`);
          const { data } = await q;
          ferramentas = data ?? [];
        }
        return JSON.stringify({
          total_categorias: (categorias ?? []).length,
          categorias: categorias ?? [],
          total_ferramentas: ferramentas.length,
          ferramentas,
        });
      }

      case "obter_arsenal_ferramenta": {
        if (!input.ferramenta_id && !input.ferramenta_slug) return JSON.stringify({ error: "Forneca ferramenta_id ou ferramenta_slug." });
        let q = (supabase as any).from("arsenal_ferramentas").select("*, arsenal_categorias(nome, slug)");
        if (input.ferramenta_id) q = q.eq("id", input.ferramenta_id);
        else q = q.eq("slug", input.ferramenta_slug);
        const { data, error } = await q.maybeSingle();
        if (error) return JSON.stringify({ error: error.message });
        if (!data) return JSON.stringify({ error: "Ferramenta nao encontrada." });
        return JSON.stringify({ ferramenta: data });
      }

      // ── PLATAFORMA — Meus Materiais ───────────────────────────────────────────

      case "listar_meus_materiais": {
        let q = (supabase as any)
          .from("meus_materiais")
          .select("id, titulo, conteudo, categoria_arsenal_id, ferramenta_id, criado_manualmente, created_at, updated_at, arsenal_categorias(nome, slug), arsenal_ferramentas(nome)")
          .eq("user_id", platformUserId)
          .order("updated_at", { ascending: false })
          .limit(Math.min(input.limite ?? 30, 100));
        if (input.busca) q = q.ilike("titulo", `%${input.busca}%`);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ total: (data ?? []).length, materiais: data ?? [] });
      }

      case "criar_material": {
        const { data, error } = await (supabase as any)
          .from("meus_materiais")
          .insert({
            user_id: platformUserId,
            titulo: input.titulo,
            conteudo: input.conteudo,
            categoria_arsenal_id: input.categoria_arsenal_id ?? null,
            ferramenta_id: input.ferramenta_id ?? null,
            criado_manualmente: true,
          })
          .select("id, titulo, created_at")
          .single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, material: data });
      }

      case "atualizar_material": {
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (input.titulo !== undefined) updates.titulo = input.titulo;
        if (input.conteudo !== undefined) updates.conteudo = input.conteudo;
        if (input.ferramenta_id !== undefined) updates.ferramenta_id = input.ferramenta_id;
        if (input.categoria_arsenal_id !== undefined) updates.categoria_arsenal_id = input.categoria_arsenal_id;
        if (Object.keys(updates).length === 1) return JSON.stringify({ error: "Nenhum campo para atualizar." });
        const { error } = await (supabase as any)
          .from("meus_materiais")
          .update(updates)
          .eq("id", input.material_id)
          .eq("user_id", platformUserId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, material_id: input.material_id, campos_atualizados: Object.keys(updates).filter(k => k !== "updated_at") });
      }

      case "excluir_material": {
        const { error } = await (supabase as any)
          .from("meus_materiais")
          .delete()
          .eq("id", input.material_id)
          .eq("user_id", platformUserId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, material_id: input.material_id });
      }

      case "atualizar_progresso_arsenal": {
        const { error } = await (supabase as any)
          .from("arsenal_progresso")
          .upsert(
            { user_id: platformUserId, ferramenta_id: input.ferramenta_id, status: input.status },
            { onConflict: "user_id,ferramenta_id" }
          );
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, ferramenta_id: input.ferramenta_id, status: input.status });
      }

      case "salvar_construcao_ferramenta": {
        // Busca ferramenta para obter nome (para título padrão)
        const { data: ferr } = await (supabase as any)
          .from("arsenal_ferramentas")
          .select("id, nome, categoria_id")
          .eq("id", input.ferramenta_id)
          .maybeSingle();
        const titulo = input.titulo ?? (ferr?.nome ? `Construção — ${ferr.nome}` : "Construção");

        // Verifica se já existe material vinculado a esta ferramenta para este user
        const { data: existing } = await (supabase as any)
          .from("meus_materiais")
          .select("id")
          .eq("user_id", platformUserId)
          .eq("ferramenta_id", input.ferramenta_id)
          .maybeSingle();

        let result: any;
        if (existing?.id) {
          const { data, error } = await (supabase as any)
            .from("meus_materiais")
            .update({ titulo, conteudo: input.conteudo, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .eq("user_id", platformUserId)
            .select("id, titulo")
            .single();
          if (error) return JSON.stringify({ error: error.message });
          result = { acao: "atualizado", material: data };
        } else {
          const { data, error } = await (supabase as any)
            .from("meus_materiais")
            .insert({
              user_id: platformUserId,
              titulo,
              conteudo: input.conteudo,
              ferramenta_id: input.ferramenta_id,
              categoria_arsenal_id: ferr?.categoria_id ?? null,
              criado_manualmente: false,
            })
            .select("id, titulo")
            .single();
          if (error) return JSON.stringify({ error: error.message });
          result = { acao: "criado", material: data };
        }

        // Marca ferramenta como em andamento se ainda não estava concluída
        await (supabase as any)
          .from("arsenal_progresso")
          .upsert(
            { user_id: platformUserId, ferramenta_id: input.ferramenta_id, status: "em_andamento" },
            { onConflict: "user_id,ferramenta_id", ignoreDuplicates: true }
          );

        return JSON.stringify({ sucesso: true, ...result });
      }

      case "atualizar_agendamento": {
        const updates: Record<string, any> = {};
        if (input.titulo !== undefined) updates.titulo = input.titulo;
        if (input.tipo !== undefined) updates.tipo = input.tipo;
        if (input.data_hora_inicio !== undefined) updates.data_hora_inicio = input.data_hora_inicio;
        if (input.data_hora_fim !== undefined) updates.data_hora_fim = input.data_hora_fim;
        if (input.status !== undefined) updates.status = input.status;
        if (input.observacoes !== undefined) updates.descricao = input.observacoes;
        if (Object.keys(updates).length === 0) return JSON.stringify({ error: "Nenhum campo para atualizar." });
        const { data, error } = await supabase.from("agendamentos")
          .update(updates).eq("id", input.agendamento_id).eq("organization_id", orgId)
          .select("id, titulo, status, data_hora_inicio").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, agendamento: { ...data, data_hora_inicio: toHoraBRT(data?.data_hora_inicio) } });
      }

      case "excluir_agendamento": {
        if (!input.confirmado) return JSON.stringify({ error: "Requer confirmado=true." });
        const { error } = await supabase.from("agendamentos")
          .delete().eq("id", input.agendamento_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, mensagem: "Agendamento excluído permanentemente." });
      }

      case "atualizar_venda": {
        const updates: Record<string, any> = {};
        if (input.produto_servico !== undefined) updates.produto_servico = input.produto_servico;
        if (input.valor !== undefined) updates.valor_fechado = input.valor;
        if (input.data_fechamento !== undefined) updates.data_fechamento = input.data_fechamento;
        if (input.forma_pagamento !== undefined) updates.forma_pagamento = input.forma_pagamento;
        if (input.observacoes !== undefined) updates.observacoes = input.observacoes;
        if (Object.keys(updates).length === 0) return JSON.stringify({ error: "Nenhum campo para atualizar." });
        const { data, error } = await supabase.from("vendas")
          .update(updates).eq("id", input.venda_id).eq("organization_id", orgId)
          .select("id, produto_servico, valor_fechado, data_fechamento").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, venda: data });
      }

      case "excluir_venda": {
        if (!input.confirmado) return JSON.stringify({ error: "Requer confirmado=true." });
        const { data: venda } = await supabase.from("vendas").select("lead_id")
          .eq("id", input.venda_id).eq("organization_id", orgId).single();
        const { error } = await supabase.from("vendas")
          .delete().eq("id", input.venda_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        if (venda?.lead_id) {
          const { count } = await supabase.from("vendas").select("id", { count: "exact", head: true })
            .eq("lead_id", venda.lead_id);
          if ((count ?? 0) === 0) {
            await supabase.from("leads").update({ is_closed: false }).eq("id", venda.lead_id);
          }
        }
        return JSON.stringify({ sucesso: true, mensagem: "Venda excluída permanentemente." });
      }

      case "marcar_notificacao_lida": {
        if (input.todas) {
          await supabase.from("notificacoes").update({ lida: true }).eq("organization_id", orgId).eq("lida", false);
          return JSON.stringify({ sucesso: true, mensagem: "Todas as notificações marcadas como lidas." });
        }
        if (!input.notificacao_id) return JSON.stringify({ error: "Informe notificacao_id ou todas=true." });
        const { error } = await supabase.from("notificacoes").update({ lida: true })
          .eq("id", input.notificacao_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true });
      }

      case "criar_tag": {
        const { data, error } = await supabase.from("tags").insert({
          organization_id: orgId, nome: input.nome, cor: input.cor ?? "#6B7280",
        }).select("id, nome, cor").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, tag: data });
      }

      case "excluir_tag": {
        let tagId = input.tag_id;
        if (!tagId && input.nome) {
          const { data: t } = await supabase.from("tags").select("id")
            .eq("organization_id", orgId).ilike("nome", input.nome).maybeSingle();
          tagId = t?.id;
        }
        if (!tagId) return JSON.stringify({ error: "Tag não encontrada." });
        const { error } = await supabase.from("tags").delete().eq("id", tagId).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, mensagem: "Tag excluída e removida de todos os leads." });
      }

      case "criar_meta": {
        const { data, error } = await supabase.from("metas").insert({
          organization_id: orgId,
          nome: input.nome,
          periodo_tipo: input.periodo_tipo ?? "mes",
          data_inicio: input.data_inicio,
          data_fim: input.data_fim,
          meta_receita: input.meta_receita,
          ticket_medio: input.ticket_medio ?? 0,
          tx_mql: input.tx_mql ?? 100,
          tx_agendamento: input.tx_agendamento ?? 50,
          tx_conversao: input.tx_conversao ?? 25,
          cpl_meta: input.cpl_meta ?? 0,
        }).select("id, nome, meta_receita").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, meta: data });
      }

      case "atualizar_meta": {
        const updates: Record<string, any> = {};
        ["nome","meta_receita","ticket_medio","tx_mql","tx_agendamento","tx_conversao","cpl_meta","data_inicio","data_fim"]
          .forEach(f => { if (input[f] !== undefined) updates[f] = input[f]; });
        if (!Object.keys(updates).length) return JSON.stringify({ error: "Nenhum campo para atualizar." });
        const { error } = await supabase.from("metas").update(updates).eq("id", input.meta_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true });
      }

      case "excluir_meta": {
        if (!input.confirmado) return JSON.stringify({ error: "Requer confirmado=true." });
        const { error } = await supabase.from("metas").delete().eq("id", input.meta_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, mensagem: "Meta excluída." });
      }

      case "cancelar_cadencia_lead": {
        let q = supabase.from("lead_cadencias")
          .update({ status: "cancelado" })
          .eq("lead_id", input.lead_id)
          .eq("organization_id", orgId)
          .eq("status", "ativo");
        if (input.cadencia_id) q = q.eq("cadencia_id", input.cadencia_id) as any;
        const { error, count } = await (q as any);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, cadencias_canceladas: count ?? 1 });
      }

      case "criar_procedimento": {
        const { data, error } = await supabase.from("procedimentos").insert({
          organization_id: orgId,
          nome: input.nome,
          categoria: input.categoria ?? null,
          descricao: input.descricao ?? null,
          valor_base: input.valor_base ?? null,
          duracao_minutos: input.duracao_minutos ?? null,
          ativo: true,
        }).select("id, nome, valor_base").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, procedimento: data });
      }

      case "atualizar_procedimento": {
        const updates: Record<string, any> = {};
        if (input.nome !== undefined) updates.nome = input.nome;
        if (input.categoria !== undefined) updates.categoria = input.categoria;
        if (input.descricao !== undefined) updates.descricao = input.descricao;
        if (input.valor_base !== undefined) updates.valor_base = input.valor_base;
        if (input.duracao_minutos !== undefined) updates.duracao_minutos = input.duracao_minutos;
        if (input.ativo !== undefined) updates.ativo = input.ativo;
        if (Object.keys(updates).length === 0) return JSON.stringify({ error: "Nenhum campo para atualizar." });
        const { data, error } = await supabase.from("procedimentos")
          .update(updates).eq("id", input.procedimento_id).eq("organization_id", orgId)
          .select("id, nome, valor_base, ativo").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, procedimento: data });
      }

      case "excluir_procedimento": {
        if (!input.confirmado) return JSON.stringify({ error: "Requer confirmado=true." });
        const { error } = await supabase.from("procedimentos")
          .delete().eq("id", input.procedimento_id).eq("organization_id", orgId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, mensagem: "Procedimento excluído." });
      }

      case "editar_nota": {
        const { error } = await supabase.from("lead_notas")
          .update({ conteudo: input.conteudo })
          .eq("id", input.nota_id).eq("organization_id", orgId).in("tipo", ["manual", "os"]);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true });
      }

      case "excluir_nota": {
        const { error } = await supabase.from("lead_notas")
          .delete().eq("id", input.nota_id).eq("organization_id", orgId).in("tipo", ["manual", "os"]);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ sucesso: true, mensagem: "Nota excluída." });
      }

      case "criar_jornada": {
        // Busca ferramentas e aulas do arsenal para vincular por slug
        const [{ data: ferramentas }, { data: aulas }] = await Promise.all([
          (supabase as any).from("arsenal_ferramentas").select("id, slug").eq("ativo", true),
          (supabase as any).from("arsenal_aulas").select("id, slug").eq("ativo", true),
        ]);
        const slugMap = new Map<string, string>(
          (ferramentas ?? []).map((f: any) => [f.slug, f.id])
        );
        const aulaSlugMap = new Map<string, string>(
          (aulas ?? []).map((a: any) => [a.slug, a.id])
        );

        const { data: jornadaCriada, error: errJ } = await (supabase as any)
          .from("jornadas")
          .insert({ user_id: platformUserId, titulo: input.titulo, status: "ativa", gerada_por: "ia" })
          .select("id")
          .single();
        if (errJ || !jornadaCriada) return JSON.stringify({ error: errJ?.message ?? "Erro ao criar jornada" });

        const hoje = new Date();
        let cursorDias = 0;
        let totalPassos = 0;
        const estagiosResult: any[] = [];

        for (const [idx, est] of (input.estagios ?? []).entries()) {
          const dataInicio = new Date(hoje);
          dataInicio.setDate(dataInicio.getDate() + cursorDias);
          const prazoDias = est.prazo_dias ?? 7;
          cursorDias += prazoDias + 1;

          const { data: estagio, error: errE } = await (supabase as any)
            .from("jornada_estagios")
            .insert({
              jornada_id: jornadaCriada.id,
              titulo: est.titulo,
              descricao: est.descricao ?? null,
              ordem: idx,
              prazo_dias: prazoDias,
              data_inicio: dataInicio.toISOString().slice(0, 10),
            })
            .select("id")
            .single();
          if (errE || !estagio) continue;

          const passos = est.passos ?? [];
          for (const [pi, passo] of passos.entries()) {
            const rawSlug = passo.ferramenta_slug ?? null;
            // 'aula' é alias para 'ferramenta_arsenal' — normaliza aqui
            const rawTipo: string = passo.tipo ?? "acao_livre";
            const isAulaOuFerramenta = rawTipo === "ferramenta_arsenal" || rawTipo === "aula";
            const normalizedTipo = rawTipo === "aula" ? "ferramenta_arsenal" : rawTipo;

            const ferramentaId =
              isAulaOuFerramenta && rawSlug
                ? (slugMap.get(rawSlug) ?? null)
                : null;
            const aulaId =
              isAulaOuFerramenta && rawSlug && !ferramentaId
                ? (aulaSlugMap.get(rawSlug) ?? null)
                : null;
            await (supabase as any).from("jornada_passos").insert({
              estagio_id: estagio.id,
              titulo: passo.titulo,
              descricao: passo.descricao ?? null,
              ordem: pi,
              tipo: normalizedTipo,
              ferramenta_id: ferramentaId,
              aula_id: aulaId,
              prazo_dias: passo.prazo_dias ?? null,
              obrigatorio: passo.obrigatorio ?? true,
            });
            totalPassos++;
          }

          estagiosResult.push({ titulo: est.titulo, total_passos: passos.length });
        }

        // Marca onboarding_concluido no platform_users
        await supabase.from("platform_users").update({ onboarding_concluido: true }).eq("id", platformUserId);

        return JSON.stringify({
          sucesso: true,
          jornada_id: jornadaCriada.id,
          titulo: input.titulo,
          total_estagios: estagiosResult.length,
          total_passos: totalPassos,
          estagios: estagiosResult,
        });
      }

      case "obter_config_ia": {
        // Lê o override de prompt base desta org (se existir) e o global como fallback
        const [orgOverrideRes, globalRes, orgConfigRes] = await Promise.all([
          supabase.from("system_ai_config")
            .select("valor, atualizado_em")
            .eq("chave", "prompt_base_agente")
            .eq("organization_id", orgId)
            .maybeSingle(),
          supabase.from("system_ai_config")
            .select("valor")
            .eq("chave", "prompt_base_agente")
            .is("organization_id", null)
            .maybeSingle(),
          supabase.from("organization_ai_prompts")
            .select("prompt, ia_ativa, modelo_ia, horario_atendimento, formas_pagamento, contraindicacoes, palavras_proibidas")
            .eq("organization_id", orgId)
            .maybeSingle(),
        ]);

        const temOverride = !!orgOverrideRes.data?.valor;
        const promptBase = temOverride
          ? orgOverrideRes.data!.valor
          : (globalRes.data?.valor ?? "(não configurado)");

        return JSON.stringify({
          prompt_base: {
            origem: temOverride ? "override_desta_org" : "global_plataforma",
            conteudo: promptBase,
            ultima_alteracao: temOverride ? toHoraBRT(orgOverrideRes.data?.atualizado_em) : null,
            aviso: temOverride
              ? "Esta org tem um prompt base próprio. Alterações via atualizar_prompt_base_ia só afetam esta org."
              : "Esta org usa o prompt base global da plataforma. Use atualizar_prompt_base_ia para criar um override exclusivo.",
          },
          instrucoes_especificas_org: (orgConfigRes.data?.prompt ?? "").trim() || "(não configurado)",
          configuracoes_org: {
            ia_ativa: orgConfigRes.data?.ia_ativa ?? false,
            modelo_ia: orgConfigRes.data?.modelo_ia ?? "não configurado",
            horario_atendimento: orgConfigRes.data?.horario_atendimento ?? null,
            formas_pagamento: orgConfigRes.data?.formas_pagamento ?? null,
            contraindicacoes: orgConfigRes.data?.contraindicacoes ?? null,
            palavras_proibidas: orgConfigRes.data?.palavras_proibidas ?? [],
          },
        });
      }

      case "atualizar_prompt_base_ia": {
        if (!input.prompt_base?.trim()) {
          return JSON.stringify({ error: "prompt_base não pode ser vazio." });
        }

        const novoValor = input.prompt_base.trim();

        // Verifica se já existe override para esta org
        const { data: existing } = await supabase.from("system_ai_config")
          .select("id")
          .eq("chave", "prompt_base_agente")
          .eq("organization_id", orgId)
          .maybeSingle();

        let erro: any = null;
        let acao: string;

        if (existing?.id) {
          // Atualiza o override existente (trigger atualiza atualizado_em automaticamente)
          const { error } = await supabase.from("system_ai_config")
            .update({ valor: novoValor })
            .eq("id", existing.id);
          erro = error;
          acao = "atualizado";
        } else {
          // Cria novo override exclusivo para esta org
          const { error } = await supabase.from("system_ai_config")
            .insert({ chave: "prompt_base_agente", organization_id: orgId, valor: novoValor });
          erro = error;
          acao = "criado";
        }

        if (erro) return JSON.stringify({ error: erro.message });

        return JSON.stringify({
          sucesso: true,
          acao,
          mensagem: "Prompt base da IA " + (acao === "criado" ? "criado com override exclusivo" : "atualizado") + " para esta clínica. A próxima mensagem recebida já usará o novo prompt (cache de 5 min no agente).",
          motivo: input.motivo ?? null,
          chars: novoValor.length,
        });
      }

      case "configurar_dados_clinica_ia": {
        // Lê procedimentos ativos do CRM (sem preços)
        const { data: procsData } = await supabase
          .from("procedimentos")
          .select("nome")
          .eq("organization_id", orgId)
          .eq("ativo", true)
          .order("nome", { ascending: true });

        // Monta mapa de descrições fornecidas pelo Athos
        const descMap = new Map<string, string>();
        for (const d of (input.descricoes_procedimentos ?? [])) {
          if (d.nome) descMap.set(d.nome.toLowerCase().trim(), d.descricao ?? "");
        }

        const procedimentosLinhas = (procsData ?? []).map((p: any) => {
          const descExtra = descMap.get(p.nome.toLowerCase().trim()) || "";
          return descExtra ? `- ${p.nome}: ${descExtra}` : `- ${p.nome}`;
        });

        const faqBlocos = (input.faq ?? []).map((f: any) =>
          `**Pergunta:** ${f.pergunta}\n**Resposta:** ${f.resposta}`
        );

        const callTarget = input.quem_chamar ?? "equipe";
        const callPersonName = callTarget !== "equipe" ? (input.nome_pessoa_chamada ?? "") : "";

        const promptMarkdown = [
          "## IDENTIDADE DO AGENTE",
          `Nome do agente: ${input.nome_agente}`,
          `Nome da clínica: ${input.nome_clinica}`,
          `Nome do profissional: ${input.nome_profissional}`,
          `Especialidade: ${input.especialidade}`,
          "",
          "## EMOJIS",
          `A IA deve usar emojis?: ${input.usar_emojis ? "Sim" : "Não"}`,
          `Emojis permitidos: ${input.usar_emojis ? (input.emojis_permitidos ?? "") : ""}`,
          "",
          "## FORMA DE CHAMADA",
          `Quem a IA deve chamar?: ${callTarget}`,
          `Nome da pessoa: ${callPersonName}`,
          "",
          "## TOM DE VOZ E PERSONALIDADE",
          input.tom_de_voz ?? "",
          "",
          "## PROCEDIMENTOS OFERECIDOS",
          procedimentosLinhas.join("\n"),
          "",
          "## FAQ",
          faqBlocos.join("\n"),
          "",
          "## REDES SOCIAIS E CONTATO",
          `Instagram: ${input.instagram ?? ""}`,
          `Endereço: ${input.endereco ?? ""}`,
          "",
          "## INSTRUÇÕES PONTUAIS",
          input.instrucoes_pontuais ?? "",
        ].join("\n").trim();

        // Verifica se já existe config para preservar horário, formas de pagamento, etc.
        const { data: existingConfig } = await supabase
          .from("organization_ai_prompts")
          .select("id")
          .eq("organization_id", orgId)
          .maybeSingle();

        let erroConfig: any = null;
        let acaoConfig: string;

        // Monta payload com campos opcionais
        const extraPayload: Record<string, unknown> = {};
        if (input.horario_atendimento && typeof input.horario_atendimento === "object") {
          extraPayload.horario_atendimento = input.horario_atendimento;
        }
        if (input.formas_pagamento && typeof input.formas_pagamento === "object") {
          extraPayload.formas_pagamento = input.formas_pagamento;
        }
        if (typeof input.contraindicacoes === "string") {
          extraPayload.contraindicacoes = input.contraindicacoes;
        }
        if (Array.isArray(input.palavras_proibidas)) {
          extraPayload.palavras_proibidas = input.palavras_proibidas;
        }
        if (typeof input.ia_ativa === "boolean") {
          extraPayload.ia_ativa = input.ia_ativa;
        }

        if (existingConfig?.id) {
          const { error } = await supabase
            .from("organization_ai_prompts")
            .update({ prompt: promptMarkdown, updated_at: new Date().toISOString(), ...extraPayload })
            .eq("id", existingConfig.id);
          erroConfig = error;
          acaoConfig = "atualizado";
        } else {
          const { error } = await supabase
            .from("organization_ai_prompts")
            .insert({ organization_id: orgId, prompt: promptMarkdown, ia_ativa: false, ...extraPayload });
          erroConfig = error;
          acaoConfig = "criado";
        }

        if (erroConfig) return JSON.stringify({ error: erroConfig.message });

        return JSON.stringify({
          sucesso: true,
          acao: acaoConfig,
          mensagem: `Dados da clínica ${acaoConfig === "criado" ? "configurados" : "atualizados"} com sucesso. A IA de pré-atendimento já usará as novas informações.${acaoConfig === "criado" ? " A IA foi criada com status INATIVA — ative-a no CRM em Configurações > Inteligência Artificial." : ""}`,
          procedimentos_importados: (procsData ?? []).length,
          horario_salvo: !!input.horario_atendimento,
          pagamento_salvo: !!input.formas_pagamento,
          resumo: {
            nome_agente: input.nome_agente,
            nome_clinica: input.nome_clinica,
            procedimentos: (procsData ?? []).length,
            faq: (input.faq ?? []).length,
            horario: input.horario_atendimento ? `${input.horario_atendimento.weekday_open ?? "?"}–${input.horario_atendimento.weekday_close ?? "?"}` : "não informado",
            pagamentos: input.formas_pagamento
              ? Object.entries(input.formas_pagamento).filter(([k, v]) => v === true).map(([k]) => k).join(", ") || "nenhum"
              : "não informado",
          },
        });
      }

      default:
        return JSON.stringify({ error: "Ferramenta desconhecida: " + name });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

// ── Processamento de anexos (imagem, áudio, documento) ──────────────────────

interface Attachment {
  name: string;
  mimeType: string;
  base64: string;
}

// Modelo de visão: GPT-4o-mini é rápido (~2-3s por imagem), suporta visão e tem latência previsível via OpenRouter
const VISION_MODEL = "openai/gpt-4o-mini";
// Timeout máximo por anexo — se exceder, retorna mensagem de erro e não bloqueia os demais
const ATTACHMENT_TIMEOUT_MS = 20_000;

async function _processAttachmentCore(att: Attachment): Promise<string> {
  const { name, mimeType, base64 } = att;

  // Texto puro — decodifica direto (sem chamada LLM)
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    try {
      const text = atob(base64);
      return `[Conteúdo do arquivo "${name}"]:\n${text}\n[Fim do arquivo]`;
    } catch {
      return `[Erro ao ler arquivo "${name}"]`;
    }
  }

  // Imagens
  if (mimeType.startsWith("image/")) {
    const resp = await (openrouter.chat.completions.create as any)({
      model: VISION_MODEL,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: "Analise esta imagem detalhadamente. Descreva todo o conteúdo visível: textos, números, nomes, tabelas, gráficos e qualquer informação relevante. Seja preciso e completo. Responda em português." },
      ]}],
      max_tokens: 1500,
    });
    const desc = resp.choices[0]?.message?.content ?? "Não foi possível analisar a imagem.";
    return `[Análise da imagem "${name}"]:\n${desc}\n[Fim da análise]`;
  }

  // Áudio
  if (mimeType.startsWith("audio/")) {
    const resp = await (openrouter.chat.completions.create as any)({
      model: VISION_MODEL,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: "Transcreva todo o conteúdo deste áudio com precisão. Se houver múltiplos falantes, identifique-os. Responda em português." },
      ]}],
      max_tokens: 2000,
    });
    const transcription = resp.choices[0]?.message?.content ?? "Não foi possível transcrever o áudio.";
    return `[Transcrição do áudio "${name}"]:\n${transcription}\n[Fim da transcrição]`;
  }

  // PDF e documentos
  if (mimeType === "application/pdf" || mimeType.includes("document") || mimeType.includes("msword") || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    const resp = await (openrouter.chat.completions.create as any)({
      model: VISION_MODEL,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: "Extraia e transcreva todo o conteúdo deste documento. Preserve a estrutura, textos, tabelas, listas e qualquer informação relevante. Responda em português." },
      ]}],
      max_tokens: 2000,
    });
    const content = resp.choices[0]?.message?.content ?? "Não foi possível ler o documento.";
    return `[Conteúdo do documento "${name}"]:\n${content}\n[Fim do documento]`;
  }

  return `[Arquivo "${name}" (${mimeType}) — tipo não suportado para análise automática]`;
}

async function processAttachment(att: Attachment): Promise<string> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ATTACHMENT_TIMEOUT_MS)
  );
  try {
    return await Promise.race([_processAttachmentCore(att), timeout]);
  } catch (e) {
    const reason = e instanceof Error && e.message === "timeout"
      ? "tempo esgotado (>20s)"
      : (e instanceof Error ? e.message : String(e));
    return `[Anexo "${att.name}" — análise indisponível: ${reason}]`;
  }
}

async function processAttachments(attachments: Attachment[]): Promise<string> {
  if (!attachments?.length) return "";
  // Paralelo com timeout individual — se uma imagem falhar/demorar, as demais continuam
  const results = await Promise.all(attachments.map(processAttachment));
  return "\n\n" + results.join("\n\n");
}

// ── Correção de acentuação (post-processing independente de modelo) ───────────
// Necessário porque modelos como DeepSeek omitem acentos/cedilhas em PT-BR
// mesmo com instruções explícitas no system prompt.

const ACCENT_PAIRS: Array<[string, string]> = [
  // Pronomes
  ["voce","você"],["voces","vocês"],
  ["proprio","próprio"],["propria","própria"],["proprios","próprios"],["proprias","próprias"],
  // Palavras funcionais
  ["nao","não"],["tambem","também"],["entao","então"],
  ["porem","porém"],["alem","além"],["ate","até"],["apos","após"],["atraves","através"],
  ["ja","já"],["ha","há"],["so","só"],
  // Verbos
  ["estao","estão"],["sao","são"],
  ["sera","será"],["serao","serão"],["tera","terá"],["terao","terão"],
  ["havera","haverá"],["poderao","poderão"],["devera","deverá"],
  // Adjetivos — sem ambiguidade no contexto de CRM/clínica
  ["proximo","próximo"],["proxima","próxima"],["proximos","próximos"],["proximas","próximas"],
  ["viavel","viável"],["viaveis","viáveis"],
  ["otimo","ótimo"],["otima","ótima"],["otimos","ótimos"],["otimas","ótimas"],
  ["ultimo","último"],["ultima","última"],["ultimos","últimos"],["ultimas","últimas"],
  ["rapido","rápido"],["rapida","rápida"],["rapidos","rápidos"],["rapidas","rápidas"],
  ["facil","fácil"],["faceis","fáceis"],
  ["agil","ágil"],["ageis","ágeis"],["fragil","frágil"],
  ["util","útil"],["uteis","úteis"],
  ["valido","válido"],["valida","válida"],["validos","válidos"],["validas","válidas"],
  ["unico","único"],["unica","única"],["unicos","únicos"],["unicas","únicas"],
  ["logico","lógico"],["logica","lógica"],["logicos","lógicos"],
  ["basico","básico"],["basica","básica"],
  ["tipico","típico"],["tipica","típica"],
  ["pratico","prático"],["pratica","prática"],
  ["critico","crítico"],["critica","crítica"],
  ["publico","público"],["publica","pública"],
  ["especifico","específico"],["especifica","específica"],
  ["automatico","automático"],["automatica","automática"],
  ["estrategico","estratégico"],["estrategica","estratégica"],
  // Substantivos de CRM/saúde
  ["horario","horário"],["horarios","horários"],
  ["periodo","período"],["periodos","períodos"],
  ["nivel","nível"],["niveis","níveis"],
  ["analise","análise"],["analises","análises"],
  ["medico","médico"],["medicos","médicos"],["medica","médica"],["medicas","médicas"],
  ["clinica","clínica"],["clinicas","clínicas"],["clinico","clínico"],
  ["consultorio","consultório"],["consultorios","consultórios"],
  ["diagnostico","diagnóstico"],["diagnosticos","diagnósticos"],
  ["cirurgiao","cirurgião"],["cirurgioes","cirurgiões"],
  ["orcamento","orçamento"],["orcamentos","orçamentos"],
  ["preco","preço"],["precos","preços"],
  ["servico","serviço"],["servicos","serviços"],
  ["espaco","espaço"],["espacos","espaços"],
  ["numero","número"],["numeros","números"],
  ["indice","índice"],["indices","índices"],
  ["titulo","título"],["titulos","títulos"],
  ["topico","tópico"],["topicos","tópicos"],
  ["modulo","módulo"],["modulos","módulos"],
  ["metodo","método"],["metodos","métodos"],
  ["maximo","máximo"],["maxima","máxima"],["maximos","máximos"],
  ["minimo","mínimo"],["minima","mínima"],["minimos","mínimos"],
  ["negocio","negócio"],["negocios","negócios"],
  ["comercio","comércio"],["comercios","comércios"],
  ["recepcao","recepção"],["atencao","atenção"],
  ["posicao","posição"],["posicoes","posições"],
  ["sessao","sessão"],["sessoes","sessões"],
  ["funcao","função"],["funcoes","funções"],
  ["versao","versão"],["versoes","versões"],
  ["operacao","operação"],["operacoes","operações"],
  ["execucao","execução"],["configuracao","configuração"],
  ["integracao","integração"],["atualizacao","atualização"],
  ["progressao","progressão"],["avaliacao","avaliação"],["avaliacao","avaliação"],
  // Progressão estratégica
  ["estrategia","estratégia"],["estrategias","estratégias"],
  ["proposta","proposta"],// already correct
  ["objecao","objeção"],["objecoes","objeções"],
  // Palavras frequentemente sem acento no DeepSeek
  ["medio","médio"],["media","média"],["medios","médios"],["medias","médias"],
  ["catalogo","catálogo"],["catalogos","catálogos"],
  ["trafego","tráfego"],
  ["metrica","métrica"],["metricas","métricas"],
  ["estetico","estético"],["estetica","estética"],["esteticos","estéticos"],
  ["historico","histórico"],["historica","histórica"],["historicos","históricos"],
  ["periodico","periódico"],["periodicos","periódicos"],
  ["demografico","demográfico"],["demografica","demográfica"],
  ["geografico","geográfico"],["geografica","geográfica"],
  ["tecnologico","tecnológico"],["tecnologica","tecnológica"],
  ["pedagogico","pedagógico"],["pedagogica","pedagógica"],
  ["especifico","específico"],["especifica","específica"], // duplicata harmless
  ["patrimonio","patrimônio"],["patrimonios","patrimônios"],
  ["autonomo","autônomo"],["autonoma","autônoma"],
  ["cronograma","cronograma"],// already correct
  ["agencia","agência"],["agencias","agências"],
  ["eficacia","eficácia"],["eficiencia","eficiência"],
  ["tendencia","tendência"],["tendencias","tendências"],
  ["experiencia","experiência"],["experiencias","experiências"],
  ["audiencia","audiência"],["audiencias","audiências"],
  ["frequencia","frequência"],["frequencias","frequências"],
  ["deficiencia","deficiência"],["deficiencias","deficiências"],
  ["residencia","residência"],["residencias","residências"],
  ["referencia","referência"],["referencias","referências"],
  ["influencia","influência"],["influencias","influências"],
  ["competencia","competência"],["competencias","competências"],
  ["urgencia","urgência"],["urgencias","urgências"],
  ["pesquisa","pesquisa"],// already correct
  ["grafico","gráfico"],["graficos","gráficos"],["grafica","gráfica"],
  ["simbolo","símbolo"],["simbolos","símbolos"],
  ["fenomeno","fenômeno"],["fenomenos","fenômenos"],
];

function corrigirAcentos(text: string): string {
  if (!text) return text;
  let r = text;
  for (const [from, to] of ACCENT_PAIRS) {
    r = r.replace(new RegExp(`\\b${from}\\b`, "gi"), (m) =>
      /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(m) ? to.charAt(0).toUpperCase() + to.slice(1) : to
    );
  }
  // Sufixo genérico: -cao → -ção (com 2+ chars antes, para não transformar "cao" = cão)
  r = r.replace(/\b([a-záéíóúâêôãõç]{2,})cao\b/gi, (m, p) => {
    const c = p + "ção";
    return /^[A-Z]/.test(m) ? c.charAt(0).toUpperCase() + c.slice(1) : c;
  });
  // Sufixo genérico: -coes → -ções
  r = r.replace(/\b([a-záéíóúâêôãõç]{2,})coes\b/gi, (m, p) => {
    const c = p + "ções";
    return /^[A-Z]/.test(m) ? c.charAt(0).toUpperCase() + c.slice(1) : c;
  });
  return r;
}

function corrigirAcentosObjeto(val: unknown): unknown {
  if (typeof val === "string") return corrigirAcentos(val);
  if (Array.isArray(val)) return val.map(corrigirAcentosObjeto);
  if (val !== null && typeof val === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) res[k] = corrigirAcentosObjeto(v);
    return res;
  }
  return val;
}

// ── System prompt ────────────────────────────────────────────────────────────

// Cache em memória (persiste enquanto a instância da Edge Function vive — ~5 min)
const _promptCache = new Map<string, { prompt: string; expiresAt: number }>();

async function buildSystemPrompt(orgId: string, platformUserId: string): Promise<string> {
  const cacheKey = `${orgId}:${platformUserId}`;
  const cached = _promptCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.prompt;

  const [puRes, procsRes, orgRes, diagRes] = await Promise.all([
    supabase.from("platform_users").select("clinic_name, specialty, whatsapp").eq("id", platformUserId).maybeSingle(),
    supabase.from("procedimentos").select("nome, valor_base").eq("organization_id", orgId).eq("ativo", true).limit(10),
    supabase.from("organizations").select("nome").eq("id", orgId).maybeSingle(),
    supabase.from("meus_materiais" as any).select("conteudo, titulo").eq("user_id", platformUserId).eq("categoria", "diagnostico").maybeSingle(),
  ]);

  const pu   = puRes.data;
  const org  = orgRes.data;
  const diag = (diagRes as any).data;

  const nomeClinica = pu?.clinic_name || org?.nome || "Não informado";
  const especialidade = pu?.specialty || "Não informada";

  const procs  = procsRes.data  ?? [];

  const dataAtual = new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Sao_Paulo" });
  const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  const clinicaInfo = [
    "Nome: " + nomeClinica,
    "Especialidade: " + especialidade,
  ].filter(Boolean).join("\n");

  const procsInfo = procs.length > 0
    ? procs.map((p: any) => "  - " + p.nome + (p.valor_base ? " (R$ " + p.valor_base + ")" : "")).join("\n")
    : "  Nenhum procedimento";

  const prompt = [
    "Você é o Athos GS — inteligência estratégica desta clínica.",
    "Todos os dados que você consulta pertencem EXCLUSIVAMENTE a esta clínica.",
    "",
    "REGRA 1: Zero emojis nas respostas, exceto ao simular mensagens WhatsApp para o usuário.",
    "REGRA 2: Nunca use 'Agente' para o humano — use 'atendente', 'você' ou 'o profissional'.",
    "REGRA 3 — ABSOLUTA: NUNCA crie seção 'Linha do Tempo', 'Histórico de Mensagens', 'Conversa' ou qualquer tabela/lista com as mensagens em ordem cronológica. O usuário já conhece a conversa. Ao analisar atendimento: vá direto para Diagnóstico → Pontos de Melhoria → Ações. Nenhuma reprodução de mensagens, jamais.",
    "",
    "DATA: " + dataAtual + " | HORA: " + horaAtual,
    "",
    "## CLÍNICA",
    clinicaInfo,
    "",
    "## FUNIL COMERCIAL (use ESTE para toda análise e diagnóstico)",
    "O funil real da clínica tem 4 marcos — use SEMPRE estes para análise, comparativo, taxa de conversão e diagnóstico:",
    "  1. LEADS — leads criados no período (origem marketing quando relevante)",
    "  2. MQLs — leads qualificados (is_qualified=true / evento 'mql' em lead_notas)",
    "  3. AGENDAMENTOS — agendamentos realizados (tabela agendamentos)",
    "  4. FECHAMENTOS — vendas registradas (tabela vendas)",
    "Taxas: tx_mql = MQL/Leads | tx_agendamento = Agend/MQL | tx_fechamento = Fech/Agend",
    "Quando analisar performance, comparar períodos, ou fazer diagnóstico comercial: use SEMPRE o funil acima.",
    "",
    "## PROCEDIMENTOS",
    procsInfo,
    "",
    "Qualificação: apenas MQL (binário).",
    "Remetentes: 'bot'=IA | 'agente'/'humano'/'atendente'=humano | 'lead'=cliente.",
    "",
    "## MÉTRICAS (idênticas ao painel — modelo por EVENTO, não estado atual)",
    "Leads no período: criado OU mudou etapa OU qualificado MQL OU agendamento OU venda — no período.",
    "Excluídos: excluir_metricas=true, fonte='importado', origem='paciente'.",
    "MQL=lead_notas sistema evento='mql' | AGENDAMENTOS=agendamentos.data_hora_inicio | FECHAMENTOS=vendas.data_fechamento",
    "Taxas: tx_mql=MQL/Leads | tx_agendamento=Agend/MQL | tx_fechamento=Fech/Agend",
    "",
    "## PERÍODOS",
    "periodo_nome ('hoje'/'semana'/'mes'/'ano') = calendário atual igual ao painel. 'semana'=domingo–sábado corrente.",
    "Períodos passados: data_inicial+data_final (YYYY-MM-DD). 'Últimos X dias': periodo_dias=X.",
    "",
    "## MATERIAIS: HTML obrigatório (TipTap). Use <h2>/<h3>, <p>, <strong>, <ul><li>, <ol><li>, <hr>. Nunca texto plano.",
    "",
    "## ROTEAMENTO DE FERRAMENTAS — SIGA RIGOROSAMENTE",
    "Antes de responder qualquer pedido, identifique a intenção e chame a ferramenta correta. NUNCA responda com dados inventados — sempre busque primeiro.",
    "",
    "### Consultas sobre LEADS",
    "- 'Quantos leads?', 'lista de leads', filtrar leads → buscar_leads",
    "- 'Me fala do lead X', 'detalhes do lead', 'histórico de X', análise de lead específico → obter_lead_completo (aceita nome, telefone ou lead_id)",
    "- 'Leads parados', 'leads sem atividade' → analisar_leads_parados",
    "- 'Contatos que não são leads', 'spam', 'limpeza' → analisar_nao_leads",
    "",
    "### Consultas sobre CONVERSAS e MENSAGENS",
    "- 'O que o lead falou?', 'conversa do lead', 'mensagens de X', 'analisa a conversa', 'o que foi conversado' → buscar_conversas_lead (precisa de lead_id — use obter_lead_completo antes se só tiver nome/telefone)",
    "- REGRA AUTOMÁTICA: se obter_lead_completo retornar aviso_mensagens não-nulo (mensagens_exibidas >= 30), chame IMEDIATAMENTE buscar_conversas_lead(lead_id, limite=100) antes de analisar qualquer coisa da conversa. Não mencione isso ao usuário — apenas execute.",
    "- 'Envia mensagem para X' → obter_lead_completo(nome/telefone) → enviar_mensagem(lead_id, mensagem)",
    "",
    "### Consultas sobre MÉTRICAS e FUNIL",
    "- 'Como está o funil?', 'métricas', 'taxa de conversão', 'quantos MQLs?' → obter_metricas_funil",
    "- 'Resumo do dia', 'como está hoje?', 'overview' → obter_resumo_geral",
    "- 'Receita', 'faturamento', 'ticket médio' → obter_metricas_receita",
    "- 'Ranking de procedimentos', 'mais vendidos' → analisar_ranking_procedimentos",
    "- 'Análise da IA', 'como está o atendimento automático?', 'handoffs' → analisar_atendimento_ia",
    "",
    "### Ações sobre LEADS",
    "- 'Cria um lead' → criar_lead",
    "- 'Atualiza o lead X' → obter_lead_completo → atualizar_lead",
    "- 'Qualifica o lead X', 'marca como MQL' → obter_lead_completo → qualificar_lead",
    "- 'Adiciona nota no lead X' → obter_lead_completo → adicionar_nota",
    "- 'Tags do lead X' → obter_lead_completo → gerenciar_tags_lead",
    "- 'Exclui o lead X' → obter_lead_completo → excluir_lead_permanente (SEMPRE confirmar antes)",
    "- 'Exclui esses leads' → excluir_lote (SEMPRE confirmar antes)",
    "- 'Bloqueia o número' → bloquear_numero | 'Desbloqueia' → desbloquear_numero",
    "",
    "### AGENDAMENTOS",
    "- 'Próximos agendamentos', 'agenda' → obter_agendamentos",
    "- 'Cria agendamento para X' → obter_lead_completo → criar_agendamento",
    "- 'Remarcar/cancelar agendamento' → atualizar_agendamento",
    "- 'Excluir agendamento' → excluir_agendamento (confirmar antes)",
    "",
    "### VENDAS",
    "- 'Vendas recentes', 'últimas vendas' → obter_vendas_recentes",
    "- 'Registra venda para X' → obter_lead_completo → registrar_venda",
    "- 'Atualiza a venda' → atualizar_venda",
    "- 'Exclui venda' → excluir_venda (confirmar antes)",
    "",
    "### CADÊNCIAS",
    "- 'Lista cadências' → listar_cadencias",
    "- 'Detalhes da cadência X' → obter_cadencia_detalhes",
    "- 'Cria cadência' → criar_cadencia",
    "- 'Dispara cadência para X' → obter_lead_completo → listar_cadencias → disparar_cadencia",
    "- 'Cancela cadência do lead X' → cancelar_cadencia_lead",
    "",
    "### METAS, TAGS, PROCEDIMENTOS, NOTIFICAÇÕES",
    "- 'Metas', 'progresso das metas' → obter_metas",
    "- 'Criar meta' → criar_meta | 'Atualizar meta' → atualizar_meta | 'Excluir meta' → excluir_meta",
    "- 'Tags disponíveis' → obter_tags | 'Criar tag' → criar_tag | 'Excluir tag' → excluir_tag",
    "- 'Procedimentos cadastrados' → obter_procedimentos | 'Criar procedimento' → criar_procedimento",
    "- 'Notificações' → obter_notificacoes | 'Marcar como lida' → marcar_notificacao_lida",
    "- 'Blacklist', 'números bloqueados' → obter_blacklist",
    "",
    "### IA de PRÉ-ATENDIMENTO",
    "- 'Como está a IA?', 'configuração da IA', 'prompt da IA' → obter_config_ia",
    "- 'Altera o prompt da IA', 'muda o prompt base' → obter_config_ia (ler antes) → atualizar_prompt_base_ia",
    "- 'Configura a clínica na IA', 'nome do agente', 'horário', 'pagamento' → obter_config_ia → configurar_dados_clinica_ia",
    "",
    "### PLATAFORMA (Jornada, Arsenal, Materiais)",
    "- 'Minha jornada', 'progresso da jornada' → obter_minha_jornada",
    "- 'Marca passo como concluído' → marcar_passo_jornada",
    "- 'Ferramentas do Arsenal', 'categorias' → listar_arsenal",
    "- 'Detalhe da ferramenta X' → obter_arsenal_ferramenta",
    "- 'Materiais complementares' → listar_materiais_complementares | 'Ler material X' → ler_material_complementar",
    "- 'Meus materiais' → listar_meus_materiais | 'Criar material' → criar_material",
    "- 'Criar jornada' → criar_jornada",
    "",
    "### REGRA DE ENCADEAMENTO",
    "Quando o usuário menciona um lead por NOME ou TELEFONE (não por ID), SEMPRE chame obter_lead_completo primeiro para resolver o lead_id, depois chame a ferramenta de ação.",
    "Exemplo: 'Envia mensagem pro João' → obter_lead_completo(nome='João') → enviar_mensagem(lead_id=resultado, mensagem=...)",
    "Exemplo: 'Analisa a conversa da Maria' → obter_lead_completo(nome='Maria') → buscar_conversas_lead(lead_id=resultado)",
    "",
    "## COMPORTAMENTO",
    "Antes de consulta ampla sem período definido, PERGUNTE: 'De qual período? Esta semana, este mês, últimos 30 dias?'",
    "Pedido genérico (ex: 'diagnóstico'): pergunte o foco — funil, atendimento ou receita?",
    "Pedido específico (ex: 'vendas deste mês'): execute direto.",
    "",
    "## FORMATAÇÃO (obrigatório em todas as respostas)",
    "- Use markdown SEMPRE: `##` para seções principais, `###` para subseções, `**texto**` para negrito, `-` para listas, `1.` para passos sequenciais",
    "- Nunca responda em texto corrido sem estrutura — toda resposta com mais de 2 frases deve ter títulos e listas",
    "- Planos de ação: sempre use `## Diagnóstico`, `## Passos` com `### Passo 1:` etc., `## Próxima Ação`",
    "- Análises e rankings: sempre use `##` para o título e `-` ou tabela para os itens",
    "- Mensagens curtas (sim/não, confirmações) podem ser texto simples — tudo mais DEVE ser formatado",
    "- Zero emojis em qualquer situação",
    "",
    "## REGRAS",
    "- Busque dados antes de afirmar números — nunca invente",
    "- Antes de excluir, peça confirmação explícita",
    "- Direto e estratégico — diagnósticos + ações concretas",
    "- Use 'clínica', nunca 'organização'",
    "- NUNCA reproduza a linha do tempo da conversa nem liste as mensagens em sequência cronológica. O usuário já conhece o conteúdo. Ao analisar um atendimento ou conversa, vá direto para o diagnóstico, pontos de melhoria e ações — sem transcrever ou resumir o histórico de mensagens.",
    ...(diag?.conteudo ? [
      "",
      "## DIAGNÓSTICO ESTRATÉGICO DO CLIENTE (base de conhecimento permanente)",
      "Este documento foi preenchido pelo próprio cliente no onboarding e contém informações detalhadas sobre a clínica, operação, desafios e objetivos. Use como base para qualquer análise, recomendação ou diagnóstico.",
      diag.conteudo,
    ] : []),
  ].join("\n");

  _promptCache.set(cacheKey, { prompt, expiresAt: Date.now() + 5 * 60 * 1000 });
  return prompt;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Nao autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Token invalido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = await resolveAdminCaller(user.id);
  if (!admin) return new Response(JSON.stringify({ error: "Acesso restrito: apenas superadmins da org master." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const masterOrgId = admin.masterOrgId;

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Body invalido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
  const { message, conversation_id, history = [], model: requestedModel, attachments = [], target_org_id } = body;
  // Org em foco: cliente travado no seletor (target_org_id) ou nenhum (modo global)
  let effectiveOrgId: string | null = (target_org_id && typeof target_org_id === "string") ? target_org_id : null;
  let focoNome: string | null = null;
  if (effectiveOrgId) {
    const c = (await listarClientesBase()).find(x => x.organization_id === effectiveOrgId);
    focoNome = c?.nome ?? null;
  }
  const model = (requestedModel && typeof requestedModel === "string" && requestedModel.trim()) ? requestedModel.trim() : DEFAULT_MODEL;
  if (!message?.trim() && !attachments?.length) return new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => { try { controller.enqueue(encoder.encode("data: " + JSON.stringify(data) + "\n\n")); } catch { /**/ } };
      // Timeout global absoluto — fecha o stream à força após 120s independente do que estiver acontecendo
      const GLOBAL_TIMEOUT_MS = 120_000;
      const globalTimeout = setTimeout(() => {
        console.error("[descompliquei-os] GLOBAL TIMEOUT atingido — forçando encerramento do stream");
        try { send({ type: "error", message: "Tempo limite excedido (120s). A IA demorou demais para responder. Tente novamente." }); } catch { /**/ }
        try { controller.close(); } catch { /**/ }
      }, GLOBAL_TIMEOUT_MS);
      try {
        const resolvedSystemPrompt = buildAdminSystemPrompt(focoNome);

        if (attachments?.length) {
          send({ type: "processing_attachments", count: attachments.length });
        }
        const [systemPrompt, attachmentContext] = await Promise.all([
          Promise.resolve(resolvedSystemPrompt),
          processAttachments(attachments),
        ]);
        if (attachments?.length) {
          send({ type: "attachments_done" });
        }
        const userContent = [message?.trim(), attachmentContext, "\n[LEMBRETE: (1) Zero emojis. (2) Nunca use 'Agente' para o humano — use 'atendente' ou 'você'. (3) Escreva SEMPRE em português correto com todos os acentos — médio, catálogo, período, gráfico, etc. Nunca omita acentuação.]"].filter(Boolean).join("\n\n");
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...history.slice(-10).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: userContent },
        ];
        let finalText = "";
        const toolCallsForSave: any[] = [];
        let iteration = 0;
        const startMs = Date.now();
        let lastCompletionUsage: any = null;

        // Chamada buffered (sem streaming) — mais confiável no Deno Deploy para tool calls.
        // O hard timeout de 120s no FRONTEND é a rede de segurança final.
        // Aqui, AbortController + Promise.race garante cancelamento em 90s.
        const LLM_TIMEOUT_MS = 90_000;
        const callLLM = async (params: any) => {
          let heartbeatActive = true;
          const heartbeatInterval = setInterval(() => {
            if (heartbeatActive) {
              try { send({ type: "heartbeat" }); } catch { /**/ }
            }
          }, 3000);
          const abortCtrl = new AbortController();
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          try {
            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                abortCtrl.abort();
                reject(new Error("Tempo esgotado aguardando resposta da IA (>90s). Tente novamente."));
              }, LLM_TIMEOUT_MS);
            });
            const callPromise = openrouter.chat.completions.create(
              params,
              { signal: abortCtrl.signal },
            ) as Promise<any>;
            const result = await Promise.race([callPromise, timeoutPromise]);
            return result;
          } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
            heartbeatActive = false;
            clearInterval(heartbeatInterval);
          }
        };

        // Parâmetros base da chamada LLM — admin: read tools (escopadas no cliente em foco) + tools cross-org
        const ADMIN_LLM_TOOLS = [...TOOLS.filter(t => ADMIN_READ_TOOLS.has(t.function.name)), ...ADMIN_TOOLS];
        const baseLLMParams: any = {
          model,
          messages,
          tools: ADMIN_LLM_TOOLS,
          tool_choice: "auto",
          // Limite generoso para respostas longas estruturadas (análises, relatórios).
          // Continuação automática cobre o caso de a saída atingir o teto.
          max_tokens: 16384,
          temperature: 0.7,
        };
        // Desativa thinking estendido APENAS em modelos específicos onde travamentos foram observados.
        // Atenção: desabilitar thinking em modelos errados causa respostas truncadas (modelo para cedo).
        // Mantemos a lista mínima e específica.
        const THINKING_DISABLED_MODELS = new Set<string>([
          "google/gemini-3.5-flash",
        ]);
        if (THINKING_DISABLED_MODELS.has(model)) {
          baseLLMParams.thinking = { type: "disabled" };
        }

        // Limite de continuações por truncamento (finish_reason="length") — separado de tool iterations.
        const MAX_LENGTH_CONTINUATIONS = 4;
        let lengthContinuations = 0;
        while (iteration < MAX_TOOL_ITERATIONS) {
          iteration++;
          console.log(`[descompliquei-os] LLM call #${iteration} starting — model: ${model}, messages: ${messages.length}`);
          const llmStartMs = Date.now();
          const completion = await callLLM({ ...baseLLMParams, messages });
          const finishReason = completion.choices?.[0]?.finish_reason;
          console.log(`[descompliquei-os] LLM call #${iteration} completed in ${Date.now() - llmStartMs}ms — finish_reason: ${finishReason}`);
          lastCompletionUsage = completion.usage ?? null;
          const choice = completion.choices[0];
          const assistantMsg = choice.message;
          if (finishReason === "tool_calls" && assistantMsg.tool_calls?.length) {
            messages.push(assistantMsg as OpenAI.Chat.ChatCompletionMessageParam);
            const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
            for (const tc of assistantMsg.tool_calls) {
              let input: any = {};
              try { input = JSON.parse(tc.function.arguments); } catch { /**/ }
              input = corrigirAcentosObjeto(input);
              send({ type: "tool_start", tool: tc.function.name, input });
              let result: string;
              if (ADMIN_GLOBAL_TOOLS.has(tc.function.name)) {
                result = await executeAdminTool(tc.function.name, input);
                // focar_cliente redireciona todas as tools de dados subsequentes
                if (tc.function.name === "focar_cliente") {
                  try { const r = JSON.parse(result); if (r?.ok && r.org_id) { effectiveOrgId = r.org_id; focoNome = r.cliente ?? focoNome; } } catch { /**/ }
                }
              } else if (ADMIN_READ_TOOLS.has(tc.function.name)) {
                // Tool de dados do cliente — exige um cliente em foco (read-only)
                if (!effectiveOrgId) {
                  result = JSON.stringify({ erro: "Nenhum cliente em foco. Chame focar_cliente com o nome do cliente antes de consultar dados detalhados, ou use as ferramentas globais (listar_clientes, ranking_clientes, comparar_clientes, obter_visao_geral_plataforma)." });
                } else {
                  result = await executeTool(tc.function.name, input, effectiveOrgId, user.id);
                }
              } else {
                // Defesa em profundidade: qualquer tool fora da allowlist é bloqueada
                result = JSON.stringify({ erro: "Ferramenta indisponível no modo administrativo (Athos admin é somente leitura)." });
              }
              let parsedResult: any;
              try { parsedResult = JSON.parse(result); } catch { parsedResult = result; }
              toolCallsForSave.push({ name: tc.function.name, input, result: parsedResult });
              send({ type: "tool_result", tool: tc.function.name, result: parsedResult });
              toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
            }
            messages.push(...toolResults);
          } else if (finishReason === "length" && lengthContinuations < MAX_LENGTH_CONTINUATIONS) {
            // Resposta truncada por max_tokens — acumula o parcial e pede continuação.
            // Sem isso, a UI recebia respostas cortadas no meio de uma palavra.
            const partial = assistantMsg.content ?? "";
            finalText += partial;
            lengthContinuations++;
            console.log(`[descompliquei-os] finish_reason=length — pedindo continuação #${lengthContinuations} (parcial: ${partial.length} chars)`);
            messages.push({ role: "assistant", content: partial });
            messages.push({
              role: "user",
              content: "Continue exatamente de onde parou. Não repita nada do texto anterior, não recapitule, não diga 'continuando'. Apenas siga o próximo caractere.",
            });
            continue;
          } else {
            finalText += assistantMsg.content ?? "";
            break;
          }
        }
        finalText = corrigirAcentos(finalText);
        send({ type: "text_start" });
        for (let i = 0; i < finalText.length; i += 5) {
          send({ type: "text_delta", delta: finalText.slice(i, i + 5) });
          await new Promise(r => setTimeout(r, 6));
        }
        send({
          type: "usage",
          input_tokens: lastCompletionUsage?.prompt_tokens ?? 0,
          output_tokens: lastCompletionUsage?.completion_tokens ?? 0,
          total_time_ms: Date.now() - startMs,
          tool_calls_count: toolCallsForSave.length,
          model,
        });
        let savedConvId = conversation_id;
        {
          if (!savedConvId) {
            const titulo = (message?.trim() ?? "Conversa").slice(0, 60) + ((message?.trim()?.length ?? 0) > 60 ? "..." : "");
            const { data: newConv } = await supabase.from("os_conversations").insert({ organization_id: masterOrgId, user_id: user.id, titulo, agente_slug: "__admin_os__" }).select("id").single();
            savedConvId = newConv?.id;
          } else {
            await supabase.from("os_conversations").update({ atualizado_em: new Date().toISOString() }).eq("id", savedConvId);
          }
          if (savedConvId) {
            await supabase.from("os_messages").insert([
              { conversation_id: savedConvId, role: "user", content: message?.trim() ?? "" },
              { conversation_id: savedConvId, role: "assistant", content: finalText, tool_calls: toolCallsForSave.length > 0 ? toolCallsForSave : null },
            ]);
          }
        }
        send({ type: "done", conversation_id: savedConvId, model });
      } catch (err) {
        console.error("[descompliquei-os] ERROR:", err);
        send({ type: "error", message: String(err) });
      } finally {
        clearTimeout(globalTimeout);
        try { controller.close(); } catch { /**/ }
      }
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
});
