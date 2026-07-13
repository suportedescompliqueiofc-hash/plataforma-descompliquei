# Métricas e KPIs do CS

## Princípio

O CS da Descompliquei é medido em três camadas:
1. **Saúde da base** — o resultado agregado de todas as contas
2. **Operação do CS** — a eficiência e qualidade do trabalho do time
3. **Resultado do cliente** — o que o cliente está entregando dentro da plataforma

Métricas de operação do CS sem métricas de resultado do cliente são vaidade. Métricas de resultado do cliente sem métricas de operação não ajudam a identificar o que melhorar. As três camadas precisam ser acompanhadas juntas.

---

## Camada 1 — Saúde da Base

São as métricas que determinam a saúde do negócio de CS como um todo.

### NRR — Net Revenue Retention

> Receita retida + expansão, dentro da base existente, em um dado período.

**Fórmula:**
```
NRR = (MRR início do período + Expansão - Downgrades - Churn) / MRR início do período × 100
```

**Objetivo:** ≥ 100% — o que significa que expansão e retenção superam o churn.

**Por que importa:** NRR > 100% significa que mesmo sem novos clientes, a receita cresce. É o indicador mais poderoso de CS saudável.

---

### Churn Rate Mensal

> Percentual de clientes ou receita que saiu no mês.

**Fórmula:**
```
Churn Rate = (Clientes cancelados no mês / Clientes no início do mês) × 100
```

**Objetivo:** < 2% ao mês (< ~22% ao ano)

**Tipos de churn a monitorar:**
- Logo (imediato — nos primeiros 60 dias): indica problema de onboarding
- Mid (60–180 dias): indica problema de engajamento ou resultado
- Tardio (180+ dias): indica problema de renovação ou expectativa de longo prazo

---

### NPS — Net Promoter Score

> Probabilidade de o cliente recomendar a Descompliquei para outra clínica.

**Coleta:** pergunta única — "De 0 a 10, qual a probabilidade de você recomendar a Descompliquei para um colega de profissão?"

**Classificação:**
- Promotores (9–10): clientes que vão recomendar ativamente
- Neutros (7–8): satisfeitos mas não entusiasmados
- Detratores (0–6): clientes insatisfeitos que podem prejudicar a reputação

**Fórmula:**
```
NPS = % Promotores - % Detratores
```

**Objetivo:** ≥ 40

**Frequência de coleta:** trimestral — via WhatsApp ou formulário simples após reunião de acompanhamento.

**Ação por resultado:**
- 9–10: candidato a indicação e depoimento — acionar programa de advocacy
- 7–8: identificar o que faltou para ser 9–10
- 0–6: contato imediato para entender insatisfação — não deixar passar

---

### Health Score Médio da Base

> Média ponderada do health score de todas as contas ativas.

**Objetivo:** ≥ 65 (maioria da base em verde)

**Como usar:** distribuição é mais importante que a média. Uma base com 80% verde e 20% vermelho é diferente de uma base toda em amarelo.

**Review:** mensal pelo líder de CS

---

### Distribuição da Base por Fase

Monitorar quantos clientes estão em cada fase da jornada (ativação / execução / tração / maturidade). Uma base saudável tem a maioria dos clientes avançando para tração e maturidade.

| Fase | Objetivo (% da base) |
|------|---------------------|
| Ativação | < 15% (só os mais novos) |
| Execução | 30–40% |
| Tração | 30–40% |
| Maturidade | 20–30% |

---

## Camada 2 — Operação do CS

São as métricas que avaliam a qualidade e consistência do trabalho do time de CS.

### Taxa de Touchpoints Realizados

> Percentual dos touchpoints planejados que foram efetivamente executados.

**Como medir:** comparar touchpoints planejados (conforme cadência) vs. touchpoints registrados.

**Objetivo:** ≥ 90%

**O que abaixo de 90% indica:** CSM sobrecarregado, cadência mal calibrada, ou falta de registro (que é um problema por si só).

---

### Tempo Médio de Resposta no WhatsApp

> Tempo médio entre a mensagem do cliente e a resposta do CSM.

**Objetivo:** < 4h em dias úteis

**Janela de atendimento:** definir e comunicar ao cliente (ex: segunda a sexta, 9h–18h)

**Por que importa:** resposta rápida é sinal de presença e cuidado. Cliente que não recebe resposta em tempo razoável começa a sentir abandono — e abandono vira churn.

---

### Taxa de Presença nas Reuniões

> Percentual de reuniões agendadas em que o cliente comparecer.

**Objetivo:** ≥ 80%

**O que abaixo de 80% indica:** reuniões sem valor percebido pelo cliente, cliente desengajado, ou agendamentos mal colocados.

**Ação quando abaixo:** pesquisar com o cliente por que as reuniões estão sendo canceladas — pode ser sinal precoce de risco.

---

### Tempo Médio até Ativação

> Tempo do D0 até o cliente atingir todos os marcos de ativação (diagnóstico + jornada + primeira ferramenta).

**Objetivo:** < 14 dias

**O que acima de 14 dias indica:** falha no kickoff, cliente com dificuldade técnica, ou primeiro passo mal definido.

---

### Ratio CSM / Conta

> Número de contas ativas por CSM.

**Referência:**
- Standard: 40–60 contas por CSM
- High-touch (clientes maiores ou em onboarding): 15–25 contas por CSM

**O que acima do limite indica:** o CSM não consegue dar a atenção necessária para cada conta — qualidade vai cair. Hora de contratar ou redistribuir.

---

## Camada 3 — Resultado do Cliente

São as métricas que mostram o que o cliente está entregando dentro da plataforma — e que definem se ele vai renovar.

### Progresso Médio na Jornada

> Percentual médio de etapas da jornada concluídas pela base.

**Objetivo:** ≥ 50% da base com 50%+ da jornada concluída após 90 dias.

---

### Ferramentas do Arsenal Utilizadas

> Número médio de ferramentas do Arsenal construídas por cliente ativo.

**Objetivo:** ≥ 5 ferramentas construídas por cliente após 60 dias.

---

### Atividade no CRM

> Percentual de clientes com o CRM ativo (leads cadastrados + interações nos últimos 30 dias).

**Objetivo:** ≥ 80% da base com CRM ativo.

**O que abaixo indica:** cliente não está aplicando o que aprende na prática comercial — resultado não vai aparecer.

---

## Frequência de Review das Métricas

| Camada | Métrica | Frequência | Responsável |
|--------|---------|-----------|------------|
| Saúde da base | Churn rate, NRR, health score médio | Mensal | Líder de CS |
| Saúde da base | NPS | Trimestral | Líder de CS |
| Operação do CS | Touchpoints, tempo de resposta, presença | Semanal | Líder de CS |
| Resultado do cliente | Progresso, Arsenal, CRM | Quinzenal | CSM por conta |

---

## O Dashboard Interno do CS

O time de CS precisa de visibilidade em tempo real das contas em risco. O dashboard interno deve mostrar, no mínimo:

- Lista de contas com health score vermelho e amarelo
- Contas sem touchpoint há mais de 14 dias
- Contas em onboarding que não atingiram marcos obrigatórios
- NPS detratores aguardando ação
- Renovações nos próximos 60 dias

Sem esse dashboard, o CS opera no escuro — reativo em vez de proativo.
