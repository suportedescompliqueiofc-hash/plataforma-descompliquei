# Planejamento CS — Da Documentação para a Plataforma

> **Objetivo:** Transformar o processo de CS documentado em `operacional/cs/` em uma ferramenta operacional completa dentro do Admin OS. O CSM deve conseguir executar 100% do processo de CS diretamente na plataforma — sem documentos externos, sem planilhas, sem post-its.

---

## Estado Atual vs. Estado Alvo

### O que existe hoje (v1 — "cru")
A página `/admin/cs` tem:
- 5 tabs básicas: Visão Geral, Base de Clientes, Touchpoints, NPS & Advocacy, Métricas
- Health score **100% manual** (5 sliders sem contexto)
- Touchpoints como log simples (tipo + resultado + notas)
- Sem perfil individual por cliente
- Sem playbooks
- Sem templates de mensagem
- Sem tracking de marcos
- Sem detecção de sinais de risco
- Sem pipeline de renovação

### O que o CS precisa ter na plataforma
Um CSM deve abrir a plataforma e conseguir responder **imediatamente**:
1. Quais clientes precisam de atenção agora?
2. O que eu faço com esse cliente hoje, especificamente?
3. O que devo dizer para esse cliente nesse WhatsApp?
4. Esse cliente está no caminho certo para renovar?
5. Esse cliente está pronto para indicar?

Se a plataforma não responde essas 5 perguntas, ela não serve como ferramenta operacional de CS.

---

## Arquitetura Final da Página AdminCS

### Estrutura de tabs revisada

```
[Central]  [Base de Clientes]  [Ficha do Cliente ↗]  [Playbooks]  [Templates]  [Renovações]  [Métricas]
```

**Central** substitui "Visão Geral" — mais ação, menos número. Dashboard operacional do dia.

**Ficha do Cliente** não é uma tab — é um slide-over (painel lateral) que abre ao clicar em qualquer cliente. É o coração de toda a operação.

**Playbooks** é uma tab com os 4 playbooks interativos (Onboarding, Engajamento, Risco, Escalada).

**Templates** é o banco de mensagens WhatsApp/e-mail por situação.

**Renovações** é o pipeline de renovação com contagem regressiva.

---

## Módulo 1 — Ficha do Cliente CS

**Prioridade: MÁXIMA. Tudo gira em torno disso.**

### O que é
Um slide-over (painel lateral de 520px) que abre ao clicar em qualquer cliente na Base de Clientes. Concentra tudo sobre aquele cliente em um só lugar.

### Seções da Ficha

#### Cabeçalho
```
[dot de saúde] Nome da Clínica             [Produto: PCA]
               Fase: Execução · Dia 47     [Ver perfil na plataforma ↗]
```

#### Seção 1 — Resumo de Risco (só aparece se há sinais ativos)
```
⚠ 2 sinais de risco detectados
  • Sem acesso à plataforma há 9 dias
  • 2 reuniões canceladas consecutivamente
[Acionar Playbook de Risco →]
```

#### Seção 2 — Health Score
Não é só um número. É um painel com 5 barras dimensionais:

```
Health Score                                   72 🟢 Verde

Ativação da Plataforma    ████████░░  80    20%
Progresso na Jornada      ███████░░░  70    25%  ← auto
Engajamento no Arsenal    █████░░░░░  55    20%  ← auto
Resultados no CRM         ████████░░  80    25%  ← auto
Responsividade ao CS      ██████████ 100    10%  ← auto

Última avaliação: 3 dias atrás · CSM: João Miguel
[Reavaliar agora]
```

As dimensões marcadas `← auto` são calculadas automaticamente com dados reais da plataforma. O CSM só precisa ajustar se o dado automático não refletir a realidade.

#### Seção 3 — Marcos da Jornada (tracker por fase)

Para cada fase, exibe os marcos obrigatórios com status:

```
FASE DE ATIVAÇÃO (D0–D30)                           ✓ Concluída

  ✓ D3   Diagnóstico completo
  ✓ D7   Jornada ativa + primeiro passo iniciado
  ✓ D14  Primeira ferramenta do Arsenal construída
  ✗ D21  CRM com ao menos 1 lead ativo              ← em atraso
  ✗ D30  3+ ferramentas do Arsenal acessadas         ← pendente

FASE DE EXECUÇÃO (D31–D90)                          ● Em andamento

  ✗ D60  30% da jornada concluída
  ✗ D60  Primeiros resultados no CRM
  ✗ D90  50% da jornada concluída
```

