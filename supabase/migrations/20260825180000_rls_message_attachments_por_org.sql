-- RLS de `message_attachments` deixa de varrer `mensagens` inteira.
--
-- Política anterior:
--   message_id IN (SELECT m.id FROM mensagens m JOIN leads l ON l.id = m.lead_id
--                  WHERE l.organization_id = get_my_org_id())
--
-- Para ler uma tabela de 113 linhas, o Postgres fazia Seq Scan nas ~250 mil
-- linhas de `mensagens` (Rows Removed by Filter: 227519) montando o conjunto de
-- ids permitidos. Medido como `authenticated` real: 1.351 ms — e o navegador
-- confirmou 1,30 s na aba Network. Isso acontecia a CADA abertura de conversa,
-- independente do tamanho dela: era o maior item isolado da tela de Conversas.
--
-- A tabela já tinha a coluna `organization_id`, mas 100% NULL (nunca preenchida).
-- Backfill feito; a política passa a filtrar por ela, direto e indexado.
--
-- SEGURANÇA — por que confiar na coluna é seguro aqui:
-- o trigger abaixo SEMPRE sobrescreve `organization_id` com o valor derivado da
-- mensagem, ignorando o que o cliente enviar. Sem isso, um cliente poderia
-- forjar o campo e a política passaria a mentir. Com ele, a coluna é um cache
-- do mesmo vínculo que a política antiga calculava a cada leitura.

-- 1. Trigger: organization_id é sempre derivado, nunca aceito do cliente.
create or replace function public.message_attachments_set_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select l.organization_id into new.organization_id
  from mensagens m
  join leads l on l.id = m.lead_id
  where m.id = new.message_id;
  return new;
end;
$$;

drop trigger if exists trg_message_attachments_set_org on public.message_attachments;
create trigger trg_message_attachments_set_org
  before insert or update of message_id on public.message_attachments
  for each row execute function public.message_attachments_set_org();

-- 2. Índices: o da política e o do filtro que o app usa (message_id IN (...)).
create index if not exists idx_message_attachments_org
  on public.message_attachments (organization_id);

create index if not exists idx_message_attachments_message
  on public.message_attachments (message_id);

-- 3. Política nova. `(select get_my_org_id())` vira InitPlan — avaliado uma vez
--    por query em vez de uma vez por linha.
drop policy if exists "Message Attachments Org" on public.message_attachments;

create policy "Message Attachments Org"
  on public.message_attachments
  for all
  using (organization_id = (select get_my_org_id()))
  with check (organization_id = (select get_my_org_id()));
