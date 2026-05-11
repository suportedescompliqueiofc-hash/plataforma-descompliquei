import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const XAI_API_KEY = Deno.env.get("XAI_API_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? XAI_API_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const PROMPT_BASE_CACHE_TTL_MS = 5 * 60 * 1000;
const PROMPT_BASE_MINIMO = `
# AGENTE DE PRÉ-ATENDIMENTO — DESCOMPLIQUEI

Você é o agente de pré-atendimento da clínica.
Fale de forma humana, acolhedora e profissional.
Use as informações personalizadas da clínica quando existirem.
Nunca informe preços, nunca invente dados e nunca tente agendar.
Sempre responda ao lead com clareza e uma pergunta por vez.
A IA não fecha, não negocia e não agenda.
`;

let promptBaseCache: { valor: string; carregadoEm: number } | null = null;
const grok = new OpenAI({ apiKey: XAI_API_KEY, baseURL: "https://api.x.ai/v1" });
const openrouter = new OpenAI({ apiKey: OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" });
const openaiWhisper = new OpenAI({ apiKey: OPENAI_API_KEY });

function resolveLlmClient(model: string): { client: OpenAI; provider: "openrouter" | "xai" } {
  if (model.startsWith("openrouter/")) {
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY nao configurada no Supabase Secrets.");
    }
    return { client: openrouter, provider: "openrouter" };
  }

  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY nao configurada no Supabase Secrets.");
  }

  return { client: grok, provider: "xai" };
}

async function loadPromptBase(): Promise<string> {
  const agora = Date.now();

  if (promptBaseCache && agora - promptBaseCache.carregadoEm < PROMPT_BASE_CACHE_TTL_MS) {
    return promptBaseCache.valor;
  }

  try {
    const { data, error } = await supabase
      .from("system_ai_config")
      .select("valor")
      .eq("chave", "prompt_base_agente")
      .maybeSingle();

    const valor = typeof data?.valor === "string" ? data.valor.trim() : "";

    if (error || !valor) {
      if (error) {
        console.error("[AI-Agent] Falha ao carregar prompt base:", error.message);
      }
      promptBaseCache = { valor: PROMPT_BASE_MINIMO, carregadoEm: agora };
      return PROMPT_BASE_MINIMO;
    }

    promptBaseCache = { valor, carregadoEm: agora };
    return valor;
  } catch (error) {
    console.error("[AI-Agent] Erro inesperado ao carregar prompt base:", error);
    promptBaseCache = { valor: PROMPT_BASE_MINIMO, carregadoEm: agora };
    return PROMPT_BASE_MINIMO;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Sistema de Logs ─────────────────────────────────────────────────────────

interface LogEntry {
  id?: string;
  organization_id: string;
  lead_id?: string | null;
  session_id?: string | null;
  status: "running" | "success" | "error";
  etapa: string;
  detalhe?: string | null;
  duracao_ms?: number | null;
  model?: string | null;
  partes_enviadas?: number | null;
  tool_calls?: unknown;
  erro_detalhe?: string | null;
}

async function upsertLog(entry: LogEntry): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_execution_logs")
    .insert({ ...entry, atualizado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (error) console.error("[LOG] Erro ao inserir log:", error.message);
  return data?.id ?? null;
}

async function updateLog(logId: string, patch: Partial<LogEntry>): Promise<void> {
  await supabase
    .from("ai_execution_logs")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("id", logId);
}

// ── Notificação de Erro para Admin via WhatsApp ─────────────────────────────

const ADMIN_NOTIFY_PHONE = "5521977297413";
const ADMIN_WA_URL = "https://odontonova.uazapi.com";
const ADMIN_WA_TOKEN = "434baaaf-4906-47f1-b0cf-1389a93e06e0";

// Rate limit: máximo 1 notificação a cada 2 minutos por org
const notifyRateLimit = new Map<string, number>();

async function notifyAdminError(info: {
  orgName: string;
  orgId: string;
  leadNome?: string | null;
  leadTelefone?: string | null;
  etapa: string;
  erro: string;
  modelo?: string | null;
  duracaoMs?: number | null;
}): Promise<void> {
  try {
    // Rate limit por org
    const now = Date.now();
    const lastNotify = notifyRateLimit.get(info.orgId) ?? 0;
    if (now - lastNotify < 120_000) {
      console.log(`[AI-Agent] Notificação admin suprimida (rate limit) para org ${info.orgId}`);
      return;
    }
    notifyRateLimit.set(info.orgId, now);

    const agora = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const mensagem = [
      `⚠️ *ERRO IA PRÉ-ATENDIMENTO*`,
      ``,
      `🏥 *Cliente:* ${info.orgName}`,
      `👤 *Lead:* ${info.leadNome || 'Não identificado'}`,
      `📱 *Telefone:* ${info.leadTelefone || 'N/A'}`,
      ``,
      `❌ *Etapa:* ${info.etapa}`,
      `📝 *Erro:* ${info.erro.substring(0, 300)}`,
      info.modelo ? `🤖 *Modelo:* ${info.modelo}` : null,
      info.duracaoMs ? `⏱️ *Duração:* ${info.duracaoMs}ms` : null,
      `🕐 *Horário:* ${agora}`,
    ].filter(Boolean).join("\n");

    await fetch(`${ADMIN_WA_URL}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "token": ADMIN_WA_TOKEN,
      },
      body: JSON.stringify({
        number: ADMIN_NOTIFY_PHONE,
        text: mensagem,
        delay: 0,
      }),
    });

    console.log(`[AI-Agent] ✅ Notificação de erro enviada ao admin`);
  } catch (e: any) {
    console.error(`[AI-Agent] Falha ao notificar admin:`, e?.message);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeOutgoingMessage(value: string): string {
  return value
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/\.+$/g, "");
}

function humanizeAndSplitLegacy(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  const MAX = 500;
  const MIN_MSG = 120;

  // 1. Formatação WhatsApp + abreviações
  let text = rawText
    .replace(/\*\*(.*?)\*\*/gs, "*$1*")
    .replace(/\bPrazer\b/g, "feliz em conhecer")
    .replace(/\bDra\.\s+/gi, "Dra ")
    .replace(/\bDr\.\s+/gi, "Dr ")
    .replace(/\bSr\.\s+/gi, "Sr ")
    .replace(/\bSra\.\s+/gi, "Sra ");

  // 2. Separar por parágrafo
  const blocks = text.split(/\n{2,}/);
  const messages: string[] = [];

  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;

    // 3. Listas bullet: manter como bloco
    const lines = b.split("\n");
    if (lines.some((l) => l.trim().startsWith("- "))) {
      messages.push(b);
      continue;
    }

    // 4. Separar em sentenças
    // Regex: quebra em . ! ? seguido de espaço,
    // MAS NÃO quebra se o próximo char é emoji ou minúscula
    // (evita quebrar no meio de 'Dr ' ou após emoji)
    const sentences = b
      .split(/(?<=[.!?])\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 5. Agrupar com lógica anti-fragmentação
    let current = "";

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const isQuestion = /[?]\s*$/.test(sentence);
      const candidate = current
        ? `${current} ${sentence}`
        : sentence;

      // Se a candidata estoura o MAX, envia current e
      // começa nova com a sentença atual
      if (candidate.length > MAX && current.length > 0) {
        messages.push(current.trim());
        current = sentence;
        continue;
      }

      // Pergunta: só isola se current já tem conteúdo
      // suficiente para ficar sozinha (>= MIN_MSG)
      if (isQuestion && current.length >= MIN_MSG) {
        messages.push(current.trim());
        current = sentence;
        continue;
      }

      // Sentença normal: acumula até ter conteúdo
      // suficiente
      if (current.length >= MIN_MSG
          && sentence.length >= MIN_MSG) {
        messages.push(current.trim());
        current = sentence;
      } else {
        current = candidate;
      }
    }

    if (current.trim()) messages.push(current.trim());
  }

  // 6. Pós-processamento: merge mensagens muito curtas
  const final: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i].trim();
    if (!msg) continue;

    // Se a mensagem é APENAS emoji(s) ou muito curta (<20
    // chars), merge com a anterior ou próxima
    const isOnlyEmoji = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(msg);
    const isTooShort = msg.length < 20 && !msg.endsWith("?");

    if ((isOnlyEmoji || isTooShort) && final.length > 0) {
      // Merge com a mensagem anterior
      final[final.length - 1] += ` ${msg}`;
    } else if ((isOnlyEmoji || isTooShort)
               && i + 1 < messages.length) {
      // Merge com a próxima
      messages[i + 1] = `${msg} ${messages[i + 1]}`;
    } else {
      final.push(msg);
    }
  }

  // 7. Limpeza final
  return final
    .map((m) => m.trim().replace(/\.+$/, ""))
    .filter((m) => m.length > 0);
}

function humanizeAndSplit(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  const IDEAL_MIN = 80;
  const IDEAL_MAX = 280;
  const HARD_MAX = 320;
  const SHORT_SENTENCE = 60;
  const MAX_MESSAGES = 4;

  const text = rawText
    .replace(/\*\*(.*?)\*\*/gs, "*$1*")
    .replace(/\bPrazer\b/g, "feliz em conhecer")
    .replace(/\bDra\.\s+/gi, "Dra ")
    .replace(/\bDr\.\s+/gi, "Dr ")
    .replace(/\bSr\.\s+/gi, "Sr ")
    .replace(/\bSra\.\s+/gi, "Sra ");

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const isQuestion = (value: string) => /[?]\s*$/.test(value.trim());
  const isOnlyEmoji = (value: string) => {
    const trimmed = value.trim();
    const lettersOnly = trimmed.replace(/[^\p{L}]/gu, "");
    return trimmed.length < 5 && lettersOnly.length === 0;
  };
  const startsWithEmoji = (value: string) => /^\p{Extended_Pictographic}/u.test(value.trim());
  const extractLeadingEmoji = (value: string) => {
    const trimmed = value.trim();
    const match = trimmed.match(/^((?:\p{Extended_Pictographic}\uFE0F?[\u200D\p{Extended_Pictographic}\uFE0F?]*)+)/u);
    if (!match) return null;
    return match[1];
  };
  const removeLeadingEmoji = (value: string) => {
    const trimmed = value.trim();
    const leadingEmoji = extractLeadingEmoji(trimmed);
    if (!leadingEmoji) return trimmed;
    return trimmed.slice(leadingEmoji.length).trim();
  };
  const cleanMessage = (value: string) => value.trim().replace(/[ \t]+/g, " ");
  const splitSentences = (value: string) =>
    value
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  const attachLeadingEmoji = (sentences: string[]) => {
    const result: string[] = [];
    for (const sentence of sentences) {
      if (!result.length) {
        result.push(sentence);
        continue;
      }

      if (isOnlyEmoji(sentence)) {
        result[result.length - 1] = `${result[result.length - 1]} ${sentence}`.trim();
        continue;
      }

      if (startsWithEmoji(sentence)) {
        const withoutEmoji = removeLeadingEmoji(sentence);
        if (withoutEmoji) {
          result[result.length - 1] = `${result[result.length - 1]} ${extractLeadingEmoji(sentence)}`.trim();
          result.push(withoutEmoji);
          continue;
        }
      }

      result.push(sentence);
    }
    return result;
  };
  const splitNearMiddle = (value: string) => {
    const sentences = attachLeadingEmoji(splitSentences(value));
    if (sentences.length <= 1) return [value.trim()];

    const totalLength = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
    const middle = totalLength / 2;
    let running = 0;
    let bestIndex = 1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 1; i < sentences.length; i++) {
      running += sentences[i - 1].length;
      const distance = Math.abs(middle - running);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    return [
      sentences.slice(0, bestIndex).join(" ").trim(),
      sentences.slice(bestIndex).join(" ").trim(),
    ].filter((part) => part.length > 0);
  };

  const messages: string[] = [];
  const pushWithLimit = (value: string) => {
    const trimmed = cleanMessage(value);
    if (!trimmed) return;
    if (trimmed.length > HARD_MAX) {
      for (const part of splitNearMiddle(trimmed)) {
        pushWithLimit(part);
      }
      return;
    }
    messages.push(trimmed);
  };

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.some((line) => line.trim().startsWith("- "))) {
      pushWithLimit(block);
      continue;
    }

    const sentences = attachLeadingEmoji(splitSentences(block));
    if (sentences.length === 0) continue;

    let current = "";

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      if (isQuestion(sentence)) {
        if (current.trim().length >= SHORT_SENTENCE) {
          pushWithLimit(current);
          current = "";
        } else if (current.trim()) {
          current = `${current} ${sentence}`.trim();
          continue;
        }

        pushWithLimit(sentence);
        continue;
      }

      if (!current) {
        current = sentence;
        continue;
      }

      const candidate = `${current} ${sentence}`.trim();
      const shouldJoinShortSentence = sentence.length < SHORT_SENTENCE
        && i + 1 < sentences.length
        && !isQuestion(sentences[i + 1]);

      if (candidate.length > HARD_MAX) {
        pushWithLimit(current);
        current = sentence;
        continue;
      }

      if (current.length < IDEAL_MIN || shouldJoinShortSentence) {
        current = candidate;
        continue;
      }

      if (current.length >= IDEAL_MIN && current.length <= IDEAL_MAX) {
        pushWithLimit(current);
        current = sentence;
        continue;
      }

      current = candidate;
    }

    if (current.trim()) pushWithLimit(current);
  }

  const normalized: string[] = [];
  for (const message of messages) {
    if (isOnlyEmoji(message)) {
      if (normalized.length > 0) {
        normalized[normalized.length - 1] = `${normalized[normalized.length - 1]} ${message}`.trim();
      }
      continue;
    }

    if (startsWithEmoji(message) && normalized.length > 0) {
      const emoji = extractLeadingEmoji(message);
      const rest = removeLeadingEmoji(message);
      normalized[normalized.length - 1] = `${normalized[normalized.length - 1]} ${emoji}`.trim();
      if (!rest) {
        continue;
      }
      if (isOnlyEmoji(rest)) {
        normalized[normalized.length - 1] = `${normalized[normalized.length - 1]} ${rest}`.trim();
        continue;
      }
      if (rest.length < SHORT_SENTENCE && !isQuestion(rest)) {
        normalized[normalized.length - 1] = `${normalized[normalized.length - 1]} ${rest}`.trim();
        continue;
      }
      normalized.push(rest);
      continue;
    }

    if (
      normalized.length > 0
      && normalized[normalized.length - 1].length < SHORT_SENTENCE
      && !isQuestion(normalized[normalized.length - 1])
    ) {
      normalized[normalized.length - 1] = `${normalized[normalized.length - 1]} ${message}`.trim();
      continue;
    }

    normalized.push(message);
  }

  while (normalized.length > MAX_MESSAGES) {
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < normalized.length - 1; i++) {
      if (isQuestion(normalized[i]) || isQuestion(normalized[i + 1])) continue;

      const combinedLength = normalized[i].length + normalized[i + 1].length + 1;
      if (combinedLength > HARD_MAX) continue;

      const distanceFromIdeal = Math.abs(IDEAL_MAX - combinedLength);
      if (distanceFromIdeal < bestScore) {
        bestScore = distanceFromIdeal;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      bestIndex = 0;
    }

    normalized[bestIndex] = `${normalized[bestIndex]} ${normalized[bestIndex + 1]}`.trim();
    normalized.splice(bestIndex + 1, 1);
  }

  return normalized
    .map((message) => normalizeOutgoingMessage(cleanMessage(message)))
    .filter((message) => message.length > 0 && !isOnlyEmoji(message));
}

// ── Divisão inteligente via GPT-4.1-mini ────────────────────────────────────

async function humanizeAndSplitWithAI(texto: string): Promise<string[]> {
  if (texto.length < 100) return [texto];

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey || openaiKey === XAI_API_KEY) {
    console.log("[SPLIT-AI] OPENAI_API_KEY não configurada, usando fallback local");
    return humanizeAndSplit(texto);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `Você é especialista em dividir mensagens do WhatsApp de forma natural e humanizada.

REGRAS:
1. Divida em partes lógicas com máximo 300 caracteres por parte
2. NUNCA crie mensagens vazias
3. Mantenha contexto e fluidez — cada parte deve fazer sentido sozinha
4. Preserve emojis e formatação
5. NUNCA corte no meio de palavras ou frases
6. Quebre APENAS em: ponto final (.), exclamação (!), interrogação (?), ou quebra de linha
7. NUNCA quebre por vírgula
8. NÃO coloque ponto final no final das mensagens — mais humanizado
9. NUNCA divida listas com traços ("- ") — mantenha a lista inteira em um único bloco
10. Prefira partes menores e mais naturais — como um humano digitaria no WhatsApp
11. Máximo 1 ponto de exclamação ou interrogação por bloco

FORMATAÇÃO WHATSAPP:
- Use *texto* para negrito (nunca **)
- Preserve emojis exatamente como estão

SAÍDA: Retorne APENAS o JSON, sem texto adicional:
{"messages": ["parte 1", "parte 2", "parte 3"]}`,
          },
          {
            role: "user",
            content: `Divida esta mensagem:\n\n${texto}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON não encontrado na resposta");

    const parsed = JSON.parse(jsonMatch[0]);
    const messages: string[] = parsed.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Array de mensagens inválido ou vazio");
    }

    const validas = messages.filter((m) => typeof m === "string" && m.trim().length > 0);
    if (validas.length === 0) throw new Error("Nenhuma mensagem válida após filtro");

    console.log(`[SPLIT-AI] Sucesso: ${validas.length} partes via GPT-4.1-mini`);
    return validas;
  } catch (error: any) {
    console.error("[SPLIT-AI] Erro, usando fallback local:", error?.message);
    return humanizeAndSplit(texto);
  }
}

// Alias para compatibilidade — agora usa divisão inteligente com fallback
const splitMessage = humanizeAndSplitWithAI;

async function transcribeAudio(mediaPath: string): Promise<string | null> {
  try {
    const bucket = "media-mensagens";
    const cleanPath = mediaPath.startsWith(`${bucket}/`) ? mediaPath.slice(bucket.length + 1) : mediaPath;
    const { data: blob, error } = await supabase.storage.from(bucket).download(cleanPath);
    if (error || !blob) {
      console.error("[AI-Agent] Erro ao baixar áudio:", error?.message);
      return null;
    }
    const file = new File([blob], "audio.ogg", { type: "audio/ogg" });
    const transcription = await openaiWhisper.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "pt",
    });
    return transcription.text || null;
  } catch (e: any) {
    console.error("[AI-Agent] Erro Whisper:", e?.message);
    return null;
  }
}

async function loadMemory(sessionId: string, orgId: string, limit = 15): Promise<Array<{ role: string; content: string }>> {
  const { data } = await supabase
    .from("memoria_agente")
    .select("message")
    .eq("session_id", sessionId)
    .eq("organization_id", orgId)
    .order("id", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return data.map((row) => row.message as { role: string; content: string }).reverse();
}

async function saveMemory(sessionId: string, orgId: string, role: string, content: string): Promise<void> {
  await supabase.from("memoria_agente").insert({
    session_id: sessionId,
    organization_id: orgId,
    message: { role, content },
  });
}

function getTools(promptCrm?: string | null): OpenAI.Chat.ChatCompletionTool[] {
  const baseDescription =
    "Gerencia o CRM: salva resumo da conversa, atualiza informações do lead (nome, procedimento de interesse, queixa) e move a fase do pipeline. Use quando o cliente confirmar interesse, informar dados pessoais, ou avançar na qualificação.";
  const crmDescription = promptCrm
    ? `${baseDescription}\n\nRegras adicionais: ${promptCrm}`
    : baseDescription;

  return [
    {
      type: "function",
      function: {
        name: "crm",
        description: crmDescription,
        parameters: {
          type: "object",
          properties: {
            resumo: { type: "string", description: "Resumo completo da conversa para a equipe comercial." },
            nome_lead: { type: "string", description: "Nome do lead, se informado na conversa." },
            procedimento_interesse: { type: "string", description: "Procedimento ou serviço de interesse identificado." },
            nova_posicao_pipeline: {
              type: "number",
              description: "Número da nova posição no pipeline (1=Novo, 2=Em Atendimento, 3=Qualificado, 4=Proposta, 5=Fechado).",
            },
          },
          required: ["resumo"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "notificacao",
        description:
          "Transfere o atendimento para a equipe humana (ex: secretária/médico) e DESATIVA a IA permanentemente para este lead. " +
          "O momento exato e a regra de quando acionar esta ferramenta dependem ESTRITAMENTE das instruções definidas no seu System Prompt base.",
        parameters: {
          type: "object",
          properties: {
            resumo: { type: "string", description: "Resumo detalhado de todo o atendimento para a equipe humana assumir de onde você parou." },
            nome_lead: { type: "string", description: "Nome do lead, se informado na conversa." },
          },
          required: ["resumo"],
        },
      },
    },
  ];
}

async function executeCrm(args: any, leadId: string): Promise<string> {
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (args.resumo) updates.resumo = args.resumo;
  if (args.nome_lead) updates.nome = args.nome_lead;
  if (args.procedimento_interesse) updates.procedimento_interesse = args.procedimento_interesse;
  if (typeof args.nova_posicao_pipeline === "number") updates.posicao_pipeline = args.nova_posicao_pipeline;

  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) {
    console.error("[AI-Agent] Erro CRM update:", error.message);
    return JSON.stringify({ ok: false, error: error.message });
  }
  console.log("[AI-Agent] CRM atualizado:", Object.keys(updates).join(", "));
  return JSON.stringify({ 
    ok: true, 
    campos_atualizados: Object.keys(updates),
    SYSTEM_INSTRUCTION: "Obrigatório: Agora retome a conversa com o cliente IMEDIATAMENTE respondendo como o atendente humano da clínica. O cliente está aguardando sua resposta. VOCÊ DEVE OBRIGATORIAMENTE RESPONDER AO LEAD. NUNCA GERE UMA RESPOSTA VAZIA OU APENAS UMA NOTA INTERNA."
  });
}

async function executeNotificacao(
  args: any, leadId: string, orgId: string
): Promise<string> {
  const nome = args.nome_lead || "Não informado";
  const resumo = args.resumo || "Sem resumo";

  // Formatar notificação limpa e estruturada
  const mensagem = [
    `🚨 *LEAD PRONTO PARA ATENDIMENTO*`,
    ``,
    `👤 *Nome:* ${nome}`,
    `📱 *Origem:* Marketing (IA)`,
    ``,
    `📋 *Resumo do Atendimento:*`,
    resumo,
    ``,
    `⚡ *Ação:* Entrar em contato o mais rápido possível.`,
    `O lead está aquecido e pronto para o fechamento.`,
  ].join("\n");

  await supabase.from("notificacoes").insert({
    lead_id: leadId,
    organization_id: orgId,
    mensagem,
    status: "pendente",
  });

  await supabase.from("leads").update({
    ia_ativa: false,
    ia_paused_until: null,
  }).eq("id", leadId);

  console.log(
    `[AI-Agent] Equipe notificada. IA bloqueada: ${leadId}`
  );
  return JSON.stringify({
    ok: true,
    message: "Equipe notificada. IA desativada.",
  });
}

async function processToolCalls(
  toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
  leadId: string,
  orgId: string
): Promise<OpenAI.Chat.ChatCompletionToolMessageParam[]> {
  const results: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
  for (const tc of toolCalls) {
    let resultContent = "";
    const args = JSON.parse(tc.function.arguments);
    if (tc.function.name === "crm") {
      resultContent = await executeCrm(args, leadId);
    } else if (tc.function.name === "notificacao") {
      resultContent = await executeNotificacao(args, leadId, orgId);
    } else {
      resultContent = JSON.stringify({ ok: false, error: "Tool desconhecida" });
    }
    results.push({ role: "tool", tool_call_id: tc.id, content: resultContent });
  }
  return results;
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const { lead_id, organization_id: orgId, mensagem_usuario, tipo_mensagem = "texto", media_path = null, historico_conversa = null } = body;
  if (!lead_id || !orgId) return jsonResponse({ error: "lead_id e organization_id são obrigatórios" }, 400);

  const globalStart = Date.now();
  let execLogId: string | null = null;

  try {
    // ── LOG INICIAL ──
    execLogId = await upsertLog({
      organization_id: orgId,
      lead_id,
      status: "running",
      etapa: "iniciando",
      detalhe: "Recebida requisição. Verificando lead e configurações...",
    });

    // 0. Nome da organização (para notificações)
    const { data: orgData } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
    const orgName = orgData?.name || orgId;

    // 1. Lead
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, nome, telefone, ia_ativa, ia_paused_until, ai_pending_since, posicao_pipeline, origem")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      if (execLogId) await updateLog(execLogId, { status: "error", etapa: "erro_lead", erro_detalhe: "Lead não encontrado.", duracao_ms: Date.now() - globalStart });
      return jsonResponse({ error: "lead_not_found" }, 404);
    }

    if (lead.ia_ativa === false) {
      if (execLogId) await updateLog(execLogId, { status: "error", etapa: "bloqueado", detalhe: "IA bloqueada (transbordo humano ativo).", duracao_ms: Date.now() - globalStart });
      return jsonResponse({ ok: false, reason: "ia_bloqueada" });
    }

    if (lead.ia_paused_until && new Date(lead.ia_paused_until) > new Date()) {
      if (execLogId) await updateLog(execLogId, { status: "error", etapa: "pausada", detalhe: `IA pausada até ${lead.ia_paused_until}.`, duracao_ms: Date.now() - globalStart });
      return jsonResponse({ ok: false, reason: "ia_pausada" });
    }

    if (lead.ai_pending_since) {
      if (execLogId) await updateLog(execLogId, { status: "success", etapa: "acumulando", detalhe: "Já existe execução em curso para este lead. Mensagem será acumulada.", duracao_ms: Date.now() - globalStart });
      return jsonResponse({ ok: true, reason: "acumulando" });
    }

    // 2. Config IA
    const { data: aiConfig } = await supabase
      .from("organization_ai_prompts")
      .select("prompt, prompt_crm, ia_ativa, modelo_ia, delay_entre_mensagens, acumulo_mensagens, horario_atendimento, formas_pagamento, contraindicacoes, palavras_proibidas")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!aiConfig?.ia_ativa || !aiConfig?.prompt) {
      if (execLogId) await updateLog(execLogId, { status: "error", etapa: "erro_config", erro_detalhe: "IA não configurada para esta organização.", duracao_ms: Date.now() - globalStart });
      return jsonResponse({ ok: false, reason: "ia_nao_configurada" });
    }

    const modeloRaw = aiConfig.modelo_ia || "grok-3-fast";
    const { client: llmClient, provider: llmProvider } = resolveLlmClient(modeloRaw);
    const modelo = modeloRaw.startsWith("openrouter/") ? modeloRaw.slice("openrouter/".length) : modeloRaw;
    const delayMs = aiConfig.delay_entre_mensagens || 2000;
    const acumuloSeg = (aiConfig.acumulo_mensagens || 45) * 1000;
    const crmToolsDynamic = getTools(aiConfig.prompt_crm);

    // 3. Acúmulo
    const pendingSince = new Date().toISOString();
    await supabase.from("leads").update({ ai_pending_since: pendingSince }).eq("id", lead_id);

    if (execLogId) await updateLog(execLogId, {
      status: "running",
      etapa: "aguardando_acumulo",
      detalhe: `Aguardando ${acumuloSeg / 1000}s para acumular mensagens do lead "${lead.nome || lead_id}"...`,
      model: modelo,
    });

    await wait(acumuloSeg);

    // 4. Coleta msgs acumuladas
    const { data: recentMsgs } = await supabase
      .from("mensagens")
      .select("conteudo, tipo_conteudo, media_path, criado_em")
      .eq("lead_id", lead_id)
      .eq("direcao", "entrada")
      .gte("criado_em", pendingSince)
      .order("criado_em", { ascending: true });

    await supabase.from("leads").update({ ai_pending_since: null }).eq("id", lead_id);

    let userMessageFinal = "";
    const sessionId = lead_id;

    if (recentMsgs && recentMsgs.length > 0) {
      if (execLogId) await updateLog(execLogId, {
        status: "running",
        etapa: "processando_mensagens",
        detalhe: `${recentMsgs.length} mensagem(ns) acumulada(s). Processando conteúdo...`,
      });

      const parts: string[] = [];
      for (const msg of recentMsgs) {
        if (msg.tipo_conteudo === "audio" && msg.media_path) {
          if (execLogId) await updateLog(execLogId, { status: "running", etapa: "transcrevendo_audio", detalhe: `Transcrevendo áudio via Whisper...` });
          const transcricao = await transcribeAudio(msg.media_path);
          if (transcricao) {
            parts.push(`[Áudio transcrito]: ${transcricao}`);
            if (execLogId) await updateLog(execLogId, { status: "running", etapa: "audio_transcrito", detalhe: `Áudio transcrito com sucesso: "${transcricao.slice(0, 80)}..."` });
          }
        } else if (msg.tipo_conteudo === "texto" && msg.conteudo) {
          parts.push(msg.conteudo);
        } else if (msg.tipo_conteudo === "imagem") {
          parts.push("[Imagem recebida - a IA não suporta processamento de imagens]");
        } else if (msg.conteudo) {
          parts.push(`[${msg.tipo_conteudo}]: ${msg.conteudo ?? ""}`);
        }
      }
      userMessageFinal = parts.join("\n");
    } else {
      userMessageFinal = mensagem_usuario || "";
      if (tipo_mensagem === "audio" && media_path) {
        if (execLogId) await updateLog(execLogId, { status: "running", etapa: "transcrevendo_audio", detalhe: "Transcrevendo áudio via Whisper..." });
        const transcricao = await transcribeAudio(media_path);
        if (transcricao) userMessageFinal = `[Áudio transcrito]: ${transcricao}`;
      } else if (tipo_mensagem === "imagem") {
        userMessageFinal = "[Imagem recebida - a IA não suporta processamento de imagens]";
      }
    }

    if (!userMessageFinal.trim()) {
      if (execLogId) await updateLog(execLogId, { status: "error", etapa: "mensagem_vazia", erro_detalhe: "Nenhum conteúdo de texto ou áudio encontrado para processar.", duracao_ms: Date.now() - globalStart });
      return jsonResponse({ ok: false, reason: "mensagem_vazia" });
    }

    // Sanitizar userMessageFinal para remover qualquer referência a URLs de mídia
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const mediaBucket = "media-mensagens";
    const sanitizedMessage = userMessageFinal
      .replace(urlPattern, "[link de mídia removido]")
      .replace(new RegExp(mediaBucket, 'gi'), "[mídia]");
    
    console.log(`[AI-Agent] Mensagem final (sanitizada, ${sanitizedMessage.length} chars):`, sanitizedMessage.substring(0, 300));

    // 5. Memória
    if (execLogId) await updateLog(execLogId, { status: "running", etapa: "carregando_memoria", detalhe: "Carregando histórico de conversa..." });
    let memoria = await loadMemory(sessionId, orgId);

    // Se a memoria_agente está vazia mas recebemos historico_conversa (disparo manual),
    // usar o histórico real da conversa como contexto para a IA
    if (memoria.length === 0 && Array.isArray(historico_conversa) && historico_conversa.length > 0) {
      console.log(`[AI-Agent] Memoria vazia, usando historico_conversa fornecido (${historico_conversa.length} msgs)`);
      memoria = historico_conversa
        .filter((m: any) => m.role && m.content)
        .map((m: any) => ({ role: m.role as string, content: m.content as string }));
    }

    const dadosCliente = (aiConfig.prompt ?? "").trim();
    const promptBaseAgente = await loadPromptBase();

    // --- Montar secoes dos novos campos ---
    const horario = aiConfig.horario_atendimento;
    let horarioStr = '';
    if (horario) {
      const parts: string[] = [];
      if (horario.weekday_open && horario.weekday_close)
        parts.push(`Segunda a Sexta: ${horario.weekday_open} as ${horario.weekday_close}`);
      if (!horario.saturday_closed && horario.saturday_open && horario.saturday_close)
        parts.push(`Sabado: ${horario.saturday_open} as ${horario.saturday_close}`);
      else parts.push('Sabado: Fechado');
      if (horario.sunday_closed !== false)
        parts.push('Domingo: Fechado');
      if (parts.length > 0)
        horarioStr = `\n\n## HORARIO DE ATENDIMENTO HUMANO\n${parts.join('\n')}`;
    }

    const pgto = aiConfig.formas_pagamento;
    let pgtoStr = '';
    if (pgto) {
      const metodos: string[] = [];
      if (pgto.pix) metodos.push('Pix');
      if (pgto.dinheiro) metodos.push('Dinheiro');
      if (pgto.credito) metodos.push('Cartao de credito');
      if (pgto.debito) metodos.push('Cartao de debito');
      if (metodos.length > 0) {
        pgtoStr = `\n\n## FORMAS DE PAGAMENTO\n${metodos.join(', ')}`;
        if (pgto.parcelamento)
          pgtoStr += `\nParcelamento: ${pgto.parcelamento}`;
        if (pgto.observacoes)
          pgtoStr += `\n${pgto.observacoes}`;
      }
    }

    const contra = (aiConfig.contraindicacoes || '').trim();
    let contraStr = '';
    if (contra)
      contraStr = `\n\n## CONTRAINDICACOES\n${contra}`;

    const palavras = aiConfig.palavras_proibidas || [];
    let palavrasStr = '';
    if (palavras.length > 0)
      palavrasStr = `\n\n## PALAVRAS PROIBIDAS\nNunca use: ${palavras.join(', ')}`;

    // --- Extrair configuração de emojis do prompt ---
    // O prompt tem a seção "## EMOJIS" com "A IA deve usar emojis?: Sim/Não" e "Emojis permitidos: ..."
    let emojiRegraStr = '';
    const promptTexto = aiConfig.prompt ?? '';
    const emojiSectionMatch = promptTexto.match(/##\s*EMOJIS\s*\n([\s\S]*?)(?=\n##|\n===|$)/i);
    if (emojiSectionMatch) {
      const emojiSection = emojiSectionMatch[1];
      const usarEmojiMatch = emojiSection.match(/A IA deve usar emojis\?:\s*(Sim|N[ãa]o)/i);
      const usarEmoji = usarEmojiMatch ? usarEmojiMatch[1].toLowerCase() === 'sim' : false;
      if (usarEmoji) {
        const emojisPermitidosMatch = emojiSection.match(/Emojis permitidos:\s*(.+)/i);
        const emojisPermitidos = emojisPermitidosMatch ? emojisPermitidosMatch[1].trim() : '';
        if (emojisPermitidos) {
          emojiRegraStr = `\n\n6. USE EMOJIS: Você DEVE usar emojis em suas mensagens. Os emojis permitidos são: ${emojisPermitidos}. Use-os naturalmente ao longo das respostas para transmitir calor humano.`;
        } else {
          emojiRegraStr = `\n\n6. USE EMOJIS: Você DEVE usar emojis em suas mensagens para transmitir calor humano e proximidade.`;
        }
      } else if (usarEmojiMatch) {
        emojiRegraStr = `\n\n6. NÃO USE EMOJIS: A clínica configurou para não usar emojis. Não use nenhum emoji em suas respostas.`;
      }
    }

    const agora = new Date();
    const dataAtual = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(agora);
    const horaAtual = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(agora);

    // --- promptFinal com os novos campos ---
    const promptFinal = promptBaseAgente
      + (dadosCliente
        ? `\n\n=== DADOS PERSONALIZADOS DA CLINICA ===\n${dadosCliente}`
        : '')
      + horarioStr
      + pgtoStr
      + contraStr
      + palavrasStr
      + `\n\n=== REGRAS ESTRITAS E INEGOCIAVEIS ===\n`
      + `1. Use a tool 'crm' em TODA interacao com informacao relevante do lead.\n`
      + `2. NUNCA pule o CRM. Mesmo em respostas simples, registre o resumo.\n`
      + `3. NUNCA diga ao lead 'dados atualizados', 'notifiquei a equipe', 'salvei no sistema'. Ferramentas sao invisiveis.\n`
      + `4. Aja 100% como atendente humano da clinica.\n`
      + `5. SEMPRE responda ao lead com mensagem de texto apos usar qualquer ferramenta.`
      + emojiRegraStr
      + `\n\n=== DATA E HORA ATUAL ===\n`
      + `Data: ${dataAtual}\nHora: ${horaAtual} (horario de Brasilia)`;

    const promptReforcadoComDataHora = promptFinal;

    // Montar array de mensagens: system prompt + histórico + mensagem atual
    const messages: Array<{ role: string; content: string | null }> = [
      { role: "system", content: promptReforcadoComDataHora },
      ...memoria,
      { role: "user", content: sanitizedMessage },
    ];

    let toolCallsSummary: Array<{ tool: string; args: unknown }> = [];
    let toolMessages: Array<{ role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string }> = [];

    // 6. Chamada ao Grok com Retentativa Simples
    let response;
    let retries = 0;
    const maxRetries = 3;
    const grokStart = Date.now();
    const imageErrorPatterns = ["image", "vision", "Cannot read image", "cannot read image", "image input", "visual"];
    const retriablePatterns = ["429", "502", "503", "rate limit", "too many requests", "overloaded", "capacity"];

    // Modelo de fallback: se o principal falhar todas as tentativas, tenta com grok-3-fast
    const FALLBACK_MODEL = "grok-3-fast";
    let usandoFallback = false;
    let clienteAtual = llmClient;
    let modeloAtual = modelo;

    while (retries < maxRetries) {
      try {
        response = await clienteAtual.chat.completions.create({
          model: modeloAtual,
          messages,
          tools: crmToolsDynamic,
          tool_choice: "auto",
        });
        break; // Sucesso!
      } catch (grokError: any) {
        retries++;
        const errorMsg = grokError?.message || String(grokError);
        const errorMsgLower = errorMsg.toLowerCase();
        console.error(`[AI-Agent] Tentativa ${retries}/${maxRetries} falhou (${modeloAtual}):`, errorMsg);

        // Verificar ERRO DE IMAGEM PRIMEIRO (antes do retry)
        const isImageError = imageErrorPatterns.some(pattern => errorMsgLower.includes(pattern.toLowerCase()));
        if (isImageError) {
          if (execLogId) await updateLog(execLogId, {
            status: "error",
            etapa: "erro_ia_imagem",
            erro_detalhe: `Erro de imagem no provedor ${llmProvider}: ${errorMsg}`,
            duracao_ms: Date.now() - globalStart,
          });
          return jsonResponse({
            ok: false,
            reason: "ia_nao_suporta_imagens",
            detalhe: "A IA configurada não suporta processamento de imagens. Apenas mensagens de texto e áudio são processadas."
          });
        }

        // Verificar se é erro retriável (429, 502, 503, rate limit, etc.)
        const isRetriable = retriablePatterns.some(pattern => errorMsgLower.includes(pattern.toLowerCase()));

        if (retries >= maxRetries) {
          // Todas as tentativas com modelo principal falharam — tentar fallback
          if (!usandoFallback && XAI_API_KEY && modeloAtual !== FALLBACK_MODEL) {
            console.log(`[AI-Agent] Modelo ${modeloAtual} falhou ${maxRetries}x. Tentando fallback: ${FALLBACK_MODEL}`);
            if (execLogId) await updateLog(execLogId, {
              status: "running",
              etapa: "fallback_modelo",
              detalhe: `Modelo ${modeloAtual} indisponível após ${maxRetries} tentativas. Tentando ${FALLBACK_MODEL}...`,
            });
            usandoFallback = true;
            clienteAtual = grok;
            modeloAtual = FALLBACK_MODEL;
            retries = 0; // Reset retries para o fallback
            await wait(2000);
            continue;
          }

          if (execLogId) await updateLog(execLogId, {
            status: "error",
            etapa: "erro_ia",
            erro_detalhe: `Erro IA final (${usandoFallback ? 'fallback' : llmProvider}): ${errorMsg}`,
            duracao_ms: Date.now() - globalStart,
          });
          await notifyAdminError({
            orgName, orgId, leadNome: lead?.nome, leadTelefone: lead?.telefone,
            etapa: "erro_ia", erro: `Modelo ${modeloAtual} falhou após ${maxRetries} tentativas${usandoFallback ? ' (inclusive fallback)' : ''}. ${errorMsg}`,
            modelo: modeloAtual, duracaoMs: Date.now() - globalStart,
          });
          return jsonResponse({
            ok: false,
            reason: "erro_ia",
            detalhe: errorMsg
          }, 500);
        }

        if (!isRetriable) {
          // Erro não retriável (ex: prompt inválido, auth) — falha imediata
          if (execLogId) await updateLog(execLogId, {
            status: "error",
            etapa: "erro_ia",
            erro_detalhe: `Erro IA não-retriável (${usandoFallback ? 'fallback' : llmProvider}): ${errorMsg}`,
            duracao_ms: Date.now() - globalStart,
          });
          await notifyAdminError({
            orgName, orgId, leadNome: lead?.nome, leadTelefone: lead?.telefone,
            etapa: "erro_ia_fatal", erro: `Erro não-retriável: ${errorMsg}`,
            modelo: modeloAtual, duracaoMs: Date.now() - globalStart,
          });
          return jsonResponse({
            ok: false,
            reason: "erro_ia",
            detalhe: errorMsg
          }, 500);
        }

        // Espera exponencial antes de tentar de novo (2s, 4s, 8s)
        const waitMs = Math.pow(2, retries) * 1000;
        console.log(`[AI-Agent] Erro retriável. Aguardando ${waitMs}ms antes da tentativa ${retries + 1}...`);
        await wait(waitMs);
      }
    }

    const grokMs = Date.now() - grokStart;
    // Atualizar modelo usado nos logs se houve fallback
    const modeloUsado = usandoFallback ? FALLBACK_MODEL : modelo;
    if (usandoFallback) {
      console.log(`[AI-Agent] ✅ Fallback ${FALLBACK_MODEL} respondeu com sucesso após falha do ${modelo}`);
    }

    let aiResponse = response.choices[0].message;

    // --- Sanitizar resposta da IA: remove notas internas que nunca devem ir ao lead ---
    const sanitizarRespostaIA = (texto: string | null | undefined): string => {
      if (!texto) return "";

      let t = texto;

      // 1. Remove frases de confirmação interna conhecidas
      const internalPhrases = [
        "(Confirmação de dados atualizados no CRM.)",
        "(Mensagem mantida como enviada anteriormente, apenas atualizando o CRM nos bastidores.)",
        "Dados atualizados no CRM",
        "Confirmado atualização no CRM",
        "Nenhuma alteração ou nova mensagem necessária",
        "Mensagem já enviada anteriormente",
        "Nenhuma ação necessária no momento",
        "Dados atualizados com sucesso",
        "A equipe será notificada",
        "será notificada para dar continuidade",
        "serão notificados",
        "Dados atualizados",
        "notifiquei a equipe",
      ];
      for (const phrase of internalPhrases) {
        t = t.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), "");
      }

      // 2. Remove sentenças/parágrafos inteiramente entre colchetes [...]
      // Estas são notas internas da IA, nunca devem ser enviadas ao lead
      t = t.replace(/\[([^\[\]]*)\]/g, (match) => {
        return match.length > 12 ? "" : match;
      });

      // 3. Remove frases inteiras entre parênteses (...) que falam sobre CRM, bastidores, ou operacionais
      t = t.replace(/\([^\(\)]*(CRM|bastidores|notificada|notificado|atualizand|atualizando|apenas)[^\(\)]*\)/gi, "");

      return t.trim();
    };

    if (aiResponse.content) {
      aiResponse.content = sanitizarRespostaIA(aiResponse.content) || null;
    }
    // ---------------------------------------------------------------------------
    
    const textoFinalPosFiltro = aiResponse.content || "";

    // Agora o textoFinal sempre terá o conteúdo filtrado
    let textoFinal = textoFinalPosFiltro;
    
    if (!textoFinal.trim() && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
      // Retry: forçar o modelo a responder ao lead
      if (execLogId) await updateLog(execLogId, {
        status: "running",
        etapa: "retry_resposta_vazia",
        detalhe: "Resposta vazia detectada. Forçando retry com instrução explícita...",
      });
      try {
        const retryResponse = await clienteAtual.chat.completions.create({
          model: modeloUsado,
          messages: [
            ...messages,
            { role: "assistant", content: "" },
            { role: "user", content: "[SISTEMA] Sua última resposta chegou vazia. Responda ao lead agora com uma mensagem de texto. Releia o histórico e continue o atendimento normalmente." },
          ],
          tools: crmToolsDynamic,
          tool_choice: "auto",
        });
        const retryContent = sanitizarRespostaIA(retryResponse.choices[0]?.message?.content);
        if (retryContent?.trim()) {
          textoFinal = retryContent;
          aiResponse = retryResponse.choices[0].message;
        }
      } catch (retryErr: any) {
        console.error("[AI-Agent] Retry resposta vazia falhou:", retryErr?.message);
      }

      if (!textoFinal.trim()) {
        if (execLogId) await updateLog(execLogId, {
          status: "error",
          etapa: "resposta_vazia",
          erro_detalhe: "O modelo retornou resposta vazia mesmo após retry.",
          model: modeloUsado,
          duracao_ms: Date.now() - globalStart,
        });
        await notifyAdminError({
          orgName, orgId, leadNome: lead.nome, leadTelefone: lead.telefone,
          etapa: "resposta_vazia", erro: "O modelo retornou resposta vazia mesmo após retry. Lead ficou sem resposta.",
          modelo: modeloUsado, duracaoMs: Date.now() - globalStart,
        });
        return jsonResponse({ ok: true, reason: "resposta_vazia" });
      }
    }

    // 7. Tool calls
    let safetyBreak = 0;
    let notificacaoDisparada = false;

    while (aiResponse.tool_calls && aiResponse.tool_calls.length > 0 && safetyBreak < 5) {
      safetyBreak++;
      const toolNames = aiResponse.tool_calls.map((t) => t.function.name).join(", ");
      console.log(`[AI-Agent] Tool calls: ${toolNames}`);

      if (execLogId) await updateLog(execLogId, {
        status: "running",
        etapa: "executando_ferramentas",
        detalhe: `IA acionou ferramentas: ${toolNames}. Processando...`,
      });

      const toolResults = await processToolCalls(aiResponse.tool_calls, lead_id, orgId);

      // Coleta resumo para o log
      toolCallsSummary.push(...aiResponse.tool_calls.map((tc) => ({
        tool: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      })));

      toolMessages.push({ role: "assistant", content: null, tool_calls: aiResponse.tool_calls });
      toolMessages.push(...toolResults);

      // ── INTERRUPÇÃO após notificacao — envia mensagem ao lead antes de notificar ──
      const disparouNotificacao = aiResponse.tool_calls.some((t: any) => t.function.name === "notificacao");
      if (disparouNotificacao) {
        notificacaoDisparada = true;

        // Se a IA gerou uma mensagem final para o lead, enviar ANTES de notificar
        const mensagemFinalParaLead = sanitizarRespostaIA(aiResponse.content);
        if (mensagemFinalParaLead) {
          const { data: connNotif } = await supabase
            .from("whatsapp_connections")
            .select("uazapi_url, uazapi_token")
            .eq("organization_id", orgId)
            .eq("status", "connected")
            .limit(1)
            .maybeSingle();

          if (connNotif?.uazapi_url && connNotif?.uazapi_token) {
            const telefoneDigits = (lead.telefone ?? "").replace(/\D/g, "");
            const phoneFormatted = telefoneDigits.startsWith("55") && telefoneDigits.length >= 12
              ? telefoneDigits
              : `55${telefoneDigits}`;

            const uazapiUrl = connNotif.uazapi_url.replace(/\/$/, "");
            const partes = (await splitMessage(mensagemFinalParaLead)).map(normalizeOutgoingMessage).filter((parte) => parte.length > 0);

            for (let pi = 0; pi < partes.length; pi++) {
              const parte = partes[pi];
              try {
                const uazapiRes = await fetch(`${uazapiUrl}/send/text`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "token": connNotif.uazapi_token,
                  },
                  body: JSON.stringify({ number: phoneFormatted, text: parte, delay: 1200 }),
                });
                const uazapiRespText = await uazapiRes.text();
                let uazapiRespJson: any = {};
                try { uazapiRespJson = JSON.parse(uazapiRespText); } catch { /* noop */ }
                const waMessageId = uazapiRespJson?.id ?? uazapiRespJson?.messageid ?? uazapiRespJson?.message?.id ?? null;
                await supabase.from("mensagens").insert({
                  lead_id,
                  organization_id: orgId,
                  conteudo: parte,
                  direcao: "saida",
                  remetente: "bot",
                  tipo_conteudo: "texto",
                  id_mensagem: waMessageId || null,
                });
                if (pi < partes.length - 1) await wait(1500);
              } catch (errEnvio: any) {
                console.error("[AI-Agent] Erro ao enviar mensagem antes da notificação:", errEnvio?.message);
              }
            }

            // Salvar na memória
            await saveMemory(sessionId, orgId, "user", userMessageFinal);
            await saveMemory(sessionId, orgId, "assistant", mensagemFinalParaLead);
          }
        }

        if (execLogId) await updateLog(execLogId, {
          status: "success",
          etapa: "notificacao_enviada",
          detalhe: mensagemFinalParaLead
            ? "Mensagem enviada ao lead. Notificação disparada. IA bloqueada."
            : "Notificação disparada. IA bloqueada. Nenhuma mensagem foi enviada ao lead.",
          tool_calls: toolCallsSummary,
          duracao_ms: Date.now() - globalStart,
        });
        return jsonResponse({ ok: true, reason: "notificacao_enviada_ia_bloqueada" });
      }

      if (execLogId) await updateLog(execLogId, {
        status: "running",
        etapa: "ferramentas_concluidas",
        detalhe: `Ferramentas (${toolNames}) executadas. Gerando resposta final...`,
        tool_calls: toolCallsSummary,
      });

      response = await clienteAtual.chat.completions.create({
        model: modeloUsado,
        messages: [...messages, ...toolMessages],
        tools: crmToolsDynamic,
        tool_choice: "auto",
      });
      aiResponse = response.choices[0].message;
    }

    textoFinal = sanitizarRespostaIA(aiResponse.content);
    if (!textoFinal.trim()) {
      // Retry: forçar resposta ao lead após tool calls
      if (execLogId) await updateLog(execLogId, {
        status: "running",
        etapa: "retry_resposta_vazia_pos_tools",
        detalhe: "Resposta vazia após ferramentas. Forçando retry...",
      });
      try {
        const allMsgs = [...messages, ...toolMessages];
        allMsgs.push({ role: "user", content: "[SISTEMA] Sua última resposta chegou vazia. O lead está aguardando. Responda ao lead agora com uma mensagem de texto. Continue o atendimento normalmente." });
        const retryResponse = await clienteAtual.chat.completions.create({
          model: modeloUsado,
          messages: allMsgs,
        });
        const retryContent = sanitizarRespostaIA(retryResponse.choices[0]?.message?.content);
        if (retryContent?.trim()) {
          textoFinal = retryContent;
        }
      } catch (retryErr: any) {
        console.error("[AI-Agent] Retry pós-tools falhou:", retryErr?.message);
      }

      if (!textoFinal.trim()) {
        if (toolCallsSummary.length > 0) {
          if (execLogId) await updateLog(execLogId, { status: "success", etapa: "atualizacao_silenciosa", detalhe: "A IA utilizou ferramentas do CRM mas não gerou resposta mesmo após retry.", duracao_ms: Date.now() - globalStart });
          await notifyAdminError({
            orgName, orgId, leadNome: lead.nome, leadTelefone: lead.telefone,
            etapa: "atualizacao_silenciosa", erro: "IA usou ferramentas CRM mas não gerou texto para o lead. Lead ficou sem resposta.",
            modelo: modeloUsado, duracaoMs: Date.now() - globalStart,
          });
          return jsonResponse({ ok: true, reason: "atualizacao_silenciosa" });
        }

        if (execLogId) await updateLog(execLogId, {
          status: "error",
          etapa: "resposta_vazia",
          erro_detalhe: "O modelo retornou resposta vazia mesmo após retry.",
          model: modeloUsado,
          duracao_ms: Date.now() - globalStart,
        });
        await notifyAdminError({
          orgName, orgId, leadNome: lead.nome, leadTelefone: lead.telefone,
          etapa: "resposta_vazia_pos_tools", erro: "Resposta vazia após ferramentas e retry. Lead ficou sem resposta.",
          modelo: modeloUsado, duracaoMs: Date.now() - globalStart,
        });
        return jsonResponse({ ok: true, reason: "resposta_vazia" });
      }
    }

    // 8. Memória
    await saveMemory(sessionId, orgId, "user", userMessageFinal);
    await saveMemory(sessionId, orgId, "assistant", textoFinal);

    // 9. WhatsApp
    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("uazapi_url, uazapi_token")
      .eq("organization_id", orgId)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!conn) {
      if (execLogId) await updateLog(execLogId, {
        status: "error",
        etapa: "sem_whatsapp",
        erro_detalhe: "Sem instância WhatsApp conectada para esta organização.",
        model: modeloUsado,
        duracao_ms: Date.now() - globalStart,
      });
      return jsonResponse({ ok: false, reason: "sem_whatsapp_conectado" });
    }

    // Normaliza o telefone para o formato que a UAZAPI espera: 55 + DDD + número
    const telefoneDigits = (lead.telefone ?? "").replace(/\D/g, "");
    const phoneFormatted = telefoneDigits.startsWith("55") && telefoneDigits.length >= 12
      ? telefoneDigits
      : `55${telefoneDigits}`;

    if (!phoneFormatted || phoneFormatted.length < 12) {
      if (execLogId) await updateLog(execLogId, {
        status: "error",
        etapa: "telefone_invalido",
        erro_detalhe: `Telefone inválido para envio: "${lead.telefone}"`,
        model: modeloUsado,
        duracao_ms: Date.now() - globalStart,
      });
      return jsonResponse({ ok: false, reason: "telefone_invalido" });
    }

    const uazapiUrl = conn.uazapi_url.replace(/\/$/, ""); // remove trailing slash
    const uazapiToken = conn.uazapi_token;

    const partes = (await splitMessage(textoFinal)).map(normalizeOutgoingMessage).filter((parte) => parte.length > 0);

    if (execLogId) await updateLog(execLogId, {
      status: "running",
      etapa: "enviando_whatsapp",
      detalhe: `Resposta gerada (${grokMs}ms). Enviando ${partes.length} parte(s) para ${phoneFormatted}...`,
      model: modeloUsado,
      tool_calls: toolCallsSummary.length > 0 ? toolCallsSummary : null,
    });

    let errosEnvio = 0;
    for (let i = 0; i < partes.length; i++) {
      const parte = partes[i];
      try {
        // Envia diretamente via UAZAPI (endpoint correto: /send/text, campo: number)
        const uazapiPayload = {
          number: phoneFormatted,
          text: parte,
          delay: 1200,
        };

        console.log(`[AI-Agent] Enviando para UAZAPI: ${uazapiUrl}/send/text | number=${phoneFormatted}`);

        const uazapiRes = await fetch(`${uazapiUrl}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "token": uazapiToken,
          },
          body: JSON.stringify(uazapiPayload),
        });

        const uazapiRespText = await uazapiRes.text();
        console.log(`[AI-Agent] UAZAPI response ${uazapiRes.status}: ${uazapiRespText.substring(0, 300)}`);

        let uazapiRespJson: any = {};
        try { uazapiRespJson = JSON.parse(uazapiRespText); } catch { /* sem json */ }

        if (!uazapiRes.ok) {
          errosEnvio++;
          const errMsg = `UAZAPI HTTP ${uazapiRes.status}: ${uazapiRespText.substring(0, 200)}`;
          console.error(`[AI-Agent] Erro UAZAPI parte ${i + 1}:`, errMsg);
          if (execLogId) await updateLog(execLogId, {
            status: "running",
            etapa: "erro_whatsapp",
            detalhe: `Erro ao enviar parte ${i + 1}/${partes.length}: ${errMsg}`,
          });
          // Mesmo com erro no WhatsApp, salva no CRM para visibilidade
          await supabase.from("mensagens").insert({
            lead_id, organization_id: orgId,
            conteudo: parte, direcao: "saida",
            remetente: "bot", tipo_conteudo: "texto",
          });
        } else {
          // Sucesso: salva no CRM com o id da mensagem WhatsApp
          const waMessageId = uazapiRespJson?.id ?? uazapiRespJson?.messageid ?? uazapiRespJson?.message?.id ?? null;
          const { data: insertedMsg } = await supabase
            .from("mensagens")
            .insert({
              lead_id,
              organization_id: orgId,
              conteudo: parte,
              direcao: "saida",
              remetente: "bot",
              tipo_conteudo: "texto",
              id_mensagem: waMessageId,
            })
            .select("id")
            .single();

          console.log(`[AI-Agent] ✅ Parte ${i + 1}/${partes.length} enviada. waId=${waMessageId} | dbId=${insertedMsg?.id}`);
        }
      } catch (err: any) {
        errosEnvio++;
        console.error(`[AI-Agent] Catch envio parte ${i + 1}:`, err);
      }

      if (i < partes.length - 1) {
        // Delay humanizado: 30ms/char, entre 1.5s e 5s + jitter aleatório
        const charCount = partes[i].length;
        const typingDelay = Math.min(Math.max(charCount * 30, 1500), 5000);
        const totalDelay = Math.round(typingDelay + Math.random() * 800);
        if (execLogId) await updateLog(execLogId, {
          status: "running",
          etapa: "aguardando_proxima",
          detalhe: `Parte ${i + 1}/${partes.length} enviada. Aguardando ${(totalDelay / 1000).toFixed(1)}s antes da próxima mensagem...`,
        });
        await wait(totalDelay);
      }
    }

    const duracaoTotal = Date.now() - globalStart;

    if (execLogId) await updateLog(execLogId, {
      status: errosEnvio > 0 ? "error" : "success",
      etapa: errosEnvio > 0 ? "concluido_com_erros" : "concluido",
      detalhe: errosEnvio > 0
        ? `Concluído com ${errosEnvio} erro(s) no envio. ${partes.length - errosEnvio}/${partes.length} partes enviadas.`
        : `Concluído com sucesso! ${partes.length} parte(s) enviada(s) em ${duracaoTotal}ms.`,
      model: modeloUsado,
      partes_enviadas: partes.length - errosEnvio,
      tool_calls: toolCallsSummary.length > 0 ? toolCallsSummary : null,
      duracao_ms: duracaoTotal,
    });

    console.log(`[AI-Agent] ✅ lead=${lead_id} | partes=${partes.length} | modelo=${modeloUsado} | ${duracaoTotal}ms`);
    return jsonResponse({ ok: true, partes_enviadas: partes.length });
  } catch (err: any) {
    console.error("[AI-Agent] Erro fatal:", err);
    await supabase.from("leads").update({ ai_pending_since: null } as any).eq("id", lead_id);
    if (execLogId) await updateLog(execLogId, {
      status: "error",
      etapa: "erro_fatal",
      erro_detalhe: String(err?.message ?? err),
      duracao_ms: Date.now() - globalStart,
    });
    // Notificar admin — erro fatal é sempre crítico
    try {
      const { data: orgFatal } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
      const { data: leadFatal } = await supabase.from("leads").select("nome, telefone").eq("id", lead_id).maybeSingle();
      await notifyAdminError({
        orgName: orgFatal?.name || orgId, orgId,
        leadNome: leadFatal?.nome, leadTelefone: leadFatal?.telefone,
        etapa: "erro_fatal", erro: String(err?.message ?? err),
        duracaoMs: Date.now() - globalStart,
      });
    } catch { /* não falhar por causa da notificação */ }
    return jsonResponse({ error: "internal_error", detail: String(err?.message ?? err) }, 500);
  }
});

