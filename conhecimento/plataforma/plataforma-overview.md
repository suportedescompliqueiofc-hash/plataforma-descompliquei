# Plataforma Descompliquei — Overview

O que a Plataforma entrega ao cliente, como está organizada e o que cada seção faz.

> **Distinção importante:** CRM (conversas, leads, agendamentos, vendas) e Plataforma (formação, ferramentas, Athos, jornada) são dois mundos separados com propósitos diferentes. O CRM é o dia a dia operacional. A Plataforma é o desenvolvimento comercial do gestor e da clínica.

---

## O Que É a Plataforma

A Plataforma é o ambiente de desenvolvimento comercial do cliente — onde ele acessa os recursos de formação, estrutura processos e recebe orientação do Athos GS.

Enquanto o CRM cuida da operação (atender leads, agendar, vender), a Plataforma cuida da estrutura por trás da operação: o que vender, como precificar, como atender, como formar equipe, como definir metas.

---

## Onde Fica

Rota base: `/plataforma/*` (separada de `/crm/*`)

O cliente acessa pela sidebar lateral — seção distinta do CRM.

---

## O Que a Plataforma Entrega

### 1. Arsenal Comercial

**O que é:** Caixa de ferramentas práticas organizadas em 7 categorias. 18 ferramentas no total, cada uma com nota de praticante + template pré-preenchido + 2 templates alternativos + copiloto Athos.

**O que entrega:** O cliente sai de cada ferramenta com algo construído — não com conhecimento teórico. Tudo praticamente pronto, ele só adapta para a clínica dele.

**As 7 categorias:**
1. Fundação Comercial — ICP, arquitetura de processos
2. Oferta, Precificação e Posicionamento — arquitetura da oferta, precificação estratégica
3. Atendimento e Conversão — estrutura de atendimento consultivo, banco de objeções
4. Follow-up e Reativação — cadência de leads ativos, reativação de base inativa
5. Canais de Aquisição — programa de indicação
6. Equipe Comercial — contratação, seletivo, comissionamento, onboarding, delegação, SOPs
7. Metas e Gestão Comercial — forecasting, metas, calendário comercial

Ver detalhes: `arsenal/overview.md` e `arsenal/categorias.md`

---

### 2. Meus Materiais

**O que é:** Biblioteca pessoal do cliente com tudo que ele construiu nas ferramentas do Arsenal. Cada vez que salva uma ferramenta, o resultado vai para Meus Materiais.

**O que entrega:**
- Acesso rápido a tudo que já foi construído
- Editor rico para revisar e atualizar o material a qualquer momento
- Copiloto Athos disponível dentro do editor para continuar refinando
- Organização por ferramenta de origem (cada material é rastreável à ferramenta que o gerou)

Ver detalhes: `arsenal/meus-materiais.md`

---

### 3. DescompliqueiOS — Athos GS

**O que é:** Chat com o Athos GS e outros agentes especializados. O Athos é o consultor comercial da plataforma — conhece o CRM do cliente, tem acesso às métricas, pode consultar leads, agendamentos e vendas, e ajuda a tomar decisões com base nos dados reais da clínica.

**O que entrega:**
- Consulta estratégica baseada nos dados do CRM (não em teoria genérica)
- Criação de jornadas personalizadas de implementação
- Memória persistente entre conversas (o Athos lembra do contexto da clínica)
- Múltiplos agentes especializados (além do Athos GS)

**Diferença crítica do Athos no Arsenal vs. Athos no OS:**
- **Arsenal:** puramente conversacional, sem tools, foca em ajudar a preencher o template da ferramenta
- **OS:** tem acesso completo ao CRM via tools (buscar leads, ver agendamentos, calcular métricas, etc.)

---

### 4. Jornada Personalizada

**O que é:** Plano de implementação estruturado criado pelo Athos GS para a clínica específica do cliente. Não é conteúdo genérico — é a sequência de passos que o cliente precisa dar, na ordem certa, com base no diagnóstico da clínica.

**O que entrega:**
- Etapas sequenciais com locking (não pode pular etapa sem concluir a anterior)
- Passos vinculados a ferramentas do Arsenal ou aulas (abre direto na ferramenta correta)
- Progresso visual com % de conclusão
- Gerada pelo Athos GS na conversa de onboarding ou sob demanda

---

### 5. Trilha de Aprendizado

**O que é:** Conteúdo estruturado em módulos e aulas em vídeo para aprendizado mais aprofundado. Distinto das ferramentas — é formação, não construção.

**O que entrega:**
- Aulas em vídeo organizadas por blocos/módulos
- Progresso por aula (marcar como concluída)
- Materiais Complementares: PDFs e conteúdo HTML organizados em pastas, acessíveis sem sair da plataforma
- Abertura de PDF direto no browser; HTML renderizado em iframe isolado (preserva estilos do documento)

---

## Fluxo do Cliente na Plataforma

```
Onboarding diagnóstico → Conversa com Athos GS → Jornada criada
                                                       ↓
                    Abre ferramenta do Arsenal → Preenche com Athos → Salva
                                                       ↓
                                           Meus Materiais → Revisitar e refinar
                                                       ↓
                                    OS (Athos com dados do CRM) → Decisões estratégicas
```

---

## O Que NÃO Existe na Plataforma

| Funcionalidade | Status |
|----------------|--------|
| Aulas em formato de quiz ou gamificação | ❌ Não existe |
| Conteúdo genérico de marketing digital | ❌ Fora do escopo |
| Integração com ferramentas externas (Canva, Google Docs) | ❌ Não existe |
| Certificados de conclusão | ❌ Não existe |

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-06-27 | Criação — primeira versão completa |
