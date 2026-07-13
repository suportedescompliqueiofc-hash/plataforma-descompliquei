import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const openrouter = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const SYSTEM_PROMPT = `Você é um classificador de primeira mensagem de WhatsApp para clínicas de saúde e estética.

Sua tarefa: analisar a PRIMEIRA mensagem de um novo contato e decidir se a IA de pré-atendimento deve responder automaticamente.

ATIVE a IA quando a mensagem indica claramente um potencial novo paciente:
- Cumprimento simples de primeiro contato ("oi", "olá", "bom dia", "boa tarde", "tudo bem?", "boa noite")
- Pergunta sobre procedimentos, tratamentos, serviços, preços, horários, disponibilidade ou como funciona
- Interesse inicial mesmo vindo de indicação ("minha amiga indicou", "vi no seu Instagram", "me falaram de vocês")
- Mensagem curta e genérica sem contexto anterior algum

NÃO ATIVE a IA quando a mensagem indica contexto já existente ou situação que exige humano:
- Referência a atendimento ou conversa anterior ("como falamos", "voltei", "conforme combinado", "aquela consulta", "da última vez", "já fui aí", "já sou paciente")
- Menciona profissional específico pelo nome ou papel ("Dra. Ana", "Dr. João", "a menina da recepção", "a que me atendeu")
- Dúvida pós-procedimento ou pós-consulta ("depois do botox", "meu resultado", "como está cicatrizando", "recebi alta")
- Contexto de emprego, currículo ou processo seletivo ("tenho interesse na vaga", "sou técnica em", "processo seletivo", "disponibilidade para trabalhar")
- Claramente fornecedor ou parceiro comercial ("nossa empresa oferece", "representante de", "distribuidor")
- Reagendamento ou cancelamento de consulta já marcada ("preciso remarcar", "quero cancelar minha consulta")
- Urgência ou emergência ("estou com muita dor", "tive uma reação alérgica", "sangramento")
- Mensagem automatizada ou empresarial

EM DÚVIDA: prefira NAO — é melhor um humano avaliar do que a IA entrar em contexto errado.

Se houver uma seção "REGRAS ESPECÍFICAS DESTA CLÍNICA" na mensagem do usuário, ela tem PRIORIDADE sobre as regras gerais acima em caso de conflito.

Responda EXATAMENTE neste formato (duas linhas, sem mais nada):
DECISAO: SIM
MOTIVO: razao objetiva em ate 12 palavras sem aspas`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const inicioTotal = Date.now();

  try {
    const { lead_id, organization_id, mensagem, tipo_mensagem, media_path } = await req.json();

    if (!lead_id || !organization_id) {
      return new Response(JSON.stringify({ error: "lead_id e organization_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gate Athos Triagem: se a org desligou o agente no Console Athos, não classificar (no-op).
    // Padrão = ativo; só pula se houver linha com ativo=false.
    const { data: gateTriagem } = await supabase
      .from("athos_agentes_org")
      .select("ativo")
      .eq("organization_id", organization_id)
      .eq("agente_slug", "triagem")
      .maybeSingle();
    if (gateTriagem && gateTriagem.ativo === false) {
      console.log(`[triage-lead-ia] Agente desligado para org ${organization_id} — ignorando.`);
      return new Response(JSON.stringify({ skipped: true, reason: "agente_desligado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENROUTER_API_KEY) {
      console.error("[triage-lead-ia] OPENROUTER_API_KEY não configurada");
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar dados do lead para enriquecer o contexto
    const { data: lead } = await supabase
      .from("leads")
      .select("nome, origem")
      .eq("id", lead_id)
      .single();

    const leadNome = lead?.nome ?? null;
    const origemLead = lead?.origem ?? null;

    // Regras extras específicas desta org (ver organizations.triagem_regras_extras)
    const { data: orgConfig } = await supabase
      .from("organizations")
      .select("triagem_regras_extras")
      .eq("id", organization_id)
      .maybeSingle();
    const regrasExtras = orgConfig?.triagem_regras_extras?.trim() || null;

    const textoMensagem = mensagem?.trim() || "";
    let ativarIa = false;
    let motivo = "";
    let respostaRaw: string | null = null;
    const modelo = "google/gemini-2.5-flash-lite";

    if (!textoMensagem) {
      // Sem texto: classificar por tipo de mídia
      const tipoNorm = (tipo_mensagem || "").toLowerCase();
      if (tipoNorm === "audio" || tipoNorm === "voz" || tipoNorm === "ptt") {
        ativarIa = true;
        motivo = "Áudio de primeiro contato — comportamento natural de lead.";
        console.log(`[triage-lead-ia] Lead ${lead_id} — áudio sem texto, ativando IA`);
      } else if (tipoNorm === "document" || tipoNorm === "pdf") {
        ativarIa = false;
        motivo = "Documento enviado — possível currículo, fornecedor ou candidato.";
        console.log(`[triage-lead-ia] Lead ${lead_id} — documento, NÃO ativando IA`);
      } else {
        ativarIa = false;
        motivo = `Mídia sem legenda (${tipo_mensagem}) — comportamento atípico de lead.`;
        console.log(`[triage-lead-ia] Lead ${lead_id} — mídia sem texto (${tipo_mensagem}), NÃO ativando IA`);
      }
    } else {
      // Contexto adicional para enriquecer a decisão
      const contextoOrigem = origemLead
        ? `\nOrigem do lead: ${origemLead} (leads de marketing tendem a ser primeiro contato).`
        : "";
      const contextoRegrasExtras = regrasExtras
        ? `\n\nREGRAS ESPECÍFICAS DESTA CLÍNICA:\n${regrasExtras}`
        : "";

      const TRIAGE_TOOL = {
        type: "function" as const,
        function: {
          name: "classificar_lead",
          description: "Classifica se a IA de pré-atendimento deve ser ativada para este lead.",
          parameters: {
            type: "object",
            properties: {
              ativar_ia: {
                type: "boolean",
                description: "true = ativar IA, false = encaminhar para humano",
              },
              motivo: {
                type: "string",
                description: "Razão objetiva da decisão em até 12 palavras",
              },
            },
            required: ["ativar_ia", "motivo"],
          },
        },
      };

      const inicioLlm = Date.now();
      const completion = await openrouter.chat.completions.create({
        model: modelo,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Mensagem: ${textoMensagem}${contextoOrigem}${contextoRegrasExtras}`,
          },
        ],
        tools: [TRIAGE_TOOL],
        tool_choice: { type: "function", function: { name: "classificar_lead" } },
        max_tokens: 80,
        temperature: 0,
      });
      const duracaoLlm = Date.now() - inicioLlm;

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      respostaRaw = toolCall?.function?.arguments ?? completion.choices[0]?.message?.content ?? "";
      console.log(`[triage-lead-ia] Lead ${lead_id} | "${textoMensagem}" | LLM: ${duracaoLlm}ms | Raw: ${respostaRaw}`);

      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          ativarIa = args.ativar_ia === true;
          motivo = typeof args.motivo === "string" ? args.motivo.trim() : "";
        } catch {
          console.warn("[triage-lead-ia] Falha ao parsear tool arguments:", toolCall.function.arguments);
          ativarIa = false;
          motivo = "Erro ao parsear resposta da ferramenta.";
        }
      } else {
        // Modelo não chamou a tool — fallback ultra-permissivo no texto livre
        const txt = (completion.choices[0]?.message?.content ?? "").toUpperCase();
        console.warn(`[triage-lead-ia] Modelo não usou tool calling. Conteúdo: ${txt}`);
        ativarIa = (
          txt.includes("TRUE") ||
          txt.includes('"ATIVAR_IA": TRUE') ||
          /\bSIM\b/.test(txt) ||
          /\bATIV/.test(txt)
        ) && !(/\bN[AÃ]O\b/.test(txt) && !/\bN[AÃ]O ENCAMINH/.test(txt));
        motivo = ativarIa
          ? "Decisão positiva extraída de resposta livre."
          : "Modelo não usou tool calling — padrão conservador.";
      }

    }

    const duracaoTotal = Date.now() - inicioTotal;

    // Salvar log da decisão
    await supabase.from("triage_ia_logs").insert({
      organization_id,
      lead_id,
      lead_nome: leadNome,
      mensagem: textoMensagem || null,
      tipo_mensagem: tipo_mensagem || null,
      decisao: ativarIa,
      motivo: motivo || null,
      modelo,
      duracao_ms: duracaoTotal,
      origem_lead: origemLead,
      resposta_raw: respostaRaw,
    });

    if (ativarIa) {
      // 1. Ativar IA no lead
      await supabase.from("leads").update({ ia_ativa: true, ia_ja_ativada: true }).eq("id", lead_id);
      console.log(`[triage-lead-ia] Lead ${lead_id} — IA ativada | Motivo: ${motivo}`);

      // 2. Disparar whatsapp-ai-agent para responder à primeira mensagem
      await supabase.functions.invoke("whatsapp-ai-agent", {
        body: {
          lead_id,
          organization_id,
          mensagem_usuario: textoMensagem,
          tipo_mensagem: tipo_mensagem || "texto",
          media_path: media_path || null,
        },
      });
      console.log(`[triage-lead-ia] Lead ${lead_id} — whatsapp-ai-agent disparado`);
    } else {
      await supabase.from("leads").update({ ia_ativa: false, ia_ja_ativada: true }).eq("id", lead_id);
      console.log(`[triage-lead-ia] Lead ${lead_id} — IA não ativada | Motivo: ${motivo}`);
    }

    return new Response(
      JSON.stringify({ ativar_ia: ativarIa, motivo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[triage-lead-ia] Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
