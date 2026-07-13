# Meus Materiais — MateriaisEditor

Biblioteca pessoal do cliente na plataforma. Armazena tudo que foi construído nas ferramentas do Arsenal e permite revisitar, editar e continuar refinando com o Athos.

---

## O Que É

Quando o cliente salva o resultado de uma ferramenta do Arsenal, o conteúdo vai para "Meus Materiais". É a biblioteca pessoal dele — cada material é rastreável à ferramenta que o originou.

O cliente pode:
- Abrir qualquer material salvo e reler
- Editar com o editor rico (mesmo TipTap das ferramentas)
- Consultar o Athos dentro do editor para refinar o conteúdo
- Renomear o material

---

## Arquitetura

### Tabela no banco

`platform_complementary_materials` — campos relevantes:
- `id` — PK
- `folder_id` — FK para pasta (mas materiais do Arsenal ficam em pasta especial, não em pastas do admin)
- `titulo` — nome do material (editável pelo cliente)
- `tipo` — `'html'` para construções do Arsenal
- `conteudo_html` — o HTML do editor TipTap (carregado sob demanda, não na listagem)
- `arsenal_ferramentas(nome)` — join para mostrar origem da ferramenta
- `arsenal_categorias(nome, slug)` — join para mostrar categoria e cor

> **Nota:** os materiais do Arsenal são salvos na mesma tabela que os materiais complementares da Trilha, mas são distinguidos pela origem (via `folder_id` especial ou campo de referência à ferramenta).

### Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/pages/plataforma/MateriaisEditor.tsx` | Página de edição individual — editor + Athos + save |
| `src/hooks/useArsenal.ts` | `salvarConstrucao()` — salva/atualiza o material no banco |
| `src/components/plataforma/AthosPanel.tsx` | Painel Athos embutido no editor |

### Rota

```
/plataforma/materiais/:id    → MateriaisEditor.tsx (editor do material)
```

---

## UI do MateriaisEditor

### Header
- Breadcrumb: Meus Materiais → nome do material
- Título editável inline (clique para renomear)
- Badge da ferramenta de origem (categoria + nome)
- Botão **Athos** (aparece só quando o painel está fechado)
- Botão **Salvar**

### Corpo
Container com `max-w-3xl mx-auto` quando Athos fechado / `pr-[360px]` quando aberto — mesmo padrão do ArsenalFerramenta.

- **Toolbar do editor** (RichToolbar, modo compacto)
- **Editor TipTap** com o HTML do material pré-carregado

### Painel Athos (lateral fixo)
Mesmo componente `AthosPanel` do Arsenal. Usa:
- `ferrSlug`: `material_{doc.id}` — localStorage isolado por material
- `ferramentaNome`: título do material
- `ferramentaDescricao`: "Material associado à ferramenta [nome]" (se houver ferramenta de origem)
- `ferramentaContexto`: `null` (não há `texto_aprenda` — o contexto é o próprio material)
- `categoriaNome`: nome da categoria de origem

O Athos no MateriaisEditor pode:
- Injetar HTML via `<TEMPLATE_UPDATE>` (mesmo protocolo do Arsenal)
- Responder perguntas sobre o conteúdo do material
- Sugerir melhorias, adaptar scripts, aprofundar seções

---

## Diferença: Athos no Arsenal vs. Athos no MateriaisEditor

| | Arsenal (ferramenta) | Meus Materiais (editor) |
|--|---------------------|------------------------|
| `ferramentaContexto` | `texto_aprenda` da ferramenta | `null` |
| Base de contexto | Nota de praticante + editor atual | Só editor atual |
| Histórico localStorage | `athos_chat_{ferrSlug}` | `athos_chat_material_{id}` |
| Propósito | Ajudar a construir o template | Ajudar a refinar o que já foi construído |

---

## Lazy Load do Conteúdo HTML

O `conteudo_html` **nunca** é selecionado na query de listagem de materiais. É buscado com `.select("conteudo_html").eq("id", id).single()` apenas quando o cliente abre o editor.

Razão: conteúdo HTML pode ser grande (template completo preenchido). Carregar na listagem seria wasteful.

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-06-27 | Criação — documento inicial completo |
