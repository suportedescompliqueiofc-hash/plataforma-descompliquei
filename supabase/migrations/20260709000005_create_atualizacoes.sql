-- Sistema de Atualizações da Plataforma ("O que há de novo")
-- Changelog global (não multi-tenant); segmentação por área é resolvida no client
-- comparando atualizacoes.areas contra as flags de acesso da organização.

create table public.atualizacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,
  categoria text not null default 'novidade' check (categoria in ('novidade','melhoria','correcao')),
  areas text[] not null default '{}',
  rota_destino text,
  tutorial_alvo text,
  publicado boolean not null default false,
  publicado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.atualizacoes enable row level security;

create policy "atualizacoes_select" on public.atualizacoes
  for select using (
    publicado = true
    or exists (select 1 from usuarios_papeis where usuario_id = auth.uid() and papel = 'superadmin')
  );

create policy "atualizacoes_write_superadmin" on public.atualizacoes
  for all using (
    exists (select 1 from usuarios_papeis where usuario_id = auth.uid() and papel = 'superadmin')
  ) with check (
    exists (select 1 from usuarios_papeis where usuario_id = auth.uid() and papel = 'superadmin')
  );

create index idx_atualizacoes_publicado_em on public.atualizacoes (publicado, publicado_em desc);

-- Watermark por usuário: default now() para que usuários existentes não recebam
-- popup de itens antigos assim que a coluna é criada — só o que for publicado
-- a partir de agora conta como "não visto".
alter table public.perfis add column if not exists last_seen_atualizacao_em timestamptz not null default now();
