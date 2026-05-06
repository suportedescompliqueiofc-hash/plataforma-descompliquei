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
    try {
      // Chaves que contêm mensagens citadas/encaminhadas — NÃO devem ser buscadas
      // pois carregam contexto de ad da mensagem ORIGINAL, não da atual
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

      const hasFBAds = findInObject(payload, 'conversionSource', 'FB_Ads') || findInObject(payload, 'entryPointConversionExternalSource', 'FB_Ads');
      const hasAdReply = findInObject(payload, 'externalAdReply');
      const hasMarketingContext = findInObject(payload, 'entryPointConversionSource', 'ctwa_ad');

      if (hasFBAds) {
        detectedOrigem = 'marketing';
        console.log(`[receive-message] DETECTADO COMO MARKETING VIA FB_Ads! (AdReply: ${!!hasAdReply}, context: ${!!hasMarketingContext})`);
      }

    } catch (e) {
      console.error('[receive-message] Erro na detecção de marketing:', e);
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

      const contactName = rawPayloadData?.pushName || rawPayloadData?.data?.pushName || rawPayloadData?.chat?.name || rawPayloadData?.body?.message?.senderName || rawPayloadData?.body?.chat?.contactName || rawPayloadData?.body?.chat?.name || phoneWithCountryCode;

      const { data: newLead, error: createLeadError } = await supabaseAdmin
        .from('leads')
        .insert({
          telefone: phoneWithCountryCode,
          nome: contactName,
          organization_id: orgId,
          usuario_id: userId,
          status: 'Ativo',
          posicao_pipeline: 1,
          origem: detectedOrigem
        })
        .select('id, organization_id, usuario_id, nome, telefone, ia_ativa, origem, criativo_id')
        .single();

      if (createLeadError) {
        console.error('Erro ao registrar novo lead:', createLeadError);
        return new Response(JSON.stringify({ message: 'Erro ao criar lead', error: createLeadError.message }), { status: 500, headers: corsHeaders });
      }

      lead = newLead;
      console.log(`Novo lead registrado: ${contactName} / ${phoneWithCountryCode} (${detectedOrigem})`);
    } else {
      // Origem do lead é definida apenas na criação — não reclassificar leads existentes
      // Contatos orgânicos podem clicar em anúncios depois, mas continuam orgânicos
    }

    // ── Captura de Criativo Meta Ads (Click-to-WhatsApp) ────────────────────
    if (!fromMe && lead && !lead.criativo_id) {
      try {
        const dataObj = payload?.data || {};
        const msg = dataObj?.message || {};
        const contextInfo = msg?.contextInfo
          || msg?.extendedTextMessage?.contextInfo
          || msg?.imageMessage?.contextInfo
          || msg?.videoMessage?.contextInfo
          || rawPayloadData?.body?.message?.content?.contextInfo
          || rawPayloadData?.body?.message?.contextInfo
          || null;

        const externalAdReply = contextInfo?.externalAdReply;
        const sourceType = externalAdReply?.sourceType;
        const sourceID = externalAdReply?.sourceID;

        if (sourceType === 'ad' && sourceID) {
          console.log(`[receive-message] Click-to-WhatsApp detectado! Ad ID: ${sourceID}, Platform: ${externalAdReply.sourceApp}`);

          let criativoId: string | null = null;
          try {
            const { data: existingCriativo } = await supabaseAdmin
              .from('criativos')
              .select('id')
              .eq('id_externo', sourceID)
              .eq('organization_id', lead.organization_id)
              .limit(1)
              .maybeSingle();

            if (existingCriativo) {
              criativoId = existingCriativo.id;
              console.log(`[receive-message] Criativo existente encontrado: ${criativoId}`);
            } else {
              let metaNome: string | null = null;
              const { data: metaAd } = await supabaseAdmin
                .from('meta_ads')
                .select('nome')
                .eq('meta_ad_id', sourceID)
                .eq('organization_id', lead.organization_id)
                .maybeSingle();
              if (metaAd) metaNome = metaAd.nome;

              const { data: newCriativo, error: createErr } = await supabaseAdmin
                .from('criativos')
                .insert({
                  organization_id: lead.organization_id,
                  id_externo: sourceID,
                  nome: metaNome || externalAdReply.title || `Ad ${sourceID}`,
                  titulo: externalAdReply.title || null,
                  conteudo: externalAdReply.body || null,
                  url_thumbnail: externalAdReply.thumbnailURL || null,
                  plataforma: 'meta',
                  aplicativo: externalAdReply.sourceApp || null,
                })
                .select('id')
                .single();

              if (createErr) {
                console.error('[receive-message] Erro ao criar criativo:', createErr);
              } else {
                criativoId = newCriativo.id;
                console.log(`[receive-message] Criativo criado automaticamente: ${criativoId}`);
              }
            }
          } catch (adLookupErr) {
            console.error('[receive-message] Erro ao buscar/criar criativo:', adLookupErr);
          }

          const adMetadata = {
            ad_source_id: sourceID,
            ad_title: externalAdReply.title || null,
            ad_body: externalAdReply.body || null,
            ad_thumbnail: externalAdReply.thumbnailURL || null,
            ad_platform: externalAdReply.sourceApp || null,
            ctwa_clid: contextInfo?.ctwaClid || null,
            captured_at: new Date().toISOString(),
          };

          const leadUpdate: Record<string, any> = {
            origem: 'marketing',
            fonte: externalAdReply.sourceApp || 'meta',
          };
          if (criativoId) leadUpdate.criativo_id = criativoId;

          const { error: updateErr } = await supabaseAdmin
            .from('leads')
            .update(leadUpdate)
            .eq('id', lead.id);

          if (updateErr) {
            console.error('[receive-message] Erro ao atualizar lead com dados do criativo:', updateErr);
          } else {
            console.log(`[receive-message] Lead ${lead.id} atualizado com criativo Meta Ads. Origem=marketing, Fonte=${leadUpdate.fonte}, CriativoID=${criativoId || 'N/A'}`);
          }

          try {
            await supabaseAdmin
              .from('debug_payloads')
              .insert({ payload: { type: 'ctwa_ad_capture', lead_id: lead.id, ad_metadata: adMetadata } });
          } catch (_) {}
        }
      } catch (adCaptureErr) {
        console.error('[receive-message] Erro na captura de criativo Meta Ads:', adCaptureErr);
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
        }
        return new Response(JSON.stringify({ ok: true, skipped: 'duplicate_id' }), { status: 200, headers: corsHeaders });
      }
    }

    // A partir daqui, é uma nova mensagem.
    // Se for enviada por você (fromMe), desativamos a IA.
    if (fromMe) {
      await supabaseAdmin.from('leads').update({ ia_ativa: false } as any).eq('id', lead.id);
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
    if (direcao === 'entrada' && lead.ia_ativa === true) {
        const payload = { lead_id: lead.id, organization_id: lead.organization_id, mensagem_usuario: text, tipo_mensagem: tipoConteudo, media_path: uploadedFilePath };
        const aiRequest = supabaseAdmin.functions.invoke('whatsapp-ai-agent', {
          body: payload,
        }).catch(console.error);

        // @ts-ignore - Garante que o isolado não morra antes de disparar a promise de background
        if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
           // @ts-ignore
           EdgeRuntime.waitUntil(aiRequest);
        }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('[receive-message] Erro interno:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
