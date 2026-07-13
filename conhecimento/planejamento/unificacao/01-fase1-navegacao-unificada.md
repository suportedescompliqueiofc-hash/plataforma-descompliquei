# Fase 1 — Navegação Unificada (CRM + Plataforma em um menu só)

> Objetivo: acabar com a sensação de "dois produtos". Uma sidebar única, agrupada por tema,
> sem o pula-pula **Plataforma** ↔ **Acessar CRM**. URLs mantidas por baixo.

## Estado atual (o que existe hoje)

- `src/App.tsx` — `AppLayout`/`AppLayoutRoute` já é **compartilhado** por `/crm/*`, `/plataforma/*`
  e `/outbound/*`. A separação é lógica, não física.
- `src/components/layout/SidebarContent.tsx` — tem **3 menus** selecionados por modo:
  - `crmMenuItems` (mostrado por padrão) — inclui item **"Plataforma"** (`/plataforma`).
  - `platformMenuItems` (`isPlatformMode`) — inclui **"Acessar CRM"** (`/crm`, abre em nova aba).
  - `outboundMenuItems` (`isOutboundMode`) — inclui **"Voltar ao CRM"**.
  - Header muda título: `Hub de Gestão` (plataforma) / `Prospecção Ativa` (outbound) / brand (CRM).
- Guards: `CrmGuard`, `PlataformaGuard`, `OnboardingGuard`, `AcessoGuard` (por `accessKey`/`arrayKey`).
- Acesso da plataforma vem de `usePlataforma()` → `acesso` (chaves: `acesso_materiais`,
  `acesso_ia_comercial`, `acesso_sessoes_taticas`, `acesso_os`, `acesso_crm`, `pilares_liberados`,
  `ias_liberadas`, etc.) e `plan` (`pca`/`gca`).
- Permissões do CRM vêm de `usePermissions()` (`PageKey` + `canAccess`).

## Alvo (menu único integrado)

Uma única lista de itens, agrupada por seções temáticas, com visibilidade condicional combinando
**permissões do CRM** (`usePermissions`) **e** **acessos da plataforma** (`usePlataforma().acesso`).
Some o botão "Plataforma" e o "Acessar CRM". O Outbound permanece como sub-workspace da
Descompliquei (mantém "Voltar", pois é um contexto operacional distinto de prospecção ativa).

### Agrupamento proposto da sidebar única

```
── VISÃO GERAL
   Painel · Performance · Conversas · Notificações
── COMERCIAL
   Leads · Agendamentos · Vendas · Procedimentos · Metas · Equipe · Evolução
── ATHOS (IA)                                   [entra de fato na Fase 2]
   Athos (console) · [agentes conforme plano]
── APRENDIZADO                                  [ex-Plataforma]
   Trilha · Arsenal · Jornada · Sessões Táticas · Clube One
── AUTOMAÇÃO
   Msgs Rápidas · Cadências
── MARKETING            (Descompliquei only)
   Tráfego · Criativos · Canvas
── PROSPECÇÃO           (Descompliquei only)
   Outbound
── SISTEMA
   Configurações · Super Admin CRM (superadmin) · Super Admin (superadmin)
```

> Na Fase 1, a seção **ATHOS (IA)** ainda aponta para o `/crm/ia` atual e o chat
> `/plataforma/athos-gs`; a consolidação real acontece na Fase 2. **Meus Materiais** e
> **Ferramentas do Arsenal** ainda aparecem — só saem na Fase 3.

### Visibilidade por item

Cada item ganha um resolvedor único de visibilidade que entende as duas fontes:
- Itens CRM → `PATH_PERMISSION_MAP` + `usePermissions().canAccess`.
- Itens Plataforma → `acesso[accessKey]` / `acesso.pilares_liberados.length` / `plan`.
- Membros de equipe (`isMember`) → só veem CRM (regra atual preservada; seções de Aprendizado
  ficam ocultas para membros).

## Mudanças de arquivo (Fase 1)

| Arquivo | Mudança |
|---------|---------|
| `SidebarContent.tsx` | Fundir `crmMenuItems` + `platformMenuItems` numa lista única `unifiedMenuItems` com seções. Remover itens "Plataforma" e "Acessar CRM". Unificar o filtro de visibilidade (CRM perms + plataforma acesso). Manter `outboundMenuItems` como sub-modo. Header: título único (brand) exceto no Outbound. |
| `App.tsx` (`AppLayout`) | Header/title deixa de depender de `isPlataformaRoute` para o "modo plataforma". Banner de expiração de acesso pode continuar em rotas de plataforma. `waDisconnected` continua oculto em rota de plataforma (mensageria é CRM). |
| `tutorialData.ts` + `tutorialTargetMap` | Atualizar `data-tutorial` dos itens realocados. Ajustar `platform-tour` para a sidebar unificada. |
| Redirects | Adicionar redirect de conveniência: manter `/plataforma` funcional, mas o "Hub" da plataforma passa a ser uma seção do menu, não um destino de "troca de app". |

## Regras de não-regressão

- **Não** quebrar impersonação: `handleBackToMaster`, `original_master_org_id`, banner de
  impersonação continuam idênticos.
- **Não** alterar guards de acesso/onboarding nesta fase — só a apresentação do menu.
- Preservar `isConversationsPage` (full-bleed) para `/crm/conversas`, `/outbound/conversas` e
  `/plataforma/athos-gs`.
- Preservar o footer de configurações da plataforma (`/plataforma/configuracoes`) — vira item
  de Sistema ou mantém no footer.

## Critério de pronto (Fase 1)

- [ ] Uma sidebar só; nenhum botão "Plataforma"/"Acessar CRM".
- [ ] Cliente com acesso a Trilha/Arsenal/Jornada vê essas seções no mesmo menu do CRM.
- [ ] Membro de equipe continua vendo só o CRM.
- [ ] Superadmin e impersonação intactos.
- [ ] `npm run build` e `npm run lint` limpos.
- [ ] Tutoriais não ficam "perdidos" (targets existem).
