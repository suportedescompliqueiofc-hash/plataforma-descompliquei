# Fase 3 — Materiais via Athos (fim dos templates)

> Objetivo: acabar com a criação por template. O **Athos Construtor** (agente do Athos GS) cria
> QUALQUER material/ferramenta comercial junto com o cliente, conhecendo os dados do CRM dele, e
> salva numa área unificada de saídas. **Fase destrutiva — executar por último.**

## Progresso — B (aditivo, 2026-07-05) — CONCLUÍDO sem edge deploy

**Descoberta que simplificou tudo:** o copiloto `descompliquei-os` **já tem** as tools
`criar_material` / `listar_meus_materiais` / `atualizar_material` / `excluir_material`, que gravam
na tabela **`meus_materiais`** (user-scoped, `user_id = auth.uid()`). Ou seja, **o Athos já cria
materiais** — só faltava a experiência premium unificada por cima.

**Feito (risco zero, nenhuma edge function tocada):**
- **Página `AthosMateriais.tsx`** em **`/crm/materiais`** — lista premium, ver/editar em dialog com
  **lazy-load** do `conteudo`, criar/excluir manual, CTA "Criar com o Athos". Entrada pelo botão
  "Materiais" no Console Athos.
- **Hook `useAthosMateriais`** lê/escreve **`meus_materiais`** (a MESMA tabela do copiloto) →
  materiais criados pelo Athos aparecem automaticamente na área nova. Exclui o doc
  `categoria = 'diagnostico'` (doc de sistema).
- `tsc` + lint limpos. Sem `athos_materiais` (tabela nova foi descartada — reuso de `meus_materiais`
  é mais simples e conecta direto ao que o Athos já faz).

**Efeito:** o fluxo "Athos constrói o material na conversa → aparece na área premium" já funciona
ponta-a-ponta, sem deploy. O antigo `Materiais.tsx` (template) continua intacto até a fase destrutiva.

**Refino futuro (opcional, com QA):**
- Enriquecer o system prompt do construtor com `conhecimento/plataforma/arsenal/**` + dados do CRM.
- Marcar procedência (Athos vs manual) de forma confiável (hoje o badge foi removido por não ser
  garantível sem tocar no copiloto).

> A remoção abaixo (telas/tabelas de template) permanece na **fase destrutiva**, só após aprovação
> explícita. Nota: `meus_materiais` tem FKs para o Arsenal (`categoria_arsenal_id`, `ferramenta_id`)
> — tratar essas colunas (SET NULL) ao remover as tabelas do Arsenal.

## ⚠️ Mapeamento da fase destrutiva (2026-07-06) — BLOQUEADOR

Dropar `arsenal_ferramentas`/`arsenal_categorias` NÃO é seguro agora por dois motivos:

**1. Teia de FKs (8 tabelas):** referenciam arsenal_ferramentas/categorias:
`arsenal_progresso`, `arsenal_construcoes`, `arsenal_materiais`, `arsenal_templates`,
`meus_materiais` (`categoria_arsenal_id`, `ferramenta_id`), `jornada_passos`
(`ferramenta_id`, `categoria_id`), além da auto-FK `arsenal_ferramentas.categoria_id`.
Dropar exige tratar todas (drop em cascata das tabelas de arsenal + SET NULL em `meus_materiais`
e `jornada_passos`).

**2. Copiloto depende das tabelas:** `descompliquei-os` (4028 linhas) tem tools `listar_arsenal`,
`obter_arsenal_ferramenta`, `salvar_construcao_ferramenta` e a resolução de slugs em `criar_jornada`
que consultam `arsenal_ferramentas`. Dropar a tabela quebra essas tools — e o arquivo é grande
demais para redeploy inline seguro (mesmo problema do `whatsapp-ai-agent`).

**Conclusão — split seguro:**
- **Parte A (segura, agora):** remover a UI de templates + Ferramentas do Arsenal (invisível/inacessível
  ao cliente); repontar "Meus Materiais" para `/crm/materiais` (área nova do Athos). Manter Arsenal Aulas.
  Tabelas permanecem no banco (copiloto segue funcionando).
- **Parte B (coordenada, depois):** via CLI na máquina do João — redeploy do `descompliquei-os` sem as
  tools de arsenal → então migration destrutiva (backup/export → SET NULL nas FKs → drop das tabelas
  arsenal → drop `seed-templates`). Só após backup.

### Parte A — EXECUTADA (2026-07-06, `tsc` limpo)

- **Templates ("Meus Materiais" antigo):** deletados `Materiais.tsx` + `MateriaisEditor.tsx`; rotas
  `/plataforma/materiais*` removidas (redirect → `/crm/materiais`); sidebar "Meus Materiais" repontado
  para `/crm/materiais` (área nova do Athos, sobre `meus_materiais`).
- **Ferramentas do Arsenal:** deletados `ArsenalCategoria.tsx`, `ArsenalFerramenta.tsx`,
  `AdminArsenal.tsx`; rotas `/plataforma/arsenal/:slug(/:ferrSlug)` e `/admin/arsenal` removidas.
  `Arsenal.tsx` agora mostra **só Aulas** (aba Ferramentas + `useArsenalHub` removidos).
