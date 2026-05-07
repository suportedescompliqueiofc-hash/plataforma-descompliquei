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

All routes are defined in `src/App.tsx`. Every route is wrapped in `<ProtectedRoute>` + `<AppLayout>`. The `/conversas` page is special — it has no padding (full-bleed layout) and is detected via `location.pathname.startsWith('/conversas')`.

### UI Rules (from AI_RULES.md)

- **Components**: Always use `shadcn/ui` from `@/components/ui`. No custom CSS files or inline styles.
- **Styling**: Only Tailwind CSS utility classes.
- **Icons**: Only `lucide-react`.
- **Notifications**: Only `sonner` — `import { toast } from 'sonner'`.
- **Charts**: Only `recharts`.
- **Drag & drop**: Only `@dnd-kit`.
- **Forms**: `react-hook-form` + `zod`.
- **Client state**: `useState`/`useContext` only — no Redux, Zustand, etc.

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
- `debug_payloads` — temporary debug logging for API payloads

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
