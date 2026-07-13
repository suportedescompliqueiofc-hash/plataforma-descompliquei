# Plano — Jornada 2.0: Consultoria Dirigida pelo CS

> Status: **planejamento** (nada implementado). Reformulação da Jornada personalizada pós-Grande
> Reformulação. Jornadas já existentes em produção **não serão tocadas/migradas** — modo legado.
>
> **Virada de eixo (2026-07-07):** a Jornada **deixa de ser auto-gerada pelo Athos GS do cliente**
> e passa a ser **consultoria dirigida pelo time de CS da Descompliquei**. O problema resolvido: a
> auto-geração (do início ao fim, de uma vez) tirava a **autonomia do CS** para gerenciar o que cada
> cliente precisa fazer. Agora o CS manda — com o **Athos CS** como copiloto de criação.

---

## 1. Reframe — a Jornada é a consultoria da Descompliquei

A página de Jornada vira **"o que a Descompliquei acredita que este cliente precisa fazer"** — um
plano de ação vivo, montado e curado pela nossa equipe, individualizado por cliente. Não é um
checklist genérico nem um artefato de onboarding: é o **instrumento de consultoria contínua**.

Duas camadas:

1. **Jornada de Onboarding (14 dias, PADRÃO, igual para todos).** Um template fixo que todo cliente
   novo recebe ao entrar. É o que *todo mundo* tem que fazer nas 2 primeiras semanas. Montado por nós,
   da melhor forma, alinhado a como a plataforma funciona. Conteúdo a definir junto (seção 12).

2. **Jornadas Mensais (por cliente, criadas pelo CS).** Todo mês o CS monta a jornada daquele cliente
   — um plano do que ele precisa **criar, estruturar, otimizar e ajustar** naquele período. Autonomia
   total do CS, com o **Athos CS** rascunhando e a equipe revisando/publicando.

**EVA continua sendo a filosofia** (Estruturar → Validar → Ajustar) — mas quem a aplica agora é o
**CS montando as jornadas** (auxiliado pelo Athos CS e pela mesma base de conhecimento comercial do
Athos GS), não a auto-geração pelo Athos do cliente.

---

## 2. Modelo de tarefa (o conteúdo da jornada)

Cada jornada é um plano de **tarefas**. Cada tarefa tem:

- **Título** curto.
- **Descrição rica e bem formatada** — no MESMO padrão de formatação dos **materiais** (markdown/
  rich), renderizada pelo mesmo renderer. Não é um label seco: é uma explicação de consultoria do
  que fazer e por quê. O Athos CS gera esse conteúdo.
- **Subtarefas** (opcionais, "se for necessário") — checklist leve dentro da tarefa. Sem estrutura
  abrupta: só quando ajuda.
- **Vínculo opcional a "construir material com o Athos GS"** — quando a tarefa é produzir um ativo
  comercial, ela deep-linka pro Athos GS do cliente (ver seção 6).
- **Estado de conclusão** — marcável pelo cliente, rastreável em %.

> Não impor rigidez: a jornada é um plano de consultoria, não um formulário. Tarefa + (subtarefas se
> precisar) + descrição rica. O peso está na qualidade da descrição, não na profundidade da árvore.

---

## 3. Mecânicas-chave

- **Sem locking sequencial rígido.** É um checklist de consultoria monitorável por %, não uma trilha
  travada. Tarefas podem ser feitas em qualquer ordem. (Locking do modelo antigo é **removido** para
  jornadas novas; legadas mantêm o comportamento delas.)
- **Carry-over de pendências.** O que **não for concluído** em um mês fica **pendente e é levado para
  o mês seguinte**. Ao rascunhar a jornada do mês N+1, o Athos CS **puxa automaticamente as tarefas
  não concluídas do mês N** como ponto de partida (o CS decide manter/ajustar/descartar). Rastreável
  via `origem_passo_id`.
- **Histórico sempre visível.** O cliente enxerga **todas** as jornadas (mês a mês), não só a atual.
- **Monitoramento.** CS/admin acompanha **% de execução por cliente** (e visão consolidada entre
  clientes) — para saber quem está executando e quem não está.
