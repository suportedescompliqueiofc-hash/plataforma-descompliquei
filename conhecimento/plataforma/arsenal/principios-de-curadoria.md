# Princípios de Curadoria do Arsenal

## Regra 1 — Não duplicar o que a plataforma já faz

Antes de criar qualquer ferramenta, verificar se a plataforma já cobre aquele trabalho de alguma forma:

- Onboarding da plataforma (diagnóstico inicial com o Athos)
- Jornada personalizada
- CRM (leads, conversas, agendamentos, vendas)
- IA de atendimento

Se já existe, a ferramenta do Arsenal é redundante e não deve ser criada.

**Exemplo:** "Diagnóstico Comercial da Clínica" foi removida porque o diagnóstico já é feito no onboarding — o cliente preenche tudo ali antes de falar com o Athos.

---

## Regra 2 — Ferramenta é algo que se constrói, não que se aprende

A distinção entre ferramenta e aula:

| É ferramenta | É aula |
|---|---|
| O cliente sai com algo preenchido/construído | O cliente sai com um conceito entendido |
| Template pré-preenchido para adaptar | Explicação de como algo funciona |
| Ação imediata aplicável à clínica | Conteúdo teórico ou conceitual |

**Exemplo:** "Arquitetura do Funil Comercial" virou conteúdo de aula, não ferramenta — foi removida.

---

## Regra 3 — Categoria certa, ferramenta certa

Cada ferramenta deve ser encaixada na categoria que representa o momento em que o cliente vai usá-la. Uma ferramenta de gestão de time não pertence à fundação comercial.

---

## Regra 4 — Toda ferramenta deve fechar no CRM

**O cliente não pode terminar uma ferramenta sem saber o que fazer no CRM com o resultado.**

Toda ferramenta deve ter uma seção "Próximos Passos no CRM" no final do `template_construa`, mapeando o output da ferramenta para a funcionalidade exata do CRM onde o cliente vai implementar.

**Por quê:** O cliente usa a plataforma para desenvolver processos, e o CRM para executá-los. Se a ferramenta não faz a ponte entre os dois, o cliente termina com um documento que nunca sai do editor. Pior: consulta a equipe para saber o que fazer — exatamente o que queremos evitar.

**Crivo obrigatório:** O cliente deve sair da ferramenta sabendo:
1. O que ele vai fazer no CRM agora
2. Qual funcionalidade específica vai usar (Cadências, Tags, Mensagens Rápidas, Metas, Configurações, Equipe, etc.)
3. Como confirmar que implementou corretamente (qual número vai mudar no Painel, qual etapa vai aparecer)

**Anti-pattern a evitar:** Ferramenta que termina com "agora implemente na sua clínica" — vago demais. O cliente precisa de "agora vá em Cadências, crie uma sequência com esses 5 contatos...".

**Exemplos de mapeamento:**
- Follow-up de leads ativos → Cadências (criar sequência automática com os contatos definidos)
- Reativação de base → Tags (filtrar base) + Cadências (disparar por segmento)
- Quebra de objeções → Mensagens Rápidas (uma pasta por tipo de objeção)
- Metas Comerciais → Módulo Metas (cadastrar e acompanhar no Painel)
- Comissionamento → Painel (vendas por atendente para calcular a variável)

---

## Aplicação

Ao avaliar uma nova ferramenta, responder:

1. A plataforma já faz isso de outra forma?
2. O cliente sai com algo construído ou apenas aprende?
3. Está na categoria certa para o momento do cliente?
4. A ferramenta fecha no CRM — o cliente sabe exatamente o que fazer lá?
