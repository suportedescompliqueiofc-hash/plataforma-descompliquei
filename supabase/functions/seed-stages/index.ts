import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const DEFAULT_STAGES = [
  { nome: 'Em Atendimento',       cor: '#f97316', posicao_ordem: 1, em_funil: false },
  { nome: 'Qualificação',         cor: '#3b82f6', posicao_ordem: 2, em_funil: false },
  { nome: 'Qualificado',          cor: '#8b5cf6', posicao_ordem: 3, em_funil: false },
  { nome: 'Handoff',              cor: '#a855f7', posicao_ordem: 4, em_funil: true  },
  { nome: 'Agendado',             cor: '#10b981', posicao_ordem: 5, em_funil: true  },
  { nome: 'Procedimento Fechado', cor: '#22c55e', posicao_ordem: 6, em_funil: true  },
];

async function seedStagesForOrg(supabaseClient: any, orgId: string) {
  const { data: currentStages, error: fetchError } = await supabaseClient
    .from('etapas')
    .select('*')
    .eq('organization_id', orgId)
    .order('posicao_ordem', { ascending: true });

  if (fetchError) throw fetchError;

  const existing = currentStages ?? [];
  const updates: Promise<any>[] = [];
  const inserts: any[] = [];

  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const target = DEFAULT_STAGES[i];
    if (i < existing.length) {
      updates.push(
        supabaseClient
          .from('etapas')
          .update({ nome: target.nome, cor: target.cor, posicao_ordem: target.posicao_ordem, em_funil: target.em_funil })
          .eq('id', existing[i].id)
      );
    } else {
      inserts.push({ ...target, organization_id: orgId });
    }
  }

  if (updates.length > 0) await Promise.all(updates);
  if (inserts.length > 0) {
    const { error: insertError } = await supabaseClient.from('etapas').insert(inserts);
    if (insertError) throw insertError;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const { orgId, seedAll } = body;

    // Org master da Descompliquei — isolada, não é cliente
    const MASTER_ORG_ID = 'aa787cc8-787a-4774-bd80-ffbf78c0cf5f';

    if (seedAll) {
      // Semear apenas organizações de CLIENTES (exclui a org master)
      const { data: orgs, error: orgsError } = await supabaseClient
        .from('organizations')
        .select('id')
        .neq('id', MASTER_ORG_ID);
      if (orgsError) throw orgsError;

      for (const org of orgs ?? []) {
        await seedStagesForOrg(supabaseClient, org.id);
      }

      return new Response(
        JSON.stringify({ success: true, message: `Etapas padronizadas para ${orgs?.length ?? 0} organizações.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!orgId) {
      throw new Error("ID da organização é obrigatório.");
    }

    await seedStagesForOrg(supabaseClient, orgId);

    return new Response(
      JSON.stringify({ success: true, message: "Etapas padronizadas com sucesso!" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Erro na função seed-stages:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