- **Individualização total.** Cada jornada mensal é montada com **todo o contexto do cliente**:
  jornadas anteriores, dados do CRM (funil, leads parados, conversas, objeções, ranking de
  procedimentos), materiais já construídos e o diagnóstico.

---

## 4. Athos CS — copiloto de criação (admin OS)

O **Athos CS** (edge `cs-athos`, console no Admin OS) passa a ser o motor que **auxilia 100%** o CS
a criar e individualizar a jornada mensal de cada cliente.

- **Rascunha → CS revisa/edita → publica.** O Athos CS gera um **rascunho** (`status='rascunho'`) da
  jornada mensal; **sempre passa pela revisão da equipe** antes de ir ao cliente. A equipe pode
  alterar tudo. Publicar = `status='ativa'`.
- **Puxa todo o contexto** do cliente (seção 3) para individualizar.
- **MESMA base de conhecimento comercial do Athos GS** — requisito crítico (seção 5).
- As jornadas individuais **ficam salvas e editáveis** para permitir a curadoria da equipe a
  qualquer momento.

Tanto o **Admin OS** quanto o **Athos CS** precisam ser adaptados para essa criação individualizada
por cliente (editor de jornada por cliente + copiloto de rascunho).

---

## 5. Base de conhecimento comercial compartilhada (CRÍTICO)

> Ênfase explícita do João: o **Athos CS precisa ter a MESMA base de conhecimento comercial que o
> Athos GS tem hoje.** O Athos GS tem uma base muito boa; o CS não pode ser inferior.

Hoje essa base é a constante **`COMMERCIAL_KNOWLEDGE_BASE`** em
`supabase/functions/descompliquei-os/index.ts` (~L3374) — cheat-sheet condensado de EVA, atendimento
consultivo, quebra de objeções, estrutura de oferta, follow-up/reativação e otimização comercial
(versão completa em `conhecimento/plataforma/athos-comercial/*.md` + `arsenal/metodologia-eva.md`).

**Plano:** extrair essa base (e o guidance de taxonomia de materiais) para um **módulo compartilhado**
— ex.: `supabase/functions/_shared/athos-comercial.ts` — importado por **ambas** as funções
(`descompliquei-os` = Athos GS e `cs-athos` = Athos CS). Fonte única, paridade garantida. Toda
evolução da base beneficia os dois Athos de uma vez.

---

## 6. Athos GS (cliente) — de "gerador de jornada" a consultor de execução

- **Sai do onboarding.** Não gera mais a jornada (nem via `criar_jornada`, nem via parsing de JSON no
  texto). Essas duas engrenagens são **removidas** (ver seção 10).
- **Vira consultor de execução.** Ajuda o cliente a **construir tudo** — entender, estruturar,
  produzir os materiais. É o consultor comercial que executa junto do cliente.
- **Fluxo "construir material" sobrevive e fica central:** uma tarefa da jornada do tipo `material`
  mostra **"Construir com o Athos GS"** → deep-link `/plataforma/os?passo=<id>&categoria=<cat>` →
  Athos GS ajuda a produzir o ativo (tool `criar_material`) → o **frontend** vincula o material criado
  de volta à tarefa (`material_id`) e a marca concluída (mecanismo determinístico, sem depender do LLM
  carregar id). Fallback: seletor "vincular material existente".

---

## 7. Modelo de dados

Migração **aditiva e não-destrutiva** (segura para jornadas legadas).

**`jornadas`:**
- `tipo text` — `'onboarding' | 'mensal'` (novas). Legadas ficam sem/legado.
- `periodo_ref date NULL` — mês de referência da jornada mensal (1º dia do mês). NULL no onboarding.
- `is_template boolean DEFAULT false` — marca o **template padrão de onboarding** (o canônico que é
  clonado para cada cliente novo; `user_id` NULL no template).
- Reusar `status` (`rascunho`/`ativa`/`concluida`) e `gerada_por` (`ia`/`admin` → rascunho do Athos CS
  = `ia`; curadoria/edição = `admin`).

**`jornada_passos` (tarefas):**
- `conteudo_md text NULL` — descrição rica formatada (padrão dos materiais). (`descricao` atual segue
  como resumo/plain; `conteudo_md` é o corpo renderizado.)
