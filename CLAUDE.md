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

## ⚠️ GRANDE REFORMULAÇÃO — Plataforma unificada (2026-07-06)

> Plano completo em **`conhecimento/planejamento/unificacao/`** (docs 00–06). Resumo do que mudou — **várias seções ABAIXO neste arquivo ficaram desatualizadas** por causa disto:

- **Plataforma única (fim do "pula-pula"):** CRM e Plataforma agora são **uma sidebar só** (`SidebarContent.tsx`), agrupada por tema. Sumiram os botões "Plataforma"/"Acessar CRM". URLs `/crm` e `/plataforma` seguem por baixo.
- **Entitlements por área:** produto = conjunto de **áreas** liberadas; o **CRM virou uma área** (`acesso_crm` gateia a sidebar). `AdminProdutos` monta produto ligando áreas. Acesso vem da RPC `get_my_platform_access` → objeto `acesso` no `PlataformaContext`.
- **Console Athos (`/crm/athos`, `AthosConsole.tsx`):** centraliza as IAs REAIS do CRM sob a marca Athos. Registry em **`src/lib/athosAgents.ts`**. Agentes: **Athos Recepção** (`whatsapp-ai-agent`), **Athos Triagem** (`triage-lead-ia`), **Athos Análise** (`analyze-non-leads`), **Athos Follow-Up** (`analyze-followup-need`+`ia-followup-agent`), **Athos GS** (copiloto `descompliquei-os`), **Athos CS** (`cs-athos`, superadmin). Descartado o catálogo antigo do IAHub (`platform_ia_config`).
  - **On/off por org:** tabela **`athos_agentes_org`** (`organization_id`, `agente_slug`, `ativo`) + helper `athos_agente_ativo(org, slug)`. As edge functions dos 4 agentes de CRM checam esse gate (early-return `{skipped}` se desativado). Hook `useAthosAgentesOrg`. Switch no Console só p/ agentes `enforced` no registry.
  - **Log unificado:** função `get_athos_eventos(p_limit)` (une `triage_ia_logs`+`ia_followup_log`+`ai_execution_logs`) → hook `useAthosEventos` → seção "Atividade recente".
- **Athos GS = especialista comercial (EVA) (2026-07-07):** o Athos GS (`descompliquei-os`) deixou de ser "skill de gerar texto" e virou **especialista comercial** que aplica a metodologia proprietária **EVA** (Estruturação, Validação, Ajuste) com base em dados reais da clínica. O `buildSystemPrompt()` injeta: base de conhecimento comercial condensada (`COMMERCIAL_KNOWLEDGE_BASE`, versão completa em **`conhecimento/plataforma/athos-comercial/*.md`** + `metodologia-eva.md`), um snapshot automático do funil do mês corrente (reaproveita `calcularMetricasPainel`), e regras rígidas de formatação HTML dos materiais. Ver memória `project_unificacao_plataforma`.
- **Materiais via Athos (`/crm/materiais`, `AthosMateriais.tsx`, `useAthosMateriais`):** área premium sobre **`meus_materiais`** (gravada pela tool `criar_material`). **Taxonomia fixa** de categorias em `src/lib/materiaisComerciais.ts` (frontend) + enum `MATERIAL_CATEGORIAS` no `descompliquei-os` (backend — sincronia manual, runtimes diferentes): `script_atendimento`, `estrutura_processo`, `quebra_objecao`, `oferta`, `followup_reativacao`, `otimizacao_comercial`, `outro`. `categoria` é **required** na tool. Editor rico real (`RichEditor.tsx`) — **atenção ao aplicar `EDITOR_STYLES`/`PROSE_STYLES`: use string CRUA, nunca via `cn()`** (tailwind-merge colapsa as classes `text-[...]` do prose). O botão "Criar com o Athos" vai a `/plataforma/athos-gs?acao=criar-material` (abre conversa nova + prompt indicativo).
- **Materiais dentro da conversa (`MaterialsSidebar.tsx`):** painel direito da tela de conversa (`Conversas.tsx`), estado `activePanel: 'materiais' | null`. Materiais é só leitura/consulta (accordion + "Copiar texto"), não envia. O painel é **redimensionável** (arrastar borda esquerda, largura salva no localStorage) e **persiste ao trocar de conversa** (só fecha no X).
- **REMOVIDO — Cérebro Central (2026-07-07):** `platform_cerebro` dropada (migration `20260707000001`), `Cerebro.tsx` deletado, campos `cerebro`/`cerebroPercent`/`isCerebroComplete` fora do `PlataformaContext`, tutorial `platform-cerebro` removido, `ia-proxy` sem a dependência. Não alimentava nenhum agente em uso.
- **REMOVIDO — Trilha de Aprendizado:** por completo (client + admin). Ver memória `project_trilha_removal`. Seção "Materiais Complementares (Trilha…)" abaixo está OBSOLETA.
- **REMOVIDO — Templates + Ferramentas do Arsenal (Fase 3-A):** `Materiais/MateriaisEditor`, `ArsenalCategoria/ArsenalFerramenta`, `AdminArsenal` deletados. **`Arsenal.tsx` mostra só Aulas.** As tabelas `arsenal_ferramentas`/`categorias` **ainda existem** (o copiloto as usa) — o drop destrutivo está STAGED em `supabase/migrations/_PENDENTE_20260706_drop_arsenal_ferramentas.sql` (pendente de patch do copiloto + deploy CLI + backup).
- **REMOVIDO — Mensagens Rápidas (2026-07-13):** feature inteira descartada (sobrepunha Cadências; a tool de IA `agendar_mensagem` nunca funcionou de fato — inseria em coluna NOT NULL sem preenchê-la). Saiu: `QuickMessagesPage.tsx`, `QuickMessagesSidebar.tsx`, `components/quick-messages/*`, hooks `useQuickMessages`/`useQuickMessageFolders`/`useScheduledMessages`, rota `/crm/quick-messages`, item de sidebar, permissão `msgs_rapidas` (`PageKey`), toggle "Rápidas" em `ActiveConversation.tsx`/`Conversas.tsx`/`OutboundConversas.tsx`, tutorial `quick-messages` + steps órfãos, tool `agendar_mensagem` (`descompliquei-os`/`admin-os`), e as tabelas `mensagens_rapidas`/`quick_message_folders`/`scheduled_quick_messages` (dropadas via migration `20260713150000_remove_quick_messages.sql`, que também limpou a dependência dessas tabelas em `blacklist_lead_permanently()`). Edge functions `process-folder-sequence` e `process-scheduled-messages` tiveram o código-fonte local removido, mas **seguem ativas no projeto remoto** (sem CLI access ao projeto `noncbgdczgcboronmcah` para `functions delete` — undeploy manual pendente). `send-quick-message` **continua** — é a função genérica de envio usada por qualquer mensagem no chat, apesar do nome.

