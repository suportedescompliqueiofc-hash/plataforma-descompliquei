# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (Vite)
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

There are no automated tests configured in this project.

## Git Remotes

This repo has two remotes. **Always push to `plataforma`**, never to `origin`:
```bash
git push plataforma main   # ✅ SEMPRE usar este
# git push origin main     # ❌ NÃO usar
```
- `plataforma` → `github.com/suportedescompliqueiofc-hash/plataforma-descompliquei.git` (repo principal)
- `origin` → `github.com/suportedescompliqueiofc-hash/crm-descompliquei-.git` (legado, não usar)

## Architecture Overview

This is a **multi-tenant WhatsApp CRM** (SaaS white-label) built on React + Vite + TypeScript + Supabase.

### Multi-tenancy

Every user belongs to an `organization_id` stored in their profile (`perfis` table). All data queries **must** be scoped by `organization_id`. The `useProfile` hook (`src/hooks/useProfile.ts`) is the source of `organization_id` — it auto-creates an org and profile on first login.

### Data Layer

All Supabase interactions go through **TanStack Query custom hooks** in `src/hooks/`. Never query Supabase directly from components. Pattern:
- Queries use `useQuery` with `['key', orgId]` cache keys
- Mutations use `useMutation` with `queryClient.invalidateQueries` on success
- Global QueryClient is configured with `staleTime: 5min` and `refetchOnWindowFocus: false` (see `App.tsx`)

### Realtime

Several hooks subscribe to Supabase Realtime (`postgres_changes`) and update the query cache directly via `queryClient.setQueryData` to avoid unnecessary re-fetches. See `useConversations.ts` for the pattern.

### Backend (Edge Functions)

Supabase Edge Functions (Deno, TypeScript) live in `supabase/functions/`. See **Key Edge Functions** section below for the full list. Deploy with:
```bash
npx supabase functions deploy <function-name> --project-ref noncbgdczgcboronmcah
```

### White-label Branding

`BrandingContext` (`src/contexts/BrandingContext.tsx`) loads per-org branding from `organization_branding` table and applies it to CSS variables on the DOM root. This controls colors, logo, favicon, and app title at runtime.

### Routing

All routes are defined in `src/App.tsx`. Every route is wrapped in `<ProtectedRoute>` + `<AppLayout>`. The `/conversas` page is special — it has no padding (full-bleed layout) and is detected via `location.pathname.startsWith('/conversas')`. The `/crm/leads/:leadId` route renders `JornadaPaciente.tsx` — the full patient journey timeline for a specific lead.

### UI Rules (from AI_RULES.md)

- **Components**: Always use `shadcn/ui` from `@/components/ui`. No custom CSS files or inline styles.
- **Styling**: Only Tailwind CSS utility classes.
- **Icons**: Only `lucide-react`. **NUNCA usar emojis** na interface — apenas ícones Lucide.
- **Notifications**: Only `sonner` — `import { toast } from 'sonner'`.
- **Charts**: Only `recharts`.
- **Drag & drop**: Only `@dnd-kit`.
- **Forms**: `react-hook-form` + `zod`.
- **Client state**: `useState`/`useContext` only — no Redux, Zustand, etc.

### Design System Premium (OBRIGATÓRIO)

Toda a plataforma segue um design system premium consistente. **Qualquer componente novo ou alteração visual DEVE seguir estes padrões.** Não usar os componentes genéricos `Card`/`CardHeader`/`CardTitle` do shadcn — usar a estrutura customizada abaixo.

**Fontes:**
- Display (títulos, métricas): `font-display` → Plus Jakarta Sans
- Body (texto corrido): `font-body` → DM Sans
- Mono (valores numéricos): `font-mono` / `tabular-nums` → JetBrains Mono

**Cards / Containers:**
```
rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden
```

**Card Headers:**
```html
<div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
  <div className="flex items-center gap-2">
    <span className="p-1.5 rounded-lg bg-muted">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TÍTULO</p>
      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Descrição</p>
    </div>
  </div>
</div>
```

**Card Footers (com botões de ação):**
```
flex items-center justify-end px-5 py-3.5 border-t border-border/40 bg-muted/20
```

**Page Headers:**
```html
<div className="flex items-center gap-2 mb-1">
  <div className="p-1.5 rounded-lg bg-muted">
    <Icon className="h-4 w-4 text-muted-foreground" />
  </div>
  <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Título</h1>
</div>
<p className="text-[13px] text-muted-foreground ml-10">Descrição da página</p>
```

**Labels de formulário:**
```
text-[11px] font-semibold uppercase tracking-wider text-muted-foreground
```

**Inputs:**
```
h-10 text-sm rounded-lg border-border/60
```

**Botões primários (CTA):**
```
h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5
```

**Botões secundários pequenos:**
```
h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3
```

**Tabs / Pills customizadas (NÃO usar Tabs do shadcn):**
```
Container: bg-muted/40 rounded-xl p-1
Aba ativa: bg-foreground text-background shadow-sm rounded-lg
Aba inativa: text-muted-foreground hover:text-foreground
```

**Section overlines (subtítulos de grupo):**
```
text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50
```

