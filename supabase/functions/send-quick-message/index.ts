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
    const {
      lead_id, mensagem, tipo, url_midia, titulo_pdf, telefone, user_id, remetente,
      // skip_db: se true, não salva no banco (mensagem já foi salva pelo frontend)
      skip_db = false,
      // internal_msg_id: id da mensagem já salva (para atualizar id_mensagem após envio)
      internal_msg_id = null,
      // Reply/Quote: WhatsApp message ID da mensagem sendo citada (StanzaId para UAZAPI)
      quoted_msg_id = null,
      // Reply/Quote: telefone do remetente da mensagem citada (para Participant)
      quoted_participant = null,
      // Reply/Quote: ID interno (FK mensagens.id) para salvar no banco
      quoted_message_id = null,
    } = await req.json();

    if (!lead_id || !telefone || !user_id) {
      return jsonResponse({ error: 'Parâmetros obrigatórios ausentes: lead_id, telefone, user_id' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile } = await supabaseAdmin
      .from('perfis')
      .select('organization_id')
      .eq('id', user_id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return jsonResponse({ error: 'Organização não encontrada para o usuário.' }, 400);
    }

    const { data: conn } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('uazapi_url, uazapi_token, usuario_id_default')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (!conn?.uazapi_url || !conn?.uazapi_token) {
      return jsonResponse({ error: 'WhatsApp não conectado. Configure a integração UAZAPI.' }, 400);
    }

    // Quando o agente humano envia uma mensagem, pausa a IA
    const rem = remetente || 'bot';
    if (rem === 'agente' && lead_id) {
      await supabaseAdmin.from('leads').update({ ia_ativa: false } as any).eq('id', lead_id);
    }

    // Salva no banco (a não ser que skip_db seja true)
    let savedMsgId: string | null = internal_msg_id;
    if (!skip_db) {
      const { data: savedMsg } = await supabaseAdmin
        .from('mensagens')
        .insert({
          lead_id,
          organization_id: profile.organization_id,
          user_id,
          conteudo: mensagem || '',
          direcao: 'saida',
          remetente: rem,
          tipo_conteudo: tipo || 'texto',
          media_path: url_midia || null,
          ...(quoted_message_id ? { quoted_message_id } : {}),
        })
        .select('id')
        .single();
      savedMsgId = savedMsg?.id ?? null;
    }

    const telefoneDigits = (telefone || '').replace(/\D/g, '');
    const phoneFormatted = telefoneDigits.startsWith('55') && telefoneDigits.length >= 12
      ? telefoneDigits
      : `55${telefoneDigits}`;
    if (!phoneFormatted || phoneFormatted.length < 12) {
      return jsonResponse({ error: `Telefone inválido: "${telefone}"` }, 400);
    }

    const uazapiUrl = conn.uazapi_url.replace(/\/$/, '');
    const uazapiToken = conn.uazapi_token;
    let uazapiPayload: any;
    let endpoint = '';

    // UaZAPI docs: todos os tipos de mídia usam POST /send/media
    // Campos: number, type, file, text (caption), docName (para docs)
    // Reply/Quote: campo "replyId" (string) = ID da mensagem para responder
    const quoteFields = quoted_msg_id ? { replyId: quoted_msg_id } : {};

    if (tipo === 'audio' && url_midia) {
      endpoint = '/send/media';
      uazapiPayload = { number: phoneFormatted, type: 'ptt', file: url_midia, ...quoteFields };
    } else if (tipo === 'imagem' && url_midia) {
      endpoint = '/send/media';
      uazapiPayload = { number: phoneFormatted, type: 'image', file: url_midia, text: mensagem || '', ...quoteFields };
    } else if (tipo === 'video' && url_midia) {
      endpoint = '/send/media';
      uazapiPayload = { number: phoneFormatted, type: 'video', file: url_midia, text: mensagem || '', ...quoteFields };
    } else if (tipo === 'pdf' && url_midia) {
      endpoint = '/send/media';
      uazapiPayload = { number: phoneFormatted, type: 'document', file: url_midia, docName: titulo_pdf || 'documento.pdf', text: mensagem || '', ...quoteFields };
    } else {
      endpoint = '/send/text';
      // delay apenas para mensagens da IA (remetente 'bot'), agente humano envia instantâneo
      uazapiPayload = { number: phoneFormatted, text: mensagem || '', ...(rem === 'bot' ? { delay: 1200 } : {}), ...quoteFields };
    }

    console.log(`[send-quick-message] Enviando para UAZAPI: ${uazapiUrl}${endpoint} | number=${phoneFormatted} | tipo=${tipo} | quote=${quoted_msg_id || 'none'}`);

    const uazapiRes = await fetch(`${uazapiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'token': uazapiToken },
      body: JSON.stringify(uazapiPayload),
    });

    const uazapiRespText = await uazapiRes.text();

    // DEBUG: salvar payload enviado + resposta da UAZAPI para diagnóstico
    if (quoted_msg_id) {
      try {
        await supabaseAdmin.from('debug_payloads').insert({
          payload: { sent_to: `${uazapiUrl}${endpoint}`, uazapi_payload: uazapiPayload, uazapi_response_status: uazapiRes.status, uazapi_response_body: uazapiRespText.substring(0, 1000) }
        });
      } catch (e) {}
    }

    let uazapiRespJson: any = {};
    try { uazapiRespJson = JSON.parse(uazapiRespText); } catch {}
    if (!uazapiRes.ok) {
      return jsonResponse({ error: `UAZAPI retornou ${uazapiRes.status}: ${uazapiRespText.substring(0, 200)}` }, 400);
    }

    const waMessageId = uazapiRespJson?.id ?? uazapiRespJson?.messageid ?? uazapiRespJson?.message?.id ?? null;
    if (waMessageId && savedMsgId) {
      await supabaseAdmin
        .from('mensagens')
        .update({ id_mensagem: waMessageId })
        .eq('id', savedMsgId);
    }

    return jsonResponse({ success: true, msg_id: savedMsgId, wa_id: waMessageId });

  } catch (error: any) {
    console.error('[send-quick-message] Erro:', error.message);
    return jsonResponse({ error: error.message }, 400);
  }
});
