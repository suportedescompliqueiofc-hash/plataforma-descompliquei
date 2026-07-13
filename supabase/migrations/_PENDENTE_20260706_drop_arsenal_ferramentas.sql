-- ============================================================================
-- FASE 3-B (DESTRUTIVA) — Remover Ferramentas do Arsenal + templates do banco
-- ============================================================================
-- ⚠️  NÃO RODAR AINDA. Renomear (tirar o prefixo `_PENDENTE_`) e executar SOMENTE
--     depois de cumprir os 2 pré-requisitos abaixo. Irreversível.
--
-- PRÉ-REQUISITO 1 — BACKUP (rodar e conferir ANTES):
--   As linhas `create table ..._bkp` abaixo já fazem um snapshot no próprio banco.
--   Alternativamente, exporte via dashboard as tabelas: arsenal_ferramentas,
--   arsenal_categorias, arsenal_templates, arsenal_construcoes, arsenal_materiais,
--   arsenal_progresso, e as colunas de meus_materiais/jornada_passos afetadas.
--
-- PRÉ-REQUISITO 2 — PATCH DO COPILOTO (deploy via CLI ANTES do drop):
--   `descompliquei-os/index.ts` (4028 linhas) usa as tabelas de arsenal. Editar e
--   `npx supabase functions deploy descompliquei-os --project-ref noncbgdczgcboronmcah`:
--     a) REMOVER as tools + handlers: `listar_arsenal`, `obter_arsenal_ferramenta`,
--        `salvar_construcao_ferramenta` (defs ~811/825/919 + cases ~2303/2317/2332/2410).
--     b) `criar_jornada` (~2669): remover `arsenal_ferramentas` do slugMap
--        (linha ~2672); manter só `arsenal_aulas`. Guardar `?? []` no `.map`.
--     c) `listar_meus_materiais` (~2346): remover os joins
--        `arsenal_categorias(nome, slug), arsenal_ferramentas(nome)` do select.
--     d) `arsenal_progresso` / `atualizar_progresso_arsenal` (~2401/2457): remover
--        se dependerem de arsenal_ferramentas.
--     e) Tool-filtering (~3617): tirar os nomes dessas tools das listas.
--   Só DEPOIS que o copiloto novo estiver ACTIVE, rodar este SQL.
-- ============================================================================

begin;

-- ── 1. BACKUP no próprio banco (snapshot) ──────────────────────────────────
create table if not exists arsenal_ferramentas_bkp as select * from arsenal_ferramentas;
create table if not exists arsenal_categorias_bkp  as select * from arsenal_categorias;
create table if not exists arsenal_templates_bkp   as select * from arsenal_templates;
create table if not exists arsenal_construcoes_bkp as select * from arsenal_construcoes;
create table if not exists arsenal_materiais_bkp   as select * from arsenal_materiais;
create table if not exists arsenal_progresso_bkp   as select * from arsenal_progresso;
-- snapshot das colunas FK que serão zeradas (para poder auditar depois)
create table if not exists jornada_passos_arsenal_bkp as
  select id, ferramenta_id, categoria_id from jornada_passos
  where ferramenta_id is not null or categoria_id is not null;
create table if not exists meus_materiais_arsenal_bkp as
  select id, categoria_arsenal_id, ferramenta_id from meus_materiais
  where categoria_arsenal_id is not null or ferramenta_id is not null;

-- ── 2. Zerar FKs nas tabelas que PERMANECEM (Jornada e Materiais) ──────────
update jornada_passos set ferramenta_id = null, categoria_id = null
  where ferramenta_id is not null or categoria_id is not null;
update meus_materiais set categoria_arsenal_id = null, ferramenta_id = null
  where categoria_arsenal_id is not null or ferramenta_id is not null;

-- ── 3. Dropar a família de tabelas de Arsenal-Ferramentas ──────────────────
--     (dependentes primeiro; CASCADE cobre FKs internas)
drop table if exists arsenal_templates    cascade;
drop table if exists arsenal_construcoes  cascade;
drop table if exists arsenal_materiais    cascade;
drop table if exists arsenal_progresso    cascade;
drop table if exists arsenal_ferramentas  cascade;
drop table if exists arsenal_categorias   cascade;

commit;

-- ── 4. Pós-drop (fora do escopo deste SQL) ─────────────────────────────────
--   • Remover a edge function `seed-templates` (via dashboard/CLI).
--   • Conferir advisors: `get_advisors` (RLS/segurança) após o drop.
--   • Quando validado, dropar as tabelas `*_bkp`.
--   • MANTIDO: arsenal_aulas, arsenal_aulas_progresso, arsenal_blocos (Aulas seguem vivas).