**Empty states:**
```html
<div className="flex flex-col items-center justify-center py-10 text-center">
  <div className="p-3 rounded-xl bg-muted/40 mb-3">
    <Icon className="h-6 w-6 text-muted-foreground/40" />
  </div>
  <p className="text-sm font-medium text-muted-foreground">Título</p>
  <p className="text-[11px] text-muted-foreground/50 mt-0.5">Descrição</p>
</div>
```

**Listas editáveis (ex: Pipeline, Fontes, Tags):**
- Usar divs com hover reveal nos botões de ação (`opacity-0 group-hover:opacity-100`)
- Dot de cor + nome inline em vez de tabelas pesadas
- Botões ghost icon `h-7 w-7` para editar/excluir

**Cores — regras invioláveis:**
- Laranja `#E85D24` é recurso escasso — apenas para CTAs primários e acentos críticos
- Estado ativo em navs/tabs: `bg-foreground text-background` (NÃO laranja/primary)
- Status: sempre trio — background pastel + texto escuro + dot de cor
- Bordas quentes: `border-border/60` (nunca `border-border` puro sem opacidade)

**Anti-patterns — NUNCA fazer:**
- ❌ Usar `Card`/`CardHeader`/`CardTitle`/`CardContent` genéricos do shadcn
- ❌ Emojis na interface (usar Lucide icons)
- ❌ `bg-[#E85D24]` hardcoded em botões — usar `bg-foreground text-background`
- ❌ Tabelas com `Table`/`TableRow` para listas simples — usar divs com hover
- ❌ Gradientes, sombras exageradas, bordas arredondadas > 20px em elementos pequenos
- ❌ Cores vibrantes em backgrounds grandes
- ❌ Fontes genéricas (Inter, Roboto, Arial)
- ❌ Textos sem acentos em português (sempre usar ç, ã, é, ê, á, etc.)

### WhatsApp Integration (UAZAPI)

The CRM integrates with WhatsApp via **UAZAPI** (based on whatsmeow/wuzapi). Key details:
- Connection config stored in `whatsapp_connections` table (per org)
- Auth: `token` header (not Bearer)
- **Reply/Quote**: Use field `replyId` (string, WhatsApp message ID) in send payloads. NOT `ContextInfo`/`StanzaId` — UAZAPI ignores those.
- **Edit message**: `POST {uazapi_url}/message/edit` with `{ id, text }`. 15-minute window.
- **Send text**: `POST /send/text` with `{ number, text, delay?, replyId? }`
- **Send media**: `POST /send/media` with `{ number, type, file, text?, replyId? }`
- `delay` field only for bot messages (simulates typing); human agent messages send instantly.

### Impersonation (Acessar CRM)

Superadmins from the **master org** (`MASTER_ORG_ID` in `src/lib/constants.ts`) can impersonate client orgs via "Acessar CRM" in Super Admin pages. Critical rules:
- **Only users whose current `organization_id === MASTER_ORG_ID`** can impersonate (enforced in `TabClientesCRM.tsx`)
- `localStorage.original_master_org_id` is always set to `MASTER_ORG_ID` (hardcoded, never from profile)
- "Sair do Cliente" (`handleBackToMaster` in `SidebarContent.tsx`) always restores to `MASTER_ORG_ID`
- **NEVER** save `myProfile.organization_id` as the return org — it could be wrong

### Key Organizations

| ID | Name | Purpose |
|----|------|---------|
| `aa787cc8-787a-4774-bd80-ffbf78c0cf5f` | Descompliquei — Super Admin | Master org — controle da plataforma, impersonação de clientes |
| `91a0e113-f428-4bd5-867f-431c91bc91c1` | Descompliquei | CRM operacional da Descompliquei — org separada com dados próprios |

**Superadmins:**
- `jghf5554@gmail.com` → master org (`aa787cc8`), `superadmin` — gestão da plataforma
- `suportedescompliqueiofc@gmail.com` → org Descompliquei (`91a0e113`), `superadmin` — CRM principal da Descompliquei

**IMPORTANTE:** O CRM da Descompliquei (`91a0e113`) é uma org **independente** com seus próprios leads, mensagens e WhatsApp. Alterações específicas para a Descompliquei devem afetar APENAS esta org. O `suportedescompliqueiofc` é superadmin mas opera em org separada da master — impersonação só é permitida a partir da org master (`aa787cc8`).

### Lead Scoring (Descompliquei-only)

The `leads` table has a `lead_scoring` field (`text`, nullable, check constraint: `A`, `B`, `C`, `D`). This feature is **exclusive to the Descompliquei org** (`DESCOMPLIQUEI_ORG_ID` in `src/lib/constants.ts`).

- **Scoring options**: A (Lead dos sonhos), B (Qualificado com ressalva), C (Em desenvolvimento), D (Fora do ICP)
- **Modal**: In `ActiveConversation.tsx`, the "QUALIFICADO" button opens a scoring modal for Descompliquei; for client orgs, it remains a direct toggle.
- **Badge**: `ConversationsList.tsx` shows a colored badge (A=green, B=blue, C=yellow, D=red) next to lead names.
- **Conditional flag**: `const isDescompliqueiOrg = profile?.organization_id === DESCOMPLIQUEI_ORG_ID`

### Descompliquei Dashboard

