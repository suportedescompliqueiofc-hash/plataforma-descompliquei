# Fase 2 — Console Athos + Agentes Centralizados

> Objetivo: um lugar só onde o cliente/admin entende, aciona, liga/desliga, e vê logs e dados de
> **todas** as IAs. O Athos GS é o cérebro; as demais viram **agentes** nomeados `Athos …`.
> Depende da Fase 1 (seção "Athos" já existe no menu unificado).

## Dependências

- Fase 1 concluída (menu único com a seção **ATHOS**).
- `04-mapa-ias-agentes.md` — nomes e mapeamento das edge functions.

## Peças a construir

### 1. Registry de agentes (dados)

Reaproveitar/estender `athos_agentes`:

```
athos_agentes (
  id, slug, nome, descricao, system_prompt, ativo,
  + categoria      text     -- 'atendimento' | 'comercial' | 'marketing' | 'analise' | 'cs' | 'nucleo'
  + escopo         text     -- 'crm' | 'plataforma' | 'admin'
  + edge_function  text     -- função que executa o agente (nullable p/ núcleo)
  + icone          text     -- nome do ícone lucide
  + plano_min      text     -- null | 'pca' | 'gca'
  + ordem_index    int
)
```

Estado on/off **por org** (um agente pode estar ligado numa org e desligado noutra):

```
athos_agentes_org (
  organization_id, agente_slug, ativo bool, config jsonb,
  PK (organization_id, agente_slug)
)
```

### 2. Log unificado (opcional, incremental)

Muitos agentes já logam em tabelas próprias (`mensagens`, `cadencia_logs`, `lead_stage_history`,
`os_conversations`). Para o console, criar uma **view/append de eventos**:

```
athos_agente_eventos (
  id, organization_id, agente_slug, tipo, resumo, payload jsonb, criado_em
)
```

Cada edge function de agente passa a inserir um evento leve aqui (fire-and-forget). Isso dá um
feed único de "o que a IA fez" sem varrer N tabelas. Adotar de forma incremental (começar pelos
agentes com mais volume: Recepção, Follow-Up).

### 3. UI — Console Athos (`/plataforma/athos` ou `/crm/athos`)

Página premium (padrão do Design System) com:
- **Header**: "Athos" + subtítulo "A inteligência da sua operação".
- **Lista de agentes** (cards premium): nome, descrição, badge de categoria, switch on/off,
  indicador de atividade (último evento), CTA "Ver detalhes".
- **Detalhe do agente**: o que faz, config, últimos eventos/logs, métricas.
- **Abas do console**: `Agentes` · `Cérebro` (ex-`Cerebro.tsx`) · `Copiloto` (chat `descompliquei-os`)
  · `Configuração do Sistema` (superadmin → `super-admin-system-ai-config`).

### 4. Consolidação das telas atuais

| Tela hoje | Destino |
|-----------|---------|
| `IAHub.tsx` (8 IAs comerciais) | Substituída pela lista de agentes do console. |
| `IATipo.tsx` (detalhe de IA) | Vira o "detalhe do agente". |
| `AiSettings.tsx` (`/crm/ia`) | Config do **Athos Recepção** dentro do console (aba de atendimento). |
| `AdminIAs` (`/admin/ias`) | Visão superadmin do registry (CRUD de agentes globais). |
| `Cerebro.tsx` | Aba **Cérebro** do console. |
| `DescompliqueiOS.tsx` (`/plataforma/athos-gs`) | Aba **Copiloto** do console (mantém rota). |

### 5. Renomeação (marca Athos)

Aplicar os nomes de `04-mapa-ias-agentes.md` em: labels de UI, `athos_agentes.nome`, tutoriais,
e textos. **Não** renomear slugs de edge function (quebraria webhooks/crons) — só o nome exibido.

## Mudanças de arquivo (resumo)

- **Migrations**: alterar `athos_agentes` (colunas novas), criar `athos_agentes_org`, criar
  `athos_agente_eventos`. Seed dos agentes do mapa.
