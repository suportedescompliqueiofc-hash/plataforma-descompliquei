-- Remove a feature "Cérebro Central" — não alimenta nenhum agente de IA em uso
-- (confirmado: nenhuma edge function ativa lê platform_cerebro). Athos GS agora
-- se baseia em dados reais do CRM (funil, leads, procedimentos) + base de
-- conhecimento comercial injetada no system prompt.
DROP TABLE IF EXISTS public.platform_cerebro CASCADE;
