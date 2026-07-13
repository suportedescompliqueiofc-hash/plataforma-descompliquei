-- CS Sprint 2 — Playbooks interativos e templates de mensagem

-- Tabela de protocolos ativos por cliente
CREATE TABLE IF NOT EXISTS cs_client_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('onboarding', 'engajamento', 'risco', 'escalada', 'expansao')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  passo_atual text,
  passos_concluidos jsonb NOT NULL DEFAULT '[]',
  tipo_risco text CHECK (tipo_risco IN ('inatividade', 'reclamacao', 'ghosting', 'concorrente', 'cancelamento')),
  notas text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cs_client_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_client_protocols_all" ON cs_client_protocols USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cs_protocols_client ON cs_client_protocols(client_id);
CREATE INDEX IF NOT EXISTS idx_cs_protocols_status ON cs_client_protocols(status);

-- Tabela de templates de mensagem editáveis
CREATE TABLE IF NOT EXISTS cs_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('ativacao', 'execucao', 'risco', 'escalada', 'expansao')),
  fase text,
  conteudo text NOT NULL,
  variaveis text[] DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cs_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_templates_all" ON cs_templates USING (true) WITH CHECK (true);

-- Seeds: banco completo de templates
INSERT INTO cs_templates (nome, categoria, fase, conteudo, variaveis) VALUES

-- ─── ATIVAÇÃO ─────────────────────────────────────────────────────────────
('Pulse D3 — Pós-kickoff', 'ativacao', 'd3',
'Oi [nome], tudo bem?

Estamos chegando no D3 aqui juntos. Queria saber como você está se sentindo com a plataforma nessa primeira semana — se já deu uma explorada, se surgiu alguma dúvida.

Pode me contar aqui mesmo, estou de olho!',
ARRAY['nome']),

('Verificação D7 — Jornada ativa', 'ativacao', 'd7',
'Oi [nome]! Chegamos na primeira semana.

Queria confirmar: você conseguiu acessar sua Jornada na plataforma e ver os primeiros passos? É ali que fica o seu roteiro de implementação.

Se não chegou a ver ainda, me fala que te guio rapidinho.',
ARRAY['nome']),

('Verificação D14 — Primeira ferramenta', 'ativacao', 'd14',
'Oi [nome], tudo certo?

Já fazem 2 semanas desde o início! Queria saber: você já construiu a sua primeira ferramenta do Arsenal?

O Arsenal é onde ficam os modelos práticos — roteiro de consulta, script de vendas, ICP e por aí vai. Qual ferramenta você escolheu começar?',
ARRAY['nome']),

('Incentivo D21 — CRM ativo', 'ativacao', 'd21',
'Oi [nome]! Chegando no D21.

Uma tarefa importante nessa fase: cadastrar os primeiros leads no CRM. Mesmo que seja 1 ou 2, já vale — isso ativa o rastreamento do seu funil.

Você já fez o primeiro cadastro? Se precisar de ajuda, posso fazer um Zoom rapidinho contigo.',
ARRAY['nome']),

-- ─── EXECUÇÃO ─────────────────────────────────────────────────────────────
('Convite — Reunião quinzenal', 'execucao', 'reuniao',
'Oi [nome]! Tudo bem?

Queria marcar nossa reunião de acompanhamento. Como ficam os próximos dias para você?

Posso te mandar algumas opções de horário se preferir.',
ARRAY['nome']),

('Resumo pós-reunião', 'execucao', 'pos_reuniao',
'Oi [nome], obrigado pela conversa de hoje!

Só para registrar os próximos passos que combinamos:
— [passo 1]
— [passo 2]

Nossa próxima conversa fica para daqui [prazo]. Qualquer dúvida, pode me chamar aqui.',
ARRAY['nome', 'passo 1', 'passo 2', 'prazo']),

('Celebração D60 — Primeiros resultados', 'execucao', 'd60',
'Oi [nome]! Chegamos nos 2 meses juntos.

Queria celebrar esse marco: você já está com a jornada avançando e com resultados começando a aparecer no CRM.

Esse é o começo do que a gente chama de "tração" — quando a implementação começa a virar rotina. Parabéns pelo comprometimento!',
ARRAY['nome']),