- **Novo**: `src/pages/plataforma/AthosConsole.tsx` + `useAthosAgentes.ts` (hooks TanStack Query).
- **Editar**: edge functions dos agentes → inserir evento em `athos_agente_eventos` + respeitar
  `athos_agentes_org.ativo`.
- **Editar**: `SidebarContent.tsx` — seção ATHOS aponta para o console.
- **Remover** (depois de migrar): `IAHub.tsx`, `IATipo.tsx` (absorvidos).
- **Tutoriais**: novo tutorial `athos` (console) + atualizar `platform-cerebro`.

## Descoberta (2026-07-05): são TRÊS registries, não um

Ao inspecionar o banco, a IA da plataforma está espalhada em três lugares distintos:

1. **`athos_agentes`** (2 linhas: `onboarding`, `arsenal-copiloto`) → copilotos, usados pelo
   `descompliquei-os`. Colunas mínimas (`slug/nome/descricao/system_prompt/ativo`).
2. **`platform_ia_config`** (8 linhas = as IAs do IAHub) + **`platform_ia_history`** → a "Stack de
   IA Comercial" que o **`AdminIAs`** já gerencia (tem `active`, `model`, `system_prompt`,
   `min_plan` e **histórico de uso**). `active` é **global** (admin liga/desliga p/ toda a plataforma).
3. **CRM WhatsApp AI** (`whatsapp-ai-agent` + `toggle-ai-status`) → on/off próprio por org/lead.

Implicação: **o backend de gestão já existe** (AdminIAs sobre `platform_ia_config`). O gap real é
o **console único voltado ao cliente** sob a marca Athos. Por isso a Fase 2 foi fatiada:

### Slice 2A — Console Athos client-facing (FEITO, sem migration)

- Novo registry canônico **`src/lib/athosAgents.ts`** — unifica a apresentação dos agentes sob a
  marca Athos (Athos GS, Athos Recepção, Athos Objeções, Athos Análise, Athos Follow-Up, Athos
  Remarketing, Athos Campanhas, Athos Criativo, Athos Conteúdo). Resolve status por org via
  `acesso` (entitlements) — sem queries.
- Nova página **`src/pages/plataforma/AthosConsole.tsx`** em **`/crm/athos`** — premium, Athos GS
  em destaque (núcleo) + agentes agrupados por categoria (Atendimento / Análise & Follow-up /
  Marketing), com estado liberado/bloqueado e CTA (copiloto, configurar, detalhe). Substitui o IAHub.
- Sidebar: item **Athos** → `/crm/athos` (mapeado à permissão `ia`).
- `tsc` + lint limpos. Nenhuma migration; 100% reversível.

### Slice 2B — Correção: agentes REAIS do CRM (FEITO)

> Ajuste após feedback do João: o Console/registry precisa refletir as IAs que **operam no CRM**,
> não o catálogo antigo do IAHub (`platform_ia_config`).

- **Revertido** o rename de `platform_ia_config` (voltou a "IA de …") — não são os agentes reais;
  aquela tabela é lida só pelo `ia-proxy` legado.
- `AdminIAs` revertido ao texto original (gerencia o catálogo antigo, não os agentes).
- Migration `20260705000001_athos_rename_agents.sql` reduzida a renomear só o copiloto real:
  `athos_agentes.onboarding` → `Athos GS — Onboarding`.
- **Registry reconstruído** (`src/lib/athosAgents.ts`) sobre os agentes reais: Athos GS,
  Athos Recepção (`whatsapp-ai-agent`), Athos Triagem (`triage-lead-ia`), Athos Análise
  (`analyze-non-leads`), Athos Follow-Up (`analyze-followup-need`+`ia-followup-agent`),
  Athos CS (`cs-athos`, superadmin). Gate por `acesso_crm`/`acesso_os`/papel — não por catálogo.
- `AthosConsole` atualizado: agentes automáticos mostram badge "Automático"; agentes internos
  (CS) só aparecem para superadmin. `tsc` + lint limpos.

### Slice 2C — Gating por org (EM ANDAMENTO)

