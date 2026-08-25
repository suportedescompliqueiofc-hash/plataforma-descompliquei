# Performance de SPA React + Supabase + Vercel — pesquisa 2025-2026

> Documento de pesquisa (somente leitura, nada foi alterado no repo). Fontes oficiais/recentes priorizadas.

---

## 1. Supabase performance

### 1.1 Índices em foreign keys
Foreign keys **não** ganham índice automático no Postgres. Sem índice, todo `JOIN`/delete em cascata faz seq scan. O Performance Advisor do Supabase (Dashboard → Database → Performance Advisor) sinaliza FKs sem índice automaticamente.
- [Managing Indexes in Postgres](https://supabase.com/docs/guides/database/postgres/indexes)
- [Performance and Security Advisors](https://supabase.com/docs/guides/database/database-advisors)
- [index_advisor extension](https://supabase.com/docs/guides/database/extensions/index_advisor) — roda direto no SQL Editor/Query Performance Report, sugere índice pra uma query específica.

### 1.2 `(select auth.uid())` em vez de `auth.uid()` — o "init-plan trap"
O ganho mais citado em 2025 nas discussões oficiais do Supabase. `auth.uid()` chamado direto dentro de `USING(...)`/`WITH CHECK(...)` é **reavaliado linha a linha**: numa tabela de 500k linhas, 500k chamadas de função. Envolver em `(select auth.uid())` faz o planner do Postgres tratá-lo como subquery de uma linha só, transformando em **InitPlan** — roda **uma vez** por query, todo o resto compara contra um literal.
- Trocar: `auth.uid() = user_id` → `(select auth.uid()) = user_id`
- O lint `auth_rls_initplan` do próprio Performance Advisor detecta esse padrão automaticamente.
- [Supabase Docs — RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [GitHub Discussion #14576 — RLS Performance and Best Practices](https://github.com/orgs/supabase/discussions/14576)
- [76 RLS policies rewritten in one migration — o auth.uid() init-plan trap](https://dev.to/arvavit/76-rls-policies-rewritten-in-one-migration-the-authuid-init-plan-trap-in-supabase-4hg)

### 1.3 `security definer` functions para políticas complexas
Quando a policy tem JOIN inline (ex: checar se o usuário pertence à `organization_id` via tabela de membros), trocar o JOIN por uma função `SECURITY DEFINER` marcada `STABLE`. `STABLE` diz ao planner que o resultado não muda dentro da mesma transação, permitindo cache/reuso por linha — e, combinado com `(select minha_funcao())`, vira InitPlan também.
- Restrição: só funciona se a função **não** depender de dados da linha (row-independent). Se depender, testar performance antes de assumir ganho.
- [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase RLS using Functions — Security Definers](https://blog.entrostat.com/supabase-rls-functions/)

### 1.4 RPC vs. múltiplas queries
Para telas que hoje fazem 3-5 `select` sequenciais no client (esperar um pra montar o filtro do próximo, ou simplesmente juntar dados de tabelas relacionadas), uma função Postgres (`rpc()`) que já devolve o JSON agregado corta round-trips de rede — cada round-trip HTTP pro PostgREST custa latência fixa, e isso multiplica em conexão lenta/mobile. É o mesmo padrão do dossiê de RLS: reduzir avaliações repetidas trocando por uma chamada só. (Consolidado do guia geral de otimização de queries do Supabase.)
- [Query Optimization | Supabase Docs](https://supabase.com/docs/guides/database/query-optimization)

### 1.5 `count: 'exact'` é caro — cuidado com paginação
`count: 'exact'` faz o Postgres **escanear a tabela inteira** para contar, mesmo que você só peça 20 linhas. Em tabelas de milhões de linhas isso pode levar segundos e consumir I/O à toa.
- Use `count: 'estimated'` (usa `pg_class.reltuples`, é uma estimativa via planner, praticamente grátis) para badges de "~N resultados" em paginação de UI.
- Reserve `count: 'exact'` para onde o número precisa ser exato (export, relatório financeiro).
- Padrão recomendado: `count: 'exact', head: true` quando você só quer o número (sem trazer as linhas).
- [How to get COUNT(*) in Supabase](https://www.iloveblogs.blog/post/how-to-get-count-in-supabase)
- [Supabase Pagination in React — The Complete Guide](https://makerkit.dev/blog/tutorials/pagination-supabase-react)

### 1.6 Paginação com `.range()`
`OFFSET` grande é caro (Postgres ainda precisa varrer e descartar as N primeiras linhas). Para paginação client-side simples, `.range(from, to)` do supabase-js já usa `LIMIT/OFFSET` internamente — funciona bem até algumas dezenas de milhares de linhas; além disso, keyset pagination (`WHERE created_at < cursor ORDER BY created_at LIMIT n`) escala melhor, mas exige mais trabalho de implementação — vale só se a paginação por offset já for medidamente lenta.

### 1.7 Connection pooling — Supavisor: transaction vs. session mode
- **Transaction mode** (porta `6543`): a conexão volta pro pool depois de cada transação — permite muito mais clientes compartilhando poucas conexões reais com o Postgres. Não suporta prepared statements entre transações, `SET`, `LISTEN/NOTIFY`, tabelas temporárias.
- **Session mode** (porta `5432`): comportamento de conexão direta — presa a um cliente durante toda a sessão. Necessário quando o driver/ORM depende de prepared statements ou features de sessão.
- Desde **28/fev/2025**, a porta 6543 só serve transaction mode (session mode nela foi descontinuado); a porta 5432 continua servindo session mode.
- Para uma SPA que fala com Supabase via `supabase-js`/PostgREST (não conexão Postgres direta), isso é irrelevante — pooling importa quando você tem backend/edge functions com muitas conexões concorrentes ao Postgres.
- [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
- [Supavisor and Connection Terminology Explained](https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO)
- [GitHub Discussion #32755 — Session Mode deprecation on 6543](https://github.com/orgs/supabase/discussions/32755)

### 1.8 `pg_stat_statements` — achar as queries lentas de verdade
Vem habilitado por padrão em todo projeto Supabase. Registra tempo total/médio por statement.
```sql
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```
Limitação: guarda só os últimos 5.000 statements distintos — em bases com muita query dinâmica, complementar com o **Query Performance Report** do Dashboard (que já usa isso por trás) e `EXPLAIN ANALYZE` pontual nas queries suspeitas.
- [pg_stat_statements: Query Performance Monitoring](https://supabase.com/docs/guides/database/extensions/pg_stat_statements)
- [Database debugging and monitoring](https://supabase.com/docs/guides/database/inspect)

### 1.9 Quando o plano Free/Pro limita CPU — e o "disk IO budget esgotado"
- **Plano Free**: CPU compartilhada, 500 MB de RAM/DB, projeto **pausa automaticamente após 7 dias sem requests** (precisa reabrir manualmente no Dashboard).
- **Plano Pro**: cada projeto começa numa instância "Micro"; $10/mês de crédito de compute cobre exatamente essa instância — escalar pra cima é cobrado à parte, por hora.
- **Disk IO Budget**: instâncias pequenas (Nano/Micro/Small/Medium) têm throughput de disco "baseline" e podem fazer *burst* acima disso por um tempo limitado. Quando o burst acaba, a performance cai pro baseline — e se o budget for **totalmente** consumido, o projeto pode ficar **não-responsivo**: latência sobe, CPU sobe por I/O wait. É a causa clássica de "ontem estava rápido, hoje ficou tudo lento do nada" sem nenhuma mudança de código — geralmente é volume de queries/writes crescendo até estourar o burst.
  - Recuperação: o burst de I/O (feature da AWS) se recompõe **lentamente ao longo de 24h**.
  - Diagnóstico: Dashboard → Observability → Database Health, olhar "Disk IO % consumed" (acima de 1% já indica que passou do baseline).
  - Correção estrutural: menos I/O por query (índices certos, evitar seq scans) ou upgrade de compute.
- [Compute and Disk | Supabase Docs](https://supabase.com/docs/guides/platform/compute-and-disk)
- [Supabase Docs — Troubleshooting High Disk I/O](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io)
- [GitHub Discussion #16747 — "Your disk IO budget has run out for today"](https://github.com/orgs/supabase/discussions/16747)

---

## 2. TanStack Query v5

- **`staleTime` vs `gcTime`**: `staleTime` controla quando refaz a request (dado "fresco" não refetcha); `gcTime` controla quanto tempo o dado **inativo** fica em memória antes de ser descartado (default 5 min). Boa prática: manter `gcTime >= staleTime`, senão o dado é descartado antes mesmo de poder ser servido "stale-enquanto-revalida".
- Default do v5: `staleTime: 0` (refetch em background a cada mount/refocus), `gcTime: 5*60_000`, `retry: 3`, `refetchOnWindowFocus: true`. Em telas de dashboard interno (não financeiro em tempo real), vale subir `staleTime` explicitamente por query — 0 é "lado seguro" mas gera refetch a cada troca de aba.
- **`placeholderData: keepPreviousData`** substituiu `keepPreviousData` (que era boolean em v4) — mantém os dados da página anterior visíveis enquanto a nova página carrega, evitando flash de loading em paginação/filtros.
- **Prefetch em hover de link**: `onMouseEnter`/`onFocus` chamando `queryClient.prefetchQuery(...)` com a mesma queryKey da rota de destino — navegação parece instantânea porque o cache já está quente no clique.
- **`refetchOnWindowFocus`**: default `true` é agressivo para apps internos com muitas abas — desligar (`false`) ou usar por-query onde faz sentido evita rajadas de requests toda vez que o usuário troca de aba do navegador.
- **Persistência de cache**: `@tanstack/query-sync-storage-persister` + `PersistQueryClientProvider` grava o cache no `localStorage`; exige `gcTime` (QueryClient) >= `maxAge` (persistOptions), senão o dado é descartado da memória antes do período de persistência acabar.
- [TanStack Query v5 docs — QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient)
- [Prefetching | TanStack Query Docs](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching)
- [usePrefetchQuery reference](https://tanstack.com/query/latest/docs/framework/react/reference/usePrefetchQuery)
- [persistQueryClient plugin](https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient)

---

## 3. Vite/React — bundle e code splitting

- **Route-based splitting**: `React.lazy(() => import('./pages/Dashboard'))` + `<Suspense>` por rota — Vite gera automaticamente um chunk separado por import dinâmico, carregado só quando a rota é acessada.
- **`manualChunks`** no `vite.config.ts`: isolar vendors que mudam pouco (React/ReactDOM, uma lib de gráfico, etc.) em chunks próprios e estáveis — melhora cache de longo prazo entre deploys (o hash do chunk só muda se aquele vendor mudar).
- **`rollup-plugin-visualizer`**: plugado no `vite.config.ts`, gera um `dist/stats.html` com o treemap do bundle após `vite build` — usar pra achar os chunks que realmente pesam antes de otimizar às cegas.
- **Tree-shaking `lucide-react`**: a lib já é tree-shakeable via ESM (cada ícone é um componente independente); em bundlers/ambientes onde o barrel file (`import { X } from 'lucide-react'`) não faz tree-shake correto, importar direto do arquivo do ícone (`lucide-react/dist/esm/icons/x`) é o fallback mais seguro — mas Vite/Rollup modernos normalmente já lidam bem com o barrel.
- **`date-fns`**: tree-shakeable nativamente com import nomeado (`import { format } from 'date-fns'`); ~2KB gzip por função usada, contra 66KB+ de uma função do Moment.js — não precisa de configuração extra além de usar imports nomeados (nunca `import * as`).
- **Dynamic import de libs pesadas**: para bibliotecas usadas só em uma tela/feature específica (Excalidraw, Mermaid, Cytoscape, KaTeX, html2canvas, FullCalendar), usar `import()` dinâmico dentro do componente que a consome (ou lazy-load do componente inteiro) em vez de import estático no topo — essas libs isoladamente costumam pesar de dezenas a centenas de KB e não devem entrar no bundle inicial.
- [Vite manualChunks + React.lazy — Route-Level Code-Splitting](http://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/)
- [Taming "Large Chunks" in Vite + React](https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/)
- [Vite code splitting that just works](https://sambitsahoo.com/blog/vite-code-splitting-that-works.html)
- [Lucide for React](https://lucide.dev/guide/packages/lucide-react)
- [date-fns tree shaking issue thread](https://github.com/date-fns/date-fns/issues/2207) (contexto de quando quebrou/foi corrigido)

---

## 4. Vercel

- **Cache headers para assets com hash**: por padrão o Vercel serve com `Cache-Control: public, max-age=0, must-revalidate` — seguro mas não cacheia nada localmente. Como os assets do Vite já saem com hash no nome (`app.a1b2c3.js`), é seguro configurar no `vercel.json` (ou headers do build) `Cache-Control: public, max-age=31536000, immutable` para tudo em `/assets/*`, mantendo o `index.html` em `max-age=0, must-revalidate` (senão o usuário nunca pega o deploy novo). Vercel também cacheia estático automaticamente na Edge CDN por até 31 dias e persiste hash-based entre deploys quando o conteúdo não muda.
- **Rewrite de SPA**: regra de rewrite `/(.*) → /index.html` continua necessária para roteamento client-side funcionar em refresh/deep-link.
- **Speed Insights**: mede Core Web Vitals reais dos usuários (RUM) — funciona em SPA Vite normalmente via script client-side, não depende de framework específico. No Hobby: **10.000 eventos/mês grátis**; ao estourar, a coleta **pausa** (não gera cobrança — Hobby não é cobrado por overage).
- **Web Analytics**: pageviews/eventos de navegação — **50.000 eventos/mês grátis** no Hobby, mesmo comportamento de pausa ao estourar.
- No Pro, Speed Insights custa $10/projeto/mês + $0.65/10k eventos extras; Web Analytics $3/100k eventos — relevante só se decidir migrar de plano.
- [Limits and Pricing for Speed Insights](https://vercel.com/docs/speed-insights/limits-and-pricing)
- [Pricing for Web Analytics](https://vercel.com/docs/analytics/limits-and-pricing)
- [Vercel Pricing](https://vercel.com/pricing)

---

## 5. Como medir ANTES de consertar

Regra de ouro: nunca otimizar por achismo — cada ferramenta responde uma pergunta diferente.

| Sintoma / pergunta | Ferramenta | O que ela mostra |
|---|---|---|
| "A página demora pra aparecer pela primeira vez" | **Lighthouse** (aba Lighthouse do DevTools, ou `lighthouse` CLI) | Métricas de lab (FCP, LCP, TBT, CLS, Speed Index) num ambiente simulado (CPU/rede throttled) — bom para comparar antes/depois de uma otimização de bundle |
| "Trava depois de carregado, ao clicar/filtrar/rolar" | **Chrome DevTools → Performance panel** (gravar interação) | Linha do tempo real de main thread: long tasks, layout thrashing, JS que bloqueia input. Lighthouse não pega isso (só mede o load inicial) |
| "Qual componente React está re-renderizando à toa" | **React DevTools Profiler** | Flame graph de renders por componente, causa (props/state/context) e duração — essencial antes de adicionar `useMemo`/`memo` "no escuro" |
| "A tela demora porque a query no banco é lenta" | **Supabase Dashboard → Performance Advisor / Query Performance Report** + `pg_stat_statements` + `EXPLAIN ANALYZE` | Aponta queries por tempo total, RLS sem InitPlan, FK sem índice, e o plano de execução real |
| "Ficou tudo lento sem eu mudar nada" | **Supabase Dashboard → Observability → Database Health** | CPU%, Disk IO % consumido — descarta/confirma disk IO budget estourado antes de sair mexendo em código |
| "Quanto de JS estou mandando e o que pesa" | **`rollup-plugin-visualizer`** (`dist/stats.html`) | Treemap do bundle final, por chunk/dependência |
| "Como está a experiência real dos usuários (não só a minha máquina)" | **Vercel Speed Insights** | RUM — Web Vitals reais por página, filtrável por dispositivo/rota |

Sequência recomendada: (1) reproduzir o sintoma com DevTools Network+Performance gravando; (2) se o gargalo é rede/banco, ir direto pro Supabase (Performance Advisor primeiro — é grátis e automático); (3) se é JS/render, Lighthouse pra baseline + React Profiler pra achar o componente; (4) só depois decidir code-splitting/memoização — não fazer na ordem inversa.

- [Core Web Vitals workflows with Google tools | web.dev](https://web.dev/articles/vitals-tools)
- [Optimizing Web Vitals using Lighthouse | web.dev](https://web.dev/articles/optimize-vitals-lighthouse)
- [Database debugging and monitoring | Supabase Docs](https://supabase.com/docs/guides/database/inspect)

---

## 6. Checklist priorizado — custo/benefício (SPA Vite + Supabase + Vercel Hobby)

Ordenado do maior ganho pelo menor esforço até o de retorno mais marginal/trabalhoso.

1. **Rodar o Performance Advisor do Supabase** (Dashboard, zero código) e aplicar as duas correções que ele já indica automaticamente: FK sem índice, e RLS sem `(select auth.uid())`. Normalmente é o maior ganho absoluto do documento inteiro, e é o de menor esforço — trocar `auth.uid()` por `(select auth.uid())` nas policies existentes.
2. **Trocar `count: 'exact'` por `count: 'estimated'`** em qualquer paginação de UI que hoje pede contagem exata só para mostrar "~N resultados". Uma linha por chamada.
3. **Cache headers agressivos em `/assets/*` no `vercel.json`** (`immutable`, `max-age=31536000`) — configuração única, ganho permanente de repeat-visit.
4. **Rodar `rollup-plugin-visualizer` uma vez** para ver o que realmente pesa no bundle atual — decide o resto do trabalho de code-splitting em vez de adivinhar.
5. **`React.lazy` nas rotas** (se ainda não estiver feito) — geralmente o maior corte de bundle inicial por esforço de implementação, principalmente se há telas com libs pesadas (calendário, gráfico, editor).
6. **Dynamic import das libs pesadas identificadas no passo 4** (Excalidraw/Mermaid/Cytoscape/KaTeX/html2canvas/FullCalendar) — só vale se o visualizer mostrar que elas estão no bundle inicial.
7. **Ajustar `staleTime`/`refetchOnWindowFocus` no QueryClient global** — poucas linhas, corta refetches desnecessários em apps internos com muitas abas abertas.
8. **Prefetch em hover nos links de navegação principal** — ganho perceptível de "instantaneidade", esforço pequeno mas espalhado (um handler por link relevante).
9. **Habilitar Speed Insights da Vercel** (grátis até 10k eventos/mês no Hobby) — não acelera nada sozinho, mas é o que permite medir se as mudanças acima realmente melhoraram a experiência real dos usuários.
10. **Persistência de cache do TanStack Query em localStorage** — ganho real só em navegação recorrente/offline-first; mais setup (`persistQueryClient`) para o retorno mais situacional da lista.
11. **Índices adicionais via `index_advisor`** para queries específicas fora do escopo do Performance Advisor padrão — trabalho pontual, fazer sob demanda quando uma query específica aparecer lenta no `pg_stat_statements`.
12. **Monitorar Disk IO Budget** (Observability → Database Health) — não é uma ação, é um hábito de checagem; só vira trabalho de verdade (upgrade de compute) se o índice/RLS acima não resolverem sozinhos o "ficou lento do nada".