Os marcos D3, D7, D14 são preenchidos **automaticamente** com base em:
- `onboarding_diagnosticos` → D3 diagnóstico
- `jornada_passos` concluídos → D7, D14, D30, D60, D90

O CSM pode marcar manualmente marcos qualitativos (resultado declarado, NPS coletado).

#### Seção 4 — Próximas Ações Recomendadas

Geradas automaticamente com base na fase, score e sinais:

```
PRÓXIMAS AÇÕES

  1. [URGENTE] Lead ativo no CRM — cliente sem leads cadastrados
     → Usar Template: "Incentivo CRM — Fase Ativação"

  2. Touchpoint D30 pendente — reunião de balanço do mês 1
     → Ver Playbook: Onboarding, passo D30
     [Registrar reunião realizada]

  3. Ferramenta recomendada: ICP — Definição do Paciente Ideal
     → Arsenal ainda não acessado
```

#### Seção 5 — Histórico de Touchpoints
Timeline vertical dos últimos contatos, com tipo, resultado e notas. Botão "Novo touchpoint" inline.

#### Seção 6 — NPS
Score atual, data da coleta, comentário. Botão "Coletar NPS".

#### Seção 7 — Protocolo Ativo
Se há um playbook em andamento (ex: Risco — Tipo 1 Inatividade, Passo 3), exibe o status e o próximo passo.

---

## Módulo 2 — Health Score Automático

### Dados disponíveis para cálculo automático

| Dimensão | Dados disponíveis | Como calcular |
|----------|------------------|--------------|
| Ativação (20%) | `platform_users.onboarding_concluido`, `onboarding_complete` | 0 = nunca acessou, 40 = onboarding não concluído, 100 = completo |
| Jornada (25%) | `jornada_passos` concluídos vs total via `jornada_estagios` | % de passos concluídos → score por tabela da doc |
| Arsenal (20%) | `arsenal_aulas_progresso` concluídas + `meus_materiais` salvos | Contagem de ferramentas construídas → score por tabela |
| CRM (25%) | **Não disponível diretamente** — cliente é de outra org | Manual pelo CSM via slider (1–4 pontos) |
| Responsividade (10%) | `cs_touchpoints` — dias desde último touchpoint com resultado positivo | Calculado automaticamente |

### Lógica de cálculo automático de Responsividade
```
Dias desde último touchpoint positivo:
  0–3 dias   → 100
  4–7 dias   → 80
  8–14 dias  → 50
  15–21 dias → 20
  22+ dias   → 0
  Sem touchpoints registrados → 30 (default neutro)
```

### Interface do Health Score
- Mostra score calculado automaticamente com badge "Auto"
- Para dimensões manuais (CRM), exibe slider com 4 opções descritivas (não números brutos):
  - "CRM ativo + leads em progresso + conversão crescente" → 100
  - "CRM ativo com leads cadastrados, conversão estável" → 75
  - "CRM parcialmente ativo" → 50
  - "CRM com pouquíssima atividade" → 25
  - "CRM vazio ou abandonado" → 0
- Botão "Salvar avaliação" — grava em `cs_health_scores` e atualiza `platform_users.cs_health_status`
- Histórico de scores anteriores visível como linha do tempo reduzida

---

## Módulo 3 — Central (Dashboard Operacional)

### O que muda em relação ao atual "Visão Geral"

A Central não é sobre números — é sobre o que fazer **hoje**.

#### Seção 1 — Alertas do Dia (prioridade máxima)
```
ATENÇÃO IMEDIATA

  🔴 Clínica X — Score vermelho há 3 dias, sem resposta a 2 mensagens
     → Protocolo anti-ghosting D+5: enviar áudio WhatsApp
     [Abrir ficha] [Copiar template]

  🟡 Clínica Y — Reunião D30 vencida há 5 dias (não realizada)
     → Reagendar imediatamente
     [Abrir ficha] [Copiar template de reagendamento]
```

#### Seção 2 — Agenda da Semana
Touchpoints planejados para os próximos 7 dias, com base na cadência por fase:
```
AGENDA DA SEMANA

  Hoje       Clínica A — Reunião de engajamento (D60)
  Amanhã     Clínica B — Pulse WhatsApp (D21)
  Quinta     Clínica C — Reunião D30 (balanço mês 1)
```

