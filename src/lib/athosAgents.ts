import {
  Sparkles, Headphones, UserCheck, Search, Send, HeartHandshake, NotebookPen,
  type LucideIcon,
} from "lucide-react";
import type { AcessoProduto } from "@/contexts/PlataformaContext";

/**
 * REGISTRY CANÔNICO DOS AGENTES ATHOS
 * ------------------------------------
 * "Agentes de IA" é o hub (`/crm/athos`) que lista toda a inteligência que opera na clínica.
 * **Athos** é o chat/copiloto estratégico (nav própria, `/plataforma/athos-gs`) — destacado como
 * card de núcleo dentro do hub. As demais IAs que operam sozinhas no CRM são os **agentes do
 * Athos** (`Athos …`): Pré-Atendimento, Triagem, Follow-Up e Análise.
 *
 * Cada entrada carrega, além da apresentação, os metadados que a página individual do agente
 * (`/crm/athos/:agentId`) exibe: como funciona, gatilho, modelo e a fonte de atividade (`logSlug`).
 *
 * ⚠️ Reflete as IAs em operação (edge functions com gatilho real) — NÃO o catálogo antigo do
 * IAHub (`platform_ia_config`, lido só pelo `ia-proxy` legado). Não inclui `detect-pipeline-stage`
 * (legado — pipeline removido do CRM). CS/Admin são internos (gated) — nunca aparecem ao cliente.
 *
 * É config de apresentação; não faz queries. O status por org vem do `acesso` (entitlements) + papel.
 */

export type AthosCategoria = "nucleo" | "atendimento" | "analise" | "cs";

export type AthosGate =
  | { kind: "os" } // Athos (chat) — depende de acesso_os
  | { kind: "crm" } // opera no CRM — disponível quando a org tem acesso_crm
  | { kind: "admin" }; // interno — superadmin/admin

/** Ação principal do card no console. */
export type AthosAcao = "copiloto" | "config" | "abrir" | "auto";

export interface AthosAgent {
  id: string;
  /** Nome sob a marca Athos */
  nome: string;
  categoria: AthosCategoria;
  /** Benefício em uma linha (voltado ao cliente) */
  beneficio: string;
  badge: string;
  icon: LucideIcon;
  gate: AthosGate;
  acao: AthosAcao;
  /** Rota de destino da AÇÃO principal (config/copiloto/abrir). A página do agente é sempre /crm/athos/:id. */
  href?: string;
  /** Edge function que executa o agente (documentação/rastreio) */
  edgeFunction: string;
  /**
   * true = o on/off por org já é honrado pela edge function (via athos_agente_ativo).
   * Só agentes com enforcement real exibem o Switch — evita toggle enganoso.
   */
  enforced?: boolean;
  /** slug usado em athos_agentes_org (quando enforced) */
  gateSlug?: string;

  // ── Metadados da página individual (`AthosAgentPage`) ──────────────────────
  /** Frase-resumo do que o agente é (1–2 linhas), voltada ao cliente. */
  resumo: string;
  /** Passo a passo de "como funciona" — bullets curtos. */
  comoFunciona: string[];
  /** Como/quando o agente dispara — frase completa (seção "Como funciona"). */
  gatilho: string;
  /** Classificação curta do gatilho — usada no readout compacto do hero. */
  modoGatilho: "Automático" | "Sob demanda";
  /** Modelo(s) que executa por baixo (apresentação). */
  modelo: string;
  /**
   * Slug da fonte de atividade em `get_athos_eventos` (agente_slug do feed).
   * null = agente sem log rastreável no console (ex.: chat GS).
   */
  logSlug: string | null;
}

export interface AthosAccessCtx {
  acesso: AcessoProduto | null;
  isSuperAdmin: boolean;
  /**
   * true = a sessão está de fato na org master (não impersonando um cliente).
   * Necessário porque `role` continua "superadmin" mesmo durante impersonação de um cliente —
   * sem este segundo campo, o Athos CS (interno) vazaria para a visão do cliente impersonado.
   */
  isMasterOrg: boolean;
}

export const ATHOS_CATEGORIAS: Record<AthosCategoria, { label: string; descricao: string }> = {
  nucleo: { label: "Núcleo", descricao: "O cérebro estratégico da sua operação" },
  atendimento: { label: "Atendimento", descricao: "Na linha de frente do WhatsApp" },
  analise: { label: "Análise & Follow-up", descricao: "Cada conversa medida, nenhum lead esquecido" },
  cs: { label: "Sucesso do Cliente", descricao: "Acompanhamento e retenção (interno)" },
};

/**
 * Agentes que operam no CRM hoje, na ordem de exibição.
 */
