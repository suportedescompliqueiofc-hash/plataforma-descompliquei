import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatDatePtBR(date: Date): string {
  const diaSemana = DIAS_SEMANA[date.getDay()];
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = MESES[date.getMonth()];
  return `${diaSemana}, ${dia} de ${mes}`;
}

function formatHora(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatTempoRelativo(minutosAntes: number): string {
  if (minutosAntes >= 1440) {
    const dias = Math.round(minutosAntes / 1440);
    if (dias === 1) return 'amanhã';
    return `em ${dias} dias`;
  }
  if (minutosAntes >= 60) {
    const horas = Math.round(minutosAntes / 60);
    return `em ${horas} hora${horas > 1 ? 's' : ''}`;
  }
  return `em ${minutosAntes} minutos`;
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

interface NotifConfig {
  ativa: boolean;
  antecedencia_minutos: number;
  canal: string;
  destinatario: string;
  template: string;
}

function extrairLembretesConfig(config: any): NotifConfig[] {
  const lembretes: NotifConfig[] = [];
  for (const i of [1, 2, 3]) {
    if (config[`notif_${i}_ativa`]) {
      lembretes.push({
        ativa: true,
        antecedencia_minutos: config[`notif_${i}_antecedencia_minutos`],
        canal: config[`notif_${i}_canal`] || 'whatsapp',
        destinatario: config[`notif_${i}_destinatario`] || 'lead',
        template: config[`notif_${i}_template`] || '',
      });
    }
  }
  return lembretes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const resumo = { processados: 0, enviados: 0, erros: 0, detalhes: [] as any[] };

  try {
    console.log('[process-appointment-notifications] Iniciando verificação...');
    const agora = new Date();

    const { data: agendamentos, error: agErr } = await supabaseAdmin
      .from('agendamentos')
      .select('id, organization_id, lead_id, titulo, data_hora_inicio, status')
      .in('status', ['agendado', 'confirmado'])
      .gt('data_hora_inicio', agora.toISOString());

    if (agErr) throw agErr;

    if (!agendamentos || agendamentos.length === 0) {
      console.log('[process-appointment-notifications] Nenhum agendamento pendente.');
      return new Response(JSON.stringify({ success: true, ...resumo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-appointment-notifications] ${agendamentos.length} agendamento(s) futuros encontrados.`);

    const orgIds = [...new Set(agendamentos.map((a) => a.organization_id))];

    const { data: configs } = await supabaseAdmin
      .from('agendamento_config_notificacoes')
      .select('*')
      .in('organization_id', orgIds);

    const configMap = new Map((configs || []).map((c) => [c.organization_id, c]));

    const { data: connections } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('organization_id, uazapi_url, uazapi_token')
      .in('organization_id', orgIds)
      .eq('status', 'connected');

    const connMap = new Map((connections || []).map((c) => [c.organization_id, c]));

    for (const ag of agendamentos) {
      const config = configMap.get(ag.organization_id);
      if (!config) {
        console.log(`[process-appointment-notifications] Sem config para org ${ag.organization_id}, pulando.`);
        continue;
      }

      const lembretes = extrairLembretesConfig(config);
      if (lembretes.length === 0) continue;

      const dataInicio = new Date(ag.data_hora_inicio);

      for (const lembrete of lembretes) {
        const tipo = `lembrete_${lembrete.antecedencia_minutos}`;
        const momentoEnvio = new Date(dataInicio.getTime() - lembrete.antecedencia_minutos * 60 * 1000);
        const diffMs = Math.abs(agora.getTime() - momentoEnvio.getTime());
        const dentroJanela = diffMs <= 3 * 60 * 1000;

        if (!dentroJanela) continue;

        resumo.processados++;

        const { data: jaEnviado } = await supabaseAdmin
          .from('agendamento_notificacoes')
          .select('id')
          .eq('agendamento_id', ag.id)
          .eq('antecedencia_minutos', lembrete.antecedencia_minutos)
          .in('status', ['enviado', 'pendente'])
          .limit(1);

        if (jaEnviado && jaEnviado.length > 0) {
          console.log(`[process-appointment-notifications] ${tipo} já enviado para agendamento ${ag.id}, pulando.`);
          continue;
        }

        if (lembrete.canal !== 'whatsapp' && lembrete.canal !== 'ambos') {
          console.log(`[process-appointment-notifications] Canal ${lembrete.canal} não é WhatsApp, registrando apenas.`);
          await supabaseAdmin.from('agendamento_notificacoes').insert({
            agendamento_id: ag.id,
            organization_id: ag.organization_id,
            tipo_destinatario: lembrete.destinatario,
            canal: lembrete.canal,
            antecedencia_minutos: lembrete.antecedencia_minutos,
            mensagem_template: lembrete.template,
            status: 'enviado',
            enviado_em: agora.toISOString(),
            data_hora_envio: momentoEnvio.toISOString(),
          });
          resumo.enviados++;
          continue;
        }

        if (!ag.lead_id) {
          console.log(`[process-appointment-notifications] Agendamento ${ag.id} sem lead_id, pulando envio WhatsApp.`);
          continue;
        }

        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('id, nome, telefone')
          .eq('id', ag.lead_id)
          .single();

        if (!lead || !lead.telefone) {
          console.log(`[process-appointment-notifications] Lead ${ag.lead_id} sem telefone, pulando.`);
          await supabaseAdmin.from('agendamento_notificacoes').insert({
            agendamento_id: ag.id,
            organization_id: ag.organization_id,
            tipo_destinatario: lembrete.destinatario,
            canal: 'whatsapp',
            antecedencia_minutos: lembrete.antecedencia_minutos,
            status: 'falhou',
            erro: 'Lead sem telefone',
            data_hora_envio: momentoEnvio.toISOString(),
          });
          resumo.erros++;
          continue;
        }

        const conn = connMap.get(ag.organization_id);
        if (!conn) {
          console.log(`[process-appointment-notifications] Sem conexão WhatsApp para org ${ag.organization_id}.`);
          await supabaseAdmin.from('agendamento_notificacoes').insert({
            agendamento_id: ag.id,
            organization_id: ag.organization_id,
            tipo_destinatario: lembrete.destinatario,
            canal: 'whatsapp',
            antecedencia_minutos: lembrete.antecedencia_minutos,
            status: 'falhou',
            erro: 'Sem conexão WhatsApp ativa',
            data_hora_envio: momentoEnvio.toISOString(),
          });
          resumo.erros++;
          continue;
        }

        const vars = {
          nome: lead.nome || 'Cliente',
          nome_lead: lead.nome || 'Cliente',
          data: formatDatePtBR(dataInicio),
          hora: formatHora(dataInicio),
          horario: formatHora(dataInicio),
          tempo: formatTempoRelativo(lembrete.antecedencia_minutos),
          titulo: ag.titulo || 'Reunião',
        };

        const mensagem = substituirVariaveis(lembrete.template, vars);
        const phoneFormatted = formatPhone(lead.telefone);
        const uazapiUrl = conn.uazapi_url.replace(/\/$/, '');

        let envioStatus = 'enviado';
        let envioErro: string | null = null;

        try {
          console.log(`[process-appointment-notifications] Enviando ${tipo} para ${phoneFormatted} (agendamento ${ag.id})`);

          const response = await fetch(`${uazapiUrl}/send/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'token': conn.uazapi_token,
            },
            body: JSON.stringify({
              number: phoneFormatted,
              text: mensagem,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`UAZAPI ${response.status}: ${errorText.substring(0, 200)}`);
          }

          const uazData = await response.json();
          console.log(`[process-appointment-notifications] Enviado com sucesso: ${JSON.stringify(uazData).substring(0, 100)}`);
          resumo.enviados++;
        } catch (sendErr: any) {
          console.error(`[process-appointment-notifications] Erro ao enviar: ${sendErr.message}`);
          envioStatus = 'falhou';
          envioErro = sendErr.message?.substring(0, 500) || 'Erro desconhecido';
          resumo.erros++;
        }

        await supabaseAdmin.from('agendamento_notificacoes').insert({
          agendamento_id: ag.id,
          organization_id: ag.organization_id,
          tipo_destinatario: lembrete.destinatario,
          canal: 'whatsapp',
          antecedencia_minutos: lembrete.antecedencia_minutos,
          mensagem_template: mensagem,
          status: envioStatus,
          enviado_em: envioStatus === 'enviado' ? agora.toISOString() : null,
          erro: envioErro,
          data_hora_envio: momentoEnvio.toISOString(),
        });

        resumo.detalhes.push({
          agendamento_id: ag.id,
          lead: lead.nome,
          tipo,
          status: envioStatus,
          erro: envioErro,
        });
      }
    }

    console.log(`[process-appointment-notifications] Concluído: ${JSON.stringify(resumo)}`);

    return new Response(JSON.stringify({ success: true, ...resumo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[process-appointment-notifications] Erro fatal: ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message, ...resumo }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
