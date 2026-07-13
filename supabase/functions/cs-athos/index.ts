// ═══════════════════════════════════════════════════════════════════════════
// Athos CS — assistente especialista de Customer Success (Admin OS)
// Read-only, cross-org, gated para superadmin/admin. Reaproveita o padrão de
// streaming SSE + tool-loop do descompliquei-os, mas com tools de CS.
//
// Dois clients:
//   supabaseAdmin  → service role, para leituras diretas de tabelas cross-org
//   userClient(req)→ JWT do caller, para chamar as RPCs de CS (get_cs_*) que
//                    têm gate is_super_admin()/is_admin() e são SECURITY DEFINER
// ═══════════════════════════════════════════════════════════════════════════
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";
import { buscarDocs, CS_DOCS } from "./docs.ts";
import { COMMERCIAL_KNOWLEDGE_BASE } from "../_shared/athos-comercial.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const openrouter = new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" });

const DEFAULT_MODEL = "openai/gpt-5.4-mini";
const EXTRACT_MODEL = "openai/gpt-5.4-nano";
const MAX_TOOL_ITERATIONS = 20;
const ALLOWED_MODELS = new Set([
  "openai/gpt-5.4-nano", "openai/gpt-5.4-mini", "openai/gpt-5.4", "openai/gpt-5.5",
  "anthropic/claude-fable-5", "anthropic/claude-opus-4.8", "anthropic/claude-opus-4.8-fast",
  "google/gemini-3.5-flash", "x-ai/grok-4.3", "x-ai/grok-4.20",
  "deepseek/deepseek-v4-flash", "deepseek/deepseek-v4-pro", "qwen/qwen3.7-max", "mistralai/mistral-medium-3-5",
]);
// Aceita também modelos custom no formato provider/model-id (paridade com o Athos GS)
const MODEL_ID_RE = /^[\w.-]+\/[\w.:-]+$/;
const resolveModel = (m: unknown): string =>
  (typeof m === "string" && (ALLOWED_MODELS.has(m) || MODEL_ID_RE.test(m))) ? m : DEFAULT_MODEL;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Gate de admin ────────────────────────────────────────────────────────────
async function isCallerAdmin(userId: string): Promise<boolean> {
  const { data: sa } = await supabaseAdmin
    .from("usuarios_papeis").select("papel").eq("usuario_id", userId).eq("papel", "superadmin").maybeSingle();
  if (sa) return true;
  const { data: pa } = await supabaseAdmin
    .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!pa;
}

function userClient(authHeader: string) {
  return createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
}

// ── Formatação ───────────────────────────────────────────────────────────────
const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);

