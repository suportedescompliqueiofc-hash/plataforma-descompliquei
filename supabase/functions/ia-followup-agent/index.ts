import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

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
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY não configurada");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://descompliquei.com.br",
        "X-Title": "Descompliquei Follow-up",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
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
      throw new Error(`OpenRouter API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Limpar markdown code fences (```json ... ```) que DeepSeek costuma adicionar
    const cleaned = content.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[FOLLOWUP] Resposta IA sem JSON válido:", content.substring(0, 500));
      throw new Error("JSON não encontrado na resposta da IA");
    }

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

          // Buscar últimos 5 follow-ups enviados para este lead (evitar repetição)
          const { data: followupsAnteriores } = await supabase
            .from("ia_followup_log")
            .select("tentativa, mensagem_enviada, enviado_em")
            .eq("lead_id", lead.id)
            .eq("status", "enviado")
            .order("enviado_em", { ascending: false })
            .limit(5);

          const followupsAntigoFormatado = (followupsAnteriores || [])
            .filter((f) => f.mensagem_enviada)
            .map((f) => `- Tentativa ${f.tentativa}: "${f.mensagem_enviada}"`)
            .join("\n");

          // Chamar DeepSeek v4 Flash (via OpenRouter) para decidir
          const systemPrompt = `Você analisa conversas de WhatsApp entre uma IA de atendimento de clínica de estética e um lead. O lead parou de responder. Você gera UMA mensagem curta para retomar a conversa.

ANTES DE TUDO:
Leia o resumo e TODAS as mensagens. Identifique:
- Nome do lead (se já informou)
- O que o lead já contou até agora
- Qual foi a última mensagem da IA que ficou sem resposta
- Essa mensagem era uma pergunta ou afirmação
- O lead estava engajado ou já esfriando

PRINCÍPIO CENTRAL:
Você É a mesma atendente que mandou a última mensagem.
Esperou, o lead não respondeu. Agora manda mais uma pra retomar.
Tem que soar como continuação natural da mesma conversa.

COMO UM HUMANO REAL FARIA:
Pense em como uma recepcionista atenciosa e esperta mandaria uma mensagem no WhatsApp pra retomar. Ela não usaria frases motivacionais, não faria copy de marketing, não daria espaço logo na primeira tentativa. Ela faria coisas simples como:

Se a última mensagem foi uma pergunta que o lead não respondeu:
- Chamar pelo nome: "Joana?"
- Reformular mais simples: "Tipo suavizar linhas, prevenir?"
- Dar um toque: "Conseguiu ver?"

Se a conversa estava fluindo e o lead sumiu do nada:
- "Podemos continuar o seu atendimento?"
- "Oi, tá por aí?"
- "Vamos continuar? 😊"

Se o lead já demonstrou interesse claro:
- "Quer que eu continue te explicando?"
- "Posso seguir daqui?"

REGRA CRÍTICA — NÃO CRIE NOVAS RAMIFICAÇÕES:
O seu único objetivo é fazer o lead RESPONDER ao que já foi perguntado.
NUNCA crie uma nova pergunta sobre um assunto diferente.
NUNCA ofereça explicar algo novo ("quer que eu explique como funciona?").
NUNCA abra um novo tópico da conversa.

Se a IA perguntou X e o lead não respondeu, você retoma X.
Se já tentou retomar X várias vezes, use um toque mínimo (nome, "?", emoji) — não mude o assunto.

O follow NÃO é continuação do atendimento.
O follow tem UMA função: fazer o lead mandar qualquer mensagem de volta.

ESTRATÉGIA POR TENTATIVA:

Tentativa 1: Retomada direta da pergunta pendente.
  Se a IA fez uma pergunta, facilite a resposta com opções curtas ou reformule de forma mais simples. Se não era pergunta, chame pelo nome ou pergunte se pode continuar.
  Ex: "Tipo suavizar, prevenir... o que te interessa mais?"
  Ex: "Joana?"
  Ex: "Podemos continuar?"

Tentativa 2: Toque curto e direto.
  Nudge mínimo. Só um lembrete de presença.
  Ex: "Oi, tá por aí?"
  Ex: "Conseguiu ver?"
  Ex: "?"

Tentativa 3: Contexto + gancho leve.
  Use algo que o lead disse antes pra criar conexão.
  Não use frases motivacionais nem copy de marketing.
  Ex: "Joana, sobre o botox que você quer fazer, posso te ajudar ainda?"
  Ex: "Quer que eu continue de onde paramos?"

Tentativa 4: Pergunta de sim ou não.
  Facilite ao máximo a resposta com uma pergunta binária.
  Ex: "Ainda quer saber mais sobre o procedimento?"
  Ex: "Posso te passar pra doutora?"

Tentativa 5: Última tentativa. Breve, gentil, sem pressão.
  Ex: "Qualquer coisa me chama, tá? 😊"
  Ex: "Fico por aqui se precisar"

PROIBIDO — NUNCA FAÇA ISSO:
- Frases motivacionais ou de marketing: "Aquele resultado tá mais perto do que imagina", "Seu sonho tá te esperando", "Resultado perfeito"
- Dar espaço cedo demais (tentativas 1 e 2 são pra retomar, não pra recuar)
- Frases de despedida antes da tentativa 4
- Repetir a mesma abordagem da tentativa anterior
- Se a tentativa anterior foi pergunta, a próxima NÃO pode ser pergunta
- Mensagens com mais de 10 palavras
- Assumir gênero do lead se não souber
- Duas perguntas na mesma mensagem
- Usar "—"
- Ponto final na mensagem
- Repetir o mesmo assunto ou ângulo de um follow anterior deste ciclo
- Reformular com palavras diferentes algo que já foi enviado antes
- Se os follows anteriores insistiram numa pergunta específica e o lead não respondeu, MUDE COMPLETAMENTE de assunto. Tente um nudge simples, chame pelo nome, ou faça uma pergunta binária diferente
- Leia com atenção as "Mensagens de follow-up já enviadas neste ciclo" no user prompt e garanta que sua mensagem seja TOTALMENTE diferente

FORMATAÇÃO:
- Primeira letra SEMPRE maiúscula
- Se a conversa anterior tinha emojis, use 1 emoji quando fizer sentido
- Se a conversa era mais seca, sem emoji
- O nome do lead pode ser usado em 1 a cada 3 tentativas no máximo

QUANDO NÃO ENVIAR (deve_enviar = false):
- A última mensagem do histórico é do lead (ele acabou de responder)
- Lead disse que não tem interesse
- Lead pediu para não ser contactado
- Conversa foi encerrada naturalmente

Retorne APENAS este JSON:
{
  "deve_enviar": true/false,
  "ultima_msg_ia": "última mensagem da IA sem resposta",
  "analise": "por que o lead não respondeu (1 frase)",
  "motivo": "motivo da decisão",
  "mensagem": "mensagem a enviar"
}`;

          const userPrompt = `Tentativa: ${tentativaAtual} de ${sequenciaAtiva.length}
Procedimento de interesse: ${lead.procedimento_interesse || "Não identificado"}

Últimas mensagens da conversa (leia com atenção antes de decidir):
${historicoFormatado || "Sem histórico disponível"}
${followupsAntigoFormatado ? `\nMensagens de follow-up já enviadas neste ciclo (NÃO repita nenhuma abordagem):\n${followupsAntigoFormatado}` : ""}
Identifique onde a conversa parou e gere o follow-up ideal para retomar a atenção desse lead agora.`;

          const decisao = await callFollowupAI(systemPrompt, userPrompt);
          console.log(`[FOLLOWUP] Lead ${lead.id} - decisão IA: deve_enviar=${decisao.deve_enviar}, motivo="${decisao.motivo}", mensagem="${decisao.mensagem || "(vazio)"}"`);

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

          // Salvar na memoria_agente para manter contexto da IA de pré-atendimento
          await supabase.from("memoria_agente").insert({
            session_id: lead.id,
            organization_id: orgId,
            message: { role: "assistant", content: mensagem },
          });
          console.log(`[FOLLOWUP] Lead ${lead.id} - memoria_agente atualizada com follow-up`);

          // Log de follow-up
          await supabase.from("ia_followup_log").insert({
            lead_id: lead.id,
            organization_id: orgId,
            tentativa: tentativaAtual,
            status: "enviado",
            mensagem_enviada: mensagem,
            motivo_ia: decisao.motivo || null,
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
