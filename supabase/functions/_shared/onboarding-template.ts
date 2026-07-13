// Template PADRÃO da jornada de Onboarding (14 dias) — igual para todo cliente novo.
// Seed em código: clonado em jornadas+estagios+passos+subtarefas por ensure-onboarding-jornada.
// Fonte de desenho: conhecimento/planejamento/jornada/01-onboarding-14-dias.md
// Onboarding = entendimento da arquitetura + ativação. SEM construção comercial pesada.

export interface OnbTarefa {
  titulo: string;
  conteudo_md: string;
  tipo: 'acao_livre' | 'material';
  material_categoria?: string | null;
  material_brief?: string | null;
  obrigatorio?: boolean;
  subtarefas?: string[];
}
export interface OnbBloco {
  titulo: string;
  descricao?: string;
  prazo_dias: number;
  passos: OnbTarefa[];
}
export interface OnboardingTemplate {
  titulo: string;
  blocos: OnbBloco[];
}

export const ONBOARDING_TEMPLATE: OnboardingTemplate = {
  titulo: 'Onboarding — Seus primeiros 14 dias',
  blocos: [
    {
      titulo: 'Semana 1 — Comece e entenda o jogo',
      descricao: 'Ligue a máquina e entenda o método.',
      prazo_dias: 7,
      passos: [
        {
          titulo: 'Kickoff com seu especialista',
          tipo: 'acao_livre',
          obrigatorio: true,
          conteudo_md: 'Sua ativação começa com gente, não com tela. Nessa primeira conversa com seu especialista da Descompliquei, a gente alinha onde sua clínica está hoje, para onde vamos nos próximos ciclos e como a jornada vai funcionar.\n\n**É aqui que seu diagnóstico vira plano.**',
          subtarefas: ['Agendar o kickoff', 'Participar da reunião', 'Alinhar a meta do 1º ciclo'],
        },
        {
          titulo: 'Configure seu CRM',
          tipo: 'acao_livre',
          obrigatorio: true,
          conteudo_md: 'Antes de qualquer coisa, a máquina precisa estar ligada. Conecte seu WhatsApp e deixe o CRM refletindo a realidade da sua clínica — assim cada lead que chega já entra organizado e **nada se perde**. Essa configuração é a base de tudo que vem depois.',
          subtarefas: ['Conectar o WhatsApp', 'Sincronizar as etiquetas', 'Cadastrar seus procedimentos', 'Adicionar sua equipe', 'Personalizar sua marca'],
        },
        {
          titulo: 'Entenda o método EVA',
          tipo: 'acao_livre',
          obrigatorio: true,
          conteudo_md: 'Toda a plataforma gira em torno de um método: **EVA — Estruturar, Validar, Ajustar.**\n\n- **Estruturar** é documentar como sua clínica vende antes de executar.\n- **Validar** é usar o CRM para ver o que realmente acontece (não o que a equipe acha).\n- **Ajustar** é melhorar com base no dado, nunca no achismo.\n\nNão é linear — é um ciclo que nunca está "pronto". Entender isso agora faz todo o resto fazer sentido.',
        },
      ],
    },
    {
      titulo: 'Semana 2 — Conheça a arquitetura e veja funcionando',
      descricao: 'Entenda como as peças se conectam e veja a máquina girando.',
      prazo_dias: 7,
      passos: [
        {
          titulo: 'Conheça a plataforma por dentro',
          tipo: 'acao_livre',
          obrigatorio: true,
          conteudo_md: 'Aqui você entende **como as peças se conectam**.\n\n- O **CRM** é onde sua operação acontece e seus dados nascem.\n- O **Athos** é seu consultor comercial — ao longo dos ciclos, é ele quem vai construir com você os materiais que sua clínica precisa.\n- A área de **Materiais** é o acervo onde esses ativos vão ficar.\n- A **Jornada** — esta página — é seu plano contínuo, atualizado todo mês junto com seu especialista.\n\nEntender esse desenho é entender como você vai evoluir dentro da plataforma.',
          subtarefas: ['Conhecer as áreas do CRM', 'Conhecer o Athos, seu consultor', 'Conhecer a área de Materiais', 'Entender como a Jornada funciona'],
        },
        {
          titulo: 'Veja seu CRM funcionando',
          tipo: 'acao_livre',
          obrigatorio: true,
          conteudo_md: 'Nada ativa mais do que ver acontecendo. Com o WhatsApp conectado, acompanhe seus primeiros leads e conversas entrando no CRM e passe o olho no painel — seus números começando a aparecer.\n\nNão precisa dominar tudo: precisa **ver a máquina girando com dados reais** da sua clínica.',
          subtarefas: ['Acompanhar as conversas no CRM', 'Ver seus leads no funil', 'Dar uma olhada no painel'],
        },
        {
          titulo: 'Fechamento com seu especialista',
          tipo: 'acao_livre',
          obrigatorio: true,
          conteudo_md: 'Fim dos 14 dias, começo do ritmo. Nesse encontro, seu especialista revisa como foi sua ativação, tira as últimas dúvidas e te entrega sua **primeira jornada mensal personalizada** — o plano do que vem agora, construído para a realidade da sua clínica.\n\n**É a partir daqui que a consultoria de verdade começa.**',
          subtarefas: ['Revisar sua ativação', 'Tirar dúvidas finais', 'Receber sua 1ª jornada mensal'],
        },
      ],
    },
  ],
};