**Typecheck:** o codebase **não passa no `tsc`** (centenas de erros pré-existentes: `never`, `possibly null`). Builda via `vite build` (esbuild, sem typecheck). Para validar: `npx tsc -p tsconfig.app.json --noEmit` e olhar só o que quebra runtime — **sintaxe (TS1xxx/TS17002) e `Cannot find name` (TS2304)**. `npx tsc --noEmit` puro na raiz checa NADA (`files:[]`). Deploy de edge functions: MCP inline p/ arquivos pequenos; **arquivos grandes (whatsapp-ai-agent, descompliquei-os) o João deploya via CLI na máquina dele** (`supabase login` + `functions deploy`).

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

**Fontes (regra reforçada na padronização de 2026-07-13):**
- **Título/cabeçalho → SEMPRE `font-display`** (Plus Jakarta Sans). Todo `<h1>/<h2>/<h3>`, `DialogTitle`, título de card/seção/modal DEVE ter `font-display`. Esquecer o `font-display` faz o título cair no DM Sans — foi a principal fonte de inconsistência visual. **Exceção:** overlines/labels minúsculos (`text-[10px]/[11px] uppercase tracking-wide/widest`) e labels de formulário ficam em DM Sans de propósito.
- Body (texto corrido): DM Sans — é a fonte **padrão** (não precisa de classe).
- **Números — convenção de DOIS níveis (nunca os dois juntos na mesma tag):**
  - **FONTE ÚNICA DE NÚMEROS (decisão 2026-07-14):** TODO número/valor/data/métrica/contador exibido usa `font-display tabular-nums` (Plus Jakarta) — do KPI grande à célula de tabela. Um número só tem UMA fonte em toda a plataforma.
  - ❌ **NUNCA** `font-mono` em número/valor/data da interface (parece "código" — foi reprovado pelo dono). `font-mono` fica APENAS para código cru/JSON/IDs/payloads em blocos de código.
  - ❌ NUNCA `font-display font-mono` na mesma className (conflito de família).

**Cards / Containers:**
```
rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden
```

**Cards de métrica / KPI — use SEMPRE `<StatCard>` (canônico, decidido em 2026-07-13):**

Todo card de número/métrica de QUALQUER página usa `src/components/StatCard.tsx` — não recrie card de KPI inline. Garante mesma estrutura, fonte (`text-[28px] font-bold font-display tabular-nums`) e espaçamento em toda a plataforma.
```tsx
import { StatCard, StatCardGrid } from '@/components/StatCard';
import { formatBRL, formatInt, formatPct } from '@/lib/format';

<StatCardGrid cols={4}>
  <StatCard label="FATURAMENTO" value={formatBRL(x)} icon={DollarSign} />
  <StatCard label="LEADS" value={formatInt(n)} delta={{ label: '+12%', positive: true }} />
</StatCardGrid>
// Card isolado: <StatCard standalone ... />  ·  cor de categoria: dotColor
```
- **Formatação de número:** SEMPRE via `@/lib/format` (`formatBRL` = `R$ 80.300` completo, 0 casas; `formatInt`; `formatPct`; `formatNum`). ❌ **PROIBIDO abreviar** métrica (`80.3K`, `1.2M`) — só tamanho de arquivo (KB/MB) pode abreviar.
- Exceções (não são "card de KPI"): gauges/anéis de progresso (`Performance.tsx`), heros escuros com gradiente (`Metas` "Ritmo Necessário"/Simulador) — famílias visuais próprias.

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

**Page Headers — `PageHero` é o cabeçalho CANÔNICO (decidido em 2026-07-13):**

Toda página de conteúdo usa o componente `src/components/PageHero.tsx` (fundo escuro quente + glow laranja + pill translúcido). **Não** reconstrua cabeçalho na mão nem duplique o hero.
```tsx
import { PageHero } from '@/components/PageHero';
<PageHero icon={IconLucide} title="Título" titleAccent="Subtítulo" subtitle="Descrição"
          dataTutorial="pagina-header" right={<BotaoAcao />} />
```
- Botões no slot `right` ficam sobre fundo escuro → usar tom translúcido branco (`bg-white/10 border-white/15 text-white`), NÃO `bg-foreground text-background`.
- Preserve o `data-tutorial` do cabeçalho antigo passando-o na prop `dataTutorial`.
- **Exceção (não usa PageHero):** telas de login/auth (identidade própria). O `Dashboard` **usa** o `PageHero` no cabeçalho (decisão de 2026-07-13), preservando o layout condicional `isDescompliqueiOrg` (funil/KPIs) logo abaixo do hero.

