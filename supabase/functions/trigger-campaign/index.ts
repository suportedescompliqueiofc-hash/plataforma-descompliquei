import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { subMonths, subDays, isAfter, isBefore, differenceInDays } from 'https://esm.sh/date-fns@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://webhook.orbevision.shop/webhook/campanhas-crm-gleyce';

// Personaliza a mensagem com os dados do lead
const personalizeMessage = (template: string, lead: any, clinicName: string): string => {
  let message = template;
  
  let daysSinceLastContact: string | number = 'N/A';
  let lastContactDate: string = 'N/A';

  if (lead.ultimo_contato) {
    const lastContact = new Date(lead.ultimo_contato);
    if (!isNaN(lastContact.getTime())) { // Verifica se a data é válida
      daysSinceLastContact = differenceInDays(new Date(), lastContact);
      lastContactDate = lastContact.toLocaleDateString('pt-BR');
    }
  }

  const variables = {
    primeiro_nome: lead.nome ? lead.nome.split(' ')[0] : '',
    nome_lead: lead.nome,
    telefone: lead.telefone,
    email: lead.email,
    origem: lead.origem,
    data_ultimo_contato: lastContactDate,
    idade: lead.idade,
    genero: lead.genero,
    nome_escritorio: clinicName,
    dias_sem_contato: daysSinceLastContact.toString(),
  };

  // Suporte a nomes antigos para retrocompatibilidade temporária se necessário
  const legacyVariables = {
      nome_paciente: lead.nome,
      nome_clinica: clinicName
  };

  const allVars = { ...legacyVariables, ...variables };

  for (const key in allVars) {
    if (allVars[key] !== null && allVars[key] !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      message = message.replace(regex, String(allVars[key]));
    }
  }
  return message;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();
    if (!campaignId) {
      throw new Error('O ID da campanha é obrigatório.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Busca os detalhes da campanha
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campanhas')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(campaignError?.message || 'Campanha não encontrada.');
    }

    // Fetch clinic settings based on the campaign owner
    const { data: clinicSettings, error: settingsError } = await supabaseAdmin
      .from('configuracoes_clinica')
      .select('nome')
      .eq('usuario_id', campaign.usuario_id) 
      .limit(1)
      .single();
      
    if (settingsError) {
      console.warn('Could not fetch clinic name. Using default.');
    }
    const clinicName = clinicSettings?.nome || 'seu escritório';

    let targetedLeads = [];

    // 2. Determina os leads alvo
    if (campaign.targeted_lead_ids && Array.isArray(campaign.targeted_lead_ids) && campaign.targeted_lead_ids.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .in('id', campaign.targeted_lead_ids);
      if (error) throw error;
      targetedLeads = data;
    } else {
      const { data: allLeads, error: leadsError } = await supabaseAdmin.from('leads').select('*');
      if (leadsError) throw leadsError;
      const { data: allStages, error: stagesError } = await supabaseAdmin.from('etapas').select('*');
      if (stagesError) throw stagesError;

      const config = campaign.segmento_config;
      if (config.type === 'all') {
        targetedLeads = allLeads;
      } else if (config.type === 'predefined' && config.predefined?.length > 0) {
          const now = new Date();
          const sixMonthsAgo = subMonths(now, 6);
          const threeMonthsAgo = subMonths(now, 3);
          // Mapeia para a posição (posicao_ordem) em vez do ID
          const finalStagePositions = allStages.filter(s => ['Convertido', 'Perdido', 'Contrato Fechado'].includes(s.nome)).map(s => s.posicao_ordem);

          targetedLeads = allLeads.filter(lead => {
              return config.predefined.some(segment => {
                  if (segment === 'active') return lead.ultimo_contato && isAfter(new Date(lead.ultimo_contato), sixMonthsAgo);
                  if (segment === 'inactive') return !lead.ultimo_contato || isBefore(new Date(lead.ultimo_contato), sixMonthsAgo);
                  if (segment === 'new') return isAfter(new Date(lead.criado_em), threeMonthsAgo);
                  if (segment === 'in_treatment') return true;
                  return false;
              });
          });
      } else if (config.type === 'advanced') {
          const { lastContact, gender, ageRange } = config.advanced;
          targetedLeads = allLeads.filter(lead => {
              if (lastContact && lead.ultimo_contato) {
                  const days = parseInt(lastContact);
                  if (!isNaN(days) && isBefore(new Date(lead.ultimo_contato), subDays(new Date(), days))) return false;
              }
              if (gender !== 'Todos' && lead.genero !== gender) return false;
              if (ageRange !== 'Todos') {
                  const [min, max] = ageRange.split('-').map(Number);
                  if (!lead.idade || lead.idade < min || lead.idade > max) return false;
              }
              return true;
          });
      }
    }

    // 3. Itera sobre os leads e envia os webhooks
    let sentCount = 0;
    for (const lead of targetedLeads) {
      const message = personalizeMessage(campaign.template_mensagem, lead, clinicName);
      
      let mediaPublicUrl: string | null = null;
      if (campaign.media_url) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('campaign-media')
          .getPublicUrl(campaign.media_url);
        mediaPublicUrl = publicUrl;
      }

      const mediaType = campaign.media_url 
        ? (campaign.media_url.endsWith('mp4') || campaign.media_url.endsWith('mov') ? 'video' : 'imagem') 
        : null;

      const payload = {
        whatsapp: lead.telefone,
        message: message,
        mediaUrl: mediaPublicUrl,
        lead_id: lead.id,
        user_id: campaign.usuario_id,
        media_path: campaign.media_url,
        media_type: mediaType,
      };

      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        sentCount++;
      } catch (e) {
        console.error(`Falha ao enviar webhook para o lead ${lead.id}:`, e.message);
      }
      
      await supabaseAdmin
        .from('campanhas')
        .update({ contagem_enviados: sentCount })
        .eq('id', campaignId);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 4. Marca a campanha como concluída
    await supabaseAdmin
      .from('campanhas')
      .update({ status: 'completed', contagem_enviados: sentCount })
      .eq('id', campaignId);

    return new Response(JSON.stringify({ success: true, message: `Campanha processada. ${sentCount} mensagens enviadas.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro na função trigger-campaign:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});