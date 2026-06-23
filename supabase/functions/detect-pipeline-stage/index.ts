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

const SYSTEM_PROMPT = `Você é um classificador de etapas de pipeline de CRM para clínicas estéticas e de saúde.
Analise a conversa e classifique em qual etapa o lead se encontra AGORA, com base nas últimas mensagens.

ETAPAS:
1 - Novo Lead / Início: Conversa recém iniciada, lead ainda não informou nada relevante
2 - Qualificação: Atendente está coletando informações (nome, procedimento de interesse, necessidade, área do corpo, histórico)
3 - Qualificado (MQL): Lead JÁ demonstrou interesse claro E forneceu informações suficientes. Avance para 3 quando qualquer um destes sinais aparecer:
   • Lead disse que quer agendar / marcar uma consulta / horário
   • Lead respondeu "sim" a uma pergunta direta sobre interesse em procedimento específico
   • Lead informou procedimento E área específica E demonstrou intenção de prosseguir
   • Lead pediu valor, condições de pagamento ou disponibilidade de agenda

REGRAS CRÍTICAS:
- Seja DECISIVO. Se houver sinal claro de interesse + intenção de agendar → avance para 3 imediatamente
- Não espere confirmação de agendamento real para ir para 3 — basta a INTENÇÃO de agendar
- Retorne APENAS JSON válido, sem markdown, sem texto extra
- Formato: {"nova_posicao": <número>} ou {"nova_posicao": null}
- Só avance — nunca sugira posição menor ou igual à etapa atual`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { lead_id, organization_id } = await req.json();

    if (!lead_id || !organization_id) {
      return new Response(JSON.stringify({ error: "lead_id e organization_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENROUTER_API_KEY) {
      console.error("[detect-pipeline-stage] OPENROUTER_API_KEY não configurada");
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar lead atual
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, posicao_pipeline, is_qualified")
      .eq("id", lead_id)
      .eq("organization_id", organization_id)
      .single();

    if (leadError || !lead) {
      console.error("[detect-pipeline-stage] Lead não encontrado:", leadError);
      return new Response(JSON.stringify({ skipped: true, reason: "Lead não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const posicaoAtual = lead.posicao_pipeline ?? 0;

    // Só analisar leads nas etapas iniciais (< 4) — Agendado/Fechado já são tratados por eventos
    if (posicaoAtual >= 4) {
      return new Response(JSON.stringify({ skipped: true, reason: "Lead já está em etapa avançada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Buscar últimas 15 mensagens relevantes (exclui logs de IA)
    const { data: mensagens, error: msgsError } = await supabase
      .from("mensagens")
      .select("conteudo, remetente, criado_em")
      .eq("lead_id", lead_id)
      .in("remetente", ["lead", "atendente", "agente", "bot"])
      .not("conteudo", "is", null)
      .neq("conteudo", "")
      .order("criado_em", { ascending: false })
      .limit(15);

    if (msgsError || !mensagens || mensagens.length < 2) {
      return new Response(JSON.stringify({ skipped: true, reason: "Mensagens insuficientes para análise" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ordenar cronologicamente e formatar conversa
    const conversa = mensagens
      .reverse()
      .map((m) => {
        const quem = m.remetente === "lead" ? "Lead" : "Atendente";
        return `${quem}: ${m.conteudo}`;
      })
      .join("\n");

    const userPrompt = `Etapa atual do lead: ${posicaoAtual}
Sugira apenas etapas MAIORES que ${posicaoAtual}.

Conversa:
---
${conversa}
---`;

    // 3. Chamar DeepSeek V4 Flash via OpenRouter (timeout de 8s para não travar o banco)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let completion;
    try {
      completion = await openrouter.chat.completions.create({
        model: "deepseek/deepseek-v4-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 30,
        temperature: 0,
      }, { signal: controller.signal });
    } catch (abortErr: any) {
      if (abortErr?.name === 'AbortError' || controller.signal.aborted) {
        console.warn(`[detect-pipeline-stage] Timeout de 8s atingido para lead ${lead_id}. Abortando.`);
        return new Response(JSON.stringify({ skipped: true, reason: "Timeout na chamada à IA" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw abortErr;
    } finally {
      clearTimeout(timeout);
    }

    const resposta = completion.choices[0]?.message?.content?.trim() ?? "";
    console.log(`[detect-pipeline-stage] Lead ${lead_id} | Etapa atual: ${posicaoAtual} | Resposta: ${resposta}`);

    // 4. Parsear resposta e validar
    let novaPosicao: number | null = null;
    try {
      const parsed = JSON.parse(resposta);
      const sugerida = parsed.nova_posicao;
      if (typeof sugerida === "number" && sugerida > posicaoAtual && sugerida >= 1 && sugerida <= 3) {
        novaPosicao = sugerida;
      }
    } catch {
      console.warn("[detect-pipeline-stage] Resposta inválida da IA, ignorando:", resposta);
    }

    // 5. Aplicar mudança de etapa se houver avanço
    if (novaPosicao !== null) {
      const updates: Record<string, unknown> = { posicao_pipeline: novaPosicao };

      // Etapa 3 = Qualificado (MQL) — marcar is_qualified se ainda não estiver
      if (novaPosicao >= 3 && !lead.is_qualified) {
        updates.is_qualified = true;
      }

      await supabase.from("leads").update(updates).eq("id", lead_id);

      const nomesEtapas: Record<number, string> = {
        1: "Em Atendimento",
        2: "Qualificação",
        3: "Qualificado",
      };

      // Nota de sistema — aparece na Jornada do Paciente como indicativo da mudança automática
      await supabase.from("lead_notas").insert({
        lead_id,
        organization_id,
        conteudo: `Etapa avançada automaticamente: ${nomesEtapas[posicaoAtual] ?? `Etapa ${posicaoAtual}`} → ${nomesEtapas[novaPosicao] ?? `Etapa ${novaPosicao}`} (detectado por IA)`,
        tipo: "sistema",
        metadados: { evento: "etapa_automatica", de: posicaoAtual, para: novaPosicao, automatico: true },
      });

      // Nota MQL adicional com timestamp preciso na Jornada do Paciente
      if (updates.is_qualified) {
        await supabase.from("lead_notas").insert({
          lead_id,
          organization_id,
          conteudo: "Lead qualificado como MQL — detectado automaticamente pela IA",
          tipo: "sistema",
          metadados: { evento: "mql", is_qualified: true, automatico: true },
        });
      }

      console.log(`[detect-pipeline-stage] Lead ${lead_id} avançado: ${posicaoAtual} → ${novaPosicao}`);
    }

    return new Response(
      JSON.stringify({ nova_posicao: novaPosicao, posicao_anterior: posicaoAtual }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[detect-pipeline-stage] Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