- **Jornada:** `handleOpen`/`hasLink` ajustados — passos de ferramenta/categoria não abrem mais
  (rotas removidas); passos de **aula** continuam abríveis.
- **Preservado:** Arsenal **Aulas** (páginas/hooks/admin), `useAdminArsenal` (usado por
  `AdminJornadaEditor`), e **todas as tabelas** (copiloto `descompliquei-os` segue funcionando).
- Dead code residual (consts `ICON_MAP`/`CATEGORY_THEMES` em `Arsenal.tsx`) — não-quebra, lint do
  projeto não sinaliza; limpeza fina opcional.

## O que sai (remoção)

| Item | Arquivos / DB |
|------|---------------|
| "Meus Materiais" (editor template) | `src/pages/plataforma/Materiais.tsx`, `MateriaisEditor.tsx`; rota `/plataforma/materiais*`; item de menu; `accessKey: acesso_materiais`. |
| Ferramentas do Arsenal | `ArsenalFerramenta.tsx`, `ArsenalCategoria.tsx` (parte de ferramentas), `useArsenal.ts`/`useAdminArsenal.ts` (ferramentas), `AdminArsenal.tsx`; tabelas `arsenal_ferramentas`, `arsenal_categorias`; `conteudo_json`. |
| Seeds de template | edge function `seed-templates`; `platform_complementary_*` **NÃO** (isso é Trilha, permanece). |

> **Preservar**: Arsenal **Aulas** (`arsenal_blocos`, `arsenal_aulas`, `arsenal_aulas_progresso`,
> `ArsenalAula.tsx`) — é conteúdo de vídeo/aprendizado, não template. A página `Arsenal.tsx`
> passa a mostrar só **Aulas** (remove a aba/seção de Ferramentas).

## O que entra (novo)

### Athos Construtor (agente)

- Nova capability no `descompliquei-os` (ou edge dedicada `athos-construtor`): tool
  `gerar_material` que, dado um objetivo comercial + contexto do CRM do cliente, produz o
  material completo (texto/estrutura), com refino conversacional.
- **Conhecimento comercial**: o system prompt do construtor carrega a base de
  `conhecimento/plataforma/arsenal/**` (metodologia EVA, quebra de objeções, arquitetura de
  oferta, etc.) como referência — Claude constrói, cliente refina (ver memória
  `feedback_modelo_construcao_conhecimento`).
- **Consciência do CRM**: injeta dados reais do cliente (procedimentos, ICP/cérebro, métricas,
  leads) para materiais aderentes — reutiliza o tool-filtering do Athos GS.
- **Nunca** referenciar "Mensagens Rápidas" nos materiais (memória
  `feedback_arsenal_mensagens_rapidas`).

### Área unificada de saídas

```
athos_materiais (
  id, organization_id, user_id, titulo, tipo, conteudo (jsonb/markdown/html),
  origem_conversation_id, status ('rascunho'|'final'), criado_em, atualizado_em
)
```

- Nova tela **"Materiais"** (ou dentro do console Athos): lista os materiais gerados, abre/edita,
  exporta. Substitui o "Meus Materiais" antigo, mas o conteúdo agora nasce do Athos, não de um
  template em branco.

## Ordem interna da Fase 3

1. Construir o **Athos Construtor** + `athos_materiais` + tela de saídas (aditivo, sem remover nada).
2. Migrar/portar qualquer material útil existente (se houver) para a nova área.
3. Só então **remover** telas/tabelas de template e Ferramentas do Arsenal.
4. Atualizar Jornada: passos `tipo = 'ferramenta_arsenal'`/`categoria_arsenal` deixam de existir —
   migrar para `acao_livre` ou vincular a aula/Athos. **Cuidado**: `jornada_passos.ferramenta_id`
   e `categoria_id` (FKs para `arsenal_ferramentas`/`arsenal_categorias`). Precisa de migration
   que limpe FKs antes de dropar tabelas, e ajuste do editor de jornada (`AdminJornadaEditor`,
   `useSaveJornadaEstrutura`, tool `criar_jornada` no `descompliquei-os`).

## Riscos específicos

- **FKs da Jornada** para Arsenal-ferramentas — não dá pra dropar as tabelas sem tratar
  `jornada_passos`. Ver `05-riscos-ordem-execucao.md`.
- **Perda de conteúdo** — se algum cliente já criou materiais úteis via template, exportar antes.
- **Athos precisa entregar qualidade** antes de remover o caminho antigo (senão o cliente fica
  sem ferramenta nenhuma). Por isso a remoção é o passo 3, não o 1.

## Critério de pronto (Fase 3)

- [ ] Athos Construtor gera material real usando dados do CRM + base de conhecimento comercial.
- [ ] Materiais gerados salvos e listados em `athos_materiais`.
- [ ] Telas/tabelas de template e Ferramentas do Arsenal removidas sem quebrar Jornada.
- [ ] Arsenal mostra só Aulas.
- [ ] Build/lint limpos; edge functions deployadas via MCP.
