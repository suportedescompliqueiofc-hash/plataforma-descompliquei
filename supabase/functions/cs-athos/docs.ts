// Base de conhecimento de CS da Descompliquei — versão condensada e operacional
// dos 11 documentos em conhecimento/operacional/cs/*.md, empacotada para o Athos CS.
// O Athos usa a tool consultar_documentacao(busca) para puxar trechos daqui.
// Fonte da verdade continua sendo os .md; este arquivo é o espelho operacional.

export interface CsDoc { slug: string; titulo: string; conteudo: string; }

export const CS_DOCS: CsDoc[] = [
  {
    slug: 'filosofia-e-modelo',
    titulo: 'Filosofia e Modelo do CS',
    conteudo: `CS na Descompliquei não é suporte reativo — é a função que garante que o cliente ALCANCE O RESULTADO que veio buscar: multiplicar o faturamento da clínica. Princípio central (outcome-driven): sucesso = o resultado desejado do cliente + a experiência de chegar até lá. O CSM é responsável por resultado percebido, não por uso da plataforma. Métrica-mãe: o cliente está faturando mais do que antes? Regra de ouro: nenhum cliente fica 14+ dias sem uma ação ativa do CSM. O CS é proativo — o sistema entrega quem precisa de atenção; o CSM não garimpa.`,
  },
  {
    slug: 'jornada-do-cliente',
    titulo: 'Jornada do Cliente (D0 → Maturidade)',
    conteudo: `Fases: ATIVAÇÃO (D0–D30) — kickoff, diagnóstico, jornada do Athos ativa, primeiras ferramentas do Arsenal, primeiro lead no CRM. EXECUÇÃO (D31–D90) — ritmo de implementação, 30–50% da jornada, primeiros resultados no CRM. TRAÇÃO (D91–D180) — resultado consolidado, review de números, NPS. MATURIDADE (D181+) — presença estratégica, QBR trimestral, expansão e indicação. Cada fase tem marcos objetivos e uma cadência própria (ver Cadência). Cliente atrasado na fase esperada = sinal de risco.`,
  },
  {
    slug: 'health-score',
    titulo: 'Health Score — Modelo 2 Eixos',
    conteudo: `Health = Adoção×0,40 + Resultado×0,60 (Resultado pesa mais — é o que o cliente percebe). EIXO ADOÇÃO (uso da plataforma): Ativação 25%, Jornada 25%, Arsenal 15%, Rotina no CRM 20%, Responsividade 15%. EIXO RESULTADO (resultado no CRM): Crescimento de faturamento 32% (sinal-mestre), Receita/volume 26%, Conversão 20%, Tempo de atendimento 14%, Meta 8% (peso redistribuído se sem meta). Escala: 70–100 verde (saudável), 45–69 amarelo (atenção), 0–44 vermelho (risco). Leitura cruzada: Adoção alta + Resultado baixo = usa mas não converte (ajudar operação/funil). Adoção baixa + Resultado alto = mostrar como escalar com a plataforma. Ambos baixos = churn iminente. Tendência: snapshot diário; queda de 8+ pts dispara alerta — agir antes do churn.`,
  },
  {
    slug: 'cadencia-de-touchpoints',
    titulo: 'Cadência de Touchpoints por Fase',
    conteudo: `ATIVAÇÃO: kickoff D0–D1, pulso D3 (diagnóstico), pulso D7 (primeiro passo), reunião de alinhamento D14, pulso D21 (Arsenal), balanço do mês D30. EXECUÇÃO: pulso semanal + reunião quinzenal de review (CRM + jornada). TRAÇÃO: pulso quinzenal de resultado + review mensal de números. MATURIDADE: pulso mensal + QBR trimestral (retrospectiva, renovação, expansão, indicações). Tipos de touchpoint: WhatsApp, reunião, e-mail, ligação. Regra de ouro: 14+ dias sem contato ativo = urgente. Sempre registrar o touchpoint e definir o próximo contato.`,
  },
  {
    slug: 'playbook-onboarding',
    titulo: 'Playbook de Onboarding (Ativação)',
    conteudo: `Objetivo: levar o cliente de "assinante" a "usuário ativo com primeiro resultado". Passos: 1) Kickoff (30 min): apresentar plataforma, expectativas, garantir acesso ao Athos. 2) Garantir diagnóstico preenchido (D3). 3) Jornada personalizada gerada e iniciada (D7). 4) Primeira ferramenta do Arsenal construída (D14). 5) CRM com lead ativo (D21). 6) 3+ ferramentas e balanço do mês (D30). Gatilhos de risco: onboarding não concluído, jornada sem passos, nenhum lead no CRM após 21 dias. Meta de saída: cliente ativado nos 2 eixos.`,
  },
  {
    slug: 'playbook-engajamento',
    titulo: 'Playbook de Engajamento (manter ritmo)',
    conteudo: `Para clientes ativos que precisam manter constância. Sinais: adoção caindo, jornada parada 14+ dias, rotina no CRM irregular. Ações: pulso semanal de check-in, remover travamentos concretos, reconectar o uso da plataforma ao resultado ("essa ferramenta puxa mais lead"), celebrar pequenas vitórias com dado. Se a adoção está boa mas o resultado não vem, o foco vira a OPERAÇÃO COMERCIAL: velocidade de atendimento, follow-up, conversão do funil.`,
  },
  {
    slug: 'playbook-risco-churn',
    titulo: 'Playbook de Risco de Churn',
    conteudo: `Acionar quando health vermelho, faturamento em queda, CRM inativo 14+ dias, ghosting, ou 2+ reuniões sem comparecimento. Passos: 1) Contato imediato e humano (não automatizado) — nomear o que você observou. 2) Diagnosticar a causa raiz (resultado? operação? relação? contexto externo?). 3) Propor 1 ação concreta de curtíssimo prazo que gere resultado visível. 4) Reunião de resgate com plano de 15 dias. 5) Se não responder ao 1º contato, escalar para o líder de CS. Nunca deixar um vermelho passar 7 dias sem ação. Documentar tudo.`,
  },
  {
    slug: 'playbook-escalada',
    titulo: 'Playbook de Escalada (casos críticos)',
    conteudo: `Para casos que ultrapassam o CSM: risco de churn não revertido, pedido de cancelamento, insatisfação grave, ou oportunidade estratégica grande. Escalar para o líder de CS com: contexto, histórico de touchpoints, dados do CRM (health, faturamento, tendência), causa raiz e o que já foi tentado. Definir dono e prazo. Escalada não é falha — é usar o recurso certo no momento certo.`,
  },
  {
    slug: 'metricas-e-kpis',
    titulo: 'Métricas e KPIs do CS',
    conteudo: `KPIs de resultado da base: faturamento agregado (30d), crescimento médio, ticket médio, taxa de conversão média, tempo médio de 1º contato, % da base com meta configurada. KPIs de operação de CS: cobertura de touchpoints (30d) meta ≥90%, health score médio meta ≥65, NPS meta ≥40, clientes em maturidade, % touchpoints positivos ≥60%. Por cliente: health 2-eixos + tendência, faturamento e crescimento MoM (janela móvel 30d), funil lead→MQL→agendamento→fechamento, tempo de atendimento. Fila proativa "Resultado em risco" no Painel prioriza a ação do dia.`,
  },
  {
    slug: 'expansao-e-advocacy',
    titulo: 'Expansão e Advocacy',
    conteudo: `Clientes saudáveis (verde) com resultado consolidado e NPS ≥8 são candidatos a advocacy: pedir indicação, depoimento, case. Expansão: identificar quando o cliente pode fazer mais com a plataforma (novos módulos, mais volume, mais ferramentas). Timing: em maturidade, no QBR, ou logo após uma vitória clara de resultado. Nunca pedir indicação de cliente que não está tendo resultado — advocacy nasce de resultado percebido.`,
  },
  {
    slug: 'resultado-no-crm',
    titulo: 'Resultado no CRM (o que o cliente percebe)',
    conteudo: `Métricas puxadas direto do CRM de cada cliente. Faturamento e crescimento período-a-período (sinal-mestre); crescimento >300% é artefato de base baixa. Funil: leads→MQL→agendamento→fechamento com taxas. Tempo de atendimento: 1º contato e resposta média (com guard de 3 dias para excluir artefato de importação). Adoção de funcionalidades: IA, follow-up, agendamentos, vendas, metas, etiquetas. Meta de faturamento: sem meta = sem régua de sucesso (ação de CS: configurar). NÃO inclui marketing/Meta Ads nem scoring de leads (exclusivos da Descompliquei, não são métrica de CS transversal). Snapshot diário monta a tendência.`,
  },
];

export function buscarDocs(busca: string): string {
  const q = (busca || '').toLowerCase().trim();
  if (!q) return CS_DOCS.map(d => `## ${d.titulo}\n${d.conteudo}`).join('\n\n');
  const termos = q.split(/\s+/);
  const ranked = CS_DOCS
    .map(d => {
      const hay = (d.titulo + ' ' + d.conteudo + ' ' + d.slug).toLowerCase();
      const score = termos.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { d, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (ranked.length === 0) return CS_DOCS.map(d => `## ${d.titulo}\n${d.conteudo}`).join('\n\n');
  return ranked.map(x => `## ${x.d.titulo}\n${x.d.conteudo}`).join('\n\n');
}