- `origem_passo_id uuid NULL` — tarefa de origem quando carregada de um mês anterior (carry-over).
- `material_categoria text NULL`, `material_brief text NULL`, `material_id uuid NULL REFERENCES
  meus_materiais(id) ON DELETE SET NULL` — para tarefas do tipo `material`.
- `tipo` estendido para permitir `'material'` (manter `'acao_livre'` + todos os legados no CHECK).

**`jornada_subtarefas` (nova):**
- `id`, `passo_id uuid REFERENCES jornada_passos(id) ON DELETE CASCADE`, `titulo text`,
  `concluido boolean DEFAULT false`, `concluido_em timestamptz NULL`, `concluido_por uuid NULL`,
  `ordem int`.

**`jornada_estagios`:** mantida como **agrupamento opcional** dentro de uma jornada (ex.: "Semana 1"/
"Semana 2" no onboarding; blocos temáticos no mês). Não obrigatória — uma jornada pode ser lista
plana de tarefas.

- Migração **staged**, não auto-aplicada (norma do repo: João aplica via CLI/MCP, com backup).

---

## 8. Onboarding padrão (14 dias)

- **Template canônico único** (`jornadas.is_template = true`, `tipo='onboarding'`, `user_id=null`),
  montado por nós.
- **Clonado automaticamente** para cada cliente novo ao entrar (instancia uma `jornadas` real com
  `tipo='onboarding'`, `user_id=<cliente>`, `status='ativa'`).
- **Substitui** a conversa de geração de jornada do Athos no onboarding atual. O **diagnóstico**
  (`onboarding_diagnosticos`) **permanece** como formulário — mas agora serve de **contexto para o CS
  / Athos CS** montar a primeira jornada mensal, não para o Athos gerar a jornada.
- Rewire da conclusão de onboarding: `onboarding_concluido` passa a ser marcado quando o diagnóstico é
  concluído + jornada de onboarding atribuída (não mais quando o Athos "gera a jornada").
- **Conteúdo dos 14 dias: a definir junto** (seção 12).

---

## 9. Visão do cliente (`Jornada.tsx` / `useJornada.ts`)

- **Página de consultoria, visual.** Tarefas como cards com descrição rica (renderer dos materiais),
  subtarefas (checklist), badge de %/progresso, estado concluído.
- **Seletor/histórico de jornadas:** jornada atual em destaque + acesso a todas as anteriores
  (mês a mês). `useJornada` deixa de retornar só a mais recente (limit 1) e passa a listar/selecionar.
- **`PassoRow` por tipo:**
  - `material` sem `material_id` → **"Construir com o Athos GS"** (deep-link).
  - `material` com `material_id` → **"Abrir material"**.
  - `acao_livre` → tarefa de consultoria (descrição rica + subtarefas + check).
  - legado → comportamento atual (sem mudança).
- Manter join `arsenal_aulas` só para exibir/abrir as poucas jornadas legadas (dependência zero).

---

## 10. O que MORRE do modelo antigo

- **Auto-geração pelo Athos GS:** a tool `criar_jornada` (client-facing) e o parsing de JSON no texto
  (`extrairJornadaOS`/`salvarJornadaOS` em `src/lib/jornadaUtils.ts` + o `useEffect` de detecção em
  `DescompliqueiOS.tsx`) são **removidos**. Geração de jornada agora é **CS + Athos CS** no admin.
- **Arco EVA como sequência auto-montada fixa:** vira **guidance/base de conhecimento** que o CS e o
  Athos CS usam para montar as jornadas — não um esqueleto que o sistema gera sozinho.
- **Locking sequencial rígido:** removido para jornadas novas (vira checklist + %).

---

## 11. Fases

- **Fase 0 — Schema (aditivo, seguro):** campos em `jornadas`/`jornada_passos` + tabela
  `jornada_subtarefas` + CHECK de `tipo`. Legadas intactas.
- **Fase 1 — Base comercial compartilhada:** extrair `COMMERCIAL_KNOWLEDGE_BASE` para
  `_shared/athos-comercial.ts`; `descompliquei-os` e `cs-athos` importam. (Destrava paridade do
  Athos CS.)