O "Page Header" simples abaixo (ícone + `h1 font-display` + descrição `ml-10`) só é usado em sub-telas/breadcrumbs onde o hero grande pesaria demais:
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
- `arsenal_categorias` — categorias de ferramentas do Arsenal. Columns: `id`, `nome`, `slug`, `descricao`, `icone`, `cor`, `ordem_index`, `ativo`.
- `arsenal_ferramentas` — ferramentas do Arsenal (construções práticas). Columns: `id`, `categoria_id` (FK → `arsenal_categorias`), `nome`, `slug`, `descricao`, `conteudo_json` (JSONB — campos do formulário), `ativo`, `ordem_index`. **`arsenal_categorias` não tem coluna `ativo` — nunca filtrar por ela.**
- `arsenal_blocos` — blocos (seções) do Arsenal de Aulas. Columns: `id`, `nome`, `slug`, `descricao`, `ordem_index`, `ativo`.
- `arsenal_aulas` — aulas dentro dos blocos. Columns: `id`, `bloco_id` (FK → `arsenal_blocos`), `nome`, `slug`, `descricao`, `video_url`, `duracao_minutos`, `ordem_index`, `ativo`.
- `arsenal_aulas_progresso` — progresso por usuário nas aulas. Columns: `id`, `user_id` (= `auth.uid()`), `aula_id` (FK → `arsenal_aulas`), `concluido`, `concluido_em`.
- `jornadas` — jornadas personalizadas geradas pelo Athos GS. Columns: `id`, `user_id` (= `auth.uid()`), `titulo`, `status` (`'rascunho'` | `'ativa'` | `'concluida'`), `gerada_por` (`'ia'` | `'admin'`), `created_at`, `updated_at`.
- `jornada_estagios` — etapas de uma jornada. Columns: `id`, `jornada_id` (FK → `jornadas`), `titulo`, `descricao`, `ordem`, `prazo_dias`, `data_inicio`.
- `jornada_passos` — passos dentro de uma etapa. Columns: `id`, `estagio_id` (FK → `jornada_estagios`), `titulo`, `descricao`, `ordem`, `tipo` (`'acao_livre'` | `'ferramenta_arsenal'` | `'categoria_arsenal'`), `ferramenta_id` (FK → `arsenal_ferramentas`), `categoria_id` (FK → `arsenal_categorias`), `aula_id` (FK → `arsenal_aulas` — `ON DELETE SET NULL`), `prazo_dias`, `obrigatorio`, `concluido`, `concluido_em`, `concluido_por`.
- `athos_agentes` — configurações de agentes da DescompliqueiOS. Columns: `id`, `slug`, `nome`, `descricao`, `system_prompt`, `ativo`. O `system_prompt` pode conter `[INSERIDO AUTOMATICAMENTE PELO SISTEMA]` como placeholder — a edge function `descompliquei-os` substitui por dados do diagnóstico do usuário antes de enviar à IA.
- `os_conversations` — histórico de conversas com agentes OS. Columns: `id`, `user_id` (= `auth.uid()`), `titulo`, `agente_slug` (TEXT), `created_at`, `updated_at`.
- `os_memories` — memória persistente do Athos GS entre conversas. Columns: `id`, `user_id` (= `auth.uid()`), `organization_id`, `tipo` (`'preferencia'` | `'fato'` | `'decisao'` | `'instrucao'` | `'contexto'`), `conteudo` (TEXT), `tags` (text[]), `fonte_conversation_id` (FK → `os_conversations`, nullable), `criado_em`, `atualizado_em`. Populada via tools explícitas (salvar_memoria) e auto-extração ao final de cada conversa.

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
- `descompliquei-os` — chat handler para DescompliqueiOS. Substitui placeholder `[INSERIDO AUTOMATICAMENTE PELO SISTEMA]` no system_prompt com dados do diagnóstico. Expõe a tool `criar_jornada` que salva `jornadas` + `jornada_estagios` + `jornada_passos` no Supabase.
- `send-appointment-confirmation` — envia WhatsApp de confirmação imediata ao criar agendamento (se `notif_confirmacao_ativa = true` na config da org)
- `process-appointment-notifications` — cron de lembretes de agendamento. Janela de 5 min. Usa `agendamento_notificacoes` para dedup (status `'cancelado'` = não enviar).

---

## Arsenal da Plataforma

O Arsenal é a caixa de ferramentas comerciais da plataforma, com duas seções: **Aulas** (vídeo com blocos/módulos) e **Ferramentas** (construções por categoria).

### Arquitetura de arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/pages/plataforma/Arsenal.tsx` | Listagem — hero + abas "Aulas" / Ferramentas por categoria |
| `src/pages/plataforma/ArsenalAula.tsx` | Página de aula individual — vídeo, descrição, botão concluir. Rota: `/plataforma/arsenal/aulas/:slug` |
| `src/pages/plataforma/ArsenalFerramenta.tsx` (ou caminho similar) | Página de ferramenta individual. Rota: `/plataforma/arsenal/:categoriaSlug/:ferramentaSlug` |
| `src/hooks/useArsenalAulas.ts` | Hook para aulas e progresso por usuário |
| `src/hooks/useAdminArsenal.ts` | Hooks admin — `useAdminFerramentas()`, `useAdminCategorias()`, etc. |
| `src/pages/admin-os/pages/AdminArsenal.tsx` | Gestão admin de ferramentas |
| `src/pages/admin-os/pages/AdminArsenalAulas.tsx` | Gestão admin de aulas |

### Rotas do Arsenal