function tempoMin(min: number | null | undefined): string {
  if (min == null) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60 ? " " + (m % 60) + "min" : ""}`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// ── Base de clientes (get_cs_clients + get_cs_crm_metrics + snapshot de hoje) ──
interface ClienteCS {
  org_id: string; client_id: string; crm_user_id: string | null; nome: string;
  fase: string | null; onboarding_completo: boolean; ultimo_touchpoint: string | null;
  joined_at: string | null;
  fat_mes: number; // faturamento do MÊS corrente (calendário)
  growth: number | null; fech_30d: number; leads_30d: number; // sinais de risco (internos)
  tx_fech: number | null; tempo_1o: number | null; tem_meta: boolean; meta_pct: number | null;
  ultima_atividade: string | null; resultado_score: number | null;
}

const nomeMesAtual = () => new Date().toLocaleDateString("pt-BR", { month: "long" });

function faseEsperada(dias: number): string {
  if (dias <= 30) return "Ativação";
  if (dias <= 90) return "Execução";
  if (dias <= 180) return "Tração";
  return "Maturidade";
}

async function carregarBase(uc: ReturnType<typeof userClient>): Promise<ClienteCS[]> {
  const [{ data: clients }, { data: metrics }, { data: monthFat }] = await Promise.all([
    uc.rpc("get_cs_clients"),
    uc.rpc("get_cs_crm_metrics"),
    uc.rpc("get_cs_month_fat"),
  ]);
  const mMap: Record<string, any> = {};
  (metrics || []).forEach((m: any) => { mMap[m.organization_id] = m; });
  const fMap: Record<string, number> = {};
  (monthFat || []).forEach((r: any) => { fMap[r.org_id] = Number(r.fat_mes ?? 0); });

  // resultado_score de hoje (snapshot)
  const { data: snaps } = await supabaseAdmin
    .from("cs_crm_snapshots").select("organization_id, resultado_score")
    .eq("snapshot_date", new Date().toISOString().slice(0, 10));
  const sMap: Record<string, number> = {};
  (snaps || []).forEach((s: any) => { sMap[s.organization_id] = s.resultado_score; });

  return (clients || []).map((c: any) => {
    const m = mMap[c.organization_id] || {};
    return {
      org_id: c.organization_id, client_id: c.id, crm_user_id: c.crm_user_id,
      nome: c.clinic_name || c.nome_completo || "Cliente",
      fase: c.cs_fase, onboarding_completo: !!c.onboarding_complete,
      ultimo_touchpoint: c.cs_ultimo_touchpoint, joined_at: c.joined_at ?? null,
      fat_mes: fMap[c.organization_id] ?? 0,
      growth: m.fat_growth_pct == null ? null : Number(m.fat_growth_pct),
      fech_30d: Number(m.fechamentos_30d ?? 0), leads_30d: Number(m.leads_30d ?? 0),
      tx_fech: m.tx_fech == null ? null : Number(m.tx_fech),
      tempo_1o: m.tempo_1o_contato_med_min == null ? null : Number(m.tempo_1o_contato_med_min),
      tem_meta: !!m.tem_meta, meta_pct: m.meta_pct == null ? null : Number(m.meta_pct),
      ultima_atividade: m.ultima_atividade ?? null,
      resultado_score: sMap[c.organization_id] ?? null,
    };
  });
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function resumoCliente(c: ClienteCS): string {
  const inativo = diasDesde(c.ultima_atividade);
  const semTp = diasDesde(c.ultimo_touchpoint);
  const casa = diasDesde(c.joined_at);
  return [
    `${c.nome} [org ${c.org_id}]`,
    casa != null ? `tempo de casa: ${casa} dias (fase esperada: ${faseEsperada(casa)})` : "tempo de casa: desconhecido",
    `fase: ${c.fase || "sem fase"}`,
    `resultado_score: ${c.resultado_score ?? "—"}`,
    `faturamento no mês (${nomeMesAtual()}): ${brl(c.fat_mes)}`,
    c.tem_meta ? `meta: ${pct(c.meta_pct)} batida` : "SEM META configurada",
    inativo != null ? `CRM ativo há ${inativo}d` : "sem atividade recente",
    semTp != null ? `último touchpoint há ${semTp}d` : "nenhum touchpoint",
  ].join(" · ");
}

// ── Raio-X operacional (leitura profunda do CRM, POR PERÍODO DE CALENDÁRIO) ───
// Períodos de calendário — sem janelas móveis. Padrão = mês corrente.
function periodoRange(periodo?: string): { from: string | null; to: string | null } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (!periodo || periodo === "mes") return { from: null, to: null }; // RPC assume o mês corrente
  if (periodo === "mes_anterior") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(first), to: iso(last) };
  }
  if (periodo === "semana") {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
    return { from: iso(mon), to: iso(now) };
  }
  if (periodo === "dia") return { from: iso(now), to: iso(now) };
  return { from: null, to: null };
}

async function raioX(uc: ReturnType<typeof userClient>, orgId: string, from?: string | null, to?: string | null): Promise<any> {
  const { data } = await uc.rpc("get_cs_client_raio_x", { p_org_id: orgId, p_from: from ?? null, p_to: to ?? null });
  return data;
}

function formatRaioX(rx: any): string {
  if (!rx) return "sem dados operacionais";
  const p = rx.periodo || {}, f = rx.funil || {}, o = rx.oportunidades || {}, at = rx.atendimento || {}, ag = rx.agenda || {}, v = rx.vendas || {};
  const growth = v.fat_prev > 0 ? Math.round((v.fat - v.fat_prev) / v.fat_prev * 100) : null;
  const totalAg = (ag.realizados || 0) + (ag.faltas || 0);
  const noShow = totalAg > 0 ? Math.round((ag.faltas || 0) / totalAg * 100) : 0;
  const pn = rx.painel || {};
  const fmtRow = (k: string, o: any) => `  - ${k}: ${o.leads} leads · ${o.vendas} vendas · ${brl(o.faturamento)} · ticket ${brl(o.ticket)} · conversão ${o.conversao_pct}%`;
  const painelOrigens = Object.keys(pn).filter(k => k !== "geral" && (pn[k]?.atividade?.leads || pn[k]?.atividade?.vendas))
    .map((k) => fmtRow(k, pn[k].atividade)).join("\n");
  const painelGeral = pn.geral?.atividade ? fmtRow("GERAL", pn.geral.atividade) : "";
  const cad = pn.geral?.cadastrados;
  return [
    `PERÍODO ANALISADO: ${p.de} a ${p.ate} (calendário)`,
    `PAINEL DA CLÍNICA — IDÊNTICO ao que o dono vê no dashboard (mesma função). USE SEMPRE ESTES NÚMEROS ao falar de leads, vendas, faturamento, ticket e conversão:\n${[painelGeral, painelOrigens].filter(Boolean).join("\n") || "  (sem dados)"}`,
    `TOTAL DE VENDAS DO MÊS: ${brl(v.fat)} em ${v.fechamentos} vendas${growth != null ? ` (${growth > 0 ? "+" : ""}${growth}% vs período anterior)` : ""}`,
    `OPORTUNIDADES EM ABERTO (leads deste período): ${o.qualificados_sem_agendamento} qualificados SEM agendamento · ${o.agendados_sem_fechamento} agendados SEM fechamento (valor orçado em aberto: ${brl(o.valor_potencial_agendado)})`,
    `ATENDIMENTO: ${at.sem_primeiro_contato} leads NUNCA contatados · ${at.parados_7d} parados 7+ dias sem contato · ${at.aguardando_resposta} aguardando resposta (lead mandou, ninguém respondeu) · ${at.msgs_periodo} mensagens no período · último envio há ${at.dias_desde_ultimo_envio}d`,
    `AGENDA: ${ag.proximos} próximos · ${ag.realizados} realizados · ${ag.faltas} faltas · ${ag.cancelados} cancelados · no-show ${noShow}%`,
    `CADASTRADOS NO PERÍODO (= toggle "Cadastrados no período" do painel; a ENTRADA de leads novos, NÃO o "Total de Leads" acima): ${cad ? `${cad.leads} leads · ${cad.vendas} vendas · ${brl(cad.faturamento)} · conversão ${cad.conversao_pct}%` : `${f.leads} leads`} · funil: ${f.mql} MQL → ${f.agendados} agendados`,
    `TOP PRODUTOS: ${(rx.top_produtos || []).map((pr: any) => `${pr.produto} (${pr.qtd}x, ${brl(pr.valor)})`).join(" · ") || "—"}`,
  ].join("\n");
}

// ── TOOLS (read-only) ────────────────────────────────────────────────────────
const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "listar_clientes",
      description: "Lista todos os clientes do CS com um resumo do estado atual (fase, health/resultado, faturamento, crescimento, funil, tempo de atendimento, meta, atividade). Use para ter a visão da base.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "clientes_em_risco",
      description: "Lista os clientes em risco de RESULTADO: faturamento em queda, CRM inativo 14+ dias, zero fechamentos com leads ativos, ou resultado_score baixo. Ordenado pela pior queda. Use para priorizar a ação do dia.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "raio_x_cliente",
      description: "RAIO-X OPERACIONAL do cliente por PERÍODO DE CALENDÁRIO — a leitura mais profunda do CRM. Mostra o que está REALMENTE acontecendo no período: gargalo do funil, leads qualificados parados sem agendamento, agendados sem fechamento, leads nunca contatados/parados/aguardando resposta, no-show, o que foi vendido (top produtos), origens que convertem. Por padrão analisa o MÊS ATUAL. USE SEMPRE PRIMEIRO ao analisar um cliente.",
      parameters: { type: "object", properties: { org_id: { type: "string", description: "organization_id do cliente" }, periodo: { type: "string", enum: ["mes", "mes_anterior", "semana", "dia"], description: "período de calendário; padrão 'mes' (mês atual)" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "leads_para_acao",
      description: "Lista leads CONCRETOS que precisam de ação, com nome e situação. foco='quentes' (qualificados/agendados em aberto — oportunidades a fechar), 'parados' (sem contato há 7+ dias), 'sem_contato' (leads novos nunca contatados). Use para dar ao CSM a lista real de quem trabalhar.",
      parameters: { type: "object", properties: { org_id: { type: "string" }, foco: { type: "string", enum: ["quentes", "parados", "sem_contato"] } }, required: ["org_id", "foco"] },
    },
  },
  {
    type: "function",
    function: {
      name: "vendas_recentes",
      description: "Últimas vendas fechadas do cliente: produto, valor, data, forma de pagamento. Use para entender o que o cliente está de fato vendendo e o mix de produtos/ticket.",
      parameters: { type: "object", properties: { org_id: { type: "string" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "agenda_cliente",
      description: "Agenda do cliente: próximos agendamentos (consultas/procedimentos) e resumo de comparecimento dos últimos 30 dias (realizados, faltas, cancelamentos). Use para avaliar risco de no-show e volume da agenda.",
      parameters: { type: "object", properties: { org_id: { type: "string" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "dados_crm_cliente",
      description: "Série de faturamento dos últimos 12 meses, funil de conversão (30d) e adoção de funcionalidades. Use para ver a evolução histórica e o uso das features.",
      parameters: { type: "object", properties: { org_id: { type: "string", description: "organization_id do cliente" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "saude_e_tendencia",
      description: "Health atual e a curva de tendência do Resultado no CRM (snapshots) de um cliente, com faturamento e crescimento ao longo do tempo.",
      parameters: { type: "object", properties: { org_id: { type: "string" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "metricas_periodo",
      description: "Métricas do CRM de um cliente para um intervalo de datas específico (faturamento, crescimento vs período anterior, funil, tempo).",
      parameters: {
        type: "object",
        properties: {
          org_id: { type: "string" },
          from: { type: "string", description: "data inicial YYYY-MM-DD" },
          to: { type: "string", description: "data final YYYY-MM-DD" },
        },
        required: ["org_id", "from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "touchpoints_cliente",
      description: "Histórico de touchpoints (contatos do CSM) de um cliente: tipo, resultado, notas, datas.",
      parameters: { type: "object", properties: { org_id: { type: "string" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "jornada_e_materiais",
      description: "O que o cliente está construindo na plataforma: progresso da jornada do Athos, ferramentas do Arsenal construídas e materiais criados, além de NPS e marcos atingidos.",
      parameters: { type: "object", properties: { org_id: { type: "string" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_documentacao",
      description: "Consulta a metodologia e os playbooks de CS da Descompliquei (filosofia, jornada, health score, cadência, playbooks de onboarding/engajamento/risco/escalada, métricas, expansão). Use para embasar recomendações na metodologia oficial.",
      parameters: { type: "object", properties: { busca: { type: "string", description: "tema ou pergunta" } }, required: ["busca"] },
    },
  },
  // ── Tools de ESCRITA de jornada (consultoria mensal da clínica) ─────────────
  {
    type: "function",
    function: {
      name: "ver_jornadas_cliente",
      description: "Mostra as jornadas (onboarding + mensais) de um cliente com a ESTRUTURA COMPLETA e os IDs (jornada, estágios, tarefas, subtarefas): status, conteúdo e o que já foi concluído. USE SEMPRE ANTES de editar uma jornada, para saber o que já existe e obter os IDs corretos. Requer o org_id do cliente.",
      parameters: { type: "object", properties: { org_id: { type: "string", description: "organization_id do cliente" } }, required: ["org_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_jornada",
      description: "CRIA ou EDITA a jornada mensal de um cliente (o plano de consultoria que a CLÍNICA vai executar no mês). SEM 'id' → cria um RASCUNHO novo. COM 'id' (obtido em ver_jornadas_cliente) → edita a jornada existente, preservando o que já foi concluído. Envie SEMPRE a estrutura COMPLETA de estágios/tarefas que deve existir ao FINAL — o que você omitir é REMOVIDO. Preserve os IDs de estágios/tarefas/subtarefas que quer manter. Por padrão a jornada é 'rascunho'; só use status='ativa' para PUBLICAR ao cliente quando o CSM confirmar. Baseie-se no raio_x_cliente (ataque o maior gargalo) e carregue as pendências ainda relevantes.",
      parameters: {
        type: "object",
        properties: {
          org_id: { type: "string", description: "organization_id do cliente" },
          id: { type: "string", description: "id da jornada a EDITAR; omita para criar uma nova" },
          titulo: { type: "string", description: "ex: 'Jornada de julho de 2026'" },
          tipo: { type: "string", enum: ["mensal", "onboarding"], description: "padrão 'mensal'" },
          periodo_ref: { type: "string", description: "1º dia do mês de referência, YYYY-MM-01; padrão mês atual" },
          status: { type: "string", enum: ["rascunho", "ativa", "concluida"], description: "padrão 'rascunho'. 'ativa' PUBLICA para o cliente." },
          estagios: {
            type: "array",
            description: "3 a 6 estágios; cada um com 2 a 5 tarefas.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "id do estágio existente; omita para novo" },
                titulo: { type: "string" },
                descricao: { type: "string" },
                prazo_dias: { type: "number", description: "prazo do estágio em dias (padrão 7)" },
                passos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "id da tarefa existente; omita para nova" },
                      titulo: { type: "string" },
                      conteudo_md: { type: "string", description: "descrição rica em MARKDOWN, consultiva: o que fazer, por quê e como (formatada como um material)" },
                      tipo: { type: "string", enum: ["acao_livre", "material"], description: "'material' = o cliente vai CONSTRUIR um ativo com o Athos GS" },
                      material_categoria: { type: "string", enum: ["script_atendimento", "estrutura_processo", "quebra_objecao", "oferta", "followup_reativacao", "otimizacao_comercial"], description: "obrigatório se tipo='material'" },
                      material_brief: { type: "string", description: "o que construir (se tipo='material')" },
                      obrigatorio: { type: "boolean", description: "padrão true" },
                      subtarefas: { type: "array", description: "checklist opcional", items: { type: "object", properties: { id: { type: "string" }, titulo: { type: "string" } }, required: ["titulo"] } },
                    },
                    required: ["titulo", "tipo"],
                  },
                },
              },
              required: ["titulo", "passos"],
            },
          },
        },
        required: ["org_id", "titulo", "estagios"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excluir_jornada",
      description: "Exclui uma jornada inteira de um cliente (IRREVERSÍVEL). Use apenas quando o CSM pedir explicitamente. Requer org_id e o id da jornada (de ver_jornadas_cliente).",
      parameters: { type: "object", properties: { org_id: { type: "string" }, jornada_id: { type: "string" } }, required: ["org_id", "jornada_id"] },
    },
  },
];

// ── Persistência de estrutura de jornada (reconcile preservando o concluído) ──
// Espelha o useSaveCsJornadaEstrutura do frontend: upsert por id, preserva
// `concluido` das tarefas/subtarefas existentes, e DELETA o que sumiu do payload.
const MATERIAL_CATS = new Set(["script_atendimento", "estrutura_processo", "quebra_objecao", "oferta", "followup_reativacao", "otimizacao_comercial"]);

async function persistJornadaEstrutura(jornadaId: string, estagios: any[]): Promise<void> {
  const keptEstagioIds: string[] = [];
  for (let i = 0; i < (estagios || []).length; i++) {
    const e = estagios[i] || {};
    const estRow: any = {
      jornada_id: jornadaId,
      titulo: String(e.titulo ?? `Bloco ${i + 1}`).slice(0, 200),
      descricao: e.descricao ? String(e.descricao).slice(0, 500) : null,
      ordem: i,
      prazo_dias: Number(e.prazo_dias) || 7,
    };
    let estagioId: string;
    if (e.id) {
      await supabaseAdmin.from("jornada_estagios").update(estRow).eq("id", e.id);
      estagioId = e.id;
    } else {
      const { data } = await supabaseAdmin.from("jornada_estagios").insert(estRow).select("id").single();
      if (!data) continue;
      estagioId = data.id;
    }
    keptEstagioIds.push(estagioId);

    const keptPassoIds: string[] = [];
    const passos = Array.isArray(e.passos) ? e.passos : [];
    for (let j = 0; j < passos.length; j++) {
      const p = passos[j] || {};
      const isMaterial = p.tipo === "material" && MATERIAL_CATS.has(p.material_categoria);
      const passoRow: any = {
        estagio_id: estagioId,
        titulo: String(p.titulo ?? `Tarefa ${j + 1}`).slice(0, 200),
        conteudo_md: p.conteudo_md ? String(p.conteudo_md).slice(0, 6000) : null,
        descricao: null,
        ordem: j,
        tipo: isMaterial ? "material" : "acao_livre",
        material_categoria: isMaterial ? p.material_categoria : null,
        material_brief: isMaterial && p.material_brief ? String(p.material_brief).slice(0, 500) : null,
        obrigatorio: p.obrigatorio !== false,
      };
      let passoId: string;
      if (p.id) {
        await supabaseAdmin.from("jornada_passos").update(passoRow).eq("id", p.id); // NÃO toca em concluido
        passoId = p.id;
      } else {
        const { data } = await supabaseAdmin.from("jornada_passos").insert({ ...passoRow, concluido: false }).select("id").single();
        if (!data) continue;
        passoId = data.id;
      }
      keptPassoIds.push(passoId);

      const keptSubIds: string[] = [];
      const subs = Array.isArray(p.subtarefas) ? p.subtarefas : [];
      for (let k = 0; k < subs.length; k++) {
        const s = subs[k];
        const titulo = typeof s === "string" ? s : s?.titulo;
        if (!titulo) continue;
        const subRow: any = { passo_id: passoId, titulo: String(titulo).slice(0, 200), ordem: k };
        const sid = typeof s === "object" && s ? s.id : null;
        if (sid) {
          await supabaseAdmin.from("jornada_subtarefas").update(subRow).eq("id", sid);
          keptSubIds.push(sid);
        } else {
          const { data } = await supabaseAdmin.from("jornada_subtarefas").insert({ ...subRow, concluido: false }).select("id").single();
          if (data) keptSubIds.push(data.id);
        }
      }
      const { data: allSubs } = await supabaseAdmin.from("jornada_subtarefas").select("id").eq("passo_id", passoId);
      const delSubs = (allSubs ?? []).map((x: any) => x.id).filter((id: string) => !keptSubIds.includes(id));
      if (delSubs.length) await supabaseAdmin.from("jornada_subtarefas").delete().in("id", delSubs);
    }
    const { data: allPassos } = await supabaseAdmin.from("jornada_passos").select("id").eq("estagio_id", estagioId);
    const delPassos = (allPassos ?? []).map((x: any) => x.id).filter((id: string) => !keptPassoIds.includes(id));
    if (delPassos.length) await supabaseAdmin.from("jornada_passos").delete().in("id", delPassos);
  }
  const { data: allEst } = await supabaseAdmin.from("jornada_estagios").select("id").eq("jornada_id", jornadaId);
  const delEst = (allEst ?? []).map((x: any) => x.id).filter((id: string) => !keptEstagioIds.includes(id));
  if (delEst.length) await supabaseAdmin.from("jornada_estagios").delete().in("id", delEst);
}

interface ToolHooks { onJornadaChanged?: (jornadaId: string) => void; }

async function executeTool(
  name: string, input: any, uc: ReturnType<typeof userClient>, baseCache: { base?: ClienteCS[] },
  hooks?: ToolHooks,
): Promise<string> {
  const getBase = async () => { if (!baseCache.base) baseCache.base = await carregarBase(uc); return baseCache.base; };
  const findCliente = async (orgId: string) => (await getBase()).find(c => c.org_id === orgId) || null;

  try {
    if (name === "listar_clientes") {
      const base = await getBase();
      if (base.length === 0) return "Nenhum cliente na base de CS.";
      return `${base.length} clientes:\n\n` + base.map(resumoCliente).join("\n\n");
    }

    if (name === "clientes_em_risco") {
      const base = await getBase();
      const risco = base.map(c => {
        const inativo = diasDesde(c.ultima_atividade);
        const motivos: string[] = [];
        if ((c.growth ?? 0) < -3) motivos.push(`faturamento ${c.growth}%`);
        if (inativo != null && inativo >= 14) motivos.push(`CRM parado há ${inativo}d`);
        if (c.fech_30d === 0 && c.leads_30d > 0) motivos.push("0 fechamentos em 30d");
        if ((c.resultado_score ?? 100) < 45) motivos.push(`resultado_score ${c.resultado_score}`);
        return { c, motivos };
      }).filter(r => r.motivos.length > 0)
        .sort((a, b) => (a.c.growth ?? 0) - (b.c.growth ?? 0));
      if (risco.length === 0) return "Nenhum cliente em risco de resultado no momento.";
      return `${risco.length} cliente(s) em risco:\n\n` +
        risco.map(r => `${resumoCliente(r.c)}\n>> MOTIVOS: ${r.motivos.join(", ")}`).join("\n\n");
    }

    if (name === "raio_x_cliente") {
      const { from, to } = periodoRange(input.periodo);
      const rx = await raioX(uc, input.org_id, from, to);
      return formatRaioX(rx);
    }

    if (name === "leads_para_acao") {
      const foco = input.foco || "quentes";
      const ts60 = new Date(Date.now() - 60 * 86400000).toISOString();
      const ts30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const ts7 = new Date(Date.now() - 7 * 86400000).toISOString();
      let q = supabaseAdmin.from("leads")
        .select("nome, origem, status, procedimento_interesse, is_qualified, is_scheduled, criado_em, ultimo_contato, lead_scoring")
        .eq("organization_id", input.org_id)
        .not("is_closed", "is", true)
        .not("excluir_metricas", "is", true);
      if (foco === "quentes") q = q.or("is_qualified.eq.true,is_scheduled.eq.true").gte("criado_em", ts60).order("criado_em", { ascending: false });
      else if (foco === "sem_contato") q = q.is("ultimo_contato", null).gte("criado_em", ts30).order("criado_em", { ascending: false });
      else q = q.lt("ultimo_contato", ts7).order("ultimo_contato", { ascending: true });
      const { data } = await q.limit(15);
      if (!data || data.length === 0) return "Nenhum lead nesse critério.";
      return JSON.stringify(data.map((l: any) => ({
        nome: l.nome, origem: l.origem, status: l.status, procedimento: l.procedimento_interesse,
        qualificado: l.is_qualified, agendado: l.is_scheduled, scoring: l.lead_scoring,
        dias_desde_criado: diasDesde(l.criado_em), dias_sem_contato: diasDesde(l.ultimo_contato),
      })));
    }

    if (name === "vendas_recentes") {
      const { data } = await supabaseAdmin.from("vendas")
        .select("produto_servico, valor_fechado, data_fechamento, forma_pagamento, tipo_venda")
        .eq("organization_id", input.org_id).not("valor_fechado", "is", null)
        .order("data_fechamento", { ascending: false }).limit(15);
      if (!data || data.length === 0) return "Nenhuma venda registrada.";
      return JSON.stringify(data);
    }

    if (name === "agenda_cliente") {
      const nowIso = new Date().toISOString();
      const ts30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [prox, hist] = await Promise.all([
        supabaseAdmin.from("agendamentos")
          .select("titulo, tipo, data_hora_inicio, status, valor_orcado, procedimento_interesse")
          .eq("organization_id", input.org_id).gt("data_hora_inicio", nowIso)
          .in("status", ["agendado", "confirmado"]).order("data_hora_inicio", { ascending: true }).limit(15),
        supabaseAdmin.from("agendamentos").select("status").eq("organization_id", input.org_id).gte("data_hora_inicio", ts30),
      ]);
      const h = (hist as any).data || [];
      const cnt = (s: string) => h.filter((x: any) => x.status === s).length;
      return JSON.stringify({
        proximos: (prox as any).data || [],
        historico_30d: { realizados: cnt("realizado"), faltas: cnt("faltou"), cancelados: cnt("cancelado"), agendados_confirmados: cnt("agendado") + cnt("confirmado") },
      });
    }

    if (name === "dados_crm_cliente") {
      const { data, error } = await uc.rpc("get_cs_client_crm_detail", { p_org_id: input.org_id });
      if (error) return `Erro: ${error.message}`;
      const d: any = data || {};
      // Só a série MENSAL (calendário) e a adoção. Sem funil/tempo de janela móvel.
      return JSON.stringify({ faturamento_mensal_12m: d.monthly, adocao_funcionalidades: d.adocao });
    }

    if (name === "saude_e_tendencia") {
      const c = await findCliente(input.org_id);
      const { data: trend } = await uc.rpc("get_cs_client_crm_trend", { p_org_id: input.org_id });
      // Só a curva do resultado_score (health ao longo do tempo). Sem fat_30d (janela móvel).
      const curva = (trend || []).map((t: any) => ({ data: t.snapshot_date, resultado_score: t.resultado_score }));
      return JSON.stringify({ resumo: c ? resumoCliente(c) : null, tendencia_resultado_score: curva });
    }

    if (name === "metricas_periodo") {
      const { data, error } = await uc.rpc("get_cs_client_crm_period", { p_org_id: input.org_id, p_from: input.from, p_to: input.to });
      if (error) return `Erro: ${error.message}`;
      return JSON.stringify(data);
    }

    if (name === "touchpoints_cliente") {
      const c = await findCliente(input.org_id);
      if (!c) return "Cliente não encontrado.";
      const { data } = await supabaseAdmin
        .from("cs_touchpoints").select("tipo, resultado, notas, data_contato, proximo_contato, duracao_minutos, cliente_faltou")
        .eq("client_id", c.client_id).order("data_contato", { ascending: false }).limit(15);
      if (!data || data.length === 0) return "Nenhum touchpoint registrado para este cliente.";
      return JSON.stringify(data);
    }

    if (name === "jornada_e_materiais") {
      const c = await findCliente(input.org_id);
      if (!c) return "Cliente não encontrado.";
      const crmUser = c.crm_user_id;
      const [jornadaRes, matRes, aulasRes, npsRes, marcosRes] = await Promise.all([
        crmUser ? supabaseAdmin.from("jornadas")
          .select("id, status, jornada_estagios(titulo, jornada_passos(concluido))")
          .eq("user_id", crmUser).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        crmUser ? supabaseAdmin.from("meus_materiais").select("id").eq("user_id", crmUser) : Promise.resolve({ data: [] }),
        crmUser ? supabaseAdmin.from("arsenal_aulas_progresso").select("id").eq("user_id", crmUser).eq("concluido", true) : Promise.resolve({ data: [] }),
        supabaseAdmin.from("cs_nps_responses").select("score, comentario, respondido_em").eq("client_id", c.client_id).order("respondido_em", { ascending: false }).limit(3),
        supabaseAdmin.from("cs_marcos").select("marco, atingido, atingido_em").eq("client_id", c.client_id).eq("atingido", true),
      ]);
      const j: any = (jornadaRes as any).data;
      let jornadaResumo = "jornada não gerada";
      if (j) {
        const passos = (j.jornada_estagios || []).flatMap((e: any) => e.jornada_passos || []);
        const done = passos.filter((p: any) => p.concluido).length;
        jornadaResumo = `jornada ${j.status}: ${done}/${passos.length} passos (${passos.length ? Math.round(done / passos.length * 100) : 0}%)`;
      }
      return JSON.stringify({
        jornada: jornadaResumo,
        ferramentas_construidas: ((matRes as any).data || []).length,
        aulas_concluidas: ((aulasRes as any).data || []).length,
        nps: (npsRes as any).data || [],
        marcos_atingidos: ((marcosRes as any).data || []).map((m: any) => m.marco),
      });
    }

    if (name === "consultar_documentacao") {
      return buscarDocs(String(input.busca || ""));
    }

    // ── Jornada: leitura da estrutura (com IDs) ──────────────────────────────
    if (name === "ver_jornadas_cliente") {
      const c = await findCliente(input.org_id);
      if (!c?.crm_user_id) return "Cliente sem usuário vinculado no CRM — não há como ter jornada.";
      const { data } = await supabaseAdmin.from("jornadas")
        .select("id, titulo, status, tipo, periodo_ref, gerada_por, jornada_estagios(id, titulo, descricao, ordem, prazo_dias, jornada_passos(id, titulo, conteudo_md, tipo, material_categoria, material_brief, obrigatorio, concluido, ordem, jornada_subtarefas(id, titulo, concluido, ordem)))")
        .eq("user_id", c.crm_user_id)
        .order("periodo_ref", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return "Este cliente ainda não tem nenhuma jornada. Use salvar_jornada (sem 'id') para criar a primeira como rascunho.";
      const out = (data as any[]).map((j) => ({
        id: j.id, titulo: j.titulo, status: j.status, tipo: j.tipo, periodo_ref: j.periodo_ref, gerada_por: j.gerada_por,
        estagios: (j.jornada_estagios ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((e: any) => ({
          id: e.id, titulo: e.titulo, descricao: e.descricao, prazo_dias: e.prazo_dias,
          passos: (e.jornada_passos ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((p: any) => ({
            id: p.id, titulo: p.titulo, tipo: p.tipo, conteudo_md: p.conteudo_md,
            material_categoria: p.material_categoria, material_brief: p.material_brief,
            obrigatorio: p.obrigatorio, concluido: p.concluido,
            subtarefas: (p.jornada_subtarefas ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((s: any) => ({ id: s.id, titulo: s.titulo, concluido: s.concluido })),
          })),
        })),
      }));
      return JSON.stringify(out);
    }

    // ── Jornada: criar (sem id) ou editar (com id), preservando o concluído ──
    if (name === "salvar_jornada") {
      const c = await findCliente(input.org_id);
      if (!c?.crm_user_id) return "Cliente sem usuário vinculado no CRM — não é possível criar jornada.";
      const crmUserId = c.crm_user_id;
      if (!input.titulo || !Array.isArray(input.estagios) || input.estagios.length === 0)
        return "Erro: 'titulo' e 'estagios' (não-vazio) são obrigatórios.";
      const status = ["rascunho", "ativa", "concluida"].includes(input.status) ? input.status : undefined;
      const tipo = input.tipo === "onboarding" ? "onboarding" : "mensal";
      const periodoRef = input.periodo_ref || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

      let jornadaId: string = input.id;
      if (jornadaId) {
        const { data: owner } = await supabaseAdmin.from("jornadas").select("user_id").eq("id", jornadaId).maybeSingle();
        if (!owner || owner.user_id !== crmUserId) return "Erro: jornada não encontrada para este cliente. Use ver_jornadas_cliente para pegar o id certo.";
        const patch: any = { titulo: String(input.titulo).slice(0, 200), updated_at: new Date().toISOString() };
        if (status) patch.status = status;
        if (input.periodo_ref) patch.periodo_ref = periodoRef;
        await supabaseAdmin.from("jornadas").update(patch).eq("id", jornadaId);
      } else {
        const { data: nova, error } = await supabaseAdmin.from("jornadas")
          .insert({ user_id: crmUserId, organization_id: input.org_id, titulo: String(input.titulo).slice(0, 200), status: status || "rascunho", gerada_por: "ia", tipo, periodo_ref: periodoRef })
          .select("id").single();
        if (error || !nova) return "Erro ao criar jornada: " + (error?.message ?? "");
        jornadaId = nova.id;
      }

      await persistJornadaEstrutura(jornadaId, input.estagios);
      hooks?.onJornadaChanged?.(jornadaId);

      const nEst = input.estagios.length;
      const nPass = input.estagios.reduce((a: number, e: any) => a + ((e.passos ?? []).length), 0);
      const stFinal = status || (input.id ? "mantido" : "rascunho");
      return `Jornada salva (id ${jornadaId}, status ${stFinal}): ${nEst} estágio(s), ${nPass} tarefa(s). ${stFinal === "ativa" ? "PUBLICADA — o cliente já vê." : "Segue como rascunho; publique (status 'ativa') quando o CSM confirmar."}`;
    }

    // ── Jornada: excluir ─────────────────────────────────────────────────────
    if (name === "excluir_jornada") {
      const c = await findCliente(input.org_id);
      if (!c?.crm_user_id) return "Cliente sem usuário vinculado no CRM.";
      const { data: owner } = await supabaseAdmin.from("jornadas").select("user_id").eq("id", input.jornada_id).maybeSingle();
      if (!owner || owner.user_id !== c.crm_user_id) return "Jornada não encontrada para este cliente.";
      await supabaseAdmin.from("jornadas").delete().eq("id", input.jornada_id);
      hooks?.onJornadaChanged?.(input.jornada_id);
      return "Jornada excluída.";
    }

    return `Tool desconhecida: ${name}`;
  } catch (e) {
    return `Erro ao executar ${name}: ${(e as Error).message}`;
  }
}

// ── Jornada em foco (editor) — carrega a estrutura completa com IDs ───────────
async function loadJornadaFocus(jornadaId: string): Promise<string | null> {
  const { data: j } = await supabaseAdmin.from("jornadas")
    .select("id, titulo, status, tipo, periodo_ref, organization_id, jornada_estagios(id, titulo, descricao, ordem, prazo_dias, jornada_passos(id, titulo, conteudo_md, tipo, material_categoria, material_brief, obrigatorio, concluido, ordem, jornada_subtarefas(id, titulo, concluido, ordem)))")
    .eq("id", jornadaId).maybeSingle();
  if (!j) return null;
  const estagios = (j.jornada_estagios ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((e: any) => ({
    id: e.id, titulo: e.titulo, descricao: e.descricao, prazo_dias: e.prazo_dias,
    passos: (e.jornada_passos ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((p: any) => ({
      id: p.id, titulo: p.titulo, tipo: p.tipo, conteudo_md: p.conteudo_md,
      material_categoria: p.material_categoria, material_brief: p.material_brief,
      obrigatorio: p.obrigatorio, concluido: p.concluido,
      subtarefas: (p.jornada_subtarefas ?? []).sort((a: any, b: any) => a.ordem - b.ordem).map((s: any) => ({ id: s.id, titulo: s.titulo, concluido: s.concluido })),
    })),
  }));
  return JSON.stringify({ id: j.id, org_id: j.organization_id, titulo: j.titulo, status: j.status, tipo: j.tipo, periodo_ref: j.periodo_ref, estagios });
}

// ── System prompt ────────────────────────────────────────────────────────────
function buildCsSystemPrompt(clientContext: string | null, memories: string, jornadaFocus: string | null = null): string {
  const docsIndice = CS_DOCS.map(d => `- ${d.titulo}`).join("\n");
  return `Você é o **Athos CS**, o gerente sênior de Customer Success da Descompliquei que orienta o TIME DE CS (os CSMs). Seu usuário é sempre um CSM — nunca o cliente. Você lê o CRM de cada clínica como um gerente experiente e diz ao CSM O QUE ELE (o time de CS) deve fazer para conduzir aquele cliente ao resultado, ancorado na metodologia de CS da casa.

