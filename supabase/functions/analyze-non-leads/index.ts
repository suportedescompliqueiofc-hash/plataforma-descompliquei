import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um analisador de conversas de WhatsApp para clínicas estéticas e de saúde.
Analise cada contato e determine se é um LEAD POTENCIAL ou NÃO É LEAD.

CLASSIFIQUE COMO NÃO-LEAD (is_lead: false) quando as mensagens indicam claramente:
- Candidato a vaga de emprego: currículo, disponibilidade para trabalhar, formação profissional, processo seletivo
- Fornecedor ou parceiro comercial tentando vender algo para a clínica
- Número errado ou engano claro
- Spam ou mensagem automática sem relação com saúde/estética
- Amigo ou contato pessoal da equipe: conversa pessoal sem interesse em procedimentos como paciente
- Contexto completamente fora de uma clínica: entregador, vizinho, etc.

CLASSIFIQUE COMO LEAD (is_lead: true) quando:
- Pergunta sobre procedimentos, preços, tratamentos ou agenda
- Interesse em saúde ou estética, mesmo vago
- Cumprimento simples de primeiro contato
- Indicação de outra pessoa
- Dúvida pós-procedimento (ainda é cliente)
- Qualquer dúvida ambígua sem contexto suficiente

REGRA PRINCIPAL: Em caso de dúvida, sempre LEAD. É melhor manter do que remover um paciente real.

Retorne APENAS JSON válido sem markdown:
{"results":[{"lead_id":"uuid","is_lead":true,"reason":"motivo em ate 12 palavras","confidence":"alta"}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Variáveis de ambiente SUPABASE_URL e SERVICE_KEY são obrigatórias");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const { organization_id, date_from, date_to } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[analyze-non-leads] org=${organization_id} date_from=${date_from} date_to=${date_to}`);

    // Buscar leads candidatos
    let query = supabase
      .from("leads")
      .select("id, nome, telefone, origem")
      .eq("organization_id", organization_id)
      .neq("excluir_metricas", true);

    if (date_from) query = query.gte("criado_em", date_from);
    if (date_to)   query = query.lte("criado_em", date_to);

    const { data: leads, error: leadsError } = await query.order("criado_em", { ascending: false }).limit(50);

    if (leadsError) {
      console.error("[analyze-non-leads] Erro ao buscar leads:", leadsError);
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    console.log(`[analyze-non-leads] Leads encontrados: ${leads?.length ?? 0}`);

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ non_leads: [], total_analyzed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadIds = leads.map((l: any) => l.id);

    // Buscar últimas mensagens por lead
    const { data: messages } = await supabase
      .from("mensagens")
      .select("lead_id, conteudo, remetente, tipo_conteudo")
      .in("lead_id", leadIds)
      .neq("remetente", "ia")
      .order("criado_em", { ascending: false })
      .limit(500);

    console.log(`[analyze-non-leads] Mensagens encontradas: ${messages?.length ?? 0}`);

    // Agrupar mensagens por lead (max 8 por lead)
    const msgByLead: Record<string, any[]> = {};
    for (const msg of (messages || [])) {
      if (!msgByLead[msg.lead_id]) msgByLead[msg.lead_id] = [];
      if (msgByLead[msg.lead_id].length < 8) msgByLead[msg.lead_id].push(msg);
    }

    // Processar em lotes de 8 leads por chamada à IA
    const BATCH_SIZE = 8;
    const nonLeads: any[] = [];
    const okLeads: any[] = [];

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = (leads as any[]).slice(i, i + BATCH_SIZE);

      const batchData = batch.map((lead: any) => {
        const msgs = (msgByLead[lead.id] || []).reverse();
        return {
          lead_id: lead.id,
          nome: lead.nome || lead.telefone,
          mensagens: msgs.length === 0
            ? [{ de: "sistema", texto: "[nenhuma mensagem]" }]
            : msgs.map((m: any) => ({
                de: m.remetente === "lead" ? "contato" : "clinica",
                tipo: m.tipo_conteudo,
                texto: m.conteudo || `[${m.tipo_conteudo || "midia"}]`,
              })),
        };
      });

      try {
        console.log(`[analyze-non-leads] Analisando lote ${i}–${i + batch.length} (${batch.length} leads)`);

        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-v4-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Analise estes ${batch.length} contatos e retorne o JSON:\n${JSON.stringify(batchData)}` },
            ],
            max_tokens: 1200,
            temperature: 0,
          }),
        });

        if (!aiRes.ok) {
          console.error(`[analyze-non-leads] Erro OpenRouter: ${aiRes.status} ${aiRes.statusText}`);
          continue;
        }

        const aiData = await aiRes.json();
        const resposta = aiData.choices?.[0]?.message?.content?.trim() ?? "";
        console.log(`[analyze-non-leads] Resposta IA lote ${i}: ${resposta.substring(0, 100)}`);

        const cleanJson = resposta.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        for (const result of (parsed.results || [])) {
          const lead = (leads as any[]).find((l: any) => l.id === result.lead_id);
          if (!lead) continue;

          if (result.is_lead === false) {
            nonLeads.push({
              lead_id: result.lead_id,
              nome: lead.nome || lead.telefone,
              telefone: lead.telefone,
              reason: result.reason || "Identificado como não-lead",
              confidence: result.confidence || "media",
            });
          } else {
            okLeads.push({
              lead_id: result.lead_id,
              nome: lead.nome || lead.telefone,
              telefone: lead.telefone,
              reason: result.reason || "Interesse em procedimentos ou serviços",
            });
          }
        }
      } catch (batchErr) {
        console.error(`[analyze-non-leads] Erro no lote ${i}:`, batchErr);
      }
    }

    console.log(`[analyze-non-leads] Concluído. Analisados: ${leads.length} | Não-leads: ${nonLeads.length} | Leads OK: ${okLeads.length}`);

    return new Response(
      JSON.stringify({ non_leads: nonLeads, ok_leads: okLeads, total_analyzed: leads.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[analyze-non-leads] Erro geral:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