The Dashboard (`src/pages/Dashboard.tsx`) has a fully custom layout for the Descompliquei org, controlled by `isDescompliqueiOrg`. All metrics come from `useDashboard.ts`.

**Sections (in order, Descompliquei only):**
1. **Funil de Conversão** — 4 cards: Leads → MQL → Reuniões → Fechamentos (with arrows and conversion rates between steps). Only marketing-origin leads (`origem = 'marketing'`) **created** in the selected period (`leadsCreatedInPeriod`).
2. **Qualidade dos Leads** — Scoring distribution cards (A/B/C/D) with colored bars and percentages. Uses same `leadsCreatedInPeriod` base as the funnel.
3. **Eficiência de Aquisição** — Shows total investment in the period (from `meta_insights`) + 5 metric cards: CPL, CPMQL, CPR (Custo por Reunião = investimento/agendamentos), CPA (Custo por Aquisição = investimento/fechamentos), ROAS. Real spend comes from `meta_insights` table (`gasto` column, `nivel = 'campaign'`), includes all campaigns (active and inactive).
4. **Performance Comercial Global** — 3 rate cards: Taxa de Qualificação (MQL), Taxa de Agendamento, Taxa de Fechamento. Computed from total leads (all origins).
5. **Evolução no Tempo** — Single AreaChart with 4 series: Leads, MQLs, Agendamentos, Fechamentos (daily).

**Metric naming convention:**
- CPL = Custo por Lead (investimento / leads marketing)
- CPMQL = Custo por MQL (investimento / qualificados)
- CPR = Custo por Reunião (investimento / agendamentos) — NOT CPA
- CPA = Custo por Aquisição (investimento / fechamentos) — only when there are closed deals
- ROAS = Return on Ad Spend (receita / investimento)

**Hidden for Descompliquei:** Visão Geral cards, pipeline-based funnel, Top Procedimentos, Ticket Médio, Faturamento, Conversão Global card.

**Client CRM dashboard** remains unchanged — all sections wrapped in `!isDescompliqueiOrg` conditionals.

### Marketing / Tráfego Page

The Marketing page (`src/pages/MarketingTrafego.tsx`) is the Meta Ads intelligence hub, exclusive to Descompliquei org.

**Data sources:**
- `useMetaAds(dateRange)` — campaigns, adsets, ads, insights from `meta_ads` + `meta_insights` tables
- `useDashboard(dateRange, 'geral')` — CRM metrics (shared with Dashboard for data consistency)
- `vw_criativo_performance` — SQL view joining meta_ads → criativos → leads → vendas for per-creative CRM data

**Tabs:** Dashboard, Criativos, Campanhas, Análise

**Key behaviors:**
- **Effective ad status**: If a campaign or adset is not ACTIVE, the ad inherits `PAUSED` status regardless of its own status (`useMetaAds.ts`).
- **Active filter**: Criativos tab shows only active ads by default. A "Mostrar inativos" toggle reveals paused/inactive ads.
- **Criativo ID**: Last 6 digits of `meta_ad_id` shown next to ad name in cards and table to distinguish ads with identical names.
- **CRM data consistency**: The "Resultados Reais (CRM)" section and "Funil de Conversão" use `useDashboard` as single source of truth — same data as the Painel de Controle.
- **Date-aware metrics**: All metrics (Meta Ads + CRM) respect the selected date range filter (Dia/Semana/Mês/Ano).

**Meta Ads integration:**
- Credentials stored in `integracoes` table (`tipo = 'meta_ads'`, `credenciais->>'access_token'`)
- Sync via Edge Function `meta-ads-sync`
- `meta_insights` table stores daily metrics per campaign/ad with Portuguese column names: `gasto` (spend), `impressoes`, `cliques`, `leads`, `data_ref` (date), `nivel` (level: 'campaign' or 'ad')

### Jornada do Paciente

A **Jornada do Paciente** (`src/pages/JornadaPaciente.tsx`) é uma timeline cronológica de todos os eventos de um lead, acessível via `/crm/leads/:leadId`. Abre ao clicar no nome do lead na tabela de Leads.

**Hook:** `src/hooks/useJornadaPaciente.ts` — agrega 7 fontes de dados em um array `EventoJornada[]` unificado e ordenado.

**Tipos de evento (`tipo` field):**

| tipo | Cor/ícone | Descrição |
|------|-----------|-----------|
| `mensagem` | azul | Mensagens WhatsApp enviadas/recebidas (apenas textos e mídias reais — sem logs de IA) |
| `etapa` | roxo | Transição de etapa do pipeline (detectado via `lead_stage_history`) |
| `agendamento` | verde | Agendamento criado/atualizado |
| `venda` | dourado | Venda registrada |
| `nota` | cinza | Nota manual ou do sistema (MQL, scoring) |
| `qualificacao` | laranja | Lead marcado como qualificado (MQL) |
| `handoff` | vermelho | IA transferiu para atendente humano (standalone, apenas se não houver entrada de etapa) |
| `humano_assumiu` | indigo | Primeira mensagem humana após sequência de respostas da IA |

**Regras críticas:**

