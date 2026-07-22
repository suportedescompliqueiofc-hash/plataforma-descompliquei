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

// ── Modalidades de lembrete ─────────────────────────────────────
// Espelha src/lib/lembretes.ts (runtimes diferentes — manter em sincronia manual).
//   • 'relativo' → X minutos antes do agendamento.
//   • 'fixo'     → N dias antes, num horário fixo do dia (HH:MM, fuso de Brasília).
type LembreteDesc =
  | { modo: 'relativo'; antecedencia_minutos: number; template: string }
  | { modo: 'fixo'; dias_antes: number; horario: string; template: string };

function extrairLembretes(config: any): LembreteDesc[] {
  if (!config.notif_ativa) return [];

  const lembretes: any[] = Array.isArray(config.lembretes) ? config.lembretes : [];
  const template = config.mensagem_lembrete || '';
  const out: LembreteDesc[] = [];

  for (const l of lembretes) {
    if (!l || !l.ativo) continue;
    const modo = l.modo === 'fixo' ? 'fixo' : 'relativo';
    if (modo === 'fixo') {
      if (!l.horario) continue;
      out.push({ modo: 'fixo', dias_antes: Number(l.dias_antes ?? 1), horario: String(l.horario), template });
    } else {
      if (!(l.minutos_antes > 0)) continue;
      out.push({ modo: 'relativo', antecedencia_minutos: Number(l.minutos_antes), template });
    }
  }
  return out;
}

// Momento de envio de um lembrete de horário fixo: (data do agendamento − dias_antes) às HH:MM.
// Brasil não tem horário de verão desde 2019 → America/Sao_Paulo = UTC-3 fixo (UTC = local + 3h).
function calcMomentoFixo(dataInicio: Date, diasAntes: number, horario: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dataInicio);
  const y = Number(parts.find(p => p.type === 'year')?.value);
  const mo = Number(parts.find(p => p.type === 'month')?.value);
  const d = Number(parts.find(p => p.type === 'day')?.value);
  const [hh, mm] = horario.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d - diasAntes, (hh || 0) + 3, mm || 0, 0, 0));
}