# Sua identidade e A QUEM você serve
Você fala com o CSM (time de CS da plataforma), que gerencia dezenas de clínicas. Você NÃO fala com o dono da clínica e NÃO opera o CRM dele. Você domina Customer Success de ponta a ponta: outcome-driven, health scoring, prevenção de churn, cadência de touchpoints, QBR, expansão, advocacy — e entende a operação comercial de uma clínica o suficiente para DIAGNOSTICAR onde ela trava e COACHAR o CSM sobre como ajudar. Cada recomendação é ancorada em DADOS reais + na metodologia (cadência da fase + playbooks).

# ⚠️ REGRA CENTRAL — AÇÃO DE CSM, NUNCA AÇÃO DA CLÍNICA
Esta é a regra mais importante. Suas recomendações são SEMPRE sobre o que o TIME DE CS deve fazer para conduzir aquele cliente — NUNCA sobre o que a clínica deve fazer na operação dela. O CSM não responde leads, não faz follow-up comercial, não fecha agendamento: isso é trabalho da clínica. O CSM CONDUZ o cliente ao sucesso.

Os gaps do CRM (leads sem resposta, agendados sem fechar, funil travado) são o seu DIAGNÓSTICO — o combustível que revela ONDE o cliente precisa de você. A partir deles, você decide qual ALAVANCA DE CS acionar.

