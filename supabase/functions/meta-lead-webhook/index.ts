import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ORG_ID = '91a0e113-f428-4bd5-867f-431c91bc91c1'

Deno.serve(async (req) => {
  // Sempre retornar 200 para o Meta/N8N
  try {
    // GET — verificação do webhook pelo Meta
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      if (mode === 'subscribe' && token === 'descompliquei_leads_2026') {
        return new Response(challenge, { status: 200 })
      }
      return new Response('OK', { status: 200 })
    }

    const body = await req.json()
    console.log('[META-LEAD] Payload recebido:', JSON.stringify(body))

    // POST vindo do N8N (já processado)
    if (body.source === 'n8n') {
      const {
        leadgen_id, nome, telefone, email,
        ad_id, ad_name, form_id,
        campaign_id, campaign_name,
        nota_texto, field_data
      } = body

      // 1. Verificar duplicata
      const { data: existing } = await supabase
        .from('meta_lead_form_log')
        .select('id')
        .eq('meta_lead_id', leadgen_id)
        .maybeSingle()

      if (existing) {
        console.log('[META-LEAD] Duplicata ignorada:', leadgen_id)
        return new Response(
          JSON.stringify({ status: 'duplicado' }),
          { status: 200 }
        )
      }

      // 2. Limpar telefone
      const telefoneLimpo = telefone?.replace(/\D/g, '') || ''

      // 3. Buscar lead existente pelo telefone
      let leadId = null
      let temCriativoJa = false

      if (telefoneLimpo) {
        const { data: leadExistente } = await supabase
          .from('leads')
          .select('id, criativo_id')
          .eq('telefone', telefoneLimpo)
          .eq('organization_id', ORG_ID)
          .maybeSingle()

        if (leadExistente) {
          leadId = leadExistente.id
          temCriativoJa = !!leadExistente.criativo_id
        }
      }

      // 4. Buscar criativo_id pelo ad_id
      let criatvioUuid = null
      if (ad_id) {
        console.log('[DEBUG-CRIATIVO] ad_id recebido:', ad_id)
        console.log('[DEBUG-CRIATIVO] ORG_ID:', ORG_ID)
        const { data: adData, error: adError } = await supabase
          .from('meta_ads')
          .select('id')
          .eq('meta_ad_id', ad_id)
          .eq('organization_id', ORG_ID)
          .maybeSingle()
        console.log('[DEBUG-CRIATIVO] resultado da query:', JSON.stringify(adData))
        console.log('[DEBUG-CRIATIVO] erro da query:', JSON.stringify(adError))
        if (adData) criatvioUuid = adData.id
      }
      console.log('[DEBUG-CRIATIVO] criatvioUuid final:', criatvioUuid)

      // 5. Buscar usuario_id padrão da organização
      const { data: perfilAdmin } = await supabase
        .from('perfis')
        .select('id')
        .eq('organization_id', ORG_ID)
        .limit(1)
        .single()

      const usuarioId = perfilAdmin?.id || null

      // 6. Criar ou atualizar lead
      let acao = 'atualizado'
      if (!leadId) {
        acao = 'criado'
        console.log('[DEBUG-CRIATIVO] INSERT lead com criativo_id:', criatvioUuid)
        const { data: novoLead, error } = await supabase
          .from('leads')
          .insert({
            organization_id: ORG_ID,
            usuario_id: usuarioId,
            nome: nome || 'Lead sem nome',
            telefone: telefoneLimpo,
            email: email || null,
            origem: 'marketing',
            fonte: 'meta_lead_ads',
            meta_ad_source_id: ad_id,
            meta_ad_platform: 'facebook',
            criativo_id: criatvioUuid
          })
          .select('id')
          .single()

        if (error) throw error
        leadId = novoLead.id
        console.log('[DEBUG-CRIATIVO] Lead criado:', leadId, 'criativo_id:', criatvioUuid)
      } else {
        console.log('[DEBUG-CRIATIVO] UPDATE lead:', leadId, 'criativo_id:', criatvioUuid)
        await supabase
          .from('leads')
          .update({
            fonte: 'meta_lead_ads',
            origem: 'marketing',
            criativo_id: criatvioUuid
          })
          .eq('id', leadId)
        console.log('[DEBUG-CRIATIVO] Lead atualizado:', leadId, 'criativo_id:', criatvioUuid)
      }

      // 6. Criar nota com dados do formulário
      if (leadId && nota_texto) {
        await supabase.from('lead_notas').insert({
          lead_id: leadId,
          organization_id: ORG_ID,
          tipo: 'formulario_meta',
          conteudo: nota_texto,
          metadados: {
            form_id,
            ad_id,
            ad_name,
            campaign_id,
            campaign_name,
            meta_lead_id: leadgen_id,
            campos_originais: typeof field_data === 'string'
              ? JSON.parse(field_data)
              : field_data
          }
        })
        console.log('[META-LEAD] Nota criada para lead:', leadId)
      }

      // 7. Criar notificação com estrutura correta
      await supabase.from('notificacoes').insert({
        organization_id: ORG_ID,
        user_id: usuarioId,
        lead_id: leadId,
        mensagem: `📋 Novo lead via formulário Meta\nNome: ${nome || 'Não informado'} | Tel: ${telefoneLimpo || 'Não informado'} | Anúncio: ${ad_name || ad_id || 'Desconhecido'}`,
        status: 'pendente'
      })

      // 8. Registrar log
      await supabase.from('meta_lead_form_log').insert({
        organization_id: ORG_ID,
        lead_id: leadId,
        form_id,
        meta_lead_id: leadgen_id,
        ad_id,
        ad_name,
        campaign_id,
        dados_brutos: typeof field_data === 'string'
          ? JSON.parse(field_data)
          : field_data,
        status: 'processado'
      })

      return new Response(
        JSON.stringify({ success: true, lead_id: leadId, acao }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Qualquer outro POST — retornar 200 sem processar
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

  } catch (error) {
    console.error('[META-LEAD] Erro:', error)
    // SEMPRE retornar 200 para não travar o N8N
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200 }
    )
  }
})
