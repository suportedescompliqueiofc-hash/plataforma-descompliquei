// ensure-onboarding-jornada — clona o template PADRÃO de onboarding (14 dias) para o
// usuário logado, se ele ainda não tiver uma jornada de onboarding. Idempotente.
// Service role porque o RLS de jornadas só permite INSERT ao superadmin da master org.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ONBOARDING_TEMPLATE } from "../_shared/onboarding-template.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "Token inválido" }, 401);

  // Idempotente — se já existe jornada de onboarding, não recria.
  const { data: existing } = await supabase
    .from("jornadas").select("id").eq("user_id", user.id).eq("tipo", "onboarding").limit(1).maybeSingle();
  if (existing?.id) return json({ jornada_id: existing.id, created: false });

  // Org do usuário — a jornada pertence à CLÍNICA (visível a toda a org)
  const { data: perfil } = await supabase.from("perfis").select("organization_id").eq("id", user.id).maybeSingle();

  const t = ONBOARDING_TEMPLATE;
  const { data: jornada, error: jErr } = await supabase
    .from("jornadas")
    .insert({ user_id: user.id, organization_id: perfil?.organization_id ?? null, titulo: t.titulo, status: "ativa", gerada_por: "admin", tipo: "onboarding" })
    .select("id").single();
  if (jErr || !jornada) return json({ error: jErr?.message ?? "Erro ao criar jornada" }, 500);

  for (const [bi, bloco] of t.blocos.entries()) {
    const { data: est } = await supabase
      .from("jornada_estagios")
      .insert({ jornada_id: jornada.id, titulo: bloco.titulo, descricao: bloco.descricao ?? null, ordem: bi, prazo_dias: bloco.prazo_dias })
      .select("id").single();
    if (!est) continue;
    for (const [pi, passo] of bloco.passos.entries()) {
      const { data: p } = await supabase
        .from("jornada_passos")
        .insert({
          estagio_id: est.id,
          titulo: passo.titulo,
          conteudo_md: passo.conteudo_md,
          ordem: pi,
          tipo: passo.tipo,
          material_categoria: passo.material_categoria ?? null,
          material_brief: passo.material_brief ?? null,
          obrigatorio: passo.obrigatorio !== false,
        })
        .select("id").single();
      if (p && passo.subtarefas?.length) {
        await supabase.from("jornada_subtarefas").insert(
          passo.subtarefas.map((s, si) => ({ passo_id: p.id, titulo: s, ordem: si })),
        );
      }
    }
  }

  return json({ jornada_id: jornada.id, created: true });
});
