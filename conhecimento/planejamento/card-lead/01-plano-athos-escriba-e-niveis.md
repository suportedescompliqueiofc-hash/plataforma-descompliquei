# Plano — Athos Escriba + evolução do card do lead

> Consolidação das decisões (2026-07-09). Complementa [00-benchmark-card-paciente.md](./00-benchmark-card-paciente.md).

## Contexto

Hoje só o **Athos Pré-Atendimento** (`whatsapp-ai-agent`) preenche `resumo` e `procedimento_interesse` — e apenas **enquanto a IA responde**. Quando um humano assume ou a IA está desligada na org, o CRM para de ser enriquecido. A solução é um novo agente passivo.

## Athos Escriba (novo agente — Track B)

Agente passivo que lê a conversa (IA ou humana) e mantém os campos do lead preenchidos.

- **Encaixe:** novo item em `src/lib/athosAgents.ts` (categoria `analise`), gate `athos_agentes_org` (slug `escriba`), `logSlug: "escriba"` (aparece no console e na aba de IA), edge function em cron — mesmo padrão do `analyze-followup-need`.
- **Gatilho (decidido): cron + watermark.** Nova coluna `leads.enriquecido_em`. Cron a cada ~3–5 min pega leads com `ultimo_contato > enriquecido_em` **e** última mensagem parada há ~2–3 min (debounce). Analisa 1×, marca `enriquecido_em`. Nada de event-driven por mensagem (caro, reanalisa no meio, corre com a IA).
- **Modelo:** tarefa de extração simples → modelo barato. Validar o ID real na infra (o João citou "DeepSeek V4 Flash"; hoje os agentes usam GPT-4.1-mini como barato). Cap ~15–20 últimas mensagens, saída JSON pequena.
- **Campos mantidos (v1, decidido):** `resumo`, `procedimento_interesse`, `objetivo/objeção`.
- **Política de sobrescrita (decidido):** **sempre atualiza** com a leitura mais recente. Suporta **múltiplos procedimentos** — grava lista em texto (ex.: "Rinomodelação, Preenchimento labial"); UI exibe como chips. (Futuro: relação `lead_procedimentos` se necessário.)
- **Gating:** respeita `athos_agente_ativo(org, 'escriba')` — early-return `{skipped}` se off.
- **Deploy:** migration via MCP; a edge function, se pequena, via MCP inline; cron via pg_cron/agenda do Supabase. (Funções grandes o João deploya pela CLI dele.)

## Roadmap do card (Track A — UI, não depende do Escriba)

1. **Procedimento de interesse no Resumo** — chips (suporta múltiplos). ⬅️ começando
2. **Aba de IA** — resumo da conversa + tempo atendido pela IA (mensagens `remetente='bot'`) + análise do Follow-Up (`followup_gap_motivo` + horas sem contato + tentativas). Tudo automático.
3. **Próximo agendamento em destaque** no Resumo (de `agendamentos`).

## Roadmap de projetos (Nível 3 — decisão de produto)

4. **Galeria antes/depois** linkada ao procedimento — tabela `lead_fotos` + Storage + UI. Preenchimento manual (o profissional tira as fotos).
5. **Anamnese leve** — terreno regulado (ANVISA/CFM); planejamento próprio.

## Como as duas frentes se reforçam

Track A mostra os campos; o Escriba (Track B) faz esses campos ficarem preenchidos **mesmo em conversas humanas**. Track A não bloqueia no Track B — começa já.

## Itens em aberto

- Confirmar ID do modelo barato na infra antes de codar o Escriba.
- Decidir cadência exata do cron e janela de debounce (defaults: 5 min / 3 min).
- v2: relação `lead_procedimentos` (se múltiplos em texto ficar limitado).
