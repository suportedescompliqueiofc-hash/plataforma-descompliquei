// Tutorial content definitions for each CRM page
// Each tutorial has steps that reference DOM elements via data-tutorial attribute

export interface TutorialStepAction {
  /** Type of action to perform before showing this step */
  type: 'click' | 'dismiss';
  /** CSS selector for the element to interact with. Prefix with `tutorial:` to use data-tutorial attribute. Not needed for 'dismiss'. */
  selector?: string;
  /** Optional delay in ms after executing the action (default: 400) */
  delay?: number;
}

export interface TutorialStep {
  target: string; // data-tutorial="value" selector
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional action to execute before showing this step (e.g., click a tab, expand a panel) */
  action?: TutorialStepAction;
}

export interface Tutorial {
  id: string;
  pageRoute: string; // route prefix to match
  title: string;
  description: string;
  icon: string; // lucide icon name
  steps: TutorialStep[];
  category: 'geral' | 'comercial' | 'automacao' | 'sistema';
}

export const tutorials: Tutorial[] = [
  // ═══════════════════════════════════════════════════════════════
  // GERAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'welcome',
    pageRoute: '/crm',
    title: 'Bem-vindo ao CRM',
    description: 'Um tour completo por todas as páginas da plataforma. Entenda a estrutura, o propósito de cada seção e como tudo se conecta na sua operação comercial.',
    icon: 'Sparkles',
    category: 'geral',
    steps: [
      // ── Introdução e Navegação ──
      {
        target: 'sidebar',
        title: 'Seu centro de comando',
        description: 'Este é o **menu principal** do seu CRM. Ele está organizado em **4 seções**:\n\n• **Visão Geral** — painel, conversas e alertas\n• **Comercial** — leads, agendamentos, vendas e metas\n• **Automação** — mensagens rápidas, cadências e IA\n• **Sistema** — configurações da plataforma\n\nVamos passar por **cada uma** agora.',
        position: 'right',
      },

      // ── VISÃO GERAL ──
      {
        target: 'sidebar-painel',
        title: 'Painel de Controle',
        description: 'Sua **primeira tela** ao abrir o CRM. Aqui você vê os números que importam:\n\n• Quantos leads chegaram\n• Quantos foram qualificados\n• Agendamentos e fechamentos\n• Faturamento do período\n\nTudo filtrado por **período** e **origem**. É o termômetro da sua operação.',
        position: 'right',
      },
      {
        target: 'sidebar-conversas',
        title: 'Conversas — o coração do CRM',
        description: 'Aqui é onde o **atendimento acontece**. Todas as mensagens do WhatsApp chegam em tempo real.\n\n• Responda com texto, áudios, imagens e documentos\n• Cada conversa está **vinculada a um lead** — tudo que você faz aqui atualiza o perfil dele\n• Qualifique e agende **sem sair da tela**',
        position: 'right',
      },
      {
        target: 'sidebar-notificacoes',
        title: 'Notificações',
        description: 'Nunca perca uma ação importante. As notificações avisam sobre:\n\n• **Novos leads** que chegaram\n• **Mensagens não lidas** há muito tempo\n• **Agendamentos** próximos\n• **Handoff da IA** — quando ela passa o atendimento para você\n\nÉ seu **assistente de alertas** em tempo real.',
        position: 'right',
      },

      // ── COMERCIAL ──
      {
        target: 'sidebar-leads',
        title: 'Leads — sua base de contatos',
        description: 'Todos os contatos que já entraram em contato estão aqui, em **formato de tabela**.\n\n• Busque por **nome ou telefone**\n• Filtre por **origem** (marketing, orgânico, importado)\n• Filtre por **etiquetas**\n• Clique em qualquer lead para ver os **detalhes completos**\n\nÉ a visão mais completa da sua base.',
        position: 'right',
      },
      {
        target: 'sidebar-agendamentos',
        title: 'Agendamentos — sua agenda',
        description: 'Controle todos os agendamentos da clínica:\n\n• **Tipos:** consulta, avaliação, procedimento ou retorno\n• **Visualização:** calendário mensal, semanal ou diário\n• **Status:** confirmado, realizado, não compareceu ou cancelado\n\nAtualize o status de cada consulta — isso alimenta automaticamente suas **métricas de comparecimento** no painel.',
        position: 'right',
      },
      {
        target: 'sidebar-vendas',
        title: 'Vendas — seus fechamentos',
        description: 'Toda vez que um paciente fechar um procedimento, **registre aqui**.\n\n• Informe o **valor**, o **procedimento** e a **data**\n• O lead é marcado como **"Fechado"** automaticamente\n• O faturamento aparece no **Painel de Controle**\n\n**Importante:** sem registro de venda, suas métricas de fechamento e faturamento ficam incompletas.',
        position: 'right',
      },
      {
        target: 'sidebar-procedimentos',
        title: 'Procedimentos — seu catálogo',
        description: 'Cadastre todos os procedimentos que sua clínica oferece:\n\n• **Nome, categoria e valor base** de cada procedimento\n• **Métricas automáticas** — quantos fechamentos e quanto faturou\n• **Ativar/desativar** procedimentos conforme a disponibilidade\n\n**Dica:** use o mesmo nome do procedimento nas vendas para que o sistema calcule as métricas corretamente.',
        position: 'right',
      },
      {
        target: 'sidebar-metas',
        title: 'Metas — seus objetivos',
        description: 'Defina metas claras e **acompanhe o progresso** em tempo real:\n\n• **Meta de leads** — quantos contatos captar\n• **Meta de agendamentos** — quantas consultas marcar\n• **Meta de vendas** — quantos fechamentos realizar\n• **Meta de receita** — quanto faturar\n\nSem metas, não tem como saber se a operação está performando bem. **O que não se mede, não se melhora.**',
        position: 'right',
      },

      // ── AUTOMAÇÃO ──
      {
        target: 'sidebar-cadences',
        title: 'Cadências — automação',
        description: 'Uma cadência é uma **sequência automática** de mensagens em intervalos que você define.\n\n**Exemplo prático:**\n• Lead não respondeu em **2h** → envia mensagem 1\n• Ainda sem resposta em **24h** → envia mensagem 2\n• Sem resposta em **3 dias** → envia último follow-up\n\nIdeal para **reativação de leads inativos** e follow-up automático.',
        position: 'right',
      },
      {
        target: 'sidebar-ia',
        title: 'IA de Pré-atendimento',
        description: 'Sua assistente virtual atende **24h por dia**, automaticamente:\n\n• **Responde perguntas** sobre procedimentos, preços e localização\n• **Qualifica o interesse** do paciente\n• **Passa o atendimento** para você quando o lead quer agendar\n\nQuanto mais completo o prompt, **melhor ela atende**. Configure na página de IA.',
        position: 'right',
      },

      // ── SISTEMA ──
      {
        target: 'sidebar-settings',
        title: 'Configurações',
        description: 'Personalize o CRM para o fluxo da sua clínica:\n\n• **Etiquetas** — categorias coloridas para leads (VIP, Indicação, etc.)\n• **Fontes** — de onde vêm seus leads\n• **WhatsApp** — conexão do número\n• **Aparência** — logo, cores e branding\n• **Equipe** — convide colaboradores e acompanhe performance\n\nAdapte tudo ao seu jeito de trabalhar.',
        position: 'right',
      },

      // ── Conclusão ──
      {
        target: 'sidebar',
        title: 'Pronto para começar!',
        description: 'Agora você conhece **todas as seções** do CRM. Sugestão de por onde começar:\n\n• **Conversas** — atenda seus pacientes\n• **Vendas** — registre quando fechar\n• **Painel** — acompanhe os números\n\nPara se aprofundar em cada página, acesse os **tutoriais específicos** na Central de Tutoriais. Bons resultados!',
        position: 'right',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // PAINEL (Dashboard)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'dashboard',
    pageRoute: '/crm',
    title: 'Painel de Controle',
    description: 'Aprenda a analisar cada métrica do painel e tome decisões baseadas em dados reais da sua clínica.',
    icon: 'LayoutDashboard',
    category: 'geral',
    steps: [
      // ── Filtros ──
      {
        target: 'dashboard-period',
        title: 'Filtros: origem e período',
        description: 'Antes de analisar qualquer métrica, **defina o recorte**.\n\n**Filtro de Origem** — 5 opções:\n• **Geral** — todos os leads juntos (visão completa)\n• **Marketing** — apenas leads de anúncios pagos\n• **Orgânico** — indicações, Instagram, busca espontânea\n• **Reativação** — leads inativos reativados por cadências\n• **Paciente** — pacientes já atendidos que voltaram\n\n**Filtro de Período** — dia, semana, mês, ano ou intervalo personalizado usando as setas e botões no canto superior direito.\n\nTodos os números do painel mudam conforme esses filtros — são a **base de toda a análise**.',
        position: 'bottom',
      },

      // ── Métricas Hero ──
      {
        target: 'dashboard-metrics',
        title: 'Métricas principais',
        description: 'A faixa de KPIs mostra os **4 números mais importantes** do período:\n\n• **Total de Leads** — todos os contatos que chegaram (clique para ver a lista)\n• **Faturamento** — soma de todas as vendas registradas no período\n• **Taxa de Conversão** — % de leads que fecharam (Vendas ÷ Total de Leads)\n• **Vendas** — quantidade de fechamentos registrados\n\n**Dica:** clique em qualquer card para ver a **lista nominal** dos leads daquele grupo.\n\n**Regra:** se o Faturamento está zerado com leads chegando, verifique se as Vendas estão sendo registradas na página de Vendas.',
        position: 'bottom',
      },
      {
        target: 'dashboard-metrics',
        title: 'Como interpretar os KPIs',
        description: 'Leitura rápida da saúde da operação:\n\n• **Leads altos + Faturamento zero** → vendas não estão sendo registradas, ou os leads não estão convertendo\n• **Taxa de Conversão baixa** → gargalo no funil — veja o Funil de Conversão logo abaixo\n• **Vendas crescendo** mas **Taxa de Conversão estável** → volume maior, proporção igual — bom sinal\n• **Faturamento caiu** mas **Vendas igual** → ticket médio caindo. Revise os valores registrados.\n\nEstes 4 indicadores juntos dão a **leitura em segundos** do mês.',
        position: 'bottom',
      },

      // ── Origem dos Leads ──
      {
        target: 'dashboard-origem',
        title: 'Origem dos Leads',
        description: 'Este card mostra a **distribuição dos leads por canal de aquisição** no período selecionado:\n\n• **Marketing** — leads vindos de anúncios pagos (amarelo)\n• **Orgânico** — indicações, Instagram, busca espontânea (verde)\n• **Reativação** — leads inativos reativados por cadências (azul)\n\nClique em qualquer canal para ver a **lista nominal** dos leads daquela origem.\n\n**Como usar:** se Marketing está muito acima de Orgânico, você depende muito de tráfego pago. Trabalhe o orgânico para ter uma base mais equilibrada e resiliente.',
        position: 'bottom',
      },

      // ── Meta Widget ──
      {
        target: 'dashboard-meta',
        title: 'Acompanhamento de Metas',
        description: 'Mostra o progresso das suas **metas mensais** em 4 frentes:\n\n• **Receita** — faturamento vs. objetivo\n• **Leads** — captação vs. objetivo\n• **Agendamentos** — consultas marcadas vs. objetivo\n• **Fechamentos** — vendas realizadas vs. objetivo\n\nAs **cores** indicam urgência: 🔴 abaixo de 30% · 🟡 30-60% · 🔵 60-100% · 🟢 meta batida.',
        position: 'bottom',
      },
      {
        target: 'dashboard-meta',
        title: 'Ritmo diário — seu termômetro',
        description: 'Na parte inferior das metas, fique atento a 3 indicadores:\n\n• **Leads Hoje** — quanto captou hoje (🟢 = no ritmo, 🔴 = abaixo)\n• **Leads Semana** — acumulado semanal vs. meta\n• **Pace** — quantos leads/dia você precisa para bater a meta no fim do mês\n\n**Rotina:** cheque o Pace toda manhã. Se está no vermelho, é hora de agir — aumentar investimento, ajustar criativo ou reativar leads inativos.',
        position: 'bottom',
      },

      // ── Performance Comercial ──
      {
        target: 'dashboard-performance',
        title: 'Performance Comercial',
        description: 'Três taxas que medem a **eficiência do seu funil comercial**:\n\n• **Taxa de Qualificação** — % dos leads totais que foram qualificados (Qualificados ÷ Total de Leads)\n• **Taxa de Agendamento** — % dos qualificados que agendaram consulta (Agendados ÷ Qualificados)\n• **Taxa de Fechamento** — % dos agendados que fecharam procedimento (Fechados ÷ Agendados)\n\nClique em qualquer card para ver a **lista nominal** dos leads daquele grupo.',
        position: 'top',
      },
      {
        target: 'dashboard-performance',
        title: 'Benchmarks de referência',
        description: 'Use esses números como norte:\n\n• **Taxa Qualificação > 30%** — tráfego está atraindo o público certo\n• **Taxa Agendamento > 40%** dos qualificados — boa conversão para consulta\n• **Taxa Fechamento > 50%** dos agendados — operação comercial saudável\n\n**Como agir quando uma taxa cai:**\n• Qualificação caiu → revise o ICP do criativo\n• Agendamento caiu → revise o follow-up e cadências\n• Fechamento caiu → revise o script de vendas da consulta\n\nDados sem ação são só números.',
        position: 'top',
      },

      // ── Comparecimentos ──
      {
        target: 'dashboard-comparecimentos',
        title: 'Comparecimentos & No-Show',
        description: 'Esta seção mostra a **taxa de presença nas consultas agendadas** no período:\n\n• **Total Agendado** — todos os agendamentos criados\n• **Compareceram** — pacientes que foram atendidos\n• **No-Show** — pacientes que faltaram sem avisar\n• **Cancelados** — desmarcados com aviso\n• **Taxa de Comparecimento** — % que compareceu (meta: acima de 80%)\n• **Taxa de No-Show** — % de faltas\n\nClique em qualquer card para ver **quem são os leads** daquela categoria.\n\n**Ação direta:** taxa de no-show acima de 20%? Ative lembretes automáticos em **Agendamentos > Config. Notificações**.',
        position: 'top',
      },

      // ── Tempo de Resposta ──
      {
        target: 'dashboard-tempo-resposta',
        title: 'Tempo de Resposta Humano',
        description: 'Três métricas que medem a **velocidade do atendimento humano**:\n\n• **Tempo de Primeira Resposta** — média de quanto o humano demora para responder após o lead enviar mensagem\n• **Duração do Atendimento** — tempo médio da primeira à última mensagem\n• **Sem Resposta em 24h** — % de conversas que ficaram sem resposta por mais de 24h (clique para ver a lista)\n\n**Benchmarks:**\n• Primeira resposta < 5min → excelente\n• Sem resposta > 30% → urgente — leads estão esfriando sem atendimento\n\n**Dica:** clique em **"Ver por horário"** para descobrir em quais horas do dia seu time demora mais para responder.',
        position: 'top',
      },

      // ── Top Procedimentos ──
      {
        target: 'dashboard-top-procedimentos',
        title: 'Top Procedimentos',
        description: 'Ranking dos **procedimentos mais solicitados** pelos leads no período.\n\nCada barra mostra:\n• **Nome** do procedimento\n• **Quantidade** de leads interessados\n• **Barra proporcional** ao procedimento mais pedido\n\nClique em qualquer linha para ver **quais leads** demonstraram interesse naquele procedimento.\n\n**Como usar estrategicamente:**\n• Os procedimentos do topo devem ter **maior investimento em tráfego**\n• Se um procedimento rentável está no fundo, revise o criativo ou o ICP\n• Identifique **oportunidades de upsell** — leads de um procedimento costumam ter interesse em procedimentos complementares',
        position: 'right',
      },

      // ── Gráfico ──
      {
        target: 'dashboard-chart',
        title: 'Evolução no Tempo',
        description: 'Gráfico com a dinâmica diária do período:\n\n• **Captados** — leads que chegaram naquele dia\n\nClique em qualquer barra para ver **quais leads** foram captados naquele dia.\n\nPerguntas úteis ao analisar:\n• Quais dias da semana captam mais?\n• Existe pico após lançar campanha?\n• O volume está crescendo ou caindo?',
        position: 'top',
      },
      {
        target: 'dashboard-chart',
        title: 'Leitura avançada',
        description: 'Padrões que revelam problemas:\n\n• **Laranja alto, verde baixo** — capta mas não converte. Problema no atendimento, follow-up ou vendas.\n• **Ambos baixos** — problema de captação. Revise investimento ou criativo.\n• **Picos isolados** — campanhas pontuais sem consistência. Foque em fluxo contínuo.\n• **Verde crescendo mais que laranja** — conversão melhorando. Ótimo sinal.\n\nO ideal: **tendência crescente** em ambas as barras. Consistência supera picos isolados.',
        position: 'top',
      },

      // ── Conclusão ──
      {
        target: 'dashboard-period',
        title: 'Sua rotina de análise',
        description: 'Monte uma rotina para tirar o máximo do Painel:\n\n• **Toda manhã** — cheque o Pace de leads e a taxa "Sem Resposta em 24h"\n• **Toda segunda** — compare a semana anterior, revise Comparecimentos e No-Show\n• **Todo dia 1º** — analise o mês fechado: Funil, Performance, Top Procedimentos e defina metas\n\n**Sinais de alerta que exigem ação imediata:**\n• Taxa sem resposta > 30% → revisar cobertura da equipe\n• No-Show > 20% → ativar lembretes automáticos\n• Funil travado entre etapas → identificar gargalo e agir\n\nO Painel mostra a **realidade** — use os tutoriais específicos para dominar cada seção.',
        position: 'bottom',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CONVERSAS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'conversas',
    pageRoute: '/crm/conversas',
    title: 'Conversas',
    description: 'Domine o atendimento via WhatsApp. Aprenda cada botão, cada ação e como usar a tela de conversas no dia a dia.',
    icon: 'MessageSquare',
    category: 'geral',
    steps: [
      // ── 1. Lista ──
      {
        target: 'conversations-list',
        title: 'Sidebar de conversas',
        description: 'O painel esquerdo é o **centro de controle** dos atendimentos em tempo real.\n\nCada item da lista mostra:\n• **Avatar** com iniciais do lead\n• **Nome** e prévia da **última mensagem**\n• **Horário** da última interação\n• **Ícone de origem** — identifica de onde o lead veio\n• **Contador azul** de mensagens não lidas\n\nA lista atualiza em **tempo real** via WebSocket — novas mensagens do lead sobem automaticamente para o topo sem precisar recarregar a página.',
        position: 'right',
      },

      // ── 2. Cabeçalho ──
      {
        target: 'conversations-header',
        title: 'Cabeçalho e ações rápidas',
        description: 'O cabeçalho tem 3 elementos:\n\n• **"Conversas + número"** — contador dinâmico: mostra quantas conversas estão visíveis com os filtros aplicados\n• **Ícone de pessoa +** — cria um novo lead diretamente aqui, sem precisar ir para a página de Leads\n• **Menu ⋮** — acesso ao **modo de seleção múltipla**:\n  - *Selecionar Conversas* — ativa checkboxes em cada item\n  - *Selecionar Tudo* — marca todas de uma vez\n  - *Cancelar Seleção* — aparece quando em modo seleção\n\nNo modo de seleção, o painel direito exibe **6 ações em massa**: Alterar Etapa, Adicionar Etiqueta, Iniciar Cadência, Configurar IA, Alterar Origem e Excluir.',
        position: 'right',
      },

      // ── 3. Busca ──
      {
        target: 'conversations-search',
        title: 'Busca inteligente (deep search)',
        description: 'A busca vai muito além do nome — ela vasculha **3 fontes ao mesmo tempo**:\n\n• **Nome** do lead — correspondência parcial\n• **Telefone** — qualquer trecho do número\n• **Conteúdo das mensagens** — busca dentro do histórico completo de todas as conversas\n\nA busca por conteúdo de mensagem ativa com **3+ caracteres** e usa um ícone de carregamento enquanto pesquisa.\n\n**Exemplo:** digitou "resultado"? O sistema encontra todo lead que usou essa palavra em qualquer momento — mesmo que a última mensagem seja "ok, obrigado". Poderoso para rastrear contextos específicos.',
        position: 'right',
      },

      // ── 4. Abre painel de filtros ──
      {
        target: 'conversations-filter',
        title: 'Filtros do sidebar',
        description: 'O ícone de funil abre o **painel de filtros avançados** das conversas.\n\nQuando há filtros ativos, o ícone fica **destacado em azul** para lembrar que você está vendo apenas um subconjunto da lista.\n\nVamos abrir o painel e explorar cada filtro.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="conversations-filter"]', delay: 500 },
      },

      // ── 5. Painel de filtros — todos os 4 detalhados ──
      {
        target: 'conversations-filter-panel',
        title: 'Painel de filtros — 4 dimensões',
        description: 'O painel oferece **4 filtros** que podem ser combinados:\n\n• **Origem** — segmente por canal de aquisição:\n  - Marketing (anúncios pagos)\n  - Orgânico (indicação, busca, redes sociais)\n  - Reativação (retorno após inatividade)\n  - Paciente (já é cliente)\n\n• **IA** — filtre conversas com IA ativa ou sem IA\n\n• **Etiquetas** — filtre por tags personalizadas (VIP, Retorno, Urgente...)\n\n• **Período** — intervalo de datas para isolar leads de um período\n\n**"Limpar tudo"** remove todos os filtros de uma vez. Combine filtros para análises precisas — ex: "Marketing + Etiqueta VIP" = leads pagos de alta prioridade.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="conversations-filter"]', delay: 500 },
      },

      // ── 6. Card de conversa — anatomia ──
      {
        target: 'conversation-first-item',
        title: 'Anatomia de um card',
        description: 'Cada item da lista mostra:\n\n• **Avatar** com iniciais do lead\n• **Nome** (ou telefone se sem nome) e **ícone de origem**\n• **Horário** da última mensagem\n• **Prévia** — "Você:" = equipe enviou / sem prefixo = lead enviou\n• **Contador azul** de mensagens não lidas\n\nClique no card para abrir o atendimento completo no painel direito.\n\nAo **passar o mouse** sobre o card, aparece um **ícone ⋮** no canto direito — são as ações rápidas. Vamos ver o que ele oferece.',
        position: 'right',
        action: { type: 'dismiss', delay: 300 },
      },

      // ── 7. Menu ⋮ do card — ações rápidas ──
      {
        target: 'conversations-item-menu',
        title: 'Menu ⋮ — 8 ações rápidas',
        description: 'Sem abrir a conversa, você acessa **7 ações instantâneas** no menu que acabou de abrir:\n\n• **Editar Nome** — renomeia o lead na lista\n• **Adicionar Etiqueta** — aplica ou remove tags\n• **Iniciar Cadência** — dispara fluxo automático para este lead\n• **Configurar IA** — ativa ou desativa a IA para esta conversa\n• **Alterar Origem** — corrige o canal (Marketing/Orgânico/Reativação/Paciente)\n• **Desconsiderar das métricas** — exclui do Painel (leads teste, spam)\n• **Excluir Conversa** — remove lead e histórico permanentemente\n\n**Dica:** use "Adicionar Etiqueta" e "Iniciar Cadência" aqui para organizar sua lista rapidamente sem abrir cada atendimento.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="conversations-item-menu-btn"]', delay: 600 },
      },

      // ── 8. Botão ⋮ do cabeçalho — intro ──
      {
        target: 'conversations-menu-btn',
        title: 'Menu de seleção múltipla',
        description: 'Este botão **⋮** no cabeçalho dá acesso ao modo de seleção em massa — útil para aplicar uma ação a várias conversas de uma vez.\n\nVamos abrir o menu para ver as opções disponíveis.',
        position: 'bottom',
        action: { type: 'dismiss', delay: 300 },
      },

      // ── 9. Abre o dropdown do cabeçalho ──
      {
        target: 'conversations-header-menu',
        title: 'Opções de seleção em massa',
        description: 'Ao clicar no ⋮, aparecem **3 opções**:\n\n• **Selecionar Conversas** — ativa checkboxes em cada item. Clique individualmente para marcar ou desmarcar cada conversa.\n• **Selecionar Tudo** — marca de uma vez **todas** as conversas visíveis (respeitando os filtros ativos).\n• **Cancelar Seleção** — aparece quando já está no modo seleção.\n\nCom conversas selecionadas, o painel direito exibe **5 ações em massa**:\n\n• **Adicionar Etiqueta** — aplica a mesma tag em todos\n• **Iniciar Cadência** — dispara fluxo automático de mensagens para o grupo\n• **Configurar IA** — ativa ou desativa a IA em lote\n• **Alterar Origem** — corrige o canal de aquisição de vários leads\n• **Excluir Leads** (vermelho) — remove permanentemente\n\n**Cenário prático:** filtro "Marketing" → Selecionar Tudo → Adicionar Etiqueta "Novo" → toda a fila categorizada em segundos.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="conversations-menu-btn"]', delay: 600 },
      },

      // ── 10. Entra em modo de seleção ──
      {
        target: 'conversations-list',
        title: 'Modo seleção ativado',
        description: 'Ao clicar em **"Selecionar Conversas"**, a lista entra no modo de seleção — cada item agora exibe um **checkbox** no lado esquerdo.\n\nVocê pode:\n• Clicar em conversas individualmente para marcar\n• Usar "Selecionar Tudo" no menu ⋮ para marcar todas de uma vez\n\nVamos selecionar a **primeira conversa** como exemplo.',
        position: 'right',
        action: { type: 'click', selector: '[data-tutorial="conversations-select-mode-direct"]', delay: 500 },
      },

      // ── 11. Clica no primeiro lead para selecionar ──
      {
        target: 'conversation-first-item',
        title: 'Selecionando um lead',
        description: 'Clique em qualquer conversa para **marcar o checkbox**. O item selecionado fica destacado e o contador no painel direito atualiza.\n\nCom um ou mais leads selecionados, o painel direito exibe as **6 ações em massa** disponíveis. Veja a seguir.',
        position: 'right',
        action: { type: 'click', selector: '[data-tutorial="conversations-select-first-direct"]', delay: 600 },
      },

      // ── 12. Painel de ações em massa ──
      {
        target: 'conversations-bulk-panel',
        title: 'Painel de ações em massa',
        description: 'Com conversas selecionadas, este painel aparece no lado direito com **5 ações**:\n\n• **Adicionar Etiqueta** — aplica a mesma tag em todos\n• **Iniciar Cadência** — dispara fluxo automático de mensagens para o grupo\n• **Configurar IA** — ativa ou desativa a IA em lote\n• **Alterar Origem** — corrige o canal de aquisição de vários leads\n• **Excluir Leads** (vermelho) — remove todos permanentemente — use com cuidado!\n\n**Cenário real:** filtre por "Marketing" → Selecionar Tudo → Adicionar Etiqueta → toda a fila categorizada em segundos.',
        position: 'left',
      },

      // ── 13. Cancela seleção ──
      {
        target: 'conversations-list',
        title: 'Saindo do modo seleção',
        description: 'Clique em **"Cancelar seleção"** (abaixo das ações em massa) ou use o menu ⋮ do cabeçalho para sair do modo de seleção e voltar à lista normal.\n\nAgora vamos abrir uma conversa e explorar o **painel de atendimento** completo.',
        position: 'right',
        action: { type: 'click', selector: '[data-tutorial="conversations-cancel-selection-direct"]', delay: 400 },
      },

      // ── 14. Abre primeira conversa ──
      {
        target: 'conversation-lead-info',
        title: 'Informações do lead',
        description: 'Nome e dados do lead abertos no momento.\n\n• **Nome** — clique no lápis para editar\n• **Telefone** do contato\n• **Badge de origem** — "Mkt" (marketing pago) ou "Org" (orgânico)\n• **Criativo** — se veio de anúncio, mostra qual gerou o lead\n\nUse essas informações para **contextualizar** o atendimento antes de responder.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="conversation-first-item"] a', delay: 800 },
      },

      // ── 3. Resumo IA ──
      {
        target: 'conversation-resumo-ia',
        title: 'Resumo da conversa (IA)',
        description: 'Botão que gera um **resumo automático** da conversa usando IA.\n\n**Quando usar:**\n• Retomando um atendimento antigo sem querer reler tudo\n• Passando a conversa para um colega\n• Relembrar o que foi combinado\n\nO resumo é gerado na hora e cobre os pontos principais da troca de mensagens.',
        position: 'bottom',
      },

      // ── 4. PDF ──
      {
        target: 'conversation-pdf',
        title: 'Exportar em PDF',
        description: 'Exporta a conversa como arquivo **PDF** para download.\n\n**Quando usar:** registrar atendimentos para prontuário, guardar evidências ou compartilhar histórico com terceiros.',
        position: 'bottom',
      },

      // ── 5. IA Toggle ──
      {
        target: 'conversation-ia-toggle',
        title: 'Toggle da IA',
        description: 'Liga ou desliga a IA **nesta conversa específica**.\n\n• **Ligado** → IA responde automaticamente ao lead\n• **Desligado** → apenas humanos respondem\n\n**Quando desligar:**\n• Você assumiu o atendimento manualmente\n• Lead pediu para falar com uma pessoa\n• Conversa sensível que exige toque humano\n\n**Atenção:** enviar uma mensagem manualmente desliga a IA automaticamente nesta conversa.',
        position: 'bottom',
      },

      // ── 6. MQL ──
      {
        target: 'conversation-mql',
        title: 'Qualificado',
        description: 'Um lead **Qualificado** tem interesse real no seu serviço.\n\n• Clique para marcar como qualificado (botão fica preenchido)\n• Clique novamente para desmarcar\n\n**Quando marcar:** lead demonstrou intenção real — perguntou sobre procedimento, quer agendar, pediu orçamento.\n\n**Quando NÃO marcar:** curiosos, mensagens erradas, spam, fornecedores.\n\n**Impacto direto:** Taxa de Qualificação = Qualificados ÷ Total de Leads. Marcar errado = métricas falsas.',
        position: 'bottom',
      },

      // ── 8. Agendado ──
      {
        target: 'conversation-schedule',
        title: 'Agendar consulta',
        description: 'Clique para registrar que este lead tem uma **consulta agendada**.\n\n• Abre o modal de agendamento\n• Preencha tipo (consulta, avaliação, procedimento, retorno), data e horário\n• O agendamento aparece automaticamente no **calendário de Agendamentos**\n\n**Se já agendado:** a data aparece abaixo do botão — clique para editar.\n\n**Impacto:** alimenta a Taxa de Agendamento no Painel.',
        position: 'bottom',
      },

      // ── 9. Fechado ──
      {
        target: 'conversation-closed',
        title: 'Marcar como Fechado',
        description: 'Clique quando o lead **confirmar a venda** de um procedimento.\n\n**Após marcar:** vá à página de **Vendas** e registre o valor e procedimento. Sem esse registro:\n• Faturamento não aparece no Painel\n• Taxa de Fechamento fica incorreta\n• Ticket Médio não é calculado\n\n**Regra:** marcar Fechado + registrar a Venda são dois passos que andam juntos.',
        position: 'bottom',
      },

      // ── 10. Tags rápidas ──
      {
        target: 'conversation-tags-quick',
        title: 'Etiquetas',
        description: 'Atribua **etiquetas** ao lead sem sair da conversa.\n\nClique para ver as tags disponíveis e selecione uma ou mais. As etiquetas:\n• Aparecem na lista de leads\n• Permitem filtragem rápida na página de Leads\n• Ajudam a segmentar para cadências e follow-up\n\n**Exemplos:** "VIP", "Indicação", "Retorno", "Pós-consulta".\n\nCrie e edite as etiquetas em **Configurações > Etiquetas**.',
        position: 'bottom',
      },

      // ── 11b. Materiais ──
      {
        target: 'conversation-materiais',
        title: 'Materiais',
        description: 'Abre o painel lateral com os **materiais comerciais** criados pelo Athos (scripts de atendimento, quebra de objeção, ofertas e mais).\n\n• Busque pelo título ou filtre por categoria\n• Clique num material pra expandir e ler o conteúdo\n• Use **Copiar texto** pra se basear na conversa\n\nDiferente das Mensagens Rápidas, aqui nada é enviado direto — é conteúdo de consulta.',
        position: 'left',
      },

      // ── 12. Desconsiderar métricas ──
      {
        target: 'conversation-exclude-metrics',
        title: 'Desconsiderar das Métricas',
        description: '**Um dos botões mais importantes.** Remove este lead de todos os cálculos do Painel.\n\n**O que excluir:**\n• Spam e robôs\n• "Número errado, desculpa"\n• Fornecedores e representantes\n• Amigos e familiares\n• Duplicatas do mesmo paciente\n\nQuando ativo, o ícone fica **amarelo**.\n\n**Por que importa:** 25 leads inválidos em 100 inflam os números. Com limpeza: Taxa de Qualificação de 30% vira 40% real.',
        position: 'left',
      },

      // ── 13. Notas ──
      {
        target: 'conversation-notas',
        title: 'Notas internas',
        description: 'Anotações **internas da equipe** — o lead nunca vê.\n\n• Use para registrar preferências, combinados, detalhes do procedimento\n• Qualquer membro da equipe pode ler\n• Ficam salvas permanentemente no perfil do lead\n\n**Dica:** anote o que foi combinado em cada atendimento. Quando retomar a conversa dias depois, você terá o contexto completo.',
        position: 'left',
      },

      // ── 13b. Resumo da IA ──
      {
        target: 'conversation-resumo-ia',
        title: 'Resumo da IA',
        description: 'Mostra o que o **Athos** já entendeu sobre este lead, direto na conversa — sem precisar abrir a ficha completa.\n\n• Resumo da conversa, procedimento de interesse, objetivo e principal objeção\n• Atualizado automaticamente pouco depois de cada troca de mensagens\n\n**Dica:** consulte antes de responder — é o jeito mais rápido de retomar o contexto sem reler tudo.',
        position: 'left',
      },

      // ── 14. Bloquear ──
      {
        target: 'conversation-blacklist',
        title: 'Bloquear número',
        description: 'Bloqueia **permanentemente** o número de telefone.\n\nApós bloqueado, este número não poderá mais enviar mensagens para seu WhatsApp pelo CRM.\n\n**Use apenas para:** spam persistente ou conteúdo inadequado.\n\n**Atenção:** o bloqueio é **irreversível**. Nunca bloqueie leads reais — use "Desconsiderar das Métricas" para contatos inválidos.',
        position: 'left',
      },

      // ── 15. Compositor ──
      {
        target: 'conversation-composer',
        title: 'Barra de envio',
        description: 'A barra de envio de mensagens na parte inferior:\n\n• **Emoji** — seletor de emojis\n• **Clipe** — anexe PDF, fotos ou vídeos\n• **Campo de texto** — digite a mensagem\n• **Microfone** — aparece quando o campo está vazio, para gravar áudio\n• **Seta de envio** — aparece quando há texto digitado\n\n**Dica:** passe o mouse sobre uma mensagem e clique em "Responder" para citar uma mensagem específica.',
        position: 'top',
      },

      // ── 16. Conclusão ──
      {
        target: 'conversations-list',
        title: 'Rotina diária nas Conversas',
        description: '**4 ações que fazem a diferença todos os dias:**\n\n• **1. Desconsiderar** — exclua spam e inválidos das métricas (2 min)\n• **2. Qualificar** — marque quem tem interesse real\n• **3. Agendar** — registre quando o lead marcar consulta\n• **4. Fechar + Registrar venda** — complete os dois passos ao fechar\n\nEssa rotina garante que o Painel reflita a **realidade** da operação.',
        position: 'right',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICAÇÕES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'notificacoes',
    pageRoute: '/crm/notificacoes',
    title: 'Notificações',
    description: 'Nunca perca um alerta importante. Aprenda a gerenciar suas notificações e manter a operação sob controle.',
    icon: 'Bell',
    category: 'geral',
    steps: [
      {
        target: 'notificacoes-tabs',
        title: 'Abas: Pendentes e Resolvidas',
        description: 'As notificações são separadas em **duas abas**:\n\n• **Pendentes** — alertas que ainda precisam da sua atenção. O número ao lado mostra quantos existem.\n• **Resolvidas** — alertas que você já tratou.\n\n**Rotina:** sempre comece pelas **pendentes**. O objetivo é zerar essa fila todos os dias.',
        position: 'bottom',
      },
      {
        target: 'notificacoes-filters',
        title: 'Filtros de período e lead',
        description: 'Refine quais notificações você quer ver:\n\n• **Período** — selecione o intervalo de datas (padrão: mês atual)\n• **Lead** — filtre notificações de um lead específico\n\n**Dica:** se quer ver só os alertas de hoje, ajuste o período para o dia atual. Isso ajuda a focar no que é urgente.',
        position: 'bottom',
      },
      {
        target: 'notificacoes-card',
        title: 'Card de notificação',
        description: 'Cada notificação mostra:\n\n• **Ícone** — tipo do alerta (sino = geral, formulário = Meta Lead Ads)\n• **Mensagem** — o que aconteceu (ex: "lead solicitou agendamento")\n• **Lead** — nome e telefone do contato envolvido\n• **Tempo** — há quanto tempo o alerta foi gerado\n\n**Badge "Meta Lead Ads":** aparece quando o lead veio de um formulário de anúncio do Meta (Facebook/Instagram). Esses leads precisam de **resposta rápida** — quanto antes, maior a conversão.',
        position: 'bottom',
      },
      {
        target: 'notificacoes-card',
        title: 'Tipos de notificação',
        description: 'Você receberá alertas quando:\n\n• **Novo lead** chega via WhatsApp ou formulário\n• **Handoff da IA** — a IA passou o atendimento para você\n• **Lead sem resposta** — ficou sem retorno por muito tempo\n• **Cadência disparada** — uma mensagem automática foi enviada\n• **Meta Lead Ads** — formulário preenchido no anúncio\n\nCada tipo exige uma **ação diferente**. O mais urgente é sempre o handoff da IA — o lead está esperando.',
        position: 'bottom',
      },
      {
        target: 'notificacoes-resolver',
        title: 'Botão Resolver',
        description: 'Passe o mouse sobre o card e clique no **ícone de check verde** para marcar como resolvido.\n\n**Quando resolver:**\n• Você já respondeu o lead\n• Já agendou a consulta\n• Já tomou a ação necessária\n\nA notificação vai para a aba **"Resolvidas"**. Seu objetivo é manter a fila de pendentes **sempre vazia** — assim você nunca perde um atendimento.',
        position: 'left',
      },
      {
        target: 'notificacoes-list',
        title: 'Ir para a conversa',
        description: 'Ao passar o mouse, aparece um **ícone de link** nos cards de Meta Lead Ads. Clique para ir direto para a **conversa do lead**.\n\n**Fluxo ideal:**\n• Recebeu notificação → clique para abrir a conversa\n• Atenda o lead → marque como qualificado se tiver interesse real\n• Volte e resolva a notificação\n\nIsso garante que **nenhum lead** fique sem atendimento.',
        position: 'top',
      },
      {
        target: 'notificacoes-limpar',
        title: 'Limpar notificações resolvidas',
        description: 'Na aba **Resolvidas**, use o botão **"Limpar Resolvidas"** para apagar permanentemente as notificações já tratadas.\n\n**Quando usar:** semanalmente ou mensalmente para manter a lista organizada.\n\n**Sua rotina diária:**\n• Abrir Notificações toda manhã\n• Resolver cada pendente (atender, agendar, responder)\n• Manter a fila de pendentes **zerada**\n\nNotificações ignoradas = leads perdidos = dinheiro na mesa.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="notificacoes-tabs"] button:nth-child(2)' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ATUALIZAÇÕES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'atualizacoes',
    pageRoute: '/crm/atualizacoes',
    title: 'Atualizações',
    description: 'Acompanhe tudo o que muda na plataforma — novidades, melhorias e correções — direto na sua sidebar.',
    icon: 'Megaphone',
    category: 'geral',
    steps: [
      {
        target: 'sidebar-atualizacoes',
        title: 'Novidades da plataforma',
        description: 'Sempre que a plataforma ganhar uma novidade, uma **melhoria** ou uma **correção**, ela aparece aqui.\n\nUm ponto vermelho no menu indica que existem atualizações que você **ainda não viu**.',
        position: 'right',
      },
      {
        target: 'atualizacoes-tabs',
        title: 'Filtre por tipo',
        description: 'Use as abas pra ver só o que interessa:\n\n• **Novidade** — recursos novos\n• **Melhoria** — algo que já existia ficou melhor\n• **Correção** — um problema foi resolvido',
        position: 'bottom',
      },
      {
        target: 'atualizacoes-list',
        title: 'Ver agora',
        description: 'Quando uma atualização tiver um botão **"Ver agora"**, clique nele — você será levado direto pro lugar da plataforma onde a novidade está, pra já testar.',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // LEADS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'leads',
    pageRoute: '/crm/leads',
    title: 'Gestão de Leads',
    description: 'Organize e gerencie todos os seus contatos em um só lugar. Aprenda a buscar, filtrar, importar e gerenciar seus leads com eficiência.',
    icon: 'Users',
    category: 'comercial',
    steps: [
      {
        target: 'leads-actions',
        title: 'Barra de ações',
        description: 'Esta é a barra principal de ações da página de leads:\n\n• **Adicionar Lead** — crie um novo contato manualmente (nome, telefone, origem)\n• **Importar** — importe uma lista de contatos via planilha CSV\n\n**Dica:** leads criados manualmente entram como **"orgânico"**. Use a importação apenas para listas externas — eles são marcados como **"importado"** para não misturar com leads reais nas métricas.',
        position: 'bottom',
      },
      {
        target: 'leads-add',
        title: 'Adicionar Lead manualmente',
        description: 'Este botão abre o formulário para cadastrar um lead que chegou por **fora do WhatsApp** — indicação, telefone, presencial, etc.\n\nVamos percorrer **cada campo** do formulário.',
        position: 'bottom',
      },
      {
        target: 'lead-field-nome',
        title: 'Campo: Nome',
        description: 'Digite o **nome completo** do lead.\n\nEste é o nome que aparecerá em:\n• Lista de leads\n• Conversas do WhatsApp\n• Agendamentos e vendas\n\n**Dica:** use o nome como o lead se apresentou. Se disse "Dr. Silva", registre assim.',
        position: 'right',
        action: { type: 'click', selector: 'tutorial:leads-add', delay: 500 },
      },
      {
        target: 'lead-field-telefone',
        title: 'Campo: Telefone',
        description: 'Informe o **telefone com DDD** do lead.\n\n• Formato: (11) 99999-9999\n• O campo formata automaticamente\n• **Obrigatório** para envio de WhatsApp\n\n**Importante:** sem telefone válido, você não conseguirá enviar mensagens pelo CRM. Confira se o número está correto antes de salvar.',
        position: 'right',
      },
      {
        target: 'lead-field-origem',
        title: 'Campo: Origem',
        description: 'Selecione **de onde veio** este lead:\n\n• **Marketing** — veio de anúncio pago (Meta Ads, Google, etc.)\n• **Orgânico** — veio espontaneamente (indicação, busca, redes sociais)\n\n**Por que importa:** a origem define se o lead entra nos cálculos de **CPL, Custo por Qualificado e ROAS**. Leads orgânicos não contam para métricas de marketing.',
        position: 'right',
      },
      {
        target: 'lead-field-data',
        title: 'Campo: Data de Cadastro',
        description: 'Define quando o lead foi registrado.\n\n• Por padrão usa a **data atual**\n• Ajuste se estiver cadastrando um lead de um dia anterior\n\n**Por que importa:** a data de cadastro determina em qual período este lead aparece no Painel de Controle e nas métricas. Um lead na data errada distorce os relatórios.',
        position: 'right',
      },
      {
        target: 'lead-submit',
        title: 'Salvar lead',
        description: 'Clique em **"Criar Lead"** para salvar o contato.\n\n**O que acontece:**\n• O lead aparece na tabela de leads\n• Fica disponível para envio de mensagens WhatsApp\n• Conta nas métricas do Painel de Controle\n\nApós criar, você pode abrir a conversa clicando no lead e enviando a primeira mensagem.',
        position: 'top',
      },
      {
        target: 'leads-import',
        action: { type: 'dismiss', delay: 300 },
        title: 'Importar contatos em massa',
        description: 'Importe uma lista de contatos de uma **planilha CSV**.\n\n**Como funciona:**\n• Faça upload do arquivo .csv\n• Mapeie as colunas (nome, telefone, etc.)\n• Os contatos são criados automaticamente\n\n**Importante:** leads importados recebem a origem **"importado"** automaticamente. Isso evita que contaminem suas métricas de marketing e orgânico.\n\n**Quando usar:** migração de outro CRM, lista de pacientes antigos, ou contatos de eventos.',
        position: 'bottom',
      },
      {
        target: 'leads-search',
        title: 'Busca rápida',
        description: 'Digite o **nome** ou **telefone** de qualquer lead para encontrá-lo instantaneamente.\n\nA busca é em tempo real — conforme você digita, a tabela já filtra os resultados.\n\n**Dica:** se não encontrar o lead, verifique se os filtros avançados estão ativos (eles podem estar escondendo resultados).',
        position: 'bottom',
      },
      {
        target: 'leads-filters-advanced',
        title: 'Filtros avançados',
        description: 'Clique no botão **"Filtros"** para expandir o painel de filtros com opções detalhadas:\n\n• **Origem** — Marketing ou Orgânico\n• **Fonte** — canal específico (Instagram, Google, Indicação...)\n• **Etiqueta** — filtre por tags personalizadas\n• **Responsável** — leads atribuídos a um membro específico\n\n**Uso estratégico:** combine filtros para análises precisas. Ex: "Marketing + últimos 30 dias" → quem precisa de follow-up.',
        position: 'bottom',
        action: { type: 'click', selector: 'tutorial:leads-filters-advanced', delay: 400 },
      },
      {
        target: 'leads-origin-filter',
        title: 'Filtro por Origem',
        description: 'Dentro do painel de filtros, o campo **Origem** permite segmentar por canal:\n\n• **Todas as origens** — sem filtro\n• **Marketing** — apenas leads de anúncios pagos (Meta Ads, Google...)\n• **Orgânico** — leads espontâneos (indicação, redes sociais, busca)\n\n**Por que importa:** isolar leads de marketing mostra a performance real das campanhas. Leads orgânicos têm custo zero e costumam ter maior intenção de compra.',
        position: 'right',
      },
      {
        target: 'leads-tags-filter',
        title: 'Filtro por Etiqueta',
        description: 'O campo **Etiqueta** filtra leads marcados com uma tag específica.\n\n• Selecione qualquer etiqueta criada em **Configurações > Etiquetas**\n• Combine com outros filtros para análises cirúrgicas\n\n**Exemplo:** "Marketing + etiqueta VIP" → leads pagos de alta prioridade que merecem atenção imediata.',
        position: 'right',
      },
      {
        target: 'leads-table',
        title: 'Tabela de leads',
        description: 'A tabela central mostra **todos os seus leads** com informações essenciais:\n\n• **Nome e telefone** — dados de contato\n• **Origem** — badge colorido (Mkt = marketing, Org = orgânico, Imp = importado)\n• **Etiquetas** — tags coloridas para categorização\n• **Responsável** — atendente vinculado ao lead\n• **Data** — quando o lead foi cadastrado\n\n**Clique em qualquer lead** para abrir o modal completo com todos os detalhes, histórico e opções de edição.',
        position: 'top',
      },
      {
        target: 'leads-row-actions',
        title: 'Ações por lead',
        description: 'O menu de **três pontos** em cada linha oferece ações rápidas:\n\n• **Editar** — abrir o modal do lead para alterar dados\n• **Ir para Conversa** — abre direto a conversa no WhatsApp\n• **Excluir** — remove o lead permanentemente\n\n**Atalho:** clicar no nome do lead também abre o modal de detalhes.',
        position: 'left',
      },
      {
        target: 'leads-table',
        title: 'Seleção e ações em massa',
        description: 'Use os **checkboxes** à esquerda de cada lead para selecionar múltiplos contatos de uma vez.\n\n**Ações em massa disponíveis:**\n• **Adicionar etiquetas** — categorize vários leads simultaneamente\n• **Excluir selecionados** — remova leads em lote\n\n**Dica:** use o checkbox do cabeçalho para selecionar **todos os leads visíveis** na página atual. Combine com filtros para ações precisas.',
        position: 'top',
      },
      {
        target: 'leads-bulk-bar',
        title: 'Barra de ações em massa',
        description: 'Ao selecionar leads, esta **barra flutuante** aparece na parte inferior da tela com as ações disponíveis:\n\n• **Etiquetas** — adicionar ou remover tags em todos os selecionados de uma vez\n• **Excluir** — remover vários leads simultaneamente\n\nA barra mostra o **número de leads selecionados** e desaparece automaticamente ao desmarcar a seleção.',
        position: 'top',
      },
      {
        target: 'leads-pagination',
        title: 'Paginação',
        description: 'Navegue entre as páginas de resultados:\n\n• **Setas** — primeira, anterior, próxima, última página\n• **Contador** — mostra quantos leads estão sendo exibidos\n• **Por página** — escolha entre 25, 50 ou 100 leads por página\n\n**Dica:** aumente para 100 por página quando precisar fazer seleção em massa com mais leads visíveis.',
        position: 'top',
      },
      {
        target: 'leads-table',
        title: 'Rotina de gestão de leads',
        description: '**Sua rotina ideal com leads:**\n\n• **Diário** — verifique novos leads, classifique por origem e etiquetas\n• **Semanal** — revise leads parados no pipeline, atualize etapas\n• **Mensal** — limpe leads frios, analise métricas por origem\n\n**Regra de ouro:** lead sem etiqueta = lead perdido. Sempre categorize seus contatos para manter a organização e métricas precisas.\n\nA página de Leads é seu **centro de comando** — aqui você tem visão completa de todos os contatos do CRM.',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // AGENDAMENTOS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'agendamentos',
    pageRoute: '/crm/agendamentos',
    title: 'Agendamentos',
    description: 'Controle completo da sua agenda. Gerencie consultas, acompanhe taxas de comparecimento e nunca perca um compromisso.',
    icon: 'CalendarDays',
    category: 'comercial',
    steps: [
      {
        target: 'agendamentos-header',
        title: 'Central de agendamentos',
        description: 'Esta é a **central da sua agenda**. Aqui você controla todas as consultas, avaliações e procedimentos agendados.\n\nO cabeçalho mostra o **total de agendamentos** no período selecionado, dando uma visão rápida da movimentação da clínica.\n\n**Importância:** a taxa de agendamento é uma das métricas mais importantes do CRM — ela conecta o trabalho comercial (leads) ao faturamento (vendas).',
        position: 'bottom',
      },
      {
        target: 'agendamentos-new',
        title: 'Novo agendamento',
        description: 'Este botão abre o formulário para criar um novo agendamento. Vamos percorrer **cada campo** do formulário para que você saiba exatamente como preencher.',
        position: 'bottom',
      },
      {
        target: 'agendamento-field-lead',
        title: 'Campo: Lead',
        description: 'Selecione o **lead** que será atendido.\n\n**Como usar:**\n• Clique no campo e digite o nome\n• A busca filtra automaticamente pelos seus leads cadastrados\n• Selecione o contato correto\n\n**Dica:** se o lead não aparece, verifique se ele está cadastrado na página de Leads.',
        position: 'right',
        action: { type: 'click', selector: 'tutorial:agendamentos-new', delay: 500 },
      },
      {
        target: 'agendamento-field-titulo',
        title: 'Campo: Título',
        description: 'Dê um **título** para identificar o agendamento no calendário.\n\nExemplos:\n• "Avaliação — Harmonização"\n• "Retorno pós-procedimento"\n• "Consulta inicial"\n\nO título aparece diretamente no calendário, então seja objetivo.',
        position: 'right',
      },
      {
        target: 'agendamento-field-tipo',
        title: 'Campo: Tipo de atendimento',
        description: 'Selecione o **tipo** do atendimento:\n\n• **Consulta** — primeiro contato, avaliação inicial\n• **Avaliação** — análise detalhada para proposta\n• **Procedimento** — execução do serviço vendido\n• **Retorno** — acompanhamento pós-procedimento\n\nO tipo ajuda nas **métricas de distribuição** — assim você sabe quantas consultas, procedimentos e retornos tem por mês.',
        position: 'right',
      },
      {
        target: 'agendamento-field-duracao',
        title: 'Campo: Duração',
        description: 'Escolha a **duração estimada** clicando em um dos botões rápidos:\n\n• **30min** — consultas rápidas\n• **45min** — avaliações\n• **1h** — procedimentos simples\n• **1h30** — procedimentos médios\n• **2h** — procedimentos longos\n\nA duração define o tamanho do bloco no calendário. Isso evita sobreposição de horários.',
        position: 'right',
      },
      {
        target: 'agendamento-field-procedimento',
        title: 'Campo: Procedimento',
        description: 'Vincule o agendamento ao seu **catálogo de procedimentos**. O comportamento muda conforme o tipo:\n\n• Em **Procedimento**, é o serviço que será executado — preenche valor e duração automaticamente a partir do catálogo.\n• Em **Consulta** ou **Avaliação**, é o **procedimento de interesse**: o que a paciente pretende fazer. Não mexe no valor da consulta.\n\n**Por que importa:** é este vínculo que alimenta a projeção de faturamento. Sem ele, o agendamento não entra na conta de quanto ainda há para faturar no mês.',
        position: 'right',
      },
      {
        target: 'agendamento-field-data',
        title: 'Campo: Data e Hora',
        description: 'Selecione a **data e horário** do atendimento.\n\n• Use o seletor de data e hora\n• Confirme que não há conflito com outros agendamentos\n\n**Dica:** no calendário, você também pode criar agendamentos **clicando diretamente em um horário** — a data e hora já vêm preenchidas.',
        position: 'right',
      },
      {
        target: 'agendamento-field-obs',
        title: 'Campo: Observações',
        description: 'Adicione **anotações importantes** sobre este agendamento:\n\n• Necessidades especiais do paciente\n• Detalhes do procedimento a ser realizado\n• Informações para a equipe de recepção\n• Lembretes de preparo ou contraindicações\n\n**Exemplos:** "Paciente com alergia a látex", "Confirmar presença 2h antes", "Vem acompanhada".\n\nEssas observações aparecem ao abrir o agendamento no calendário.',
        position: 'right',
      },
      {
        target: 'agendamento-submit',
        title: 'Criar agendamento',
        description: 'Clique em **"Criar Agendamento"** para salvar.\n\n**O que acontece automaticamente:**\n• O evento aparece no calendário\n• O lead é marcado como **agendado** e qualificado\n• Os cards de status são atualizados\n• Se ativo, um lembrete via WhatsApp é enviado ao paciente\n\nApós criar, você pode clicar no evento no calendário para ver detalhes, editar ou cancelar.',
        position: 'top',
      },
      {
        target: 'agendamentos-config',
        action: { type: 'dismiss', delay: 300 },
        title: 'Configurar notificações',
        description: 'Configure **lembretes automáticos** para seus agendamentos:\n\n• Defina quando enviar o lembrete (ex: 1h antes, 1 dia antes)\n• Personalize a mensagem do lembrete\n• Ative ou desative por tipo de atendimento\n\n**Por que usar:** lembretes automáticos reduzem drasticamente a taxa de **no-show** (não comparecimento). Um simples lembrete pode aumentar a presença em **30% ou mais**.',
        position: 'bottom',
      },
      {
        target: 'agendamentos-filters',
        title: 'Filtro de período',
        description: 'Selecione o **intervalo de datas** para visualizar agendamentos de um período específico.\n\n• **Padrão:** mês atual\n• **Dica:** selecione "esta semana" para focar nos próximos dias\n\nO filtro afeta tanto o calendário quanto os cards de status e as métricas.',
        position: 'bottom',
      },
      {
        target: 'agendamentos-status',
        title: 'Cards de status',
        description: 'Quatro cards mostram o **resumo do período selecionado**:\n\n• **Agendados** (azul) — total de consultas marcadas\n• **Realizados** (verde) — pacientes que compareceram\n• **No-show** (vermelho) — pacientes que faltaram sem avisar\n• **Comparecimento** (roxo) — percentual de presença (Realizados ÷ Agendados)\n\n**Métrica-chave:** taxa de comparecimento acima de **80%** é saudável. Abaixo disso, ative lembretes automáticos em **"Notificações"** para reduzir faltas.',
        position: 'bottom',
      },
      {
        target: 'agendamentos-tabs',
        title: 'Abas de visualização',
        description: 'Três formas de visualizar seus agendamentos:\n\n• **Calendário** — visão visual de mês/semana/dia\n• **Lista** — tabela ordenável com todos os detalhes\n• **Métricas** — gráficos de comparecimento e distribuição\n\n**Quando usar cada uma:**\n• Calendário → gestão diária, ver a agenda do dia/semana\n• Lista → buscar agendamento específico, editar em lote\n• Métricas → análise mensal, identificar padrões de no-show',
        position: 'bottom',
      },
      {
        target: 'agendamentos-calendar',
        title: 'Calendário interativo',
        description: 'O calendário é totalmente **interativo**:\n\n• **Navegue** entre meses, semanas ou dias usando os botões no topo\n• **Alterne a visão** — Mês, Semana ou Dia para o nível de detalhe que precisar\n• **Clique em uma data** → cria um novo agendamento naquele dia\n• **Clique em um evento** → abre os detalhes do agendamento\n• **Arraste um evento** → reagende para outro dia/horário\n\nCada evento mostra o **tipo** (ícone colorido) e o **nome do lead** para identificação rápida.',
        position: 'top',
      },
      {
        target: 'agendamentos-upcoming',
        title: 'Próximos agendamentos',
        description: 'Na lateral direita, uma lista dos **próximos agendamentos** ordenados por data.\n\nIsso te dá uma visão rápida de **quem vem a seguir** sem precisar navegar no calendário.\n\n**Rotina ideal:**\n• Todo início de turno, confira esta lista\n• Confirme presença dos pacientes do dia\n• Prepare-se para os atendimentos seguintes',
        position: 'left',
      },
      {
        target: 'agendamentos-tabs',
        title: 'Visão em Lista',
        description: 'A aba **Lista** mostra todos os agendamentos em formato de **tabela ordenável**.\n\n**Vantagens sobre o calendário:**\n• Mais fácil de buscar um agendamento específico\n• Ordenar por data, lead ou status\n• Visão mais compacta quando há muitos agendamentos\n\n**Quando usar:** buscar um agendamento antigo, conferir detalhes de vários pacientes rapidamente, ou exportar dados.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="agendamentos-tabs"] button:nth-child(2)' },
      },
      {
        target: 'agendamentos-metrics',
        title: 'Métricas de comparecimento',
        description: 'A aba **Métricas** traz gráficos e análises da sua agenda:\n\n• **Taxa de Comparecimento** — porcentagem de pacientes que vieram (meta: acima de 80%)\n• **Taxa de No-Show** — porcentagem de faltas\n• **Gráfico mensal** — tendência de comparecimento nos últimos 6 meses\n• **Distribuição por tipo** — quais tipos de atendimento são mais frequentes\n\n**Análise:** se o no-show está alto, ative lembretes automáticos em **Config. Notificações**.',
        position: 'top',
        action: { type: 'click', selector: '[data-tutorial="agendamentos-tabs"] button:nth-child(3)' },
      },
      {
        target: 'agendamentos-projecao',
        title: 'Receita na mesa',
        description: 'Quanto ainda dá para faturar com os agendamentos **que ainda vão acontecer** neste mês.\n\n• **Projeção — procedimentos** — o que está agendado para ser executado\n• **Projeção — consultas** — o potencial das consultas com procedimento de interesse\n\n**Leia como projeção, não como receita garantida.** Os valores já vêm descontados pelas suas taxas reais de comparecimento e conversão dos últimos 180 dias. O "teto" ao lado mostra o valor cheio, se tudo acontecesse.\n\n**Dica:** quanto mais agendamentos com procedimento vinculado, mais fiel fica a projeção.',
        position: 'bottom',
      },
      {
        target: 'agendamentos-status',
        title: 'Atualizando status',
        description: 'Após cada consulta, **atualize o status** clicando no agendamento:\n\n• **Realizado** — paciente compareceu e foi atendido\n• **Não compareceu** — no-show (paciente faltou)\n• **Cancelado** — cancelamento prévio\n\n**Por que é crucial:** cada atualização alimenta suas métricas de:\n• Taxa de comparecimento\n• Taxa de no-show\n• Gráfico de tendência mensal\n\nSem essa atualização, seus dados ficam incorretos e você perde visibilidade sobre a operação.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="agendamentos-tabs"] button:nth-child(1)' },
      },
      {
        target: 'agendamentos-calendar',
        title: 'Rotina de agendamentos',
        description: '**Sua rotina diária:**\n\n• **Manhã** — abra o calendário na visão "Dia", confirme presença dos pacientes\n• **Entre consultas** — atualize o status de cada atendimento realizado\n• **Final do dia** — marque no-shows e verifique a agenda de amanhã\n\n**Semanalmente:**\n• Confira as Métricas para ver tendências de comparecimento\n• Identifique dias/horários com mais no-show\n• Ajuste lembretes automáticos se necessário\n\nAgendamentos bem gerenciados = **faturamento previsível**.',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // VENDAS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'vendas',
    pageRoute: '/crm/vendas',
    title: 'Vendas',
    description: 'Registre e acompanhe todos os fechamentos da sua clínica. Controle faturamento, ticket médio e performance comercial.',
    icon: 'ShoppingCart',
    category: 'comercial',
    steps: [
      {
        target: 'vendas-header',
        title: 'Central de vendas',
        description: 'Esta é a página onde você registra **todos os fechamentos** da sua clínica.\n\nCada venda registrada aqui:\n• Alimenta suas métricas de **faturamento**\n• Atualiza o **Painel de Controle**\n• Calcula seu **ticket médio**\n• Conecta o lead ao resultado financeiro\n\n**Importância:** sem vendas registradas, o CRM não consegue calcular métricas como ROAS, CPA e taxa de fechamento.',
        position: 'bottom',
      },
      {
        target: 'vendas-metrics',
        title: 'Métricas de vendas',
        description: 'Quatro cards mostram o **resumo financeiro** do período:\n\n• **Faturamento** — valor total de vendas (soma de todos os fechamentos)\n• **Ticket Médio** — valor médio por venda (faturamento ÷ quantidade)\n• **Vendas** — quantidade de fechamentos no período\n• **Maior Venda** — o maior valor individual registrado\n\n**Análise:** o Ticket Médio é uma métrica essencial. Se está caindo, pode indicar que você está fechando procedimentos de menor valor. Se está subindo, sua equipe está vendendo melhor.',
        position: 'bottom',
      },
      {
        target: 'vendas-new',
        title: 'Registrar nova venda',
        description: 'Este é o botão para registrar um novo fechamento. Vamos abrir o formulário e percorrer **cada campo** para que você saiba exatamente como preencher.\n\n**Importante:** ao registrar uma venda, o lead é automaticamente marcado como **"Fechado"**.',
        position: 'bottom',
      },
      {
        target: 'venda-field-cliente',
        title: 'Campo: Cliente',
        description: 'Selecione o **lead que fechou** a venda.\n\n**Como usar:**\n• Clique no campo e digite o nome do lead\n• A busca filtra automaticamente\n• Selecione o contato correto na lista\n\n**Dica:** se o lead não aparece, pode ser que ele ainda não está cadastrado no CRM. Volte à página de Leads e cadastre-o primeiro.',
        position: 'right',
        action: { type: 'click', selector: 'tutorial:vendas-new', delay: 500 },
      },
      {
        target: 'venda-field-procedimento',
        title: 'Campo: Procedimento / Serviço',
        description: 'Digite o **nome do procedimento** ou serviço vendido.\n\nExemplos:\n• "Harmonização Facial"\n• "Botox — Testa e Glabela"\n• "Pacote 3 sessões Peeling"\n\n**Dica:** use nomes consistentes. Se sempre escreve "Botox" do mesmo jeito, fica mais fácil analisar depois quais procedimentos vendem mais.',
        position: 'right',
      },
      {
        target: 'venda-field-valor',
        title: 'Campo: Valor Fechado',
        description: 'Informe o **valor total** que o paciente pagou (em reais).\n\nEste valor alimenta:\n• **Faturamento** no Painel de Controle\n• **Ticket Médio** (média dos valores)\n• **ROAS** (retorno sobre investimento em marketing)\n• **Metas de receita**\n\n**Importante:** registre o valor **efetivamente cobrado**, não o valor de tabela. Se deu desconto, registre o valor com desconto.',
        position: 'right',
      },
      {
        target: 'venda-field-data',
        title: 'Campo: Data do Fechamento',
        description: 'Selecione a **data em que a venda foi fechada**.\n\n• Clique no campo para abrir o calendário\n• Selecione o dia correto\n\n**Regra:** registre sempre a data **real** do fechamento, mesmo que esteja registrando depois. Isso garante que as métricas por período estejam corretas.\n\nSe fechou ontem mas está registrando hoje, coloque a data de ontem.',
        position: 'right',
      },
      {
        target: 'venda-field-pagamento',
        title: 'Campo: Forma de Pagamento',
        description: 'Selecione **como o paciente pagou**:\n\n• **Cartão de Crédito** — parcelamentos inclusos\n• **PIX** — pagamento instantâneo\n• **Boleto** — pagamento bancário\n• **Dinheiro** — pagamento em espécie\n• **Outro** — demais formas\n\nEssa informação ajuda a entender o **perfil financeiro** dos seus pacientes e planejar o fluxo de caixa.',
        position: 'right',
      },
      {
        target: 'venda-submit',
        title: 'Finalizar registro',
        description: 'Após preencher todos os campos, clique em **"Registrar Venda"** para salvar.\n\n**O que acontece automaticamente:**\n• A venda aparece na lista abaixo\n• Os cards de métricas são atualizados\n• O lead é marcado como **"Fechado"**\n• O Painel de Controle reflete o novo faturamento\n\nVocê pode fechar este formulário sem salvar — nada será perdido até clicar no botão.',
        position: 'top',
      },
      {
        target: 'vendas-filters',
        title: 'Filtros de vendas',
        action: { type: 'dismiss', delay: 300 },
        description: 'Refine a lista de vendas:\n\n• **Período** — selecione o intervalo de datas\n• **Busca** — procure por nome do lead, procedimento ou forma de pagamento\n• **Filtros avançados** — origem, procedimento, forma de pagamento, tipo de venda e faixa de valor\n\n**Uso estratégico:** combine período + filtros avançados para comparar faturamento entre origens, procedimentos ou formas de pagamento. Isso ajuda a identificar sazonalidade e tendências de crescimento.',
        position: 'bottom',
      },
      {
        target: 'vendas-list',
        title: 'Lista de vendas',
        description: 'A tabela mostra todas as vendas registradas com:\n\n• **Lead** — nome do paciente\n• **Serviço** — procedimento ou produto vendido\n• **Valor** — valor em reais (destaque verde)\n• **Data** — quando o fechamento aconteceu\n• **Pagamento** — forma de pagamento com badge\n\n**Ações por venda:**\n• **Editar** (ícone de lápis) — corrigir informações\n• **Excluir** (ícone de lixeira) — remover registro\n\nAmbas as ações aparecem ao passar o mouse sobre a linha.',
        position: 'top',
      },
      {
        target: 'vendas-list',
        title: 'Rotina de vendas',
        description: '**Sua rotina com vendas:**\n\n• **Após cada fechamento** — registre imediatamente com valor e procedimento\n• **Semanalmente** — revise os cards de métricas para acompanhar o progresso\n• **Mensalmente** — compare o faturamento com meses anteriores e com suas Metas\n\n**Regra de ouro:** registre a venda **no mesmo dia** do fechamento. Postergar o registro gera dados incorretos no Painel e nas Metas.\n\nAs vendas registradas aqui são a base para calcular o **retorno do seu investimento em marketing** (ROAS) e o **custo por aquisição** (CPA).',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // PROCEDIMENTOS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'procedimentos',
    pageRoute: '/crm/procedimentos',
    title: 'Procedimentos',
    description: 'Gerencie o catálogo de procedimentos da sua clínica e acompanhe a performance de cada um com métricas de fechamento e faturamento.',
    icon: 'Stethoscope',
    category: 'comercial',
    steps: [
      {
        target: 'procedimentos-header',
        title: 'Catálogo de Procedimentos',
        description: 'Aqui você gerencia todos os **procedimentos** que sua clínica oferece.\n\n• Cadastre procedimentos com nome, categoria, valor e duração\n• Acompanhe quantos fechamentos cada procedimento gerou\n• Veja o faturamento acumulado por procedimento\n\n**Por que cadastrar?** Com o catálogo completo, você identifica quais procedimentos trazem mais receita e pode focar o marketing onde gera mais resultado.',
        position: 'bottom',
      },
      {
        target: 'procedimentos-metrics',
        title: 'Métricas do catálogo',
        description: 'Quatro indicadores essenciais no topo:\n\n• **Ativos** — procedimentos disponíveis no catálogo\n• **Fechamentos** — total de vendas com procedimentos cadastrados\n• **Faturamento** — receita total gerada por esses procedimentos\n• **Ticket Médio** — valor médio por fechamento\n\n**Dica:** o faturamento reflete vendas cujo campo "Serviço" corresponde exatamente ao nome de um procedimento cadastrado.',
        position: 'bottom',
      },
      {
        target: 'procedimentos-add',
        title: 'Novo procedimento',
        description: 'Clique aqui para cadastrar um novo procedimento no catálogo.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="procedimentos-add"]', delay: 500 },
      },
      {
        target: 'procedimento-field-nome',
        title: 'Nome do procedimento',
        description: 'Digite o nome exato do procedimento.\n\n**Importante:** use o mesmo nome que você usa no campo "Procedimento/Serviço" ao registrar vendas. O sistema usa esse texto para calcular as métricas de fechamento por procedimento.',
        position: 'right',
      },
      {
        target: 'procedimento-field-categoria',
        title: 'Categoria',
        description: 'Classifique o procedimento em uma categoria:\n\n• **Estética Facial** — botox, preenchimento, harmonização\n• **Estética Corporal** — lipo, criolipólise, etc.\n• **Capilar** — tratamentos para cabelo\n• **Odontologia** — procedimentos dentários\n• **Médico** — consultas e procedimentos médicos\n• **Outro** — demais categorias\n\nA categoria facilita a organização e filtragem no catálogo.',
        position: 'right',
      },
      {
        target: 'procedimento-field-valor',
        title: 'Valor base',
        description: 'O **valor de referência** cobrado por este procedimento.\n\n**Uso:** é um valor de catálogo — pode diferir do valor real fechado em cada venda. Serve para comparar com o ticket médio real e identificar descontos praticados.',
        position: 'right',
      },
      {
        target: 'procedimento-field-duracao',
        title: 'Duração',
        description: 'Informe o tempo médio de execução do procedimento em **minutos**.\n\nExemplos: 30 min, 60 min, 90 min.\n\n**Uso:** ajuda no planejamento de agenda e na comunicação com o paciente sobre o tempo estimado.',
        position: 'left',
      },
      {
        target: 'procedimento-field-descricao',
        title: 'Descrição',
        description: 'Adicione uma descrição detalhada: indicações, cuidados pós-procedimento, contraindicações, ou qualquer informação relevante.\n\n**Dica:** uma boa descrição ajuda sua equipe a esclarecer dúvidas dos leads sem precisar acionar o profissional responsável.',
        position: 'top',
      },
      {
        target: 'procedimento-submit',
        title: 'Salvar procedimento',
        description: 'Clique para salvar o procedimento no catálogo.\n\nApós salvar, ele aparecerá no grid com suas métricas de fechamento calculadas automaticamente.',
        position: 'top',
      },
      {
        target: 'procedimentos-filters',
        title: 'Filtros e ordenação',
        description: 'Refine o catálogo com:\n\n• **Ativos/Inativos** — pills de status\n• **Categoria** — filtre por Estética Facial, Corporal, Capilar, Odontologia, Médico ou Outro\n• **Ordenar por** — Nome, Mais fechamentos, Maior faturamento ou Maior valor base\n• **Busca** — por nome, categoria ou descrição\n\n**Dica:** com vários filtros ativos, um link "Limpar filtros" aparece para resetar tudo de uma vez.',
        position: 'bottom',
      },
      {
        target: 'procedimentos-list',
        title: 'Catálogo em cards',
        action: { type: 'dismiss', delay: 300 },
        description: 'Cada card mostra:\n\n• **Nome e categoria** — identificação visual com cor por categoria\n• **Valor base e duração** — informações de referência\n• **Fechamentos e faturamento** — métricas reais das vendas registradas\n\n**Clique no card** para abrir os detalhes completos, incluindo a lista de todos os fechamentos (cliente, valor, data e forma de pagamento).\n\n**Ações rápidas:**\n• **Ativar/Desativar** — procedimentos inativos ficam acinzentados\n• **Editar** (lápis) — atualizar qualquer informação\n• **Excluir** (lixeira) — remover do catálogo sem afetar o histórico de vendas\n\nOs botões de editar e excluir aparecem ao passar o mouse sobre o card.',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // PERFORMANCE
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'performance',
    pageRoute: '/crm/performance',
    title: 'Performance',
    description: 'Entenda como funciona o sistema de rastreamento de rotina do CRM — checklists diários, semanais e mensais, sistema de score e regras de bloqueio.',
    icon: 'Trophy',
    category: 'geral',
    steps: [
      // ── 1. Visão geral da página ──
      {
        target: 'performance-header',
        title: 'O que é Performance?',
        description: 'A página de **Performance** é o seu sistema de **rastreamento de rotina**.\n\nO seu consultor da Descompliquei criou uma lista de tarefas que você deve executar **todos os dias, toda semana e todo mês** para manter o CRM funcionando no máximo.\n\nComo funciona:\n• Seu **score começa em 100%** em cada período\n• Para cada tarefa não feita, o score cai\n• O score **nunca se recupera** — se perdeu, perdeu\n• Quanto mais consistente sua rotina, mais alto o score\n\nÉ uma ferramenta de **responsabilização** — não de punição. O objetivo é criar hábitos que fazem o CRM gerar resultado.',
        position: 'bottom',
      },
      // ── 2. As 4 abas ──
      {
        target: 'performance-tabs',
        title: 'As 4 abas de Performance',
        description: 'A página tem **4 abas** principais:\n\n• **Visão Geral** — score consolidado, alertas do dia e gráfico dos últimos 30 dias\n• **Diário** — checklist de tarefas do dia (editável apenas hoje)\n• **Semanal** — checklist da semana (editável a partir da segunda-feira seguinte)\n• **Mensal** — checklist do mês (editável a partir do último dia útil)\n\nVamos explorar cada uma detalhadamente. Começando pela **Visão Geral**.',
        position: 'bottom',
      },
      // ── 3. Scores na Visão Geral ──
      {
        target: 'performance-overview-scores',
        title: 'Seus scores consolidados',
        description: 'Este painel mostra **4 indicadores de performance**:\n\n• **Overall** (grande, no centro) — score geral combinando diário, semanal e mensal\n• **Hoje** — percentual de tarefas diárias concluídas hoje com contagem X/Y\n• **Semana** — média ponderada dos dias da semana + tarefas semanais\n• **Mês** — score acumulado considerando diário, semanal e mensal do mês\n\n**Interpretação das cores:**\n• 🟢 **Verde** (≥80%) — excelente, rotina em dia\n• 🟡 **Amarelo** (50–79%) — regular, precisa melhorar\n• 🔴 **Vermelho** (<50%) — crítico, atenção urgente\n\n**Lembre-se:** o score cai conforme os dias passam sem você marcar as tarefas. Não dá para recuperar.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="performance-open-overview-direct"]', delay: 500 },
      },
      // ── 4. Alertas de tarefas pendentes ──
      {
        target: 'performance-overview-pending',
        title: 'Alerta de tarefas do dia',
        description: 'Logo abaixo dos scores, aparece um **banner de alerta** sobre o status das tarefas de hoje:\n\n• **Banner laranja** 🔥 — mostra quantas tarefas ainda estão pendentes e lista os títulos delas. Aparece quando há tarefas do dia não marcadas.\n• **Banner verde** ✅ — confirma que todas as tarefas de hoje foram concluídas.\n\n**Como usar:** toda manhã ao abrir o CRM, confira este banner. Se estiver laranja, você ainda tem tarefas para fazer hoje antes do dia acabar.\n\n**Atenção:** quando meia-noite passar, as tarefas do dia anterior ficam bloqueadas permanentemente. O que não foi feito, não pode mais ser recuperado.',
        position: 'bottom',
      },
      // ── 5. Gráfico de evolução ──
      {
        target: 'performance-overview-chart',
        title: 'Evolução dos últimos 30 dias',
        description: 'Este gráfico mostra a **linha do seu score diário** nos últimos 30 dias.\n\n**Como interpretar:**\n• Dias em que você completou todas as tarefas → ponto em **100%**\n• Dias com tarefas parciais → ponto entre 0% e 100%\n• Dias sem nenhuma tarefa marcada → ponto em **0%**\n\n**Passe o mouse** sobre qualquer ponto para ver o score exato daquele dia.\n\n**Leitura estratégica:**\n• Uma linha **estável no topo** = rotina sólida\n• Quedas pontuais = identifique o que aconteceu naqueles dias\n• Quedas frequentes = precisa ajustar a rotina\n\nUse esse gráfico nas suas conversas com o consultor para mostrar evolução ao longo do tempo.',
        position: 'top',
      },
      // ── 6. Regras de bloqueio ──
      {
        target: 'performance-overview-info',
        title: 'Regras de bloqueio — muito importante',
        description: 'No rodapé da Visão Geral há um resumo das **3 regras de bloqueio**. Entenda cada uma:\n\n**Tarefas Diárias:**\n• Só podem ser marcadas **no próprio dia**\n• Às 23:59 o período fecha. Se não marcou hoje, perdeu.\n\n**Tarefas Semanais:**\n• Disponíveis apenas a partir da **segunda-feira da semana seguinte**\n• Por quê? Para que você reflita sobre a semana completa antes de registrar\n• Ex.: semana de 26/05 a 01/06 → disponível a partir de 02/06 (segunda)\n\n**Tarefas Mensais:**\n• Disponíveis a partir do **último dia útil do mês**\n• Ex.: maio → último dia útil = 30/05 (sexta) → disponível a partir do dia 30\n• Se o último dia do mês for sábado, considera sexta; se domingo, considera sexta também\n\nGuarde essas regras — elas explicam por que às vezes o checklist está **bloqueado** (cadeado no canto).',
        position: 'top',
      },
      // ── 7. Checklist diário — header ──
      {
        target: 'performance-checklist-header',
        title: 'Checklist Diário — cabeçalho',
        description: 'Agora vamos para a aba **Diário**. Este é o cabeçalho do checklist.\n\nO cabeçalho mostra:\n• **Ícone e frequência** — identifica que é o checklist diário\n• **X/Y tarefas concluídas** — contagem em tempo real\n• **Score em %** (número grande à direita) — porcentagem de conclusão do período\n• **Barra de progresso** — linha colorida que cresce conforme você marca as tarefas\n\n**Cores da barra e do score:**\n• Verde = ≥80% concluído\n• Amarelo = 50–79%\n• Vermelho = <50%\n\nAcompanhe esse número todo dia — ele é o reflexo direto da sua disciplina de rotina.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="performance-open-daily-direct"]', delay: 500 },
      },
      // ── 8. Navegação de período ──
      {
        target: 'performance-checklist-navigator',
        title: 'Navegação entre períodos',
        description: 'As **setas de navegação** permitem consultar períodos anteriores.\n\n• **Seta esquerda** — vai para o dia/semana/mês anterior\n• **Seta direita** — avança para o próximo (limitado ao período atual)\n• **Botão "Atual"** — volta direto para o período de hoje (aparece apenas quando você não está no período corrente)\n\n**Limitações inteligentes:**\n• Não é possível navegar para antes da **data de cadastro** da sua organização na plataforma\n• Não é possível avançar para além do **período atual**\n• Quando um limite é atingido, a seta fica **acinzentada** e inativa\n\n**Para que serve navegar?** Consultar o histórico de tarefas em períodos anteriores e entender como evoluiu sua consistência.',
        position: 'bottom',
      },
      // ── 9. Lista de tarefas ──
      {
        target: 'performance-checklist-tasks',
        title: 'Como marcar as tarefas',
        description: 'Esta é a **lista de tarefas** do período selecionado.\n\nCada tarefa mostra:\n• **Ícone de círculo** — tarefa pendente (clique para marcar)\n• **Ícone verde** ✅ — tarefa concluída (clique para desmarcar)\n• **Texto riscado** — indica que a tarefa foi feita\n• **Descrição curta** — aparece abaixo do título quando pendente\n• **Cadeado** 🔒 — tarefa bloqueada (período já passou ou ainda não liberou)\n\n**Como usar:**\n1. Leia o título da tarefa\n2. Após executá-la no CRM, clique sobre ela para marcar como concluída\n3. Uma notificação verde confirma o registro\n4. O score e a barra atualizam na hora\n\n**Atenção:** só é possível marcar/desmarcar quando o período está **editável** (sem cadeado).',
        position: 'top',
      },
      // ── 10. Checklist semanal ──
      {
        target: 'performance-checklist-header',
        title: 'Checklist Semanal',
        description: 'A aba **Semanal** tem as tarefas que você executa **uma vez por semana** — geralmente análises, revisões e configurações mais estratégicas.\n\nO cabeçalho semanal funciona igual ao diário:\n• Score % do período selecionado\n• Contagem X/Y tarefas\n• Barra de progresso colorida\n\n**Regra de desbloqueio:**\nO checklist da semana atual só fica editável na **segunda-feira da semana seguinte**.\n\n→ Se hoje é quinta, 29/05: a semana 22 (26/05–01/06) ainda está bloqueada.\n→ A partir de segunda, 02/06: você poderá marcar as tarefas da semana 22.\n\nIsso garante que você reflita sobre a **semana completa** antes de registrar o que foi feito.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="performance-open-weekly-direct"]', delay: 500 },
      },
      // ── 11. Navegação semanal ──
      {
        target: 'performance-checklist-navigator',
        title: 'Como navegar por semanas',
        description: 'O navegador semanal mostra:\n\n• **"Semana XX · dd MMM – dd MMM"** — número da semana ISO e intervalo de datas\n• Ex.: *Semana 22 · 26 mai – 1 jun*\n\nNavegue para semanas anteriores para consultar ou preencher checklists de semanas passadas que já foram desbloqueadas.\n\n**Exemplo prático:**\nHoje é segunda, 02/06. Você pode:\n• Navegar para a semana 22 (26/05–01/06) → já desbloqueada, pode marcar\n• Ver semanas ainda mais antigas → todas desbloqueadas\n• Semana atual (semana 23) → bloqueada até a próxima segunda\n\n**Dica:** reserve toda **segunda-feira** para preencher o checklist da semana anterior. Vire um hábito.',
        position: 'bottom',
      },
      // ── 12. Checklist mensal ──
      {
        target: 'performance-checklist-header',
        title: 'Checklist Mensal',
        description: 'A aba **Mensal** tem as tarefas executadas **uma vez por mês** — revisões estratégicas, análises de resultados e planejamentos.\n\nSão apenas **3 tarefas** mensais, mas são as mais importantes — envolvem análise profunda do que aconteceu no mês.\n\n**Regra de desbloqueio:**\nO checklist do mês fica editável a partir do **último dia útil do mês**.\n\n→ Maio 2025: último dia útil = **sexta, 30/05** → disponível a partir do dia 30\n→ Se o último dia for sábado → disponível na sexta anterior\n→ Se for domingo → disponível na sexta anterior\n\n**Por que no último dia útil?** Porque você precisa ter **todos os dados do mês** para responder as perguntas mensais com precisão.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="performance-open-monthly-direct"]', delay: 500 },
      },
      // ── 13. Rotina ideal ──
      {
        target: 'performance-overview-scores',
        title: 'Sua rotina ideal de Performance',
        description: '**Resumo da rotina que vai manter seu score alto:**\n\n**Todos os dias (manhã):**\n• Abra a aba **Diário**\n• Execute as tarefas do dia no CRM\n• Marque cada uma como concluída\n• Confira o **banner de alertas** na Visão Geral\n\n**Toda segunda-feira:**\n• Abra a aba **Semanal**\n• Navegue para a semana anterior (já desbloqueada)\n• Marque as tarefas semanais que você executou\n\n**No último dia útil de cada mês:**\n• Abra a aba **Mensal**\n• Revise os resultados do mês\n• Marque as 3 tarefas mensais\n\n**O seu consultor da Descompliquei acompanha esses dados** e usa o score para orientar as sessões táticas. Quanto mais alta a consistência, mais produtiva é a mentoria.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="performance-open-overview-direct"]', delay: 500 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // METAS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'metas',
    pageRoute: '/crm/metas',
    title: 'Metas',
    description: 'Defina objetivos claros e acompanhe o progresso da sua clínica em tempo real. Transforme números em ação.',
    icon: 'Target',
    category: 'comercial',
    steps: [
      {
        target: 'metas-header',
        title: 'Central de metas',
        description: 'As metas são o **norte da sua operação**. Aqui você define objetivos mensais e acompanha o progresso em tempo real.\n\n**Sem metas definidas**, o CRM é apenas um banco de dados. **Com metas**, ele se torna uma ferramenta de gestão que mostra se sua equipe está no caminho certo ou precisa acelerar.\n\nDefina suas metas **todo início de mês** e acompanhe diariamente.',
        position: 'bottom',
      },
      {
        target: 'metas-month',
        title: 'Seletor de mês',
        description: 'Navegue entre os meses usando as **setas laterais**:\n\n• **Seta esquerda** — mês anterior\n• **Seta direita** — próximo mês\n\nIsso permite:\n• Ver o progresso do **mês atual**\n• Comparar com **meses anteriores**\n• Definir metas para **meses futuros**\n\n**Dica:** defina as metas do próximo mês antes que ele comece. Assim sua equipe já sabe os objetivos desde o dia 1.',
        position: 'bottom',
      },
      {
        target: 'metas-edit',
        title: 'Editar meta existente',
        description: 'Clique no botão de **edição** para ajustar qualquer meta já criada.\n\nVocê pode alterar:\n• **Valores-alvo** — se a meta ficou muito fácil ou muito difícil\n• **Taxas de conversão** — conforme a realidade da operação muda\n• **Período** — ajuste as datas se necessário\n\n**Dica:** revise as metas a cada mês com base nos resultados reais. Uma meta bem calibrada é mais motivadora do que uma impossível ou trivial.',
        position: 'bottom',
      },
      {
        target: 'metas-criar',
        title: 'Criar sua primeira meta',
        description: 'Se a página está vazia, é porque você ainda não criou nenhuma meta. Clique em **"Nova Meta"** para começar.\n\nVamos percorrer o formulário **campo a campo** para que você saiba como configurar suas metas com precisão.',
        position: 'bottom',
      },
      {
        target: 'meta-field-nome',
        title: 'Campo: Nome da meta',
        description: 'Dê um **nome descritivo** para identificar esta meta.\n\nExemplos:\n• "Meta Maio 2026"\n• "Meta Q2 — Crescimento 20%"\n• "Meta Semana Promocional"\n\nO nome aparece no topo da página quando a meta está ativa.',
        position: 'right',
        action: { type: 'click', selector: 'tutorial:metas-criar', delay: 500 },
      },
      {
        target: 'meta-field-periodo',
        title: 'Campo: Tipo e Período',
        description: 'Defina o **período** da meta:\n\n• **Mensal** — objetivo para o mês inteiro (mais comum)\n• **Semanal** — objetivo para uma semana específica\n• **Personalizado** — intervalo livre de datas\n\nAs datas de **início** e **fim** são definidas automaticamente para mensal/semanal, ou manualmente para personalizado.',
        position: 'right',
      },
      {
        target: 'meta-field-receita',
        title: 'Campo: Meta de Receita',
        description: 'Defina quanto você quer **faturar** neste período.\n\nEste é o número mais importante — ele direciona todos os outros cálculos.\n\n**Como definir:** olhe seu faturamento dos últimos 3 meses, calcule a média e adicione **10-20%** de crescimento. Ex: se faturou R$50k/mês, meta = R$55k a R$60k.',
        position: 'right',
      },
      {
        target: 'meta-field-origem-toggle',
        title: 'Meta por origem (opcional)',
        description: 'Além da receita total, você pode dizer **quanto dessa receita deve vir de cada origem de lead** — Marketing, Orgânico, Reativação, Paciente (e Convênio, quando aplicável).\n\nLigue o toggle **"Meta por origem"** para escolher, num seletor, **quais origens** entram na meta e definir o valor de cada uma.\n\n**Regra importante:** a receita-alvo total deixa de ser digitada à mão — ela passa a ser a **soma dos valores das origens**, calculada automaticamente.',
        position: 'right',
      },
      {
        target: 'meta-field-origem-valores',
        title: 'Escolha as origens e os valores',
        description: 'Clique em **"Adicionar origem"** para incluir só as origens que você quer acompanhar — não precisa preencher todas. Cada origem pode ser removida no **✕**.\n\n• Em **Meta Simples**, você define um valor-alvo por origem\n• Em **Meta com Níveis**, cada origem tem **Piso · Alvo · Super** próprios\n• Os campos gerais de receita ficam **travados** e mostram a **soma por nível** das origens — a meta total é a soma dos **Alvos**\n\n**Dica:** comece pelas origens que você já consegue prever e distribua o restante.',
        position: 'right',
      },
      {
        target: 'meta-submit',
        title: 'Salvar meta',
        description: 'Clique em **"Criar Meta"** para salvar.\n\n**O que acontece:**\n• A receita realizada passa a ser acompanhada em tempo real\n• O gráfico de projeção mostra o faturamento que você deve atingir até o fim do período\n• Se você definiu **Meta por origem**, uma seção nova aparece na página comparando realizado × alvo em cada origem\n\nApós criar, acompanhe **diariamente** rolando a página.',
        position: 'top',
      },
      {
        target: 'metas-por-origem',
        action: { type: 'dismiss', delay: 300 },
        title: 'Acompanhamento por origem',
        description: 'Se você ligou **"Meta por origem"** no formulário, essa seção aparece aqui — logo abaixo da receita total — mostrando, para **cada origem**, o realizado × o alvo e a barra de progresso.\n\n**Como usar:** se uma origem está muito atrás do alvo dela, é ali que vale investigar — pode ser tráfego travado, reativação parada, indicação de pacientes caindo, etc.\n\n**Não definiu meta por origem?** Essa seção não aparece — a meta continua funcionando normalmente só com a receita total.',
        position: 'bottom',
      },
      {
        target: 'metas-projecao',
        title: 'Projeção de receita',
        description: 'O gráfico mostra, em **colunas crescentes**, o faturamento acumulado que você deve atingir até o fim do período — com o **valor de cada etapa acima da coluna**.\n\n• As colunas **sólidas** são o que você já deveria ter faturado até hoje\n• As colunas **claras** são o que ainda falta conquistar\n• A linha **"Você tem"** mostra onde você realmente está\n\nUse o toggle **Dia / Semana / Mês** para mudar a granularidade. Se sua linha está acima do esperado, você está à frente; se está abaixo, precisa acelerar.',
        position: 'bottom',
      },
      {
        target: 'metas-ritmo',
        title: 'Ritmo necessário e simulador',
        description: 'Fechando a página:\n\n• **Ritmo Necessário** — quanto de receita você precisa gerar por **dia** e por **semana** para fechar a meta, com um insight de projeção do resultado final.\n• **Simulador "E se?"** — ajuste leads/dia, taxas e ticket médio e veja o impacto projetado na receita.\n\n**Sua rotina:** abra esta página **todo dia** (30 segundos), confira se está no ritmo, e reaja **antes** do fim do período.',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // EQUIPE
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'equipe',
    pageRoute: '/crm/equipe',
    title: 'Desempenho da Equipe',
    description: 'Acompanhe o desempenho individual de cada membro da equipe e compare métricas comerciais por período.',
    icon: 'UsersRound',
    category: 'comercial',
    steps: [
      {
        target: 'equipe-header',
        title: 'Página de Equipe',
        description: 'A página **Equipe** mostra o desempenho comercial da sua equipe no período selecionado.\n\nAqui você encontra:\n• Métricas de leads, qualificações, agendamentos e faturamento\n• Funil de conversão por membro\n• Evolução de leads no tempo\n• Ranking de procedimentos vendidos\n\n**Dica:** use os filtros de período para comparar semanas, meses ou o ano completo.',
        position: 'bottom',
      },
      {
        target: 'equipe-period',
        title: 'Filtro de Período',
        description: 'Selecione o período de análise:\n\n• **Dia** — apenas hoje\n• **Semana** — semana atual (segunda a domingo)\n• **Mês** — mês corrente\n• **Ano** — ano inteiro\n\nTodas as métricas e gráficos da página são recalculados automaticamente ao trocar o período.',
        position: 'bottom',
      },
      {
        target: 'equipe-members',
        title: 'Filtrar por Membro',
        description: 'Clique em um **nome da equipe** para ver as métricas exclusivas daquele colaborador.\n\nClique em **"Todos"** para voltar à visão consolidada da equipe.\n\n• Leads ativos, qualificados, agendamentos e fechamentos do membro\n• Faturamento gerado pelo membro no período\n• Funil de conversão individual\n\n**Dica:** use este filtro em reuniões 1:1 para dar feedback com dados precisos.',
        position: 'bottom',
      },
      {
        target: 'equipe-kpis',
        title: 'Visão Geral do Período',
        description: 'Cinco métricas-chave do período selecionado (ou do membro filtrado):\n\n• **Leads Ativos** — total de leads no sistema\n• **Qualificados** — leads marcados como MQL e taxa de qualificação\n• **Agendamentos** — consultas agendadas e taxa de conversão\n• **Fechamentos** — vendas realizadas e taxa de fechamento\n• **Faturamento** — receita gerada e ticket médio\n\nAs taxas mostradas embaixo de cada número indicam a conversão de uma etapa para a próxima.',
        position: 'top',
      },
      {
        target: 'equipe-funnel',
        title: 'Funil de Conversão',
        description: 'Visualize o funil em 4 etapas:\n\n**Leads → MQL → Agendamentos → Fechados**\n\n• A barra colorida mostra a proporção em relação ao topo do funil\n• A taxa entre etapas indica onde ocorre a maior perda\n\n**O que analisar:**\n• Taxa de qualificação baixa? Revise o script da IA\n• Taxa de agendamento baixa? Melhore o follow-up pós-qualificação\n• Taxa de fechamento baixa? Trabalhe a apresentação e contorno de objeções',
        position: 'top',
      },
      {
        target: 'equipe-charts',
        title: 'Evolução e Procedimentos',
        description: 'Dois painéis complementares:\n\n**Evolução no Período** — gráfico de área com a captação diária de leads. Identifica dias de pico e quedas.\n\n**Top Procedimentos** — ranking dos procedimentos mais vendidos no período, com quantidade e receita gerada por cada um.\n\n**Dica:** cruze os dados — se os leads cresceram mas os procedimentos top mudaram, pode indicar uma mudança no perfil do público.',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // EVOLUÇÃO
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'evolucao',
    pageRoute: '/crm/evolucao',
    title: 'Evolução',
    description: 'Compare dois períodos lado a lado e acompanhe a evolução de todas as métricas da sua operação.',
    icon: 'TrendingUp',
    category: 'geral',
    steps: [
      {
        target: 'evolucao-header',
        title: 'Página de Evolução',
        description: 'A página **Evolução** compara **Período A** e **Período B** lado a lado em todas as métricas da operação.\n\nCada linha mostra os dois valores emparelhados e, na terceira coluna, a **variação** entre eles — com seta e cor indicando se o resultado melhorou ou piorou.\n\n**Ideal para:** reuniões mensais de revisão, análises de tendência e identificação de pontos de melhoria.',
        position: 'bottom',
      },
      {
        target: 'evolucao-period',
        title: 'Período A e Período B',
        description: 'Defina os dois períodos que serão comparados usando os **dois calendários** — o mesmo seletor de datas do restante do sistema.\n\n**Presets rápidos:**\n• Mês vs anterior (padrão)\n• Ano vs anterior\n• 30 dias vs 30 dias\n\nAo mudar o Período A manualmente, o Período B se ajusta **automaticamente** para o período anterior de mesma duração — não precisa recalcular na mão.\n\n**Dica:** use os presets para comparações rápidas e o calendário livre para períodos personalizados, como uma campanha específica.',
        position: 'bottom',
      },
      {
        target: 'evolucao-kpis',
        title: 'Visão Geral do Período',
        description: 'A seção **Visão Geral do Período** traz 6 métricas centrais em tabela: **Leads, Qualificados, Agendamentos, Fechamentos, Faturamento e Ticket Médio**.\n\nCada linha mostra o Período A e o Período B em **duas colunas do mesmo tamanho** — nenhum dos dois fica menor ou em cinza — com a variação na terceira coluna.\n\nQuando o movimento é forte, a **cor do próprio número** muda: verde quando é bom para o negócio, vermelho quando é ruim.\n\n**Dica:** aqui a variação vem em **%**; nas taxas de outras seções, ela aparece em **pp** (pontos percentuais).',
        position: 'bottom',
      },
      {
        target: 'evolucao-funnel',
        title: 'Taxas de Conversão',
        description: 'Esta tabela mostra as três taxas-chave do funil: **Taxa de Qualificação (MQL), Taxa de Agendamento e Taxa de Fechamento**, comparando Período A e Período B.\n\nComo são taxas, a variação aparece em **pp (pontos percentuais)** — não em %. Uma taxa que foi de 40% para 28% caiu **12 pp**, não 12%.\n\n**Dica:** se a Taxa de Qualificação caiu, o problema pode estar na IA ou no atendimento — investigue antes de aumentar o investimento em tráfego.',
        position: 'top',
      },
      {
        target: 'evolucao-leads',
        title: 'Origem dos Leads',
        description: 'Compara de onde vieram os leads em cada período:\n\n• **Marketing** — leads de anúncios pagos\n• **Orgânico** — leads sem investimento (indicação, busca direta)\n• **Reativação** — leads antigos que voltaram\n• **Outros** — demais origens\n\nCada origem mostra o volume do Período A, do Período B e a variação entre eles.\n\n**Dica:** se os leads de Marketing caíram mas os Orgânicos subiram, a operação pode estar ficando mais eficiente mesmo com menos investimento.',
        position: 'top',
      },
      {
        target: 'evolucao-vendas',
        title: 'Detalhe por Área',
        description: 'Abaixo da Visão Geral, a seção **Detalhe por Área** organiza 4 tabelas em uma grade de 2 colunas:\n\n• **Taxas de Conversão**\n• **Agendamentos**\n• **Atendimento**\n• **Origem dos Leads**\n\nTodas seguem o mesmo padrão: Período A, Período B e variação — para aprofundar a análise depois de olhar a Visão Geral.\n\n**Dica:** comece pela Visão Geral para identificar o que mudou e venha até aqui para entender o porquê.',
        position: 'top',
      },
      {
        target: 'evolucao-agendamentos',
        title: 'Agendamentos',
        description: 'Tabela com o detalhe de agendamentos entre os dois períodos:\n\n• **Realizados** — consultas que aconteceram\n• **No-show** — faltas sem aviso\n• **Comparecimento** — taxa de quem apareceu\n\nComo Comparecimento é uma taxa, a variação vem em **pp**; Realizados e No-show variam em **%**.\n\n**Dica:** queda na taxa de Comparecimento costuma indicar falha na confirmação — revise os lembretes automáticos de WhatsApp.',
        position: 'top',
      },
      {
        target: 'evolucao-atendimento',
        title: 'Atendimento',
        description: 'Tabela com a qualidade do atendimento comparada entre os períodos:\n\n• **1ª resposta** — tempo médio até um humano responder\n• **Sem resposta** — % de leads sem retorno em 24h\n• **Conversas** — volume total atendido\n\n**Atenção:** nestas métricas, menor é melhor — quando o número cai, a cor fica **verde**, mesmo sendo uma queda.\n\n**Meta ideal:** 1ª resposta rápida e taxa de Sem resposta próxima de zero.',
        position: 'top',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ATHOS PRÉ-ATENDIMENTO (14 steps — walkthrough completo com cliques)
  // Substitui o antigo tutorial 'ia' de /crm/ia (página removida — conteúdo
  // centralizado em /crm/athos/recepcao).
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'athos-recepcao',
    pageRoute: '/crm/athos/recepcao',
    title: 'Athos Pré-Atendimento',
    description: 'Configure sua assistente virtual para qualificar leads automaticamente.',
    icon: 'Bot',
    category: 'automacao',
    steps: [
      // ── 1. Visão geral das abas ──
      {
        target: 'ia-tabs',
        title: 'Bem-vindo ao Pré-Atendimento',
        description: 'O **Athos Pré-Atendimento** é o agente que responde seus leads automaticamente via WhatsApp.\n\nEsta página centraliza tudo sobre ele, em **2 abas**:\n\n• **Configurações** — monte o perfil e prompt da IA\n• **Logs** — histórico detalhado de cada interação\n\nVamos percorrer cada seção em detalhe.',
        position: 'bottom',
      },
      // ── 2. Status ──
      {
        target: 'ia-status',
        title: 'Motor de Resposta',
        description: 'Este card mostra o **status do motor de resposta** da IA:\n\n• **Ativa** (verde) — a IA está respondendo automaticamente\n• **Inativa** (cinza) — mensagens não são respondidas pela IA\n\n**Atenção:** isto é diferente do interruptor lá em cima, no topo da página — aquele liga/desliga o agente inteiro no Console Athos; este aqui é o motor de resposta específico desta IA.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="ia-tabs"] button:nth-child(1)', delay: 400 },
      },
      // ── 3. Toggle ──
      {
        target: 'ia-toggle',
        title: 'Ativar / Desativar a IA',
        description: 'Este é o **interruptor principal** da sua IA.\n\n• **Ligado** — a IA intercepta novas conversas, qualifica leads, coleta dados e só passa para a equipe quando necessário\n• **Desligado** — todas as mensagens vão direto para o atendimento humano\n\n**Dicas de uso:**\n• Desative temporariamente durante horários de pico com equipe completa\n• Ative fora do expediente para não perder leads que chegam à noite\n• A IA é desativada **por lead** quando o atendimento humano assume',
        position: 'left',
      },
      // ── 4. Visão geral do stepper ──
      {
        target: 'ia-prompt',
        title: 'Configuração da IA — 5 Etapas',
        description: 'O formulário de configuração é dividido em **5 sub-abas**:\n\n• **Identidade** — nome do agente, clínica e profissional\n• **Personalidade** — tom de voz e estilo de comunicação\n• **Conhecimento** — procedimentos, FAQ, horários e pagamentos\n• **Fluxo** — como a IA conduz cada etapa da conversa\n• **Ajustes** — instruções e regras específicas da sua operação\n\nVamos explorar cada uma.',
        position: 'right',
      },
      // ── 5. Sub-aba: Identidade ──
      {
        target: 'ia-field-identity',
        title: 'Identidade do Agente',
        description: 'Comece definindo **quem é sua IA**:\n\n• **Nome do agente** — como ela se apresenta (ex: "Ana", "Sofia")\n• **Nome da clínica** — usado nas respostas para contextualizar\n• **Nome do profissional** — o doutor(a) responsável\n• **Especialidade** — área de atuação da clínica\n\n**Dica:** Escolha um nome humanizado. Leads respondem melhor quando sentem que conversam com uma "pessoa".',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="ia-subtab-identidade"]', delay: 400 },
      },
      // ── 6. Sub-aba: Personalidade ──
      {
        target: 'ia-field-voice',
        title: 'Tom de Voz e Personalidade',
        description: 'Defina **como a IA se comunica**:\n\n• Descreva o tom desejado (ex: "profissional mas acolhedor", "amigável e consultivo")\n• Configure se deve usar **emojis** e quais\n• Escolha quem a IA deve "chamar" (equipe, secretária ou doutor)\n\n**Exemplo de tom:**\n"Seja gentil e profissional. Use linguagem simples, evite termos técnicos. Sempre pergunte o nome do lead e trate pelo primeiro nome."',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="ia-subtab-personalidade"]', delay: 400 },
      },
      // ── 7. Sub-aba: Conhecimento — Procedimentos ──
      {
        target: 'ia-field-procedures',
        title: 'Procedimentos Oferecidos',
        description: 'Liste **todos os procedimentos** da sua clínica:\n\n• Clique em **"Adicionar"** para cada serviço\n• Preencha o **nome** e uma **descrição** clara\n• Os procedimentos cadastrados na página de Procedimentos já são **importados automaticamente**\n• A IA usa essas informações para tirar dúvidas e qualificar o interesse do lead\n\n**Quanto mais detalhado, melhor a IA responde sobre indicações e o que esperar.**',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="ia-subtab-conhecimento"]', delay: 400 },
      },
      // ── 8. FAQ ──
      {
        target: 'ia-field-faq',
        title: 'FAQ — Perguntas Frequentes',
        description: 'Cadastre as **dúvidas mais comuns** com respostas prontas:\n\n• Clique em **"Adicionar"** para cada pergunta\n• Preencha a **pergunta** e a **resposta** completa\n• A IA consulta esta base antes de gerar respostas\n\n**Exemplos úteis:**\n• "Qual o preço?" → "Os valores variam conforme a avaliação. Agende uma consulta gratuita!"\n• "Aceita convênio?" → "Não, mas temos condições facilitadas"',
        position: 'bottom',
      },
      // ── 9. Horário ──
      {
        target: 'ia-field-horario',
        title: 'Horário de Atendimento',
        description: 'Configure os **horários** em que sua equipe humana está disponível:\n\n• **Segunda a Sexta** — horário de abertura e fechamento\n• **Sábado / Domingo** — marque como "Fechado" ou defina horário\n\nA IA usa estas informações para:\n• Informar ao lead quando a equipe estará disponível\n• Decidir se transfere imediatamente ou agenda retorno',
        position: 'top',
      },
      // ── 10. Pagamento ──
      {
        target: 'ia-field-pagamento',
        title: 'Formas de Pagamento',
        description: 'Informe as **formas de pagamento** aceitas pela clínica:\n\n• Marque: **Pix, Dinheiro, Crédito, Débito**\n• Configure **condições de parcelamento** (ex: "Até 10x com juros")\n• Adicione **observações** (ex: "5% desconto à vista")\n\nA IA responde automaticamente quando o lead pergunta sobre preços e condições de pagamento.',
        position: 'top',
      },
      // ── 11. Sub-aba: Fluxo ──
      {
        target: 'ia-field-fluxo',
        title: 'Fluxo de Atendimento',
        description: 'A metodologia de atendimento já vem pré-configurada em **4 passos**. Aqui você personaliza os detalhes de cada etapa:\n\n• **Abertura** — IA dá boas-vindas e coleta o nome. Você pode personalizar a mensagem.\n• **Diagnóstico** — IA faz perguntas para entender a dor do lead. Configure quantas e quais perguntas.\n• **Apresentação** — IA apresenta a solução. Escolha o tom: Emocional, Equilibrado ou Direto.\n• **Handoff** — IA passa para a equipe. Personalize a frase de transição.\n\n**Dica:** As configurações padrão já funcionam muito bem. Personalize apenas o que foge do padrão da sua clínica.',
        position: 'right',
        action: { type: 'click', selector: '[data-tutorial="ia-subtab-fluxo"]', delay: 400 },
      },
      // ── 12. Sub-aba: Ajustes ──
      {
        target: 'ia-field-instructions',
        title: 'Instruções Específicas',
        description: 'Este é o campo para **regras personalizadas** da sua operação:\n\n• Defina comportamentos específicos que a IA deve seguir\n• Adicione restrições ou exceções\n\n**Exemplos:**\n• "Nunca mencione valores, diga que será avaliado na consulta"\n• "Se o lead perguntar sobre Botox, mencione também o Preenchimento Labial"\n• "Sempre ofereça avaliação gratuita"\n\n**Não é necessário** adicionar regras gerais — elas já vêm configuradas.',
        position: 'right',
        action: { type: 'click', selector: '[data-tutorial="ia-subtab-ajustes"]', delay: 400 },
      },
      // ── 13. Salvar ──
      {
        target: 'ia-save',
        title: 'Salvar Configurações',
        description: 'Após preencher todos os campos, clique em **"Salvar"** para aplicar as mudanças.\n\n• O botão fica **desabilitado** quando não há alterações\n• Um **indicador vermelho** aparece quando há mudanças não salvas\n• Use **"Descartar"** para reverter ao último estado salvo\n\n**Importante:** As mudanças só entram em vigor após salvar.',
        position: 'bottom',
      },
      // ── 14. Logs ──
      {
        target: 'ia-logs',
        title: 'Logs de Execução da IA',
        description: 'A aba de **Logs** mostra o **registro detalhado** de cada interação da IA:\n\n• **Tempo Real** — monitor ao vivo das execuções em andamento\n• **Execuções** — histórico filtrável por período, com detalhe e erro de cada uma\n\n**Boas práticas:**\n• Revise os logs **semanalmente** para encontrar respostas que podem melhorar\n• Identifique perguntas recorrentes e adicione ao **FAQ**\n• Se a IA errar em algo, ajuste o **prompt** ou as **instruções específicas**',
        position: 'top',
        action: { type: 'click', selector: '[data-tutorial="ia-tabs"] button:nth-child(2)', delay: 400 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ATHOS FOLLOW-UP (5 steps)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'athos-followup',
    pageRoute: '/crm/athos/followup',
    title: 'Athos Follow-Up',
    description: 'Reengaje leads que esfriaram e acompanhe o histórico de disparos.',
    icon: 'Send',
    category: 'automacao',
    steps: [
      {
        target: 'ia-followup-tabs',
        title: 'Automático e Manual',
        description: 'O Follow-Up tem **dois fluxos totalmente distintos** — cada um na sua aba:\n\n• **Automático** — a IA dispara sozinha enquanto está atendendo o lead\n• **Manual** — o resgate que **você ativa no botão** "Follow IA", para leads que a equipe atendeu e sumiram\n\nCada aba tem suas próprias métricas e histórico. Vamos ver.',
        position: 'bottom',
      },
      {
        target: 'ia-followup-history',
        title: 'Análise do Automático',
        description: 'Na aba **Automático → Análise** você acompanha os follow-ups que a **IA disparou sozinha**:\n\n• **Enviado** — mensagem entregue com sucesso\n• **IA ignorou** — a IA decidiu que não fazia sentido enviar\n• **Lead respondeu** — follow-up cancelado porque o lead voltou\n• **Erro** — falha no envio\n\nUse a **recuperação por tentativa** para ajustar os intervalos.',
        position: 'top',
        action: { type: 'click', selector: '[data-tutorial="ia-followup-tab-automatico"]', delay: 400 },
      },
      {
        target: 'ia-followup-config',
        title: 'Configuração (do Automático)',
        description: 'A **Configuração** vale para o follow-up **automático** — não afeta o manual.\n\n• **Ative/desative** o follow-up automático\n• Configure a **sequência de tentativas** (até 5)\n• Defina o **intervalo** entre cada mensagem:\n  - 1ª tentativa: 15min a 2h (lead ainda está quente)\n  - 2ª tentativa: 1h a 8h (reforço)\n  - 3ª tentativa: 12h a 3 dias (última chance)\n• Configure se deve **respeitar horário de atendimento**\n\nA IA **para automaticamente** quando o lead responde.',
        position: 'top',
        action: { type: 'click', selector: '[data-tutorial="ia-followup-tab-config"]', delay: 400 },
      },
      {
        target: 'athos-followup-gap',
        title: 'Leads sem retorno (Manual)',
        description: 'Na aba **Manual**, esta lista mostra **quem esfriou agora** — leads em que a equipe falou por último e o lead sumiu.\n\n• Filtre por **período** com o seletor de datas\n• Clique em **"Follow IA"** para ativar o reengajamento **manual** naquele lead\n• Use os ícones para ver a conversa ou abrir a jornada completa\n\nSó os leads ativados aqui entram no fluxo **manual** — nada é ativado sozinho.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="ia-followup-tab-manual"]', delay: 400 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ATHOS TRIAGEM (2 steps)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'athos-triagem',
    pageRoute: '/crm/athos/triagem',
    title: 'Athos Triagem',
    description: 'Veja como a IA decide quem é lead real logo na primeira mensagem.',
    icon: 'UserCheck',
    category: 'automacao',
    steps: [
      {
        target: 'athos-agent-conteudo',
        title: 'Triagem de Leads',
        description: 'Esta página mostra como a IA está classificando cada contato **em tempo real**, na primeira mensagem:\n\n• Veja a **decisão** — IA ativada ou encaminhado a um humano\n• Entenda o **motivo** — o que fez a IA tomar aquela decisão\n• Filtre por **período** e por tipo de decisão para analisar tendências\n\n**Use a triagem para:**\n• Calibrar o prompt da IA quando ela classificar errado\n• Identificar padrões nos leads mais qualificados',
        position: 'top',
      },
    ],
  },


  // ═══════════════════════════════════════════════════════════════
  // AUTOMAÇÃO - CADÊNCIAS (12 steps — modal walkthrough completo)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'cadences',
    pageRoute: '/crm/cadences',
    title: 'Cadências',
    description: 'Automatize sequências de mensagens para nutrir seus leads.',
    icon: 'GitMerge',
    category: 'automacao',
    steps: [
      // ── 1. Visão geral ──
      {
        target: 'cadences-create',
        title: 'O que são Cadências?',
        description: 'Uma cadência é um **fluxo automatizado de mensagens** enviadas em intervalos programados.\n\n**Casos de uso:**\n• **Follow-up** — sequência para leads que não responderam\n• **Nutrição** — conteúdo educativo ao longo de semanas\n• **Reativação** — reconquiste contatos inativos\n• **Pós-venda** — acompanhe clientes após a compra\n• **Onboarding** — guie novos clientes nos primeiros dias\n\nVamos criar uma cadência agora! Clique em **"Nova Cadência"** para abrir o editor.',
        position: 'bottom',
      },
      // ── 2. Abre modal — campo Nome ──
      {
        target: 'cadence-modal-identity',
        title: 'Nome e Descrição',
        description: 'Comece identificando seu fluxo:\n\n• **Nome** — identifique a cadência (ex: "Follow-up Consulta", "Reativação 30 dias")\n• **Descrição** — explique o objetivo internamente para sua equipe\n\n**Exemplos de nomes:**\n• "Follow-up Pós-Contato"\n• "Nutrição de Lead Frio"\n• "Lembrete de Consulta"\n• "Reativação Mês 2"\n\nO nome aparece no card da cadência e no relatório.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="cadences-create"]', delay: 500 },
      },
      // ── 3. Seção de passos ──
      {
        target: 'cadence-steps',
        title: 'Construtor de Fluxo',
        description: 'Esta é a área onde você monta a **sequência de mensagens** da cadência.\n\nO fluxo começa com o nó **"Início do Fluxo"** e cada passo que você adicionar vira uma mensagem programada.\n\nVisualmente, o fluxo aparece em forma de **diagrama vertical**:\n\nInício → Passo 1 → Passo 2 → Passo 3 → ...\n\nCada passo tem:\n• **Tipo de mensagem** — texto, imagem, áudio, etc.\n• **Conteúdo** — o que será enviado\n• **Intervalo de espera** — quanto tempo esperar antes deste passo',
        position: 'top',
      },
      // ── 4. Adicionar passo ──
      {
        target: 'cadence-add-step',
        title: 'Adicionar Passos',
        description: 'Clique em **"Adicionar Passo"** para incluir uma nova mensagem na sequência.\n\nCada passo que você adicionar terá campos para configurar:\n• **Tipo** — texto, imagem, áudio, vídeo ou PDF\n• **Mensagem** — o conteúdo que será enviado\n• **Tempo de espera** — intervalo antes deste passo ser enviado\n\n**Estratégia recomendada:**\n• **Passo 1** — 30min após início (lead ainda quente)\n• **Passo 2** — 4h depois\n• **Passo 3** — 24h depois\n• **Passo 4** — 3 dias depois\n• **Passo 5** — 7 dias depois (última tentativa)',
        position: 'top',
      },
      // ── 5. Botão salvar cadência ──
      {
        target: 'cadence-submit',
        title: 'Salvar o Fluxo',
        description: 'Após adicionar pelo menos **um passo** e preencher o nome, o botão **"Salvar Fluxo"** fica disponível.\n\n**Validações:**\n• O **nome** é obrigatório\n• É necessário ter **pelo menos 1 passo** configurado\n• Cada passo precisa ter **conteúdo** preenchido\n\nApós salvar, a cadência aparece na lista de fluxos e fica disponível para **disparar em massa** para seus leads.',
        position: 'top',
      },
      // ── 6. Fechar modal e mostrar lista ──
      {
        target: 'cadences-list',
        title: 'Seus Fluxos de Cadência',
        description: 'Aqui ficam **todos os fluxos** que você criou.\n\nCada card mostra:\n• **Nome e descrição** do fluxo\n• **Quantidade de passos** — número de mensagens\n• **Data de criação**\n• **Prévia visual** dos passos numerados (1 → 2 → 3...)\n\n**Boas práticas:**\n• Crie cadências separadas por objetivo (follow-up, reativação, etc.)\n• Nomear bem facilita encontrar na hora de disparar',
        position: 'top',
        action: { type: 'dismiss', delay: 300 },
      },
      // ── 7. Card da cadência ──
      {
        target: 'cadences-card',
        title: 'Ações do Card',
        description: 'Cada card de cadência tem **3 botões de ação** no rodapé:\n\n• **Monitorar** (ícone de gráfico) — veja quais leads estão recebendo este fluxo e o status de cada passo\n• **Disparar** — selecione leads e inicie o fluxo em massa\n• **Detalhes** — abra o editor para ver ou editar os passos\n\nNo **canto superior direito** (menu ⋮), você pode excluir a cadência.\n\n**Dica:** Use "Detalhes" para ajustar mensagens sem precisar recriar o fluxo.',
        position: 'bottom',
      },
      // ── 8. Disparar ──
      {
        target: 'cadences-dispatch',
        title: 'Disparar em Massa',
        description: 'O botão **"Disparar"** abre uma janela para enviar a cadência para **múltiplos leads de uma vez**.\n\nNessa janela você:\n• **Seleciona os leads** que devem receber o fluxo (com filtros)\n• Define o **intervalo mínimo** entre envios\n• Define o **intervalo máximo** (delays randomizados evitam bloqueio)\n\n**Regras de segurança automáticas:**\n• Cada lead recebe a cadência **apenas uma vez** (sem duplicatas)\n• Se o lead **responder**, a cadência é cancelada automaticamente\n• Use no mínimo **30s de intervalo** entre envios para segurança',
        position: 'top',
      },
      // ── 9. Aba Monitoramento ──
      {
        target: 'cadences-monitoring',
        title: 'Monitoramento em Tempo Real',
        description: 'A aba **Monitoramento** mostra o andamento de todos os envios ativos:\n\n• **Leads em andamento** — quem está recebendo cadências agora\n• **Passo atual** — em qual mensagem cada lead está\n• **Status de cada envio:**\n  - Pendente = aguardando o intervalo\n  - Enviado = entregue com sucesso\n  - Cancelado = lead respondeu ou removido manualmente\n  - Erro = falha no envio\n• **Filtro por data** — analise períodos específicos',
        position: 'top',
        action: { type: 'click', selector: '[data-tutorial="cadences-tabs"] button:nth-child(2)', delay: 400 },
      },
      // ── 10. Aba Relatório ──
      {
        target: 'cadences-report',
        title: 'Relatórios de Desempenho',
        description: 'A aba **Relatório** consolida as métricas de todas as cadências:\n\n• **Total de disparos** realizados\n• **Taxa de entrega** — percentual de mensagens enviadas com sucesso\n• **Desempenho por cadência** — compare qual fluxo converte mais\n• **Histórico de envios em massa** — registro completo\n\n**O que analisar:**\n• Cadências com baixa entrega → ajuste os intervalos\n• Passos com alta taxa de cancelamento → lead respondeu (ótimo sinal!)\n• Compare cadências A vs B para descobrir o melhor copy',
        position: 'top',
        action: { type: 'click', selector: '[data-tutorial="cadences-tabs"] button:nth-child(3)', delay: 400 },
      },
      // ── 11. Voltar para Fluxos + dicas finais ──
      {
        target: 'cadences-create',
        title: 'Estratégias Vencedoras',
        description: '**Fórmula de follow-up que converte:**\n\n• **Passo 1 (30min):** "Oi {nome}! Vi que você ficou interessado(a). Posso te ajudar com alguma dúvida?"\n• **Passo 2 (4h):** "Só passando para ver se conseguiu ver as informações que enviei!"\n• **Passo 3 (24h):** Envie um conteúdo de valor (antes/depois, depoimento, etc.)\n• **Passo 4 (3 dias):** Oferta ou condição especial com urgência\n• **Passo 5 (7 dias):** Última tentativa — perguntar se ainda tem interesse\n\n**Regra de ouro:** Escreva como se fosse uma **pessoa real**, não um robô.',
        position: 'bottom',
        action: { type: 'click', selector: '[data-tutorial="cadences-tabs"] button:nth-child(1)', delay: 400 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURAÇÕES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'settings',
    pageRoute: '/crm/settings',
    title: 'Configurações',
    description: 'Personalize o CRM para sua clínica.',
    icon: 'Settings',
    category: 'sistema',
    steps: [
      // -- Nav lateral --
      {
        target: 'settings-nav',
        title: 'Menu de Configurações',
        description: 'As configurações estão organizadas em grupos:\n\n• **Conta** — perfil pessoal, senha e aparência _(todos os usuários)_\n• **CRM** — fontes de leads e etiquetas _(somente dono)_\n• **Sistema** — marca e WhatsApp _(somente dono)_\n• **Equipe** — membros e performance da equipe _(somente dono)_\n\nMembros da equipe veem apenas a seção **Conta** — suas configurações pessoais.',
        position: 'right',
      },
      // -- Perfil --
      {
        target: 'settings-profile',
        title: 'Perfil do Usuário',
        description: 'Aqui você configura suas **informações pessoais**:\n\n• **Foto de perfil** — clique no avatar para fazer upload da sua foto\n• **Nome completo** — como você aparece no sistema e nas conversas\n• **Telefone** — seu contato interno\n• **Dados da empresa** — nome, CNPJ, e-mail e telefone da clínica _(somente donos)_\n\n**Dica:** clique diretamente na foto de perfil para escolher uma imagem. Formatos aceitos: JPG, PNG (máx. 5 MB).',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-profile"]', delay: 400 },
      },
      // -- Fontes --
      {
        target: 'settings-sources',
        title: 'Fontes de Leads',
        description: 'Gerencie as **origens** dos seus leads:\n\n• **Adicione fontes** — ex: Instagram, Google, Indicação, Site, WhatsApp direto\n• **Defina cores** — identificação visual rápida\n• **Rastreabilidade** — saiba de onde cada lead veio\n\n**Por que configurar?** Com fontes bem definidas, você descobre qual canal traz mais leads e onde investir mais.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-sources"]', delay: 400 },
      },
      // -- Tags --
      {
        target: 'settings-tags',
        title: 'Etiquetas (Tags)',
        description: 'Crie **etiquetas coloridas** para categorizar seus leads:\n\n• **Exemplos:** "VIP", "Retorno", "Indicação", "Prioridade Alta", "Pós-consulta"\n• Defina **nome e cor** para cada etiqueta\n• As tags aparecem na **lista de leads** e permitem **filtragem rápida**\n• Um lead pode ter **múltiplas etiquetas** simultaneamente\n\n**Dica:** Use etiquetas para segmentar leads e enviar comunicações direcionadas.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-tags"]', delay: 400 },
      },
      // -- Equipe --
      {
        target: 'settings-team',
        title: 'Gestão da Equipe',
        description: 'Na seção **Equipe** você convida colaboradores e gerencia o acesso ao CRM.\n\n**Aba Membros:**\n• Visualize todos os membros ativos\n• Clique em **"Convidar Membro"** para adicionar um colaborador — ele recebe um e-mail com link de acesso\n• Configure as **permissões** de cada membro (quais páginas pode acessar)\n• Remova membros quando necessário\n\n**Cada membro entra com e-mail e senha próprios**, sem compartilhar as credenciais do dono da conta.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-team"]', delay: 400 },
      },
      {
        target: 'settings-team',
        title: 'Performance da Equipe',
        description: 'A aba **Desempenho** mostra as métricas de cada membro da equipe no período selecionado:\n\n• **Atendimentos** — conversas que cada membro tratou\n• **MQLs gerados** — leads qualificados por cada colaborador\n• **Agendamentos** — consultas marcadas por cada um\n• **Vendas e faturamento** — fechamentos por membro\n\n**Como usar:** revise semanalmente para reconhecer os melhores resultados e identificar quem precisa de apoio. Dados objetivos facilitam feedbacks justos e baseados em evidências.',
        position: 'left',
      },
      // -- Marca --
      {
        target: 'settings-marca',
        title: 'Identidade da Marca',
        description: 'Personalize a **identidade visual** do seu CRM:\n\n• **Logo** — sua marca no topo do sistema\n• **Favicon** — ícone que aparece na aba do navegador\n• **Nome do app** — título exibido no navegador\n• **Cores** — personalize as cores principais da plataforma\n\nEssas configurações aplicam o **white-label** — o CRM fica com a cara da sua clínica.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-marca"]', delay: 400 },
      },
      // -- WhatsApp --
      {
        target: 'settings-whatsapp',
        title: 'Conexão WhatsApp',
        description: 'Conecte seu **número de WhatsApp** ao CRM:\n\n• **QR Code** — escaneie para conectar (como no WhatsApp Web)\n• **Status** — veja se a conexão está ativa ou desconectada\n• **Reconectar** — reconecte rapidamente se perder a sessão\n\n**Essa é a configuração mais importante!** Sem a conexão WhatsApp, o CRM não pode enviar nem receber mensagens.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-whatsapp"]', delay: 400 },
      },
      // -- Aparência --
      {
        target: 'settings-appearance',
        title: 'Aparência',
        description: 'Escolha o **tema visual** da plataforma:\n\n• **Claro** — fundo branco, ideal para ambientes bem iluminados\n• **Escuro** — fundo escuro, reduz cansaço visual em ambientes com pouca luz\n• **Automático** — segue a configuração do seu sistema operacional\n\nA mudança é aplicada **instantaneamente** em toda a plataforma.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-appearance"]', delay: 400 },
      },
      // -- Senha --
      {
        target: 'settings-security',
        title: 'Alterar Senha',
        description: 'Mantenha sua conta **segura** alterando a senha periodicamente.\n\n• Digite a **nova senha** (mínimo 6 caracteres)\n• **Confirme** digitando novamente no campo abaixo\n• Clique em **"Salvar Nova Senha"** para aplicar\n\n**Disponível para todos** — donos e membros da equipe podem alterar sua própria senha independentemente.\n\n**Dica:** use senhas com letras maiúsculas, minúsculas, números e símbolos. Evite datas de nascimento ou sequências simples.',
        position: 'left',
        action: { type: 'click', selector: '[data-tutorial="settings-nav-security"]', delay: 400 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ONBOARDING — tutoriais específicos disparados pelo onboarding
  // Não aparecem na Central de Ajuda (category: 'onboarding')
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'onboarding-perfil',
    pageRoute: '/crm/settings',
    title: 'Configure o perfil da clínica',
    description: 'Passo a passo para personalizar a identidade visual do CRM.',
    icon: 'Building2',
    category: 'onboarding' as any,
    steps: [
      {
        target: 'settings-marca',
        title: 'Seção Marca',
        description: 'Você está na seção **Marca** das configurações. Aqui você personaliza a identidade visual do CRM com o logo e as cores da sua clínica.\n\nTudo o que configurar aqui aparece para **toda a equipe** que acessar o sistema.',
        position: 'left' as const,
        action: { type: 'click' as const, selector: '[data-tutorial="settings-go-marca"]', delay: 500 },
      },
      {
        target: 'branding-logo',
        title: 'Faça upload do logo',
        description: 'Clique em **"Escolher Logo"** e selecione a imagem da sua marca.\n\n**Dica:** use uma imagem quadrada (PNG com fundo transparente). O sistema vai **extrair as cores automaticamente** do logo e aplicar na paleta do CRM.\n\nSe não tiver um logo agora, pode pular e configurar depois.',
        position: 'bottom' as const,
      },
      {
        target: 'branding-identity',
        title: 'Nome e tagline',
        description: 'Preencha o **Nome do Sistema** — é o que aparece na aba do navegador e no topo do CRM.\n\nExemplos:\n• "CRM Clínica Bella"\n• "Gestão Odontonova"\n\nA **tagline** é opcional — uma frase curta como "Gestão inteligente" ou "Sua clínica conectada".',
        position: 'bottom' as const,
      },
      {
        target: 'branding-save',
        title: 'Salvar configurações',
        description: 'Após preencher, clique em **"Salvar Marca"** para aplicar.\n\nAs mudanças entram em vigor **imediatamente** para todos os usuários do CRM.\n\n**Pronto!** Volte ao onboarding e marque este passo como concluído.',
        position: 'top' as const,
      },
    ],
  },
  {
    id: 'onboarding-etiquetas',
    pageRoute: '/crm/settings',
    title: 'Sincronize suas etiquetas',
    description: 'Importe as etiquetas do WhatsApp Business para o CRM.',
    icon: 'Tag',
    category: 'onboarding' as any,
    steps: [
      {
        target: 'settings-tags',
        title: 'Seção Etiquetas',
        description: 'Você está na seção **Etiquetas** das configurações. Aqui você organiza seus leads com **etiquetas coloridas** — semelhantes às do WhatsApp Business.\n\nO melhor caminho é **sincronizar** direto do WhatsApp para que todas as suas etiquetas existentes venham automaticamente.',
        position: 'left' as const,
        action: { type: 'click' as const, selector: '[data-tutorial="settings-go-tags"]', delay: 500 },
      },
      {
        target: 'tags-sync-whatsapp',
        title: 'Sincronizar com WhatsApp',
        description: 'Clique em **"Sincronizar WhatsApp"** para importar automaticamente todas as etiquetas que você já usa no WhatsApp Business.\n\nO sistema vai:\n• Importar o **nome e a cor** de cada etiqueta\n• Vincular aos leads que já possuem essas etiquetas no WhatsApp\n\n**Importante:** o WhatsApp precisa estar **conectado** para a sincronização funcionar. Se ainda não conectou, faça isso primeiro na seção "WhatsApp".',
        position: 'bottom' as const,
      },
      {
        target: 'tags-new',
        title: 'Criar etiquetas manualmente',
        description: 'Caso queira criar etiquetas extras que **não existem no WhatsApp**, clique em **"Nova Etiqueta"**.\n\nEscolha um **nome** descritivo e uma **cor** para identificar visualmente.\n\nExemplos: "VIP", "Retorno", "Indicação", "Pós-operatório".\n\n**Pronto!** Volte ao onboarding e marque este passo como concluído.',
        position: 'bottom' as const,
      },
    ],
  },
  {
    id: 'onboarding-procedimentos',
    pageRoute: '/crm/procedimentos',
    title: 'Cadastre seus procedimentos',
    description: 'Monte o catálogo de serviços da clínica.',
    icon: 'Stethoscope',
    category: 'onboarding' as any,
    steps: [
      {
        target: 'procedimentos-header',
        title: 'Catálogo de procedimentos',
        description: 'Esta é a página onde você cadastra **todos os serviços** que sua clínica oferece.\n\nQuando você registrar uma venda, o sistema cruza com este catálogo para calcular:\n• **Faturamento por procedimento**\n• **Ticket médio**\n• **Procedimentos mais vendidos**\n\nVamos cadastrar o primeiro procedimento agora.',
        position: 'bottom' as const,
      },
      {
        target: 'procedimentos-add',
        title: 'Novo procedimento',
        description: 'Clique em **"Novo Procedimento"** para abrir o formulário de cadastro.\n\nVocê vai preencher:\n• **Nome** (ex: "Harmonização Facial")\n• **Categoria** (Facial, Corporal, etc.)\n• **Valor base** e **duração**\n• **Descrição** (opcional)',
        position: 'bottom' as const,
      },
      {
        target: 'procedimento-field-nome',
        title: 'Nome do procedimento',
        description: 'Digite o **nome exato** do procedimento.\n\n**Dica importante:** use o mesmo nome que vai usar ao registrar vendas. O sistema faz a correspondência pelo texto.\n\n• "Botox — Testa e Glabela" ✓\n• "botox testa" ✗ (não vai corresponder)',
        position: 'right' as const,
        action: { type: 'click' as const, selector: '[data-tutorial="procedimentos-add"]', delay: 500 },
      },
      {
        target: 'procedimento-field-categoria',
        title: 'Categoria',
        description: 'Selecione a **categoria** do procedimento.\n\nIsso organiza o catálogo e facilita filtros:\n• **Estética Facial** — botox, preenchimento, harmonização\n• **Estética Corporal** — lipo, criolipólise\n• **Odontologia** — procedimentos dentários\n• **Outro** — demais categorias',
        position: 'right' as const,
      },
      {
        target: 'procedimento-field-valor',
        title: 'Valor base',
        description: 'Informe o **valor de referência** (preço de tabela).\n\nSe o valor varia, coloque o mais praticado. O valor real de cada venda é registrado separadamente na página de Vendas.',
        position: 'right' as const,
      },
      {
        target: 'procedimento-field-duracao',
        title: 'Duração estimada',
        description: 'Informe o tempo médio em **minutos**.\n\nExemplos: 30, 60, 90 min.\n\nIsso ajuda no planejamento de agenda.',
        position: 'right' as const,
      },
      {
        target: 'procedimento-submit',
        title: 'Salvar procedimento',
        description: 'Clique em **"Salvar"** para cadastrar o procedimento.\n\nEle aparecerá no catálogo com métricas de vendas calculadas automaticamente.\n\n**Repita** para cada serviço da clínica. Não precisa cadastrar todos agora — você pode adicionar mais a qualquer momento.\n\n**Pronto!** Volte ao onboarding e marque este passo como concluído.',
        position: 'top' as const,
      },
    ],
  },
  {
    id: 'onboarding-equipe',
    pageRoute: '/crm/settings',
    title: 'Convide sua equipe',
    description: 'Adicione colaboradores ao CRM.',
    icon: 'Users',
    category: 'onboarding' as any,
    steps: [
      {
        target: 'settings-team',
        title: 'Seção Equipe',
        description: 'Você está na seção **Equipe**. Aqui você convida colaboradores e gerencia permissões de acesso.\n\nCada membro entra com **e-mail e senha próprios** — ninguém compartilha credenciais.',
        position: 'left' as const,
        action: { type: 'click' as const, selector: '[data-tutorial="settings-go-team"]', delay: 500 },
      },
      {
        target: 'settings-team',
        title: 'Convidar membro',
        description: 'Clique em **"Convidar Membro"** para adicionar um colaborador.\n\nPreencha:\n• **Nome completo** e **e-mail** do colaborador\n• **Papel** — "Atendente" para recepcionistas, "Admin" para gestores\n• **Permissões** — quais páginas esse membro pode acessar\n\nO colaborador recebe um **e-mail com link de primeiro acesso** e cria sua própria senha.\n\n**Dica:** comece adicionando quem vai usar o CRM no dia a dia. Você pode ajustar permissões a qualquer momento.\n\n**Pronto!** Volte ao onboarding e marque este passo como concluído.',
        position: 'left' as const,
      },
    ],
  },

  // ── Onboarding — Central de Suporte ─────────────────────────────────────────
  {
    id: 'onboarding-suporte',
    pageRoute: '/crm/settings',
    title: 'Central de Suporte',
    description: 'Abra tickets e acesse a base de conhecimento.',
    icon: 'LifeBuoy',
    category: 'onboarding' as any,
    steps: [
      {
        target: 'suporte-tabs',
        title: 'Central de Suporte',
        description: 'Você está na **Central de Suporte**. Aqui você se comunica diretamente com a equipe Descompliquei.\n\nDuas seções:\n\n• **Minhas Solicitações** — tickets abertos, em andamento e resolvidos\n• **Base de Conhecimento** — artigos com respostas para dúvidas frequentes',
        position: 'bottom' as const,
        action: { type: 'click' as const, selector: '[data-tutorial="settings-go-suporte"]', delay: 500 },
      },
      {
        target: 'suporte-metrics',
        title: 'Painel de status',
        description: 'Acompanhe o **resumo das suas solicitações** em tempo real:\n\n• **Total** — todos os tickets já abertos\n• **Abertos** — aguardando análise ou em andamento\n• **Aguardando** — precisam de mais informações da sua parte\n• **Resolvidos** — tickets concluídos\n\nOs status são atualizados automaticamente pela equipe.',
        position: 'bottom' as const,
      },
      {
        target: 'suporte-novo-ticket',
        title: 'Abrir um ticket',
        description: 'Clique em **"Novo Ticket"** para enviar uma solicitação à equipe.\n\nPreencha:\n• **Título** — descreva o problema em uma frase\n• **Categoria** — Bug, Melhoria, Dúvida ou Outro\n• **Prioridade** — Baixa, Média, Alta ou Crítica\n• **Descrição** — quanto mais detalhe, mais rápido resolvemos\n• **Anexos** — imagens ou vídeos opcionais\n\nPrazo médio de resposta: **até 48 horas úteis**.',
        position: 'left' as const,
      },
      {
        target: 'suporte-tickets',
        title: 'Acompanhar solicitações',
        description: 'Na lista de tickets você vê todas as suas solicitações com status em tempo real.\n\nClique em qualquer ticket para abrir a **conversa completa** — você pode enviar mensagens adicionais e a equipe responde direto por aqui.\n\n**Dica:** use os filtros de status (Abertos, Em Análise, etc.) para encontrar rapidamente o que precisa.\n\n**Pronto!** Volte ao onboarding e marque este passo como concluído.',
        position: 'left' as const,
      },
    ],
  },

  // ── Plataforma — Tour Completo ───────────────────────────────────────────────
  {
    id: 'platform-tour',
    pageRoute: '/plataforma',
    title: 'Tour pela Plataforma',
    description: 'Conheça todas as seções disponíveis no seu plano em poucos minutos.',
    icon: 'Map',
    category: 'onboarding' as any,
    steps: [
      // ── 1. Sidebar ──────────────────────────────────────────────────────────
      {
        target: 'sidebar',
        title: 'Menu da plataforma',
        description: 'Este é o **menu lateral** — agora **unificado**: CRM e Plataforma no mesmo lugar, sem trocar de ambiente.\n\nAs seções da plataforma ficam agrupadas por tema:\n\n• **Aprendizado** — Jornada, Arsenal e Sessões Táticas\n• **Jornada** — sua jornada personalizada de implementação\n• **Arsenal** — ferramentas e aulas comerciais práticas\n• **Athos** — IA estratégica da sua clínica\n• **Sessões Táticas** — encontros ao vivo',
      },
      // ── 2. Visão geral ──────────────────────────────────────────────────────
      {
        target: 'hub-tools',
        title: 'Sua central de comando',
        description: 'Esta é a sua **visão geral** da plataforma. Aqui você tem atalhos rápidos para todas as ferramentas do plano e acompanha o progresso geral.\n\nSempre que entrar, você começa por aqui.',
      },
      // ── 3. Arsenal ──────────────────────────────────────────────────────────
      {
        target: 'arsenal-header',
        title: 'Arsenal Comercial',
        description: 'O **Arsenal** é a sua caixa de ferramentas comerciais — construções prontas que transformam conhecimento em ação.\n\nOrganizado por categorias:\n\n• **Estratégia de captação** — anúncios, scripts, fluxos\n• **Qualificação** — filtros, argumentos, objeções\n• **Fechamento** — propostas, follow-up, reativação\n\nCada ferramenta tem uma construção que você preenche e salva em **Meus Materiais**.',
        action: { type: 'click' as const, selector: '[data-tutorial="sidebar-arsenal"]', delay: 600 },
      },
      // ── 4. Jornada ──────────────────────────────────────────────────────────
      {
        target: 'jornada-header',
        title: 'Jornada Personalizada',
        description: 'A **Jornada** é o seu plano de implementação personalizado — criado pelo **Athos** com base no seu diagnóstico.\n\n• Dividida em **etapas** com prazo e passos concretos\n• Cada passo vinculado a uma **ferramenta ou aula** do Arsenal\n• Etapas desbloqueiam em sequência — conclua uma para avançar\n\n**Dica:** Siga a ordem. Cada etapa concluída desbloqueia a próxima.',
        action: { type: 'click' as const, selector: '[data-tutorial="sidebar-jornada"]', delay: 600 },
      },
      // ── 5. Notas ────────────────────────────────────────────────────────────
      {
        target: 'notas-shell',
        title: 'Notas',
        description: '**Notas** é onde sua equipe organiza tudo — em **pastas** e **notas**, sem bagunça de página dentro de página.\n\n• Uma **tela inicial** reúne suas pastas, as notas mais recentes e o que a empresa compartilhou\n• Crie **pastas e subpastas** ilimitadas; dentro delas ficam as notas (e notas soltas também valem)\n• Notas podem ser **pessoais** ou **compartilhadas com a empresa**\n• Tudo que o **Athos** cria pra você (scripts, ofertas, planos) é salvo aqui\n• Dentro de uma nota, use **/** pra inserir títulos, listas e tabelas, e chame o **Athos** pra continuar ou reescrever\n\nPense como o **arquivo estratégico da sua equipe**.',
        action: { type: 'click' as const, selector: '[data-tutorial="sidebar-notas"]', delay: 600 },
      },
      // ── 6. Athos ────────────────────────────────────────────────────────────
      {
        target: 'sidebar-os',
        title: 'Athos',
        description: 'O **Athos** é a sua IA estratégica — treinada com o método Descompliquei e com os dados da sua clínica.\n\nUse para:\n\n• Tirar dúvidas sobre estratégia comercial\n• Analisar situações e tomar decisões\n• Criar materiais, scripts e planos de ação\n• Revisar o que está funcionando e o que não está\n\nO Athos conhece o seu **Diagnóstico Estratégico** — as conversas são contextualizadas para a realidade da sua clínica.',
        action: { type: 'click' as const, selector: '[data-tutorial="sidebar-os"]', delay: 600 },
      },
      // ── 7. Sessões Táticas ──────────────────────────────────────────────────
      {
        target: 'sidebar-sessoes',
        title: 'Sessões Táticas',
        description: 'As **Sessões Táticas** são encontros ao vivo com especialistas, focados em temas práticos do dia a dia comercial.\n\n• Calendário com **próximas sessões**\n• Link direto para o Google Meet\n• **Gravações** disponíveis após cada sessão\n\nParticipe ao vivo para tirar dúvidas em tempo real.',
        action: { type: 'click' as const, selector: '[data-tutorial="sidebar-sessoes"]', delay: 600 },
      },
      // ── 8. Encerramento ─────────────────────────────────────────────────────
      {
        target: 'sidebar',
        title: 'Tour concluído!',
        description: 'Agora você conhece todas as seções da plataforma.\n\n**Por onde começar:**\n\n• Siga os passos da sua **Jornada** — cada um tem uma ação concreta vinculada\n• Explore o **Arsenal** e complete as construções da sua clínica\n• Use o **Athos** sempre que precisar de orientação estratégica\n• Use o **CRM**, no mesmo menu, para gerenciar seus leads\n\nVocê pode refazer este tour a qualquer momento pela Central de Ajuda.',
      },
    ],
  },

];

// Categories for help center grouping
export const tutorialCategories = [
  { id: 'geral', label: 'Visão Geral', icon: 'LayoutDashboard' },
  { id: 'comercial', label: 'Comercial', icon: 'TrendingUp' },
  { id: 'automacao', label: 'Automação', icon: 'Zap' },
  { id: 'sistema', label: 'Sistema', icon: 'Settings' },
] as const;
