# Console Athos v2 — página por agente + logs individuais

> Microplanejamento. Autor: Claude (Opus 4.8) · Data: 2026-07-06 · Solicitante: João Miguel
> Consome o backbone das fases 1–2. Escopo: rearquitetar o `/crm/athos` para ter **uma página
> por IA** (clicável, explicando como funciona) com **atividade/logs individuais por agente**,
> removendo o feed "Atividade recente" global. Inclui auditoria completa de TODA IA do sistema.

## 1. Inventário real — TODA IA do sistema (auditoria completa)

Varredura de `supabase/functions/**` + `src/**`. Toda edge function que chama LLM:

| # | Edge function | Agente (marca) | No registry? | Gatilho | Modelo | Log próprio | Enforced (on/off) |
|---|---------------|----------------|:---:|---------|--------|-------------|:---:|
| 1 | `whatsapp-ai-agent` | **Athos Recepção** | ✅ | Webhook WhatsApp (auto 24h) | gpt-4.1-mini / grok-3-fast | `ai_execution_logs` | ✅ `recepcao` |
| 2 | `triage-lead-ia` | **Athos Triagem** | ✅ | 1ª msg recebida (auto) | — | `triage_ia_logs` | ✅ `triagem` |
| 3 | `analyze-non-leads` | **Athos Análise** | ✅ | Manual (`NonLeadAnalysisModal`) | — | ❌ **NENHUM** (só devolve ao modal) | ✅ `analise` |
| 4 | `analyze-followup-need` + `ia-followup-agent` | **Athos Follow-Up** | ✅ | Cron/manual | gpt-4.1-mini | `ia_followup_log` | ✅ `followup` |
| 5 | `descompliquei-os` | **Athos GS** (copiloto) | ✅ | Chat `/plataforma/athos-gs` | grok-4.3/4.20, gpt-5.x, claude-opus-4.8, fable-5 | `os_conversations` (não no feed) | — |
| 6 | `cs-athos` | **Athos CS** (interno) | ✅ | Chat `/admin/cs` (superadmin) | gpt-5.x / claude-opus-4.8 | ❌ nenhum | — |
| 7 | `admin-os` | **Athos Admin** (copiloto master, read-only) | ❌ **FALTA** | Chat admin (superadmin master org) | gpt-5.x, grok-4.3, claude-opus-4.8, fable-5 | ❌ nenhum | — |

### Legado a tratar (não são agentes vivos)
| Edge function | Situação | Chamador | Ação sugerida |
|---------------|----------|----------|---------------|
| `ia-proxy` | Legado IAHub — lê `platform_ia_config` | `src/pages/plataforma/IATipo.tsx` | Marcar deprecated; remover na limpeza do IAHub |
| `chat-completion` | Proxy LLM genérico | `src/pages/admin-os/pages/AdminIAs.tsx` | Idem — parte do IAHub antigo |
| `detect-pipeline-stage` | Morto (pipeline removido) | **nenhum** | Candidato a exclusão |

### Conclusões da auditoria
- **São 7 IAs reais** (não 4). As "4" visíveis hoje = só as enforced (Recepção/Triagem/Análise/Follow-Up). GS e CS já estavam no registry; **`admin-os` está faltando**.
- **2 lacunas de log** que impedem "atividade por IA": **Athos Análise** não persiste nada e **Athos CS/Admin** também não. `get_athos_eventos` só une 3 fontes (Triagem, Follow-Up, Recepção) — Análise/GS ausentes até do feed atual.
- `IATipo.tsx` + `AdminIAs.tsx` + `platform_ia_config` = catálogo IAHub antigo ainda respirando via `ia-proxy`/`chat-completion`.

## 2. Arquitetura alvo

```
/crm/athos                → AthosConsole (grid de cards por agente, SEM feed global)
/crm/athos/:agentId       → AthosAgentPage  ← NOVA: explica + status + logs SÓ daquele agente
```

**AthosConsole (reformulado):** grid premium de cards agrupados por categoria. Cada card → benefício
+ badge de status (Ativo/Pausado/Interno) e clica pra abrir a página do agente. **Remove** o bloco
"Atividade recente" unificado.

**AthosAgentPage (nova):**
1. Hero — ícone, nome, benefício, badge de status; toggle on/off inline (se `enforced`).
2. **"Como funciona"** — bloco explicativo por agente: o que faz, quando dispara (gatilho), o que ele
   lê/escreve, e CTA de config (`/crm/ia` etc.) quando houver.