```
/plataforma/arsenal                          → Arsenal.tsx (listagem)
/plataforma/arsenal/aulas/:slug              → ArsenalAula.tsx (aula individual)
/plataforma/arsenal/:categoriaSlug/:slug     → ArsenalFerramenta.tsx (ferramenta individual)
/plataforma/arsenal/:categoriaSlug           → categoria filtrada na listagem
```

### Regras críticas

- **`arsenal_categorias` NÃO tem coluna `ativo`** — nunca fazer `.eq('ativo', true)` nessa tabela. Apenas `arsenal_ferramentas` e `arsenal_aulas` têm `ativo`.
- **Progresso de aulas** salvo em `arsenal_aulas_progresso` com `user_id = auth.uid()`. Usar `useArsenalAulas.ts` — nunca query direta de componente.
- **Admin hooks**: sempre usar `useAdminFerramentas()` e `useAdminCategorias()` de `useAdminArsenal.ts` nos painéis admin — têm cache keys corretas e queries sem `ativo` em categorias.

---

## Jornada Personalizada (Plataforma)

Jornada de implementação personalizada criada pelo Athos GS para cada cliente. Distinta da **Jornada do Paciente** (CRM/timeline de lead).

### Arquitetura de arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/pages/plataforma/Jornada.tsx` | Visualização do cliente — lista etapas com locking sequencial, passos com botão "Abrir" |
| `src/hooks/useJornada.ts` | Hook principal — `useJornada()`, `useMarcarPassoConcluido()`, helpers `getEstagioStatus()`, `getJornadaProgress()` |
| `src/hooks/useAdminJornadas.ts` | Hooks admin — CRUD de jornadas, `useSaveJornadaEstrutura()`, `jornadaToDraft()` |
| `src/pages/admin-os/pages/AdminJornadaEditor.tsx` | Editor admin de estrutura da jornada — etapas + passos |
| `src/lib/jornadaUtils.ts` | Utilitários de jornada |

### Tipos de passo (`DraftPasso.tipo`)

| tipo | Descrição | FK preenchida |
|------|-----------|---------------|
| `'acao_livre'` | Passo sem vínculo de ferramenta | nenhuma |
| `'ferramenta_arsenal'` | Ferramenta do Arsenal | `ferramenta_id` |
| `'categoria_arsenal'` | Categoria do Arsenal | `categoria_id` |
| `'aula_arsenal'` | Aula do Arsenal (editor admin) | `aula_id` |

> **Atenção:** Na DB e na tool do Athos, aulas são salvas com `tipo = 'ferramenta_arsenal'` e `aula_id` preenchido. O tipo `'aula_arsenal'` só existe no estado de rascunho do editor admin (`DraftPasso`). O `useSaveJornadaEstrutura` converte `'aula_arsenal'` → `'ferramenta_arsenal'` + `aula_id` ao salvar.

### Locking sequencial de etapas

Etapas são bloqueadas até a anterior ser concluída:

```tsx
// Em Jornada.tsx
isLocked={i > 0 && getEstagioStatus(estagios[i - 1]) !== 'concluido'}
```

`getEstagioStatus()` retorna `'nao_iniciado' | 'em_andamento' | 'concluido'`. Uma etapa é `'concluido'` quando todos os passos obrigatórios estão concluídos (ou todos os passos se não houver obrigatórios).

### Botão "Abrir" nos passos

```tsx
// handleOpen() em PassoRow (Jornada.tsx)
if (passo.tipo === 'ferramenta_arsenal' && passo.arsenal_ferramentas) {
  navigate(`/plataforma/arsenal/${categoria.slug}/${ferramenta.slug}`);
} else if (passo.aula_id && passo.arsenal_aulas) {
  navigate(`/plataforma/arsenal/aulas/${passo.arsenal_aulas.slug}`);
} else if (passo.tipo === 'categoria_arsenal' && passo.arsenal_categorias) {
  navigate(`/plataforma/arsenal/${categoria.slug}`);
}
```

O `useJornada()` faz join em `arsenal_aulas (id, slug)` além de `arsenal_ferramentas` e `arsenal_categorias`.

### Tool `criar_jornada` no Athos (edge function `descompliquei-os`)

Ao montar a jornada, o Athos usa `ferramenta_slug` para vincular passos. A edge function resolve slugs contra **dois mapas**:
1. `slugMap` — slugs de `arsenal_ferramentas` → `ferramenta_id`
2. `aulaSlugMap` — slugs de `arsenal_aulas` → `aula_id`

Regras:
- `tipo: 'aula'` do Athos é normalizado para `tipo: 'ferramenta_arsenal'` automaticamente
- O Athos **DEVE** usar sempre `tipo: 'ferramenta_arsenal'` para aulas e ferramentas — nunca `tipo: 'aula'`
- Se o slug resolve em `aulaSlugMap`, o passo recebe `aula_id` (e `ferramenta_id = null`)
- Se resolve em `slugMap`, recebe `ferramenta_id` (e `aula_id = null`)

### data-tutorial na Jornada

- `data-tutorial="jornada-header"` — hero principal da página Jornada (usado pelo platform-tour step 4)
- `tutorialTargetMap` em `SidebarContent.tsx`: `/plataforma/jornada` → `sidebar-jornada`, `/plataforma/os` → `sidebar-os`

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
| `automacao` | Automação | ia, cadences |
| `sistema` | Sistema | settings |
| `onboarding` | (oculto) | onboarding-perfil, onboarding-etiquetas, onboarding-procedimentos, onboarding-equipe, **platform-tour** |