**Fundação (FEITO):**
- Migration `20260705000002_athos_agentes_org.sql` (aplicada): tabela `athos_agentes_org`
  (`organization_id`, `agente_slug`, `ativo`) + RLS por org + helper SECURITY DEFINER
  `athos_agente_ativo(org, slug)` (ativo por padrão; false só se desativado explicitamente).
- Hook `useAthosAgentesOrg` (read/upsert do flag por org).
- **Athos Follow-Up enforced de verdade:** `analyze-followup-need` deployada (v6) com guard que
  pula orgs que desligaram o agente. Console exibe **Switch real** (com estado "Pausado").
- **Princípio anti-engano:** só agentes com `enforced: true` no registry mostram Switch. Os demais
  seguem em modo status (Automático/Configurar) até ter enforcement.

**Estratégia de segurança (A):** o gate é aplicado **DENTRO de cada agente** (early-return), NÃO no
`receive-message` (ingresso crítico). Se um agente falhar, a mensagem continua sendo recebida/salva.
E o gate é **inerte até alguém desligar** (padrão = ativo) → o deploy não muda o tráfego atual.

**Athos Triagem (`triage-lead-ia`) — FEITO e testado (2026-07-05):**
- Guard adicionado após validação de params: consulta `athos_agentes_org`, early-return
  `{skipped:true}` se `ativo=false`. Deploy v10 (`verify_jwt: true` preservado).
- **Verificado:** smoke test `{}` → 400 (compilou); teste de gate com org fake desligada →
  `{skipped:true}` sem LLM/sem tocar lead; registro fake limpo.
- Console exibe **Switch real** para Triagem (`enforced: true`, `gateSlug: 'triagem'`).

**Athos Análise (`analyze-non-leads`) — FEITO e testado (2026-07-06):**
- Guard após validação de `organization_id`; skip `{skipped, results:[]}` se desativado. Deploy v9
  (`verify_jwt: true`). Smoke `{}` → 400; gate test org fake → `{skipped}`; fake limpo. Switch no Console.

**Athos Recepção (`whatsapp-ai-agent`) — FEITO (2026-07-06):**
- Arquivo de 1791 linhas (respondedor crítico) → deployado pelo **João via CLI** (`supabase login` +
  `functions deploy`) direto do source, sem risco de escaping inline. Guard no `try` (após validação
  de params): checa `athos_agentes_org`, retorna `{skipped}` se `recepcao` desativado.
- **Verificado:** smoke `{}` → 400; gate test org fake → `{skipped:true}` (200, sem responder); fake limpo.
- Console exibe **Switch real** para Recepção (`enforced`, `gateSlug: 'recepcao'`). Convive com o
  on/off por lead existente (`toggle-ai-status`).

**→ A (enforcement) COMPLETO: Follow-Up · Triagem · Análise · Recepção, todos com on/off real testado.**

**Log unificado — FEITO (2026-07-06):**
- Migration `20260706000001_get_athos_eventos.sql`: função `get_athos_eventos(p_limit)`
  (SECURITY DEFINER, escopo derivado do `auth.uid()` via `perfis` — cliente não vê outra org) que
  faz UNION de `triage_ia_logs` (Triagem) + `ia_followup_log` (Follow-Up) + `ai_execution_logs`
  (Recepção) numa forma comum (`agente_slug`, `agente_nome`, `lead_id`, `resumo`, `status`, `criado_em`).
- Hook `useAthosEventos` (RPC via shim tipado, sem `any`).
- Console: seção **"Atividade recente"** com feed dos últimos eventos + tempo relativo (ptBR).
- `tsc` + lint limpos. Aditivo, read-only. (Análise não tem tabela de log própria — fora do feed.)

**Pendente:**
- Consolidar `AiSettings`/`AdminIAs` como detalhe dentro do console; aposentar `IAHub`/`IATipo`.

## Critério de pronto (Fase 2)

- [ ] Console lista todos os agentes com on/off por org funcionando.
- [ ] Cada agente mostra descrição + últimos eventos.
- [ ] `AiSettings` e `Cerebro` acessíveis dentro do console.
- [ ] Nomes `Athos …` aplicados na UI.
- [ ] Nenhuma edge function renomeada (slugs preservados).
- [ ] Build/lint limpos.
