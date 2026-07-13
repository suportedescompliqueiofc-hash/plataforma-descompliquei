# Experiência da Ferramenta — Decisões de Design

## Decisão Final: Página Única

A ferramenta é uma **página única** sem abas de navegação. O cliente abre e flui direto para a construção, sem fricção de navegação.

---

## Estrutura da Página (de cima para baixo)

### 1. Header da Ferramenta
- Nome da ferramenta
- Categoria
- Status (não iniciado / em andamento / concluído)

### 2. Contexto Estratégico — Nota de Praticante
Não é uma aula. Não é um resumo de tópicos. É uma **nota de praticante**: 200 a 300 palavras escritas com opinião, diretas, específicas para clínicas.

O cliente lê em 2 minutos e entende:
- **O princípio real** por trás da ferramenta (não a definição acadêmica)
- **Por que a maioria das clínicas erra** nesse ponto
- **O que muda** quando essa peça está bem resolvida

> Vídeo foi descartado como formato core. Não escala — depende de gravação, atualização e o cliente assistir até o fim. Texto bem escrito + Athos resolve com mais profundidade e custo zero de manutenção.

**Padrão de escrita:**
- Voz direta, com opinião — como se sentasse do lado e explicasse
- Sem listas genéricas, sem introduções longas
- Específico para o mercado de clínicas de saúde e estética
- Termina deixando o cliente com vontade de construir, não de aprender mais

### 3. Mapa Visual (opcional por ferramenta)

Diagrama Excalidraw read-only renderizado entre o Contexto Estratégico e o Template. Aparece **apenas quando a ferramenta tem `diagrama_json` configurado** no banco.

**Propósito:** dar uma visão espacial do conceito antes de o cliente entrar no template — especialmente útil para ferramentas com estrutura de processo (fluxos, etapas, relações entre elementos).

**Comportamento:**
- Height responsivo: `clamp(280px, 42vh, 520px)` — adapta a tela do cliente sem desperdiçar espaço
- Barra inferior do Excalidraw ocultada via CSS (apenas o canvas é exibido)
- Botão **"Tela cheia"** no header do card abre um Dialog fullscreen para exploração detalhada
- Ctrl+scroll para zoom, arraste para navegar (instrução exibida no header)

**Gestão pelo admin:**
- Editável diretamente no `FerramentaDetailDialog` do Admin OS — seção "Mapa Visual" com Excalidraw em modo edição
- Botão "Expandir" no editor (420px → 700px) para maior área de trabalho
- Botão de tela cheia no card inteiro para máxima área de edição
- "Remover diagrama ao salvar" remove o JSON da ferramenta

**Quando usar:**
- Processos com etapas sequenciais (ex: Metodologia EVA — E → V → A)
- Frameworks com dimensões ou quadrantes
- Fluxos de atendimento ou qualificação
- **Não usar** para ferramentas simples de preenchimento sem relações visuais

### 4. Template de Construção
Editor rico já pré-preenchido com:
- Seções estruturadas
- Campos com instruções inline
- Exemplos práticos que o cliente adapta

> O cliente **adapta**, não cria do zero. Tudo praticamente pronto.

### 5. Athos — Copiloto do Arsenal (painel lateral fixo)

Painel lateral fixo à direita da página, aberto por padrão. O cliente não precisa abrir — já está lá esperando.

**Posicionamento:** `position: fixed`, `right: 24px`, `top: 72px`, `bottom: 24px`. O conteúdo principal recebe `pr-[360px]` para não ficar sob o painel.

**Comportamento:**
- Chat inicia com mensagem de boas-vindas contextualizada à ferramenta
- Conversas persistem no `localStorage` com chave `athos_chat_{ferrSlug}` — o cliente sai e volta e a conversa continua
- Botão lixeira no header limpa o histórico
- Botão fechar recolhe o painel; reabre via ícone no header da ferramenta

**Injeção automática no editor (sem botão):**
Quando o cliente pede uma alteração no template, o Athos injeta diretamente no editor via protocolo `<TEMPLATE_UPDATE>`. O cliente nunca vê o HTML — só vê o resultado e uma frase curta de confirmação.

Ver detalhes técnicos em: [`athos-copiloto-arsenal.md`](athos-copiloto-arsenal.md)

### 6. Rodapé com ações
- **Reiniciar template** (esquerda) — restaura o `template_construa` original do banco
- **Salvar** (direita) — salva em "Meus Materiais"

---

## O Que Foi Removido

| Elemento | Motivo |
|----------|--------|
| Vídeos | Alta fricção de tempo, cliente não assiste |
| Abas (Aprenda / Construa / Materiais) | Fricção de navegação desnecessária |
| Editor em branco com placeholder | Baixa orientação — cliente não sabe o que fazer |
| Texto de conceito longo | Distância entre aprender e aplicar |

---

## Princípio Guia

> O cliente não deve sair de uma ferramenta com conhecimento — deve sair com algo **construído**.

O conceito existe apenas para dar contexto mínimo. O valor está no template preenchido.

---

## Materiais de Apoio

PDFs e HTMLs complementares permanecem disponíveis, mas como recursos secundários — não como parte central da experiência. Podem aparecer como links discretos no rodapé da ferramenta.