- **NUNCA mostrar logs de execução da IA** na timeline — `mensagens` com `remetente = 'ia'` são excluídas. Apenas mensagens `remetente IN ('bot', 'atendente', 'lead')` aparecem.
- **Backfill anchors**: entradas de `lead_stage_history` com `from_stage_position = NULL` são âncoras de backfill (posição atual no momento da migração) — devem ser **ignoradas** na timeline, não exibidas.
- **Handoff integrado na etapa**: quando existe uma entrada de `lead_stage_history` para a etapa de handoff, o evento `etapa` já descreve a transferência (com duração do atendimento automatizado). O evento `handoff` standalone só aparece quando não há histórico de etapas.
- **Timestamps em fuso local**: `groupByDay` usa `format(parseISO(iso), 'yyyy-MM-dd')` (date-fns local) para agrupar corretamente — nunca `.slice(0, 10)` que usaria UTC e quebraria para leads criados em horários tardios (BRT = UTC-3).

**Pipeline stage tracking (trigger automático):**

```sql
-- trigger: trg_track_stage_change (AFTER UPDATE ON leads)
-- função: track_lead_stage_change()
-- Grava em lead_stage_history quando posicao_pipeline muda
-- from_stage_position = OLD.posicao_pipeline (NULL no backfill)
```

Leads existentes foram backfillados com a posição atual e `from_stage_position = NULL`. Novas transições gravam `from_stage_position` com o valor anterior real — estes são os eventos válidos para exibição na timeline.

**Sistema de notas para timestamps precisos (em `useLeads.ts`):**

Quando `updateLead` é chamado com `is_qualified = true` ou `lead_scoring`, ele insere uma nota do sistema em `lead_notas` com `metadados.evento`:

```typescript
// MQL
metadados: { evento: 'mql', is_qualified: true }

// Scoring
metadados: { evento: 'scoring', scoring: 'A' | 'B' | 'C' | 'D' }
```

O `useJornadaPaciente` detecta essas notas pelo `metadados.evento` e as renderiza como eventos `qualificacao` e `nota` (scoring) com o timestamp exato da nota — não o `atualizado_em` do lead (que muda em qualquer update).

**MacroTimelineStrip**: barra de progresso no topo mostrando apenas eventos macro (`etapa`, `agendamento`, `venda`, `qualificacao`). Não inclui mensagens individuais.

### CTWA (Click-to-WhatsApp) Tracking

The `receive-message` Edge Function captures criativo origin from Meta Ads when leads arrive via Click-to-WhatsApp ads. It checks multiple contextInfo paths to handle different webhook formats:
- UaZAPI raw: `payload.data.message.contextInfo`
- n8n-wrapped: `payload.message.content.contextInfo`
- Additional fallbacks for `rawPayloadData.body.message` paths

When `externalAdReply` with `sourceType = 'ad'` is found, it looks up the `criativos` table by `id_externo` matching `sourceID`, and sets `leads.criativo_id` + `leads.fonte`.

### Key Tables (Portuguese naming convention)

- `perfis` — user profiles (linked to `auth.users`)
- `organizations` — tenants
- `leads` — contacts/leads (includes `lead_scoring` A/B/C/D field, `criativo_id` FK to `criativos`, `fonte`, `meta_ad_platform`, `meta_ad_source_id`)
- `mensagens` — WhatsApp messages (supports `quoted_message_id`, `is_edited`, `edited_at`, `original_content`)
- `etapas` — pipeline stages
- `cadencias` — message cadence sequences
- `lead_cadencias` — tracks which cadence was dispatched to which lead (prevents duplicate dispatch)
- `cadencia_logs` — execution logs for cadence steps
- `organization_branding` — white-label settings per org
- `usuarios_papeis` — user roles (`superadmin`, `admin`, `atendente`)
- `whatsapp_connections` — UAZAPI connection config per org
- `integracoes` — external integrations (Meta Ads credentials, etc.) per org
- `meta_ads` — synced Meta Ads entities (campaigns, adsets, ads) with `nivel`, `status`, `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`
- `meta_insights` — daily metrics per entity: `gasto`, `impressoes`, `cliques`, `leads`, `data_ref`, `nivel` ('campaign'/'ad')
- `criativos` — canonical creative references (`id_externo` = Meta ad ID, linked from `leads.criativo_id`)
- `marketing_score_config` — custom scoring weights for creative performance (per org)
- `lead_blacklist` — permanently blocked phone numbers per org
- `tags` / `leads_tags` — tagging system for leads
- `lead_stage_history` — pipeline stage transition log per lead. Columns: `id`, `lead_id`, `organization_id`, `stage_position` (destination), `from_stage_position` (origin — `NULL` means backfill anchor, not a real transition), `entered_at`. Populated automatically by the `trg_track_stage_change` trigger.
- `lead_notas` — freeform + system notes per lead. Columns: `id`, `lead_id`, `organization_id`, `conteudo`, `tipo` (`'manual'` | `'sistema'`), `metadados` (JSONB), `criado_em`. System notes with structured `metadados` are used for accurate timestamps of key events (MQL qualification, scoring definition).
- `debug_payloads` — temporary debug logging for API payloads
- `platform_complementary_folders` — pastas/subpastas dos Materiais Complementares da Trilha. Columns: `id`, `nome`, `parent_id` (FK self — NULL = pasta raiz, preenchido = subpasta), `ordem_index`, `ativo`, `created_at`. Máx. 2 níveis de hierarquia (pasta → subpasta).
- `platform_complementary_materials` — materiais (PDF ou HTML) vinculados a uma pasta. Columns: `id`, `folder_id` (FK → `platform_complementary_folders`), `titulo`, `tipo` (`'pdf'` | `'html'`), `pdf_url` (URL pública do Storage), `conteudo_html` (HTML inline), `ordem_index`, `ativo`, `created_at`. **`conteudo_html` NÃO é carregado na query inicial — é buscado sob demanda ao abrir o material.**

