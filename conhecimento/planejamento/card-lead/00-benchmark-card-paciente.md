# Benchmark — Card do Paciente/Lead (harmonização & estética)

> Estudo de referência para decidir **o que faz sentido mostrar no card do lead** (aba Resumo especialmente) do nosso CRM. Data: 2026-07-09.

## Objetivo

Entender o que os melhores softwares de clínica estética/harmonização colocam no "card do paciente" e mapear o que é **relevante e viável** para o nosso CRM — sem inflar com informação que não temos ou que não combina com o nosso posicionamento.

## Players analisados

| Software | Origem | Foco |
|---|---|---|
| **Aesthetic Record** | EUA | EMR + gestão para med spas (líder de mercado) |
| **Pabau** | UK | Practice management + EMR para clínicas/estética |
| **Belle Software** | BR | Gestão para clínicas de estética (CRM+anamnese+IA) |
| **iClinic** | BR | Prontuário eletrônico médico |
| **TuttoHOF / SHOF** | BR | Especializados em Harmonização Orofacial |

## O que os melhores mostram no card do paciente

Consolidando os 5, o card "completo" tem **duas metades** bem distintas:

### A) Camada CLÍNICA (prontuário/EMR)
1. **Anamnese** — queixa principal, condições pré-existentes, **alergias**, **medicamentos/suplementos em uso**, cirurgias, contraindicações. (Documento exigido pela ANVISA — tem peso legal.)
2. **Fotos antes/depois** — galeria em alta resolução, com bloqueio/blur para fotos sensíveis/VIP.
3. **Mapa de aplicação (injection plotting)** — pontos de aplicação e dosagem anotados sobre a foto/diagrama facial.
4. **Histórico de tratamentos** — procedimentos realizados, com **lote e validade do produto** registrados (medicolegal).
5. **Consentimento/Termos** — status de consentimento assinado, conectado ao procedimento.
6. **Sticky notes / alertas** — avisos fixos no topo do card (preferências, saldo, alergia crítica).

### B) Camada COMERCIAL/RELACIONAL (CRM)
7. **Contato + origem** — telefone, e-mail, canal de aquisição.
8. **Timeline de comunicação** — todas as interações (mensagens, e-mails, lembretes) num só lugar.
9. **Agendamentos** — próximos e passados, com status.
10. **Financeiro** — pagamentos, **pacotes/planos**, saldo devedor, ticket.
11. **Recall / follow-up** — data do próximo retorno sugerido (ex.: reaplicação de botox em 12 semanas).
12. **Fidelidade / indicações**.

## Guardrail: o que NÓS somos

Nosso produto é um **CRM comercial de WhatsApp** (funil lead → agendamento → fechamento), white-label para várias clínicas — **não é um prontuário eletrônico**. A camada CLÍNICA (A) é território de EMR: regulada (ANVISA/CFM), com peso legal, e é um produto inteiro à parte. Já removemos "dados clínicos/LGPD" antes justamente porque não os temos.

**Conclusão de posicionamento:** o card do lead deve brilhar na camada **COMERCIAL (B)** — que é onde geramos valor e onde já temos dados. Da camada clínica, no máximo entra um **resumo leve e não-regulado** (ex.: procedimento de interesse, objetivo estético), nunca um prontuário completo.

## Recomendações para o Resumo — em 3 níveis

### Nível 1 — Já temos, só não estamos mostrando (ganho rápido, zero schema)
- **Procedimento de interesse** (`leads.procedimento_interesse`) — existe no banco e **não aparece no card**. Para harmonização é a informação nº 1 ("o que a paciente quer fazer"). **Maior ganho imediato.**
- **Objetivo/queixa** — o **Resumo IA** já captura isso narrativamente ("nariz incomoda… resultado desejado: afinar…"). Dá para destacar melhor.
- **Valor de interesse / ticket potencial** — derivável de agendamentos/vendas.

### Nível 2 — Adições leves (pouco esforço, campo/UI simples)
- **Próximo passo / recall** — "sugerir retorno em X semanas" ou destacar o próximo agendamento no topo do Resumo.
- **Sticky note / alerta fixo** — 1 campo de texto de destaque no topo (ex.: "Prefere tarde", "Já é paciente"). Genérico e útil para toda clínica.
- **Resumo comercial estruturado** — em vez de só o texto da IA, extrair 3 chips: *o que quer · objeção · próximo passo*.

### Nível 3 — Projetos maiores (precisam de schema/decisão de produto)
- **Galeria antes/depois** — storage + UI + privacidade. Alto valor percebido, mas é um módulo.
- **Anamnese leve** (alergias/condições) — **cuidado**: entra em terreno de prontuário/regulação. Só com decisão explícita.
- **Pacotes/planos + saldo** — se formos pro território de gestão financeira recorrente.

## Tabela de decisão

| Informação | Temos o dado? | Esforço | Valor p/ harmonização |
|---|---|---|---|
| Procedimento de interesse | ✅ (não exibido) | Baixo | **Alto** |
| Objetivo/queixa (destaque) | ✅ (Resumo IA) | Baixo | Alto |
| Próximo passo / recall | Parcial (agendamentos) | Baixo/Médio | Alto |
| Alerta fixo (sticky note) | ❌ (1 campo novo) | Baixo | Médio |
| Ticket potencial | Derivável | Médio | Médio |
| Fotos antes/depois | ❌ | Alto | Alto (é módulo) |
| Anamnese clínica | ❌ | Alto + regulação | Médio (fora do posicionamento) |
| Pacotes/saldo | ❌ | Alto | Médio |

## Recomendação

Fazer **Nível 1 agora** (principalmente exibir **Procedimento de interesse** e dar destaque ao objetivo/queixa) — é o que mais aproxima o card da realidade da harmonização com esforço mínimo e sem sair do nosso posicionamento comercial. Avaliar Nível 2 em seguida. Nível 3 só como projeto dedicado, com decisão de produto (especialmente qualquer coisa clínica/regulada).

## Fontes
- [Aesthetic Record — Clinical Documentation](https://www.aestheticrecord.com/clinical-documentation/)
- [Aesthetic Record — Complete EMR](https://www.aestheticrecord.com/complete-emr/)
- [Pabau — Med spa software](https://pabau.com/industry/medical-spa-software/)
- [Pabau — Clinical documentation software 2026](https://pabau.com/blog/clinical-documentation-software/)
- [Belle Software — Harmonização facial](https://www.bellesoftware.com.br/software-de-harmonizacao-facial-para-clinicas-de-estetica/)
- [iClinic — Prontuário eletrônico](https://iclinic.com.br/prontuario-eletronico/)
- [TuttoHOF — Gestão para Harmonização Orofacial](https://tuttohof.com.br/)
- [Clínica nas Nuvens — Ficha de anamnese p/ harmonização](https://clinicanasnuvens.com.br/blog/ficha-de-anamnese-harmonizacao/)