3. **Atividade deste agente** — feed filtrado só desse agente, bem formatado (lead, resumo, status,
   tempo relativo), com empty-state premium quando não há eventos.

## 3. Mudanças por camada

### Dados (SQL, aditivo)
- **`analise_ia_logs`** (nova tabela) — dar log ao Athos Análise. Colunas: `id, organization_id,
  lead_id, veredito, motivo, criado_em`. `analyze-non-leads` passa a inserir (edit pequeno; o gate
  `analise` já é checado lá).
- **`get_athos_eventos(p_agente_slug text default null, p_limit int)`** — estender a RPC: aceitar slug
  opcional (filtra 1 agente) e **adicionar** as fontes Análise (`analise_ia_logs`) e, opcional, GS
  (`os_conversations`). Mantém compat: sem slug = todos.

### Registry (`src/lib/athosAgents.ts`)
- **Adicionar `admin-os`** como agente `id:"admin"` (gate `admin`, `acao:"abrir"` → `/admin/athos`).
- Adicionar metadados por agente para a página: `comoFunciona` (texto), `modelo`, `gatilho`,
  `logSlug` (o `agente_slug` do feed; `null` = sem atividade rastreável, ex. CS/Admin/GS por ora).

### Hooks
- `useAthosEventos(slug?, limit)` — aceitar `agente_slug` opcional (passa `p_agente_slug`).

### UI
- Reescrever `AthosConsole.tsx` (grid, sem feed global).
- Criar `src/pages/plataforma/AthosAgentPage.tsx` + rota em `App.tsx`.
- Seguir Design System Premium (sem `Card` shadcn, sem emoji, `bg-foreground text-background` no ativo).

### Tutoriais (obrigatório)
- `data-tutorial`: manter `athos-header`; adicionar `athos-agent-card`, `athos-agent-comofunciona`,
  `athos-agent-atividade`. Atualizar step do tour no `tutorialData.ts`.

## 4. Ordem de execução (aditivo, sem quebrar nada)
1. SQL: `analise_ia_logs` + estender `get_athos_eventos` (MCP `apply_migration`).
2. Edit `analyze-non-leads` → inserir em `analise_ia_logs` (MCP inline; função pequena).
3. Registry: adicionar `admin`, metadados `comoFunciona/gatilho/modelo/logSlug`.
4. `useAthosEventos(slug?)`.
5. `AthosAgentPage.tsx` + rota.
6. Refatorar `AthosConsole.tsx` (grid, remover feed global).
7. Tutoriais + `data-tutorial`.
8. Build (`vite build`) + validar sintaxe (`tsc` só TS1xxx/TS2304).

## ✅ Status — APLICADO em 2026-07-06

Decisões do João travadas: cliente vê só **Pré-Atendimento** (ex-Recepção, renomeado), **Triagem**,
**Follow-Up**, **Análise** + o **Athos GS** (chat/cérebro, destaque separado). CS/Admin ficam fora do
console do cliente (gated). Entregue e buildado (vite ✓):
- `athosAgents.ts` — rename + metadados (`resumo`, `comoFunciona`, `gatilho`, `modelo`, `logSlug`) + `getAthosAgentById`.
- `AthosAgentPage.tsx` (`/crm/athos/:agentId`) — hero + status/toggle + "Como funciona" (gatilho/motor/passo a passo) + atividade individual (clica no evento → jornada do lead).
- `AthosConsole.tsx` — grid clicável, GS em destaque, **feed global removido**.
- `useAthosEventos(slug?, limit)` — feed por agente.
- SQL aplicado (migration `20260706120000`): tabela `analise_ia_logs` + `get_athos_eventos(p_limit, p_agente_slug)` com nova fonte Análise. `analyze-non-leads` deployado (v10) gravando log.
- `slug` interno de DB do Pré-Atendimento **permanece `recepcao`** (sem migração de `athos_agentes_org`) — só o nome de exibição mudou.

## 5. Fora de escopo (registrar, não fazer agora)
- Remoção do IAHub legado (`ia-proxy`, `chat-completion`, `IATipo`, `AdminIAs`, `platform_ia_config`).
- Exclusão de `detect-pipeline-stage`.
- Log persistente para GS/CS/Admin (copilotos) — só se o João quiser rastrear conversas no console.