**Colunas relevantes em `organizations`:**
- `onboarding_completed_steps text[]` — passos do onboarding CRM já concluídos (DEFAULT `'{}'`)
- `onboarding_enabled boolean` — se o onboarding deve aparecer para esta org (DEFAULT `false`). Setado `true` automaticamente na criação de novas orgs (`useProfile.ts`). Orgs antigas ficam `false`.
- `tutorial_progress jsonb` — progresso dos tutoriais interativos (não-null, DEFAULT `'{}'`)

### Storage Buckets

- `platform-complementary` — PDFs dos Materiais Complementares da Trilha. Público para leitura, autenticado para upload/delete. Limite: 50 MB por arquivo. Apenas `application/pdf`.

### Key SQL Views

- `vw_criativo_performance` — joins meta_ads → criativos (via `id_externo = meta_ad_id`) → leads (via `criativo_id`) → vendas for per-creative CRM metrics
- `vw_marketing_eficiencia` — all-time marketing efficiency metrics (NOTE: no date filter — prefer `useDashboard` for date-aware calculations)

### Key Edge Functions

- `receive-message` — webhook for UAZAPI incoming messages (includes CTWA criativo tracking)
- `meta-ads-sync` — syncs Meta Marketing API data to `meta_ads` + `meta_insights` tables
- `whatsapp-ai-agent` — AI auto-reply agent
- `send-quick-message` — sends WhatsApp messages (text, media, audio, reply/quote)
- `edit-message` — edits sent WhatsApp messages (15-min window)
- `delete-message` — deletes messages
- `process-cadences` — scheduled cadence dispatcher
- `process-scheduled-messages` — cron for timed messages
- `manage-whatsapp` — WhatsApp connection management
- `seed-stages` — seeds default pipeline stages for orgs

---

## Materiais Complementares (Trilha de Aprendizado)

Aba adicional na Trilha de Aprendizado que disponibiliza PDFs e conteúdo HTML organizados em pastas/subpastas. Gerenciada pelo Admin OS.

### Arquitetura

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/components/plataforma/MateriaisComplementares.tsx` | View do aluno — accordion de pastas/subpastas, abre PDF em nova aba, HTML em dialog via `<iframe srcDoc>` |
| `src/components/admin/AdminMateriaisComplementares.tsx` | Painel admin — CRUD de pastas (2 níveis), upload de PDF para Storage, editor HTML, reordenação por setas |
| `src/pages/admin-os/AdminTrilhaWrapper.tsx` | Wrapper sobre `AdminTrilha` que adiciona abas **Módulos** / **Materiais Complementares** no `/admin/trilha` |

### Integração na Trilha do aluno (`Trilha.tsx`)

A página `/plataforma/trilha` agora tem duas abas pill (padrão premium):
- **Aula** — conteúdo original (pilares, módulos, progresso)
- **Materiais Complementares** — renderiza `MateriaisComplementares.tsx`

### Integração no Admin OS

- **`/admin/trilha`** usa `AdminTrilhaWrapper` (registrado em `App.tsx`) que mostra as abas **Módulos** / **Materiais Complementares**. As abas somem automaticamente nas sub-rotas `/admin/trilha/pilar/:id` e `/admin/trilha/modulo/:id`.
- **`AdminOS.tsx` (tab ⑥ Materiais)** mantém o `TabTrilha.tsx` com sub-abas internas (caso esse caminho também seja usado).

### Regras críticas

- **Lazy load obrigatório**: `conteudo_html` nunca é selecionado na query de listagem. É buscado com `.select("conteudo_html").eq("id", id).single()` apenas quando o aluno abre o material.
- **HTML renderizado em `<iframe srcDoc>`**: isola completamente os estilos do documento HTML dos estilos da plataforma. Usar `dangerouslySetInnerHTML` quebraria documentos com dark background ou estilos próprios.
- **"Tela cheia"**: cria um `Blob` do `htmlContent` e abre via `URL.createObjectURL` em nova aba — só habilita após o conteúdo carregar.
- **Hierarquia máxima**: 2 níveis (pasta raiz → subpasta). Não criar 3+ níveis — o seletor de "pasta pai" no modal de pasta só exibe pastas raiz.
- **Reordenação**: feita por troca de `ordem_index` entre dois itens adjacentes (setas ↑↓). Não há DnD nesta feature.
- **PDFs**: armazenados no bucket `platform-complementary` (Supabase Storage). A `pdf_url` pública é salva no banco; o arquivo vai direto do Storage ao browser, sem passar pelo banco a cada acesso.

---

## Sistema de Tutoriais (OBRIGATÓRIO manter atualizado)

O CRM possui um sistema de tutoriais interativos que guia os usuários pelas funcionalidades. **Sempre que uma página for modificada — novos elementos, novas abas, novos modais, novos campos — o tutorial correspondente DEVE ser atualizado.**

### Arquitetura

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/components/tutorial/tutorialData.ts` | **Fonte da verdade** — todo o conteúdo dos tutoriais (steps, textos, ações) |
| `src/components/tutorial/TutorialSpotlight.tsx` | Overlay com spotlight SVG, tooltip posicionado dinamicamente e execução de ações |
| `src/components/tutorial/TutorialProvider.tsx` | Contexto global — progresso por org no `localStorage` |
| `src/components/tutorial/TutorialHelpCenter.tsx` | Central de ajuda — lista todos os tutoriais disponíveis |
| `src/components/tutorial/TutorialHelpButton.tsx` | Botão flutuante de acesso |