> **IMPORTANTE:** Tutoriais com `category: 'onboarding'` são **excluídos** da Central de Ajuda (`TutorialHelpCenter.tsx`) e do contador de progresso. Devem estar **dentro** do array `tutorials` em `tutorialData.ts` — caso contrário o `TutorialSpotlight` não os encontra e nada é exibido.

### Mapa completo: página → tutorial → data-tutorial principais

| Página | Tutorial ID | Elementos principais |
|--------|------------|---------------------|
| `Dashboard.tsx` | `dashboard` | `dashboard-period`, `dashboard-metrics`, `dashboard-funnel`, `dashboard-chart` |
| `Conversas.tsx` | `conversas` | `conversas-list`, `conversas-search`, `conversas-filters` |
| `Notifications.tsx` | `notificacoes` | `notificacoes-tabs`, `notificacoes-filters`, `notificacoes-list`, `notificacoes-card`, `notificacoes-resolver`, `notificacoes-limpar` |
| `Leads.tsx` | `leads` | `leads-add`, `leads-filters-advanced`, `leads-pagination`, `leads-row-actions`, `leads-bulk-bar`, `leads-origin-filter`, `leads-tags-filter` |
| `LeadModal.tsx` | (modal do leads) | `lead-modal`, `lead-field-nome`, `lead-field-telefone`, `lead-field-origem`, `lead-field-fonte`, `lead-field-etapa`, `lead-field-data`, `lead-submit` |
| ~~`Pipeline.tsx`~~ | ~~`pipeline`~~ | **REMOVIDO** — pipeline foi eliminado do CRM |
| `Agendamentos.tsx` | `agendamentos` | `agendamentos-header`, `agendamentos-config`, `agendamentos-tabs`, `agendamentos-filters`, `agendamentos-upcoming`, `agendamentos-metrics` |
| `AgendamentoLeadModal` | (modal de agendamentos) | `agendamento-modal`, `agendamento-field-lead`, `-titulo`, `-tipo`, `-duracao`, `-data`, `-cor`, `-obs`, `agendamento-submit` |
| `Vendas.tsx` | `vendas` | `vendas-header`, `vendas-filters`, `vendas-metrics`, `vendas-row` |
| `VendaModal.tsx` | (modal de vendas) | `venda-modal`, `venda-field-cliente`, `-procedimento`, `-valor`, `-data`, `-pagamento`, `venda-submit` |
| `Metas.tsx` | `metas` | `metas-header`, `metas-month`, `metas-edit`, `metas-funnel`, `metas-tabs`, `metas-historico`, `metas-projecao`, `metas-criar` |
| `AiSettings.tsx` | `ia` | `ia-tabs`, `ia-status`, `ia-toggle`, `ia-prompt`, `ia-save`, `ia-field-identity`, `ia-field-voice`, `ia-field-procedures`, `ia-field-faq`, `ia-field-horario`, `ia-field-pagamento`, `ia-field-instructions`, `ia-logs` |
| `AiFollowupConfig.tsx` | (sub-componente ia) | `ia-followup-config` |
| `AiFollowupTab.tsx` | (sub-componente ia) | `ia-followup-history` |
| `Cadences.tsx` | `cadences` | `cadences-tabs`, `cadences-list`, `cadences-create`, `cadences-card`, `cadences-dispatch`, `cadences-monitoring`, `cadences-report` |
| `CadenceModal.tsx` | (modal de cadências) | `cadence-modal-identity`, `cadence-field-nome`, `cadence-field-descricao`, `cadence-steps`, `cadence-add-step`, `cadence-submit` |
| `Settings.tsx` | `settings` | `settings-nav`, `settings-nav-{id}`, `settings-profile`, `settings-pipeline`, `settings-sources`, `settings-tags`, `settings-marca`, `settings-whatsapp`, `settings-appearance`, `settings-security` |
| `Hub.tsx` (plataforma) | (platform-tour step 2, 8) | `hub-tools`, `hub-tool-{id}` |
| `Arsenal.tsx` (plataforma) | (platform-tour step 3) | `arsenal-header` |
| `Jornada.tsx` (plataforma) | (platform-tour step 4) | `jornada-header` |
| `Materiais.tsx` (plataforma) | (platform-tour step 5) | `materiais-header` |
| `SidebarContent.tsx` | (platform-tour) | `sidebar-hub`, `sidebar-jornada`, `sidebar-arsenal`, `sidebar-materiais`, `sidebar-os`, `sidebar-sessoes` |

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

> **⚠️ REMOVIDO:** O Pipeline (Kanban, etapas, métricas de funil) foi **completamente removido** do CRM. Não existem mais as páginas `Pipeline.tsx`, `FunnelMetricsTab.tsx`, `PipelineSettings.tsx` nem os hooks `useFunnelMetrics.ts`, `useStages.ts`, `useStagesManager.ts`. A tabela `etapas` ainda existe no banco mas não é mais usada pela interface. Não recriar essas telas sem instrução explícita.

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

---

## Agendamentos

Sistema completo de agendamentos com notificações automáticas via WhatsApp.

### Arquitetura de arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/pages/Agendamentos.tsx` | Página principal — lista, filtros, modal de criação/edição inline |
| `src/components/agendamentos/AgendamentoLeadModal.tsx` | Modal de agendamento acessível a partir da conversa (chat view) |
| `src/components/agendamentos/ConfigNotificacoes.tsx` | Config de lembretes automáticos por org |
| `src/hooks/useAgendamentos.ts` | CRUD de agendamentos |
| `src/hooks/useAgendamentoFinanceiroConfig.ts` | Config financeira — valor padrão de consulta, abatimento |

### Tabelas

