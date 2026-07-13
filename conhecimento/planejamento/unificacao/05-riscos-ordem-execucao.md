# Riscos, Dependências e Ordem de Execução

## Ordem macro

```
FASE 1 (agora)  Navegação unificada        → sem DB, reversível por git
FASE 2          Console Athos + agentes     → migrations aditivas + UI + logs
FASE 3          Materiais via Athos         → destrutiva (remove tabelas/telas)
```

Nunca começar a Fase 3 antes de o Athos Construtor entregar qualidade (Fase 3 passo 1–2 são
aditivos; a remoção é o passo 3).

## Matriz de risco

| Risco | Fase | Severidade | Mitigação |
|-------|------|-----------|-----------|
| Quebrar impersonação (master org) | 1 | Alta | Não tocar em `handleBackToMaster`, `original_master_org_id`, banner. Testar impersonar/sair. |
| Membro de equipe ganhar acesso indevido à Plataforma | 1 | Alta | Manter `isMember` ocultando seções de Aprendizado. |
| Tutoriais "perdidos" (target sumiu) | 1,2,3 | Média | Atualizar `data-tutorial` + `tutorialData.ts` a cada mudança de UI. |
| FKs `jornada_passos` → `arsenal_ferramentas/categorias` | 3 | Alta | Migration limpa FKs (`SET NULL`/converter p/ `acao_livre`) antes de dropar tabelas. Ajustar `AdminJornadaEditor`, `useSaveJornadaEstrutura`, tool `criar_jornada`. |
| Cliente perder materiais criados | 3 | Alta | Exportar/migrar conteúdo útil antes de remover. |
| Renomear slug de edge function quebra webhook/cron | 2 | Alta | Só renomear **nome exibido**, nunca `slug`/nome da função. |
| Cross-org leak no Athos CS (`usuarios_papeis.'admin'`) | 2 | Alta | Revisar `get_cs_clients()`/`is_admin()` — ver memória `project_usuarios_papeis_admin_gotcha`. |
| Marketing/Scoring vazar p/ cliente não-GCA | 2 | Média | `plano_min = 'gca'` gating nos agentes de marketing. |
| Vazamento de contexto ao trazer telas de plataforma p/ shell CRM | 1 | Baixa | Preservar `isConversationsPage` full-bleed e banners condicionais. |

## Dependências entre fases

- Fase 2 depende da seção **ATHOS** existir no menu (Fase 1).
- Fase 3 depende do Athos Construtor (parte da família de agentes da Fase 2) e da área de saídas.
- Renomeação para `Athos …` acontece na Fase 2, mas os **rótulos de menu** podem já ser ajustados
  na Fase 1 para não renomear duas vezes.

## Checklist de rollback

- **Fase 1**: `git revert` do commit da sidebar. Sem estado de banco → rollback trivial.
- **Fase 2**: migrations aditivas — manter `IAHub`/`IATipo` até o console provar-se; remover só
  depois. Feature-flag possível via `athos_agentes.ativo`.
- **Fase 3**: **ponto sem volta** ao dropar tabelas. Fazer backup/export (`execute_sql` dump de
  `arsenal_ferramentas`, `arsenal_categorias`, materiais) antes de qualquer `DROP`.

## Verificação por fase (obrigatória)

Após cada fase: `npm run build` + `npm run lint`, e teste manual dos fluxos-chave (login cliente,
login membro, impersonação superadmin, acesso a cada seção). Edge functions → deploy via MCP
`deploy_edge_function` e teste conforme memória `reference_edge_function_testing`.

## Itens em aberto p/ decisão do João (não bloqueiam Fase 1)

1. Nome final de cada agente (proposta em `04-mapa-ias-agentes.md`).
2. `detect-pipeline-stage` é agente próprio (**Athos Etapas**) ou dobra em **Athos Análise**?
3. Console Athos mora em `/crm/athos` ou `/plataforma/athos`? (com menu único, tanto faz p/ o
   usuário; sugiro `/crm/athos` para consolidar tudo sob o mesmo prefixo operacional).
4. Outbound continua como sub-workspace separado ou entra no menu único também?
