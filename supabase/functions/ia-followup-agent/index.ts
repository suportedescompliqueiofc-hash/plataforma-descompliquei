import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

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

async function callClaudeHaiku(systemPrompt: string, userPrompt: string): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

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

      const maxTentativas = sequenciaAtiva[sequenciaAtiva.length - 1].ordem;

      // Buscar leads elegíveis
      let query = supabase
        .from("leads")
        .select("id, nome, telefone, resumo, procedimento_interesse, followup_tentativas, followup_ultima_tentativa, ultimo_contato, posicao_pipeline, ia_paused_until, criado_em")
        .eq("organization_id", orgId)
        .eq("ia_ativa", true)
        .eq("followup_pausado", false)
        .lt("posicao_pipeline", 4)
        .lte("followup_tentativas", maxTentativas);

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
          const tentativaAtual = (lead.followup_tentativas || 0) + 1;

          // Encontrar config da tentativa atual na sequência
          const configTentativa = sequenciaAtiva.find((s) => s.ordem === tentativaAtual);
          if (!configTentativa) {
            await supabase.from("leads").update({ followup_pausado: true }).eq("id", lead.id);
            console.log(`[FOLLOWUP] Lead ${lead.id}: esgotou tentativas (${tentativaAtual})`);
            continue;
          }

          // Verificar tempo desde última interação
          let referenciaData: Date | null = lead.followup_ultima_tentativa
            ? new Date(lead.followup_ultima_tentativa)
            : lead.ultimo_contato
              ? new Date(lead.ultimo_contato)
              : null;

          // Fallback: buscar última mensagem do lead na tabela mensagens
          if (!referenciaData) {
            const { data: ultimaMensagem } = await supabase
              .from("mensagens")
              .select("criado_em")
              .eq("lead_id", lead.id)
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

          if (!referenciaData) {
            console.log(`[FOLLOWUP] Lead ${lead.id}: sem referência de tempo mesmo após fallbacks, pulando`);
            continue;
          }

          console.log(`[FOLLOWUP] Lead ${lead.id}: referência de tempo = ${referenciaData.toISOString()}`);

          const minutosDecorridos = (Date.now() - referenciaData.getTime()) / (1000 * 60);
          if (minutosDecorridos < configTentativa.minutos) {
            continue;
          }

          // Buscar última mensagem do lead (entrada)
          const { data: ultimaMsgLead } = await supabase
            .from("mensagens")
            .select("criado_em")
            .eq("lead_id", lead.id)
            .eq("direcao", "entrada")
            .order("criado_em", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Se lead respondeu após último follow-up, resetar
          if (ultimaMsgLead && lead.followup_ultima_tentativa) {
            if (new Date(ultimaMsgLead.criado_em) > new Date(lead.followup_ultima_tentativa)) {
              await supabase.from("leads").update({
                followup_tentativas: 0,
                followup_ultima_tentativa: null,
              }).eq("id", lead.id);
              console.log(`[FOLLOWUP] Lead ${lead.id}: respondeu após último follow-up, resetando`);
              continue;
            }
          }

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

          // Chamar Claude Haiku para decidir
          const systemPrompt = `Você é um analisador de conversas de WhatsApp. Analise o histórico da conversa e o perfil do lead e decida:
1. Se vale a pena enviar um follow-up (não vale se: lead disse que não tem interesse, já agendou, pediu para não ser contactado, ou a conversa foi encerrada naturalmente)
2. Se vale, gere uma mensagem de follow-up humanizada e natural

REGRAS DA MENSAGEM:
- Curta (máximo 2 frases)
- Natural, como um humano mandaria no WhatsApp
- Não robótica, não comercial demais
- Pode fazer referência ao que foi discutido
- NÃO mencione que é um sistema automático
- NÃO use "—" em nenhuma hipótese
- Máximo 1 emoji se apropriado
- Não use ponto final no final

Retorne APENAS este JSON:
{
  "deve_enviar": true/false,
  "motivo": "motivo da decisão",
  "mensagem": "mensagem a enviar (se deve_enviar = true)"
}`;

          const userPrompt = `Lead: ${lead.nome || "Não informado"}
Procedimento de interesse: ${lead.procedimento_interesse || "Não identificado"}
Resumo do atendimento: ${lead.resumo || "Sem resumo"}
Tentativa de follow-up: ${tentativaAtual} de ${sequenciaAtiva.length}

Últimas mensagens da conversa:
${historicoFormatado || "Sem histórico disponível"}

Decida se deve enviar follow-up e gere a mensagem.`;

          const decisao = await callClaudeHaiku(systemPrompt, userPrompt);
          console.log(`[FOLLOWUP] Lead ${lead.id}: IA decidiu deve_enviar=${decisao.deve_enviar}, motivo="${decisao.motivo}"`);

          if (!decisao.deve_enviar) {
            await supabase.from("ia_followup_log").insert({
              lead_id: lead.id,
              organization_id: orgId,
              tentativa: tentativaAtual,
              status: "ignorado_ia",
              motivo_ia: decisao.motivo,
            });

            await supabase.from("leads").update({
              followup_tentativas: tentativaAtual,
              followup_ultima_tentativa: new Date().toISOString(),
            }).eq("id", lead.id);

            ignorados_ia++;
            continue;
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

          if (!uazapiRes.ok) {
            throw new Error(`UazAPI ${uazapiRes.status}: ${uazapiRespText.substring(0, 200)}`);
          }

          const waMessageId = uazapiRespJson?.id ?? uazapiRespJson?.messageid ?? uazapiRespJson?.message?.id ?? null;

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

          // Atualizar lead
          await supabase.from("leads").update({
            followup_tentativas: tentativaAtual,
            followup_ultima_tentativa: new Date().toISOString(),
          }).eq("id", lead.id);

          enviados++;
          console.log(`[FOLLOWUP] Lead ${lead.id}: mensagem enviada (tentativa ${tentativaAtual})`);

        } catch (leadErr: any) {
          erros++;
          console.error(`[FOLLOWUP] Erro no lead ${lead.id}:`, leadErr?.message);

          await supabase.from("ia_followup_log").insert({
            lead_id: lead.id,
            organization_id: orgId,
            tentativa: (lead.followup_tentativas || 0) + 1,
            status: "erro",
            motivo_ia: leadErr?.message?.substring(0, 500),
          }).catch(() => {});
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