### Como funciona

1. Cada tutorial tem `id`, `pageRoute`, `title`, `icon`, `category` e um array de `steps`
2. Cada step aponta para um elemento via `data-tutorial="nome-do-alvo"`
3. O `TutorialSpotlight` faz `document.querySelector('[data-tutorial="nome"]')` para posicionar o spotlight
4. O tooltip se posiciona inteligentemente ao redor do elemento sem cobri-lo
5. Quando o step tem `action`, ele é executado **antes** de posicionar o spotlight (permite clicar em abas, abrir modais, fechar modais)

### Atributo data-tutorial

Todo elemento que o tutorial precisa destacar deve ter `data-tutorial="identificador-unico"`:

```tsx
// Exemplo em uma página
<Button data-tutorial="leads-add">Novo Lead</Button>
<div data-tutorial="leads-filters">...</div>

// Exemplo em um modal
<Input data-tutorial="lead-field-nome" ... />
<Button data-tutorial="lead-submit">Salvar</Button>
```

**Convenção de nomenclatura:**
- Elementos de página: `{pagina}-{elemento}` — ex: `leads-add`, `pipeline-tabs`
- Campos de modal: `{entidade}-field-{campo}` — ex: `lead-field-nome`, `venda-field-valor`
- Botões de submit: `{entidade}-submit` — ex: `lead-submit`, `cadence-submit`
- Abas: `{pagina}-tabs` — ex: `ia-tabs`, `cadences-tabs`
- Nav items: `{pagina}-nav-{id}` — ex: `settings-nav-pipeline`

### Interface TutorialStep

```typescript
export interface TutorialStepAction {
  type: 'click' | 'dismiss';
  selector?: string;   // CSS selector ou 'tutorial:nome' para data-tutorial
  delay?: number;      // ms aguardar após a ação (default: 400)
}

export interface TutorialStep {
  target: string;           // valor do data-tutorial alvo
  title: string;            // título do tooltip
  description: string;      // texto com rich formatting (ver abaixo)
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: TutorialStepAction; // executada ANTES de mostrar este step
}
```

### Rich Formatting nas descrições

As descrições suportam formatação inline:
- `**texto**` → negrito (`<strong>`)
- `\n` → quebra de linha / novo parágrafo
- Linhas iniciadas com `• ` ou `- ` → lista com bullets

```typescript
description: 'Este é o **título** do campo.\n\n• Item 1\n• Item 2\n\n**Dica:** Use com cuidado.'
```

### Ações disponíveis

**Clicar em elemento (navegar abas, abrir modais):**
```typescript
action: { type: 'click', selector: '[data-tutorial="ia-tabs"] button:nth-child(2)', delay: 500 }
action: { type: 'click', selector: '[data-tutorial="leads-add"]', delay: 500 }
```

**Fechar modal/dialog (Escape):**
```typescript
action: { type: 'dismiss', delay: 300 }
```

**Prefixo `tutorial:` como atalho:**
```typescript
// Equivalente a document.querySelector('[data-tutorial="meu-botao"]')
action: { type: 'click', selector: 'tutorial:meu-botao', delay: 400 }
```

### Padrão de walkthrough com modal

Para tutoriais que abrem um modal e percorrem os campos:

```typescript
steps: [
  // 1. Step anterior abre o modal
  {
    target: 'algum-elemento-fora',
    title: 'Criar novo item',
    description: 'Clique em "Novo" para abrir o formulário.',
    action: { type: 'click', selector: '[data-tutorial="btn-novo"]', delay: 500 },
  },
  // 2. Steps dentro do modal
  { target: 'modal-field-nome', title: 'Nome', description: '...' },
  { target: 'modal-field-tipo', title: 'Tipo', description: '...' },
  { target: 'modal-submit',     title: 'Salvar', description: '...' },
  // 3. Fechar o modal e continuar
  {
    target: 'proximo-elemento-fora',
    title: 'Próxima seção',
    description: '...',
    action: { type: 'dismiss', delay: 300 },
  },
]
```

### Categorias de tutoriais

| id | label | Páginas |
|----|-------|---------|
| `geral` | Visão Geral | welcome, dashboard, conversas, notificacoes, performance |
| `comercial` | Comercial | leads, pipeline, agendamentos, vendas, metas |
| `automacao` | Automação | ia, quick-messages, cadences |
| `sistema` | Sistema | settings |
| `onboarding` | (oculto) | onboarding-perfil, onboarding-etiquetas, onboarding-procedimentos, onboarding-equipe |