- `agendamentos` — campos: `id`, `organization_id`, `lead_id`, `titulo`, `tipo` (`'consulta'` | `'procedimento'`), `data_hora_inicio`, `data_hora_fim`, `duracao_minutos`, `cor`, `valor_orcado`, `procedimento_interesse`, `observacoes`, `status` (`'agendado'` | `'confirmado'` | `'realizado'` | `'cancelado'` | `'faltou'`)
- `agendamento_config_notificacoes` — config por org: `notif_ativa` (bool), `lembretes` (jsonb `[{ativo, minutos_antes}]`), `mensagem_lembrete` (template), `notif_confirmacao_ativa`, `mensagem_confirmacao`
- `agendamento_notificacoes` — tabela de dedup para o cron de lembretes. Campos: `agendamento_id`, `organization_id`, `antecedencia_minutos`, `status` (`'enviado'` | `'pendente'` | `'cancelado'`). Status `'cancelado'` é inserido pelo frontend quando `ativarFluxo = false` — o cron verifica esta tabela antes de enviar e pula registros existentes.
- `agendamento_notif_log` — log de execução de cada disparo (exibido no histórico do frontend)

### Edge Functions de agendamentos

- `send-appointment-confirmation` — envia mensagem de confirmação imediata ao criar agendamento (se `notif_confirmacao_ativa = true` na config da org)
- `process-appointment-notifications` — cron que verifica agendamentos futuros e envia lembretes dentro da janela de 5 minutos antes do horário configurado. Usa `agendamento_notificacoes` para dedup.

### Tipos de agendamento

Apenas dois tipos: `consulta` e `procedimento`. O tipo `online` foi removido (mantinha campo de link de videochamada que não era usado).

### Design dos modais (padrão unificado)

Os dois modais (`AgendamentoLeadModal` e o modal inline em `Agendamentos.tsx`) seguem o **mesmo design**. Ao editar um, atualizar o outro também.

**Campos em ordem:**
1. Lead (seleção por busca)
2. Título (auto-preenchido ao mudar tipo/lead)
3. Tipo + Duração (lado a lado) — duração com botões preset: 30min / 45min / 1h / 1h30 / 2h
4. Procedimento (apenas quando `tipo === 'procedimento'`)
5. Valor (CurrencyInput — ver padrão abaixo)
6. Data e Hora de Início — calendar popover + selects de hora e minuto
7. Cor do evento
8. Observações
9. Toggle "Ativar fluxo de notificações"

**Data/hora — padrão obrigatório:**
```tsx
// NUNCA usar <input type="datetime-local"> — usar calendar popover + selects
<Popover> {/* calendar shadcn/ui para a data */}
  <Calendar selected={data} onSelect={handleDateChange} locale={ptBR} />
</Popover>
// Hora e minuto: ícone Clock FORA do SelectTrigger, não dentro
<div className="flex items-center gap-1.5 shrink-0">
  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  <Select value={hora}> <SelectTrigger className="w-[62px] tabular-nums"> ... </SelectTrigger> </Select>
  <span>:</span>
  <Select value={minuto}> <SelectTrigger className="w-[60px] tabular-nums"> ... </SelectTrigger> </Select>
</div>
```
> **Anti-pattern:** colocar o ícone `Clock` dentro do `SelectTrigger` espreme o valor e corta a exibição (ex: "08l" em vez de "08").

**Toggle de notificações:**
```tsx
// Card toggle — NÃO usar checkbox simples
<div className="rounded-xl border border-border/60 px-4 py-3 flex items-center justify-between bg-muted/20">
  <div className="flex items-center gap-2.5">
    {ativarFluxo ? <Bell ... /> : <BellOff ... />}
    <div>
      <p className="text-sm font-medium">Ativar fluxo de notificações</p>
      <p className="text-[11px] text-muted-foreground/60">...</p>
    </div>
  </div>
  <Switch checked={ativarFluxo} onCheckedChange={setAtivarFluxo} />
</div>
```

**Pré-cancelamento de notificações (`ativarFluxo = false`):**
Quando o agendamento é salvo com `ativarFluxo = false`, inserir linhas com `status = 'cancelado'` em `agendamento_notificacoes` para todos os lembretes ativos da config da org. Isso garante que o cron `process-appointment-notifications` pule esse agendamento.

### Abatimento da consulta — regra crítica

`financeiroConfig.consulta_abatimento_ativo` controla se existe desconto do valor da consulta no procedimento. **Este abatimento é aplicado APENAS no `VendaModal` (fechamento), NUNCA no modal de agendamento.** Não exibir nenhum banner ou preview de abatimento nos modais de agendamento — é informação prematura que confunde a equipe.

---

## CurrencyInput

Componente em `src/components/CurrencyInput.tsx` para campos monetários em BRL.

```tsx
import { CurrencyInput } from "@/components/CurrencyInput";

<CurrencyInput
  value={form.valor}                          // number | null | undefined
  onValueChange={(v) => setForm(f => ({ ...f, valor: v ?? null }))}
  className="h-10 text-sm rounded-lg border-border/60"
/>
```

