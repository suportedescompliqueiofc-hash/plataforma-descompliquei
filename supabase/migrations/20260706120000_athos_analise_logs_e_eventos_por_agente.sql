-- Console Athos v2 — página por agente + atividade individual.
-- 1) Dá LOG próprio ao Athos Análise (analyze-non-leads não persistia nada).
-- 2) Estende get_athos_eventos: parâmetro opcional p_agente_slug (filtra 1 agente) e nova fonte Análise.

-- ── Tabela de atividade do Athos Análise ──────────────────────────────────────
create table if not exists public.analise_ia_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id         uuid,
  lead_nome       text,
  veredito        text not null,             -- 'nao_lead' | 'lead'
  motivo          text,
  confianca       text,                      -- 'alta' | 'media' | 'baixa'
  criado_em       timestamptz not null default now()
);

create index if not exists idx_analise_ia_logs_org_data
  on public.analise_ia_logs (organization_id, criado_em desc);

alter table public.analise_ia_logs enable row level security;

-- Leitura escopada por org (o insert vem do service role da edge function, que ignora RLS).
drop policy if exists analise_ia_logs_select_own_org on public.analise_ia_logs;
create policy analise_ia_logs_select_own_org on public.analise_ia_logs
  for select to authenticated
  using (organization_id in (select organization_id from public.perfis where id = auth.uid()));

-- ── get_athos_eventos v2 — filtro por agente + fonte Análise ──────────────────
-- Remove a versão antiga de 1 argumento para não deixar overload ambíguo.
drop function if exists public.get_athos_eventos(int);

create or replace function public.get_athos_eventos(
  p_limit int default 30,
  p_agente_slug text default null
)
returns table(
  agente_slug text,
  agente_nome text,
  lead_id     uuid,
  resumo      text,
  status      text,
  criado_em   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with org as (
    select organization_id as oid from perfis where id = auth.uid()
  )
  select agente_slug, agente_nome, lead_id, resumo, status, criado_em
  from (
    -- Athos Triagem
    select
      'triagem'::text as agente_slug,
      'Athos Triagem'::text as agente_nome,
      t.lead_id,
      (coalesce(t.lead_nome, 'Lead') || ' — ' ||
        case when t.decisao then 'IA ativada' else 'encaminhado a humano' end ||
        coalesce(': ' || t.motivo, ''))::text as resumo,
      (case when t.decisao then 'ativado' else 'humano' end)::text as status,
      t.created_at as criado_em
    from triage_ia_logs t
    join org on t.organization_id = org.oid

    union all

    -- Athos Follow-Up
    select
      'followup'::text,
      'Athos Follow-Up'::text,
      f.lead_id,
      ('Follow-up ' || coalesce(f.status, '') || coalesce(' — ' || f.motivo_ia, ''))::text,
      coalesce(f.status, '')::text,
      f.enviado_em
    from ia_followup_log f
    join org on f.organization_id = org.oid

    union all

    -- Athos Pré-Atendimento (ex-Recepção) — slug interno mantido 'recepcao'
    select
      'recepcao'::text,
      'Athos Pré-Atendimento'::text,
      a.lead_id,
      (coalesce(a.etapa, 'execução') || coalesce(' — ' || a.detalhe, ''))::text,
      coalesce(a.status, '')::text,
      a.criado_em
    from ai_execution_logs a
    join org on a.organization_id = org.oid

    union all

    -- Athos Análise
    select
      'analise'::text,
      'Athos Análise'::text,
      al.lead_id,
      (coalesce(al.lead_nome, 'Lead') || ' — ' ||
        case when al.veredito = 'nao_lead' then 'não é lead' else 'lead confirmado' end ||
        coalesce(': ' || al.motivo, ''))::text,
      coalesce(al.veredito, '')::text,
      al.criado_em
    from analise_ia_logs al
    join org on al.organization_id = org.oid
  ) eventos
  where p_agente_slug is null or eventos.agente_slug = p_agente_slug
  order by criado_em desc nulls last
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_athos_eventos(int, text) to authenticated;
