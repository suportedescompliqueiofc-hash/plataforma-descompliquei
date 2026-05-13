import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cleanPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && !cleaned.startsWith('55')) cleaned = '55' + cleaned;
  else if (cleaned.length === 10 && !cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
};

// ── Detecta e extrai campos do payload UaZAPI raw ─────────────────────────────
function parseUazapiPayload(payload: any) {
  const data = payload?.data;
  if (!data?.key?.remoteJid) return null;

  const remoteJid: string = data.key.remoteJid;
  const fromMe: boolean = data.key.fromMe === true;
  const isGroup = remoteJid.endsWith('@g.us');
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const externalId = data.key.id || null;
  const messageType: string = data.messageType || '';
  const msg = data.message || {};

  const uazapiMediaUrl = data.media?.url || msg.imageMessage?.url || msg.audioMessage?.url || msg.videoMessage?.url || msg.documentMessage?.url || msg.pttMessage?.url || null;

  let text = '';
  let tipoConteudo = 'texto';
  let mediaPath: string | null = null;

  if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
    text = msg.conversation || msg.extendedTextMessage?.text || '';
  } else if (messageType === 'audioMessage' || messageType === 'pttMessage') {
    tipoConteudo = 'audio';
    mediaPath = uazapiMediaUrl;
  } else if (messageType === 'imageMessage') {
    tipoConteudo = 'imagem';
    text = msg.imageMessage?.caption || '';
    mediaPath = uazapiMediaUrl;
  } else if (messageType === 'videoMessage') {
    tipoConteudo = 'video';
    text = msg.videoMessage?.caption || '';
    mediaPath = uazapiMediaUrl;
  } else if (messageType === 'documentMessage') {
    tipoConteudo = 'pdf';
    text = msg.documentMessage?.title || msg.documentMessage?.fileName || '';
    mediaPath = uazapiMediaUrl;
  }

  return { from: phone, text, externalId, tipoConteudo, mediaPath, fromMe, isGroup, rawPayload: payload };
}

