import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

  const resumo = { processados: 0, notificacoes_criadas: 0, erros: 0 };

  try {
    console.log('[process-outbound-notifications] Iniciando verificação...');

    const agora = new Date();
    // Janela: ações com proxima_acao_data entre 5 minutos atrás e 5 minutos à frente
    // Isso captura ações que acabaram de vencer (cron roda a cada 5 min)
    const janelaInicio = new Date(agora.getTime() - 5 * 60 * 1000);
    const janelaFim = new Date(agora.getTime() + 5 * 60 * 1000);

    // Buscar prospectos com ação pendente dentro da janela
    const { data: prospectos, error: prospErr } = await supabaseAdmin
      .from('outbound_prospectos')
      .select('id, organization_id, usuario_id, nome, clinica, proxima_acao, proxima_acao_data, stage_id')
      .not('proxima_acao_data', 'is', null)
      .gte('proxima_acao_data', janelaInicio.toISOString())
      .lte('proxima_acao_data', janelaFim.toISOString());

    if (prospErr) throw prospErr;

    if (!prospectos || prospectos.length === 0) {
      console.log('[process-outbound-notifications] Nenhuma ação pendente na janela.');
      return new Response(JSON.stringify({ success: true, ...resumo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-outbound-notifications] ${prospectos.length} prospecto(s) com ação na janela.`);

    // Verificar quais stages são ativos
    const stageIds = [...new Set(prospectos.map(p => p.stage_id).filter(Boolean))];
    let activeStageIds = new Set<string>();
    if (stageIds.length > 0) {
      const { data: stages } = await supabaseAdmin
        .from('outbound_stages')
        .select('id, tipo')
        .in('id', stageIds)
        .eq('tipo', 'ativo');
      activeStageIds = new Set((stages || []).map(s => s.id));
    }

    for (const prospecto of prospectos) {
      // Só notificar prospectos em stages ativos
      if (prospecto.stage_id && !activeStageIds.has(prospecto.stage_id)) {
        continue;
      }

      resumo.processados++;

      // Verificar se já existe notificação para este prospecto nesta janela
      // Evita duplicatas se o cron rodar mais de uma vez
      const chaveDedup = `outbound_acao_${prospecto.id}_${prospecto.proxima_acao_data}`;
      const { data: jaExiste } = await supabaseAdmin
        .from('notificacoes')
        .select('id')
        .eq('organization_id', prospecto.organization_id)
        .eq('tipo', 'outbound_acao_pendente')
        .contains('dados', { prospecto_id: prospecto.id, proxima_acao_data: prospecto.proxima_acao_data })
        .limit(1);

      if (jaExiste && jaExiste.length > 0) {
        console.log(`[process-outbound-notifications] Notificação já existe para prospecto ${prospecto.id}, pulando.`);
        continue;
      }

      // Criar notificação
      const acaoLabel = prospecto.proxima_acao || 'Ação pendente';
      const dataFormatada = new Date(prospecto.proxima_acao_data).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });

      const titulo = `📞 Ação Outbound: ${prospecto.nome}`;
      const mensagem = `${acaoLabel} agendada para ${dataFormatada}${prospecto.clinica ? ` — ${prospecto.clinica}` : ''}`;

      const { error: insertErr } = await supabaseAdmin
        .from('notificacoes')
        .insert({
          organization_id: prospecto.organization_id,
          user_id: prospecto.usuario_id || null,
          lead_id: null,
          tipo: 'outbound_acao_pendente',
          titulo,
          mensagem,
          status: 'pendente',
          dados: {
            prospecto_id: prospecto.id,
            prospecto_nome: prospecto.nome,
            proxima_acao: prospecto.proxima_acao,
            proxima_acao_data: prospecto.proxima_acao_data,
          },
        });

      if (insertErr) {
        console.error(`[process-outbound-notifications] Erro ao inserir notificação para ${prospecto.id}: ${insertErr.message}`);
        resumo.erros++;
      } else {
        console.log(`[process-outbound-notifications] Notificação criada para ${prospecto.nome}`);
        resumo.notificacoes_criadas++;
      }
    }

    console.log(`[process-outbound-notifications] Concluído: ${JSON.stringify(resumo)}`);

    return new Response(JSON.stringify({ success: true, ...resumo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[process-outbound-notifications] Erro fatal: ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message, ...resumo }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
