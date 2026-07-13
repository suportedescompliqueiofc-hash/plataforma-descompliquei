-- Jornada 2.0 — Consultoria dirigida pelo CS (Fase 0: schema)
-- Aditivo e não-destrutivo. Jornadas existentes (legado) permanecem válidas.
-- Plano: conhecimento/planejamento/jornada/00-plano-jornada-materiais.md

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. jornadas: tipo (onboarding | mensal) + período de referência da mensal
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.jornadas
  add column if not exists tipo        text,       -- 'onboarding' | 'mensal' | null (legado)
  add column if not exists periodo_ref date;        -- 1º dia do mês de referência (jornadas mensais)

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jornadas_tipo_check'
  ) then
    alter table public.jornadas
      add constraint jornadas_tipo_check
      check (tipo is null or tipo = any (array['onboarding'::text, 'mensal'::text]));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. jornada_passos: descrição rica, carry-over, vínculo a material do Athos
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.jornada_passos
  add column if not exists conteudo_md       text,   -- descrição rica (markdown, padrão dos materiais)
  add column if not exists origem_passo_id   uuid,   -- carry-over: tarefa de origem (mês anterior)
  add column if not exists material_categoria text,  -- taxonomia do material a produzir
  add column if not exists material_brief    text,   -- brief específico do material
  add column if not exists material_id       uuid;   -- material produzido (meus_materiais)

-- FKs (idempotentes)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jornada_passos_origem_passo_id_fkey') then
    alter table public.jornada_passos
      add constraint jornada_passos_origem_passo_id_fkey
      foreign key (origem_passo_id) references public.jornada_passos(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jornada_passos_material_id_fkey') then
    alter table public.jornada_passos
      add constraint jornada_passos_material_id_fkey
      foreign key (material_id) references public.meus_materiais(id) on delete set null;
  end if;
end $$;

-- Estende o CHECK de tipo para permitir 'material' (mantém legados)
alter table public.jornada_passos drop constraint if exists jornada_passos_tipo_check;
alter table public.jornada_passos
  add constraint jornada_passos_tipo_check
  check (tipo = any (array[
    'acao_livre'::text,
    'material'::text,
    'ferramenta_arsenal'::text,   -- legado
    'categoria_arsenal'::text     -- legado
  ]));

-- Soft-check da taxonomia de material (null quando não é passo de material)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jornada_passos_material_categoria_check') then
    alter table public.jornada_passos
      add constraint jornada_passos_material_categoria_check
      check (material_categoria is null or material_categoria = any (array[
        'script_atendimento'::text,
        'estrutura_processo'::text,
        'quebra_objecao'::text,
        'oferta'::text,
        'followup_reativacao'::text,
        'otimizacao_comercial'::text,
        'outro'::text
      ]));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. jornada_subtarefas: checklist leve dentro de uma tarefa
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.jornada_subtarefas (
  id            uuid primary key default gen_random_uuid(),
  passo_id      uuid not null references public.jornada_passos(id) on delete cascade,
  titulo        text not null,
  ordem         integer not null default 0,
  concluido     boolean not null default false,
  concluido_em  timestamptz,
  concluido_por uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_jornada_subtarefas_passo on public.jornada_subtarefas(passo_id);

alter table public.jornada_subtarefas enable row level security;

-- Superadmin da master org (onde o CS opera) faz tudo — espelha as políticas de jornada_passos
drop policy if exists superadmin_all_subtarefas on public.jornada_subtarefas;
create policy superadmin_all_subtarefas on public.jornada_subtarefas
  for all using (
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.organization_id = 'aa787cc8-787a-4774-bd80-ffbf78c0cf5f'::uuid
    )
  );

-- Cliente vê as subtarefas das suas jornadas
drop policy if exists users_select_own_subtarefas on public.jornada_subtarefas;
create policy users_select_own_subtarefas on public.jornada_subtarefas
  for select using (
    exists (
      select 1
      from public.jornada_passos pa
      join public.jornada_estagios e on e.id = pa.estagio_id
      join public.jornadas j on j.id = e.jornada_id
      where pa.id = jornada_subtarefas.passo_id
        and j.user_id = auth.uid()
    )
  );

-- Cliente marca/desmarca as próprias subtarefas
drop policy if exists users_update_own_subtarefas on public.jornada_subtarefas;
create policy users_update_own_subtarefas on public.jornada_subtarefas
  for update using (
    exists (
      select 1
      from public.jornada_passos pa
      join public.jornada_estagios e on e.id = pa.estagio_id
      join public.jornadas j on j.id = e.jornada_id
      where pa.id = jornada_subtarefas.passo_id
        and j.user_id = auth.uid()
    )
  );
