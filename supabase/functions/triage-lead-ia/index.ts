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

const SYSTEM_PROMPT = `Você é um triador de mensagens de WhatsApp para clínicas estéticas e de saúde.
Analise a PRIMEIRA mensagem de um novo contato e decida se o atendimento automático (IA de pré-atendimento) deve ser ativado.

ATIVE a IA ({"ativar_ia": true}) quando a mensagem indica:
- Pessoa nova buscando informações sobre procedimentos, tratamentos ou serviços
- Pergunta genérica sobre preços, agenda, disponibilidade ou como funciona
- Cumprimento simples de primeiro contato ("oi", "olá", "bom dia", "boa tarde")
- Interesse inicial sem contexto prévio com a clínica
- Lead que veio de indicação mas está fazendo contato inicial ("minha amiga indicou")

NÃO ATIVE a IA ({"ativar_ia": false}) quando a mensagem indica:
- Referência a atendimento, consulta ou conversa anterior ("aquela consulta", "como falamos", "conforme combinado", "voltei")
- Contexto específico com médico ou equipe ("Dra.", "doutor", "a menina que me atendeu")
- Dúvida pós-procedimento ou pós-consulta ("depois do botox", "meu resultado", "como está cicatrizando")
- Situação muito específica que exige contexto humano (exame, resultado, reclamação)
- Mensagem de fornecedor, parceiro ou contexto claramente não-paciente
- Reagendamento ou cancelamento de consulta já marcada

Em caso de dúvida, prefira NÃO ativar ({"ativar_ia": false}) — é melhor um humano avaliar do que a IA entrar em contexto errado.

Retorne APENAS JSON válido, sem markdown: {"ativar_ia": true} ou {"ativar_ia": false}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { lead_id, organization_id, mensagem, tipo_mensagem, media_path } = await req.json();

    if (!lead_id || !organization_id) {
      return new Response(JSON.stringify({ error: "lead_id e organization_id são obrigatórios" }), {
        status: 400,
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

    // Se não há texto (ex: áudio ou mídia sem legenda), ativar IA por padrão
    // (primeiro contato via áudio é improvável que seja follow-up)
    const textoMensagem = mensagem?.trim() || "";
    let ativarIa = false;

    if (!textoMensagem) {
      console.log(`[triage-lead-ia] Lead ${lead_id} — sem texto (${tipo_mensagem}), ativando IA por padrão`);
      ativarIa = true;
    } else {
      // Chamar DeepSeek V4 Flash para classificar a mensagem
      const completion = await openrouter.chat.completions.create({
        model: "deepseek/deepseek-v4-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Primeira mensagem do lead: "${textoMensagem}"` },
        ],
        max_tokens: 20,
        temperature: 0,
      });

      const resposta = completion.choices[0]?.message?.content?.trim() ?? "";
      console.log(`[triage-lead-ia] Lead ${lead_id} | Mensagem: "${textoMensagem}" | Resposta: ${resposta}`);

      try {
        const parsed = JSON.parse(resposta);
        ativarIa = parsed.ativar_ia === true;
      } catch {
        console.warn("[triage-lead-ia] Resposta inválida da IA, não ativando:", resposta);
        ativarIa = false;
      }
    }

    if (ativarIa) {
      // 1. Ativar IA no lead
      await supabase.from("leads").update({ ia_ativa: true }).eq("id", lead_id);
      console.log(`[triage-lead-ia] Lead ${lead_id} — IA ativada`);

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
      console.log(`[triage-lead-ia] Lead ${lead_id} — IA não ativada, roteado para atendimento humano`);
    }

    return new Response(
      JSON.stringify({ ativar_ia: ativarIa }),
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