PROIBIDO recomendar (isso é trabalho da clínica):
- ❌ "Responder os 13 leads sem resposta hoje"
- ❌ "Fazer follow-up comercial dos 8 agendados"
- ❌ "Ligar para os pacientes / revisar cada caso"

CERTO recomendar (trabalho do CSM, ancorado na metodologia):
- ✅ "Agende uma reunião de review de conversão com o cliente esta semana (cadência da fase Tração). Pauta: mostrar que há 8 agendados sem fechamento = R$X parados e ajudá-lo a estruturar o processo de follow-up da equipe DELE."
- ✅ "Aplique o Playbook de Engajamento (foco operação comercial): o funil trava no fechamento. Objetivo: destravar o hábito de trabalhar os agendados."
- ✅ "Faça um pulso proativo no WhatsApp com dado: 'vi que você tem R$X em agendamentos abertos — quer que eu te mostre como sua equipe pode priorizar isso?'. Registre o touchpoint."
- ✅ "Escale: 21 dias sem uso + faturamento em queda = risco de churn. Aplique Playbook de Risco e agende call de resgate com o líder junto."

Tradução gap → alavanca de CS (sempre faça esta ponte):
- Leads sem resposta/parados → o CSM não responde; ele COACHA a rotina de atendimento do cliente (ou aciona a IA/cadência da plataforma como solução) num touchpoint.
- Agendados sem fechar → reunião de review comercial + orientar processo de follow-up da equipe do cliente.
- Funil travado num estágio → sessão de coaching focada naquele estágio + material/aula do Arsenal indicada.
- Faturamento em queda / CRM parado → touchpoint de resgate + Playbook de Risco + eventual escalada.
- Resultado bom → touchpoint de celebração com o dado + conversa de expansão/advocacy (QBR, indicação).

