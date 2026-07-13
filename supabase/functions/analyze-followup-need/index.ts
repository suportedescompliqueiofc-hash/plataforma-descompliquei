import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-v4-flash";
const BATCH_SIZE = 30;
const SILENCE_MINUTES = 10;

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY not set");

    let filterOrgId: string | null = null;
    try {
      const body = await req.json();
      filterOrgId = body?.organization_id ?? null;
    } catch { /* cron mode — process all */ }

    const cutoffSilence = new Date(
      Date.now() - SILENCE_MINUTES * 60 * 1000,
    ).toISOString();

    // Busca leads marcados como PENDENTE com 10+ min de silêncio
    // Sem janela de datas — cobre todos os leads de qualquer período
    let query = supabase
      .from("leads")
      .select("id, nome, organization_id")
      .eq("followup_gap", "PENDENTE")
      .lt("ultimo_contato", cutoffSilence)
      .order("ultimo_contato", { ascending: false })
      .limit(BATCH_SIZE);

    if (filterOrgId) query = query.eq("organization_id", filterOrgId);

    const { data: candidateLeads, error: leadsError } = await query;

    if (leadsError) throw leadsError;
    if (!candidateLeads?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No candidates" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const leadIds = candidateLeads.map((l) => l.id);

    // Excluir leads com venda registrada
    const { data: vendasData } = await supabase
      .from("vendas")
      .select("lead_id")
      .in("lead_id", leadIds);

    const convertedIds = new Set(vendasData?.map((v) => v.lead_id) ?? []);
    const toProcess = candidateLeads.filter((l) => !convertedIds.has(l.id));

    // Gate Athos Follow-Up: pular orgs que desligaram o agente no Console Athos.
    const { data: disabledRows } = await supabase
      .from("athos_agentes_org")
      .select("organization_id")
      .eq("agente_slug", "followup")
      .eq("ativo", false);
    const disabledOrgs = new Set((disabledRows ?? []).map((r) => r.organization_id));
    const gatedToProcess = toProcess.filter((l) => !disabledOrgs.has(l.organization_id));

    let processed = 0;
    let needsFollow = 0;
    let closed = 0;

    for (const lead of gatedToProcess) {
      const markAs = async (gap: string, motivo: string) => {
        await supabase
          .from("leads")
          .update({
            followup_gap: gap,
            followup_gap_motivo: motivo,
            followup_gap_analisado_em: new Date().toISOString(),
          })
          .eq("id", lead.id);
        processed++;
        if (gap === "PRECISA_FOLLOW") needsFollow++;
        else closed++;
      };

      // Buscar última mensagem (excluindo logs de IA)
      const { data: lastMsg } = await supabase
        .from("mensagens")
        .select("direcao, remetente, criado_em")
        .eq("lead_id", lead.id)
        .not("remetente", "eq", "ia")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastMsg) {
        await markAs("ENCERRADO", "Sem histórico de mensagens");
        continue;
      }

      // Lead falou por último → não é gap de follow-up
      if (lastMsg.direcao === "entrada" || lastMsg.remetente === "lead") {
        await markAs(
          "ENCERRADO",
          "Último contato foi do lead — aguardando resposta da equipe",
        );
        continue;
      }

      // Buscar últimas 8 mensagens para contexto da IA
      const { data: messages } = await supabase
        .from("mensagens")
        .select("conteudo, direcao, remetente, criado_em")
        .eq("lead_id", lead.id)
        .not("remetente", "eq", "ia")
        .order("criado_em", { ascending: false })
        .limit(8);

      if (!messages?.length) {
        processed++;
        continue;
      }

      const conversaFormatada = messages
        .reverse()
        .map((m) => {
          const quem = (m.direcao === "entrada" || m.remetente === "lead")
            ? "LEAD"
            : (m.remetente === "bot" ? "IA" : "EQUIPE");
          return `[${quem}]: ${m.conteudo ?? "(mídia)"}`;
        })
        .join("\n");

      let classificacao = "ENCERRADO";
      let motivo = "Não foi possível classificar";

      try {
        const aiRes = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openrouterKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "system",
                content: `Você analisa conversas de WhatsApp entre uma clínica e potenciais pacientes.
Determine se o lead precisa de follow-up ou se a conversa está encerrada.

Cada mensagem vem marcada: [LEAD] = o paciente; [IA] = resposta automática da IA; [EQUIPE] = atendente humano.

PRECISA_FOLLOW: a IA ou a equipe enviou mensagem (proposta, pergunta, link, informação) e o lead NÃO respondeu — conversa em aberto aguardando o lead.
ENCERRADO: conversa concluída naturalmente (lead disse não tem interesse, agendou, agradeceu, se despediu, ou foi encerrada formalmente sem precisar de resposta do lead).

No "motivo" (1 linha), deixe claro QUEM falou por último: a IA ou a equipe (atendente humano).

Responda SOMENTE neste formato JSON sem markdown:
{"classificacao":"PRECISA_FOLLOW","motivo":"1 linha"}`,
              },
              {
                role: "user",
                content: `Conversa:\n\n${conversaFormatada}`,
              },
            ],
            max_tokens: 120,
            temperature: 0.1,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData.choices?.[0]?.message?.content ?? "";
          const cleaned = raw
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
          const parsed = JSON.parse(cleaned);
          classificacao =
            parsed.classificacao === "PRECISA_FOLLOW"
              ? "PRECISA_FOLLOW"
              : "ENCERRADO";
          motivo = parsed.motivo ?? motivo;
        } else {
          console.error(`AI error for lead ${lead.id}:`, await aiRes.text());
        }
      } catch (e) {
        console.error(`Classification error for lead ${lead.id}:`, e);
      }

      await markAs(classificacao, motivo);
    }

    return new Response(JSON.stringify({ processed, needsFollow, closed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-followup-need error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