> **IMPORTANTE:** Tutoriais com `category: 'onboarding'` são **excluídos** da Central de Ajuda (`TutorialHelpCenter.tsx`) e do contador de progresso. Devem estar **dentro** do array `tutorials` em `tutorialData.ts` — caso contrário o `TutorialSpotlight` não os encontra e nada é exibido.

### Mapa completo: página → tutorial → data-tutorial principais

| Página | Tutorial ID | Elementos principais |
|--------|------------|---------------------|
| `Dashboard.tsx` | `dashboard` | `dashboard-period`, `dashboard-metrics`, `dashboard-funnel`, `dashboard-chart` |
| `Conversas.tsx` | `conversas` | `conversas-list`, `conversas-search`, `conversas-filters` |
| `Notifications.tsx` | `notificacoes` | `notificacoes-tabs`, `notificacoes-filters`, `notificacoes-list`, `notificacoes-card`, `notificacoes-resolver`, `notificacoes-limpar` |
| `Leads.tsx` | `leads` | `leads-add`, `leads-filters-advanced`, `leads-pagination`, `leads-row-actions`, `leads-bulk-bar`, `leads-origin-filter`, `leads-tags-filter` |
| `LeadModal.tsx` | (modal do leads) | `lead-modal`, `lead-field-nome`, `lead-field-telefone`, `lead-field-origem`, `lead-field-fonte`, `lead-field-etapa`, `lead-field-data`, `lead-submit` |
| `Pipeline.tsx` | `pipeline` | `pipeline-tabs`, `pipeline-column`, `pipeline-drag`, `pipeline-metrics-tab`, `pipeline-header` |
| `Agendamentos.tsx` | `agendamentos` | `agendamentos-header`, `agendamentos-config`, `agendamentos-tabs`, `agendamentos-filters`, `agendamentos-upcoming`, `agendamentos-metrics` |
| `AgendamentoLeadModal` | (modal de agendamentos) | `agendamento-modal`, `agendamento-field-lead`, `-titulo`, `-tipo`, `-duracao`, `-data`, `-cor`, `-obs`, `agendamento-submit` |
| `Vendas.tsx` | `vendas` | `vendas-header`, `vendas-filters`, `vendas-metrics`, `vendas-row` |
| `VendaModal.tsx` | (modal de vendas) | `venda-modal`, `venda-field-cliente`, `-procedimento`, `-valor`, `-data`, `-pagamento`, `venda-submit` |
| `Metas.tsx` | `metas` | `metas-header`, `metas-month`, `metas-edit`, `metas-funnel`, `metas-tabs`, `metas-historico`, `metas-projecao`, `metas-criar` |
| `AiSettings.tsx` | `ia` | `ia-tabs`, `ia-status`, `ia-toggle`, `ia-prompt`, `ia-save`, `ia-field-identity`, `ia-field-voice`, `ia-field-procedures`, `ia-field-faq`, `ia-field-horario`, `ia-field-pagamento`, `ia-field-instructions`, `ia-logs` |
| `AiFollowupConfig.tsx` | (sub-componente ia) | `ia-followup-config` |
| `AiFollowupTab.tsx` | (sub-componente ia) | `ia-followup-history` |
| `QuickMessagesPage.tsx` | `quick-messages` | `quick-messages-create`, `quick-messages-folder-create`, `quick-messages-folders`, `quick-messages-search`, `qm-field-titulo`, `qm-field-tipo`, `qm-field-conteudo`, `qm-submit` |
| `Cadences.tsx` | `cadences` | `cadences-tabs`, `cadences-list`, `cadences-create`, `cadences-card`, `cadences-dispatch`, `cadences-monitoring`, `cadences-report` |
| `CadenceModal.tsx` | (modal de cadências) | `cadence-modal-identity`, `cadence-field-nome`, `cadence-field-descricao`, `cadence-steps`, `cadence-add-step`, `cadence-submit` |
| `Settings.tsx` | `settings` | `settings-nav`, `settings-nav-{id}`, `settings-profile`, `settings-pipeline`, `settings-sources`, `settings-tags`, `settings-marca`, `settings-whatsapp`, `settings-appearance`, `settings-security` |

### Regra obrigatória ao modificar páginas

> **Sempre que você adicionar, remover ou renomear um elemento importante em qualquer página (botão de ação, aba, seção, campo de formulário, modal), você DEVE:**
>
> 1. Adicionar/atualizar o atributo `data-tutorial="..."` no elemento
> 2. Atualizar o step correspondente em `tutorialData.ts`
> 3. Se criou uma seção inteiramente nova, avaliar se merece um step novo no tutorial da página
>
> Tutoriais desatualizados quebram a experiência de onboarding — o spotlight fica "perdido" quando o target não existe.

### Mapa de tutoriais de onboarding

| Tutorial ID | Página destino | Steps principais |
|-------------|---------------|-----------------|
| `onboarding-perfil` | `/crm/settings?section=marca` | `settings-go-marca` → `branding-logo` → `branding-identity` → `branding-save` |
| `onboarding-etiquetas` | `/crm/settings?section=tags` | `settings-go-tags` → `tags-sync-whatsapp` → `tags-new` |
| `onboarding-procedimentos` | `/crm/procedimentos` | `procedimentos-header` → `procedimentos-add` → campos do modal → submit |
| `onboarding-equipe` | `/crm/settings?section=team` | `settings-go-team` → `settings-team` |