#### Seção 3 — Distribuição de Saúde (igual ao atual, mas mais visual)

#### Seção 4 — Candidatos a Advocacy
Clientes com ≥ 5 critérios de prontidão (health verde 60+ dias, NPS ≥ 9, resultado declarado, etc.):
```
PRONTOS PARA INDICAR

  Clínica Z — 5/6 critérios · Health verde 72 dias · NPS 9
  [Ver critérios] [Abrir template de abordagem]
```

---

## Módulo 4 — Playbooks Interativos

### O que é
Cada playbook vira um checklist/fluxo interativo. O CSM aciona o playbook para um cliente e acompanha o progresso passo a passo.

### Playbook 1 — Onboarding (D0–D30)

Estado: ativo, progresso salvo por cliente.

```
PLAYBOOK DE ONBOARDING — Clínica X                    Dia 12 de 30

  ✓ D0   Kickoff realizado — 14/06 com João
  ✓ D3   WhatsApp de acompanhamento enviado
  ✓ D3   Diagnóstico verificado ← automático
  ✓ D7   Jornada confirmada ativa ← automático
  ● D14  [HOJE] Verificar primeira ferramenta construída
         → Template sugerido: "Pulse D14"
         [Marcar como feito] [Copiar template]
  ○ D21  Verificar CRM com lead ativo
  ○ D30  Reunião de balanço do mês 1
         → Pauta sugerida: [Ver agenda D30]

  Sinais de alarme monitorados: 0 ativos ✓
```

### Playbook 2 — Engajamento (Fase Execução e Tração)

Focado na reunião quinzenal/mensal de acompanhamento:

```
REUNIÃO DE ACOMPANHAMENTO — Clínica Y            Dia 52

  PAUTA SUGERIDA (45 min)
  ─────────────────────────────────────
  5 min   Aquecimento — o que mudou desde a última reunião?
  10 min  Resultados no CRM — análise juntos
          → Leads: 3 novos cadastrados
          → Conversões: 1 fechamento
  15 min  Progresso na jornada
          → 38% concluído (meta era 30%)  ✓ No caminho
  10 min  Travamentos — o que está difícil?
  5 min   Próximos 15 dias — 1 compromisso específico

  [Registrar reunião realizada]  [Copiar resumo pós-reunião]
```

### Playbook 3 — Risco de Churn

```
PLAYBOOK DE RISCO — Clínica Z                    ⚠ ATIVO

  Tipo identificado: INATIVIDADE
  Sinais detectados: 3 de 8
    • Sem acesso à plataforma há 9 dias ← automático
    • Jornada parada há 14 dias ← automático
    • Último touchpoint positivo há 18 dias ← automático

  PROTOCOLO (5 passos)

  ✓ Passo 1 — Diagnóstico do tipo: Inatividade
  ● Passo 2 — [HOJE] Contato via WhatsApp (informal)
              → Template: "Resgate D+1"
              [Copiar template] [Marcar enviado]
  ○ Passo 3 — Call de diagnóstico (se não responder em 24h)
  ○ Passo 4 — Plano de recuperação de 30 dias
  ○ Passo 5 — Review em 30 dias

  [Escalar para líder de CS]
```

### Playbook 4 — Escalada

```
PROTOCOLO DE ESCALADA — Clínica W

  Nível selecionado: NÍVEL 2 — Líder de CS assume a conta

  BRIEFING (gerado automaticamente)
  ─────────────────────────────────
  Cliente: Clínica W
  CSM responsável: João Miguel
  Tempo como cliente: 4 meses
  Health score atual: 28 🔴 Vermelho
  Fase atual: Execução (D120)
  Progresso na jornada: 22%
  Arsenal: 1 ferramenta construída
  Último touchpoint: há 19 dias (sem resposta)

  O que aconteceu:
  [campo de texto preenchido pelo CSM]

  O que já foi tentado:
  [campo de texto]

  Hipótese do problema:
  [campo de texto]

  Nível recomendado: Nível 2

  [Gerar briefing completo]  [Acionar líder de CS]
```

---

## Módulo 5 — Templates de Mensagem

