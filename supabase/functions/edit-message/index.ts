import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message_id, new_text, user_id } = await req.json();

    if (!message_id || !new_text || !user_id) {
      return jsonResponse({ error: 'Parâmetros obrigatórios ausentes: message_id, new_text, user_id' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar a mensagem no banco
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('mensagens')
      .select('id, id_mensagem, conteudo, original_content, organization_id, direcao, criado_em')
      .eq('id', message_id)
      .single();

    if (msgError || !msg) {
      return jsonResponse({ error: 'Mensagem não encontrada.' }, 404);
    }

    // Validações
    if (msg.direcao !== 'saida') {
      return jsonResponse({ error: 'Só é possível editar mensagens enviadas (saída).' }, 400);
    }

    if (!msg.id_mensagem) {
      return jsonResponse({ error: 'Mensagem sem ID do WhatsApp. Não é possível editar.' }, 400);
    }

    // Verificar janela de 15 minutos
    const sentAt = new Date(msg.criado_em).getTime();
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    if (now - sentAt > fifteenMinutes) {
      return jsonResponse({ error: 'A janela de 15 minutos para edição expirou.' }, 400);
    }

    // Buscar conexão UAZAPI da organização
    const { data: conn } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('uazapi_url, uazapi_token')
      .eq('organization_id', msg.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (!conn?.uazapi_url || !conn?.uazapi_token) {
      return jsonResponse({ error: 'WhatsApp não conectado. Configure a integração UAZAPI.' }, 400);
    }

    const uazapiUrl = conn.uazapi_url.replace(/\/$/, '');
    const uazapiToken = conn.uazapi_token;

    // Chamar UAZAPI POST /message/edit
    console.log(`[edit-message] Editando msg ${msg.id_mensagem} via ${uazapiUrl}/message/edit`);

    const uazapiRes = await fetch(`${uazapiUrl}/message/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'token': uazapiToken },
      body: JSON.stringify({ id: msg.id_mensagem, text: new_text }),
    });

    const uazapiRespText = await uazapiRes.text();

    if (!uazapiRes.ok) {
      console.error(`[edit-message] UAZAPI erro ${uazapiRes.status}: ${uazapiRespText.substring(0, 200)}`);
      return jsonResponse({ error: `Não foi possível editar. A janela de 15 minutos pode ter expirado. (UAZAPI: ${uazapiRes.status})` }, 400);
    }

    // Atualizar no banco: preservar original_content apenas na primeira edição
    const updateData: any = {
      conteudo: new_text,
      is_edited: true,
      edited_at: new Date().toISOString(),
    };

    // Só salva original_content se for a primeira edição (campo ainda null)
    if (!msg.original_content) {
      updateData.original_content = msg.conteudo;
    }

    const { error: updateError } = await supabaseAdmin
      .from('mensagens')
      .update(updateData)
      .eq('id', message_id);

    if (updateError) {
      console.error(`[edit-message] Erro ao atualizar banco:`, updateError.message);
      return jsonResponse({ error: 'Mensagem editada no WhatsApp mas falhou ao salvar no banco.' }, 500);
    }

    return jsonResponse({ success: true, message_id, new_text });

  } catch (error: any) {
    console.error('[edit-message] Erro:', error.message);
    return jsonResponse({ error: error.message }, 400);
  }
});