### Boas práticas de conteúdo

- **Título**: curto, imperativo ou substantivo (máx 5 palavras)
- **Descrição**: começa com o "o quê", depois o "como" e fecha com uma "dica" ou "por que"
- **Bullets**: use para listar 3+ itens
- **Negrito**: destaque apenas 1-2 conceitos por parágrafo
- **Comprimento**: ideal 3-6 linhas visíveis no tooltip (não ultrapassar 200 palavras)
- **Tom**: PT-BR, direto, sem jargão técnico, orientado a benefício

---

## Sistema de Onboarding CRM

Modal de primeiro acesso que guia o dono da clínica (`admin`) pela configuração inicial do CRM.

### Arquitetura

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/useOnboarding.ts` | Hook principal — lê `organizations.onboarding_completed_steps` e `onboarding_enabled`, expõe `shouldShowModal`, `showInSidebar`, `completeStep` |
| `src/components/onboarding/OnboardingModal.tsx` | Modal bloqueante fixo (z-index 10000) — aparece até todos os passos obrigatórios serem concluídos |
| `src/pages/CrmOnboarding.tsx` | Página dedicada `/crm/onboarding` com progresso e todos os passos |

### Regras de exibição

- **Quem vê:** apenas papel `admin` (dono da clínica). `superadmin` e `atendente` **nunca** veem.
- **Quando aparece:** `onboarding_enabled = true` na org E `onboarding_completed_steps` incompleto.
- **Novas orgs:** `useProfile.ts` seta `onboarding_enabled = true` ao criar a org.
- **Orgs antigas:** `onboarding_enabled = false` (DEFAULT) — nunca aparecem o modal.
- **Paths liberados:** enquanto o usuário está em `/crm/settings`, `/crm/ia`, `/crm/procedimentos` ou `/crm/onboarding`, o modal não bloqueia.
- **Celebração:** ao completar todos os passos obrigatórios, exibe tela de celebração antes de liberar o CRM.

### Passos (todos obrigatórios)

| # | key | Título | path | tutorialId |
|---|-----|--------|------|-----------|
| 1 | `perfil` | Complete o perfil da clínica | `/crm/settings?section=marca` | `onboarding-perfil` |
| 2 | `etiquetas` | Sincronize as etiquetas do WhatsApp | `/crm/settings?section=tags` | `onboarding-etiquetas` |
| 3 | `procedimentos` | Cadastre seus procedimentos | `/crm/procedimentos` | `onboarding-procedimentos` |
| 4 | `tutorial` | Faça o tour pelo CRM | `/crm` | `welcome` |

### Padrão de navegação com tutorial

Ao clicar no CTA de um passo:
```typescript
navigate(step.path);
setTimeout(() => startTutorial(step.tutorialId), 600); // aguarda render da página
```

O `Settings.tsx` usa `?section=` query param para abrir a seção correta diretamente. Há sr-only buttons (`settings-go-marca`, `settings-go-tags`, `settings-go-team`) que o tutorial clica via action para navegar entre seções.

### Item na sidebar

`SidebarContent.tsx` mostra "Configuração Inicial" com badge `X/Y` (neutro, sem cor) no topo do menu quando `showInSidebar = true`. Badge usa `bg-muted text-muted-foreground border-border/60` — sem laranja/amber.

---

## Pipeline — Kanban

- **Sem paginação:** todas as etapas renderizam de uma vez. A paginação de 4 colunas foi removida.
- **Scroll horizontal:** barra de rolagem aparece **no topo** do board (usando div espelho sincronizado via eventos `scroll`). O container principal tem `scrollbarWidth: none`.
- **Drag & drop:** `@dnd-kit` com `closestCenter`. Todas as etapas são acessíveis para drop sem limitação.

---

## Dashboard — Widget de Performance

O widget "Rotina do Dia" no Dashboard (`src/pages/Dashboard.tsx`) escala visualmente conforme o horário:

| Estado | Horário | Visual |
|--------|---------|--------|
| `done` | tarefas concluídas | card verde com CheckCircle2 |
| `early` | antes das 12h | card amber discreto com Bell |
| `warning` | 12h–18h | card amber com texto pendente |
| `urgent` | após 18h | card laranja com borda, label "ROTINA DO DIA EM ABERTO" |
| `critical` | após 21h | card vermelho, label "ÚLTIMA CHANCE — DIA TERMINA À MEIA-NOITE" |

- Sem ícones nos alertas — apenas texto e bordas coloridas.
- `usePerformanceBadge()` retorna `pendingTasks` com `id` e `title` para mostrar as tarefas pendentes nas tags.

---

## Top Procedimentos (Dashboard)

O ranking **Top Procedimentos** usa `vendas.produto_servico` (campo da tabela `vendas`, preenchido a partir do catálogo cadastrado), **não** `leads.procedimento_interesse` (texto livre).

Fonte: `useDashboard.ts` — conta ocorrências de `produto_servico` nas vendas do período filtrado.
