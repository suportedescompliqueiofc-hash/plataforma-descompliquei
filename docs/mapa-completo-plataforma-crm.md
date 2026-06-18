# Mapa Completo — Plataforma + CRM Descompliquei

> Documento gerado em 15/06/2026. Base para conectar o Arsenal de Ferramentas com o CRM e a Plataforma.

---

## ÍNDICE

1. [PLATAFORMA (Área do Cliente)](#1-plataforma-área-do-cliente)
2. [CRM](#2-crm)
3. [ATHOS GS](#3-athos-gs)
4. [INTEGRAÇÕES E AUTOMAÇÕES](#4-integrações-e-automações)

---

## 1. PLATAFORMA (Área do Cliente)

### 1.1 Mapa de Rotas

| Rota | Componente | Função | Controle de Acesso |
|------|-----------|--------|-------------------|
| `/plataforma` | Hub | Dashboard principal da plataforma — cards de acesso a todos os módulos | OnboardingGuard |
| `/plataforma/onboarding` | Onboarding | Formulário diagnóstico (7 blocos) + construção da jornada pelo Athos | Fora do OnboardingGuard |
| `/plataforma/os` | DescompliqueiOS | Chat com agentes Athos GS | Fora do OnboardingGuard, `acesso_os` |
| `/plataforma/trilha` | Trilha | Trilha de Aprendizado — pilares, módulos, materiais complementares | OnboardingGuard, `pilares_liberados` |
| `/plataforma/trilha/pilar/:pilarId` | Pilar | Página de um pilar com lista de módulos | OnboardingGuard, `pilares_liberados` |
| `/plataforma/trilha/:moduloId` | Modulo | Conteúdo de um módulo com exercícios | OnboardingGuard, `pilares_liberados` |
| `/plataforma/jornada` | Jornada | Jornada personalizada com estágios e passos | OnboardingGuard |
| `/plataforma/arsenal` | Arsenal | Arsenal Comercial — 43 ferramentas organizadas por categoria | OnboardingGuard |
| `/plataforma/arsenal/:slug` | ArsenalCategoria | Lista de ferramentas de uma categoria | OnboardingGuard |
| `/plataforma/arsenal/:slug/:ferrSlug` | ArsenalFerramenta | Página individual de uma ferramenta (Aprenda + Construa) | OnboardingGuard |
| `/plataforma/sessoes-taticas` | SessoesTaticas | Sessões de mentoria ao vivo semanais | OnboardingGuard, `acesso_sessoes_taticas` |
| `/plataforma/materiais` | Materiais | Biblioteca de materiais criados pelo cliente | OnboardingGuard, `acesso_materiais` |
| `/plataforma/materiais/:id` | MateriaisEditor | Editor rich text (TipTap) para um material | OnboardingGuard, `acesso_materiais` |
| `/plataforma/configuracoes` | Configuracoes | Configurações de perfil, segurança e preferências | OnboardingGuard |

### 1.2 Hub — Dashboard Principal

Quando o cliente acessa `/plataforma`, vê cards de acesso organizados por módulo. Cards visíveis dependem das flags de acesso (`PlataformaContext.acesso`):

**Sempre visíveis:**
- **Arsenal Comercial** — "43 ferramentas para construir processos reais" → `/plataforma/arsenal`
- **Minha Jornada** — "Seu plano personalizado com a Descompliquei" → `/plataforma/jornada`
- **Trilha de Aprendizado** → `/plataforma/trilha`

**Condicionais (feature flags):**
- **Meus Materiais** (`acesso_materiais`) → `/plataforma/materiais`
- **Athos GS** (`acesso_os`) → `/plataforma/os`
- **Sessões Táticas** (`acesso_sessoes_taticas`) → `/plataforma/sessoes-taticas`
- **CRM** (`acesso_crm`) → abre o CRM

Cada card tem cor de acento: amber (Arsenal), cyan (Jornada), emerald (Materiais), violet (OS), rose (Sessões).

### 1.3 Trilha de Aprendizado

**Estrutura hierárquica:**
- **3 Pilares fixos:** Fundação Clínica, Motor de Demanda, Motor Comercial
- Cada pilar contém **módulos** ordenados sequencialmente
- Cada módulo tem conteúdo rico + exercícios que geram **materiais** salvos automaticamente

**Funcionalidades do cliente:**
- Ver progresso geral: "X módulos concluídos de Y" com barra percentual
- Navegar entre pilares (somente os liberados pelo plano)
- Acessar módulos sequencialmente dentro de cada pilar
- Completar exercícios que geram materiais salvos em `platform_materiais`
- Dados preenchidos nos exercícios (ICP, Posicionamento, Diferencial) sincronizam automaticamente com o perfil do cliente

**Materiais Complementares (aba separada):**
- Accordion de pastas/subpastas (máx. 2 níveis)
- Materiais em formato PDF (abre em nova aba) ou HTML (abre em iframe isolado)
- Botão "Tela cheia" para HTML via Blob URL
- Conteúdo HTML lazy-loaded (não carregado na listagem)

### 1.4 Jornada Personalizada

Plano estratégico criado pelo Athos GS durante o onboarding, personalizado com base no diagnóstico do cliente.

**O que o cliente vê:**
- Título da jornada (ex: "Plano de Aceleração Comercial — Clínica Bella")
- Lista de **Estágios** expansíveis, cada um com:
  - Título, descrição, prazo em dias
  - Barra de progresso (passos concluídos / total)
  - Lista de **Passos** com checkboxes interativos
- Cada passo tem: título, descrição, tipo (`acao_livre` ou `ferramenta_arsenal`), deadline opcional, flag obrigatório
- Se o passo está vinculado a uma ferramenta do Arsenal (`ferramenta_slug`), há link direto para ela
- O cliente pode marcar/desmarcar passos como concluídos — atualiza `jornada_passos` em tempo real

**Estado vazio:** Exibe "Sua jornada está sendo preparada" quando não há jornada criada.

### 1.5 Arsenal Comercial

Biblioteca de 43 ferramentas comerciais organizadas em categorias.

**Navegação:**
1. **Arsenal.tsx** — listagem de todas as categorias (`arsenal_categorias`), cada uma com: nome, descrição, frase-âncora, ícone, progresso do cliente
2. **ArsenalCategoria.tsx** — lista de ferramentas da categoria, cada uma com: nome, descrição, badge de status (Não iniciado / Em andamento / Concluído), link para vídeo se disponível
3. **ArsenalFerramenta.tsx** — página individual com duas abas:
   - **Aprenda** — conteúdo educacional (texto/HTML), vídeo embed, materiais relacionados
   - **Construa** — editor rich text (TipTap) onde o cliente constrói sua versão personalizada da ferramenta. Template pré-populado. Ao salvar, cria/atualiza registro em `meus_materiais`

**Fluxo de progresso:**
- `nao_iniciado` → abre a ferramenta → `em_andamento` → salva construção → `concluido`
- Progresso salvo em `arsenal_progresso` por usuário

### 1.6 Athos GS — DescompliqueiOS

Interface de chat com agentes de IA, acessível em `/plataforma/os`.

**Layout:**
- Sidebar esquerda (toggleável) — lista de conversas agrupadas por tempo
- Área principal — thread de chat com respostas em streaming
- Botão Bot no topo abre painel flutuante de seleção de agentes

**Funcionalidades:**
- Criar nova conversa
- Deletar conversa
- Selecionar agente (lista de `athos_agentes` ativos — slug, nome, descrição)
- Upload de arquivos e áudio
- Seletor de modelo de IA
- Respostas em streaming via SSE (edge function `descompliquei-os`)
- Agente de onboarding com auto-start especial

**Agentes disponíveis (tabela `athos_agentes`):**
- `onboarding` — Agente de Onboarding que analisa diagnóstico e cria jornada

### 1.7 Sessões Táticas

Mentorias semanais ao vivo com a equipe Descompliquei.

**O que o cliente vê:**
- Banner hero com próxima sessão
- Card detalhado: tipo (Comercial/outro), título, descrição, data/hora
- Botão "Entrar na Sessão" (abre `meet_link`)
- Botão "Google Calendar" (gera URL de evento)
- Calendário semanal navegável (seg-dom) com sessões como cards clicáveis
- Seção "Sessões Gravadas" — grid de sessões passadas com `recording_url`
- Modal de detalhes por sessão

**Dados:** Tabela `platform_sessoes_taticas` (`active = true`).

### 1.8 Meus Materiais

Biblioteca pessoal do cliente — outputs de Arsenal, IAs e criações manuais.

- Grid/lista de materiais com título, tipo, origem, data
- Abrir/visualizar qualquer material
- Editar conteúdo via editor rich text (TipTap)
- Excluir materiais

### 1.9 Configurações

**Seções:**
1. **Perfil** — Avatar, Nome, Nome da Clínica, Especialidade, WhatsApp, Cidade/Estado
2. **Progresso da Jornada** — Barra de progresso (read-only)
3. **Segurança** — Alterar senha
4. **Plano** — Badge do plano atual (read-only)
5. **Preferências** — Toggle de tema (claro/escuro/sistema)
6. **Logout** — Sair da plataforma

### 1.10 Fluxo de Onboarding

**Fase 1 — Diagnóstico (Onboarding.tsx)**
- Tela 0: Boas-vindas
- Telas 1-7: Formulário diagnóstico com 7 blocos de perguntas
  - Bloco 1: Perfil da Clínica (13 perguntas)
  - Bloco 2: Geração de Demanda e Aquisição (19 perguntas com condicionais)
  - Bloco 3: Faturamento e Oferta (8 perguntas)
  - Bloco 4: Conversão e Atendimento (10 perguntas)
  - Bloco 5: Estrutura Operacional (10 perguntas com condicionais)
  - Bloco 6: Gestão e Processos (3 perguntas)
  - Bloco 7: Objetivos e Visão (6 perguntas)
- Tela 8: Loading/geração do documento diagnóstico
- Tipos de pergunta: text (textarea), single (radio), multi (checkbox)
- Perguntas condicionais (`visibleIf`) e dinâmicas (`dynamicOptions`)
- Respostas auto-salvas em `onboarding_diagnosticos.respostas`
- Documento markdown gerado com flags automáticas (detecção de padrões)
- Salvo em `meus_materiais` com `categoria = 'diagnostico'`

**Fase 2 — Athos Constrói Jornada (Onboarding.tsx tela 9)**
- Chama edge function `descompliquei-os` com:
  - System prompt do Agente de Onboarding (tabela `athos_agentes`, slug `onboarding`)
  - Diagnóstico do cliente como contexto
  - `tools_override: ["criar_jornada"]` — modelo vê somente 1 ferramenta
  - Modelo: `qwen/qwen3.7-max`
- Indicador de fases: Analisando → Criando → Resumo
- Modelo chama a tool `criar_jornada` → salva jornada no DB
- Exibe resumo textual para o cliente (sem JSON visível)
- Marca `onboarding_concluido = true`

**Fase 3 — Checklist "Configure sua plataforma" (OnboardingPlataformaChecklist.tsx)**
- Modal bloqueante com lista de passos
- Cada passo tem: título, descrição, path destino, CTA, tutorial interativo opcional
- Ao completar todos: tela de celebração → libera plataforma
- Marca `onboarding_complete = true`

---

## 2. CRM

### 2.1 Mapa de Rotas

| Rota | Componente | Função |
|------|-----------|--------|
| `/crm` | Dashboard | Painel de controle com métricas e gráficos |
| `/crm/leads` | Leads | Tabela completa de leads com filtros e ações |
| `/crm/leads/:leadId` | JornadaPaciente | Timeline cronológica de todos os eventos de um lead |
| `/crm/pipeline` | Pipeline | Kanban de pipeline com drag-and-drop |
| `/crm/conversas` | Conversations | Chat WhatsApp (full-bleed, sem padding) |
| `/crm/conversas/:leadId` | Conversations | Chat WhatsApp focado em um lead |
| `/crm/agendamentos` | Agendamentos | Calendário + lista + métricas de agendamentos |
| `/crm/vendas` | Vendas | Registro e métricas de vendas fechadas |
| `/crm/metas` | Metas | Funil de metas, histórico e projeção |
| `/crm/ia` | AiSettings | Configuração da IA de pré-atendimento |
| `/crm/quick-messages` | QuickMessagesPage | Templates de mensagens rápidas em pastas |
| `/crm/cadences` | Cadences | Fluxos de cadência automatizados |
| `/crm/settings` | Settings | Configurações do CRM (perfil, pipeline, tags, marca, WhatsApp, equipe) |
| `/crm/notificacoes` | Notifications | Central de notificações |
| `/crm/performance` | Performance | Score de performance com checklist diário |
| `/crm/evolucao` | Evolucao | Métricas de evolução temporal |
| `/crm/procedimentos` | Procedimentos | Catálogo de procedimentos/serviços |
| `/crm/onboarding` | CrmOnboarding | Onboarding de configuração inicial do CRM |
| `/crm/super-admin-crm` | SuperAdmin | Painel super admin (somente master org) |

### 2.2 Dashboard

**Dashboard do cliente (orgs regulares):**
- Widget "Rotina do Dia" — urgência escalonada (done/early/warning/urgent/critical) com lista de tarefas pendentes
- Seletor de período + filtro de origem (Geral/Marketing/Orgânico)
- Toggle de modo de métricas (Geral / Cadastrados no período)
- Widget de Meta Ativa — barra de progresso com % atingido
- Cards de Visão Geral: Total Leads, MQLs, Agendamentos, Fechamentos, Faturamento, Ticket Médio, Taxa de Conversão Global
- Funil do Pipeline — conversão entre etapas com % entre passos
- Distribuição do Pipeline — gráfico de barras por etapa
- Top Procedimentos — ranking de produtos/serviços mais vendidos
- Widget Tempo de Resposta da IA — tempo médio, taxa de handoff, leads aguardando
- Evolução no Tempo — AreaChart com séries Leads, Convertidos, MQLs, Faturamento
- Bucket de "Leads sem Resposta" — modal detalhado
- Métricas clicáveis que abrem modal com lista de leads filtrada

### 2.3 Leads

**Colunas da tabela:**
- Avatar + Nome, Badge MQL, Procedimento de Interesse
- Telefone + tempo desde último contato
- Origem (Marketing/Orgânico) + Fonte
- Etiquetas (até 2 visíveis + overflow "+N")
- Responsável (com avatar)
- Etapa (badge colorido)
- Data de Cadastro

**Filtros (painel colapsável):**
- Busca por nome ou telefone
- Etapa do Funil (todas as etapas)
- Origem (Marketing/Orgânico/Convênio — Convênio apenas para org específica)
- Fonte (dinâmico da org)
- Etiqueta (filtro com dots coloridos)
- Responsável (membros da equipe + "Sem responsável")
- Período de Cadastro (date range picker)
- Badge de contagem de filtros ativos, botão limpar tudo

**Ações por lead (dropdown):**
- Ver Jornada → `/crm/leads/:id`
- Editar Lead
- Bloquear Número (blacklist)
- Excluir Lead

**Ações em massa (barra de seleção):**
- Mover Etapa — move leads selecionados para qualquer etapa
- Bloquear — adiciona todos à blacklist
- Excluir — exclusão com confirmação
- Cancelar seleção

**Outras funcionalidades:**
- Botão "Novo Lead" → modal de criação
- Botão "Importar" → dialog de importação CSV
- Clique na linha → modal de visualização
- Paginação: 50 por página com controles first/prev/next/last
- Stats no header: total, ativos, qualificados

### 2.4 Jornada do Paciente

Timeline cronológica de todos os eventos de um lead, em `/crm/leads/:leadId`.

**Tipos de evento:**
| Tipo | Cor | Descrição |
|------|-----|-----------|
| `mensagem` | Azul | Mensagens WhatsApp (texto e mídia reais — sem logs de IA) |
| `etapa` | Roxo | Transição de etapa no pipeline |
| `agendamento` | Verde | Agendamento criado/atualizado |
| `venda` | Dourado | Venda registrada |
| `nota` | Cinza | Nota manual ou do sistema |
| `qualificacao` | Laranja | Lead marcado como qualificado (MQL) |
| `handoff` | Vermelho | IA transferiu para atendente humano |
| `humano_assumiu` | Indigo | Primeira mensagem humana após sequência de IA |

**Funcionalidades:**
- MacroTimelineStrip — barra de progresso no topo com eventos macro
- Agrupamento por dia
- Diagnóstico de duração de atendimento automatizado (handoff)

### 2.5 Pipeline (Kanban)

**Aba Kanban:**
- Todas as etapas como colunas (sem paginação — scroll horizontal)
- Drag-and-drop entre colunas e dentro de colunas (`@dnd-kit`, `closestCenter`)
- Atualização otimista — card move imediatamente, persiste no drop
- Barra de scroll espelhada no topo
- Cards mostram: avatar, nome, badge MQL, telefone, resumo, origem, fonte, etiquetas, badge de agendamento, tempo desde último contato
- Clique no card → modal de visualização
- Badge de contagem de leads por etapa
- Highlight de drop zone com cor da etapa

**Aba Métricas:**
- Taxas de conversão entre cada par de etapas adjacentes
- Filtro de data range

### 2.6 Conversas (WhatsApp)

Layout full-bleed (sem padding), dividido em 3 painéis:

**Painel esquerdo (lista de conversas):**
- Busca de conversas
- Filtros: tags, etapa, status da IA
- Badge de scoring (A/B/C/D) ao lado do nome (exclusivo Descompliquei)
- Modo de seleção em massa com ações: Alterar Etapa, Adicionar Etiqueta, Iniciar Cadência, Configurar IA, Alterar Origem, Excluir Leads

**Painel central (chat ativo):**
- Histórico de mensagens WhatsApp com renderização de tipos:
  - Texto com formatação
  - Imagens com preview e fullscreen viewer
  - Vídeos com player
  - Áudios com player
  - Arquivos com download
- Enviar mensagem de texto
- Enviar mídia (imagem, vídeo, arquivo) com preview
- Gravar e enviar áudio (AudioRecorder)
- Responder/citar mensagens (reply com `replyId`)
- Editar mensagens enviadas (janela de 15 minutos)
- Deletar mensagens
- Sidebar de mensagens rápidas
- Controle de IA (ligar/desligar por conversa)

**Painel direito (info do lead):**
- Dados cadastrais do lead
- Etapa, tags, scoring modal
- Histórico resumido

### 2.7 IA de Pré-Atendimento

Configuração em `/crm/ia` com 3 abas:

**Aba Prompt:**
- Toggle master ligar/desligar IA
- Seletor de modelo (OpenAI, OpenRouter, xAI)
- Identidade do agente: nome, clínica, profissional, especialidade
- Toggle de uso de emojis + set customizado
- Config de alvo de ligação (equipe/secretária/doutor + nome)
- Tom de voz
- Lista de procedimentos (nome + descrição por item)
- Lista de FAQ (pergunta + resposta por item)
- Campos: Instagram, endereço
- Instruções adicionais
- Toggles de ferramentas: CRM tool (atualiza dados e pipeline), Notification tool (handoff)
- Config de horário de atendimento
- Informações de pagamento
- Fullscreen textarea dialog
- Reset / Salvar

**Aba Follow-up:**
- Configuração de follow-up automatizado por IA
- Histórico de follow-ups

**Aba Logs:**
- Logs de execução da IA com detalhes

**Como funciona:**
- Edge function `whatsapp-ai-agent` recebe mensagens via webhook UAZAPI (`receive-message`)
- Responde automaticamente usando o prompt configurado
- Pode atualizar dados do lead e mover no pipeline (CRM tool)
- Pode disparar handoff para humano (Notification tool)
- Follow-up automático via `ia-followup-agent`

### 2.8 Cadências

Sistema de mensagens automatizadas em sequência.

**Aba Fluxos:**
- Grid de cards com todas as cadências (nome, descrição, contagem de passos)
- Criar cadência → modal com nome, descrição, passos sequenciais
- Cada passo: conteúdo da mensagem, delay (minutos/horas/dias)
- Editar/excluir cadência
- Disparar cadência → modal de seleção de leads com config de delay min/max
- Monitorar despacho

**Aba Monitoramento:**
- Filtro de data range
- Rastreamento de despachos ativos por cadência

**Aba Relatório:**
- Estatísticas de despacho e taxas de conclusão

### 2.9 Mensagens Rápidas

Templates de mensagens organizados em pastas com cores.

- Pastas com codificação de cor, drag-and-drop para reordenar
- Mensagens dentro de pastas, drag-and-drop entre pastas
- Tipos: texto, áudio, imagem, vídeo, arquivo (PDF/doc)
- Upload de arquivos
- Busca por título e conteúdo
- CRUD completo (modal com título, tipo, conteúdo, pasta)
- Usadas na tela de Conversas via sidebar

### 2.10 Vendas

**Cards de métricas:**
- Total Faturado, Ticket Médio, Vendas no Período, Taxa de Conversão, Maior Venda

**Tabela:** Lead, Produto/Serviço, Valor Fechado, Valor Orçado, Forma de Pagamento, Data

**Funcionalidades:**
- Filtro de data range (default: mês atual)
- Busca por cliente, produto, forma de pagamento
- Criar venda → modal com: lead, procedimento, valor fechado/orçado, data, forma de pagamento, observações
- Editar / excluir venda

### 2.11 Metas

**Aba Funil:**
- Cards de progresso: Receita, Leads, MQLs, Reuniões, Fechamentos com barras %
- Indicadores de ritmo diário/semanal
- Dias restantes / decorridos
- Criar/editar meta: nome, período, datas, meta de receita, ticket médio, taxas (MQL, agendamento, conversão), CPL meta
- Gráfico de evolução

**Aba Histórico:** Metas passadas com comparativo atingido vs target

**Aba Projeção:** Projeção futura baseada no ritmo atual

### 2.12 Agendamentos

**Visualização Calendário (FullCalendar):**
- Grid mês/semana/dia
- Click na data → criar agendamento
- Click no evento → ver/editar
- Cores customizadas por agendamento

**Visualização Lista:**
- Busca, filtros por status/tipo/data
- Agrupamento: Hoje, Amanhã, Esta Semana, Futuro
- Status: Agendado, Confirmado, Realizado, Não Compareceu, Cancelado, Remarcado
- Tipos: Consulta, Avaliação, Procedimento, Retorno
- Atualização rápida de status

**Visualização Métricas:**
- Gráficos: distribuição de status (pizza), evolução temporal
- Contadores: total, confirmados, realizados, não compareceu, taxa de comparecimento

**Modal de criação/edição:**
- Lead (combobox), Título, Tipo, Data/hora, Duração (presets + custom), Cor (8 opções), Observações, Config de Notificações

### 2.13 Settings

| Seção | Funcionalidades |
|-------|----------------|
| **Perfil** | Nome, avatar upload/crop, email |
| **Clínica** | Nome, CNPJ, email, telefone |
| **Pipeline** | CRUD de etapas com cores customizadas e reordenação |
| **Origens** | Gerenciar nomes de fontes de leads |
| **Etiquetas/Tags** | CRUD de tags com cores, sincronizar etiquetas WhatsApp |
| **Marca/Branding** | Logo upload, cor primária, título do app, favicon |
| **WhatsApp** | URL + token UAZAPI, pareamento QR code |
| **Aparência** | Toggle de tema claro/escuro/sistema |
| **Segurança** | Alterar senha |
| **Equipe** | Convidar/gerenciar membros, atribuir papéis |

Deep-link via `?section=` para tutoriais de onboarding.

### 2.14 Performance

- Score Gauge (arco SVG) — score de 0-100 com cores (verde/amber/vermelho)
- Seletor de período: Diário/Semanal/Mensal com navegação prev/next
- Checklist de tarefas com status de conclusão
- Tarefas com frequência: diária, semanal, mensal
- Seção overview — stats cumulativos
- AreaChart — evolução do score
- Badges/troféus de performance

### 2.15 Notificações

- Abas de filtro por tipo
- Lista de notificações com ações
- Marcar como lida (individual ou todas)
- Resolver notificação
- Limpar notificações

### 2.16 Procedimentos

- Catálogo de procedimentos/serviços da clínica
- CRUD: nome, valor base, descrição, status ativo/inativo
- Usado como referência na IA de pré-atendimento e em vendas

### 2.17 Evolução

Métricas do CRM com comparativo temporal (período A vs período B), em `/crm/evolucao`.

**Seletor de período:** Mês / 30 dias / Trimestre / Semestre / Ano

**KPIs com delta (↑↓ vs período anterior):**
- Leads, Qualificados (MQL), Agendamentos, Vendas/Fechamentos
- Faturamento, Ticket Médio
- Mensagens via bot, Tempo de resposta IA
- Tempo de resposta humano, Taxa de handoff

**Seções:**
- Funil de Conversão: taxa MQL, agendamento, fechamento
- Eficiência Comercial: barras comparativas (atual vs anterior) por etapa
- Atendimento & IA: atividade do bot, métricas de tempo

### 2.18 Onboarding do CRM

Modal de primeiro acesso para donos de clínica (`admin`).

**Quem vê:** Apenas papel `admin`. Superadmin e atendente nunca veem.

**Passos (todos obrigatórios):**
1. Complete o perfil da clínica → `/crm/settings?section=marca` (tutorial: `onboarding-perfil`)
2. Sincronize etiquetas do WhatsApp → `/crm/settings?section=tags` (tutorial: `onboarding-etiquetas`)
3. Cadastre seus procedimentos → `/crm/procedimentos` (tutorial: `onboarding-procedimentos`)
4. Faça o tour pelo CRM → `/crm` (tutorial: `welcome`)

**Após concluir:** Tela de celebração → libera CRM. Item "Configuração Inicial" com badge X/Y aparece na sidebar durante o processo.

---

## 3. ATHOS GS

### 3.1 O que o Athos consegue fazer

O Athos GS é a inteligência estratégica da clínica. Opera via edge function `descompliquei-os` com **67 ferramentas** divididas em categorias:

### 3.2 Ferramentas de Consulta (leitura)

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 1 | `buscar_leads` | Busca leads com filtros (nome, telefone, etapa, origem, tags, período) |
| 2 | `obter_lead_completo` | Detalhes completos: dados, notas, agendamentos, vendas, mensagens, atendimento IA vs humano |
| 3 | `obter_metricas_funil` | Métricas do funil idênticas ao painel (leads, MQLs, agendamentos, fechamentos) |
| 4 | `obter_pipeline` | Etapas com contagem de leads |
| 5 | `obter_agendamentos` | Próximos agendamentos |
| 6 | `obter_vendas_recentes` | Vendas fechadas com valores e produtos |
| 7 | `obter_metas` | Metas ativas com progresso |
| 8 | `obter_procedimentos` | Lista procedimentos cadastrados |
| 9 | `obter_tags` | Tags disponíveis |
| 10 | `obter_notificacoes` | Notificações pendentes |
| 11 | `analisar_leads_parados` | Leads travados sem atividade recente |
| 12 | `analisar_ranking_procedimentos` | Ranking de procedimentos por volume e receita |
| 13 | `obter_resumo_geral` | Resumo executivo do dia |
| 14 | `obter_metricas_receita` | Análise de receita: total, ticket médio, evolução, projeção |
| 15 | `obter_blacklist` | Números bloqueados |
| 16 | `analisar_atendimento_ia` | Distribuição IA vs humano, handoffs, tempo médio |
| 17 | `analisar_nao_leads` | Contatos que não são leads (spam, fornecedores) |
| 18 | `buscar_conversas_lead` | Últimas mensagens WhatsApp de um lead |
| 19 | `listar_cadencias` | Cadências com nome, descrição e passos |
| 20 | `obter_cadencia_detalhes` | Cadência completa com passos detalhados |

### 3.3 Ferramentas de Leads (escrita)

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 21 | `criar_lead` | Cria novo lead |
| 22 | `atualizar_lead` | Atualiza dados cadastrais |
| 23 | `qualificar_lead` | Marca/desmarca como MQL |
| 24 | `mover_etapa_pipeline` | Move lead para outra etapa |
| 25 | `adicionar_nota` | Adiciona nota ao histórico |
| 26 | `gerenciar_tags_lead` | Adiciona/remove tags |
| 27 | `bloquear_numero` | Bloqueia número permanentemente |
| 28 | `desbloquear_numero` | Remove da blacklist |
| 29 | `excluir_lead_permanente` | Exclusão definitiva |
| 30 | `excluir_lote` | Exclusão de múltiplos leads |
| 31 | `editar_nota` | Edita nota manual |
| 32 | `excluir_nota` | Exclui nota |

### 3.4 Ferramentas de Mensagens / WhatsApp

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 33 | `enviar_mensagem` | Envia mensagem WhatsApp |
| 34 | `agendar_mensagem` | Agenda mensagem para horário futuro |

### 3.5 Ferramentas de Cadências

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 35 | `disparar_cadencia` | Ativa cadência para um lead |
| 36 | `criar_cadencia` | Cria cadência com passos |
| 37 | `atualizar_cadencia` | Atualiza nome/descrição |
| 38 | `excluir_cadencia` | Exclui cadência |
| 39 | `cancelar_cadencia_lead` | Cancela cadência ativa em um lead |

### 3.6 Ferramentas de Agendamentos

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 40 | `criar_agendamento` | Cria agendamento |
| 41 | `atualizar_agendamento` | Atualiza/remarca/cancela |
| 42 | `excluir_agendamento` | Exclui agendamento |

### 3.7 Ferramentas de Vendas

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 43 | `registrar_venda` | Registra venda fechada |
| 44 | `atualizar_venda` | Atualiza dados da venda |
| 45 | `excluir_venda` | Exclui venda |

### 3.8 Ferramentas de Gestão da Org

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 46 | `criar_tag` | Cria nova tag |
| 47 | `excluir_tag` | Exclui tag |
| 48 | `criar_meta` | Cria meta com projeções |
| 49 | `atualizar_meta` | Atualiza meta |
| 50 | `excluir_meta` | Exclui meta |
| 51 | `criar_procedimento` | Cria procedimento/serviço |
| 52 | `atualizar_procedimento` | Atualiza procedimento |
| 53 | `excluir_procedimento` | Exclui procedimento |
| 54 | `marcar_notificacao_lida` | Marca notificação como lida |

### 3.9 Ferramentas da Plataforma

| # | Ferramenta | O que faz |
|---|-----------|-----------|
| 55 | `listar_materiais_complementares` | Lista pastas e materiais da Trilha |
| 56 | `ler_material_complementar` | Lê conteúdo HTML de um material |
| 57 | `obter_minha_jornada` | Jornada com estágios, passos e progresso % |
| 58 | `marcar_passo_jornada` | Marca/desmarca passo como concluído |
| 59 | `criar_jornada` | Cria jornada personalizada (onboarding) |
| 60 | `listar_arsenal` | Lista categorias e ferramentas |
| 61 | `obter_arsenal_ferramenta` | Detalhes de uma ferramenta |
| 62 | `listar_meus_materiais` | Lista materiais do cliente |
| 63 | `criar_material` | Cria material em Meus Materiais |
| 64 | `atualizar_material` | Atualiza material |
| 65 | `excluir_material` | Exclui material |
| 66 | `atualizar_progresso_arsenal` | Atualiza progresso em ferramenta |
| 67 | `salvar_construcao_ferramenta` | Salva construção de uma ferramenta |

### 3.10 Como o Athos interage com o CRM

O Athos tem acesso de **leitura e escrita completo** ao CRM do cliente:

- **Consulta dados:** lê leads, métricas, pipeline, agendamentos, vendas, metas, conversas WhatsApp, blacklist, atendimento IA
- **Gerencia leads:** cria, edita, qualifica, move no pipeline, adiciona notas, gerencia tags, bloqueia/desbloqueia números, exclui
- **Envia mensagens:** mensagens WhatsApp diretas e agendadas
- **Gerencia cadências:** cria, configura, dispara, cancela, exclui
- **Gerencia agendamentos:** cria, atualiza, exclui
- **Registra vendas:** cria, atualiza, exclui
- **Configura org:** tags, metas, procedimentos

### 3.11 Como o Athos interage com a Plataforma

- **Lê materiais:** complementares e do cliente
- **Gerencia jornada:** vê progresso, marca passos, cria jornada
- **Gerencia arsenal:** lista categorias/ferramentas, atualiza progresso, salva construções
- **Gerencia materiais:** CRUD completo em Meus Materiais

### 3.12 System Prompt do Athos

O prompt padrão (`buildSystemPrompt`) inclui automaticamente:
- Data/hora atuais (BRT)
- Nome e especialidade da clínica
- Etapas do pipeline com posições
- Procedimentos cadastrados
- Diagnóstico do cliente (de `meus_materiais` com `categoria = 'diagnostico'`)
- Regras de comportamento: zero emojis, formatação markdown obrigatória, funil comercial (não pipeline) para análise

---

## 4. INTEGRAÇÕES E AUTOMAÇÕES

### 4.1 Integrações Externas

| Serviço | Integração | Como funciona |
|---------|-----------|---------------|
| **UAZAPI (WhatsApp)** | Envio/recebimento de mensagens | Webhooks inbound (`receive-message`), envio via API (`send-quick-message`, `edit-message`, `delete-message`). Conexão configurada em `whatsapp_connections` por org (URL + token). Auth via header `token` (não Bearer). |
| **OpenRouter** | Roteamento de LLMs | Usado pela edge function `descompliquei-os` (Athos GS) e `whatsapp-ai-agent` (IA pré-atendimento). Default: `openai/gpt-5.4-nano`. Suporta: OpenAI, Anthropic, Google, xAI, DeepSeek, Qwen, Mistral. API key: `OPENROUTER_API_KEY`. |
| **Supabase** | Infraestrutura completa | Postgres (banco), Auth (autenticação), Storage (arquivos), Edge Functions (backend serverless), Realtime (websockets), RLS (segurança por linha). |

### 4.2 Edge Functions Completas

| Função | Tipo | Descrição |
|--------|------|-----------|
| `receive-message` | Webhook | Recebe mensagens WhatsApp via UAZAPI |
| `whatsapp-ai-agent` | Trigger | IA de pré-atendimento — responde automaticamente usando prompt configurado |
| `ia-followup-agent` | Cron/Trigger | Follow-up automático por IA |
| `ia-proxy` | Proxy | Proxy para chamadas de IA |
| `descompliquei-os` | API (SSE) | Chat com agentes Athos GS — 67 tools, streaming SSE |
| `send-quick-message` | API | Envia mensagens WhatsApp (texto, mídia, áudio, reply) |
| `edit-message` | API | Edita mensagens enviadas (janela de 15 min) |
| `delete-message` | API | Deleta mensagens |
| `process-cadences` | Cron | Dispatcher de cadências — verifica e envia próximos passos |
| `process-scheduled-messages` | Cron | Envia mensagens agendadas |
| `process-inactivity` | Cron | Detecta leads inativos |
| `process-appointment-notifications` | Cron | Notificações de agendamentos |
| `process-outbound-notifications` | Cron | Notificações do outbound |
| `process-folder-sequence` | Cron | Processamento sequencial de pastas |
| `manage-whatsapp` | API | Gerenciamento de conexão WhatsApp |
| `manage-team` | API | Gestão de equipe/usuários |
| `detect-pipeline-stage` | API | Detecta/sugere etapa do pipeline |
| `triage-lead-ia` | API | Triagem de leads por IA |
| `trigger-campaign` | API | Dispara campanhas |
| `analyze-non-leads` | API | Analisa contatos não-leads |
| `chat-completion` | API | Completion genérico |
| `get-media-url` | API | Obtém URL de mídia |
| `getSignedAudioUrl` | API | URL assinada para áudio |
| `seed-stages` | Setup | Semeia etapas padrão para novas orgs |
| `seed-templates` | Setup | Semeia templates padrão |
| `setup-storage` | Setup | Configura buckets |
| `cleanup-storage` | Manutenção | Limpeza de storage |
| `create-platform-user` | API | Cria usuário na plataforma |
| `delete-platform-user` | API | Deleta usuário da plataforma |
| `super-admin-system-ai-config` | API | Config de IA do sistema (super admin) |
| `toggle-ai-status` | API | Liga/desliga IA para uma org |

### 4.3 Automações Ativas

| Automação | Trigger | O que faz |
|-----------|---------|-----------|
| **IA de pré-atendimento** | Mensagem recebida via WhatsApp | Responde automaticamente usando prompt configurado. Pode atualizar lead e mover no pipeline. Dispara handoff para humano quando necessário. |
| **Follow-up automático** | Cron/inatividade do lead | IA envia follow-up personalizado para leads sem resposta |
| **Dispatcher de cadências** | Cron | Verifica `lead_cadencias` com `status='ativo'` e `proxima_execucao` no passado → envia próximo passo via WhatsApp → agenda próximo passo |
| **Mensagens agendadas** | Cron | Envia mensagens de `scheduled_quick_messages` com `scheduled_for` no passado |
| **Detecção de inatividade** | Cron | Identifica leads sem atividade por X dias → gera notificação |
| **Notificações de agendamentos** | Cron | Lembra equipe de agendamentos futuros (hoje/amanhã) |
| **Stage tracking** | Trigger SQL (`trg_track_stage_change`) | Grava em `lead_stage_history` quando `posicao_pipeline` muda |
| **Onboarding auto-setup** | Criação de nova org | Seta `onboarding_enabled = true`, cria `platform_users`, semeia etapas padrão |

### 4.4 Fluxo de Dados entre Sistemas

```
WHATSAPP → receive-message → mensagens (tabela) → Conversas (UI)
                           → leads (criação automática)
                           → whatsapp-ai-agent → IA responde

PLATAFORMA → Diagnóstico → meus_materiais (diagnostico)
           → Athos GS → criar_jornada → jornadas + estagios + passos
           → Trilha → exercícios → platform_materiais
           → Arsenal → construções → meus_materiais

CRM → leads ↔ Athos GS (leitura e escrita completa)
    → vendas, agendamentos, metas → métricas → Dashboard + Evolução
    → cadências → process-cadences → WhatsApp (envio automático)
    → IA prompt → whatsapp-ai-agent → respostas automáticas
```

---

## 5. TABELAS PRINCIPAIS (Referência)

### 5.1 CRM

| Tabela | Descrição |
|--------|-----------|
| `perfis` | Perfis de usuário (link com `auth.users`) |
| `organizations` | Tenants (multi-tenant) |
| `leads` | Contatos/leads (inclui `lead_scoring`, `fonte`) |
| `mensagens` | Mensagens WhatsApp (suporta `quoted_message_id`, `is_edited`, `edited_at`) |
| `etapas` | Etapas do pipeline |
| `cadencias` | Sequências de mensagens automatizadas |
| `cadencia_passos` | Passos individuais de cada cadência |
| `lead_cadencias` | Rastreia qual cadência foi despachada para qual lead |
| `cadencia_logs` | Logs de execução de passos |
| `agendamentos` | Agendamentos de consultas/procedimentos |
| `vendas` | Vendas registradas |
| `metas` | Metas de desempenho |
| `procedimentos` | Catálogo de procedimentos/serviços |
| `tags` / `leads_tags` | Sistema de etiquetas |
| `lead_notas` | Notas manuais e de sistema por lead |
| `lead_stage_history` | Histórico de transições no pipeline |
| `lead_blacklist` | Números bloqueados permanentemente |
| `notificacoes` | Notificações do sistema |
| `organization_branding` | White-label por org |
| `whatsapp_connections` | Config de conexão UAZAPI por org |
| `usuarios_papeis` | Papéis de usuário (superadmin, admin, atendente) |
| `integracoes` | Credenciais de integrações externas |
| `scheduled_quick_messages` | Mensagens agendadas |
| `team_member_permissions` | Permissões de membros da equipe |

### 5.2 Plataforma

| Tabela | Descrição |
|--------|-----------|
| `platform_users` | Usuários da plataforma (flags de onboarding, plano) |
| `platform_tenants` | Tenants da plataforma com produto e acesso |
| `platform_modules` | Módulos da trilha de aprendizado |
| `platform_progress` | Progresso do usuário nos módulos |
| `platform_sessoes_taticas` | Sessões de mentoria |
| `platform_complementary_folders` | Pastas de materiais complementares |
| `platform_complementary_materials` | Materiais complementares (PDF/HTML) |
| `arsenal_categorias` | Categorias do arsenal |
| `arsenal_ferramentas` | Ferramentas do arsenal |
| `arsenal_progresso` | Progresso do usuário nas ferramentas |
| `meus_materiais` / `platform_materiais` | Materiais criados pelo usuário |
| `jornadas` | Jornadas personalizadas |
| `jornada_estagios` | Estágios de uma jornada |
| `jornada_passos` | Passos dentro de um estágio |
| `onboarding_diagnosticos` | Respostas do diagnóstico |
| `onboarding_progresso` | Progresso do onboarding (etapa + bloco atual) |
| `athos_agentes` | Agentes de IA configuráveis |
| `os_conversations` | Conversas com o Athos GS |
| `os_messages` | Mensagens das conversas OS |

---

*Documento gerado para servir como base de conexão entre Arsenal de Ferramentas e o ecossistema CRM + Plataforma Descompliquei.*