- Formata automaticamente como `R$ X,XX` usando `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Placeholder padrão: `R$ 0,00`
- Usado em: `VendaModal.tsx`, `AgendamentoLeadModal.tsx`, `Agendamentos.tsx` (modal inline), `MarketingSpendModal.tsx`
- **NUNCA usar `<Input type="number">` com prefixo `R$` manual para valores monetários** — usar este componente.

---

## Onboarding da Plataforma (Athos GS)

Sistema de onboarding específico da **plataforma** (distinto do onboarding do CRM). Guia o cliente pelo diagnóstico inicial e conversa com o Athos GS para montar a Jornada.

### Tabelas-chave

| Tabela | user_id | Descrição |
|--------|---------|-----------|
| `platform_users` | `id = auth.uid()` | Flags de controle do onboarding da plataforma |
| `onboarding_diagnosticos` | `user_id = auth.uid()` | Respostas do formulário diagnóstico |
| `onboarding_progresso` | `user_id = auth.uid()` | Etapa atual (`diagnostico` → `athos` → `concluido`) e bloco atual |
| `jornadas` | `user_id = auth.uid()` | Jornada gerada pelo Athos GS |
| `os_conversations` | `user_id = auth.uid()` | Conversas com agentes OS (tem coluna `agente_slug TEXT`) |

### Colunas críticas em `platform_users`

| Coluna | Tipo | Significado |
|--------|------|-------------|
| `id` | uuid | **Igual ao `auth.uid()`** — usar `.eq("id", user.id)` para queries |
| `crm_user_id` | uuid | Também igual ao `auth.uid()` — usado quando a tabela tem coluna `crm_user_id` |
| `platform_onboarding_enabled` | bool | `true` = este cliente tem o onboarding da plataforma ativo |
| `onboarding_concluido` | bool | `true` = passou pelo Athos e a jornada foi salva |
| `onboarding_complete` | bool | `true` = concluiu o checklist "Configure sua plataforma" pós-Athos |

**ATENÇÃO:** `platform_users.id` e `platform_users.crm_user_id` são ambos `= auth.uid()`. Para tabelas como `jornadas` e `onboarding_diagnosticos` que usam `user_id`, sempre usar `user.id` diretamente.

### Fluxo completo

```
1. Usuário acessa plataforma → OnboardingGuard detecta onboarding_concluido=false
2. Redirect → /plataforma/onboarding (Onboarding.tsx)
3. onboarding_progresso.etapa = 'diagnostico' → exibe formulário diagnóstico
4. Usuário preenche diagnóstico → concluirDiagnostico() → etapa='athos'
5. navigate('/plataforma/os?agente=onboarding')
6. DescompliqueiOS.tsx → Athos GS conversa e monta jornada em JSON
7. salvarJornadaOS() salva em `jornadas` → onboarding_concluido=true no DB
8. setConcluido() atualiza PlataformaContext local → OnboardingPlataformaModal aparece
9. Usuário conclui checklist → onboarding_complete=true → libera plataforma completa
```

### Arquitetura de arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/pages/plataforma/Onboarding.tsx` | Formulário diagnóstico + redirect para Athos |
| `src/hooks/useOnboardingDiagnostico.ts` | Hook do diagnóstico — lê/salva respostas, `concluirDiagnostico()`, `concluirOnboarding()` |
| `src/pages/plataforma/DescompliqueiOS.tsx` | Chat OS com agentes — salva jornada, chama `setConcluido()` |
| `src/components/plataforma/OnboardingGuard.tsx` | Guard que redireciona para `/plataforma/onboarding` quando `onboarding_concluido=false` |
| `src/components/plataforma/OnboardingPlataformaModal.tsx` | Modal "Configure sua plataforma" — aparece após Athos (fase 2) |
| `src/components/plataforma/OnboardingPlataformaChecklist.tsx` | Checklist flutuante (fase 2) |
| `src/contexts/PlataformaContext.tsx` | Contexto central — `plataformaUser`, `showOnboarding`, `setConcluido()` |

### Regras críticas do OnboardingGuard

- **`/plataforma/os` está FORA do `OnboardingGuard`** em `App.tsx`. Isso é intencional — a rota `/plataforma/os` é parte do próprio fluxo de onboarding (conversa com Athos). Se colocada dentro do guard, cria loop infinito:  
  `OnboardingGuard → /plataforma/onboarding → navigate(/plataforma/os) → OnboardingGuard → ...`
- `OnboardingGuard` retorna `<Outlet />` (não `null`) enquanto `isContextLoading=true` para evitar flash em branco.

### Condições do OnboardingPlataformaModal

```tsx
// Modal SÓ aparece quando onboarding_concluido=true (Athos concluído) E onboarding_complete=false (checklist pendente)
const onboardingConcluido = plataformaUser?.onboarding_concluido === true;
if (isSuperAdmin || !onboardingEnabled || onboardingComplete || !onboardingConcluido) return null;
```

**Anti-pattern:** o modal NÃO pode aparecer durante o diagnóstico ou durante a conversa com o Athos (quando `onboarding_concluido=false`). A condição `!onboardingConcluido` protege contra isso.

### showOnboarding no PlataformaContext

```tsx
showOnboarding: plataformaUser?.platform_onboarding_enabled === true
             && plataformaUser?.onboarding_complete === false
             && plataformaUser?.onboarding_concluido === true
             && !isContextLoading,
```

### setConcluido — atualização local do contexto

Após `salvarJornadaOS()` em `DescompliqueiOS.tsx`, o DB é atualizado E o contexto local é sincronizado via `setConcluido()` para que o modal apareça imediatamente sem reload:

```tsx
salvarJornadaOS(jornada, user.id).then(async ok => {
  if (ok) {
    await supabase.from("platform_users")
      .update({ onboarding_concluido: true })
      .eq("crm_user_id", user!.id);
    setConcluido(); // atualiza PlataformaContext local
  }
});
```

### Prevenção de re-fetch desnecessário no PlataformaContext

```tsx
// ✅ CORRETO — só re-fetcha quando o ID do usuário muda (não a cada token refresh)
}, [user?.id, authLoading]);

// ❌ ERRADO — re-fetcha a cada TOKEN_REFRESHED (novo objeto user) causando flash em branco
}, [user, authLoading]);
```

O Supabase dispara `TOKEN_REFRESHED` periodicamente criando novo objeto `user`. Usar `user?.id` evita re-fetches desnecessários.

