import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check, Clock, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { useOnboardingDiagnostico, type Respostas } from "@/hooks/useOnboardingDiagnostico";
import { useAuth } from "@/contexts/AuthContext";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type QType = "text" | "single" | "multi";

interface Pergunta {
  id: string;
  label: string;
  type: QType;
  options?: string[];
  placeholder?: string;
  dynamicOptions?: (r: Respostas) => string[];
  visibleIf?: (r: Respostas) => boolean;
}

interface Bloco {
  numero: number;
  titulo: string;
  perguntas: Pergunta[];
  minutosEstimados: number;
}

// ── Dados dos blocos ───────────────────────────────────────────────────────────

const BLOCOS: Bloco[] = [
  {
    numero: 1,
    titulo: "Antes de tudo, nos conte sobre a sua clínica.",
    minutosEstimados: 3,
    perguntas: [
      { id: "p1", label: "Qual é o nome da sua clínica?", type: "text", placeholder: "Ex: Clínica Bella Estética" },
      { id: "p2", label: "Qual é a sua especialidade principal?", type: "single", options: ["HOF", "Odontologia Estética", "Medicina Estética", "Múltiplas"] },
      { id: "p3", label: "Você atende por convênio, somente particular, ou os dois?", type: "single", options: ["Somente particular", "Somente convênio", "Particular e convênio"] },
      { id: "p3a", label: "Qual porcentagem do faturamento vem do convênio?", type: "single", options: ["Menos de 25%", "25–50%", "50–75%", "Mais de 75%", "100%"], visibleIf: (r) => r.p3 && r.p3 !== "Somente particular" },
      { id: "p3b", label: "Você tem interesse em reduzir a dependência do convênio?", type: "single", options: ["Sim, é um objetivo claro", "Sim, mas não sei como", "Não — o convênio funciona bem", "Ainda não pensei nisso"], visibleIf: (r) => r.p3 && r.p3 !== "Somente particular" },
      { id: "p3c", label: "Você já oferece serviços fora do convênio, de forma particular?", type: "single", options: ["Sim, já tenho carteira particular", "Tenho alguns pacientes mas é pequeno", "Não ofereço nada fora do convênio"], visibleIf: (r) => r.p3 && r.p3 !== "Somente particular" },
      { id: "p3d", label: "Os pacientes do convênio conhecem seus serviços particulares?", type: "single", options: ["Sim, sempre apresento", "Às vezes menciono", "Não — mantenho separado", "Não tenho serviços particulares"], visibleIf: (r) => r.p3 && r.p3 !== "Somente particular" },
      { id: "p3e", label: "Qual é o ticket médio nos procedimentos particulares?", type: "text", placeholder: "Ex: R$ 1.200", visibleIf: (r) => r.p3 && r.p3 !== "Somente particular" },
      { id: "p4", label: "Há quanto tempo você está no mercado?", type: "single", options: ["Menos de 1 ano", "1–2 anos", "3–5 anos", "Mais de 5 anos"] },
      { id: "p5", label: "Em qual cidade e estado você atua?", type: "text", placeholder: "Ex: São Paulo, SP" },
      { id: "p6", label: "Você atua em clínica própria ou alugada/compartilhada?", type: "single", options: ["Própria", "Alugada ou compartilhada"] },
      { id: "p7", label: "Quantos dias por semana você atende?", type: "single", options: ["1–2", "3–4", "5 ou mais"] },
      { id: "p8", label: "Qual é o seu volume médio de atendimentos por mês?", type: "text", placeholder: "Ex: 60 atendimentos" },
    ],
  },
  {
    numero: 2,
    titulo: "Agora vamos entender de onde vêm os seus pacientes.",
    minutosEstimados: 4,
    perguntas: [
      { id: "p9", label: "Como você avalia o volume de demanda atual?", type: "single", options: ["Tenho demanda consistente e previsível", "Tenho demanda mas é irregular", "Tenho pouca demanda", "Quase não recebo leads novos"] },
      { id: "p10", label: "Você já tem uma base de pacientes que atendeu anteriormente?", type: "single", options: ["Sim, tenho base grande — mais de 100 pacientes", "Tenho base pequena — menos de 100", "Estou começando — poucos ou nenhum ainda"] },
      { id: "p10a", label: "Você se comunica ativamente com essa base?", type: "single", options: ["Sim, regularmente", "Às vezes", "Não — a base está parada"], visibleIf: (r) => r.p10 === "Sim, tenho base grande — mais de 100 pacientes" },
      { id: "p10b", label: "Você sabe quantos não voltaram nos últimos 6 meses?", type: "single", options: ["Sim, acompanho", "Tenho uma ideia", "Não sei"], visibleIf: (r) => r.p10 === "Sim, tenho base grande — mais de 100 pacientes" },
      { id: "p11", label: "Quais canais geram leads para você hoje?", type: "multi", options: ["Instagram orgânico", "Tráfego pago", "Indicação de pacientes", "Google", "Nenhum canal estruturado", "Outro"] },
      { id: "p12", label: "Qual desses canais é o principal?", type: "single", dynamicOptions: (r) => Array.isArray(r.p11) ? r.p11 : [], visibleIf: (r) => Array.isArray(r.p11) && r.p11.length > 1 },
      { id: "p13", label: "Se o canal principal parasse amanhã, continuaria recebendo leads?", type: "single", options: ["Sim, tenho múltiplas fontes", "Reduziria bastante mas não zeraria", "Pararia quase tudo"] },
      { id: "p14", label: "Você investe em tráfego pago hoje?", type: "single", options: ["Sim, de forma consistente", "Já investi mas parei", "Nunca investi"] },
      { id: "p14a_ativo", label: "Investimento mensal aproximado?", type: "single", options: ["Menos de R$1k", "R$1k–R$3k", "R$3k–R$5k", "Acima de R$5k"], visibleIf: (r) => r.p14 === "Sim, de forma consistente" },
      { id: "p14b_ativo", label: "Quem gerencia?", type: "single", options: ["Agência", "Freelancer", "Eu mesmo"], visibleIf: (r) => r.p14 === "Sim, de forma consistente" },
      { id: "p14c_ativo", label: "Você rastreia quantos leads vêm dos anúncios?", type: "single", options: ["Sim, com clareza", "Tenho uma ideia", "Não sei dizer"], visibleIf: (r) => r.p14 === "Sim, de forma consistente" },
      { id: "p14d_ativo", label: "Está satisfeito com o retorno?", type: "single", options: ["Sim, o ROI é bom", "É razoável mas poderia ser melhor", "Não — invisto e não vejo retorno claro"], visibleIf: (r) => r.p14 === "Sim, de forma consistente" },
      { id: "p14e_ativo", label: "O problema está em gerar leads ou em converter os que chegam?", type: "single", options: ["Em gerar — poucos leads chegam", "Em converter — chegam mas não fecham", "Os dois"], visibleIf: (r) => r.p14 === "Sim, de forma consistente" },
      { id: "p14a_parou", label: "Por que parou?", type: "single", options: ["Não via retorno claro", "Era muito caro", "Não tinha estrutura para atender os leads", "Problemas com quem gerenciava", "Outro"], visibleIf: (r) => r.p14 === "Já investi mas parei" },
      { id: "p14b_parou", label: "Pretende retomar?", type: "single", options: ["Sim, em breve", "Talvez, dependendo da estrutura", "Não por enquanto"], visibleIf: (r) => r.p14 === "Já investi mas parei" },
      { id: "p14a_nunca", label: "Por que nunca investiu?", type: "single", options: ["Não sentia necessidade — tenho demanda suficiente", "Não sei como funciona", "Acho caro e arriscado", "Não tive tempo de estruturar"], visibleIf: (r) => r.p14 === "Nunca investi" },
      { id: "p14b_nunca", label: "Tem interesse em começar?", type: "single", options: ["Sim, é um objetivo", "Talvez no futuro", "Não — prefiro outros canais"], visibleIf: (r) => r.p14 === "Nunca investi" },
      { id: "p15", label: "Perfil predominante dos seus pacientes?", type: "single", options: ["Jovens 20–30 anos", "Adultos 30–45 anos", "Acima de 45 anos", "Misto"] },
      { id: "p16", label: "Seus pacientes chegam decididos ou precisam ser convencidos?", type: "single", options: ["Chegam decididos", "Metade e metade", "A maioria precisa ser convencida"] },
      { id: "p17", label: "Preço é a principal objeção dos seus pacientes?", type: "single", options: ["Sim, frequentemente", "Às vezes", "Raramente"] },
      { id: "p18", label: "Porcentagem da receita de pacientes que voltaram ou indicaram?", type: "single", options: ["Menos de 20%", "20–40%", "40–60%", "Mais de 60%", "Não sei estimar"] },
      { id: "p19", label: "Maior desafio na geração de demanda hoje?", type: "text", placeholder: "Descreva livremente..." },
    ],
  },
  {
    numero: 3,
    titulo: "Vamos entender o seu faturamento e o que você vende.",
    minutosEstimados: 2,
    perguntas: [
      { id: "p20", label: "Faturamento médio mensal atual?", type: "single", options: ["Abaixo de R$20k", "R$20k–R$50k", "R$50k–R$100k", "R$100k–R$200k", "Acima de R$200k"] },
      { id: "p21", label: "Ticket médio por procedimento hoje?", type: "text", placeholder: "Ex: R$ 800" },
      { id: "p22", label: "Procedimento que mais gera receita?", type: "text", placeholder: "Ex: Botox, Harmonização Facial..." },
      { id: "p23", label: "Você vende principalmente avulsos ou protocolos/pacotes?", type: "single", options: ["Principalmente avulsos", "Misto", "Principalmente protocolos e pacotes"] },
      { id: "p24", label: "Tem protocolos com nome próprio e valor justificado?", type: "single", options: ["Sim, tenho protocolos com nome e narrativa", "Tenho algo informal", "Vendo por nome técnico e preço de mercado"] },
      { id: "p25", label: "Oferece alguma forma de recorrência?", type: "single", options: ["Sim, tenho recorrência estruturada", "Faço informalmente", "Não ofereço recorrência"] },
      { id: "p26", label: "Tem clareza sobre sua margem de lucro?", type: "single", options: ["Sim, sei exatamente", "Tenho uma ideia", "Não sei"] },
      { id: "p27", label: "Maior custo operacional hoje?", type: "single", options: ["Aluguel", "Equipe", "Produtos e insumos", "Tráfego pago", "Outro"] },
    ],
  },
  {
    numero: 4,
    titulo: "Como a sua clínica converte leads em pacientes?",
    minutosEstimados: 3,
    perguntas: [
      { id: "p28", label: "Quantos leads novos chegam por mês?", type: "text", placeholder: "Ex: 40 leads" },
      { id: "p29", label: "Tempo médio para responder um lead novo?", type: "single", options: ["Menos de 5 min", "5–30 min", "30 min–2h", "Mais de 2h"] },
      { id: "p30", label: "Quem faz o primeiro atendimento?", type: "single", options: ["Eu mesmo", "Recepcionista", "Secretária", "Ninguém — respondo quando consigo"] },
      { id: "p31", label: "Tem processo definido de atendimento?", type: "single", options: ["Sim, temos script e processo", "Temos algo informal", "Não temos processo definido"] },
      { id: "p32", label: "Taxa de conversão estimada — lead para fechamento?", type: "single", options: ["Não sei", "Menos de 20%", "20–40%", "40–60%", "Acima de 60%"] },
      { id: "p33", label: "Tempo médio entre primeiro contato e fechamento?", type: "single", options: ["No mesmo dia", "1–3 dias", "1–2 semanas", "Mais de 2 semanas", "Não sei"] },
      { id: "p34", label: "Faz follow-up com leads que não fecharam?", type: "single", options: ["Sim, temos cadência definida", "Às vezes", "Não fazemos"] },
      { id: "p35", label: "Reativa pacientes inativos da base?", type: "single", options: ["Sim, regularmente", "Raramente", "Nunca"] },
      { id: "p36", label: "Já tentou estruturar processo de atendimento ou script?", type: "single", options: ["Sim e funcionou", "Sim mas não mantivemos", "Não"] },
      { id: "p37", label: "Maior dificuldade no atendimento hoje?", type: "text", placeholder: "Descreva livremente..." },
    ],
  },
  {
    numero: 5,
    titulo: "Como está estruturada a sua operação hoje?",
    minutosEstimados: 2,
    perguntas: [
      { id: "p38", label: "Tem equipe de atendimento ou recepção?", type: "single", options: ["Sim, tenho equipe", "Não — trabalho sozinho"] },
      { id: "p38a_equipe", label: "Essa equipe foi treinada para converter leads?", type: "single", options: ["Sim, formalmente", "Informalmente", "Não foi treinada"], visibleIf: (r) => r.p38 === "Sim, tenho equipe" },
      { id: "p38b_equipe", label: "Consegue acompanhar o que a equipe faz no atendimento?", type: "single", options: ["Sim, tenho visibilidade total", "Parcialmente", "Não — não sei o que acontece"], visibleIf: (r) => r.p38 === "Sim, tenho equipe" },
      { id: "p38c_equipe", label: "Já teve lead mal atendido ou oportunidade perdida pela equipe?", type: "single", options: ["Sim, acontece com frequência", "Já aconteceu algumas vezes", "Raramente"], visibleIf: (r) => r.p38 === "Sim, tenho equipe" },
      { id: "p38a_solo", label: "Fazer tudo sozinho limita o seu crescimento?", type: "single", options: ["Sim, claramente — não consigo atender tudo", "Parcialmente", "Ainda não sinto esse limite"], visibleIf: (r) => r.p38 === "Não — trabalho sozinho" },
      { id: "p38b_solo", label: "Pretende contratar para o atendimento nos próximos 3 meses?", type: "single", options: ["Sim, é prioridade", "Talvez", "Não por enquanto"], visibleIf: (r) => r.p38 === "Não — trabalho sozinho" },
      { id: "p39", label: "Horas por semana dedicadas a atividades comerciais?", type: "single", options: ["Menos de 5h", "5–10h", "10–20h", "Mais de 20h"] },
      { id: "p40", label: "O comercial depende da sua presença direta?", type: "single", options: ["Sim, eu faço tudo", "Parcialmente — delego algumas coisas", "Não, tenho equipe que opera sem mim"] },
      { id: "p41", label: "Já teve equipe comercial treinada para vender?", type: "single", options: ["Sim e funcionou", "Sim mas não deu certo", "Nunca tive"] },
      { id: "p42", label: "Objetivo: sair da operação ou continuar como principal fechador?", type: "single", options: ["Quero sair da operação e ter equipe autônoma", "Quero continuar envolvido mas com mais estrutura", "Ainda não pensei nisso"] },
    ],
  },
  {
    numero: 6,
    titulo: "Como você gerencia o seu negócio hoje?",
    minutosEstimados: 1,
    perguntas: [
      { id: "p43", label: "Usa CRM ou sistema para gerenciar leads?", type: "single", options: ["Sim", "Não", "Uso planilha"] },
      { id: "p44", label: "Acompanha métricas comerciais regularmente?", type: "single", options: ["Sim, semanalmente", "Às vezes", "Não acompanho"] },
      { id: "p45", label: "Tem processos e rotinas comerciais documentados?", type: "single", options: ["Sim", "Parcialmente", "Não"] },
    ],
  },
  {
    numero: 7,
    titulo: "Por fim — onde você quer chegar.",
    minutosEstimados: 3,
    perguntas: [
      { id: "p46", label: "Objetivo de faturamento para os próximos 3 meses?", type: "text", placeholder: "Ex: R$ 80.000 por mês" },
      { id: "p47", label: "Em qual área está mais travado hoje?", type: "single", options: ["Atendimento e conversão", "Precificação e oferta", "Geração de demanda", "Follow-up e reativação", "Gestão do time", "Visibilidade e métricas"] },
      { id: "p48", label: "Agenda lotada com faturamento baixo, ou agenda com espaço e conversão inconsistente?", type: "single", options: ["Agenda lotada, faturamento baixo", "Agenda com espaço, leads que não convertem", "Misto dos dois", "Outro"] },
      { id: "p49", label: "O que já tentou para crescer que não funcionou?", type: "text", placeholder: "Descreva livremente..." },
      { id: "p50", label: "Maior obstáculo para crescer hoje?", type: "text", placeholder: "Descreva livremente..." },
      { id: "p51", label: "Maior ambição com a clínica nos próximos 12 meses?", type: "text", placeholder: "Descreva livremente..." },
    ],
  },
];

