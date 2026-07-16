-- ─── Remoção do Clube One (feature descontinuada) ────────────────────────────

SELECT cron.unschedule('clube-one-rebaixar-nivel')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clube-one-rebaixar-nivel');

DROP TRIGGER IF EXISTS trg_recalcular_pontos ON clube_registros;

DROP FUNCTION IF EXISTS fn_recalcular_pontos_membro();
DROP FUNCTION IF EXISTS fn_rebaixar_nivel_inativo();

DROP TABLE IF EXISTS clube_registros;
DROP TABLE IF EXISTS clube_membros;
DROP TABLE IF EXISTS clube_atividades;
DROP TABLE IF EXISTS clube_niveis;
