# Health Score — Sistema de Saúde do Cliente

## O Que É o Health Score

O health score é o termômetro de cada conta: um número único, de 0 a 100, que resume o estado real do cliente em um dado momento. Ele é **calculado automaticamente** a partir dos dados da plataforma e do CRM do cliente — não depende mais de avaliação manual por sliders.

O modelo foi reformulado em **dois eixos**, porque o que mantém um cliente na Descompliquei não é o quanto ele usa a plataforma, e sim o **resultado que ele percebe no faturamento**. Por isso o eixo de Resultado pesa mais.

**Para que serve:**
- Priorizar a atenção do CSM (quem precisa de intervenção agora)
- Antecipar churn antes que ele aconteça
- Separar quem *usa a plataforma* de quem *está tendo resultado*
- Medir a saúde da base como um todo (input para o negócio)

---

## Os 2 Eixos

O health total é a média ponderada de dois eixos:

```
Health Score = (Adoção × 0,40) + (Resultado × 0,60)
```

### Eixo 1 — Adoção (40%): uso da plataforma

Mede o quanto o cliente está engajado com a plataforma e mantém a rotina no CRM. É o "esforço".

| Componente | Peso interno | O que mede |
|------------|--------------|-----------|
| Ativação | 25% | Onboarding e checklist da plataforma concluídos |
| Jornada | 25% | Progresso e atividade recente na jornada do Athos |
| Arsenal | 15% | Ferramentas construídas e aulas concluídas |
| Rotina no CRM | 20% | Adesão aos check-ins diários de performance |
| Responsividade | 15% | Regularidade de resposta aos touchpoints do CSM |

### Eixo 2 — Resultado no CRM (60%): o que o cliente percebe

Mede o resultado comercial real do cliente — faturamento, crescimento, conversão e velocidade de atendimento. É o "resultado". O detalhamento completo está em [11-resultado-no-crm.md](11-resultado-no-crm.md).

| Componente | Peso interno | O que mede |
|------------|--------------|-----------|
| Crescimento de faturamento | 32% | Faturamento vs. período anterior (**sinal-mestre**) |
| Receita | 26% | Volume de fechamentos gerados em 30 dias |
| Conversão | 20% | Taxa de fechamento do funil (lead → venda) |
| Tempo de atendimento | 14% | Velocidade do 1º contato ao lead |
| Meta | 8% | % da meta de faturamento batida (quando configurada) |

> Quando o cliente **não tem meta configurada**, o peso da Meta é redistribuído entre os demais componentes — a ausência de meta não penaliza o score, mas vira ação de CS (configurar a meta).

---

## Escala de Saúde

| Score | Status | Cor | Ação do CS |
|-------|--------|-----|-----------|
| 70–100 | Saudável | 🟢 Verde | Cadência padrão — manter e cultivar |
| 45–69 | Em atenção | 🟡 Amarelo | Atenção redobrada — intensificar touchpoints |
| 0–44 | Em risco | 🔴 Vermelho | Intervenção imediata — acionar playbook de churn |

### Verde (70–100)
Cliente adotando a plataforma **e** tendo resultado no CRM. Manter a cadência padrão. Avaliar se está próximo de candidato a expansão ou indicação.

### Amarelo (45–69)
Algo está travado — pode ser adoção baixa com resultado ok, ou o contrário. Olhar os **dois eixos separadamente** na ficha para diagnosticar. Não deixar passar mais de 7 dias sem contato ativo.

### Vermelho (0–44)
Risco real. Acionar o playbook de risco (ver [07-playbook-risco-churn.md](07-playbook-risco-churn.md)). Escalar para o líder de CS se o cliente não responder ao primeiro contato.

---

## Leitura dos Dois Eixos

O poder do modelo está em **cruzar os eixos**. Cada combinação pede uma ação diferente:

| Adoção | Resultado | Diagnóstico | Ação |
|--------|-----------|-------------|------|
| Alta | Alto | Cliente ideal | Cultivar, pedir indicação |
| Alta | Baixo | Usa mas não converte | Ajudar na operação comercial / funil |
| Baixa | Alto | Resultado sem plataforma | Mostrar como escalar com a plataforma |
| Baixa | Baixo | Risco crítico | Playbook de churn imediato |

---

## Tendência — a Curva, Não a Foto

Todo dia um snapshot do Resultado de cada cliente é gravado automaticamente. A ficha mostra a **curva de evolução** do Resultado no CRM, não só o número de hoje.

- Um alerta é disparado automaticamente quando o Resultado **cai 8+ pontos** nas últimas semanas.
- É o sinal mais precoce de deterioração — permite agir antes do churn, não depois.

---

## Regras Críticas

**O score é automático, mas o julgamento do CSM continua valendo.** Um cliente pode estar verde e o CSM perceber insatisfação na reunião. Esse sinal qualitativo deve ser registrado e considerado.

**Adoção alta sem resultado é um alerta.** Se o cliente usa muito a plataforma mas o faturamento não cresce, há desconexão entre uso e resultado — o CS precisa investigar a operação comercial.

**Resultado em queda com contexto justificável não é alarme.** Se o faturamento caiu porque o cliente estava de férias/cirurgia, o score cai — mas o CSM tem o contexto. O score é um instrumento, não um veredito.