const TEMPO_POR_BLOCO = BLOCOS.map((b) => b.minutosEstimados);
const TEMPO_TOTAL = TEMPO_POR_BLOCO.reduce((a, b) => a + b, 0);

// ── Geração de documento ───────────────────────────────────────────────────────

function gerarFlags(r: Respostas): string[] {
  const flags: string[] = [];
  if (r.p3 && r.p3 !== "Somente particular" && r.p3b === "Sim, é um objetivo claro")
    flags.push("Atende convênio e tem interesse claro em migrar para particular");
  if (r.p3 && r.p3 !== "Somente particular" && r.p3a === "100%")
    flags.push("100% dependente de convênio — sem receita particular atualmente");
  if (r.p10 === "Sim, tenho base grande — mais de 100 pacientes" && r.p10a === "Não — a base está parada")
    flags.push("Base grande parada sem comunicação ativa — potencial imediato de reativação");
  if (r.p14 === "Sim, de forma consistente" && r.p14c_ativo === "Não sei dizer")
    flags.push("Investe em tráfego pago mas não rastreia quantos leads chegam dos anúncios");
  if (r.p14 === "Sim, de forma consistente" && r.p14d_ativo === "Não — invisto e não vejo retorno claro")
    flags.push("Investe em tráfego mas não vê retorno claro — possível problema de conversão ou gestão");
  if (r.p14e_ativo === "Em converter — chegam mas não fecham")
    flags.push("Problema identificado: leads chegam mas não fecham — gargalo no atendimento/funil");
  if (r.p38 === "Não — trabalho sozinho" && r.p38a_solo === "Sim, claramente — não consigo atender tudo")
    flags.push("Solo sobrecarregado — operação depende 100% do dono, limita crescimento");
  if (r.p29 === "Mais de 2h")
    flags.push("Tempo de resposta alto (>2h) — leads possivelmente sendo perdidos para concorrência");
  if (r.p34 === "Não fazemos")
    flags.push("Sem follow-up estruturado com leads não convertidos — dinheiro deixado na mesa");
  if (r.p35 === "Nunca")
    flags.push("Sem reativação de pacientes inativos — canal de receita rápida inexplorado");
  if (r.p32 === "Menos de 20%" || r.p32 === "Não sei")
    flags.push("Taxa de conversão baixa ou desconhecida — processo de atendimento precisa ser estruturado");
  if (r.p44 === "Não acompanho")
    flags.push("Sem acompanhamento de métricas — decisões comerciais sem base de dados");
  if (r.p23 === "Principalmente avulsos" && r.p25 === "Não ofereço recorrência")
    flags.push("Receita 100% transacional — sem protocolos, pacotes ou recorrência");
  return flags;
}

