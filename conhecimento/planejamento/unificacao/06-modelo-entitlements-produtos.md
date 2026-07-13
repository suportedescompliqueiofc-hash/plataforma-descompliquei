# Modelo de Entitlements — Produtos → Áreas → Acesso (ESPINHA DORSAL)

> **Reframe central (decidido por João em 2026-07-05):** não existem mais "3 produtos fixos"
> (só-Plataforma / só-CRM / ambos). Passa a existir **uma plataforma única modular**: cada
> **produto** libera um conjunto de **áreas**, e o **CRM é só mais uma área** (liberável ou
> bloqueável por produto). Este modelo é a espinha dorsal que a sidebar unificada (Fase 1), o
> console Athos (Fase 2) e os materiais (Fase 3) **consomem**.

## Decisões travadas

| # | Tema | Decisão |
|---|------|---------|
| E1 | Granularidade | **Por área/seção.** Produto libera blocos (CRM Comercial, Aprendizado, Athos/IAs, Marketing, Prospecção). Sub-páginas dentro do CRM continuam moduladas por **papel** (dono/atendente via `usePermissions`). |
| E2 | CRM | **CRM é entitlement.** `acesso_crm` vale de verdade — pode existir produto sem CRM. Sidebar/guards escondem a área CRM se o produto não incluir. |

## O que JÁ existe (fundação plantada)

- **`platform_products`** — colunas: `nome`, `descricao`, `preco_mensal`, `duracao_dias`,
  `pilares_liberados uuid[]`, `ias_liberadas text[]`, `acesso_cerebro`, `acesso_crm`,
  `acesso_sessoes_taticas`, `acesso_materiais`, `acesso_ia_comercial`, `max_leads`,
  `max_usuarios_crm`, `ativo`, `ordem_index`. (Estendida depois com `acesso_arsenal`.)
- **`platform_tenants.product_id`** (FK) + `access_starts_at` — vincula produto ao cliente.
- **`PlataformaContext`** resolve tudo num objeto `AcessoProduto` (flags booleanos + arrays) →
  `acesso`. `ACESSO_TOTAL` para superadmin.
- **Admin**: `AdminProdutos.tsx` (CRUD de produtos), `AdminGestaoAcessos.tsx`,
  `AdminAcessoCliente.tsx` (atribuir/override por cliente).

**Gap**: os flags existem mas (a) `acesso_os`/`acesso_arsenal` foram adicionados fora da criação
original — conferir consistência; (b) a sidebar do CRM ainda **não** respeita `acesso_crm` (usa só
papel); (c) o redirect de landing manda todo mundo pro `/crm`.

## Mapa canônico de ÁREAS → flags → páginas

| Área (bloco vendável) | Flag(s) resolvidas | Páginas / seções da sidebar |
|-----------------------|--------------------|------------------------------|
| **CRM Comercial** | `acesso_crm` | Painel, Performance, Conversas, Notificações, Leads, Agendamentos, Vendas, Procedimentos, Metas, Equipe, Evolução, Msgs Rápidas, Cadências, Configurações |
| **Athos / IAs** | `acesso_ia_comercial`, `ias_liberadas[]`, `acesso_os`, `acesso_cerebro` | Athos (console), Athos GS (copiloto), agentes liberados |
| **Aprendizado** | `acesso_arsenal`, `pilares_liberados[]`, `acesso_materiais`, `acesso_sessoes_taticas` | Trilha, Arsenal, Jornada, Materiais, Sessões Táticas, Clube One |
| **Marketing** | Descompliquei-only (org flag, não é produto vendável a clientes) | Tráfego, Criativos, Canvas |
| **Prospecção** | Descompliquei-only | Outbound |

> Sub-páginas do CRM continuam filtradas por `usePermissions` (papel). O produto decide se a
> **área CRM** aparece; o papel decide **quais páginas** do CRM dentro da área.

## Fluxo de resolução (single source of truth)

```
platform_tenants.product_id
        │
        ▼
platform_products (flags de área + pilares_liberados + ias_liberadas + limites)
        │  (+ overrides por cliente em AdminAcessoCliente, se houver)
        ▼
PlataformaContext → AcessoProduto (objeto `acesso`)
        │
        ├──► SidebarContent  (mostra/esconde ÁREAS por flag)   ← Fase 1
        ├──► AcessoGuard / route guards (bloqueia rota por flag)
        ├──► RootRedirect / getRedirectDestino (landing conforme áreas)
        └──► Athos console / Materiais (Fase 2/3 consomem o mesmo objeto)
```

