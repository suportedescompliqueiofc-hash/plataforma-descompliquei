# Athos Copiloto do Arsenal

Copiloto consultivo embutido em cada página de ferramenta do Arsenal. Permite ao cliente construir o template com ajuda da IA sem sair da página.

---

## Decisão de Design

**Por que lateral fixo, não modal ou aba:**
- O cliente precisa ver o editor e o Athos ao mesmo tempo
- Modal bloquearia o template; aba quebraria o fluxo
- `position: fixed` garante que o painel acompanha o scroll sem depender do contexto de overflow do pai

**Por que injeção automática, não botão "Aplicar":**
- Botão criava fricção desnecessária — o cliente sempre quer aplicar
- Injeção direta é mais fluida e condizente com a proposta de "construção assistida"
- O cliente fica no controle via "Reiniciar template" se não gostar do resultado

---

## Arquitetura Técnica

### Arquivos principais

**Componente compartilhado:**
`src/components/plataforma/AthosPanel.tsx`

Exporta:
- `AthosPanel` — o painel de chat em si (usado em ArsenalFerramenta e MateriaisEditor)
- `AthosBubble` — renderização de cada mensagem do Athos (com markdown)
- `MarkdownContent` — parser de blocos markdown para exibição no chat
- `getDisplayContent()` — filtra `<TEMPLATE_UPDATE>` do texto exibido
- `looksLikeTemplate()` — detecta HTML de template durante streaming
- `ChatMessage`, `AthosPanelProps` — tipos exportados

**Páginas que usam o painel:**
- `src/pages/plataforma/ArsenalFerramenta.tsx` — ferramenta do Arsenal (contexto: texto_aprenda + editor atual)
- `src/pages/plataforma/MateriaisEditor.tsx` — editor de Meus Materiais (contexto: título do material + ferramenta associada + editor atual)

### Agente no banco
Tabela `athos_agentes`, slug: `arsenal-copiloto`

O system prompt é carregado dinamicamente na abertura de cada ferramenta. Não é hardcoded no frontend.

### Edge function utilizada
`descompliquei-os` — reutilizada do DescompliqueiOS, com três parâmetros especiais:
- `system_prompt_override` — substitui o prompt padrão pelo do arsenal-copiloto
- `ferramenta_context` — injeta contexto da ferramenta + conteúdo atual do editor
- `tools_override: []` — desativa todas as tools (Athos do Arsenal é puramente conversacional)

O placeholder `[INSERIDO AUTOMATICAMENTE PELO SISTEMA]` no system_prompt é substituído pelo `ferramenta_context` (não pelo diagnóstico do usuário, que é o comportamento padrão).

### Modelo
`openai/gpt-5.4-nano` — default da edge function. Rápido e barato; suficiente para uso consultivo sem tools.

---

## Protocolo de Atualização do Editor: `<TEMPLATE_UPDATE>`

### Como funciona
1. Cliente pede uma alteração ("coloque faixa etária de 15 a 25 anos")
2. Athos gera a tag `<TEMPLATE_UPDATE>` PRIMEIRO, antes da frase de confirmação
3. Frontend detecta a tag, injeta o HTML no editor via `editor.commands.setContent()`
4. Frase de confirmação aparece no chat; HTML nunca é exibido

### Formato obrigatório do output do Athos
```
<TEMPLATE_UPDATE>
[HTML completo do template com a alteração aplicada]
</TEMPLATE_UPDATE>
Feito — [campo] atualizado para [valor].
```

### Por que a tag vem PRIMEIRO
Se a tag vier depois do texto, o modelo escreve o template como parte da resposta conversacional e ele aparece no chat durante o streaming. Com a tag PRIMEIRO:
- Durante streaming: `looksLikeTemplate()` detecta HTML → mostra "Atualizando editor..." em vez do HTML bruto
- Após `</TEMPLATE_UPDATE>`: só a frase de confirmação aparece no chat

### Filtros do frontend
```typescript
// Detecta HTML de template durante streaming
function looksLikeTemplate(content: string): boolean {
  return /<(h[1-6]|ul|ol|li|strong|p)\b/i.test(content) || /<TEMPLATE_UPDATE>/i.test(content);
}

// Remove a tag do texto exibido (e o que vem antes se for HTML)
function getDisplayContent(content: string): string {
  // Bloco completo: remove a tag, mostra o que resta (confirmação)
  const withoutBlock = content.replace(/<TEMPLATE_UPDATE>[\s\S]*?<\/TEMPLATE_UPDATE>/gi, '').trim();
  if (withoutBlock !== content) return withoutBlock;

  // Tag aberta mas não fechada (streaming): oculta tudo a partir dela
  const openIdx = content.search(/<TEMPLATE_UPDATE>/i);
  if (openIdx !== -1) return content.slice(0, openIdx).trim();

  return content;
}
```

### Regra crítica: copiar o HTML do editor, não reescrever
O `ferramenta_context` envia o HTML atual do editor (`editor.getHTML()`). O system prompt instrui explicitamente:
> "Copie o conteúdo atual do editor EXATAMENTE como está. Modifique APENAS o campo solicitado."

Sem isso, o modelo reescrevia o template completo do zero a cada alteração pontual.

---

## Persistência do Chat

- Chave: `athos_chat_{ferrSlug}` no `localStorage`
- Salva ao final de cada resposta (não durante streaming)
- Botão lixeira no header do painel limpa o histórico e volta à mensagem de boas-vindas
- Cada ferramenta tem seu próprio histórico isolado

---

## Streaming

Segue o mesmo padrão do DescompliqueiOS:
- Buffer de linhas incompletas (evita parsear JSON partido no meio do chunk)
- Flush a cada 80ms (não re-renderiza a cada caractere)
- Atualiza mensagem por ID (não por índice `[last]`, que causava duplicatas)
- `messagesRef` para capturar histórico sem stale closure

Formato dos eventos SSE da edge function:
```
{ type: "text_start" }
{ type: "text_delta", delta: "..." }  ← campo é 'delta', não 'content'
{ type: "done", ... }
```

---

## Contexto enviado ao Athos

```
FERRAMENTA: [nome]
CATEGORIA: [nome da categoria]
DESCRIÇÃO: [descrição da ferramenta]

CONTEXTO ESTRATÉGICO:
[texto_aprenda da ferramenta]

O QUE O CLIENTE JÁ ESCREVEU NO EDITOR (HTML — copie exatamente e altere só o campo pedido):
[editor.getHTML()]
```

---

## Histórico de decisões e iterações

| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-06-25 | Painel lateral fixo, aberto por padrão | Visibilidade imediata sem fricção |
| 2026-06-25 | Reutilizar edge function `descompliquei-os` | Evita duplicar infra de streaming + tools |
| 2026-06-25 | `position: fixed` em vez de `sticky` | Pai tem overflow que quebra sticky |
| 2026-06-25 | Remover botão "Aplicar no editor", injeção automática | Fricção desnecessária |
| 2026-06-25 | Protocolo `<TEMPLATE_UPDATE>` com tag primeiro | Evitar que HTML apareça no chat durante streaming |
| 2026-06-25 | Enviar `getHTML()` em vez de `getText()` | Modelo precisa do HTML exato para copiar e só alterar o campo pedido |
| 2026-06-25 | `looksLikeTemplate()` durante streaming | Oculta HTML antes de `<TEMPLATE_UPDATE>` chegar |
