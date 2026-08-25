import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { addMinutes, addHours, addDays } from 'https://esm.sh/date-fns@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[process-cadences] Verificando envios agendados...");

    const nowIso = new Date().toISOString();
    const { data: leadsInCadence, error: fetchError } = await supabaseAdmin
      .from('lead_cadencias')
      .select(`
        id,
        lead_id,
        cadencia_id,
        passo_atual_ordem,
        organization_id,
        status_ultima_execucao
      `)
      .eq('status', 'ativo')
      .lte('proxima_execucao', nowIso);

    if (fetchError) throw fetchError;
    
    if (!leadsInCadence || leadsInCadence.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0 }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const results = [];

    for (const item of leadsInCadence) {
      try {
        // 1. Buscar dados do Lead
        const { data: lead, error: leadError } = await supabaseAdmin
          .from('leads')
          .select('id, nome, telefone, usuario_id')
          .eq('id', item.lead_id)
          .single();
        
        if (leadError || !lead) throw new Error("Lead não encontrado.");

        // 2. Buscar conexão WhatsApp ativa para a organização
        const { data: conn } = await supabaseAdmin
          .from('whatsapp_connections')
          .select('uazapi_url, uazapi_token')
          .eq('organization_id', item.organization_id)
          .eq('status', 'connected')
          .maybeSingle();

        if (!conn?.uazapi_url || !conn?.uazapi_token) {
          throw new Error("WhatsApp não conectado para esta organização.");
        }

        const { data: cadence, error: cadenceError } = await supabaseAdmin
          .from('cadencias')
          .select('id, nome')
          .eq('id', item.cadencia_id)
          .single();

        if (cadenceError || !cadence) throw new Error("Cadência não encontrada.");

        const { data: steps, error: stepsError } = await supabaseAdmin
          .from('cadencia_passos')
          .select('*')
          .eq('cadencia_id', cadence.id)
          .order('posicao_ordem', { ascending: true });

        if (stepsError || !steps || steps.length === 0) throw new Error("Cadência sem passos.");

        const nextStepOrder = (item.passo_atual_ordem || 0) + 1;
        const currentStep = steps.find(s => s.posicao_ordem === nextStepOrder);

        if (!currentStep) {
          await supabaseAdmin.from('lead_cadencias').update({ status: 'concluido', proxima_execucao: null }).eq('id', item.id);
          continue;
        }

        let url_midia = null;
        if (currentStep.arquivo_path) {
          const { data } = supabaseAdmin.storage.from('media-mensagens').getPublicUrl(currentStep.arquivo_path);
          url_midia = data.publicUrl;
        }

        const messageBody = (currentStep.conteudo || '').replace(/\{\{nome_lead\}\}/g, lead.nome || 'Cliente');

        // 3. A mensagem só é gravada DEPOIS do envio dar certo (ver passo 6b).
        // Gravar antes fazia cada tentativa fracassada virar uma linha em
        // `mensagens`: em 21-23/08/2026 isso gerou 176.676 mensagens fantasma,
        // 56% da tabela, e derrubou a performance de toda a plataforma.

        // 4. Formatar telefone para UAZAPI
        const telefoneDigits = (lead.telefone || '').replace(/\D/g, '');
        const phoneFormatted = telefoneDigits.startsWith('55') && telefoneDigits.length >= 12
          ? telefoneDigits
          : `55${telefoneDigits}`;

        // 5. Preparar Payload UAZAPI
        const uazapiUrl = conn.uazapi_url.replace(/\/$/, '');
        let endpoint = '/send/text';
        let uazPayload: any = { number: phoneFormatted };

        const tipo = currentStep.tipo_mensagem;
        if (tipo === 'imagem' || tipo === 'audio' || tipo === 'video') {
          endpoint = '/send/media';
          uazPayload.mediaUrl = url_midia;
          uazPayload.caption = tipo === 'audio' ? '' : messageBody;
        } else if (tipo === 'pdf') {
          endpoint = '/send/document';
          uazPayload.url = url_midia;
          uazPayload.filename = cadence.nome || 'documento.pdf';
          uazPayload.caption = messageBody;
        } else {
          uazPayload.text = messageBody;
          uazPayload.delay = 1200;
        }

        // 6. Disparar via UAZAPI
        const response = await fetch(`${uazapiUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'token': conn.uazapi_token,
          },
          body: JSON.stringify(uazPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`UAZAPI retornou ${response.status}: ${errorText.substring(0, 100)}`);
        }

        const uazData = await response.json();
        const waMessageId = uazData?.id ?? uazData?.messageid ?? null;

        // 6b. Envio confirmado — agora sim a mensagem entra no chat.
        await supabaseAdmin
          .from('mensagens')
          .insert({
            lead_id: lead.id,
            organization_id: item.organization_id,
            user_id: lead.usuario_id,
            conteudo: messageBody,
            direcao: 'saida',
            remetente: 'bot',
            tipo_conteudo: currentStep.tipo_mensagem || 'texto',
            media_path: url_midia,
            id_mensagem: waMessageId,
          });

        // 7. Calcular próxima execução
        const followingStep = steps.find(s => s.posicao_ordem === (nextStepOrder + 1));
        const now = new Date();
        let nextDate = null;
        let finalStatus = 'ativo';

        if (followingStep) {
          nextDate = new Date();
          const tempo = followingStep.tempo_espera || 1;
          if (followingStep.unidade_tempo === 'minutos') nextDate = addMinutes(now, tempo);
          else if (followingStep.unidade_tempo === 'horas') nextDate = addHours(now, tempo);
          else nextDate = addDays(now, tempo);
          nextDate = nextDate.toISOString();
        } else {
          finalStatus = 'concluido';
        }

        // 8. Atualiza estado e REGISTRA LOG HISTÓRICO
        await supabaseAdmin
          .from('lead_cadencias')
          .update({ 
            passo_atual_ordem: nextStepOrder, 
            proxima_execucao: nextDate,
            status: finalStatus,
            ultima_execucao: now.toISOString(),
            status_ultima_execucao: 'sucesso',
            erro_log: null
          })
          .eq('id', item.id);

        await supabaseAdmin
          .from('cadencia_logs')
          .insert({
            organization_id: item.organization_id,
            lead_id: lead.id,
            cadencia_id: item.cadencia_id,
            passo_ordem: nextStepOrder,
            status: 'sucesso'
          });

        results.push({ lead_id: lead.id, step: nextStepOrder, status: 'sent' });

      } catch (err: any) {
        console.error(`[process-cadences] Falha no lead ${item.lead_id}:`, err.message);
        const now = new Date();

        // Sem isto o passo nunca desiste: o catch não mexia em `proxima_execucao`,
        // que continuava no passado, então o mesmo lead era reselecionado a cada
        // execução do cron (*/1). Erros permanentes — "not on WhatsApp",
        // "missing file field", "Lead não encontrado" — viravam laço infinito:
        // 1.440 tentativas por lead por dia, 210 mil falhas em 3 dias.
        // Uma nova tentativa em 30 min cobre falha transitória (rede, WhatsApp
        // reconectando); a segunda falha seguida encerra a cadência do lead.
        // ponytail: 2 tentativas fixas usando as colunas que já existem. Se um dia
        // precisar de backoff por classe de erro, aí sim vale uma coluna de contador.
        const jaHaviaFalhado = item.status_ultima_execucao === 'erro';

        await supabaseAdmin
          .from('lead_cadencias')
          .update({
            ultima_execucao: now.toISOString(),
            status_ultima_execucao: 'erro',
            erro_log: err.message,
            ...(jaHaviaFalhado
              ? { status: 'erro', proxima_execucao: null }
              : { proxima_execucao: addMinutes(now, 30).toISOString() }),
          })
          .eq('id', item.id);

        await supabaseAdmin
          .from('cadencia_logs')
          .insert({
            organization_id: item.organization_id,
            lead_id: item.lead_id,
            cadencia_id: item.cadencia_id,
            passo_ordem: (item.passo_atual_ordem || 0) + 1,
            status: 'erro',
            mensagem_erro: err.message
          });

        results.push({ lead_id: item.lead_id, status: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