function gerarDocumento(r: Respostas): string {
  const nomeClinica = r.p1 || "Minha Clínica";
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const flags = gerarFlags(r);

  const linha = (label: string, val: any) => {
    if (!val) return "";
    const v = Array.isArray(val) ? val.join(", ") : val;
    return `- ${label}: ${v}\n`;
  };

  let doc = `# Diagnóstico Estratégico — ${nomeClinica}\nData: ${data}\n\n`;

  doc += `## Perfil da Clínica\n`;
  doc += linha("Nome", r.p1);
  doc += linha("Especialidade", r.p2);
  doc += linha("Modelo de atendimento", r.p3);
  if (r.p3 && r.p3 !== "Somente particular") {
    doc += linha("Faturamento do convênio", r.p3a);
    doc += linha("Interesse em reduzir convênio", r.p3b);
    doc += linha("Carteira particular atual", r.p3c);
    doc += linha("Apresenta serviços particulares ao convênio", r.p3d);
    doc += linha("Ticket médio particular", r.p3e);
  }
  doc += linha("Tempo de mercado", r.p4);
  doc += linha("Cidade e estado", r.p5);
  doc += linha("Tipo de espaço", r.p6);
  doc += linha("Dias de atendimento por semana", r.p7);
  doc += linha("Volume médio mensal de atendimentos", r.p8);

  doc += `\n## Geração de Demanda e Aquisição\n`;
  doc += linha("Volume de demanda atual", r.p9);
  doc += linha("Base de pacientes", r.p10);
  if (r.p10 === "Sim, tenho base grande — mais de 100 pacientes") {
    doc += linha("Comunicação com a base", r.p10a);
    doc += linha("Acompanhamento de inativos", r.p10b);
  }
  doc += linha("Canais que geram leads", r.p11);
  doc += linha("Canal principal", r.p12);
  doc += linha("Dependência do canal principal", r.p13);
  doc += linha("Investimento em tráfego pago", r.p14);
  if (r.p14 === "Sim, de forma consistente") {
    doc += linha("Investimento mensal", r.p14a_ativo);
    doc += linha("Gestão dos anúncios", r.p14b_ativo);
    doc += linha("Rastreamento de leads", r.p14c_ativo);
    doc += linha("Satisfação com o retorno", r.p14d_ativo);
    doc += linha("Problema principal no tráfego", r.p14e_ativo);
  } else if (r.p14 === "Já investi mas parei") {
    doc += linha("Motivo para parar", r.p14a_parou);
    doc += linha("Pretende retomar", r.p14b_parou);
  } else if (r.p14 === "Nunca investi") {
    doc += linha("Motivo para não investir", r.p14a_nunca);
    doc += linha("Interesse em começar", r.p14b_nunca);
  }
  doc += linha("Perfil predominante dos pacientes", r.p15);
  doc += linha("Pacientes chegam decididos ou precisam ser convencidos", r.p16);
  doc += linha("Preço como principal objeção", r.p17);
  doc += linha("Receita de retorno e indicação", r.p18);
  if (r.p19) doc += `- Maior desafio na geração de demanda: ${r.p19}\n`;

  doc += `\n## Faturamento e Oferta\n`;
  doc += linha("Faturamento médio mensal", r.p20);
  doc += linha("Ticket médio por procedimento", r.p21);
  doc += linha("Procedimento que mais gera receita", r.p22);
  doc += linha("Modelo de venda", r.p23);
  doc += linha("Protocolos com nome e narrativa", r.p24);
  doc += linha("Recorrência", r.p25);
  doc += linha("Clareza sobre margem de lucro", r.p26);
  doc += linha("Maior custo operacional", r.p27);

  doc += `\n## Conversão e Atendimento\n`;
  doc += linha("Leads novos por mês", r.p28);
  doc += linha("Tempo de resposta ao lead", r.p29);
  doc += linha("Responsável pelo primeiro atendimento", r.p30);
  doc += linha("Processo de atendimento", r.p31);
  doc += linha("Taxa de conversão (lead → fechamento)", r.p32);
  doc += linha("Tempo médio para fechar", r.p33);
  doc += linha("Follow-up com leads não convertidos", r.p34);
  doc += linha("Reativação de inativos", r.p35);
  doc += linha("Tentativa anterior de estruturar atendimento", r.p36);
  if (r.p37) doc += `- Maior dificuldade no atendimento: ${r.p37}\n`;

  doc += `\n## Estrutura Operacional\n`;
  doc += linha("Equipe de atendimento", r.p38);
  if (r.p38 === "Sim, tenho equipe") {
    doc += linha("Equipe treinada para converter", r.p38a_equipe);
    doc += linha("Visibilidade sobre o atendimento da equipe", r.p38b_equipe);
    doc += linha("Oportunidades perdidas pela equipe", r.p38c_equipe);
  } else if (r.p38 === "Não — trabalho sozinho") {
    doc += linha("Solo limita crescimento", r.p38a_solo);
    doc += linha("Pretende contratar", r.p38b_solo);
  }
  doc += linha("Horas semanais em atividades comerciais", r.p39);
  doc += linha("Dependência do dono no comercial", r.p40);
  doc += linha("Histórico de equipe comercial", r.p41);
  doc += linha("Objetivo de autonomia operacional", r.p42);

  doc += `\n## Gestão e Processos\n`;
  doc += linha("Uso de CRM ou sistema", r.p43);
  doc += linha("Acompanhamento de métricas", r.p44);
  doc += linha("Processos documentados", r.p45);

  doc += `\n## Objetivos e Visão\n`;
  doc += linha("Meta de faturamento (3 meses)", r.p46);
  doc += linha("Principal área travada", r.p47);
  doc += linha("Situação atual de agenda e conversão", r.p48);
  if (r.p49) doc += `- O que já tentou que não funcionou: ${r.p49}\n`;
  if (r.p50) doc += `- Maior obstáculo para crescer: ${r.p50}\n`;
  if (r.p51) doc += `- Maior ambição nos próximos 12 meses: ${r.p51}\n`;

  if (flags.length > 0) {
    doc += `\n## Observações automáticas\n`;
    flags.forEach((f) => { doc += `- ${f}\n`; });
  }

  return doc;
}

