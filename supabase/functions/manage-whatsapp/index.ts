import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const { data: { user }, error: userError } = await createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser()

    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseAdmin
      .from('perfis')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) throw new Error('No organization found')

    const orgId = profile.organization_id
    const body = await req.json()
    const { action, uazapi_url, uazapi_token, instance_name, n8n_webhook_url } = body

    // Busca conexão da organização
    let { data: conn } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle()

    // === auto_setup — cria instância automaticamente via admin token ===
    if (action === 'auto_setup') {
      const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN')
      const baseUrl = Deno.env.get('UAZAPI_BASE_URL') ?? 'https://odontonova.uazapi.com'
      if (!adminToken) throw new Error('UAZAPI_ADMIN_TOKEN não configurado no servidor.')

      // Se já tem conexão com token, apenas reconecta
      if (conn?.uazapi_token && conn?.instance_name) {
        const uazHeaders = { 'token': conn.uazapi_token, 'Content-Type': 'application/json' }
        const connectRes = await fetch(`${baseUrl}/instance/connect`, { method: 'POST', headers: uazHeaders, body: JSON.stringify({}) })
        const connectData = await connectRes.json()
        const qr = connectData?.instance?.qrcode || connectData?.qrcode || null
        if (connectData?.connected) {
          await supabaseAdmin.from('whatsapp_connections').update({ status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() }).eq('id', conn.id)
          return new Response(JSON.stringify({ status: 'connected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        if (qr) {
          await supabaseAdmin.from('whatsapp_connections').update({ status: 'qr_pending', qr_code: qr }).eq('id', conn.id)
        }
        return new Response(JSON.stringify({ status: 'qr_pending', qr }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Cria nova instância usando o admin token
      const instanceName = `crm-${orgId.replace(/-/g, '').slice(0, 12)}`
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers: { 'admintoken': adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: instanceName, adminField01: orgId }),
      })
      if (!createRes.ok) {
        const errText = await createRes.text()
        throw new Error(`Falha ao criar instância UAZAPI: ${createRes.status} — ${errText}`)
      }
      const createData = await createRes.json()
      // O token da instância pode vir em campos diferentes dependendo da versão
      const instanceToken = createData?.token || createData?.instance?.token || createData?.data?.token
      if (!instanceToken) throw new Error(`Token da instância não retornado pela UAZAPI: ${JSON.stringify(createData)}`)

      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/receive-message`

      // Salva a conexão no banco
      const connPayload = {
        organization_id: orgId,
        uazapi_url: baseUrl,
        uazapi_token: instanceToken,
        instance_name: instanceName,
        n8n_webhook_url: webhookUrl,
        status: 'disconnected' as const,
        usuario_id_default: user.id,
      }
      if (conn) {
        const { data: updated } = await supabaseAdmin.from('whatsapp_connections').update({ ...connPayload, updated_at: new Date().toISOString() }).eq('id', conn.id).select().single()
        conn = updated
      } else {
        const { data: created } = await supabaseAdmin.from('whatsapp_connections').insert(connPayload).select().single()
        conn = created
      }

      // Configura webhook automaticamente
      try {
        await fetch(`${baseUrl}/webhook`, {
          method: 'POST',
          headers: { 'token': instanceToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true, url: webhookUrl, events: ['messages', 'connection'], excludeMessages: ['wasSentByApi'] }),
        })
      } catch (_) {}

      // Inicia conexão para gerar QR
      const connectRes = await fetch(`${baseUrl}/instance/connect`, {
        method: 'POST',
        headers: { 'token': instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const connectData = await connectRes.json()
      const qr = connectData?.instance?.qrcode || connectData?.qrcode || null
      if (qr && conn) {
        await supabaseAdmin.from('whatsapp_connections').update({ status: 'qr_pending', qr_code: qr }).eq('id', conn.id)
      }
      return new Response(JSON.stringify({ status: 'qr_pending', qr }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === send_message — envia via UaZAPI diretamente (sem n8n) ===
    if (action === 'send_message') {
      const { lead_id, conteudo_mensagem, tipo, url_midia, titulo_pdf, telefone, internal_msg_id } = body

      if (!conn?.uazapi_url || !conn?.uazapi_token) {
        throw new Error('WhatsApp não configurado. Acesse Configurações > WhatsApp.')
      }

      // Pausa a IA para que o agente assuma o atendimento
      if (lead_id) {
        await supabaseAdmin.from('leads').update({ ia_ativa: false }).eq('id', lead_id)
      }

      const uazBase = conn.uazapi_url.endsWith('/') ? conn.uazapi_url.slice(0, -1) : conn.uazapi_url
      const uazToken = conn.uazapi_token
      const uazHeaders2: Record<string, string> = { 'token': uazToken, 'Content-Type': 'application/json', 'Accept': 'application/json' }

      // Formata o número: garante prefixo 55
      const numDigits = (telefone || '').replace(/\D/g, '')
      const number = numDigits.startsWith('55') && numDigits.length >= 12 ? numDigits : `55${numDigits}`

      const tipoMsg = (tipo || 'texto').toLowerCase()
      let endpoint = '/send/text'
      let uazPayload: Record<string, unknown> = { number, text: conteudo_mensagem || '', delay: 1200 }

      // UaZAPI docs: todos os tipos de mídia usam POST /send/media
      // Campos: number, type, file, text (caption), docName (para documentos)
      if (tipoMsg === 'audio' && url_midia) {
        endpoint = '/send/media'
        uazPayload = { number, type: 'ptt', file: url_midia }
      } else if (tipoMsg === 'imagem' && url_midia) {
        endpoint = '/send/media'
        uazPayload = { number, type: 'image', file: url_midia, text: conteudo_mensagem || '' }
      } else if (tipoMsg === 'video' && url_midia) {
        endpoint = '/send/media'
        uazPayload = { number, type: 'video', file: url_midia, text: conteudo_mensagem || '' }
      } else if (tipoMsg === 'pdf' && url_midia) {
        endpoint = '/send/media'
        uazPayload = { number, type: 'document', file: url_midia, docName: titulo_pdf || 'documento.pdf', text: conteudo_mensagem || '' }
      }

      const uazRes = await fetch(`${uazBase}${endpoint}`, {
        method: 'POST',
        headers: uazHeaders2,
        body: JSON.stringify(uazPayload)
      })

      const uazText = await uazRes.text()
      if (!uazRes.ok) {
        throw new Error(`UaZAPI ${uazRes.status}: ${uazText.substring(0, 200)}`)
      }

      let uazJson: any = {}
      try { uazJson = JSON.parse(uazText) } catch { /* noop */ }
      const waMessageId = uazJson?.id ?? uazJson?.messageid ?? uazJson?.message?.id ?? null

      // Atualiza o id_mensagem no banco para rastreamento de status
      if (waMessageId && internal_msg_id) {
        await supabaseAdmin.from('mensagens').update({ id_mensagem: waMessageId }).eq('id', internal_msg_id)
      }

      return new Response(JSON.stringify({ success: true, wa_id: waMessageId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === create_instance / update ===
    if (action === 'create_instance' && uazapi_url && uazapi_token && instance_name) {
       if (!conn) {
        const { data: newConn } = await supabaseAdmin
          .from('whatsapp_connections')
          .insert({
            organization_id: orgId,
            uazapi_url,
            uazapi_token,
            instance_name,
            n8n_webhook_url,
            status: 'disconnected',
            usuario_id_default: user.id
          })
          .select().single()
        conn = newConn
      } else {
        const { data: updatedConn } = await supabaseAdmin
          .from('whatsapp_connections')
          .update({
            uazapi_url,
            uazapi_token,
            instance_name,
            n8n_webhook_url,
            usuario_id_default: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', conn.id)
          .select().single()
        conn = updatedConn
      }

      // Configura o webhook automaticamente no UAZAPI sempre que a conexão for criada/atualizada
      try {
        const autoBase = (conn?.uazapi_url || uazapi_url).endsWith('/')
          ? (conn?.uazapi_url || uazapi_url).slice(0, -1)
          : (conn?.uazapi_url || uazapi_url)
        const autoToken = conn?.uazapi_token || uazapi_token
        const autoWebhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/receive-message`
        await fetch(`${autoBase}/webhook`, {
          method: 'POST',
          headers: { 'token': autoToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: true,
            url: autoWebhookUrl,
            events: ['messages', 'connection'],
            excludeMessages: ['wasSentByApi']
          })
        })
      } catch (_) { /* não bloqueia o fluxo se o UAZAPI estiver temporariamente indisponível */ }
    }

    if (!conn?.uazapi_url || !conn?.uazapi_token || !conn?.instance_name) {
      throw new Error('Connection data missing. Please save URL, token and instance name first.')
    }

    const baseUrl = conn.uazapi_url.endsWith('/') ? conn.uazapi_url.slice(0, -1) : conn.uazapi_url
    const uazHeaders: Record<string, string> = { 'token': conn.uazapi_token, 'Content-Type': 'application/json' }

    // === configure_webhook ===
    // O webhook do UaZAPI aponta diretamente para receive-message (não para o n8n)
    // Também salva o n8n_webhook_url do form no banco (para exibição/controle)
    const receiveMessageUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/receive-message`
    if (action === 'configure_webhook') {
      // Salva o n8n_webhook_url do form no banco SE foi enviado
      if (n8n_webhook_url && conn?.id) {
        await supabaseAdmin
          .from('whatsapp_connections')
          .update({ n8n_webhook_url, updated_at: new Date().toISOString() })
          .eq('id', conn.id)
      }

      const res = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: uazHeaders,
        body: JSON.stringify({
          enabled: true,
          url: receiveMessageUrl,
          events: ['messages', 'connection'],
          excludeMessages: ['wasSentByApi']
        })
      })
      const data = await res.json()
      return new Response(JSON.stringify({ success: true, webhook: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === delete_message ===
    if (action === 'delete_message') {
      const { id_mensagem } = body
      if (!id_mensagem) throw new Error('id_mensagem é obrigatório')
      const res = await fetch(`${baseUrl}/message/delete`, {
        method: 'POST',
        headers: uazHeaders,
        body: JSON.stringify({ id: id_mensagem })
      })
      const data = await res.json()
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === sync_labels ===
    if (action === 'sync_labels') {
      const res = await fetch(`${baseUrl}/labels`, { headers: uazHeaders })
      const labels = await res.json()
      if (!Array.isArray(labels)) throw new Error('Resposta inesperada da UAZAPI: ' + JSON.stringify(labels))
      let synced = 0
      for (const label of labels) {
        const { error } = await supabaseAdmin
          .from('tags')
          .upsert({
            organization_id: orgId,
            name: label.name,
            color: label.colorHex || '#64748b',
            label_lid: label.labelid,
          }, { onConflict: 'organization_id,label_lid' })
        if (!error) synced++
      }
      return new Response(JSON.stringify({ success: true, synced, total: labels.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === sync_leads_tags ===
    if (action === 'sync_leads_tags') {
      // 1. Busca os chats na API do WhatsApp
      const res = await fetch(`${baseUrl}/chat/find`, {
        method: 'POST',
        headers: uazHeaders,
        body: JSON.stringify({})
      })
      const data = await res.json()
      const chats = data?.chats || []
      
      // 2. Filtra os chats que possuem etiquetas
      const chatsWithLabels = chats.filter((c: any) => c.wa_label && c.wa_label.length > 0)
      
      let syncedLeadsCount = 0
      
      // Para cada chat com tag(s)
      for (const chat of chatsWithLabels) {
        // chat.phone é ex: "+55 21 97658-1566", ou wa_chatid é "5521976581566@s.whatsapp.net"
        let phoneStr = chat.wa_chatid ? chat.wa_chatid.split('@')[0] : (chat.phone || '')
        phoneStr = phoneStr.replace(/\D/g, '') // "5521976581566"
        
        if (!phoneStr) continue

        // Encontra o(s) lead(s) no banco (pode haver duplicados com o mesmo número)
        const { data: leads } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('organization_id', orgId)
          .or(`telefone.eq.${phoneStr},telefone.eq.${phoneStr.substring(2)}`)
          
        if (leads && leads.length > 0) {
          // Extrai apenas o ID numérico da tag (vem no formato "Owner:TagID")
          const cleanLabels = chat.wa_label.map((lbl: any) => String(lbl).includes(':') ? String(lbl).split(':')[1] : String(lbl))
          
          // Busca os IDs internos (do Supabase)
          const { data: matchedTags } = await supabaseAdmin
            .from('tags')
            .select('id')
            .eq('organization_id', orgId)
            .in('label_lid', cleanLabels)
            
          if (matchedTags && matchedTags.length > 0) {
            for (const lead of leads) {
              for (const t of matchedTags) {
                await supabaseAdmin.from('leads_tags').upsert(
                  { lead_id: lead.id, tag_id: t.id },
                  { onConflict: 'lead_id,tag_id', ignoreDuplicates: true }
                )
              }
            }
            syncedLeadsCount++
          }
        }
      }

      return new Response(JSON.stringify({ success: true, syncedLeadsCount, totalChatsWithLabels: chatsWithLabels.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === add_label ===
    if (action === 'add_label') {
      const { telefone, label_lid } = body
      const res = await fetch(`${baseUrl}/label/add`, {
        method: 'POST',
        headers: uazHeaders,
        body: JSON.stringify({ phone: telefone, labelId: label_lid })
      })
      const data = await res.json()
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === remove_label ===
    if (action === 'remove_label') {
      const { telefone, label_lid } = body
      const res = await fetch(`${baseUrl}/label/remove`, {
        method: 'POST',
        headers: uazHeaders,
        body: JSON.stringify({ phone: telefone, labelId: label_lid })
      })
      const data = await res.json()
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // === check_status ===
    // Consulta a UAZAPI e atualiza o banco com o status real
    if (action === 'check_status') {
      try {
        const res = await fetch(`${baseUrl}/instance/status`, { headers: uazHeaders })
        const data = await res.json()

        // Detectar conexão ativa
        const connected = data?.connected === true || data?.instance?.status === 'connected' || data?.status === 'connected'
        const qrcode = data?.instance?.qrcode || data?.qrcode

        if (connected) {
          await supabaseAdmin.from('whatsapp_connections').update({
            status: 'connected',
            qr_code: null,
            last_connected_at: new Date().toISOString()
          }).eq('id', conn.id)
          // Garante que o webhook aponte para receive-message a cada check_status
          try {
            await fetch(`${baseUrl}/webhook`, {
              method: 'POST', headers: uazHeaders,
              body: JSON.stringify({ enabled: true, url: receiveMessageUrl, events: ['messages', 'connection'], excludeMessages: ['wasSentByApi'] })
            })
          } catch(_e) {}
          return new Response(JSON.stringify({ status: 'connected', phone: data?.phone || data?.instance?.phone || '' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (qrcode) {
          await supabaseAdmin.from('whatsapp_connections').update({
            qr_code: qrcode,
            status: 'qr_pending'
          }).eq('id', conn.id)
          return new Response(JSON.stringify({ status: 'qr_pending', qr: qrcode }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Sem QR e sem conexão = desconectado
        await supabaseAdmin.from('whatsapp_connections').update({
          status: 'disconnected',
          qr_code: null
        }).eq('id', conn.id)
        return new Response(JSON.stringify({ status: 'disconnected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (fetchErr: any) {
        // Se a UAZAPI não responder, mantém status atual do banco
        console.error('UAZAPI unreachable:', fetchErr.message)
        return new Response(JSON.stringify({ status: conn.status || 'disconnected', error: 'UAZAPI unreachable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // === create_instance / get_qr (connect) ===
    if (action === 'create_instance' || action === 'get_qr') {
      const res = await fetch(`${baseUrl}/instance/connect`, { method: 'POST', headers: uazHeaders })
      const data = await res.json()
      if (data?.connected) {
        await supabaseAdmin.from('whatsapp_connections').update({ status: 'connected', qr_code: null, last_connected_at: new Date().toISOString() }).eq('id', conn.id)
        return new Response(JSON.stringify({ status: 'connected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (data?.instance?.qrcode) {
        await supabaseAdmin.from('whatsapp_connections').update({ qr_code: data.instance.qrcode, status: 'qr_pending' }).eq('id', conn.id)
        return new Response(JSON.stringify({ qr: data.instance.qrcode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ status: 'qr_pending' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === disconnect ===
    if (action === 'disconnect') {
      await fetch(`${baseUrl}/instance/disconnect`, { method: 'POST', headers: uazHeaders }).catch(() => {})
      await supabaseAdmin.from('whatsapp_connections').update({ status: 'disconnected', qr_code: null }).eq('id', conn.id)
      return new Response(JSON.stringify({ status: 'disconnected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})