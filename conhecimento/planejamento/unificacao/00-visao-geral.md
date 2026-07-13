# Unificação da Plataforma — Visão Geral

> Planejamento estrutural da fusão CRM + Plataforma em um produto único, com materiais
> gerados por IA e todas as IAs centralizadas sob o Athos GS.
> Autor: Claude (Opus 4.8) · Data: 2026-07-05 · Solicitante: João Miguel

## Contexto e dor

Hoje o produto se comporta como **duas coisas separadas** — o CRM (`/crm/*`) e a Plataforma
(`/plataforma/*`) — apesar de rodarem no mesmo app React. O cliente fica "pulando" entre as
duas áreas (botões **Plataforma** ↔ **Acessar CRM** na sidebar), o que confunde e faz com que
ele não use o produto completo. Três problemas somados:

1. **Fragmentação de navegação** — dois menus, dois títulos de header, dois "modos" de sidebar
   (`isPlatformMode` / `isOutboundMode` em `SidebarContent.tsx`).
2. **Materiais por template não performam** — "Meus Materiais" (`Materiais.tsx` +
   `MateriaisEditor.tsx`) e as "Ferramentas" do Arsenal (`conteudo_json`) exigem que o cliente
   preencha template. Isso trava a adoção.
3. **IAs espalhadas e opacas** — 8 "IAs Comerciais" no `IAHub`, mais `/crm/ia` (`AiSettings`),
   mais `AdminIAs`, mais ~12 edge functions de IA. Ninguém entende o que cada uma faz, nem
   consegue acionar/ver logs de forma centralizada.

## Decisões travadas (respondidas por João em 2026-07-05)

| # | Tema | Decisão |
|---|------|---------|
| 1 | Navegação | **Menu único integrado.** Uma sidebar só, seções agrupadas por tema. Some o pula-pula. URLs `/crm` e `/plataforma` **continuam por baixo** (com redirects futuros), sem reescrever tudo agora. |
| 2 | Materiais | **Remover materiais E ferramentas do Arsenal.** Elimina "Meus Materiais" + toda a seção de Ferramentas do Arsenal. O **Athos** gera qualquer material/ferramenta do zero e guarda numa área nova unificada de saídas. |
| 3 | IAs | **Console único "Athos" com agentes nomeados.** Um hub que lista TODOS os agentes (prefixo `Athos …`), cada um com descrição, liga/desliga, logs, dados e config. Substitui `IAHub`, centraliza `AiSettings` e `AdminIAs`. |
| 4 | Entrega | **Plano + começar Fase 1.** Escrever este planejamento e já iniciar a fase menos arriscada (navegação unificada). |

## Princípios inegociáveis (herdados do CLAUDE.md)

- **Design System Premium obrigatório** — a estética premium da Plataforma deve permanecer ao
  trazer suas seções para o shell unificado. Nada de `Card` genérico do shadcn, sem emojis,
  laranja `#E85D24` só em CTA/acento, `bg-foreground text-background` em estado ativo.
- **Multi-tenant** — tudo scoped por `organization_id`. Nada vaza entre orgs.
- **Marketing/Scoring só na Descompliquei** — não surfacar Meta Ads/ROAS para clientes.
- **Tutoriais acompanham a UI** — qualquer elemento novo/removido atualiza `tutorialData.ts` e
  os atributos `data-tutorial`.
- **Deploy de edge functions** via MCP `deploy_edge_function` (CLI dá 403 neste ambiente).

## Reframe: plataforma única MODULAR por entitlements

Decisão adicional (2026-07-05): morre a ideia de "3 produtos fixos" (só-Plataforma / só-CRM /
ambos). Passa a existir **uma plataforma única onde cada produto libera um conjunto de áreas** —
e o **CRM vira só mais uma área** (liberável/bloqueável por produto). Granularidade **por
área/seção**; sub-páginas do CRM seguem moduladas por papel. Isso é a **espinha dorsal** que todas
as fases consomem — detalhado em `06-modelo-entitlements-produtos.md`. Boa parte já existe
(`platform_products`, objeto `acesso` no `PlataformaContext`, `AdminProdutos`).

## Backbone + 3 fases (ordem por risco crescente)

```
BACKBONE — Entitlements (produtos → áreas → acesso)   [parte existe; completar gate CRM]
FASE 1 — Navegação Unificada          [consome `acesso`; feito, falta gate CRM pós-auditoria]
FASE 2 — Console Athos + Agentes      [Athos/IAs é uma área entitled]
FASE 3 — Materiais via Athos          [DESTRUTIVO: remove templates/DB]   ← por último
```

Racional da ordem: o Backbone é a fundação (o `acesso` que a sidebar/guards leem). A Fase 1 não
toca banco (puro shell/sidebar, reversível por git). A Fase 2 introduz um registry de agentes e
agrega logs, sem apagar as IAs existentes. A Fase 3 é a única destrutiva — por último, depois que
o Athos já for o centro de tudo. **Atenção**: ligar o gate de CRM exige auditar `acesso_crm` de
todo tenant antes (senão `?? false` tranca clientes) — ver doc 06.

## Ordem de execução acordada (2026-07-05)

Ordenada por risco crescente, deixando o crítico/destrutivo para depois de validação:

```
✅ Backbone + Fase 1 + Fase 2 (2A/2B) + Athos Follow-Up on/off       [feito, seguro]
▶  B — Fase 3 ADITIVA: Athos Construtor + área de materiais gerados   [agora, sem remover nada]
⏳ A — Enforcement dos agentes de webhook (Recepção/Triagem/Análise)  [depois, COM teste QA]
⏳ Fase 3 DESTRUTIVA: remover templates + Ferramentas do Arsenal      [por último, após aprovação]
```

- **B primeiro** porque é 100% aditivo (nada é removido; risco zero ao sistema em produção).
- **A depois** porque toca `receive-message` (ingresso crítico de WhatsApp) — só com o fluxo de
  teste QA (`reference_edge_function_testing`) antes de qualquer deploy.
- **Fase 3 destrutiva por último**, e só quando o Athos Construtor provar qualidade + aprovação
  explícita (há FKs de `jornada_passos` para as tabelas do Arsenal — ver doc 03/05).

## Índice dos documentos

- `01-fase1-navegacao-unificada.md` — sidebar única, remoção do pula-pula, shell premium.
- `02-fase2-athos-console.md` — hub Athos, registry de agentes, on/off, logs.
- `03-fase3-materiais-athos.md` — remoção de templates + geração de material pelo Athos.
- `04-mapa-ias-agentes.md` — inventário das IAs → nomes `Athos …` → edge functions.
- `05-riscos-ordem-execucao.md` — riscos, dependências, checklist de rollback.
- `06-modelo-entitlements-produtos.md` — **ESPINHA DORSAL**: produtos → áreas → acesso.
