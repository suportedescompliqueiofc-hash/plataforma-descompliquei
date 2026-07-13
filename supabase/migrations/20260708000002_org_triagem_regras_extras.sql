-- Regras extras de triagem por organização (Athos Triagem).
-- Permite customizar, por clínica, casos específicos de ativação/não-ativação da IA
-- sem alterar o prompt global usado por todas as orgs.
alter table organizations
  add column if not exists triagem_regras_extras text;

comment on column organizations.triagem_regras_extras is
  'Instruções adicionais injetadas com prioridade no prompt do triage-lead-ia para esta organização específica.';
