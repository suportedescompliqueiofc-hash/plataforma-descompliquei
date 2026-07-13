# Ferramenta: Arquitetura de Processos Comerciais

**Categoria:** Fundação Comercial  
**Slug:** `arquitetura-processos-comerciais`  
**Status:** Construída — aguarda refinamento com João

---

## Decisão de formato

Esta ferramenta **não segue o padrão de template para preencher**. É uma ferramenta de metodologia — o cliente precisa internalizar o framework EVA e replicá-lo em cada processo da clínica.

Formato adotado:
- **Nota de praticante** (~400 palavras) — aprofunda os três pilares EVA com exemplos práticos
- **Exemplo aplicado** — Primeiro Contato no WhatsApp estruturado com E, V e A
- **Template replicável** — seção em branco para o cliente aplicar nos demais processos
- **Mapa visual** — diagrama Excalidraw do ciclo EVA embutido na página (via `video_url`)
- **Athos** — guia o cliente a detalhar cada processo específico da clínica

> O objetivo não é sair com um processo preenchido. É sair sabendo aplicar EVA em qualquer processo.

---

## Contexto Estratégico — Nota de Praticante (texto_aprenda)

> HTML rico armazenado no banco. Segue o modelo "nota de praticante" — voz direta, com opinião.

**A maioria das clínicas não tem processos comerciais. Tem hábitos.**

Cada atendente faz do seu jeito, no horário que acha certo, com a abordagem que aprendeu sozinho. Quando funciona, ninguém sabe por quê. Quando não funciona, ninguém sabe onde quebrou. E quando o atendente sai, o processo some junto.

A Metodologia EVA resolve isso com três movimentos — Estruturar, Validar, Ajustar — aplicados a cada processo comercial da clínica.

**E — Estruturar significa parar de improvisar.** Para cada processo: quem executa, qual o gatilho para começar, o passo a passo do que fazer, o que falar em cada momento e qual o critério para levar o lead ao próximo passo. O script não é para decorar — é para não esquecer o que funciona nos momentos de pressão.

**V — Validar é onde a maioria para — e não deveria.** O CRM é a ponte: mostra onde os leads travam, qual etapa perde mais pessoas, quanto tempo um lead fica parado antes de sumir. Processo validado não é processo escrito. É processo que os dados confirmam que funciona.

**A — Ajustar é o que separa as clínicas que evoluem das que repetem os mesmos erros.** Dois tipos: incremental (ajuste pontual) e estrutural (reescreve do zero). Regra que nunca muda: baseado em dado, nunca em sensação. Todo ajuste gera nova versão → volta para validação.

---

## Estrutura do Template (template_construa)

### 1. Mapa de Processos
Lista dos 8 processos que toda clínica precisa estruturar (pré-preenchida).

### 2. Exemplo Aplicado: Primeiro Contato no WhatsApp
Processo completo com E, V e A detalhados:

**E:**
- Responsável: Recepcionista
- Gatilho: Lead entra em contato pelo WhatsApp
- Tempo máximo de resposta: 5 minutos
- Passo a passo: saudar → identificar interesse → apresentar clínica → qualificar → próximo passo
- Script orientado (abertura, identificação, convite)
- Critério de avanço: demonstrou interesse → Qualificação

**V:**
- Métricas: taxa de resposta em até 5 min, conversão para Qualificação, tempo médio
- Sinal de funcionando: conversão > 60%
- Sinal de problema: leads parando, respostas > 1h
- Frequência: semanal

**A:**
- Incrementais: script formal → linguagem próxima; resposta baixa → alerta no celular
- Critério estrutural: conversão < 40% por 4 semanas → reescrever
- Versão atual: [data] — [o que mudou]

### 3. Template Replicável
Seção em branco com a mesma estrutura E/V/A para o cliente aplicar nos demais processos.

---

## Mapa Visual

**URL Excalidraw:** `https://excalidraw.com/#json=sgBI6vaqQljbmBNltUpAn,9LpIp7jtyD2jUxMavDYSBg`  
**Armazenado em:** `arsenal_ferramentas.video_url` (campo reutilizado — vídeos foram descartados)  
**Embed:** iframe na página entre Contexto e Template, com botão "Tela cheia"

Diagrama mostra o ciclo EVA completo: três pilares (E azul, V verde, A roxo), setas horizontais entre eles, CRM badge no pilar V, e seta tracejada de retorno na base ("nova versão do processo").

---

## Histórico de refinamentos

| Data | Alteração | Por |
|------|-----------|-----|
| 2026-06-26 | Criação completa — nota, template com exemplo e mapa Excalidraw | Claude |