-- ─── RISCO ────────────────────────────────────────────────────────────────
('Resgate D+1 — Informal', 'risco', 'ghosting_d1',
'Oi [nome], tudo bem?

Faz um tempo que não nos falamos. Queria saber como você está — pode me responder aqui quando puder, sem pressa.',
ARRAY['nome']),

('Resgate D+3 — Direto', 'risco', 'ghosting_d3',
'Oi [nome]! Tentei falar contigo esses dias mas não consegui.

Queria entender: o que está travando agora? Pode ser algo com a plataforma, falta de tempo, dúvidas sobre o processo — me conta que a gente resolve juntos.',
ARRAY['nome']),

('Resgate D+5 — Roteiro de áudio', 'risco', 'ghosting_d5',
'[Enviar como ÁUDIO — roteiro sugerido]

"Oi [nome], aqui é [seu nome], do time da Descompliquei.

Estou passando porque faz alguns dias que a gente não conversa, e queria entender como você está se sentindo com a plataforma.

Não precisa ser nada longo — só me manda um retorno quando puder, pode ser até uma resposta aqui no WhatsApp mesmo.

Estamos aqui para te apoiar, tá bom? Abraço!"',
ARRAY['nome', 'seu nome']),

('Resgate D+10 — E-mail completo', 'risco', 'ghosting_d10',
'Assunto: [nome da clínica] — queria entender como você está

Oi [nome],

Tentei entrar em contato por WhatsApp nas últimas semanas e não consegui retorno. Quero entender se está tudo bem com você e com a sua jornada na plataforma.

Sei que a rotina da clínica é intensa. Por isso, quero deixar claro: estou disponível para adaptar o nosso ritmo de acompanhamento ao que funciona melhor para você agora.

Podemos conversar 15 minutos essa semana para realinhar? Me responde neste e-mail ou me chama no WhatsApp.

Abraço,
[seu nome]
Time de CS — Descompliquei',
ARRAY['nome', 'nome da clínica', 'seu nome']),

-- ─── ESCALADA ─────────────────────────────────────────────────────────────
('Apresentação — Líder de CS', 'escalada', 'apresentacao_lider',
'Oi [nome]! Tudo bem?

Quero te apresentar [nome do líder], que é responsável pelas contas estratégicas aqui no nosso time. A partir de agora, ele vai estar junto comigo no seu acompanhamento para garantirmos o melhor suporte possível.

[nome do líder], passo o contato do [nome] para você!',
ARRAY['nome', 'nome do líder']),

('Retomada pós-escalada', 'escalada', 'retomada',
'Oi [nome]! Tudo bem?

Sou [nome do líder], do time de CS da Descompliquei. O [CSM anterior] me trouxe para o seu acompanhamento.

Queria marcar uma conversa rápida de 30 minutos esta semana para entender como você está, o que está funcionando e como podemos tornar esse processo mais leve para você.

Quando fica bom?',
ARRAY['nome', 'nome do líder', 'CSM anterior']),

-- ─── EXPANSÃO ─────────────────────────────────────────────────────────────
('Script de indicação', 'expansao', 'indicacao',
'Oi [nome]! Tudo bem?

Estamos muito felizes com o progresso que você está tendo. Você chegou a [marco] e isso é resultado do seu comprometimento.

Tenho uma pergunta: você conhece alguém — um colega de profissão, um amigo da área — que poderia se beneficiar do mesmo processo?

Se sim, temos um programa de indicação que pode te gerar benefícios também. O que acha de conversarmos sobre isso?',
ARRAY['nome', 'marco']),

('Solicitação de depoimento', 'expansao', 'depoimento',
'Oi [nome]! Tudo certo?

Você está entre os clientes que mais evoluíram na plataforma e isso nos orgulha muito.

Queria te pedir um favor: você toparia gravar um depoimento curto (pode ser um áudio ou vídeo de 1-2 minutos) contando sua experiência? Isso ajuda muito novos clientes a entenderem o impacto do processo.

Me fala se topa, e eu te oriento como fazer!',
ARRAY['nome']);