Toda "Próxima ação" é uma dessas alavancas: um TOUCHPOINT (pulso, reunião, QBR), um PLAYBOOK, um COACHING, uma CELEBRAÇÃO ou uma ESCALADA — nunca uma tarefa operacional da clínica.

# A metodologia da Descompliquei (resumo — use consultar_documentacao para aprofundar)
- **Princípio-mãe:** o cliente veio para faturar mais. Resultado percebido > uso da plataforma.
- **Health Score (2 eixos):** Adoção (40%, uso da plataforma) + Resultado (60%, resultado no CRM). Verde ≥70, amarelo 45–69, vermelho <45.
- **Jornada:** Ativação (D0–D30) → Execução (D31–D90) → Tração (D91–D180) → Maturidade (D181+).
- **Regra de ouro:** nenhum cliente fica 14+ dias sem ação ativa do CSM.
- **Leitura cruzada dos eixos:** Adoção alta + Resultado baixo = ajudar a operação comercial/funil. Baixa+Baixa = churn iminente.
Documentos disponíveis:
${docsIndice}

# Base de conhecimento COMERCIAL (a mesma do Athos GS)
Você domina a mesma base comercial que o Athos GS usa com os clientes. Ela te dá lastro para (a) DIAGNOSTICAR com precisão onde a operação comercial da clínica trava e (b) montar/curar a JORNADA do cliente com substância — sabendo o que ele precisa estruturar, validar e ajustar. Use como fundamento técnico; a forma de agir continua sendo a do CS (você orienta o CSM, não a clínica).
${COMMERCIAL_KNOWLEDGE_BASE}

# Suas ferramentas de ANÁLISE (read-only — você diagnostica e recomenda; quem OPERA o CRM é a clínica)
Base: listar_clientes, clientes_em_risco.
Operação do cliente (o mais importante):
- **raio_x_cliente**: a leitura profunda do CRM — gargalo do funil, oportunidades paradas (qualificados sem agendamento, agendados sem fechamento), leads nunca contatados / parados / aguardando resposta, no-show, vendas e top produtos, origens. USE SEMPRE PRIMEIRO ao analisar um cliente.
- **leads_para_acao(foco)**: lista de leads reais para trabalhar (quentes / parados / sem_contato).
- **vendas_recentes / agenda_cliente**: o que vendeu e o estado da agenda.
- saude_e_tendencia, dados_crm_cliente, metricas_periodo: health, tendência, histórico 12m, período específico.
- touchpoints_cliente: histórico de contatos do CSM. jornada_e_materiais: uso da plataforma + NPS + marcos.
- consultar_documentacao: metodologia e playbooks.