---

## DescompliqueiOS — Agentes OS

Página `/plataforma/os` — chat com agentes Athos GS.

### Tabela `athos_agentes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `slug` | text | Identificador único (ex: `onboarding`) |
| `nome` | text | Nome exibido |
| `descricao` | text | Descrição curta |
| `system_prompt` | text | Prompt do sistema |
| `ativo` | bool | Se aparece na lista |

**"Athos GS" NÃO é listado como agente na UI** — é o nome do sistema, não um agente selecionável.

### system_prompt e placeholder de diagnóstico

O campo `system_prompt` do agente `onboarding` contém `[INSERIDO AUTOMATICAMENTE PELO SISTEMA]` como marcador. A edge function `descompliquei-os` substitui esse placeholder pelos dados do `onboarding_diagnosticos` do usuário antes de enviar à IA. Isso contextualiza o Athos com as informações da clínica sem duplicar o diagnóstico no banco.

### UI de seleção de agentes

Sidebar tem um botão `Bot` icon que abre um **floating panel** (não cards expostos). Agente ativo aparece como badge pill no header do chat com `X` para dispensar.

### Sistema de Memória Persistente

O Athos GS possui memória persistente entre conversas, armazenada na tabela `os_memories`.

**Componentes:**
1. **Tools explícitas** — `salvar_memoria`, `buscar_memorias`, `atualizar_memoria`, `apagar_memoria` — permitem ao usuário e ao Athos gerenciar memórias diretamente
2. **Auto-extração** — ao final de cada conversa (fire-and-forget), uma chamada LLM leve (GPT-5.4-nano, 15s timeout) analisa a troca e salva até 3 fatos/preferências/decisões novos automaticamente
3. **Injeção no system prompt** — `buildSystemPrompt` carrega até 30 memórias e as injeta como contexto no prompt do Athos
4. **Dedup** — `salvar_memoria` verifica se já existe memória similar antes de criar uma nova
5. **Cache invalidation** — qualquer operação de memória invalida o cache do system prompt

**Tipos de memória:** `preferencia`, `fato`, `decisao`, `instrucao`, `contexto`

**Janela de histórico:** o frontend envia as últimas 10 mensagens completas ao backend.

### Tool Filtering Dinâmico

O Athos usa **filtragem dinâmica de tools** para reduzir tokens de input em ~50-70%. Em vez de enviar todas as ~55 tools em cada chamada, a função `selectToolsForMessage` analisa a mensagem do usuário + histórico recente por keywords e seleciona apenas as tools relevantes.

**Categorias:** `leads`, `conversas`, `metricas`, `agendamentos`, `vendas`, `cadencias`, `metas`, `config`, `plataforma`, `memoria`

**Regras de co-dependência:**
- `conversas` → inclui `leads` (encadeamento obter_lead → buscar_conversas)
- `agendamentos`/`vendas`/`cadencias` → inclui `leads`

**Always-include:** `obter_lead_completo` e `buscar_leads` estão sempre disponíveis.

**Fallback:** se nenhuma categoria bater, envia apenas tools de `memoria` + always-include (conversa pura).

**Logs:** cada chamada loga `[tool-filter] "msg..." → categories: [...] → X/Y tools` para diagnóstico.

### Salvar conversa com agente

O `agente_slug` na tabela `os_conversations` deve ser atualizado com `await` antes de chamar `loadConversations()`:

```tsx
// ✅ CORRETO — await garante que o update commitou antes de recarregar a lista
await supabase.from("os_conversations").update({ agente_slug: slug }).eq("id", convId);
await loadConversations();
```

---

## Admin — Reiniciar Onboarding de Cliente

Em `AdminClientePerfil.tsx`, o botão "Reiniciar" executa a função RPC `admin_reset_onboarding_to_athos` via Supabase (SECURITY DEFINER — bypass de RLS).

### IDs importantes

- `client.id` = `platform_users.id` (para queries na tabela `platform_users`)
- `client.crm_user_id` = `auth.uid()` do cliente (para queries em `jornadas`, `onboarding_diagnosticos`, `os_conversations`)

### Função RPC `admin_reset_onboarding_to_athos`

Reset parcial (mantém diagnóstico preenchido, pula direto para Athos):

```sql
-- Reseta flags de onboarding
UPDATE platform_users SET
  onboarding_concluido = false,
  platform_onboarding_enabled = true,
  platform_onboarding_steps = '{}',
  onboarding_iniciado_em = null,
  onboarding_concluido_em = null
WHERE id = p_platform_user_id;

-- Força etapa = 'athos' (pula o diagnóstico)
UPDATE onboarding_progresso SET etapa = 'athos', bloco_atual = 8
WHERE user_id = p_auth_user_id;

-- Deleta jornada e conversa anterior com Athos
DELETE FROM jornadas WHERE user_id = p_auth_user_id;
DELETE FROM os_conversations WHERE user_id = p_auth_user_id AND agente_slug = 'onboarding';
-- NÃO deleta onboarding_diagnosticos nem materiais de diagnóstico
```

**Por que SECURITY DEFINER:** RLS impede um admin de deletar registros de outro usuário. A função roda como owner (sem RLS).

### Chamada no frontend

```tsx
const { error } = await supabase.rpc('admin_reset_onboarding_to_athos', {
  p_platform_user_id: client.id,       // platform_users.id
  p_auth_user_id: client.crm_user_id,  // auth.uid() do cliente
});
```

**Após o reset:** o cliente precisa recarregar a página para que o `PlataformaContext` busque os dados atualizados do DB. O contexto só re-fetcha quando `user?.id` muda ou a página é recarregada.
