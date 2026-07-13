import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function resolveLlmEndpoint(model: string): { url: string; apiKey: string; cleanModel: string } {
  const xaiApiKey = Deno.env.get("XAI_API_KEY") ?? "";
  const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

  if (model.startsWith("openrouter/")) {
    if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY is not set in Supabase Secrets");
    return { url: "https://openrouter.ai/api/v1/chat/completions", apiKey: openrouterApiKey, cleanModel: model.replace("openrouter/", "") };
  }
  if (model.startsWith("gpt-") || model.startsWith("o1-") || model.startsWith("o3-") || model.startsWith("o4-")) {
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY is not set in Supabase Secrets");
    return { url: "https://api.openai.com/v1/chat/completions", apiKey: openaiApiKey, cleanModel: model };
  }
  if (!xaiApiKey) throw new Error("XAI_API_KEY is not set in Supabase Secrets");
  return { url: "https://api.x.ai/v1/chat/completions", apiKey: xaiApiKey, cleanModel: model };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const { ia_type, input_data, user_id } = await req.json();

    if (!ia_type || !user_id) {
      throw new Error("Missing required fields: ia_type, user_id");
    }

    // 1. Fetch IA Configuration (Prompts and Model)
    const { data: iaConfig, error: configError } = await supabase
      .from('platform_ia_config')
      .select('*')
      .eq('id', ia_type)
      .single();

    if (configError) {
      throw new Error(`IA Config not found for: ${ia_type}`);
    }

    // 2. Replace [CEREBRO_CONTEXT] in system_prompt (feature removida — placeholder fica vazio)
    const systemPromptWithContext = iaConfig.system_prompt.replace("[CEREBRO_CONTEXT]", "");

    // 6. Format Input Data for the Prompt
    const inputFormatted = typeof input_data === 'string' 
      ? input_data 
      : JSON.stringify(input_data, null, 2);

    // 7. Call LLM (multi-provider routing)
    const targetModel = iaConfig.model || 'grok-4-1-fast-reasoning';
    const { url, apiKey, cleanModel } = resolveLlmEndpoint(targetModel);
    console.log(`[LLM Request] model=${targetModel} → provider_url=${url}`);

    const llmResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: cleanModel,
        messages: [
          { role: 'system', content: systemPromptWithContext },
          { role: 'user', content: inputFormatted }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (!llmResponse.ok) {
      const err = await llmResponse.text();
      console.error("LLM API Error:", err);
      throw new Error(`Erro na API LLM (${llmResponse.status}): ${err}`);
    }

    const aiData = await llmResponse.json();
    const resultText = aiData.choices[0].message.content;

    // 8. Save to History
    await supabase.from('platform_ia_history').insert({
      user_id: user_id,
      ia_type: ia_type,
      input_data: input_data,
      output_text: resultText
    });

    return new Response(JSON.stringify({ text: resultText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("ia-proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
