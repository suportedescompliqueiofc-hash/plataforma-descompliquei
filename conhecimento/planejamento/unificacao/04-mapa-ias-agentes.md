# Mapa das IAs → Agentes Athos

> Inventário de toda IA atuante hoje, o nome novo sob a marca **Athos**, e a edge function /
> origem que a alimenta. O **Athos GS** é o cérebro/copiloto geral; os demais são **agentes**.

## ⚠️ CORREÇÃO (2026-07-05) — agentes que REALMENTE operam no CRM

A primeira versão deste mapa misturou o **catálogo antigo do IAHub** (`platform_ia_config`:
`objections`, `remarketing`, `campaign`, `creative`, `content`, `analysis`, `followup`,
`preattendance`) com os agentes reais. Esse catálogo é **legado** — lido apenas pelo `ia-proxy`;
as funções que operam no CRM têm prompt próprio e **não** o usam.

**Fonte de verdade agora é `src/lib/athosAgents.ts`.** Os agentes que de fato operam no CRM:

| Agente | Edge function (gatilho real) | Categoria | Gate |
|--------|------------------------------|-----------|------|
| **Athos GS** | `descompliquei-os` (copiloto) | núcleo | `acesso_os` |
| **Athos Recepção** | `whatsapp-ai-agent` (webhook `receive-message` + cron) | atendimento | `acesso_crm` |
| **Athos Triagem** | `triage-lead-ia` (webhook `receive-message`) | atendimento | `acesso_crm` |
| **Athos Análise** | `analyze-non-leads` (frontend + webhook) | análise | `acesso_crm` |
| **Athos Follow-Up** | `analyze-followup-need` (cron) + `ia-followup-agent` | análise | `acesso_crm` |
| **Athos CS** | `cs-athos` (Admin CS) | cs | superadmin/admin |

**Fora do registry:** `detect-pipeline-stage` (legado — pipeline removido); `platform_ia_config`
(catálogo antigo IAHub); `chat-completion`/`ia-proxy` (plumbing LLM).

A tabela histórica abaixo fica como referência do inventário amplo, mas **não** é a lista de
agentes do console.

## Princípio

- **Athos GS** = a IA geral da plataforma (copiloto conversacional, hoje `descompliquei-os`).
- Todo o resto vira **agente do Athos**, com nome `Athos <função>`.
- Cada agente é registrado num **registry único** (ver Fase 2) com: `slug`, `nome`, `descricao`,
  `categoria`, `edge_function`, `ativo` (on/off por org), origem de **logs** e **dados/métricas**.

## Tabela de agentes

| Nome novo | Origem hoje (IAHub / edge function) | O que faz | On/off | Logs |
|-----------|-------------------------------------|-----------|--------|------|
| **Athos GS** | `descompliquei-os` (chat copiloto) + `os_memories` | Copiloto geral; conversa, cria jornada, memória persistente, gera materiais (Fase 3). | — (núcleo) | `os_conversations` |
| **Athos Recepção** | `whatsapp-ai-agent` + `receive-message` · IAHub `preattendance` | Pré-atendimento 24h no WhatsApp; responde/qualifica lead. | `toggle-ai-status` | `mensagens` (remetente `ia`/`bot`) |
| **Athos Objeções** | IAHub `objections` | Sugere quebra de objeção na hora do atendimento. | por org | a definir |
| **Athos Análise** | `analyze-non-leads` · IAHub `analysis` | Diagnóstico de conversão dos atendimentos. | por org | a definir |
| **Athos Follow-Up** | `ia-followup-agent` + `analyze-followup-need` · IAHub `followup` | Detecta gaps e dispara follow-up (D+1/D+3/D+7). | por org | `cadencia_logs`/notas |
| **Athos Remarketing** | IAHub `remarketing` | Reativa base inativa. | por org | a definir |
| **Athos Campanhas** | `trigger-campaign` · IAHub `campaign` (GCA) | Brief de anúncio pronto. | plano GCA | a definir |
| **Athos Criativo** | IAHub `creative` (GCA) | Roteiro de criativo para gravar. | plano GCA | a definir |
| **Athos Conteúdo** | IAHub `content` (GCA) | Calendário de conteúdo por ICP. | plano GCA | a definir |
| **Athos Triagem** | `triage-lead-ia` | Classifica/triagem de leads recebidos. | por org | a definir |
| **Athos Etapas** | `detect-pipeline-stage` | Detecta etapa do funil (histórico de stage). | por org | `lead_stage_history` |
| **Athos CS** | `cs-athos` | Copiloto de Customer Success (Admin CS). | admin | a definir |
| **Athos Construtor** | *(novo — Fase 3)* | Gera materiais/ferramentas comerciais com o cliente. | por org | novo (ver Fase 3) |

> Nomes são propostas — João pode renomear. `detect-pipeline-stage` pode ser dobrado dentro de
> **Athos Análise** se não fizer sentido como agente isolado.

## Infra de IA que NÃO é agente (fica como plumbing)

- `chat-completion`, `ia-proxy` — proxies/roteadores de LLM. Continuam como infra.
- `super-admin-system-ai-config` — config global de IA (chaves/modelos). Vira a aba
  "Configuração do Sistema" dentro do console Athos (superadmin).

## Config de sistema / cérebro

- `Cerebro.tsx` (`/plataforma/cerebro`) — o "Cérebro Central" que personaliza as saídas das IAs
  por ICP/procedimentos. Passa a ser a aba **"Cérebro"** do console Athos (contexto compartilhado
  por todos os agentes).
- `athos_agentes` (tabela existente) já guarda `slug/nome/descricao/system_prompt/ativo` — é a
  base natural do **registry**. Estender com `categoria`, `edge_function`, `icone`, `plano_min`,
  `escopo` (`crm`/`plataforma`/`admin`).

## Observações de segurança

- `Athos CS` usa `cs-athos` — atenção ao gotcha `usuarios_papeis.'admin'` (dono de clínica, não
  staff): `get_cs_clients()`/`is_admin()` podem vazar cross-org. Ver memória
  `project_usuarios_papeis_admin_gotcha`.
- Marketing/Scoring (Campanhas/Criativo/Conteúdo) são **Descompliquei-only** — não expor no
  console de clientes que não têm o plano GCA.