### Estrutura
Banco de templates acessível em duas formas:
1. **Na Ficha do Cliente** — sugeridos contextualmente (certo template para o momento certo)
2. **Na tab Templates** — biblioteca completa para consulta direta

### Organização dos templates

#### Por fase
**Ativação:**
- Template D3 — Pulse pós-kickoff
- Template D7 — Verificação de jornada ativa
- Template D14 — Verificação de primeira ferramenta
- Template D21 — Incentivo CRM

**Execução:**
- Template de convite para reunião quinzenal
- Template de resumo pós-reunião
- Template D60 — Celebração do primeiro resultado

**Risco — Inatividade:**
- Template D+1 — Informal e curto
- Template D+3 — Mais direto com pergunta específica
- Template D+5 — Áudio (roteiro sugerido)
- Template D+10 — E-mail completo

**Escalada:**
- Template de apresentação do Líder ao cliente
- Template de retomada pós-escalada

**Expansão:**
- Script de abordagem de indicação
- Script de solicitação de depoimento

### Interface do template
```
Template: Pulse D+1 (Risco — Inatividade)     [Copiar] [Editar]
─────────────────────────────────────────────────────────────────
Oi [nome], tudo bem?

Faz um tempo que não nos falamos — queria saber como você está.
Não precisa ser nada longo, só queria saber se está tudo bem por aí.

──────────────────────
Variáveis: [nome] → substitui automaticamente pelo nome do cliente
```

---

## Módulo 6 — Detecção Automática de Sinais de Risco

### Os 8 sinais (do playbook de risco)

| # | Sinal | Como detectar automaticamente |
|---|-------|-------------------------------|
| 1 | Sem acesso à plataforma 7+ dias | `platform_users` — último login (se disponível) ou jornada sem progresso |
| 2 | Jornada parada 14+ dias | `jornada_passos.concluido_em` — última conclusão |
| 3 | CRM sem atividade 30+ dias | **Manual** — CSM registra |
| 4 | Não responde WhatsApp 72h+ | `cs_touchpoints` — resultado = `sem_resposta` nas últimas 3 tentativas |
| 5 | 2 reuniões consecutivas canceladas | `cs_touchpoints` — tipo = `reuniao`, resultado = `sem_resposta` ou CSM marcou falta |
| 6 | 2+ reclamações recorrentes | `cs_touchpoints` — resultado = `negativo` em 2+ registros recentes |
| 7 | Menciona alternativa/concorrente | **Manual** — CSM registra via flag no touchpoint |
| 8 | Pergunta sobre cancelamento | **Manual** — CSM registra via flag no touchpoint |

### Implementação
- Detecção automática roda na abertura da Ficha do Cliente + uma vez por dia
- Sinais 1, 2, 4, 5, 6 detectados automaticamente
- Sinais 3, 7, 8 exigem marcação manual no touchpoint (checkbox "sinal de risco")
- Badge vermelho aparece na lista de clientes quando há 2+ sinais ativos
- Sinais 7 e 8 isoladamente já geram alerta imediato na Central

---

## Módulo 7 — Pipeline de Renovação

### Lógica
Usa `platform_tenants.trial_ends_at` como data de vencimento.

```
RENOVAÇÕES EM ABERTO

  [URGENTE] Clínica X      Vence em 12 dias  🔴  Proposta pendente
  [ATENÇÃO] Clínica Y      Vence em 28 dias  🟡  Retrospectiva agendada
  [OK]      Clínica Z      Vence em 45 dias  🟢  Em acompanhamento
  [FUTURO]  Clínica W      Vence em 67 dias  ⚪  Iniciar em 7 dias
```

### Status possíveis
- `em_acompanhamento` — dentro dos 60 dias, ainda sem ação
- `retrospectiva_agendada` — reunião de retrospectiva (D-45) marcada
- `proposta_enviada` — proposta apresentada (D-30)
- `confirmado` — renovação confirmada
- `em_risco` — objeção identificada, escalada necessária

### Protocolo embutido
Cada cliente no pipeline mostra o próximo passo do protocolo:
```
Clínica X — Vence em 12 dias
→ [D-30] Apresentar proposta de renovação com novos objetivos
Próximo passo: [Marcar reunião de proposta]
```

---

## Módulo 8 — Expansão e Advocacy

