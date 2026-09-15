-- IA de reativação: um segundo prompt/modelo dentro da mesma organização,
-- usado só para leads com uma tag específica (ex: "Modelo" na Dra. Carollina
-- Borges, para fechar a reativação do Pink Class). Aditivo, não mexe em nada
-- que já funciona: se ativo_reativacao = false ou a tag não bater, o
-- whatsapp-ai-agent segue usando o prompt padrão da organização.

alter table public.organization_ai_prompts
  add column if not exists prompt_reativacao text,
  add column if not exists modelo_ia_reativacao text,
  add column if not exists tag_reativacao_id uuid references public.tags(id) on delete set null,
  add column if not exists ativo_reativacao boolean not null default false;

comment on column public.organization_ai_prompts.prompt_reativacao is
  'Prompt alternativo de vendas/fechamento, usado só para leads com a tag em tag_reativacao_id. Ex: reativação de paciente modelo.';
comment on column public.organization_ai_prompts.modelo_ia_reativacao is
  'Modelo de IA (ex: deepseek) usado junto com prompt_reativacao. Se vazio, cai no modelo_ia padrão da org.';
comment on column public.organization_ai_prompts.tag_reativacao_id is
  'Etiqueta (tags.id) que aciona o prompt_reativacao em vez do prompt padrão.';
comment on column public.organization_ai_prompts.ativo_reativacao is
  'Liga/desliga o roteamento por tag. false = comportamento antigo, sempre usa o prompt padrão.';
