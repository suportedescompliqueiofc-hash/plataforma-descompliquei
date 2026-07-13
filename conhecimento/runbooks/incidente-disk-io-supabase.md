# Runbook — Supabase "Unhealthy" / Disk IO esgotado (NANO)

**Projeto:** Descompliquei Geral (`noncbgdczgcboronmcah`) · região `sa-east-1` · compute **NANO** (t4g.nano)
**Primeiro incidente:** 2026-07-07 — plataforma parou, login falhando, serviços Auth/PostgREST/Storage "Unhealthy".

## Causa raiz

Não foi sobrecarga de queries nem falta de RAM (cache hit 99%). Foi **esgotamento do Disk IO Budget** da instância NANO, causado por **3 tabelas de log/lixo** que cresciam sem purga:

| Tabela | Tamanho no incidente | Origem |
|--------|---------------------|--------|
| `cron.job_run_details` | 140 MB (0 linhas vivas, bloat) | pg_cron loga toda execução; 5 jobs disparando (1×/min + 4×/5min) |
| `public.debug_payloads` | 121 MB / 47k linhas | `receive-message` gravava o payload bruto de **toda** mensagem (linha 111) + lookup sem índice (linha 327) = 30k seq scans |
| `net._http_response` | 105 MB (0 linhas vivas, bloat) | pg_net acumula respostas dos `net.http_post` dos crons |

Total: ~366 MB de 538 MB eram lixo. Autovacuum girando nos bloats + seq scans + WAL de inserts constantes → saturou o burst de IO → reverteu para baseline (43 Mbps) → serviços caíram.

## Correção aplicada (2026-07-07)

1. `TRUNCATE cron.job_run_details` · `TRUNCATE net._http_response` · `TRUNCATE public.debug_payloads` → banco 538 MB → **171 MB**.
2. **Auto-purga via pg_cron** (nunca mais bloatar):
   - `purga-job-run-details` (jobid 14) — diária 04:17, mantém 2 dias
   - `purga-http-response` (jobid 15) — horária, mantém 1 hora
   - `purga-debug-payloads` (jobid 16) — diária 04:37, mantém 2 dias
3. **Índice** `idx_debug_payloads_adctx` em `(payload->>'type', payload->>'telefone', created_at DESC)` — elimina os 30k seq scans do lookup de anúncio.
4. **Código:** removida a escrita incondicional de `debug_payloads` em `receive-message/index.ts` (linha 111). **PENDENTE DEPLOY** — João deploya via CLI (`supabase functions deploy receive-message --project-ref noncbgdczgcboronmcah`). Até lá, a purga+índice seguram.

## Diagnóstico rápido (se repetir)

```sql
-- Tamanho do banco e maiores tabelas
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) t, n_live_tup, n_dead_tup, seq_scan
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 15;
-- Tabelas de sistema que bloatam
SELECT pg_size_pretty(pg_total_relation_size('cron.job_run_details'));
SELECT pg_size_pretty(pg_total_relation_size('net._http_response'));
```
Se o `get_project` retornar `ACTIVE_HEALTHY` mas o dashboard mostrar "Unhealthy" → é IO, não CPU/RAM. Ver "Disk IO Bandwidth" no dashboard.

## Prevenção definitiva

- **Deployar o fix do `receive-message`** (remove a escrita de todo payload).
- **Upgrade de compute:** NANO é subdimensionado para ~135k mensagens + 5 crons. Migrar para **MICRO ou SMALL** dá muito mais Disk IO baseline e elimina a fragilidade. Dashboard → Compute add-on.
- **Regra de ouro:** nenhuma tabela de log/debug sem (a) purga agendada e (b) índice nos campos consultados. Nunca gravar payload bruto de todo evento em produção.
- Rever `send-quick-message` (linha 142) — também grava em `debug_payloads` (baixo volume, mas idealmente remover).
