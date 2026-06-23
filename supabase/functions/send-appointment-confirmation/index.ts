import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatDatePtBR(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).formatToParts(date);
  const diaSemana = parts.find(p => p.type === 'weekday')?.value ?? '';
  const dia = parts.find(p => p.type === 'day')?.value ?? '';
  const mes = parts.find(p => p.type === 'month')?.value ?? '';
  return `${diaSemana}, ${dia} de ${mes}`;
}

function formatHora(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function substituirVariaveis(template: string, vars: Record<string, string>): string {
  let msg = template;
  for (const [key, value] of Object.entries(vars)) {
    msg = msg.replaceAll(`{${key}}`, value);
  }
  return msg;
}

function formatPhone(telefone: string): string {
  const digits = (telefone || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { agendamento_id } = await req.json();
    if (!agendamento_id) {
      return new Response(JSON.stringify({ success: false, error: 'agendamento_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca o agendamento
    const { data: ag, error: agErr } = await supabaseAdmin
      .from('agendamentos')
      .select('id, organization_id, lead_id, titulo, data_hora_inicio')
      .eq('id', agendamento_id)
      .single();

    if (agErr || !ag) {
      return new Response(JSON.stringify({ success: false, error: 'Agendamento não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca config de notificações da org
    const { data: config } = await supabaseAdmin
      .from('agendamento_config_notificacoes')
      .select('notif_confirmacao_ativa, mensagem_confirmacao')
      .eq('organization_id', ag.organization_id)
      .single();

    if (!config?.notif_confirmacao_ativa) {
      return new Response(JSON.stringify({ success: true, skipped: 'Confirmação imediata desativada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!ag.lead_id) {
      return new Response(JSON.stringify({ success: true, skipped: 'Agendamento sem lead' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca lead
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id, nome, telefone')
      .eq('id', ag.lead_id)
      .single();

    if (!lead?.telefone) {
      await supabaseAdmin.from('agendamento_notif_log').insert({
        agendamento_id: ag.id,
        organization_id: ag.organization_id,
        lead_id: ag.lead_id,
        tipo: 'confirmacao',
        canal: 'whatsapp',
        status: 'falhou',
        erro: 'Lead sem telefone',
      });
      return new Response(JSON.stringify({ success: false, error: 'Lead sem telefone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca conexão WhatsApp
    const { data: conn } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('uazapi_url, uazapi_token')
      .eq('organization_id', ag.organization_id)
      .eq('status', 'connected')
      .single();

    if (!conn) {
      await supabaseAdmin.from('agendamento_notif_log').insert({
        agendamento_id: ag.id,
        organization_id: ag.organization_id,
        lead_id: lead.id,
        tipo: 'confirmacao',
        canal: 'whatsapp',
        status: 'falhou',
        erro: 'Sem conexão WhatsApp ativa',
      });
      return new Response(JSON.stringify({ success: false, error: 'Sem conexão WhatsApp ativa' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataInicio = new Date(ag.data_hora_inicio);
    const vars = {
      nome: lead.nome || 'Cliente',
      data: formatDatePtBR(dataInicio),
      hora: formatHora(dataInicio),
      tempo: 'em breve',
      titulo: ag.titulo || 'Atendimento',
    };

    const mensagem = substituirVariaveis(config.mensagem_confirmacao || '', vars);
    const phoneFormatted = formatPhone(lead.telefone);
    const uazapiUrl = conn.uazapi_url.replace(/\/$/, '');

    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': conn.uazapi_token,
      },
      body: JSON.stringify({ number: phoneFormatted, text: mensagem }),
    });

    const enviado = response.ok;
    let erro: string | null = null;
    let waMessageId: string | null = null;

    if (!enviado) {
      const errorText = await response.text();
      erro = `UAZAPI ${response.status}: ${errorText.substring(0, 200)}`;
      console.error('[send-appointment-confirmation] Erro UAZAPI:', erro);
    } else {
      const uazData = await response.json().catch(() => ({}));
      waMessageId = uazData?.MessageID || uazData?.id || uazData?.messageId || null;
      await supabaseAdmin.from('mensagens').insert({
        lead_id: lead.id,
        organization_id: ag.organization_id,
        conteudo: mensagem,
        direcao: 'saida',
        remetente: 'bot',
        tipo_conteudo: 'texto',
        id_mensagem: waMessageId,
      }).then(({ error: msgErr }) => {
        if (msgErr) console.error('[send-appointment-confirmation] Erro ao salvar mensagem:', msgErr.message);
      });
    }

    await supabaseAdmin.from('agendamento_notif_log').insert({
      agendamento_id: ag.id,
      organization_id: ag.organization_id,
      lead_id: lead.id,
      tipo: 'confirmacao',
      canal: 'whatsapp',
      status: enviado ? 'enviado' : 'falhou',
      erro,
      enviado_em: enviado ? new Date().toISOString() : null,
    });

    console.log(`[send-appointment-confirmation] ${enviado ? 'Enviado' : 'Falhou'} para ${lead.nome} (${phoneFormatted})`);

    return new Response(JSON.stringify({ success: enviado, erro }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-appointment-confirmation] Erro fatal:', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
