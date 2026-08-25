-- Leads que já receberam mensagem do bot, resolvido no banco.
--
-- Antes: o client paginava `mensagens` em blocos de 1000 (`while(true)`) só para
-- montar um Set de lead_ids distintos. Na maior organização isso são 311.768
-- linhas transferidas em ~312 requisições HTTP sequenciais — para produzir um
-- conjunto que tem no máximo 9.378 elementos (o total de leads da org).
-- Dois call sites faziam isso: ConversationsList.tsx (filtro "atendido pela IA")
-- e useDashboard.ts (fetchAllBotLeadIds).
--
-- SECURITY INVOKER de propósito: a policy "Mensagens Org" continua valendo, então
-- o isolamento entre organizações é o mesmo de antes — inclusive sob impersonation,
-- porque get_my_org_id() lê perfis.organization_id, que o impersonate atualiza.
-- Não há motivo legítimo para contornar RLS aqui.
--
-- p_automatica: NULL = todas as mensagens do bot (comportamento do ConversationsList);
-- false = exclui confirmação/lembrete de agendamento (comportamento do Dashboard).
-- Os dois call sites divergem hoje; o parâmetro preserva cada um como está em vez
-- de unificar a semântica por conta própria.

create or replace function public.get_bot_lead_ids(
  p_org_id uuid,
  p_automatica boolean default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select distinct m.lead_id
  from public.mensagens m
  where m.organization_id = p_org_id
    and m.remetente = 'bot'
    and m.lead_id is not null
    and (p_automatica is null or m.automatica = p_automatica);
$$;

comment on function public.get_bot_lead_ids(uuid, boolean) is
  'IDs distintos de leads com mensagem do bot na org. Substitui a paginação '
  'linha a linha de `mensagens` no client. p_automatica NULL = todas.';

grant execute on function public.get_bot_lead_ids(uuid, boolean) to authenticated;
