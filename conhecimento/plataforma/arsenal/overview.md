# Arsenal Comercial — Overview

## O Que É

O Arsenal é a caixa de ferramentas comerciais da plataforma. Organizado por área da operação comercial de uma clínica, reúne tudo que o cliente precisa para estruturar e escalar o comercial — sem precisar de um consultor presente.

---

## Filosofia das Ferramentas

### Antes: Aulas Gravadas ❌
- Alta fricção de tempo (cliente precisa parar para assistir)
- Aprendizado passivo — difícil de aplicar
- Distância entre "aprender" e "fazer"
- Cliente procrastina, não executa, não tem resultado

### Agora: Ferramentas Aplicáveis ✅
- Zero fricção — cliente abre e aplica
- Tudo praticamente pronto, só adapta para a clínica
- Resultado imediato — sai com algo construído
- Metodologia embutida no próprio template

> **Princípio:** o cliente não deve sair de uma ferramenta com conhecimento — deve sair com algo **construído**.

---

## Estrutura de Uma Ferramenta

Cada ferramenta é composta por:

| Elemento | Campo no banco | Descrição |
|----------|---------------|-----------|
| **Nota de Praticante** | `texto_aprenda` | Contexto estratégico em voz direta — por que isso importa, o que mudar. ~200-400 palavras. Renderizado como prose na página. |
| **Template / Guia** | `template_construa` | O documento principal pré-estruturado. Cliente preenche e adapta diretamente no editor TipTap. |
| **Templates alternativos** | `arsenal_templates` | Variações de template para perfis diferentes (ex: solo vs. com equipe). Aparecem como pills acima do editor. |
| **Mapa Visual** | `diagrama_json` | Diagrama Excalidraw embutido na página (opcional — apenas quando o visual agrega). |
| **Materiais de apoio** | `arsenal_materiais` | PDFs ou HTML externos (opcional). |

> **Sem aulas. Sem vídeos longos. Sem teoria pesada.** Contexto mínimo, aplicação máxima.

---

## Papel do Athos nas Ferramentas

O Athos complementa as ferramentas como copiloto. Se o cliente travar em qualquer ponto:
- Explica o contexto da ferramenta na linguagem da clínica dele
- Adapta o template para a realidade específica
- Injeta conteúdo diretamente no editor via protocolo `<TEMPLATE_UPDATE>`
- Sugere próximos passos dentro da jornada

A ferramenta entrega o "o quê". O Athos resolve o "como no meu caso".

Agente no banco: `athos_agentes.slug = 'arsenal-copiloto'`
Ver: `conhecimento/plataforma/arsenal/athos-copiloto-arsenal.md`

---

## Experiência do Cliente na Página

1. **Hero** — banner com gradiente por categoria, nome e descrição da ferramenta, status (não iniciado / em andamento / concluído)
2. **Nota de Praticante** — bloco de contexto estratégico com prose styling
3. **Mapa Visual** — Excalidraw embed (quando houver)
4. **Editor de Construção** — TipTap com toolbar, template pre-carregado, pills de templates alternativos
5. **Athos** — painel lateral fixo (right: 24px, top: 72px, bottom: 24px)

Ver detalhes: `conhecimento/plataforma/arsenal/experiencia-da-ferramenta.md`

---

## Status de Construção (atualizado em 2026-06-27)

| Categoria | Ferramentas | Completas |
|-----------|-------------|-----------|
| Fundação Comercial | 2 | ✅ 2/2 |
| Oferta, Precificação e Posicionamento | 2 | ✅ 2/2 |
| Atendimento e Conversão | 2 | ✅ 2/2 |
| Follow-up e Reativação | 2 | ✅ 2/2 |
| Canais de Aquisição | 1 | ✅ 1/1 |
| Equipe Comercial | 6 | ✅ 6/6 |
| Metas e Gestão Comercial | 3 | ✅ 3/3 |
| **Total** | **18** | **✅ 18/18** |