export const ATHOS_AGENTS: AthosAgent[] = [
  {
    id: "gs",
    nome: "Athos",
    categoria: "nucleo",
    beneficio: "Copiloto estratégico que conhece sua clínica e monta planos, materiais e decisões",
    badge: "Inteligência geral",
    icon: Sparkles,
    gate: { kind: "os" },
    acao: "copiloto",
    href: "/plataforma/athos-gs",
    edgeFunction: "descompliquei-os",
    resumo:
      "O chat do Athos — especialista comercial que aplica a metodologia EVA (Estruturação, Validação, Ajuste) com base nos dados reais da sua clínica.",
    comoFunciona: [
      "Você abre o chat e conversa em linguagem natural.",
      "Ele lê o funil, os procedimentos e os dados comerciais da sua clínica para responder no seu contexto.",
      "Monta planos, jornadas e materiais comerciais, e consulta os dados do seu CRM quando preciso.",
      "Guarda memória entre conversas para não repetir o que já sabe de você.",
    ],
    gatilho: "Sob demanda — quando você abre o chat e envia uma mensagem.",
    modoGatilho: "Sob demanda",
    modelo: "Multi-modelo (Grok / GPT-5.x / Claude Opus)",
    logSlug: null,
  },
  {
    id: "recepcao",
    nome: "Athos Pré-Atendimento",
    categoria: "atendimento",
    beneficio: "Responde e qualifica seus leads 24h no WhatsApp — zero lead perdido por demora",
    badge: "Ativo 24h",
    icon: Headphones,
    gate: { kind: "crm" },
    acao: "config",
    edgeFunction: "whatsapp-ai-agent",
    enforced: true,
    gateSlug: "recepcao",
    resumo:
      "O primeiro toque com o lead. Atende no WhatsApp na hora, responde dúvidas e qualifica antes do time humano assumir.",
    comoFunciona: [
      "Toda mensagem nova de lead cai para o Pré-Atendimento antes de um humano.",
      "Ele lê a conversa e responde no tom e nas regras que você definiu na configuração.",
      "Usa os dados da clínica (procedimentos, FAQ, horários, pagamento) para responder certo.",
      "Quando o lead esquenta ou pede algo fora do script, transfere para o atendente humano.",
    ],
    gatilho: "Automático — a cada mensagem recebida de um lead no WhatsApp.",
    modoGatilho: "Automático",
    modelo: "GPT-4.1-mini",
    logSlug: "recepcao",
  },
  {
    id: "triagem",
    nome: "Athos Triagem",
    categoria: "atendimento",
    beneficio: "Classifica cada primeira mensagem que chega e organiza o lead automaticamente",
    badge: "Automático na entrada",
    icon: UserCheck,
    gate: { kind: "crm" },
    acao: "auto",
    edgeFunction: "triage-lead-ia",
    enforced: true,
    gateSlug: "triagem",
    resumo:
      "O porteiro inteligente. Na primeira mensagem, decide se é um lead de verdade e se o Pré-Atendimento deve assumir ou se vai direto para um humano.",
    comoFunciona: [
      "Dispara na primeira mensagem de cada contato novo.",
      "Classifica se é um lead real ou ruído (spam, engano, fornecedor).",
      "Decide se a IA de Pré-Atendimento assume ou encaminha para um humano.",
      "Registra o motivo da decisão — visível aqui na atividade do agente.",
    ],
    gatilho: "Automático — na 1ª mensagem de um contato.",
    modoGatilho: "Automático",
    modelo: "Classificação (LLM)",
    logSlug: "triagem",
  },
  {
    id: "analise",
    nome: "Athos Análise",
    categoria: "analise",
    beneficio: "Identifica contatos que foram cadastrados como lead por engano — e limpa sua base",
    badge: "Faxina de contatos",
    icon: Search,
    gate: { kind: "crm" },
    acao: "auto",
    edgeFunction: "analyze-non-leads",
    enforced: true,
    gateSlug: "analise",
    resumo:
      "A faxina da sua base. Revisa contatos que viraram \"lead\" por engano — candidato a vaga, fornecedor, número errado, spam, amigo pessoal — para você limpar sem perder paciente de verdade. Não tem relação com follow-up: aqui o alvo são contatos que talvez nunca devessem ter entrado como lead.",
    comoFunciona: [
      "Escolha o período de contatos a revisar bem aqui embaixo, em \"Rodar análise\".",
      "A IA lê a conversa de cada contato e decide se é lead real ou não (emprego, fornecedor, engano, spam, amigo pessoal).",
      "Você revisa a lista antes de qualquer ação — nada é apagado sozinho.",
      "Confirma a remoção: o contato é excluído e bloqueado permanentemente (não volta a entrar como lead).",
    ],
    gatilho: "Sob demanda — clique em \"Iniciar análise\" aqui na página.",
    modoGatilho: "Sob demanda",
    modelo: "GPT-4.1-mini",
    logSlug: "analise",
  },
  {
    id: "followup",
    nome: "Athos Follow-Up",
    categoria: "analise",
    beneficio: "Detecta o lead esfriando e dispara o follow-up na hora certa — nada esquecido no funil",
    badge: "Follow-up inteligente",
    icon: Send,
    gate: { kind: "crm" },
    acao: "config",
    edgeFunction: "analyze-followup-need + ia-followup-agent",
    enforced: true,
    gateSlug: "followup",
    resumo:
      "A rede de segurança do funil. Percebe o lead que JÁ é lead e esfriou — a equipe falou e ele sumiu — e dispara o follow-up no momento certo. Diferente do Athos Análise, que audita contatos que talvez nunca devessem ter virado lead.",
    comoFunciona: [
      "Monitora leads que já são leads e pararam de responder após a equipe falar.",
      "Decide se e quando vale um novo toque, sem parecer insistente.",
      "Você também pode ativar manualmente pela lista aqui embaixo, em \"Leads sem retorno\".",
      "Cada disparo fica registrado aqui na atividade do agente.",
    ],
    gatilho: "Automático — quando um lead esfria dentro da janela configurada.",
    modoGatilho: "Automático",
    modelo: "GPT-4.1-mini",
    logSlug: "followup",
  },
  {
    id: "escriba",
    nome: "Athos Escriba",
    categoria: "analise",
    beneficio: "Lê cada conversa — com IA ou humana — e mantém o cadastro do lead sempre preenchido",
    badge: "Enriquecimento automático",
    icon: NotebookPen,
    gate: { kind: "crm" },
    acao: "auto",
    edgeFunction: "athos-escriba",
    enforced: true,
    gateSlug: "escriba",
    resumo:
      "O secretário silencioso. Lê toda conversa do lead — respondida pela IA ou por um humano — e mantém preenchidos o resumo, o procedimento de interesse, o objetivo e a objeção. Assim o card do lead nunca fica vazio, mesmo quando a IA não atendeu.",
    comoFunciona: [
      "Roda sozinho a cada poucos minutos, depois que a conversa \"assenta\".",
      "Lê as últimas mensagens (de qualquer atendente) e extrai o essencial.",
      "Atualiza resumo, procedimento(s) de interesse, objetivo estético e objeção no lead.",
      "Não envia mensagem para ninguém — só organiza a informação para a equipe.",
    ],
    gatilho: "Automático — analisa o lead alguns minutos após a última mensagem.",
    modoGatilho: "Automático",
    modelo: "DeepSeek V4 Flash (OpenRouter)",
    logSlug: null,
  },
  {
    id: "cs",
    nome: "Athos CS",
    categoria: "cs",
    beneficio: "Copiloto de Customer Success — raio-x da carteira, risco de churn e próximos passos",
    badge: "Interno",
    icon: HeartHandshake,
    gate: { kind: "admin" },
    acao: "abrir",
    href: "/admin/cs",
    edgeFunction: "cs-athos",
    resumo:
      "Copiloto interno de Customer Success — não aparece para o cliente. Orienta o time de CS com base na carteira e na metodologia da casa.",
    comoFunciona: [
      "Uso exclusivo do time de CS (superadmin).",
      "Lê o CRM de cada clínica e cruza com a metodologia de CS.",
      "Aponta risco de churn e próximos passos por cliente.",
    ],
    gatilho: "Sob demanda — chat interno do time de CS.",
    modoGatilho: "Sob demanda",
    modelo: "GPT-5.x / Claude Opus",
    logSlug: null,
  },
];

/** Resolve se um agente está liberado para o contexto (org + papel). */
export function isAthosAgentLiberado(agent: AthosAgent, ctx: AthosAccessCtx): boolean {
  switch (agent.gate.kind) {
    case "os":
      return ctx.acesso?.acesso_os === true;
    case "crm":
      return ctx.acesso?.acesso_crm === true;
    case "admin":
      // Superadmin impersonando um cliente NÃO deve ver agentes internos — só na org master.
      return ctx.isSuperAdmin && ctx.isMasterOrg;
  }
}

/** Busca um agente pelo id (usado pela página individual). */
export function getAthosAgentById(id: string | undefined): AthosAgent | undefined {
  if (!id) return undefined;
  return ATHOS_AGENTS.find((a) => a.id === id);
}