// Resolve momento de envio, chave de dedup, antecedência efetiva e rótulo de tipo por lembrete.
function resolverLembrete(desc: LembreteDesc, dataInicio: Date): {
  momentoEnvio: Date;
  chave: string;
  antecedenciaMin: number;
  tipo: string;
  valido: boolean;
} {
  if (desc.modo === 'fixo') {
    const momentoEnvio = calcMomentoFixo(dataInicio, desc.dias_antes, desc.horario);
    const antecedenciaMin = Math.max(0, Math.round((dataInicio.getTime() - momentoEnvio.getTime()) / 60000));
    return {
      momentoEnvio,
      chave: `fixo:${desc.dias_antes}:${desc.horario}`,
      antecedenciaMin,
      tipo: `lembrete_fixo_${desc.dias_antes}d_${desc.horario}`,
      // horário fixo não pode cair depois (ou em cima) do próprio atendimento
      valido: momentoEnvio.getTime() < dataInicio.getTime(),
    };
  }
  const momentoEnvio = new Date(dataInicio.getTime() - desc.antecedencia_minutos * 60 * 1000);
  return {
    momentoEnvio,
    chave: `rel:${desc.antecedencia_minutos}`,
    antecedenciaMin: desc.antecedencia_minutos,
    tipo: `lembrete_${desc.antecedencia_minutos}min`,
    valido: true,
  };
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

    // Busca agendamentos futuros pendentes
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

    // Configs de notificação por org
    const { data: configs } = await supabaseAdmin
      .from('agendamento_config_notificacoes')
      .select('organization_id, notif_ativa, lembretes, mensagem_lembrete')
      .in('organization_id', orgIds);

    const configMap = new Map((configs || []).map((c) => [c.organization_id, c]));

    // Conexões WhatsApp ativas por org
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

      const lembretes = extrairLembretes(config);
      if (lembretes.length === 0) continue;

      const dataInicio = new Date(ag.data_hora_inicio);

      for (const desc of lembretes) {
        const { momentoEnvio, chave, antecedenciaMin, tipo, valido } = resolverLembrete(desc, dataInicio);

        // Lembrete de horário fixo inválido (cairia depois do atendimento) — ignora.
        if (!valido) continue;

        const diffMs = Math.abs(agora.getTime() - momentoEnvio.getTime());
        // Janela de 5 minutos (intervalo do cron) para não perder nem duplicar.
        // Se o momento de envio já passou (mais de 5 min), o lembrete NÃO é enviado.
        const dentroJanela = diffMs <= 5 * 60 * 1000;

        if (!dentroJanela) continue;

        resumo.processados++;

        // Dedup: já foi enviado/pendente/cancelado para este agendamento + lembrete (por chave)?
        const { data: jaEnviado } = await supabaseAdmin
          .from('agendamento_notificacoes')
          .select('id')
          .eq('agendamento_id', ag.id)
          .eq('chave_lembrete', chave)
          .in('status', ['enviado', 'pendente', 'cancelado'])
          .limit(1);

        if (jaEnviado && jaEnviado.length > 0) {
          console.log(`[process-appointment-notifications] Lembrete ${chave} já tratado para agendamento ${ag.id}, pulando.`);
          continue;
        }

        if (!ag.lead_id) {
          console.log(`[process-appointment-notifications] Agendamento ${ag.id} sem lead_id, pulando.`);
          continue;
        }

        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('id, nome, telefone')
          .eq('id', ag.lead_id)
          .single();

        if (!lead || !lead.telefone) {
          console.log(`[process-appointment-notifications] Lead ${ag.lead_id} sem telefone.`);
          await registrarLog(supabaseAdmin, {
            agendamento_id: ag.id, organization_id: ag.organization_id,
            lead_id: ag.lead_id, tipo,
            status: 'falhou', erro: 'Lead sem telefone',
          });
          await registrarDedup(supabaseAdmin, {
            agendamento_id: ag.id, organization_id: ag.organization_id,
            antecedencia_minutos: antecedenciaMin, chave_lembrete: chave,
            status: 'falhou', erro: 'Lead sem telefone',
            data_hora_envio: momentoEnvio.toISOString(),
          });
          resumo.erros++;
          continue;
        }

        const conn = connMap.get(ag.organization_id);
        if (!conn) {
          console.log(`[process-appointment-notifications] Sem conexão WhatsApp para org ${ag.organization_id}.`);
          await registrarLog(supabaseAdmin, {
            agendamento_id: ag.id, organization_id: ag.organization_id,
            lead_id: lead.id, tipo,
            status: 'falhou', erro: 'Sem conexão WhatsApp ativa',
          });
          await registrarDedup(supabaseAdmin, {
            agendamento_id: ag.id, organization_id: ag.organization_id,
            antecedencia_minutos: antecedenciaMin, chave_lembrete: chave,
            status: 'falhou', erro: 'Sem conexão WhatsApp ativa',
            data_hora_envio: momentoEnvio.toISOString(),
          });
          resumo.erros++;
          continue;
        }

        const vars = {
          nome: lead.nome || 'Cliente',
          data: formatDatePtBR(dataInicio),
          hora: formatHora(dataInicio),
          tempo: formatTempoRelativo(antecedenciaMin),
          titulo: ag.titulo || 'Atendimento',
        };

        const mensagem = substituirVariaveis(desc.template, vars);
        const phoneFormatted = formatPhone(lead.telefone);
        const uazapiUrl = conn.uazapi_url.replace(/\/$/, '');

        let envioStatus = 'enviado';
        let envioErro: string | null = null;
        let waMessageId: string | null = null;

        try {
          console.log(`[process-appointment-notifications] Enviando lembrete ${chave} para ${phoneFormatted} (ag ${ag.id})`);

          const response = await fetch(`${uazapiUrl}/send/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'token': conn.uazapi_token,
            },
            body: JSON.stringify({ number: phoneFormatted, text: mensagem }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`UAZAPI ${response.status}: ${errorText.substring(0, 200)}`);
          }

          const uazData = await response.json().catch(() => ({}));
          waMessageId = uazData?.MessageID || uazData?.id || uazData?.messageId || null;
          console.log(`[process-appointment-notifications] Enviado: ${JSON.stringify(uazData).substring(0, 100)}`);
          resumo.enviados++;
        } catch (sendErr: any) {
          console.error(`[process-appointment-notifications] Erro ao enviar: ${sendErr.message}`);
          envioStatus = 'falhou';
          envioErro = sendErr.message?.substring(0, 500) || 'Erro desconhecido';
          resumo.erros++;
        }

        if (envioStatus === 'enviado') {
          const { error: msgErr } = await supabaseAdmin.from('mensagens').insert({
            lead_id: lead.id,
            organization_id: ag.organization_id,
            conteudo: mensagem,
            direcao: 'saida',
            remetente: 'bot',
            tipo_conteudo: 'texto',
            id_mensagem: waMessageId,
            automatica: true, // mensagem do sistema — não conta como IA de pré-atendimento
          });
          if (msgErr) console.error('[process-appointment-notifications] Erro ao salvar mensagem:', msgErr.message);
        }

        const now = agora.toISOString();

        // Registra em agendamento_notif_log (exibido no histórico do frontend)
        await registrarLog(supabaseAdmin, {
          agendamento_id: ag.id,
          organization_id: ag.organization_id,
          lead_id: lead.id,
          tipo,
          status: envioStatus,
          erro: envioErro,
          enviado_em: envioStatus === 'enviado' ? now : null,
        });

        // Registra em agendamento_notificacoes (usado para dedup nas próximas execuções)
        await registrarDedup(supabaseAdmin, {
          agendamento_id: ag.id,
          organization_id: ag.organization_id,
          antecedencia_minutos: antecedenciaMin,
          chave_lembrete: chave,
          mensagem_template: mensagem,
          status: envioStatus,
          erro: envioErro,
          enviado_em: envioStatus === 'enviado' ? now : null,
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

// ── Helpers de persistência ────────────────────────────────────

async function registrarLog(
  db: ReturnType<typeof createClient>,
  data: {
    agendamento_id: string;
    organization_id: string;
    lead_id: string | null;
    tipo: string;
    status: string;
    erro?: string | null;
    enviado_em?: string | null;
  }
) {
  const { error } = await db.from('agendamento_notif_log').insert({
    agendamento_id: data.agendamento_id,
    organization_id: data.organization_id,
    lead_id: data.lead_id,
    tipo: data.tipo,
    canal: 'whatsapp',
    status: data.status,
    erro: data.erro ?? null,
    enviado_em: data.enviado_em ?? null,
  });
  if (error) console.error('[registrarLog] Erro:', error.message);
}

async function registrarDedup(
  db: ReturnType<typeof createClient>,
  data: {
    agendamento_id: string;
    organization_id: string;
    antecedencia_minutos: number;
    chave_lembrete: string;
    mensagem_template?: string;
    status: string;
    erro?: string | null;
    enviado_em?: string | null;
    data_hora_envio: string;
  }
) {
  const { error } = await db.from('agendamento_notificacoes').insert({
    agendamento_id: data.agendamento_id,
    organization_id: data.organization_id,
    tipo_destinatario: 'lead',
    canal: 'whatsapp',
    antecedencia_minutos: data.antecedencia_minutos,
    chave_lembrete: data.chave_lembrete,
    mensagem_template: data.mensagem_template ?? null,
    status: data.status,
    erro: data.erro ?? null,
    enviado_em: data.enviado_em ?? null,
    data_hora_envio: data.data_hora_envio,
  });
  if (error) console.error('[registrarDedup] Erro:', error.message);
}