# ✍️ Você MONTA e EDITA a JORNADA do cliente (ferramentas de ESCRITA)
Além de analisar, você CONSTRÓI e ALTERA a jornada mensal de consultoria do cliente conversando com o CSM. A jornada é o PLANO DE AÇÃO que a CLÍNICA executa no mês (tarefas para o dono da clínica) — não confundir com a sua orientação ao CSM. Aqui você produz o plano do cliente, ancorado nos dados reais e na base comercial.
- **ver_jornadas_cliente(org_id)**: leia SEMPRE antes de editar — traz a estrutura e os IDs (jornada/estágios/tarefas/subtarefas) e o que já está concluído.
- **salvar_jornada(org_id, ...)**: cria (sem 'id') ou edita (com 'id') a jornada. Envie a estrutura COMPLETA final — o que omitir é removido; mantenha os IDs do que quer preservar (isso protege o que o cliente já concluiu). Nasce 'rascunho'; só publique (status='ativa') quando o CSM confirmar.
- **excluir_jornada**: só a pedido explícito.

Como montar/editar bem:
1. Antes de criar/editar, rode **raio_x_cliente** (e ver_jornadas_cliente se já existir jornada). Ataque o MAIOR GARGALO do funil primeiro; carregue pendências ainda relevantes do mês anterior.
2. Cada tarefa tem: **titulo** curto; **conteudo_md** (descrição RICA em markdown, consultiva — o que fazer, por quê e como, formatada como um material); **tipo** 'acao_livre' ou 'material' (material = o cliente vai CONSTRUIR um ativo com o Athos GS → informe material_categoria + material_brief); **subtarefas** (checklist opcional); **obrigatorio**.
3. Estruture em 3–6 estágios, 2–5 tarefas cada. Prazos realistas.
4. Trabalhe de forma CONVERSACIONAL: proponha, aceite ajustes do CSM ("tira essa tarefa", "deixa mais agressivo no follow-up", "adiciona um estágio de reativação"), e re-salve. NÃO publique sozinho — deixe como rascunho e diga ao CSM que ele pode revisar no editor e publicar.
5. Ao terminar de salvar, confirme em 1–2 linhas o que mudou e lembre que está em rascunho para revisão.

# Protocolo de diagnóstico (siga ao analisar um cliente)
1. Comece pelo **raio_x_cliente** — ele revela o momento operacional real.
2. Identifique o MAIOR GARGALO e quantifique a oportunidade perdida (ex: "128 agendados sem fechamento", "90 leads sem primeiro contato"). Onde há mais dinheiro parado?
3. Cruze com a metodologia (fase, health 2-eixos, playbook aplicável) e com o histórico (tendência, touchpoints). Consulte consultar_documentacao para escolher o playbook/cadência certos.
4. TRADUZA o gargalo numa ALAVANCA DE CS (ver Regra Central): qual touchpoint/playbook/coaching resolve isso? Nunca devolva o gargalo cru como tarefa.
5. Se útil, puxe leads_para_acao — mas como MUNIÇÃO para o CSM levar ao cliente no touchpoint (ex: "leve esta lista de 12 quentes para a reunião"), nunca como "responda estes leads você mesmo".
Nunca invente números — busque com as ferramentas, depois analise.

# Períodos de análise (REGRA IMPORTANTE)
Você analisa SEMPRE por período de CALENDÁRIO — nunca por janelas móveis. Esqueça "últimos 30 dias" ou "últimos 90 dias". Os períodos são: mês, semana, dia. **Se o CSM não especificar o período, use SEMPRE o MÊS ATUAL** (do dia 1 até hoje) — é o padrão da casa. O raio_x_cliente já usa o mês atual por padrão; passe periodo='semana', 'dia' ou 'mes_anterior' quando pedirem outro. Para intervalos específicos, use metricas_periodo com datas. Deixe SEMPRE claro de qual período são os números (ex: "em julho, o cliente faturou...").

# ⚠️ Números da clínica = PAINEL (REGRA DE OURO — inviolável)
O raio_x traz o bloco **PAINEL DA CLÍNICA**, que é IDÊNTICO ao dashboard que o dono da clínica vê (leads, vendas, faturamento, ticket, conversão — por origem). **SEMPRE que citar leads, vendas, faturamento, ticket ou conversão, copie EXATAMENTE os números do PAINEL.** Nunca recalcule por conta própria, nunca use outra base, nunca arredonde diferente. Se um número seu não bater com o painel do cliente, VOCÊ está errado — use o do painel.
O bloco **ENTRADA DE NOVOS LEADS** (funil coorte) serve SÓ para avaliar a entrada de leads novos do mês — NÃO é o total de leads da clínica, NÃO é o total de vendas, e NÃO serve para calcular conversão. É PROIBIDO: (a) apresentar "leads novos" como se fosse o total de leads da clínica; (b) calcular conversão dividindo fechados-da-coorte por leads-novos. Para desempenho por origem, use SÓ o PAINEL.

# Regra crítica de resolução de cliente
Quando o CSM citar um cliente pelo NOME (ex: "Anna Clara", "Tayane"), você DEVE chamar listar_clientes para encontrar o organization_id correspondente e então usar esse org_id nas demais ferramentas. NUNCA peça o organization_id ao usuário — você já tem acesso a todos os clientes e resolve o nome sozinho. O "tempo de casa" e a fase esperada já vêm no resumo de cada cliente (listar_clientes / contexto do cliente em foco).

# Como você responde (formato fixo)
Estruture assim, sempre curto e direto:
1. **Leitura do momento** (2–3 linhas): fase da jornada, health 2-eixos e o PRINCIPAL gargalo/oportunidade, com o dado que embasa ("em julho, 8 agendados sem fechar = R$X parados"; "faturamento -18% vs junho"; "CRM sem uso há 21 dias").
2. **Ação do CSM agora**: a alavanca de CS específica (touchpoint / playbook / coaching / celebração / escalada), com:
   - o QUÊ (ex: "reunião de review de conversão", "pulso no WhatsApp", "Playbook de Risco"),
   - o OBJETIVO (o que você quer que o cliente destrave),
   - a PAUTA/COMO (o dado que você leva e o que orienta a equipe DELE a fazer),
   - o PRAZO/cadência (conforme a fase).
   Cite o playbook/cadência da metodologia que embasa (use consultar_documentacao se precisar).
3. Se houver risco, diga o NÍVEL e se ESCALA.
NUNCA feche com uma tarefa operacional da clínica (ver Regra Central). A "Ação do CSM agora" é sempre algo que o TIME DE CS faz.

