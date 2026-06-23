import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-v4-flash";
const BATCH_SIZE = 30;
const SILENCE_MINUTES = 10;
const BACKFILL_DAYS = 3;

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY not set");

    // Optional params for manual/test invocations
    let filterOrgId: string | null = null;
    let backfillDays = BACKFILL_DAYS;
    try {
      const body = await req.json();
      filterOrgId = body?.organization_id ?? null;
      if (body?.backfill_days && Number(body.backfill_days) > 0) {
        backfillDays = Number(body.backfill_days);
      }
    } catch { /* no body = cron mode, process all */ }

    const cutoffRecent = new Date(
      Date.now() - backfillDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const cutoffSilence = new Date(
      Date.now() - SILENCE_MINUTES * 60 * 1000,
    ).toISOString();

    // Leads: 3-day window, not yet analyzed, silent for 10+ min
    let query = supabase
      .from("leads")
      .select("id, nome, organization_id")
      .is("followup_gap_analisado_em", null)
      .gt("ultimo_contato", cutoffRecent)
      .lt("ultimo_contato", cutoffSilence)
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

    // Exclude leads that already have a sale
    const { data: vendasData } = await supabase
      .from("vendas")
      .select("lead_id")
      .in("lead_id", leadIds);

    const convertedIds = new Set(vendasData?.map((v) => v.lead_id) ?? []);
    const toProcess = candidateLeads.filter((l) => !convertedIds.has(l.id));

    let processed = 0;
    let needsFollow = 0;
    let closed = 0;

    for (const lead of toProcess) {
      // Get the most recent message to check direction
      const { data: lastMsg } = await supabase
        .from("mensagens")
        .select("direcao, remetente, criado_em")
        .eq("lead_id", lead.id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

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

      if (!lastMsg) {
        await markAs("ENCERRADO", "Sem histórico de mensagens");
        continue;
      }

      // Lead spoke last → team needs to respond (not a follow-up gap)
      if (lastMsg.direcao === "entrada" || lastMsg.remetente === "lead") {
        await markAs(
          "ENCERRADO",
          "Último contato foi do lead — aguardando resposta da equipe",
        );
        continue;
      }

      // IA spoke last → automated, not a human follow-up gap
      if (lastMsg.remetente === "ia") {
        await markAs(
          "ENCERRADO",
          "Último contato foi da IA automática — não configura follow pendente",
        );
        continue;
      }

      // Fetch last 8 messages (excluding IA logs) for classification
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
          const quem = m.direcao === "entrada" ? "LEAD" : "EQUIPE";
          return `[${quem}]: ${m.conteudo ?? "(mídia)"}`;
        })
        .join("\n");

      // Classify with DeepSeek via OpenRouter
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

PRECISA_FOLLOW: a equipe enviou mensagem (proposta, pergunta, link, informação) e o lead NÃO respondeu — conversa em aberto aguardando o lead.
ENCERRADO: conversa concluída naturalmente (lead disse não tem interesse, agendou, agradeceu, se despediu, ou equipe encerrou formalmente sem precisar de resposta do lead).

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