### Critérios de prontidão (exibidos como checklist por cliente)
```
PRONTIDÃO PARA ADVOCACY — Clínica Z

  ✓ Health score verde por 60+ dias (atual: 72 dias)
  ✓ Progresso na jornada ≥ 70% (atual: 78%)
  ✗ CRM ativo com conversões nos últimos 30 dias
  ✓ Resultado declarado pelo cliente (registrado em touchpoint)
  ✓ Responsividade: comparece às reuniões
  ✗ NPS ≥ 8 (não coletado ainda)

  4 de 6 critérios · Candidato em potencial
  → Coletar NPS como próximo passo
  [Copiar script de abordagem de NPS]
```

---

## Tabelas de Banco de Dados — Adições Necessárias

```sql
-- Protocolo ativo por cliente (qual playbook está em andamento)
cs_client_protocols (
  id, client_id, tipo (onboarding/engajamento/risco/escalada/expansao),
  status (ativo/concluido/cancelado), passo_atual, iniciado_em, updated_at
)

-- Marco individual atingido por cliente
cs_marcos (
  id, client_id, marco (d3_diagnostico/d7_jornada/d14_ferramenta/...),
  atingido (boolean), atingido_em, automatico (boolean), notas
)

-- Sinal de risco registrado
cs_sinais_risco (
  id, client_id, sinal (1..8), detectado_em, resolvido_em, notas
)

-- Status de renovação por cliente
cs_renovacoes (
  id, client_id, data_vencimento, status, notas, updated_at
)

-- Depoimentos coletados
cs_depoimentos (
  id, client_id, formato (audio/video/texto/case), coletado_em, conteudo, notas
)

-- Templates de mensagem editáveis (para que o time possa customizar)
cs_templates (
  id, nome, categoria (ativacao/risco/escalada/expansao), fase (d3/d7/.../ghosting),
  conteudo, variaveis text[], ativo
)
```

---

## Colunas adicionais em `cs_touchpoints`
```sql
ALTER TABLE cs_touchpoints
  ADD COLUMN sinal_risco integer,  -- qual sinal de risco (1–8) foi identificado neste contato
  ADD COLUMN playbook_tipo text,   -- playbook que originou este touchpoint
  ADD COLUMN playbook_passo text,  -- passo específico (d3, d7, passo2_diagnostico, etc.)
  ADD COLUMN cliente_faltou boolean; -- para reuniões: cliente compareceu ou faltou
```

---

## Ordem de Implementação

### Sprint 1 — Fundação (implementar primeiro)
1. **Ficha do Cliente CS** — slide-over com seções: resumo, health score, marcos, touchpoints
2. **Detecção automática de sinais de risco** — score automático nas dimensões calculáveis
3. **Revisão da tab Central** — alertas do dia + agenda da semana

### Sprint 2 — Operação (torna o processo executável)
4. **Playbook de Onboarding interativo** — checklist por fase com templates inline
5. **Playbook de Risco interativo** — 5 passos com templates e acionamento de escalada
6. **Templates de mensagem** — banco completo organizado por situação

### Sprint 3 — Gestão (fecha o ciclo)
7. **Pipeline de Renovação** — tracker com contagem regressiva e protocolo
8. **Playbook de Engajamento** — pauta de reunião interativa
9. **Playbook de Escalada** — briefing automático + nível de escalada
10. **Expansão e Advocacy** — critérios de prontidão + scripts

### Sprint 4 — Inteligência (automatiza o que for possível)
11. **Health score parcialmente automático** — leitura de jornada, arsenal e responsividade
12. **Detecção automática de marcos** — D3, D7, D14, D30 via dados da plataforma
13. **Sugestão contextual de ação** — "próxima ação recomendada" baseada em dados

---

## Princípio de Design da Página CS

> **Cada vez que o CSM abre a página, ela deve dizer o que fazer — não apenas mostrar dados.**

A diferença entre um dashboard e uma ferramenta operacional é que o dashboard informa e a ferramenta operacional **orienta**. A página CS deve ser uma ferramenta operacional:

- Cada cliente tem uma **próxima ação clara**
- Cada ação tem um **template pronto** para executar
- Cada protocolo tem um **checklist** que guia o passo a passo
- Cada sinal de risco tem um **plano de resposta** acessível com 1 clique

O CSM não deve precisar consultar documentos externos. A plataforma carrega o conhecimento e entrega na hora certa.
