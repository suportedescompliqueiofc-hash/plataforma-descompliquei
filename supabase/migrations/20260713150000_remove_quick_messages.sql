-- Remoção completa da feature "Mensagens Rápidas" (não fazia mais sentido na
-- sistemática atual: painel próprio, sequência por pasta e agendamento tinham
-- sobreposição com Cadências, e a ferramenta de IA "agendar_mensagem" nunca
-- funcionou de fato — inseria em uma coluna quick_message_id NOT NULL sem
-- preenchê-la).

-- 1. Remove a dependência de scheduled_quick_messages dentro da função de
--    blacklist permanente (senão ela passaria a falhar em runtime).
create or replace function public.blacklist_lead_permanently(
  p_lead_id uuid,
  p_reason text default 'Bloqueado manualmente pelo CRM.'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_lead record;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select id, organization_id, telefone
  into v_lead
  from public.leads
  where id = p_lead_id
    and organization_id = public.get_my_org_id();

  if not found then
    raise exception 'Lead não encontrado para esta organização.';
  end if;

  insert into public.lead_blacklist (
    organization_id,
    telefone,
    telefone_normalizado,
    motivo,
    blocked_by
  )
  values (
    v_lead.organization_id,
    v_lead.telefone,
    public.normalize_crm_phone(v_lead.telefone),
    p_reason,
    v_user_id
  )
  on conflict (organization_id, telefone_normalizado)
  do update set
    telefone = excluded.telefone,
    motivo = excluded.motivo,
    blocked_by = excluded.blocked_by,
    updated_at = now();

  delete from public.message_attachments
  where message_id in (
    select id from public.mensagens where lead_id = v_lead.id
  );

  delete from public.mensagens where lead_id = v_lead.id;
  delete from public.leads_tags where lead_id = v_lead.id;
  delete from public.lead_stage_history where lead_id = v_lead.id;
  delete from public.notificacoes where lead_id = v_lead.id;
  delete from public.vendas where lead_id = v_lead.id;
  delete from public.atividades where lead_id = v_lead.id;
  delete from public.lead_cadencias where lead_id = v_lead.id;
  delete from public.cadencia_logs where lead_id = v_lead.id;
  update public.ai_execution_logs set lead_id = null where lead_id = v_lead.id;

  delete from public.leads where id = v_lead.id;
end;
$$;

-- 2. Remove as tabelas da feature (ordem por dependência de FK).
DROP TABLE IF EXISTS public.scheduled_quick_messages CASCADE;
DROP TABLE IF EXISTS public.mensagens_rapidas CASCADE;
DROP TABLE IF EXISTS public.quick_message_folders CASCADE;
