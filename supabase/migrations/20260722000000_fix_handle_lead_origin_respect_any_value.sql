-- Bug: ao criar um lead manualmente escolhendo uma origem diferente de
-- 'marketing'/'organico' (ex: reativacao, paciente, convenio), a trigger
-- trg_set_lead_origin sobrescrevia para 'organico' na criação. Só corrigia
-- depois de um UPDATE (que não passa por essa trigger de INSERT).
--
-- Causa: handle_lead_origin() só respeitava NEW.origem quando era
-- exatamente 'marketing' ou 'organico'. Qualquer outro valor caía na lógica
-- legada de auto-detecção (criativo_id / fonte com facebook|instagram|ads),
-- que força 'organico' como fallback.
--
-- Fix: respeitar qualquer origem explicitamente enviada (NOT NULL) e só
-- aplicar a auto-detecção legada quando origem vier NULL. Todos os pontos
-- de criação de lead no backend (receive-message, meta-lead-webhook,
-- descompliquei-os/admin-os) já enviam um valor explícito, então nada muda
-- para eles.

CREATE OR REPLACE FUNCTION public.handle_lead_origin()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Se a origem já vier preenchida (ex: CRM manual, Edge Function, Athos), respeita o valor
  -- escolhido explicitamente, seja qual for (marketing, organico, reativacao, paciente, convenio...).
  IF NEW.origem IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Lógica legada de auto-detecção — só roda quando ninguém informou a origem.
  IF NEW.criativo_id IS NOT NULL OR NEW.fonte ILIKE '%facebook%' OR NEW.fonte ILIKE '%instagram%' OR NEW.fonte ILIKE '%ads%' THEN
    NEW.origem := 'marketing';
  ELSE
    NEW.origem := 'organico';
  END IF;

  RETURN NEW;
END;
$function$;
