-- Console Athos (Fase 2) — renomeia o copiloto de onboarding para a marca Athos GS.
-- DML idempotente. `slug` NÃO muda (o edge function descompliquei-os depende dele).
-- Obs.: `platform_ia_config` (catálogo antigo do IAHub) NÃO é tocado — não são os agentes que
-- operam no CRM; são lidos apenas pelo ia-proxy legado.

update athos_agentes set nome = 'Athos GS — Onboarding' where slug = 'onboarding';
