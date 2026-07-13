# Resultado no CRM — O Que o Cliente Percebe

## Por Que Isso Existe

O cliente entra na Descompliquei com um objetivo: **multiplicar o faturamento**. Nenhuma outra métrica importa se esse resultado não aparece. Por isso o CS mede, direto do CRM de cada cliente, o que ele de fato percebe como valor — faturamento, crescimento, conversão e velocidade de atendimento.

Estas análises alimentam o **eixo Resultado** do Health Score (60% do total — ver [03-health-score.md](03-health-score.md)) e ficam em destaque na ficha de cada cliente.

---

## As Métricas

### Faturamento e Crescimento (sinal-mestre)

O número que mais importa é o **crescimento do faturamento** — o cliente está faturando mais do que antes?

- **Faturamento do período**: soma das vendas fechadas no período selecionado.
- **Crescimento período-a-período**: variação % contra o período anterior de mesma duração (semana vs. semana anterior, mês vs. mês anterior).
- **Ticket médio**: faturamento ÷ número de fechamentos.
- **Faturamento total**: acumulado desde o início (histórico, não muda com o filtro).

> Crescimentos acima de +300% quase sempre são artefato de base quase-zero (o período anterior mal teve faturamento). Nesses casos o sistema exibe `+300%+` em vez do número absurdo.

### Funil de Conversão

O caminho do lead até a venda, nos leads criados no período:

**Leads → MQL → Agendamentos → Fechamentos**, com a taxa de conversão de cada etapa. Um funil que trava em uma etapa específica aponta onde o cliente precisa de ajuda.

### Tempo de Atendimento

A velocidade com que o cliente responde ao lead — um dos maiores fatores de conversão:

- **1º contato médio**: tempo entre o lead chegar e a primeira mensagem enviada.
- **Resposta média**: tempo médio entre uma mensagem do lead e a resposta.

> **Guard de confiabilidade:** primeiros contatos que levam mais de 3 dias são ignorados no cálculo. Um "1º contato" de dias/semanas quase sempre é artefato de importação em massa (lead criado com data antiga, mensageado muito depois), não responsividade real. Sem esse corte, a média ficava distorcida (ex.: ~20h).

### Adoção de Funcionalidades

Quais recursos do CRM o cliente realmente usa: IA de atendimento, follow-up, agendamentos, registro de vendas, metas e etiquetas. Uma funcionalidade não adotada é uma oportunidade de CS.

---

## O Filtro de Período

Na ficha, todos os dados do CRM respeitam um filtro **Dia / Semana / Mês**, com navegação para frente e para trás entre períodos.

- **Reagem ao filtro:** faturamento, fechamentos, crescimento, funil e tempo de atendimento.
- **Não mudam com o filtro (histórico geral):** faturamento total, série de 12 meses, meta e adoção — ficam numa zona visualmente separada.

O crescimento sempre compara com o período anterior de mesma duração. A consulta se limita até hoje, então mês/semana em andamento comparam de forma justa (primeiros N dias vs. primeiros N dias do período anterior).

---

## Meta de Faturamento

Sem meta configurada não há régua de sucesso — o cliente não sabe se está indo bem.

- Quando **não há meta**, a ficha mostra um alerta e um botão **"Configurar meta"**: o CSM define a meta mensal direto do CS.
- Quando **há meta**, aparece a barra de progresso (realizado vs. meta) com o % batido.

Configurar a meta do cliente é uma das ações de CS mais importantes da fase de Ativação/Execução.

---

## Fila Proativa: "Resultado em Risco"

O CS não deve depender de abrir cliente por cliente para achar problema. No **Painel**, uma faixa no topo lista automaticamente os clientes em risco de resultado:

- Faturamento em queda (vs. período anterior)
- CRM parado há 14+ dias (sem atividade)
- Zero fechamentos em 30 dias com leads ativos
- Health em risco

Ordenados pela pior queda primeiro — o CSM começa o dia sabendo exatamente onde agir.

---

## Como os Dados São Coletados

Tudo é lido diretamente do CRM de cada cliente (por organização), de forma agregada e segura no servidor. As análises consideram apenas dados reais de vendas, leads e mensagens — **sem incluir marketing/Meta Ads ou scoring de leads**, que são recursos exclusivos e não fazem sentido como métrica de CS transversal.

Um snapshot diário do Resultado é gravado automaticamente para montar a curva de tendência ao longo do tempo.
