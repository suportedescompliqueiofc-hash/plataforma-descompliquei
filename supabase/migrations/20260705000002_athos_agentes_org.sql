-- Console Athos (Fase 2 · Slice 2C) — liga/desliga de agentes por organização.
-- Um agente fica ATIVO por padrão; só é considerado desligado se houver uma linha ativo=false.
-- As edge functions dos agentes consultam `athos_agente_ativo(org, slug)` antes de rodar.

create table if not exists athos_agentes_org (
  organization_id uuid  not null,
  agente_slug     text  not null,
  ativo           boolean not null default true,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, agente_slug)
);

alter table athos_agentes_org enable row level security;

-- Membros da org leem os flags da própria org
drop policy if exists "athos_org_select" on athos_agentes_org;
create policy "athos_org_select" on athos_agentes_org
  for select using (
    organization_id = (select organization_id from perfis where id = auth.uid())
  );

-- Membros da org escrevem os flags da própria org
drop policy if exists "athos_org_write" on athos_agentes_org;
create policy "athos_org_write" on athos_agentes_org
  for all using (
    organization_id = (select organization_id from perfis where id = auth.uid())
  ) with check (
    organization_id = (select organization_id from perfis where id = auth.uid())
  );

-- Helper consultado pelas edge functions (SECURITY DEFINER — ignora RLS no backend).
-- Retorna TRUE por padrão; FALSE apenas quando explicitamente desativado.
create or replace function athos_agente_ativo(p_org uuid, p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select ativo from athos_agentes_org
      where organization_id = p_org and agente_slug = p_slug),
    true
  );
$$;