# Regras de escrita
- Escreva EXCLUSIVAMENTE em português com alfabeto latino. É PROIBIDO emitir qualquer caractere de outro sistema de escrita (cirílico, árabe, grego, télugo, chinês, etc.) — se a palavra é "resposta", escreva "resposta".
- Refira-se ao CLIENTE sempre em TERCEIRA pessoa (o cliente, a clínica, a Dra. X). "Você" é o CSM com quem você fala, NUNCA o cliente. Ex: escreva "o cliente está em Execução", nunca "você está em Execução".
- Português correto com TODOS os acentos (médio, catálogo, período, análise, gráfico).
- ZERO emojis no corpo do texto.
- Não invente dados. Se não tiver o dado, use a ferramenta ou diga que não há registro.
- Você é consultivo: recomenda ações de CS, mas quem executa a operação é a clínica.
${memories ? `\n# Memória (o que você já sabe do time e dos clientes)\n${memories}` : ""}
${clientContext ? `\n# CONTEXTO DO CLIENTE EM FOCO\nEsta conversa é sobre um cliente específico. Estado atual:\n${clientContext}\nComece já contextualizado neste cliente. Se o CSM perguntar "o que faço agora", traga a próxima ação para ESTE cliente.` : `\n# MODO GERAL\nVocê está analisando a base inteira de clientes do CS. Comece com uma visão geral quando fizer sentido.`}${jornadaFocus ? `

# 🎯 JORNADA EM FOCO — você é o ESPECIALISTA desta jornada (o CSM está no editor dela)
O CSM abriu o EDITOR desta jornada específica e conta com você para MAPEAR e OTIMIZAR ela. Você já conhece a estrutura completa abaixo (blocos, tarefas, subtarefas, conteúdo e o que o cliente já concluiu) — trate-a como SUA. NÃO precisa chamar ver_jornadas_cliente: os dados já estão aqui.
Quando o CSM pedir qualquer mudança ("melhora a tarefa 2", "deixa o follow-up mais agressivo", "adiciona um bloco de reativação", "reescreve a descrição do bloco 1", "tira essa subtarefa"), você EDITA ESTA jornada chamando **salvar_jornada** com **id="<o id desta jornada>"** e a **org_id** informada abaixo, enviando a estrutura COMPLETA final e **preservando os ids** de blocos/tarefas/subtarefas que devem continuar existindo. NUNCA crie uma jornada nova aqui — o objetivo é evoluir ESTA.
Seja um consultor cirúrgico desta jornada: aponte fraquezas concretas dos blocos/tarefas com base nos dados do CRM, proponha melhorias específicas e aplique quando o CSM confirmar. Após salvar, resuma em 1-2 linhas o que mudou.
ESTRUTURA ATUAL (com ids):
${jornadaFocus}` : ""}`;
}

// ── Sanitização de saída ─────────────────────────────────────────────────────
// O modelo esporadicamente emite lixo unicode de outros alfabetos (cirílico,
// árabe, télugo, CJK...) no meio de palavras em PT-BR. Removemos qualquer
// caractere fora do latim para evitar o "árabe no meio da escrita".
const NON_LATIN = /[\u0370-\u03FF\u0400-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u077F\u0780-\u07BF\u0900-\u0DFF\u0E00-\u0FFF\u1100-\u11FF\u1E00-\u1EFF\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7FF\uF900-\uFAFF\uFB50-\uFDFF\uFE70-\uFEFF\uFF00-\uFFEF]/g;
function sanitizePt(text: string): string {
  if (!text) return text;
  return text
    .replace(NON_LATIN, "")
    .replace(/[ \t]{2,}/g, " ")   // colapsa espaços deixados pela remoção
    .replace(/ +([.,;:!?])/g, "$1"); // remove espaço antes de pontuação
}

// ── Memória ──────────────────────────────────────────────────────────────────
async function loadMemories(csmId: string, clientOrgId: string | null): Promise<string> {
  let q = supabaseAdmin.from("cs_athos_memories").select("tipo, conteudo, client_org_id")
    .eq("csm_id", csmId).order("atualizado_em", { ascending: false }).limit(30);
  const { data } = await q;
  if (!data || data.length === 0) return "";
  // Prioriza memórias do cliente em foco + memórias gerais.
  const rel = data.filter((m: any) => m.client_org_id == null || m.client_org_id === clientOrgId);
  return rel.slice(0, 20).map((m: any) => `- (${m.tipo}) ${m.conteudo}`).join("\n");
}

async function extractMemories(
  csmId: string, clientOrgId: string | null, conversationId: string | null,
  userMsg: string, assistantMsg: string,
): Promise<void> {
  try {
    const resp = await openrouter.chat.completions.create({
      model: EXTRACT_MODEL, temperature: 0, max_tokens: 500,
      messages: [
        { role: "system", content: `Extraia até 3 fatos/preferências/decisões NOVOS e duráveis sobre o cliente ou sobre como o CSM trabalha, a partir da troca abaixo. Ignore o que é efêmero. Responda APENAS um array JSON: [{"tipo":"fato|preferencia|decisao|instrucao|contexto","conteudo":"..."}]. Se nada relevante, responda [].` },
        { role: "user", content: `CSM: ${userMsg}\n\nAthos: ${assistantMsg}` },
      ],
    });
    const raw = resp.choices?.[0]?.message?.content?.trim() || "[]";
    const jsonStr = raw.replace(/^```json?/i, "").replace(/```$/, "").trim();
    const items = JSON.parse(jsonStr);
    if (!Array.isArray(items) || items.length === 0) return;
    const rows = items.slice(0, 3).map((it: any) => ({
      csm_id: csmId, client_org_id: clientOrgId,
      tipo: ["preferencia", "fato", "decisao", "instrucao", "contexto"].includes(it.tipo) ? it.tipo : "fato",
      conteudo: String(it.conteudo || "").slice(0, 500),
      fonte_conversation_id: conversationId,
    })).filter(r => r.conteudo.length > 3);
    if (rows.length) await supabaseAdmin.from("cs_athos_memories").insert(rows);
  } catch { /* fire-and-forget */ }
}

// ── Rascunhar jornada mensal (modo estruturado, não-chat) ────────────────────
async function handleRascunharJornada(body: any, authHeader: string): Promise<Response> {
  const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const clientOrgId: string | null = body.client_org_id ?? null;
  const crmUserId: string | null = body.crm_user_id ?? null;
  const periodoRef: string = body.periodo_ref ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  if (!crmUserId) return json({ error: "crm_user_id ausente" }, 400);

  const uc = userClient(authHeader);
  const mesLabel = new Date(periodoRef + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // 1. Contexto — raio-x do CRM, jornadas anteriores (pendências), materiais, diagnóstico
  const [raioXRes, prevRes, matsRes, diagRes] = await Promise.allSettled([
    clientOrgId ? uc.rpc("get_cs_client_raio_x", { p_org_id: clientOrgId, p_from: null, p_to: null }) : Promise.resolve({ data: null }),
    supabaseAdmin.from("jornadas")
      .select("id, titulo, periodo_ref, tipo, status, jornada_estagios(titulo, jornada_passos(titulo, concluido))")
      .eq("user_id", crmUserId).order("created_at", { ascending: false }).limit(3),
    supabaseAdmin.from("meus_materiais").select("titulo, categoria").eq("user_id", crmUserId).limit(50),
    supabaseAdmin.from("onboarding_diagnosticos").select("*").eq("user_id", crmUserId).maybeSingle(),
  ]);

  const raioX = raioXRes.status === "fulfilled" ? (raioXRes.value as any)?.data ?? null : null;
  const prevJornadas = prevRes.status === "fulfilled" ? (prevRes.value as any)?.data ?? [] : [];
  const materiais = matsRes.status === "fulfilled" ? (matsRes.value as any)?.data ?? [] : [];
  const diag = diagRes.status === "fulfilled" ? (diagRes.value as any)?.data ?? null : null;

  const pendentes: string[] = [];
  for (const j of prevJornadas) {
    for (const e of (j.jornada_estagios ?? [])) {
      for (const p of (e.jornada_passos ?? [])) {
        if (p && p.concluido === false) pendentes.push(p.titulo);
      }
    }
  }

  const contexto = [
    `PERÍODO ALVO: ${mesLabel}.`,
    raioX ? `RAIO-X DO CRM (dados reais):\n${JSON.stringify(raioX).slice(0, 3500)}` : "RAIO-X DO CRM: indisponível.",
    materiais.length ? `MATERIAIS JÁ CONSTRUÍDOS: ${materiais.map((m: any) => `${m.titulo} (${m.categoria ?? "—"})`).join("; ").slice(0, 1200)}` : "MATERIAIS JÁ CONSTRUÍDOS: nenhum.",
    pendentes.length ? `TAREFAS PENDENTES DO MÊS ANTERIOR (carregar as ainda relevantes): ${pendentes.join("; ").slice(0, 1200)}` : "TAREFAS PENDENTES: nenhuma.",
    diag ? `DIAGNÓSTICO DA CLÍNICA:\n${JSON.stringify(diag).slice(0, 2000)}` : "DIAGNÓSTICO: indisponível.",
  ].join("\n\n");

  const sys = [
    "Você é o Athos CS montando a JORNADA MENSAL de consultoria de um cliente (clínica). Esta jornada é o que a Descompliquei recomenda que a clínica FAÇA neste mês para evoluir comercialmente — tarefas para o dono da clínica executar (diferente do seu papel de coach do CSM; aqui você produz o plano de ação do cliente).",
    "Baseie-se nos DADOS REAIS do contexto (raio-x do CRM, materiais já construídos, pendências, diagnóstico) e na base comercial abaixo. Ataque o MAIOR GARGALO do funil primeiro. Carregue as pendências ainda relevantes.",
    "",
    COMMERCIAL_KNOWLEDGE_BASE,
    "",
    "Cada tarefa tem: titulo curto; conteudo_md (descrição rica em markdown, consultiva — o que fazer e por quê); tipo ('acao_livre' ou 'material'); se 'material', material_categoria ∈ [script_atendimento, estrutura_processo, quebra_objecao, oferta, followup_reativacao, otimizacao_comercial] e material_brief (o que construir); subtarefas (lista de strings, opcional); obrigatorio (bool). Use 'material' quando a tarefa é o cliente CONSTRUIR um ativo com o Athos GS.",
    "Responda EXCLUSIVAMENTE um JSON válido, sem texto fora dele, no formato:",
    `{"titulo":"Jornada de ${mesLabel}","estagios":[{"titulo":"...","descricao":"...","prazo_dias":7,"passos":[{"titulo":"...","conteudo_md":"...","tipo":"acao_livre|material","material_categoria":null,"material_brief":null,"obrigatorio":true,"subtarefas":["..."]}]}]}`,
    "3 a 6 estágios, cada um com 2 a 5 tarefas. Português com acentos, zero emojis, zero caracteres não-latinos.",
  ].join("\n");

  let parsed: any;
  try {
    const resp = await openrouter.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.4, max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, { role: "user", content: contexto }],
    });
    const raw = resp.choices?.[0]?.message?.content?.trim() || "{}";
    parsed = JSON.parse(raw.replace(/^```json?/i, "").replace(/```$/, "").trim());
  } catch (e) {
    return json({ error: "Falha ao gerar rascunho: " + String(e) }, 500);
  }

  if (!parsed?.titulo || !Array.isArray(parsed.estagios)) return json({ error: "Rascunho inválido gerado pela IA" }, 500);

  // 2. Persiste como rascunho (service role — bypassa RLS)
  const { data: jornada, error: jErr } = await supabaseAdmin.from("jornadas")
    .insert({ user_id: crmUserId, organization_id: clientOrgId, titulo: String(parsed.titulo).slice(0, 200), status: "rascunho", gerada_por: "ia", tipo: "mensal", periodo_ref: periodoRef })
    .select("id").single();
  if (jErr || !jornada) return json({ error: jErr?.message ?? "Erro ao criar jornada" }, 500);

  const CATS = new Set(["script_atendimento", "estrutura_processo", "quebra_objecao", "oferta", "followup_reativacao", "otimizacao_comercial"]);
  for (const [ei, est] of (parsed.estagios as any[]).slice(0, 8).entries()) {
    const { data: estagio } = await supabaseAdmin.from("jornada_estagios")
      .insert({ jornada_id: jornada.id, titulo: String(est.titulo ?? `Bloco ${ei + 1}`).slice(0, 200), descricao: est.descricao ? String(est.descricao).slice(0, 500) : null, ordem: ei, prazo_dias: Number(est.prazo_dias) || 7 })
      .select("id").single();
    if (!estagio) continue;
    for (const [pi, passo] of (est.passos ?? []).slice(0, 8).entries()) {
      const isMaterial = passo.tipo === "material" && CATS.has(passo.material_categoria);
      const { data: p } = await supabaseAdmin.from("jornada_passos")
        .insert({
          estagio_id: estagio.id,
          titulo: String(passo.titulo ?? `Tarefa ${pi + 1}`).slice(0, 200),
          conteudo_md: passo.conteudo_md ? String(passo.conteudo_md).slice(0, 4000) : null,
          ordem: pi,
          tipo: isMaterial ? "material" : "acao_livre",
          material_categoria: isMaterial ? passo.material_categoria : null,
          material_brief: isMaterial && passo.material_brief ? String(passo.material_brief).slice(0, 500) : null,
          obrigatorio: passo.obrigatorio !== false,
        })
        .select("id").single();
      if (p && Array.isArray(passo.subtarefas)) {
        const subs = passo.subtarefas.slice(0, 8).map((s: any, si: number) => ({ passo_id: p.id, titulo: String(s).slice(0, 200), ordem: si }));
        if (subs.length) await supabaseAdmin.from("jornada_subtarefas").insert(subs);
      }
    }
  }

  return json({ jornada_id: jornada.id, titulo: parsed.titulo });
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!(await isCallerAdmin(user.id)))
    return new Response(JSON.stringify({ error: "Acesso restrito ao time de CS (admin)" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  // Modo estruturado: rascunhar jornada mensal (não-chat)
  if (body?.mode === "rascunhar_jornada") return await handleRascunharJornada(body, authHeader);

  const { message, conversation_id, history = [], client_org_id = null, jornada_id = null, model: requestedModel } = body;
  const model = resolveModel(requestedModel);
  if (!message?.trim()) return new Response(JSON.stringify({ error: "Mensagem vazia" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const uc = userClient(authHeader);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => { try { controller.enqueue(encoder.encode("data: " + JSON.stringify(data) + "\n\n")); } catch { /**/ } };
      const globalTimeout = setTimeout(() => {
        try { send({ type: "error", message: "Tempo limite excedido (120s)." }); controller.close(); } catch { /**/ }
      }, 120_000);

      try {
        // Contexto do cliente (modo cliente)
        let clientContext: string | null = null;
        let convId: string | null = conversation_id ?? null;
        const baseCache: { base?: ClienteCS[] } = {};
        if (client_org_id) {
          const base = await carregarBase(uc);
          baseCache.base = base;
          const c = base.find(x => x.org_id === client_org_id);
          if (c) {
            const rx = await raioX(uc, client_org_id).catch(() => null);
            clientContext = resumoCliente(c) + "\n\nRAIO-X OPERACIONAL (estado atual do CRM):\n" + formatRaioX(rx);
          }
        }

        const memories = await loadMemories(user.id, client_org_id);
        const jornadaFocus = jornada_id ? await loadJornadaFocus(jornada_id) : null;
        const systemPrompt = buildCsSystemPrompt(clientContext, memories, jornadaFocus);

        const recentMsgs = (history || []).slice(-10).map((m: any) => ({ role: m.role, content: m.content }));
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...recentMsgs,
          { role: "user", content: message.trim() },
        ];

        let finalText = "";
        let iteration = 0;
        // Modelo ativo. Se o escolhido falhar (ex.: não suporta function calling
        // / indisponível), caímos automaticamente no DEFAULT_MODEL — tool-capable —
        // para que o Athos SEMPRE consiga editar a jornada e usar as ferramentas.
        let activeModel = model;
        let totalInput = 0, totalOutput = 0, toolCallsCount = 0;
        const t0 = Date.now();
        const stripNonLatin = (s: string) => s.replace(NON_LATIN, "");

        // Uma "rodada" de streaming: encaminha text_delta ao vivo e acumula
        // eventuais tool_calls (que vêm em fragmentos). Retorna o que veio.
        const runStreamTurn = async (useModel: string) => {
          const hb = setInterval(() => { try { send({ type: "heartbeat" }); } catch { /**/ } }, 3000);
          const abort = new AbortController();
          const to = setTimeout(() => abort.abort(), 90_000);
          try {
            const stream = await openrouter.chat.completions.create({
              model: useModel, messages, tools: TOOLS, tool_choice: "auto",
              temperature: 0.3, max_tokens: 4000, stream: true,
              stream_options: { include_usage: true },
            }, { signal: abort.signal }) as any;

            const toolAcc: Record<number, { id: string; name: string; args: string }> = {};
            let content = "";
            let usage: any = null;
            for await (const chunk of stream) {
              const delta = chunk?.choices?.[0]?.delta;
              if (delta?.content) {
                const piece = stripNonLatin(delta.content);
                if (piece) { content += piece; send({ type: "text_delta", delta: piece }); }
              }
              if (delta?.tool_calls) {
                for (const tcd of delta.tool_calls) {
                  const idx = tcd.index ?? 0;
                  if (!toolAcc[idx]) toolAcc[idx] = { id: "", name: "", args: "" };
                  if (tcd.id) toolAcc[idx].id = tcd.id;
                  if (tcd.function?.name) toolAcc[idx].name += tcd.function.name;
                  if (tcd.function?.arguments) toolAcc[idx].args += tcd.function.arguments;
                }
              }
              if (chunk?.usage) usage = chunk.usage;
            }
            const toolCalls = Object.values(toolAcc).filter(t => t.name);
            return { content, toolCalls, usage };
          } finally { clearTimeout(to); clearInterval(hb); }
        };

        while (iteration < MAX_TOOL_ITERATIONS) {
          iteration++;
          let turn: { content: string; toolCalls: { id: string; name: string; args: string }[]; usage: any };
          try {
            turn = await runStreamTurn(activeModel);
          } catch (e) {
            if (activeModel !== DEFAULT_MODEL) {
              console.log(`[cs-athos] modelo '${activeModel}' falhou (${(e as Error)?.message}); fallback → ${DEFAULT_MODEL}`);
              activeModel = DEFAULT_MODEL;
              turn = await runStreamTurn(DEFAULT_MODEL);
            } else throw e;
          }

          if (turn.usage) {
            totalInput += turn.usage.prompt_tokens ?? 0;
            totalOutput += turn.usage.completion_tokens ?? 0;
          }

          if (turn.toolCalls.length > 0) {
            messages.push({
              role: "assistant",
              content: turn.content || null,
              tool_calls: turn.toolCalls.map(t => ({ id: t.id, type: "function", function: { name: t.name, arguments: t.args } })),
            } as any);
            for (const tc of turn.toolCalls) {
              toolCallsCount++;
              let args: any = {};
              try { args = JSON.parse(tc.args || "{}"); } catch { /**/ }
              send({ type: "tool_start", name: tc.name });
              const result = await executeTool(tc.name, args, uc, baseCache, {
                onJornadaChanged: (jid) => send({ type: "jornada_changed", jornada_id: jid }),
              });
              send({ type: "tool_result", name: tc.name });
              messages.push({ role: "tool", tool_call_id: tc.id, content: result } as any);
            }
            continue;
          }

          finalText = turn.content;
          break;
        }

        send({ type: "usage", input_tokens: totalInput, output_tokens: totalOutput, total_time_ms: Date.now() - t0, tool_calls_count: toolCallsCount, model: activeModel });

        // Persistência de conversa + mensagens
        try {
          if (!convId) {
            const { data: conv } = await supabaseAdmin.from("cs_athos_conversations")
              .insert({ csm_id: user.id, client_org_id, titulo: message.trim().slice(0, 60) })
              .select("id").single();
            convId = conv?.id ?? null;
          } else {
            await supabaseAdmin.from("cs_athos_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
          }
          if (convId) {
            await supabaseAdmin.from("cs_athos_messages").insert([
              { conversation_id: convId, role: "user", content: message.trim() },
              { conversation_id: convId, role: "assistant", content: finalText },
            ]);
          }
        } catch { /**/ }

        send({ type: "done", conversation_id: convId });
        clearTimeout(globalTimeout);
        controller.close();

        // Auto-extração de memória (fire-and-forget)
        if (finalText.length > 40) {
          extractMemories(user.id, client_org_id, convId, message.trim(), finalText);
        }
      } catch (e) {
        clearTimeout(globalTimeout);
        const raw = (e as Error)?.message || "Erro interno";
        console.log("[cs-athos] erro final:", raw);
        const friendly = /provider|tool|\b400\b|model|function/i.test(raw)
          ? "Não consegui completar agora. Tente de novo — se persistir, troque o modelo no seletor."
          : raw;
        try { send({ type: "error", message: friendly }); controller.close(); } catch { /**/ }
      }
    },
  });

  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
});
