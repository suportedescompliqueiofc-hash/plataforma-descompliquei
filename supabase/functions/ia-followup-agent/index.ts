import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function agoraBrasilia(): Date {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utcOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (utcOffset + brasiliaOffset) * 60 * 1000);
}

function dentroDoHorario(horario: any): boolean {
  if (!horario) return true;

  const agora = agoraBrasilia();
  const dia = agora.getDay();
  const horaMinuto = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

  if (dia === 0) {
    return horario.sunday_closed === false;
  }

  if (dia === 6) {
    if (horario.saturday_closed) return false;
    if (horario.saturday_open && horario.saturday_close) {
      return horaMinuto >= horario.saturday_open && horaMinuto <= horario.saturday_close;
    }
    return false;
  }

  if (horario.weekday_open && horario.weekday_close) {
    return horaMinuto >= horario.weekday_open && horaMinuto <= horario.weekday_close;
  }

  return true;
}

async function callFollowupAI(systemPrompt: string, userPrompt: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        max_tokens: 512,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON não encontrado na resposta da IA");

    return JSON.parse(jsonMatch[0]);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const globalStart = Date.now();
  let processados = 0;
  let enviados = 0;
  let ignorados_ia = 0;
  let fora_horario_total = 0;
  let erros = 0;

  try {
    // 1. Buscar orgs com follow-up ativo
    const { data: configs, error: configErr } = await supabase
      .from("ia_followup_config")
      .select("organization_id, sequencia, respeitar_horario_atendimento, apenas_marketing")
      .eq("ativo", true);

    if (configErr || !configs || configs.length === 0) {
      console.log("[FOLLOWUP] Nenhuma organização com follow-up ativo");
      return jsonResponse({ ok: true, processados: 0 });
    }

    console.log(`[FOLLOWUP] ${configs.length} organização(ões) com follow-up ativo`);

    for (const config of configs) {
      const orgId = config.organization_id;
      const sequencia: Array<{ ordem: number; minutos: number; ativo: boolean }> = config.sequencia || [];
      const sequenciaAtiva = sequencia.filter((s) => s.ativo).sort((a, b) => a.ordem - b.ordem);

      if (sequenciaAtiva.length === 0) {
        console.log(`[FOLLOWUP] Org ${orgId}: sequência vazia ou sem itens ativos`);
        continue;
      }

      // Buscar config de horário
      const { data: aiPromptConfig } = await supabase
        .from("organization_ai_prompts")
        .select("horario_atendimento")
        .eq("organization_id", orgId)
        .maybeSingle();

      // Verificar horário se necessário
      if (config.respeitar_horario_atendimento) {
        if (!dentroDoHorario(aiPromptConfig?.horario_atendimento)) {
          console.log(`[FOLLOWUP] Org ${orgId}: fora do horário de atendimento`);
          fora_horario_total++;
          continue;
        }
      }

      // Buscar WhatsApp connection
      const { data: waConn } = await supabase
        .from("whatsapp_connections")
        .select("uazapi_url, uazapi_token")
        .eq("organization_id", orgId)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      if (!waConn?.uazapi_url || !waConn?.uazapi_token) {
        console.log(`[FOLLOWUP] Org ${orgId}: sem WhatsApp conectado`);
        continue;
      }

      const totalTentativasAtivas = sequenciaAtiva.length;

      // Reset em massa: leads pausados que responderam após o último follow-up
      // Supabase JS não suporta comparação coluna-a-coluna, então buscamos e filtramos em código
      {
        let resetSelectQuery = supabase
          .from("leads")
          .select("id, ultimo_contato, followup_ultima_tentativa")
          .eq("organization_id", orgId)
          .eq("followup_pausado", true)
          .eq("ia_ativa", true)
          .lt("posicao_pipeline", 4)
          .not("followup_ultima_tentativa", "is", null)
          .not("ultimo_contato", "is", null);

        if (config.apenas_marketing) {
          resetSelectQuery = resetSelectQuery.eq("origem", "marketing");
        }

        const { data: leadsPausados } = await resetSelectQuery;

        if (leadsPausados && leadsPausados.length > 0) {
          const idsParaResetar = leadsPausados
            .filter((l) => new Date(l.ultimo_contato) > new Date(l.followup_ultima_tentativa))
            .map((l) => l.id);

          if (idsParaResetar.length > 0) {
            await supabase
              .from("leads")
              .update({
                followup_tentativas: 0,
                followup_ultima_tentativa: null,
                followup_pausado: false,
              })
              .in("id", idsParaResetar);

            console.log(`[FOLLOWUP] Org ${orgId}: ${idsParaResetar.length} lead(s) pausado(s) resetado(s) (responderam após follow-up)`);
          }
        }
      }

      // Buscar leads elegíveis
      let query = supabase
        .from("leads")
        .select("id, nome, telefone, resumo, procedimento_interesse, followup_tentativas, followup_ultima_tentativa, followup_pausado, ultimo_contato, posicao_pipeline, ia_paused_until, criado_em")
        .eq("organization_id", orgId)
        .eq("ia_ativa", true)
        .lt("posicao_pipeline", 4);

      if (config.apenas_marketing) {
        query = query.eq("origem", "marketing");
      }

      const { data: leads, error: leadsErr } = await query;

      if (leadsErr || !leads || leads.length === 0) {
        console.log(`[FOLLOWUP] Org ${orgId}: nenhum lead elegível`);
        continue;
      }

      // Filtrar ia_paused_until em código (NULL ou no passado)
      const now = new Date();
      const leadsElegiveis = leads.filter((l) => {
        if (!l.ia_paused_until) return true;
        return new Date(l.ia_paused_until) < now;
      });

      if (leadsElegiveis.length === 0) {
        console.log(`[FOLLOWUP] Org ${orgId}: todos os leads pausados`);
        continue;
      }

      console.log(`[FOLLOWUP] Org ${orgId}: ${leadsElegiveis.length} leads elegíveis`);

      for (const lead of leadsElegiveis) {
        try {
          processados++;
          console.log(`[FOLLOWUP] ── Lead ${lead.id} - ${lead.nome || "sem nome"} | tel: ${lead.telefone} | tentativas: ${lead.followup_tentativas || 0} | pausado: ${lead.followup_pausado} | ultimo_contato: ${lead.ultimo_contato} | followup_ultima_tentativa: ${lead.followup_ultima_tentativa}`);

          // Reset automático: se lead respondeu após o último follow-up, reiniciar ciclo
          if (lead.followup_ultima_tentativa) {
            const { data: ultimaMsgLeadReset } = await supabase
              .from("mensagens")
              .select("criado_em")
              .eq("lead_id", lead.id)
              .eq("direcao", "entrada")
              .gt("criado_em", lead.followup_ultima_tentativa)
              .order("criado_em", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (ultimaMsgLeadReset) {
              await supabase.from("leads").update({
                followup_tentativas: 0,
                followup_ultima_tentativa: null,
                followup_pausado: false,
              }).eq("id", lead.id);

              console.log(`[FOLLOWUP] Lead ${lead.id}: respondeu após follow-up, ciclo resetado — pulando nesta rodada`);
              continue; // Pular: próximo cron pega o lead com estado fresh
            }
          }

          // Se ainda está pausado após verificação de reset, pular
          if (lead.followup_pausado) {
            console.log(`[FOLLOWUP] Lead ${lead.id} - SKIP: ainda pausado após check de reset`);
            continue;
          }

          const tentativaAtual = (lead.followup_tentativas || 0) + 1;

          // Verificar se esgotou todas as tentativas ativas
          if (tentativaAtual > totalTentativasAtivas) {
            await supabase.from("leads").update({ followup_pausado: true }).eq("id", lead.id);
            console.log(`[FOLLOWUP] Lead ${lead.id}: esgotou tentativas (${tentativaAtual} > ${totalTentativasAtivas})`);
            continue;
          }

          // Buscar config da tentativa atual por índice (não por ordem)
          const configTentativa = sequenciaAtiva[tentativaAtual - 1];
          if (!configTentativa) {
            console.log(`[FOLLOWUP] Lead ${lead.id}: config não encontrada para tentativa ${tentativaAtual}, pulando`);
            continue;
          }

          // Determinar referência de tempo correta por tentativa
          let referenciaData: Date | null = null;

          if ((lead.followup_tentativas || 0) === 0) {
            // 1ª tentativa: usar último contato do lead
            referenciaData = lead.ultimo_contato
              ? new Date(lead.ultimo_contato)
              : null;

            // Fallback: buscar última mensagem do lead na tabela mensagens
            if (!referenciaData) {
              const { data: ultimaMensagem } = await supabase
                .from("mensagens")
                .select("criado_em")
                .eq("lead_id", lead.id)
                .eq("direcao", "entrada")
                .order("criado_em", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (ultimaMensagem) {
                referenciaData = new Date(ultimaMensagem.criado_em);
              }
            }

            // Último fallback: usar criado_em do lead
            if (!referenciaData) {
              referenciaData = lead.criado_em ? new Date(lead.criado_em) : null;
            }
          } else {
            // Tentativas subsequentes: usar quando mandou o último follow-up
            referenciaData = lead.followup_ultima_tentativa
              ? new Date(lead.followup_ultima_tentativa)
              : lead.ultimo_contato
                ? new Date(lead.ultimo_contato)
                : lead.criado_em
                  ? new Date(lead.criado_em)
                  : null;
          }

          if (!referenciaData) {
            console.log(`[FOLLOWUP] Lead ${lead.id}: sem referência de tempo mesmo após fallbacks, pulando`);
            continue;
          }

          console.log(`[FOLLOWUP] Lead ${lead.id} - ref tempo: ${referenciaData.toISOString()} | tentativa: ${tentativaAtual}/${totalTentativasAtivas} | config minutos: ${configTentativa.minutos}`);

          const minutosDecorridos = (Date.now() - referenciaData.getTime()) / (1000 * 60);
          console.log(`[FOLLOWUP] Lead ${lead.id} - tempo passado: ${minutosDecorridos.toFixed(1)}min, threshold: ${configTentativa.minutos}min, passa: ${minutosDecorridos >= configTentativa.minutos}`);
          if (minutosDecorridos < configTentativa.minutos) {
            console.log(`[FOLLOWUP] Lead ${lead.id} - SKIP: tempo insuficiente (${minutosDecorridos.toFixed(1)}min < ${configTentativa.minutos}min)`);
            continue;
          }

          console.log(`[FOLLOWUP] Lead ${lead.id} - tempo OK, buscando histórico e chamando IA...`);

          // Buscar últimas 10 mensagens para contexto
          const { data: historico } = await supabase
            .from("mensagens")
            .select("conteudo, direcao, criado_em")
            .eq("lead_id", lead.id)
            .order("criado_em", { ascending: false })
            .limit(10);

          const historicoFormatado = (historico || [])
            .reverse()
            .map((m) => `${m.direcao === "entrada" ? "Lead" : "Atendente"}: ${m.conteudo || "[mídia]"}`)
            .join("\n");

          // Buscar follow-ups já enviados para este lead (evitar repetição)
          const { data: followupsAnteriores } = await supabase
            .from("ia_followup_log")
            .select("tentativa, mensagem_enviada")
            .eq("lead_id", lead.id)
            .eq("status", "enviado")
            .order("tentativa", { ascending: true });

          const followupsAntigoFormatado = (followupsAnteriores || [])
            .filter((f) => f.mensagem_enviada)
            .map((f) => `- Tentativa ${f.tentativa}: "${f.mensagem_enviada}"`)
            .join("\n");

          // Chamar GPT-4.1-mini para decidir
          const systemPrompt = `Você é especialista em reativação de leads via WhatsApp para clínicas de estética.

Sua única função: analisar o histórico da conversa e decidir se deve enviar um follow-up para reativar a atenção do lead que parou de responder.

LEIA AS ÚLTIMAS 10 MENSAGENS antes de decidir qualquer coisa.
Entenda exatamente onde a conversa travou e por quê.

OBJETIVO DO FOLLOW-UP:
Retomar a atenção do lead. Só isso.
Não é para vender, não é para convencer, não é para explicar.
É para fazer o lead voltar os olhos para a conversa.

FILOSOFIA DA MENSAGEM:
Menos é mais. Muito mais.
Uma mensagem curta, inesperada e humana tem 10x mais chance de resposta do que uma pergunta elaborada.
Pense como um amigo que manda uma mensagem rápida - não como um atendente.

TIPOS DE MENSAGEM PERMITIDOS (do mais simples ao mais contextual):
- Apenas um emoji que gera curiosidade ou leveza: 👀 🫣 😅
- Uma frase curtíssima sem pergunta: "Sumiu por aqui 😅"
- Uma referência direta ao que foi dito + gancho mínimo: "Botox tá te esperando 👀"
- Uma pergunta de UMA palavra ou muito curta: "E aí?" / "Ficou alguma dúvida?"

REGRAS ABSOLUTAS:
- Máximo 1 linha. Sem exceção
- NUNCA use o nome do lead no follow-up
- NUNCA faça duas perguntas
- NUNCA explique nada, apresente nada, ofereça nada
- NUNCA soe como atendimento formal ou sistema automático
- Sem ponto final
- Sem "—" em nenhuma hipótese
- Varie completamente o tipo de mensagem a cada tentativa - se a tentativa anterior foi emoji, a próxima deve ser frase curta, e vice-versa

REGRA CRÍTICA DE NÃO-REPETIÇÃO:
- Você receberá a lista de follow-ups já enviados para este lead
- A nova mensagem DEVE ser completamente diferente das anteriores
- Nunca repita a mesma ideia, estrutura ou abordagem
- Mude o ângulo, o tom e a construção a cada tentativa

VARIAÇÃO OBRIGATÓRIA POR TENTATIVA:
Use o número da tentativa atual para variar o ângulo:
- Tentativa 1: retomada leve - emoji ou frase curtíssima sem contexto
- Tentativa 2: referência direta ao ponto onde a conversa parou
- Tentativa 3: gancho de resultado - o que o lead disse que queria
- Tentativa 4: leveza e humor sutil - desarmante
- Tentativa 5: última tentativa - direta, simples, sem pressão

QUANDO NÃO ENVIAR (deve_enviar = false):
- A última mensagem do histórico é do lead (ele acabou de responder)
- Lead disse que não tem interesse
- Lead pediu para não ser contactado
- Conversa foi encerrada

Retorne APENAS este JSON:
{
  "deve_enviar": true/false,
  "motivo": "motivo em 1 frase",
  "mensagem": "mensagem a enviar (se deve_enviar = true)"
}`;

          const userPrompt = `Tentativa: ${tentativaAtual} de ${sequenciaAtiva.length}
Procedimento de interesse: ${lead.procedimento_interesse || "Não identificado"}

Últimas mensagens da conversa (leia com atenção antes de decidir):
${historicoFormatado || "Sem histórico disponível"}
${followupsAntigoFormatado ? `\nFollow-ups já enviados para este lead (NÃO repita nenhum deles):\n${followupsAntigoFormatado}` : ""}
Identifique onde a conversa parou e gere o follow-up ideal para retomar a atenção desse lead agora.`;

          const decisao = await callFollowupAI(systemPrompt, userPrompt);
          console.log(`[FOLLOWUP] Lead ${lead.id} - decisão GPT: deve_enviar=${decisao.deve_enviar}, motivo="${decisao.motivo}", mensagem="${decisao.mensagem || "(vazio)"}"`);

          if (!decisao.deve_enviar) {
            await supabase.from("ia_followup_log").insert({
              lead_id: lead.id,
              organization_id: orgId,
              tentativa: tentativaAtual,
              status: "ignorado_ia",
              motivo_ia: decisao.motivo,
            });

            const isUltimaTentativaIgnorada = tentativaAtual >= totalTentativasAtivas;
            await supabase.from("leads").update({
              followup_tentativas: tentativaAtual,
              followup_ultima_tentativa: new Date().toISOString(),
              ...(isUltimaTentativaIgnorada ? { followup_pausado: true } : {}),
            }).eq("id", lead.id);

            ignorados_ia++;
            console.log(`[FOLLOWUP] Lead ${lead.id}: IA ignorou (tentativa ${tentativaAtual}/${totalTentativasAtivas})${isUltimaTentativaIgnorada ? " — última tentativa, pausando" : ""}`);
            continue;
          }

          // Guard: verificar se lead respondeu entre o início do processamento e agora
          const { data: leadFresco } = await supabase
            .from("leads")
            .select("ultimo_contato")
            .eq("id", lead.id)
            .maybeSingle();

          if (leadFresco?.ultimo_contato && referenciaData) {
            const ultimoContatoFresco = new Date(leadFresco.ultimo_contato);
            if (ultimoContatoFresco > referenciaData) {
              console.log(`[FOLLOWUP] Lead ${lead.id}: lead respondeu durante processamento (ultimo_contato ${ultimoContatoFresco.toISOString()} > ref ${referenciaData.toISOString()}), cancelando envio`);
              continue;
            }
          }

          // Enviar mensagem via UazAPI
          const telefoneDigits = (lead.telefone ?? "").replace(/\D/g, "");
          const phoneFormatted = telefoneDigits.startsWith("55") && telefoneDigits.length >= 12
            ? telefoneDigits
            : `55${telefoneDigits}`;

          const uazapiUrl = waConn.uazapi_url.replace(/\/$/, "");
          const mensagem = decisao.mensagem;

          const uazapiRes = await fetch(`${uazapiUrl}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "token": waConn.uazapi_token,
            },
            body: JSON.stringify({
              number: phoneFormatted,
              text: mensagem,
              delay: 1200,
            }),
          });

          const uazapiRespText = await uazapiRes.text();
          let uazapiRespJson: any = {};
          try { uazapiRespJson = JSON.parse(uazapiRespText); } catch { /* noop */ }

          console.log(`[FOLLOWUP] Lead ${lead.id} - UazAPI status: ${uazapiRes.status}, body: ${uazapiRespText.substring(0, 500)}`);

          if (!uazapiRes.ok) {
            console.error(`[FOLLOWUP] Lead ${lead.id} - UazAPI FALHA: status=${uazapiRes.status}, response=${uazapiRespText.substring(0, 300)}`);
            throw new Error(`UazAPI ${uazapiRes.status}: ${uazapiRespText.substring(0, 200)}`);
          }

          const waMessageId = uazapiRespJson?.id ?? uazapiRespJson?.messageid ?? uazapiRespJson?.message?.id ?? null;
          console.log(`[FOLLOWUP] Lead ${lead.id} - UazAPI OK, waMessageId: ${waMessageId}`);

          // Salvar mensagem no CRM
          await supabase.from("mensagens").insert({
            lead_id: lead.id,
            organization_id: orgId,
            conteudo: mensagem,
            direcao: "saida",
            remetente: "bot",
            tipo_conteudo: "texto",
            id_mensagem: waMessageId,
          });

          // Log de follow-up
          await supabase.from("ia_followup_log").insert({
            lead_id: lead.id,
            organization_id: orgId,
            tentativa: tentativaAtual,
            status: "enviado",
            mensagem_enviada: mensagem,
          });

          // Atualizar lead — pausar SOMENTE se esgotou todas as tentativas
          const isUltimaTentativa = tentativaAtual >= totalTentativasAtivas;
          await supabase.from("leads").update({
            followup_tentativas: tentativaAtual,
            followup_ultima_tentativa: new Date().toISOString(),
            ...(isUltimaTentativa ? { followup_pausado: true } : {}),
          }).eq("id", lead.id);

          enviados++;
          console.log(`[FOLLOWUP] Lead ${lead.id}: mensagem enviada (tentativa ${tentativaAtual}/${totalTentativasAtivas})${isUltimaTentativa ? " — última tentativa, pausando" : ""}`);

        } catch (leadErr: any) {
          erros++;
          console.error(`[FOLLOWUP] Erro no lead ${lead.id}:`, leadErr?.message);

          try {
            await supabase.from("ia_followup_log").insert({
              lead_id: lead.id,
              organization_id: orgId,
              tentativa: (lead.followup_tentativas || 0) + 1,
              status: "erro",
              motivo_ia: leadErr?.message?.substring(0, 500),
            });
          } catch (logErr: any) {
            console.error("[FOLLOWUP] Erro ao inserir log de erro:", logErr?.message);
          }
        }
      }
    }

    const duracao = Date.now() - globalStart;
    console.log(`[FOLLOWUP] Concluído em ${duracao}ms: ${processados} processados, ${enviados} enviados, ${ignorados_ia} ignorados, ${fora_horario_total} fora horário, ${erros} erros`);

    return jsonResponse({
      ok: true,
      processados,
      enviados,
      ignorados_ia,
      fora_horario: fora_horario_total,
      erros,
      duracao_ms: duracao,
    });

  } catch (err: any) {
    console.error("[FOLLOWUP] Erro fatal:", err);
    return jsonResponse({ error: "internal_error", detail: String(err?.message ?? err) }, 500);
  }
});