- **Fase 2 — Athos CS cria jornada (admin):** capacidade no `cs-athos` de rascunhar jornada mensal
  puxando contexto (jornadas anteriores + CRM + materiais + diagnóstico) e aplicando a base comercial;
  editor de jornada por cliente no Admin OS (rascunho → revisão → publicar).
- **Fase 3 — Visão do cliente:** render de consultoria (descrição rica + subtarefas + %), histórico,
  deep-link "Construir com o Athos GS" + auto-link.
- **Fase 4 — Onboarding padrão:** template de 14 dias + clonagem automática no cadastro + rewire do
  `onboarding_concluido`; remoção da geração via Athos no onboarding.
- **Fase 5 — Carry-over + monitoramento:** pendências rolando para o mês seguinte; painel de
  acompanhamento de execução (% por cliente) para o CS.
- **Fase 6 — Remoção do legado de geração:** apagar `criar_jornada` (Athos GS) + `jornadaUtils` +
  useEffect de parsing.

---

## 12. Definições recentes

- **Conteúdo da jornada de onboarding (14 dias): RASCUNHADO** →
  `conhecimento/planejamento/jornada/01-onboarding-14-dias.md`. **Onboarding = entendimento da
  arquitetura + ativação, SEM construção comercial** (nada de script/objeções/"fundação comercial"
  nas 2 primeiras semanas — isso é papel das mensais). 6 tarefas em 2 semanas: Semana 1 (kickoff CS +
  configurar CRM + método EVA); Semana 2 (conhecer a plataforma por dentro + ver o CRM funcionando +
  fechamento CS com entrega da 1ª jornada mensal). Refinamentos no próprio doc.
- **Diagnóstico no onboarding: CONFIRMADO permanecer** — serve de contexto para o CS/Athos CS montar
  a 1ª jornada mensal.
- **Cadência de criação mensal: CONFIRMADO** — haverá um **alerta/lembrete que provoca a equipe de
  CS** a criar a jornada mensal do cliente (criação manual com auxílio do Athos CS, disparada por
  lembrete — sem automação cega).

---

## 13. Decisões fechadas (com o João)

1. Jornada = **consultoria dirigida pelo CS**, não auto-geração pelo Athos GS.
2. Duas camadas: **onboarding padrão (14d, igual p/ todos)** + **mensais individuais (CS)**.
3. Tarefas com **descrição rica formatada como material** + **subtarefas opcionais**; sem rigidez.
4. **Sem locking rígido**; monitoramento por **% de execução**.
5. **Carry-over:** pendências vão para o mês seguinte.
6. **Histórico sempre visível** ao cliente (todas as jornadas).
7. **Athos CS** rascunha/revisa/publica, **sempre com revisão da equipe**; jornadas **salvas e
   editáveis**; individualização com **todo o contexto** (jornadas anteriores + CRM + materiais).
8. **Athos CS com a MESMA base de conhecimento comercial do Athos GS** (módulo compartilhado).
9. **Athos GS sai do onboarding** e vira **consultor de execução** (ajuda a construir os materiais).
10. Jornadas **existentes não são migradas** (legado read-only).

---

## 14. Arquivos afetados (mapa)

| Área | Arquivo | Mudança |
|------|---------|---------|
| Schema | `supabase/migrations/…jornada_cs.sql` (novo) | Fase 0 |
| Base comercial | `supabase/functions/_shared/athos-comercial.ts` (novo) ← extraído de `descompliquei-os/index.ts` | Fase 1 |
| Athos CS | `supabase/functions/cs-athos/*` | Fase 2 — tool de rascunho de jornada + import da base |
| Editor CS | Admin OS (`src/pages/admin-os/…`) + `src/hooks/useAdminJornadas.ts` + `AdminJornadaEditor.tsx` | Fase 2/5 — editor por cliente, subtarefas, monitoramento |
| Cliente | `src/hooks/useJornada.ts`, `src/pages/plataforma/Jornada.tsx` | Fase 3 — consultoria, histórico, deep-link |
| Onboarding | `Onboarding.tsx`, `useProfile.ts`/cadastro, `PlataformaContext` | Fase 4 — template 14d + clonagem + rewire |
| Remoção | `src/lib/jornadaUtils.ts`, `DescompliqueiOS.tsx`, tool `criar_jornada` em `descompliquei-os` | Fase 6 |
