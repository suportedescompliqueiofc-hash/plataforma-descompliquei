import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ══════════════════════════════════════════════════════════════════
// Athos Escriba — lê a conversa (IA ou humana) e mantém o CRM preenchido:
// resumo, procedimento(s) de interesse, objetivo estético e objeção.
// Gatilho: cron (a cada 5 min). Processa leads com precisa_enriquecer=true
// que "assentaram" (sem nova mensagem há SILENCE_MINUTES).
// ══════════════════════════════════════════════════════════════════

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-v4-flash"; // mesmo do Athos Pré-Atendimento (OpenRouter)
const BATCH_SIZE = 25;
const SILENCE_MINUTES = 3;   // debounce: só analisa conversa "assentada"
const MAX_MSGS = 20;         // janela de contexto enviada ao modelo

interface Extraido {
  resumo?: string;
  procedimentos?: string[];
  objetivo?: string;
  objecao?: string;
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY not set");

    // Modo cron processa todos; body opcional filtra por org (debug/manual)
    let filterOrgId: string | null = null;
    try {
      const body = await req.json();
      filterOrgId = body?.organization_id ?? null;
    } catch { /* cron mode */ }

    const cutoffSilence = new Date(Date.now() - SILENCE_MINUTES * 60 * 1000).toISOString();

    let query = supabase
      .from("leads")
      .select("id, organization_id, resumo, procedimento_interesse")
      .eq("precisa_enriquecer", true)
      .lt("ultimo_contato", cutoffSilence)
      .order("ultimo_contato", { ascending: false })
      .limit(BATCH_SIZE);

    if (filterOrgId) query = query.eq("organization_id", filterOrgId);

    const { data: candidates, error: leadsError } = await query;
    if (leadsError) throw leadsError;
    if (!candidates?.length) {
      return json({ processed: 0, message: "No candidates" });
    }

    // Gate opt-out: pular orgs que desligaram o Escriba no Console Athos
    const { data: disabledRows } = await supabase
      .from("athos_agentes_org")
      .select("organization_id")
      .eq("agente_slug", "escriba")
      .eq("ativo", false);
    const disabledOrgs = new Set((disabledRows ?? []).map((r) => r.organization_id));
    const leads = candidates.filter((l) => !disabledOrgs.has(l.organization_id));

    let processed = 0;
    let enriched = 0;

    for (const lead of leads) {
      // Marca como processado desde já (evita loop caso a análise falhe;
      // uma nova mensagem re-enfileira via trigger).
      const clearFlag = () =>
        supabase.from("leads").update({ precisa_enriquecer: false }).eq("id", lead.id);

      try {
        // Últimas mensagens reais (exclui logs de IA)
        const { data: msgs } = await supabase
          .from("mensagens")
          .select("conteudo, direcao, remetente, criado_em")
          .eq("lead_id", lead.id)
          .not("remetente", "eq", "ia")
          .order("criado_em", { ascending: false })
          .limit(MAX_MSGS);

        processed++;

        if (!msgs?.length) {
          await clearFlag();
          continue;
        }

        const transcript = msgs
          .reverse()
          .map((m) => {
            const quem = m.direcao === "entrada" || m.remetente === "lead" ? "LEAD" : "CLINICA";
            const texto = (m.conteudo || "").toString().slice(0, 500);
            return texto ? `${quem}: ${texto}` : null;
          })
          .filter(Boolean)
          .join("\n");

        if (!transcript.trim()) {
          await clearFlag();
          continue;
        }

        const extraido = await extrair(openrouterKey, transcript);

        const updates: Record<string, unknown> = {
          precisa_enriquecer: false,
          enriquecido_em: new Date().toISOString(),
        };
        if (extraido.resumo && extraido.resumo.trim()) updates.resumo = extraido.resumo.trim();
        if (Array.isArray(extraido.procedimentos) && extraido.procedimentos.length) {
          updates.procedimento_interesse = extraido.procedimentos
            .map((p) => (p || "").toString().trim())
            .filter(Boolean)
            .join(", ");
        }
        if (extraido.objetivo && extraido.objetivo.trim()) updates.objetivo = extraido.objetivo.trim();
        if (extraido.objecao && extraido.objecao.trim()) updates.objecao = extraido.objecao.trim();

        await supabase.from("leads").update(updates).eq("id", lead.id);
        enriched++;
      } catch (e) {
        console.error(`[athos-escriba] lead ${lead.id} falhou:`, e);
        await clearFlag(); // não trava a fila; próxima mensagem re-enfileira
      }
    }

    return json({ processed, enriched });
  } catch (e) {
    console.error("[athos-escriba] erro:", e);
    return json({ error: String(e) }, 500);
  }
});

// ── Chamada ao modelo (extração → JSON) ────────────────────────────
async function extrair(apiKey: string, transcript: string): Promise<Extraido> {
  const system =
    "Você é o Athos Escriba, analista de CRM de uma clínica de estética/harmonização facial. " +
    "Leia a conversa entre o LEAD e a CLINICA e extraia informações para a equipe comercial. " +
    "Responda SOMENTE com um JSON válido, sem markdown, no formato exato:\n" +
    '{"resumo": string, "procedimentos": string[], "objetivo": string, "objecao": string}\n' +
    "- resumo: markdown enxuto e escaneável em PT-BR, com rótulos em negrito, no máximo 4 linhas. " +
    "Use exatamente este formato (só as linhas que tiverem informação): " +
    "\"**Quem é:** ...\\n**Interesse:** ...\\n**Situação:** ...\\n**Próximo passo:** ...\". " +
    "Sem título, sem preâmbulo, sem parágrafo corrido.\n" +
    "- procedimentos: lista dos procedimentos de interesse citados (ex.: [\"Rinomodelação\",\"Preenchimento labial\"]). [] se nenhum.\n" +
    "- objetivo: resultado estético desejado em uma frase, ou \"\" se não souber.\n" +
    "- objecao: principal hesitação/objeção (preço, medo, tempo, indecisão...), ou \"\" se nenhuma.\n" +
    "Não invente dados que não estão na conversa.";

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Conversa:\n${transcript}` },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenRouter ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json();
  let content: string = data?.choices?.[0]?.message?.content ?? "";
  // Defensivo: remove cercas de código se o modelo devolver ```json
  content = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(content) as Extraido;
  } catch {
    return {};
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
