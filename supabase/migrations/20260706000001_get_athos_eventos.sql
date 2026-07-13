-- Console Athos — feed unificado "o que cada agente fez" (atividade recente por org).
-- Une os logs próprios de cada agente (Triagem, Follow-Up, Recepção) numa forma comum.
-- SECURITY DEFINER: deriva a org do auth.uid() (o cliente NÃO pode passar outra org).

create or replace function get_athos_eventos(p_limit int default 30)
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

    -- Athos Recepção
    select
      'recepcao'::text,
      'Athos Recepção'::text,
      a.lead_id,
      (coalesce(a.etapa, 'execução') || coalesce(' — ' || a.detalhe, ''))::text,
      coalesce(a.status, '')::text,
      a.criado_em
    from ai_execution_logs a
    join org on a.organization_id = org.oid
  ) eventos
  order by criado_em desc nulls last
  limit greatest(p_limit, 1);
$$;

grant execute on function get_athos_eventos(int) to authenticated;