## Mudanças necessárias para realizar o modelo

### Banco / dados
- Garantir que **todos** os flags de área existam em `platform_products` (incluir `acesso_os`,
  `acesso_arsenal` se faltarem) e que os produtos atuais estejam com os flags corretos.
- **Auditoria obrigatória antes de "ligar" o gate de CRM**: verificar `acesso_crm` de cada
  tenant. Como o `PlataformaContext` faz `acessoData.acesso_crm ?? false`, um tenant sem a coluna
  preenchida **perderia o CRM**. Rodar `execute_sql` para conferir/preencher antes de flipar.

### Frontend
- **SidebarContent**: envolver a **área CRM** (Visão Geral, Comercial, Automação, Configurações)
  num gate `acesso.acesso_crm` — hoje ela aparece só por papel. (Fazer junto da auditoria acima.)
- **RootRedirect / `getRedirectDestino`**: se `!acesso_crm`, mandar para a home da área liberada
  (ex: `/plataforma` ou primeira área disponível), não `/crm`.
- **AcessoGuard**: cobrir também as rotas do CRM por `acesso_crm`.

### Admin (gestão de produtos)
- `AdminProdutos.tsx`: editor de produto expressa **áreas** (toggles por bloco) em vez de flags
  soltos — UX "monte o produto ligando áreas". Mantém pilares/IAs granulares dentro de Aprendizado
  e Athos.
- `AdminAcessoCliente.tsx`: atribui produto ao cliente + permite override pontual por área.
- Limites (`max_leads`, `max_usuarios_crm`) fazem parte do produto — sinalizar enforcement
  (fora do escopo visual, mas mapear onde é checado).

## Reposicionamento das fases

```
BACKBONE (Entitlements)  ← este doc. Fundação que todas as fases consomem.
   ├─ parte já existe (platform_products, acesso, AdminProdutos)
   └─ completar: gate de CRM na sidebar + redirect + auditoria de dados

FASE 1  Navegação unificada  → CONSOME o objeto `acesso` (feito; falta o gate de CRM pós-auditoria)
FASE 2  Console Athos        → Athos/IAs é uma ÁREA entitled
FASE 3  Materiais via Athos  → dentro da área Aprendizado/Athos
```

## Progresso (2026-07-05)

- Fonte de verdade confirmada: `acesso` vem da RPC **`get_my_platform_access`** (`{ tenant, acesso }`)
  no `PlataformaContext`. Superadmin recebe `ACESSO_TOTAL`.
- Auditoria executada (`execute_sql`): **12 tenants, 0 sem produto, 12 com `acesso_crm=true`, 0
  nulos** → ligar o gate de CRM é seguro (ninguém perde CRM hoje).
- **Gate de CRM implementado** em `SidebarContent.tsx`: `temCrm = plataformaLoading ||
  acesso.acesso_crm` gateia as áreas Visão Geral, Comercial, Automação, Marketing/Prospecção,
  Inteligência(Athos /crm/ia) e Configurações — com separadores dentro dos spreads condicionais
  (sem cabeçalhos órfãos).
- `getRedirectDestino` **já** trata não-CRM (nunca manda pra `/crm` sem `acesso_crm`) → sem
  mudança necessária agora.

## Critério de pronto (Backbone)

- [x] Auditoria de `acesso_crm` por tenant concluída (ninguém perde CRM por engano).
- [x] Sidebar esconde a área CRM quando `!acesso_crm`.
- [x] Redirect de landing respeita as áreas liberadas (lógica atual já cobre).
- [x] Superadmin (`ACESSO_TOTAL`) e impersonação intactos (sem alteração nesses caminhos).
- [x] `AdminProdutos` monta produto por áreas — já funcional (toggles CRM · Arsenal · Athos GS ·
  Sessões · Materiais em `FUNCIONALIDADES`, mapeados aos flags de `acesso`). Linguagem alinhada a
  "Áreas da plataforma" (2026-07-05).
- [ ] `platform_products` com todos os flags de área consistentes (conferir `acesso_os`/`acesso_arsenal`).
- [ ] AcessoGuard cobrir rotas do CRM por `acesso_crm` (defesa em profundidade). *(follow-up)*