// ── Extrai campos do formato n8n-wrapped ──────────────────────────────────────
function parseN8nPayload(payload: any) {
  const data = Array.isArray(payload) ? payload[0] : payload;
  const body = data?.body || data || {};
  
  // Tentar múltiplas fontes para o telefone (prioridade: chat.phone > sender_pn > from)
  let from = body.chat?.phone || null;
  let isGroup = body.chat?.isGroup === true || body.isGroup === true || body.message?.chat?.wa_isGroup === true;

  if (!from) {
    // sender_pn vem no formato "5521977297413@s.whatsapp.net" - precisamos remover o sufixo
    const senderPn = body.message?.sender_pn || null;
    if (senderPn) {
      if (senderPn.includes('@g.us')) isGroup = true;
      from = senderPn.replace('@s.whatsapp.net', '').replace('@g.us', '');
    }
  }
  if (!from) {
      from = body.from || null;
      if (typeof from === 'string' && from.includes('@g.us')) isGroup = true;
      from = (from || '').replace('@s.whatsapp.net', '').replace('@g.us', '');
  }
  if (!from) return null;

  const fromMe = body.message?.fromMe === true;
  const text = body.message?.text || body.message?.content?.text || body.text || '';
  const externalId = body.message?.messageid || body.messageid || null;
  const conversionSource = body.message?.contextInfo?.conversionSource || '';
  
  const mediaType = (body.message?.mediaType || body.message?.messageType || body.message?.content?.mimetype || '').toLowerCase();
  const mediaPath = body.message?.content?.URL || body.message?.content?.url || body.message?.url || body.media?.url || null;

  let tipoConteudo = 'texto';
  if (mediaType.includes('ptt') || mediaType.includes('audio') || mediaType.includes('audiomessage')) tipoConteudo = 'audio';
  else if (mediaType.includes('image') || mediaType.includes('imagemessage')) tipoConteudo = 'imagem';
  else if (mediaType.includes('video') || mediaType.includes('videomessage')) tipoConteudo = 'video';
  else if (mediaType.includes('document') || mediaType.includes('pdf') || mediaType.includes('documentmessage')) tipoConteudo = 'pdf';

  return { from, text, externalId, tipoConteudo, mediaPath, conversionSource, fromMe, isGroup, rawPayload: data };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    
    // DEBUG: Save payload to database for inspection
    try {
      await supabaseAdmin.from('debug_payloads').insert({ payload });
    } catch (e) {}

    // DEBUG: Gravar payload detalhado se for mensagem de anúncio
    try {
      const _msgContent = payload?.message?.content;
      const _ctxInfo = _msgContent?.contextInfo ||
                       _msgContent?.extendedTextMessage?.contextInfo ||
                       payload?.message?.contextInfo ||
                       payload?.data?.message?.contextInfo;
      const _hasAdData = _ctxInfo?.externalAdReply ||
                         _ctxInfo?.conversionSource === 'FB_Ads' ||
                         _ctxInfo?.entryPointConversionSource === 'ctwa_ad';

      if (_hasAdData && !payload?.message?.fromMe) {
        await supabaseAdmin.from('debug_payloads').insert({
          payload: {
            type: 'ad_context_capture',
            telefone: cleanPhoneNumber(payload?.chat?.phone || payload?.data?.key?.remoteJid?.replace('@s.whatsapp.net', '') || ''),
            sourceID: _ctxInfo?.externalAdReply?.sourceID,
            sourceApp: _ctxInfo?.externalAdReply?.sourceApp,
            sourceType: _ctxInfo?.externalAdReply?.sourceType,
            conversionSource: _ctxInfo?.conversionSource,
            entryPointSource: _ctxInfo?.entryPointConversionSource,
            full_context: _ctxInfo
          }
        });
        console.log('[DEBUG-AD] Payload de anúncio gravado no debug_payloads');
      }
    } catch (e) {}

    console.log("PAYLOAD BRUTO RECEBIDO:", JSON.stringify(payload));
    let from, text, externalId, tipoConteudo, mediaPath, conversionSource, fromMe, isGroupFlag = false;

    const uazapi = parseUazapiPayload(payload);
    let rawPayloadData: any = null;

    if (uazapi) {
      ({ from, text, externalId, tipoConteudo, mediaPath, fromMe, isGroup: isGroupFlag, rawPayload: rawPayloadData } = uazapi);
    } else {
      const n8n = parseN8nPayload(payload);
      if (!n8n?.from) return new Response(JSON.stringify({ error: 'Telefone obrigatório.' }), { status: 400, headers: corsHeaders });
      ({ from, text, externalId, tipoConteudo, mediaPath, conversionSource, fromMe, isGroup: isGroupFlag, rawPayload: rawPayloadData } = n8n);
    }

    // ── Ignorar mensagens de grupo ──────────────────────────────────────────
    // Grupos não são leads individuais e não devem ser processados
    const isGroupMessage = isGroupFlag || rawPayloadData?.isGroup || rawPayloadData?.chat?.wa_isGroup || false;
    if (isGroupMessage) {
      console.log(`[receive-message] Ignorando mensagem de GRUPO. From: ${from}`);
      return new Response(JSON.stringify({ ok: true, skipped: 'group_message' }), { status: 200, headers: corsHeaders });
    }

    const phoneWithCountryCode = cleanPhoneNumber(from);

    // ── Resgatar Organization ID Baseado na Instância ────────────────────────
    let orgId = null;
    let userId = null;

    const instanceName = payload?.instance || payload?.instanceName || rawPayloadData?.instance || rawPayloadData?.data?.instanceName || rawPayloadData?.body?.instanceName;
      
    if (instanceName) {
      const { data: connection } = await supabaseAdmin
        .from('whatsapp_connections')
        .select('organization_id, usuario_id_default')
        .eq('instance_name', instanceName)
        .maybeSingle();

      if (connection) {
        orgId = connection.organization_id;
        userId = connection.usuario_id_default;
      }
    } else {
       const { data: defaultConnection } = await supabaseAdmin
        .from('whatsapp_connections')
        .select('organization_id, usuario_id_default')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

       if (defaultConnection) {
          orgId = defaultConnection.organization_id;
          userId = defaultConnection.usuario_id_default;
       }
    }

    if (orgId) {
      const { data: blockedNumber, error: blacklistError } = await supabaseAdmin
        .from('lead_blacklist')
        .select('id')
        .eq('organization_id', orgId)
        .eq('telefone_normalizado', phoneWithCountryCode)
        .maybeSingle();

      if (blacklistError) {
        console.error('[receive-message] Erro ao consultar blacklist:', blacklistError);
      }

      if (blockedNumber) {
        console.log(`[receive-message] Número bloqueado ignorado: ${phoneWithCountryCode}`);
        return new Response(JSON.stringify({ ok: true, skipped: 'blacklisted_number' }), { status: 200, headers: corsHeaders });
      }
    }

    // ── Detecção de Origem (Marketing vs Orgânico) ───────────────────────────
    let detectedOrigem = 'organico';
    let detectedFonte = '';
    let detectedSourceID: string | null = null;
    let detectedAdReply: any = null;
    let detectedContextInfo: any = null;

    try {
      // Chaves que contêm mensagens citadas/encaminhadas — NÃO devem ser buscadas
      const IGNORED_KEYS = new Set([
        'quotedMessage', 'quotedMsg', 'quoted', 'forwardedMessage',
        'ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2',
        'templateMessage', 'buttonsResponseMessage',
      ]);

      const findInObject = (obj: any, key: string, value?: string): any => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj[key] === value || (value === undefined && key in obj)) return obj[key] || true;
        for (const k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k) && !IGNORED_KEYS.has(k)) {
            const found = findInObject(obj[k], key, value);
            if (found) return found;
          }
        }
        return null;
      };

      // Busca recursiva (fallback)
      const hasFBAds = findInObject(payload, 'conversionSource', 'FB_Ads') || findInObject(payload, 'entryPointConversionExternalSource', 'FB_Ads');
      const hasMarketingContext = findInObject(payload, 'entryPointConversionSource', 'ctwa_ad');

      // Busca direta em TODOS os caminhos possíveis do payload (n8n + UaZAPI)
      const msgPayload = payload?.message || {};
      const dataMsg = payload?.data?.message || {};
      detectedContextInfo =
        msgPayload?.content?.contextInfo ||
        msgPayload?.contextInfo ||
        msgPayload?.content?.extendedTextMessage?.contextInfo ||
        dataMsg?.contextInfo ||
        dataMsg?.extendedTextMessage?.contextInfo ||
        dataMsg?.imageMessage?.contextInfo ||
        dataMsg?.videoMessage?.contextInfo ||
        rawPayloadData?.body?.message?.content?.contextInfo ||
        rawPayloadData?.body?.message?.contextInfo ||
        null;

      detectedAdReply = detectedContextInfo?.externalAdReply;
      detectedSourceID = detectedAdReply?.sourceID || null;

      const sourceApp = detectedAdReply?.sourceApp ||
                        detectedContextInfo?.entryPointConversionApp ||
                        'facebook';

      console.log('[META-TRACKING] contextInfo encontrado:', !!detectedContextInfo)
      console.log('[META-TRACKING] externalAdReply encontrado:', !!detectedAdReply)
      console.log('[META-TRACKING] sourceID:', detectedSourceID)
      console.log('[META-TRACKING] sourceType:', detectedAdReply?.sourceType)
      console.log('[META-TRACKING] conversionSource:', detectedContextInfo?.conversionSource)
      console.log('[META-TRACKING] entryPoint:', detectedContextInfo?.entryPointConversionSource)
      console.log('[META-TRACKING] hasFBAds (recursivo):', !!hasFBAds)
      console.log('[META-TRACKING] hasMarketingContext (recursivo):', !!hasMarketingContext)

      // Decisão: é de anúncio? Qualquer indicador basta
      const isFromAd =
        (detectedAdReply?.sourceType === 'ad' && detectedSourceID) ||
        detectedContextInfo?.conversionSource === 'FB_Ads' ||
        detectedContextInfo?.entryPointConversionSource === 'ctwa_ad' ||
        hasFBAds ||
        hasMarketingContext;

      if (isFromAd) {
        detectedOrigem = 'marketing';
        if (sourceApp.toLowerCase().includes('instagram')) {
          detectedFonte = 'instagram';
        } else {
          detectedFonte = 'facebook';
        }
        console.log(`[META-TRACKING] DETECTADO COMO MARKETING! fonte: ${detectedFonte}, sourceApp: ${sourceApp}, sourceID: ${detectedSourceID || 'N/A'}`);
      } else {
        console.log('[META-TRACKING] Lead classificado como orgânico')
      }

    } catch (e) {
      console.error('[receive-message] Erro na detecção de marketing:', e);
    }

    // ── Detecção por mensagem padrão do Instagram (Dra Tayane) ──────────────
    const DRA_TAYANE_ORG_ID = '2780f688-e00d-4d22-a8c5-67cbaea77d24';
    const INSTAGRAM_STANDARD_MSG = 'Olá! Tenho interesse e gostaria de mais informações, por favor.';

    if (
      detectedOrigem === 'organico' &&
      !fromMe &&
      orgId === DRA_TAYANE_ORG_ID &&
      text?.trim() === INSTAGRAM_STANDARD_MSG
    ) {
      detectedOrigem = 'marketing';
      detectedFonte = 'instagram';
      console.log(`[META-TRACKING] Lead classificado como MARKETING (mensagem padrão Instagram — Dra Tayane)`);
    }

    // ── Fallback: se outgoing e sem detecção, verificar ad_context_capture ──
    // Cobre o caso onde a mensagem CTWA de entrada falhou ao criar o lead,
    // e o atendente humano envia manualmente depois (fromMe=true, sem contexto).
    if (fromMe && detectedOrigem === 'organico') {
      try {
        const { data: priorAdCtx } = await supabaseAdmin
          .from('debug_payloads')
          .select('payload')
          .filter('payload->>type', 'eq', 'ad_context_capture')
          .filter('payload->>telefone', 'eq', phoneWithCountryCode)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (priorAdCtx?.payload) {
          detectedOrigem = 'marketing';
          detectedFonte = priorAdCtx.payload.sourceApp || 'facebook';
          detectedSourceID = priorAdCtx.payload.sourceID || null;
          console.log(`[META-TRACKING] CTWA context recuperado de webhook anterior! Upgrading para marketing. sourceID: ${detectedSourceID}`);
        }
      } catch (e) {
        console.warn('[META-TRACKING] Erro ao verificar ad_context_capture anterior:', e);
      }
    }

    // ── Buscar criativo_id pelo sourceID (se detectado) ─────────────────────
    let detectedCriativoId: string | null = null;
    if (detectedSourceID && orgId) {
      try {
        // Primeiro tenta na tabela criativos
        const { data: existingCriativo } = await supabaseAdmin
          .from('criativos')
          .select('id')
          .eq('id_externo', detectedSourceID)
          .eq('organization_id', orgId)
          .maybeSingle();

        if (existingCriativo) {
          detectedCriativoId = existingCriativo.id;
          console.log('[META-TRACKING] criativo_id vinculado (criativos):', detectedCriativoId);
        } else {
          // Fallback: buscar na meta_ads
          const { data: adData } = await supabaseAdmin
            .from('meta_ads')
            .select('id')
            .eq('meta_ad_id', detectedSourceID)
            .eq('organization_id', orgId)
            .maybeSingle();

          if (adData) {
            detectedCriativoId = adData.id;
            console.log('[META-TRACKING] criativo_id vinculado (meta_ads):', detectedCriativoId);
          }
        }
      } catch (e) {
        console.error('[META-TRACKING] Erro ao buscar criativo:', e);
      }
    }

    // ── Encontrar ou Criar Lead ──────────────────────────────────────────────
    let leadQuery = supabaseAdmin
      .from('leads')
      .select('id, organization_id, usuario_id, nome, telefone, ia_ativa, origem, criativo_id')
      .or(`telefone.eq.${phoneWithCountryCode},telefone.eq.${phoneWithCountryCode.substring(2)}`);
      
    if (orgId) {
      leadQuery = leadQuery.eq('organization_id', orgId);
    }
    
    let { data: lead } = await leadQuery.limit(1).maybeSingle();

    if (!lead) {
      if (!orgId) {
        return new Response(JSON.stringify({ message: 'Lead não encontrado e impossível criar (falta organization_id).' }), { status: 404, headers: corsHeaders });
      }

      const contactName = rawPayloadData?.pushName || rawPayloadData?.data?.pushName || rawPayloadData?.chat?.name || rawPayloadData?.message?.senderName || rawPayloadData?.chat?.wa_name || rawPayloadData?.body?.message?.senderName || rawPayloadData?.body?.chat?.contactName || rawPayloadData?.body?.chat?.name || phoneWithCountryCode;

      const { data: newLead, error: createLeadError } = await supabaseAdmin
        .from('leads')
        .insert({
          telefone: phoneWithCountryCode,
          nome: contactName,
          organization_id: orgId,
          usuario_id: userId,
          status: 'Ativo',
          posicao_pipeline: 1,
          origem: detectedOrigem,
          ia_ativa: detectedOrigem === 'marketing' ? true : null,
          ...(detectedFonte ? { fonte: detectedFonte, meta_ad_platform: detectedFonte } : {}),
          ...(detectedSourceID ? { meta_ad_source_id: detectedSourceID } : {}),
          ...(detectedCriativoId ? { criativo_id: detectedCriativoId } : {})
        })
        .select('id, organization_id, usuario_id, nome, telefone, ia_ativa, origem, criativo_id')
        .single();

      if (createLeadError) {
        console.warn(`[receive-message] Falha ao criar lead (${createLeadError.code}): ${createLeadError.message}. Buscando lead existente...`);
        let retryQuery = supabaseAdmin
          .from('leads')
          .select('id, organization_id, usuario_id, nome, telefone, ia_ativa, origem, criativo_id')
          .or(`telefone.eq.${phoneWithCountryCode},telefone.eq.${phoneWithCountryCode.substring(2)}`);
        if (orgId) retryQuery = retryQuery.eq('organization_id', orgId);
        const { data: existingLead } = await retryQuery.limit(1).maybeSingle();

        if (existingLead) {
          lead = existingLead;
          console.log(`[receive-message] Lead encontrado no retry: ${lead.id}`);
        } else {
          console.error('[receive-message] Lead não encontrado mesmo após retry:', createLeadError);
          return new Response(JSON.stringify({ message: 'Erro ao criar lead', error: createLeadError.message }), { status: 500, headers: corsHeaders });
        }
      } else {
        lead = newLead;
        console.log(`Novo lead registrado: ${contactName} / ${phoneWithCountryCode} (${detectedOrigem})`);
      }
    } else {
      // Origem do lead é definida apenas na criação — não reclassificar leads existentes
      // Contatos orgânicos podem clicar em anúncios depois, mas continuam orgânicos
    }

    // ── Captura de Criativo Meta Ads (Click-to-WhatsApp) ────────────────────
    // Se detectou marketing e o lead existe, garantir que origem/fonte/criativo estão atualizados
    // Roda tanto para entrada quanto saída (fromMe), pois o fallback ad_context_capture
    // pode ter detectado marketing em mensagens de saída
    if (lead && detectedOrigem === 'marketing') {
      try {
        const leadUpdate: Record<string, any> = {
          origem: 'marketing',
          fonte: detectedFonte || 'facebook',
          meta_ad_platform: detectedFonte || 'facebook',
        };

        // Se ia_ativa é null (orgânico, nunca setado), ativar para marketing
        // Se ia_ativa é false (transbordo humano), NÃO reativar automaticamente
        if (lead.ia_ativa === null || lead.ia_ativa === undefined) {
          leadUpdate.ia_ativa = true;
          console.log(`[META-TRACKING] ia_ativa setado para true (era null/undefined)`);
        }

        if (detectedSourceID) {
          leadUpdate.meta_ad_source_id = detectedSourceID;
        }

        // Se já temos criativo_id da detecção anterior, usar
        if (detectedCriativoId && !lead.criativo_id) {
          leadUpdate.criativo_id = detectedCriativoId;
        }

        // Se temos sourceID mas ainda não temos criativo, tentar criar
        if (detectedSourceID && !lead.criativo_id && !detectedCriativoId) {
          try {
            const { data: existingCriativo } = await supabaseAdmin
              .from('criativos')
              .select('id')
              .eq('id_externo', detectedSourceID)
              .eq('organization_id', lead.organization_id)
              .maybeSingle();

            if (existingCriativo) {
              leadUpdate.criativo_id = existingCriativo.id;
              console.log(`[META-TRACKING] Criativo existente vinculado: ${existingCriativo.id}`);
            } else if (detectedAdReply) {
              let metaNome: string | null = null;
              const { data: metaAd } = await supabaseAdmin
                .from('meta_ads')
                .select('nome')
                .eq('meta_ad_id', detectedSourceID)
                .eq('organization_id', lead.organization_id)
                .maybeSingle();
              if (metaAd) metaNome = metaAd.nome;

              const { data: newCriativo, error: createErr } = await supabaseAdmin
                .from('criativos')
                .insert({
                  organization_id: lead.organization_id,
                  id_externo: detectedSourceID,
                  nome: metaNome || detectedAdReply.title || `Ad ${detectedSourceID}`,
                  titulo: detectedAdReply.title || null,
                  conteudo: detectedAdReply.body || null,
                  url_thumbnail: detectedAdReply.thumbnailURL || null,
                  plataforma: 'meta',
                  aplicativo: detectedAdReply.sourceApp || null,
                })
                .select('id')
                .single();

              if (createErr) {
                console.error('[META-TRACKING] Erro ao criar criativo:', createErr);
              } else {
                leadUpdate.criativo_id = newCriativo.id;
                console.log(`[META-TRACKING] Criativo criado automaticamente: ${newCriativo.id}`);
              }
            }
          } catch (adLookupErr) {
            console.error('[META-TRACKING] Erro ao buscar/criar criativo:', adLookupErr);
          }
        }

        // Atualizar lead (mesmo se acabou de ser criado, para garantir consistência)
        const { error: updateErr } = await supabaseAdmin
          .from('leads')
          .update(leadUpdate)
          .eq('id', lead.id);

        if (updateErr) {
          console.error('[META-TRACKING] Erro ao atualizar lead:', updateErr);
        } else {
          console.log(`[META-TRACKING] Lead ${lead.id} atualizado: origem=marketing, fonte=${leadUpdate.fonte}, criativo=${leadUpdate.criativo_id || 'N/A'}, sourceID=${detectedSourceID || 'N/A'}`);
        }

        // Debug payload
        try {
          await supabaseAdmin.from('debug_payloads').insert({
            payload: {
              type: 'ctwa_ad_capture',
              lead_id: lead.id,
              sourceID: detectedSourceID,
              fonte: detectedFonte,
              criativo_id: leadUpdate.criativo_id || null,
              ctwa_clid: detectedContextInfo?.ctwaClid || null,
            }
          });
        } catch (_) {}
      } catch (adCaptureErr) {
        console.error('[META-TRACKING] Erro na captura de criativo Meta Ads:', adCaptureErr);
      }
    }

    // ── Definição de Direção/Remetente ─────────────────────────────────────────
    let direcao = 'entrada';
    let remetente = 'lead';
    if (fromMe) {
        direcao = 'saida';
        remetente = 'agente'; // Indica envio manual pelo App ou CRM
    }

    // ── Deduplicação: Verificar se a mensagem já foi registrada ──────────────
    if (externalId && lead?.id) {
      const { data: existing } = await supabaseAdmin
        .from('mensagens')
        .select('id')
        .eq('id_mensagem', externalId)
        .eq('lead_id', lead.id)
        .maybeSingle();
      
      if (existing) {
        // Se já existe, apenas desativa a IA se a mensagem foi enviada pelo humano/instância
        if (fromMe) {
            await supabaseAdmin.from('leads').update({ ia_ativa: false } as any).eq('id', lead.id);
            console.log(`[TRANSBORDO] ia_ativa desativada para lead ${lead.id} — mensagem humana duplicada (fromMe=true)`);
        }
        return new Response(JSON.stringify({ ok: true, skipped: 'duplicate_id' }), { status: 200, headers: corsHeaders });
      }
    }

    // A partir daqui, é uma nova mensagem.
    // Se for enviada por humano (fromMe = agente via WhatsApp ou CRM), desativamos a IA.
    // Isso garante transbordo: qualquer mensagem humana pausa a IA imediatamente.
    if (fromMe) {
      await supabaseAdmin.from('leads').update({ ia_ativa: false } as any).eq('id', lead.id);
      lead = { ...lead, ia_ativa: false } as any; // Atualiza objeto local para evitar disparo da IA nesta mesma execução
      console.log(`[TRANSBORDO] ia_ativa desativada para lead ${lead.id} — mensagem humana detectada (fromMe=true)`);
    }
    
    // ── Sincronização de Etiquetas (Tags) ──────────────────────────────────
    // Se o webhook trouxer wa_label, atribuímos ao lead
    let waLabels = rawPayloadData?.chat?.wa_label || payload?.chat?.wa_label || null;
    if (Array.isArray(waLabels) && waLabels.length > 0 && lead?.id && orgId) {
      // Tags podem vir no formato "OwnerPhone:LabelId", precisamos só do LabelId
      waLabels = waLabels.map(lbl => String(lbl).includes(':') ? String(lbl).split(':')[1] : String(lbl));
      try {
        const { data: matchedTags } = await supabaseAdmin
          .from('tags')
          .select('id')
          .eq('organization_id', orgId)
          .in('label_lid', waLabels);

        if (matchedTags && matchedTags.length > 0) {
          for (const t of matchedTags) {
            await supabaseAdmin.from('leads_tags').upsert(
              { lead_id: lead.id, tag_id: t.id },
              { onConflict: 'lead_id,tag_id', ignoreDuplicates: true }
            );
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar tags do lead:', err);
      }
    }

    // ── Upload de Mídia ───────────────────────────────────────────────────────
    let uploadedFilePath: string | null = null;
    if (mediaPath && tipoConteudo !== 'texto') {
      try {
        
        const isUrl = mediaPath.startsWith('http');
        
        if (isUrl) {
            let buffer: ArrayBuffer | null = null;
            let contentType = 'application/octet-stream';
            let downloaded = false;

            // Se for link mmg.whatsapp.net protegido, usar a própria UaZAPI para baixar
            if (mediaPath.includes('mmg.whatsapp.net')) {
                console.log(`[receive-message] Link protegido do WhatsApp detectado. Solicitando via UaZAPI /message/download...`);
                
                let uazapiBaseUrl = rawPayloadData?.BaseUrl;
                let uazapiToken = rawPayloadData?.token;
                
                // Se a mensagem vier do webhook puro da UaZAPI (sem n8n wrapper)
                // O UaZAPI não manda BaseUrl nem token. Neste caso, buscaremos da tabela de conexões.
                if (!uazapiBaseUrl || !uazapiToken) {
                    console.log(`[receive-message] Credenciais ausentes no payload. Buscando da tabela de conexões para a organização ${lead.organization_id}...`);
                    const { data: conn } = await supabaseAdmin
                        .from('whatsapp_connections')
                        .select('uazapi_url, uazapi_token')
                        .eq('organization_id', lead.organization_id)
                        .eq('status', 'connected')
                        .maybeSingle();
                        
                    if (conn) {
                        uazapiBaseUrl = conn.uazapi_url;
                        uazapiToken = conn.uazapi_token;
                        console.log(`[receive-message] Credenciais encontradas no banco de dados.`);
                    } else {
                         console.error(`[receive-message] Nenhuma conexão ativa encontrada para a organização ${lead.organization_id}.`);
                    }
                }
                
                if (uazapiBaseUrl && uazapiToken && externalId) {
                    try {
                        const dlRes = await fetch(`${uazapiBaseUrl.replace(/\/$/, '')}/message/download`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'token': uazapiToken
                            },
                            body: JSON.stringify({ id: externalId, return_base64: true, return_link: false })
                        });
                        
                        if (dlRes.ok) {
                            const dlData = await dlRes.json();
                            if (dlData.base64Data) {
                                const binaryString = atob(dlData.base64Data);
                                const len = binaryString.length;
                                const bytes = new Uint8Array(len);
                                for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
                                buffer = bytes.buffer;
                                contentType = dlData.mimetype || contentType;
                                downloaded = true;
                                console.log(`[receive-message] Download via UaZAPI concluído com sucesso. Mime: ${contentType}`);
                            }
                        }
                    } catch (dlErr) {
                        console.error(`[receive-message] Erro ao chamar /message/download:`, dlErr);
                    }
                }
            }

            // Fallback para HTTP GET normal (links públicos)
            if (!downloaded) {
                const mediaRes = await fetch(mediaPath);
                if (mediaRes.ok) {
                    buffer = await mediaRes.arrayBuffer();
                    contentType = mediaRes.headers.get('content-type') || contentType;
                    downloaded = true;
                }
            }

            if (downloaded && buffer) {
                let ext = 'bin';
                if (contentType.includes('image/jpeg')) ext = 'jpg';
                else if (contentType.includes('image/png')) ext = 'png';
                else if (contentType.includes('video/mp4')) ext = 'mp4';
                else if (contentType.includes('audio/ogg')) ext = 'ogg';
                else if (contentType.includes('application/pdf')) ext = 'pdf';
                else if (tipoConteudo === 'audio') ext = 'ogg';
                else if (tipoConteudo === 'imagem') ext = 'jpg';

                const bucketName = tipoConteudo === 'audio' ? 'audio-mensagens' : 'media-mensagens';
                const path = `${lead.organization_id}/${lead.id}/${Date.now()}.${ext}`;
                
                const { error: uploadErr } = await supabaseAdmin.storage.from(bucketName).upload(path, buffer, {
                    contentType: contentType,
                    upsert: true
                });
                
                if (!uploadErr) {
                    uploadedFilePath = path;
                }
            }
        } else {
            uploadedFilePath = mediaPath;
        }
      } catch (e) {
        console.error('[receive-message] Falha crítica ao baixar mídia:', e);
      }
    }

    // ── Insere Mensagem ───────────────────────────────────────────────────────
    const { error: msgInsertError } = await supabaseAdmin.from('mensagens').insert({
      lead_id: lead.id,
      organization_id: lead.organization_id,
      conteudo: text || '',
      direcao: direcao,
      remetente: remetente,
      tipo_conteudo: uploadedFilePath ? tipoConteudo : 'texto',
      media_path: uploadedFilePath,
      id_mensagem: externalId,
    });

    if (msgInsertError) {
        // Erro 23505 = duplicate key (violação unique constraint). 
        // Acontece quando o UaZapi manda 2 requisições no mesmo milissegundo. A 1ª salva com sucesso e a 2ª cai aqui.
        if (msgInsertError.code === '23505') {
             console.log(`[receive-message] Mensagem (ID ${externalId}) ignorada: já foi inserida pela requisição concorrente.`);
        } else {
             console.error("[receive-message] Erro ao inserir mensagem no BD:", msgInsertError);
        }
    } else {
        console.log(`[receive-message] Mensagem (ID ${externalId}) de ${remetente} salva com sucesso no BD.`);
    }

    // ── Pausa cadência ativa quando lead responde ─────────────────────────────
    if (direcao === 'entrada' && lead?.id) {
      try {
        const { data: activeCadence } = await supabaseAdmin
          .from('lead_cadencias')
          .select('id, cadencia_id')
          .eq('lead_id', lead.id)
          .eq('status', 'ativo')
          .maybeSingle();

        if (activeCadence) {
          await supabaseAdmin
            .from('lead_cadencias')
            .update({ status: 'pausado', proxima_execucao: null })
            .eq('id', activeCadence.id);

          let cadenceName = 'cadência ativa';
          if (activeCadence.cadencia_id) {
            const { data: cadencia } = await supabaseAdmin
              .from('cadencias')
              .select('nome')
              .eq('id', activeCadence.cadencia_id)
              .maybeSingle();
            if (cadencia?.nome) cadenceName = cadencia.nome;
          }

          const leadName = lead.nome || lead.telefone;

          await supabaseAdmin.from('notificacoes').insert({
            lead_id: lead.id,
            organization_id: lead.organization_id,
            mensagem: `📩 ${leadName} respondeu à cadência "${cadenceName}". O fluxo foi pausado automaticamente.`,
            status: 'pendente',
          });

          console.log(`[receive-message] Cadência "${cadenceName}" pausada para lead ${lead.id} após resposta.`);
        }
      } catch (e) {
        console.error('[receive-message] Erro ao pausar cadência após resposta do lead:', e);
      }
    }

    // ── Dispara IA ──────────────────────────────────────────────────────────
    // Apenas dispara IA se a mensagem for de entrada e IA estiver ativa
    console.log('[IA-DISPATCH] Verificando condições para lead:', lead.id, 'telefone:', lead.telefone)
    console.log('[IA-DISPATCH] direcao:', direcao)
    console.log('[IA-DISPATCH] ia_ativa:', lead.ia_ativa, '(tipo:', typeof lead.ia_ativa, ')')
    console.log('[IA-DISPATCH] fromMe:', fromMe)
    console.log('[IA-DISPATCH] tipoConteudo:', tipoConteudo)

    // ia_ativa pode ser true, false ou null.
    // true = IA ativa (leads de marketing)
    // null = nunca definido (leads orgânicos) → IA NÃO dispara
    // false = desativado explicitamente (transbordo humano) → IA NÃO dispara
    const iaAtiva = lead.ia_ativa === true;
    const deveDisparar = direcao === 'entrada' && iaAtiva;
    console.log('[IA-DISPATCH] Decisão final:', deveDisparar, '(iaAtiva:', iaAtiva, ')')

    if (deveDisparar) {
        const payload = { lead_id: lead.id, organization_id: lead.organization_id, mensagem_usuario: text, tipo_mensagem: tipoConteudo, media_path: uploadedFilePath };
        console.log('[IA-DISPATCH] Disparando whatsapp-ai-agent para lead:', lead.id)
        const aiRequest = supabaseAdmin.functions.invoke('whatsapp-ai-agent', {
          body: payload,
        }).catch((err: any) => {
          console.error('[IA-DISPATCH] Erro ao invocar whatsapp-ai-agent:', err)
        });

        // @ts-ignore - Garante que o isolado não morra antes de disparar a promise de background
        if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
           // @ts-ignore
           EdgeRuntime.waitUntil(aiRequest);
        }
    } else {
        const motivo = direcao !== 'entrada' ? 'mensagem de saída' : 'ia_ativa === false (transbordo humano)';
        console.log('[IA-DISPATCH] IA NÃO disparada. Motivo:', motivo);

        // Registrar log quando IA é ignorada em mensagem de entrada para debug
        if (direcao === 'entrada' && !iaAtiva) {
          try {
            await supabaseAdmin.from('ai_execution_logs').insert({
              organization_id: lead.organization_id,
              lead_id: lead.id,
              session_id: lead.telefone?.replace(/\D/g, '') || lead.id,
              status: 'skipped',
              etapa: 'bloqueado_receive_message',
              detalhe: `IA não disparada: ia_ativa=${lead.ia_ativa} (transbordo humano ativo). Lead precisa ter IA reativada manualmente.`,
            });
          } catch (logErr) {
            console.warn('[IA-DISPATCH] Falha ao registrar log de skip:', logErr);
          }
        }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('[receive-message] Erro interno:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