// ── Componentes ───────────────────────────────────────────────────────────────

function OptionCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 rounded-xl border text-[14px] leading-snug transition-all duration-150",
        selected
          ? "border-foreground bg-foreground text-background font-medium"
          : "border-border/60 bg-white hover:border-foreground/40 hover:bg-muted/30 text-foreground/80"
      )}
    >
      <span className="flex items-center gap-3">
        <span className={cn(
          "shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
          selected ? "border-background bg-background" : "border-foreground/30"
        )}>
          {selected && <span className="w-2 h-2 rounded-full bg-foreground" />}
        </span>
        {label}
      </span>
    </button>
  );
}

function MultiOptionCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 rounded-xl border text-[14px] leading-snug transition-all duration-150",
        selected
          ? "border-foreground bg-foreground text-background font-medium"
          : "border-border/60 bg-white hover:border-foreground/40 hover:bg-muted/30 text-foreground/80"
      )}
    >
      <span className="flex items-center gap-3">
        <span className={cn(
          "shrink-0 w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all",
          selected ? "border-background bg-background" : "border-foreground/30"
        )}>
          {selected && <Check className="w-2.5 h-2.5 text-foreground" />}
        </span>
        {label}
      </span>
    </button>
  );
}

function PerguntaView({ pergunta, respostas, setResposta }: {
  pergunta: Pergunta;
  respostas: Respostas;
  setResposta: (key: string, val: any) => void;
}) {
  const valor = respostas[pergunta.id];
  const options = pergunta.dynamicOptions ? pergunta.dynamicOptions(respostas) : (pergunta.options ?? []);

  if (options.length === 0 && pergunta.type !== "text") return null;

  return (
    <div className="space-y-3">
      <p className="text-[15px] font-medium text-foreground/90 leading-snug">{pergunta.label}</p>

      {pergunta.type === "text" && (
        <textarea
          value={valor ?? ""}
          onChange={(e) => setResposta(pergunta.id, e.target.value)}
          placeholder={pergunta.placeholder}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border/60 bg-white text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
        />
      )}

      {pergunta.type === "single" && (
        <div className="space-y-2">
          {options.map((opt) => (
            <OptionCard
              key={opt}
              label={opt}
              selected={valor === opt}
              onClick={() => setResposta(pergunta.id, opt)}
            />
          ))}
        </div>
      )}

      {pergunta.type === "multi" && (
        <div className="space-y-2">
          {options.map((opt) => {
            const arr: string[] = Array.isArray(valor) ? valor : [];
            const sel = arr.includes(opt);
            return (
              <MultiOptionCard
                key={opt}
                label={opt}
                selected={sel}
                onClick={() => {
                  const next = sel ? arr.filter((x) => x !== opt) : [...arr, opt];
                  setResposta(pergunta.id, next);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tela de Loading (diagnóstico) ─────────────────────────────────────────────

function TelaLoading() {
  const msgs = [
    "Consolidando o seu diagnóstico...",
    "Organizando seus dados por área...",
    "Identificando os principais padrões...",
    "Gerando o documento estratégico...",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % msgs.length), 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-2 border-foreground/10" />
        <div className="absolute inset-0 rounded-full border-2 border-t-foreground animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-[16px] font-semibold text-foreground">{msgs[idx]}</p>
        <p className="text-[13px] text-muted-foreground">Estamos organizando tudo que você compartilhou.</p>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completeOnboarding, setConcluido } = usePlataforma();
  const {
    respostas, setResposta,
    blocoAtual, setBlocoAtual,
    etapa, loading, marcarIniciado,
    salvarDocumento, concluirDiagnostico,
  } = useOnboardingDiagnostico();

  // 0 = welcome, 1-7 = blocos, 8 = loading/gerando, 9 = Athos construindo, 10 = finalização
  const [tela, setTela] = useState<number>(0);
  const [transitioning, setTransitioning] = useState(false);

  // Estado da tela 9 — Athos streamando
  const [athosText, setAthosText] = useState("");
  const [athosStreaming, setAthosStreaming] = useState(false);
  const [athosErro, setAthosErro] = useState(false);
  const [athosPhase, setAthosPhase] = useState<"thinking" | "creating" | "summarizing">("thinking");
  const [athosElapsed, setAthosElapsed] = useState(0);
  const [jornada, setJornada] = useState<any | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const construcaoIniciadaRef = useRef(false);

  // Cronômetro — corre enquanto athosStreaming = true
  useEffect(() => {
    if (!athosStreaming) return;
    setAthosElapsed(0);
    const t = setInterval(() => setAthosElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [athosStreaming]);

  // Ao carregar, retomar de onde parou
  useEffect(() => {
    if (loading) return;
    if (etapa === "concluido") {
      navigate("/plataforma", { replace: true });
      return;
    }
    if (etapa === "athos") {
      // Athos foi REMOVIDO do onboarding. Usuários em estado legado 'athos' (ou reset)
      // recebem a jornada de onboarding PADRÃO (idempotente) e seguem para a plataforma —
      // nunca disparam o antigo fluxo de geração via Athos.
      (async () => {
        try { await supabase.functions.invoke("ensure-onboarding-jornada"); } catch (e) { console.error(e); }
        if (user) {
          await supabase.from("platform_users" as any)
            .update({ onboarding_concluido: true, onboarding_concluido_em: new Date().toISOString() })
            .eq("id", user.id);
        }
        setConcluido();
        navigate("/plataforma", { replace: true });
      })();
      return;
    }
    if (blocoAtual > 0) setTela(blocoAtual);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const irPara = useCallback((proxima: number) => {
    setTransitioning(true);
    setTimeout(() => {
      setTela(proxima);
      if (proxima > 0 && proxima <= 7) setBlocoAtual(proxima);
      setTransitioning(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 180);
  }, [setBlocoAtual]);

  // ── Construção automática da jornada pelo Athos (tela 9) ──────────────────

  const construirJornada = async () => {
    if (!user) return;
    setAthosStreaming(true);
    setAthosErro(false);
    setAthosText("");
    setAthosPhase("thinking");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const [{ data: agente }, { data: diagDoc }] = await Promise.all([
        (supabase as any)
          .from("athos_agentes")
          .select("system_prompt")
          .eq("slug", "onboarding")
          .eq("ativo", true)
          .maybeSingle(),
        (supabase as any)
          .from("meus_materiais")
          .select("conteudo")
          .eq("user_id", user.id)
          .eq("categoria", "diagnostico")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const systemPromptOverride =
        (agente?.system_prompt ?? "") +
        "\n\nINSTRUÇÃO OBRIGATÓRIA: Você TEM a ferramenta `criar_jornada` disponível. " +
        "Analise o diagnóstico do cliente e use a ferramenta `criar_jornada` para salvar a jornada personalizada. " +
        "Depois de criar a jornada, escreva um resumo curto e motivacional sobre o que foi criado para o cliente. " +
        "NÃO escreva JSON no texto — apenas use a ferramenta." +
        (diagDoc?.conteudo
          ? `\n\n---\n\nDIAGNÓSTICO DO CLIENTE:\n${diagDoc.conteudo}`
          : "");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/descompliquei-os`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: "Analise o diagnóstico e crie a jornada personalizada usando a ferramenta criar_jornada.",
          history: [],
          model: "qwen/qwen3.7-max",
          system_prompt_override: systemPromptOverride,
          tools_override: ["criar_jornada"],
        }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (!res.body) throw new Error("Stream vazio");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let jornadaCriada = false;

      while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw);

            if (ev.type === "tool_start" && ev.tool === "criar_jornada") {
              setAthosPhase("creating");
            }

            if (ev.type === "tool_result" && ev.tool === "criar_jornada") {
              const result = typeof ev.result === "string" ? JSON.parse(ev.result) : ev.result;
              if (result?.sucesso && result.jornada_id) {
                jornadaCriada = true;
                // Busca a jornada completa com passos para exibir na tela 10
                const { data: jornadaCompleta } = await (supabase as any)
                  .from("jornadas")
                  .select(`titulo, jornada_estagios(titulo, descricao, ordem, prazo_dias, jornada_passos(titulo, descricao, ordem))`)
                  .eq("id", result.jornada_id)
                  .maybeSingle();
                if (jornadaCompleta) {
                  const estagios = (jornadaCompleta.jornada_estagios ?? [])
                    .sort((a: any, b: any) => a.ordem - b.ordem)
                    .map((e: any) => ({
                      ...e,
                      passos: (e.jornada_passos ?? []).sort((a: any, b: any) => a.ordem - b.ordem),
                    }));
                  setJornada({ titulo: jornadaCompleta.titulo, estagios });
                } else {
                  setJornada({ titulo: result.titulo, estagios: result.estagios ?? [] });
                }
                setConcluido();
                setAthosPhase("summarizing");
              }
            }

            if (ev.type === "text_delta") {
              fullText += ev.delta;
              setAthosText(fullText);
            }

            if (ev.type === "done") {
              if (jornadaCriada) {
                setAthosStreaming(false);
                setTimeout(() => irPara(10), 800);
              } else {
                setAthosErro(true);
                setAthosStreaming(false);
              }
            }

            if (ev.type === "error") throw new Error(ev.message ?? "Erro no stream");
          } catch { /* ignora erros de parse de linha incompleta */ }
        }

        if (done) break;
      }
    } catch (err: any) {
      console.error("construirJornada error:", err);
      setAthosErro(true);
      setAthosStreaming(false);
    }
  };

  // Auto-inicia quando entra na tela 9
  useEffect(() => {
    if (tela !== 9 || construcaoIniciadaRef.current) return;
    construcaoIniciadaRef.current = true;
    construirJornada();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela]);

  // ── Finalização ────────────────────────────────────────────────────────────

  const finalizarOnboarding = async () => {
    setFinalizando(true);
    await completeOnboarding();
    navigate("/plataforma");
  };

  // ── Diagnóstico ────────────────────────────────────────────────────────────

  const iniciar = async () => {
    await marcarIniciado();
    irPara(1);
  };

  const avancar = () => {
    if (tela < 7) {
      irPara(tela + 1);
    } else {
      irPara(8);
      gerarENavegar();
    }
  };

  const voltar = () => {
    if (tela > 1) irPara(tela - 1);
    else if (tela === 1) irPara(0);
  };

  const gerarENavegar = async () => {
    await new Promise((r) => setTimeout(r, 3500));
    const markdown = gerarDocumento(respostas);
    const nomeClinica = respostas.p1 || "Minha Clínica";
    await salvarDocumento(markdown, nomeClinica);
    // concluirDiagnostico já cria a jornada de onboarding padrão e marca onboarding_concluido.
    // Sem passar pelo Athos: vai direto para a plataforma (o checklist "Configure sua plataforma" aparece).
    await concluirDiagnostico();
    setConcluido();
    navigate("/plataforma", { replace: true });
  };

  // ── Progresso ──────────────────────────────────────────────────────────────

  const totalBlocos = 7;
  const progresso = tela === 0 ? 0 : Math.round((tela / totalBlocos) * 100);
  const minutosRestantes = tela === 0
    ? TEMPO_TOTAL
    : TEMPO_POR_BLOCO.slice(tela - 1).reduce((a, b) => a + b, 0);

  if (loading) return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-t-foreground animate-spin" />
    </div>
  );

  const blocoAtivo = tela >= 1 && tela <= 7 ? BLOCOS[tela - 1] : null;

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50 overflow-hidden">

      {/* Keyframes para animação dos cards da jornada */}
      <style>{`
        @keyframes onb-slide-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .onb-stage-card {
          opacity: 0;
          animation: onb-slide-up 0.45s ease forwards;
        }
      `}</style>

      {/* Header */}
      <header className="shrink-0 h-14 flex items-center px-6 border-b border-border/30 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-bold text-[15px] text-foreground tracking-tight">Descompliquei</span>
        </div>
        {tela > 0 && tela <= 7 && (
          <div className="flex items-center gap-4 flex-1 justify-end md:justify-center">
            <div className="w-full max-w-xs h-1.5 rounded-full bg-border/30 overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-500"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] text-muted-foreground font-display tabular-nums">{progresso}%</span>
          </div>
        )}
        {tela > 0 && tela <= 7 && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground ml-4 hidden md:flex">
            <Clock className="h-3.5 w-3.5" />
            <span>~{minutosRestantes} min restantes</span>
          </div>
        )}
      </header>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto">
        <div className={cn(
          "transition-opacity duration-200 min-h-full",
          transitioning ? "opacity-0" : "opacity-100"
        )}>

          {/* Tela de boas-vindas */}
          {tela === 0 && (
            <div className="max-w-lg mx-auto px-6 py-16 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center mb-8">
                <span className="text-background text-[20px] font-bold">D</span>
              </div>
              <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight mb-4 font-display">
                Vamos construir a sua jornada.
              </h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed mb-3">
                Antes de tudo, precisamos entender a fundo a sua clínica. Responda com calma — quanto mais preciso você for, mais certeira será a sua jornada.
              </p>
              <p className="text-[13px] text-muted-foreground/70 mb-10">
                Tempo estimado: <strong>15–20 minutos</strong>
              </p>
              <button
                onClick={iniciar}
                className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                Começar diagnóstico
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Blocos de perguntas */}
          {tela >= 1 && tela <= 7 && blocoAtivo && (
            <div className="max-w-xl mx-auto px-5 py-10">
              <div className="mb-8">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                  Bloco {blocoAtivo.numero} de {totalBlocos}
                </p>
                <h2 className="text-[22px] font-bold text-foreground leading-snug font-display">
                  {blocoAtivo.titulo}
                </h2>
              </div>

              <div className="space-y-8">
                {blocoAtivo.perguntas.map((p) => {
                  if (p.visibleIf && !p.visibleIf(respostas)) return null;
                  return (
                    <PerguntaView
                      key={p.id}
                      pergunta={p}
                      respostas={respostas}
                      setResposta={setResposta}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/30">
                <button
                  onClick={voltar}
                  className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>
                <button
                  onClick={avancar}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
                >
                  {tela === 7 ? "Concluir diagnóstico" : "Continuar"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-center text-[11px] text-muted-foreground/40 mt-4">
                Nenhuma resposta é obrigatória — avance quando quiser.
              </p>
            </div>
          )}

          {/* Tela 8 — loading/geração do diagnóstico */}
          {tela === 8 && <TelaLoading />}

          {/* Tela 9 — Athos construindo a jornada */}
          {tela === 9 && (
            <div className="max-w-2xl mx-auto px-5 py-12">
              {/* Header de status */}
              <div className="flex flex-col items-center text-center mb-10">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500",
                  athosStreaming ? "bg-foreground" : athosErro ? "bg-red-100" : "bg-emerald-100"
                )}>
                  {athosStreaming
                    ? <Sparkles className="h-7 w-7 text-background animate-pulse" />
                    : athosErro
                    ? <span className="text-red-500 text-xl font-bold">!</span>
                    : <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
                </div>
                <h2 className="text-[22px] font-bold text-foreground tracking-tight font-display">
                  {athosStreaming
                    ? athosPhase === "thinking"
                      ? "Analisando seu diagnóstico..."
                      : athosPhase === "creating"
                      ? "Criando sua jornada..."
                      : "Finalizando..."
                    : athosErro
                    ? "Algo deu errado"
                    : "Jornada criada!"}
                </h2>
                <p className="text-[13px] text-muted-foreground mt-2 max-w-sm leading-relaxed">
                  {athosStreaming
                    ? athosPhase === "thinking"
                      ? "O Athos está lendo e interpretando seu diagnóstico para montar o plano ideal."
                      : athosPhase === "creating"
                      ? "Salvando os estágios e passos da sua jornada personalizada."
                      : "Preparando o resumo da sua jornada."
                    : athosErro
                    ? "Não conseguimos gerar sua jornada. Tente novamente."
                    : "Sua jornada personalizada está pronta. Redirecionando..."}
                </p>

                {/* Indicador de fases + cronômetro */}
                {(athosStreaming || athosErro) && (
                  <div className="w-full max-w-sm mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        {(["thinking", "creating", "summarizing"] as const).map((phase, i) => (
                          <div key={phase} className="flex items-center gap-1.5">
                            <div className={cn(
                              "w-2 h-2 rounded-full transition-all duration-300",
                              athosPhase === phase
                                ? "bg-foreground scale-125"
                                : (["thinking", "creating", "summarizing"].indexOf(athosPhase) > i)
                                ? "bg-foreground/40"
                                : "bg-border"
                            )} />
                            <span className={cn(
                              "text-[10px] font-medium transition-colors",
                              athosPhase === phase ? "text-foreground" : "text-muted-foreground/50"
                            )}>
                              {phase === "thinking" ? "Analisando" : phase === "creating" ? "Criando" : "Resumo"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground/60 tabular-nums font-display">
                        {athosElapsed}s
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground transition-all duration-700 ease-out"
                        style={{ width: athosErro ? "0%"
                          : athosPhase === "thinking" ? `${Math.min(30, athosElapsed * 3)}%`
                          : athosPhase === "creating" ? "60%"
                          : "90%"
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Texto do resumo (aparece na fase summarizing) */}
              {athosText && (
                <div className={cn(
                  "rounded-2xl border p-5 max-h-72 overflow-y-auto transition-all",
                  athosStreaming ? "border-border/40 bg-muted/[0.03]" : athosErro ? "border-red-200/50 bg-red-50/20" : "border-emerald-200/50 bg-emerald-50/30"
                )}>
                  <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {athosText}
                    {athosStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-foreground/50 ml-0.5 align-middle animate-pulse" />
                    )}
                  </p>
                </div>
              )}

              {/* Erro — botão de retry */}
              {athosErro && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => {
                      construcaoIniciadaRef.current = false;
                      setAthosErro(false);
                      setAthosText("");
                      setAthosPhase("thinking");
                      construirJornada();
                    }}
                    className="h-9 px-5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tela 10 — Finalização com cards da jornada */}
          {tela === 10 && jornada && (
            <div className="max-w-2xl mx-auto px-5 py-12">
              {/* Header */}
              <div className="text-center mb-10">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
                  Sua jornada personalizada
                </p>
                <h2 className="text-[26px] font-bold text-foreground tracking-tight leading-tight font-display">
                  {jornada.titulo}
                </h2>
                <p className="text-[13px] text-muted-foreground mt-2">
                  {jornada.estagios?.length} etapas · Criada pelo Athos com base no seu diagnóstico
                </p>
              </div>

              {/* Cards das etapas */}
              <div className="space-y-3">
                {jornada.estagios?.map((est: any, i: number) => (
                  <div
                    key={i}
                    className="onb-stage-card rounded-2xl border border-border/60 bg-card p-5"
                    style={{ animationDelay: `${i * 110}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[12px] font-bold text-foreground">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-foreground font-display">{est.titulo}</p>
                        {est.descricao && (
                          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{est.descricao}</p>
                        )}
                        {est.passos?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {est.passos.slice(0, 3).map((p: any, j: number) => (
                              <span key={j} className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full border border-border/40">
                                {p.titulo}
                              </span>
                            ))}
                            {est.passos.length > 3 && (
                              <span className="text-[10px] text-muted-foreground/50 py-0.5">
                                +{est.passos.length - 3} mais
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {est.prazo_dias && (
                        <div className="shrink-0 text-[10px] font-medium font-display tabular-nums text-muted-foreground/50 bg-muted/40 px-2 py-1 rounded-lg whitespace-nowrap">
                          {est.prazo_dias} dias
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-10 pt-6 border-t border-border/30 flex justify-end">
                <button
                  onClick={finalizarOnboarding}
                  disabled={finalizando}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60"
                >
                  {finalizando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {finalizando ? "Entrando na plataforma..." : "Começar minha jornada"}
                  {!finalizando && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
