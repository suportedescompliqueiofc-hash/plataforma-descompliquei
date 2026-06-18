import { supabase } from "@/integrations/supabase/client";

// Normaliza um objeto de jornada, tolerando chaves com/sem acento e variantes em inglês
function normalizarJornada(j: any): any | null {
  const titulo = j?.titulo ?? j?.["título"] ?? j?.title;
  const estagiosRaw = j?.estagios ?? j?.["estágios"] ?? j?.etapas ?? j?.stages;
  if (!titulo || !Array.isArray(estagiosRaw)) return null;

  const estagios = estagiosRaw.map((e: any, idx: number) => {
    const passosRaw = e?.passos ?? e?.steps ?? [];
    return {
      titulo: e.titulo ?? e["título"] ?? e.title ?? `Etapa ${idx + 1}`,
      descricao: e.descricao ?? e["descrição"] ?? e.description ?? null,
      ordem: e.ordem ?? e.order ?? idx,
      prazo_dias: e.prazo_dias ?? e.duracao_dias ?? 7,
      passos: (Array.isArray(passosRaw) ? passosRaw : []).map((p: any, pi: number) => ({
        titulo: p.titulo ?? p["título"] ?? p.title ?? `Passo ${pi + 1}`,
        descricao: p.descricao ?? p["descrição"] ?? p.description ?? null,
        ordem: p.ordem ?? p.order ?? pi,
        tipo: p.tipo ?? p.type ?? "acao_livre",
        ferramenta_slug: p.ferramenta_slug ?? p.tool_slug ?? null,
        prazo_dias: p.prazo_dias ?? null,
        obrigatorio: p.obrigatorio ?? p.required ?? true,
      })),
    };
  });

  return { titulo, estagios };
}

export function extrairJornadaOS(text: string): any | null {
  // Tenta bloco ```json``` primeiro (mais confiável)
  const bloco = text.match(/```json\s*([\s\S]+?)\s*```/);
  if (bloco) {
    try {
      const j = JSON.parse(bloco[1]);
      const norm = normalizarJornada(j);
      if (norm) return norm;
    } catch {}
  }
  // Fallback: encontra o maior objeto JSON no texto
  const bruto = text.match(/\{[\s\S]*\}/);
  if (bruto) {
    try {
      const j = JSON.parse(bruto[0]);
      const norm = normalizarJornada(j);
      if (norm) return norm;
    } catch {}
  }
  return null;
}

export async function salvarJornadaOS(json: any, userId: string): Promise<boolean> {
  try {
    const { data: ferramentas } = await (supabase as any)
      .from("arsenal_ferramentas")
      .select("id, slug")
      .eq("ativo", true);
    const slugMap = new Map<string, string>(
      (ferramentas ?? []).map((f: any) => [f.slug, f.id])
    );

    const { data: jornada, error: errJ } = await (supabase as any)
      .from("jornadas")
      .insert({ user_id: userId, titulo: json.titulo, status: "ativa", gerada_por: "ia" })
      .select("id")
      .single();
    if (errJ || !jornada) return false;

    const hoje = new Date();
    let cursorDias = 0;
    for (const est of json.estagios) {
      const dataInicio = new Date(hoje);
      dataInicio.setDate(dataInicio.getDate() + cursorDias);
      cursorDias += (est.prazo_dias ?? 7) + 1;

      const { data: estagio, error: errE } = await (supabase as any)
        .from("jornada_estagios")
        .insert({
          jornada_id: jornada.id,
          titulo: est.titulo,
          descricao: est.descricao ?? null,
          ordem: est.ordem ?? 0,
          prazo_dias: est.prazo_dias ?? 7,
          data_inicio: dataInicio.toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (errE || !estagio) continue;

      for (const passo of est.passos ?? []) {
        const ferramentaId =
          passo.tipo === "ferramenta_arsenal" && passo.ferramenta_slug
            ? (slugMap.get(passo.ferramenta_slug) ?? null)
            : null;
        await (supabase as any).from("jornada_passos").insert({
          estagio_id: estagio.id,
          titulo: passo.titulo,
          descricao: passo.descricao ?? null,
          ordem: passo.ordem ?? 0,
          tipo: passo.tipo ?? "acao_livre",
          ferramenta_id: ferramentaId,
          prazo_dias: passo.prazo_dias ?? null,
          obrigatorio: passo.obrigatorio ?? true,
        });
      }
    }
    return true;
  } catch {
    return false;
  }
}
