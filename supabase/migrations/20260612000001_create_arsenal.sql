-- Arsenal Comercial: tabelas, RLS e seed de dados

-- =====================================================================
-- TABELAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS arsenal_categorias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  descricao   text,
  frase_ancora text,
  icone       text,
  ordem       int NOT NULL DEFAULT 0,
  slug        text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS arsenal_ferramentas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id        uuid NOT NULL REFERENCES arsenal_categorias(id) ON DELETE CASCADE,
  nome                text NOT NULL,
  descricao           text,
  slug                text NOT NULL UNIQUE,
  ordem               int NOT NULL DEFAULT 0,
  video_url           text,
  texto_aprenda       text,
  template_construa   text,
  ativo               boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS arsenal_progresso (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ferramenta_id uuid NOT NULL REFERENCES arsenal_ferramentas(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'nao_iniciado'
                  CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ferramenta_id)
);

CREATE TABLE IF NOT EXISTS arsenal_construcoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ferramenta_id uuid NOT NULL REFERENCES arsenal_ferramentas(id) ON DELETE CASCADE,
  conteudo      text NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ferramenta_id)
);

-- =====================================================================
-- RLS
-- =====================================================================

ALTER TABLE arsenal_categorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE arsenal_ferramentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arsenal_progresso   ENABLE ROW LEVEL SECURITY;
ALTER TABLE arsenal_construcoes ENABLE ROW LEVEL SECURITY;

-- Categorias e ferramentas: leitura pública para autenticados
CREATE POLICY "Arsenal categorias leitura" ON arsenal_categorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Arsenal ferramentas leitura" ON arsenal_ferramentas
  FOR SELECT TO authenticated USING (true);

-- Progresso: cada user gerencia o seu
CREATE POLICY "Arsenal progresso select" ON arsenal_progresso
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Arsenal progresso insert" ON arsenal_progresso
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Arsenal progresso update" ON arsenal_progresso
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Construções: cada user gerencia o seu
CREATE POLICY "Arsenal construcoes select" ON arsenal_construcoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Arsenal construcoes insert" ON arsenal_construcoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Arsenal construcoes update" ON arsenal_construcoes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- SEED: CATEGORIAS
-- =====================================================================

INSERT INTO arsenal_categorias (nome, descricao, frase_ancora, icone, ordem, slug) VALUES
  ('Diagnóstico e Clareza Comercial',    'Mapeie os gargalos e enxergue onde o dinheiro está vazando antes de agir.', 'Antes de agir, enxergue.',                             'Search',    1, 'diagnostico-clareza'),
  ('Oferta, Precificação e Valor',       'Estruture o que você vende para gerar valor real antes do preço.',           'Ticket baixo com agenda lotada não é sucesso. É armadilha.','Tag',      2, 'oferta-precificacao-valor'),
  ('Atendimento e Conversão',            'Onde o dinheiro é ganho ou perdido — do acolhimento ao fechamento.',         'Onde o dinheiro é ganho ou perdido.',                  'MessageSquare', 3, 'atendimento-conversao'),
  ('Funil, Follow-up e Reativação',      'O dinheiro mais rápido da clínica está na base que você ignora.',            'O dinheiro mais rápido da clínica está na base que você ignora.', 'Filter', 4, 'funil-followup-reativacao'),
  ('Alto Ticket, Protocolos e Recorrência', 'De procedimento barato para negócio premium com recorrência real.',       'De procedimento barato para negócio premium.',         'Trophy',    5, 'alto-ticket-protocolos-recorrencia'),
  ('Canais de Aquisição',                'Quem depende de uma fonte é refém dela. Diversifique com método.',           'Quem depende de uma fonte é refém dela.',              'Radio',     6, 'canais-aquisicao'),
  ('Montando sua Equipe Comercial',      'Contrate certo, treine com método e não dependa de si mesmo.',               'Você não precisa fazer tudo sozinho. Mas precisa contratar certo.', 'UserPlus', 7, 'montando-equipe-comercial'),
  ('Gestão do Time Comercial',           'Saia da operação sem que a conversão caia.',                                 'Sair da operação sem que a conversão caia.',           'Settings2', 8, 'gestao-time-comercial');

-- =====================================================================
-- SEED: FERRAMENTAS
-- =====================================================================

-- Categoria 01: Diagnóstico e Clareza Comercial
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'diagnostico-clareza'), 'Diagnóstico Comercial da Clínica',  'Mapa dos gargalos, onde o dinheiro está vazando',                                   'diagnostico-comercial',       1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'diagnostico-clareza'), 'Definição do Paciente Ideal (ICP)', 'Quem é o perfil mais lucrativo e como atrair mais dele',                             'definicao-paciente-ideal',    2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'diagnostico-clareza'), 'Posicionamento de Nicho',           'Como se especializar para cobrar mais e concorrer menos',                            'posicionamento-nicho',        3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'diagnostico-clareza'), 'Painel de Métricas do Dono',        'Os números que realmente importam: conversão, ticket, LTV, CAC',                    'painel-metricas-dono',        4);

-- Categoria 02: Oferta, Precificação e Valor
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-valor'), 'Arquitetura da Oferta',           'Como estruturar o que você vende para gerar valor antes do preço',                  'arquitetura-oferta',          1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-valor'), 'Precificação Estratégica',        'Precificar com base em valor, não em custo ou concorrência',                        'precificacao-estrategica',    2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-valor'), 'Benchmarking de Mercado',         'Como usar a concorrência a seu favor',                                              'benchmarking-mercado',        3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-valor'), 'Proposta Comercial Formal',       'Como apresentar proposta para pacientes de alto perfil',                            'proposta-comercial-formal',   4),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-valor'), 'Negociação Sem Desconto',         'Scripts e ancoragem para manter preço sob pressão',                                 'negociacao-sem-desconto',     5),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-valor'), 'Narrativa de Valor por Procedimento', 'De "botox R$1.500" para protocolo com nome e justificativa',                   'narrativa-valor-procedimento',6);

-- Categoria 03: Atendimento e Conversão
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'), 'Estrutura de Atendimento Consultivo', 'Do acolhimento ao fechamento, com método',                                          'estrutura-atendimento-consultivo', 1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'), 'Treinamento da Recepcionista',        'Protocolo completo para quem atende na ponta',                                      'treinamento-recepcionista',        2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'), 'Banco de Quebra de Objeções',         'Respostas mapeadas e testadas por estágio do funil',                                'banco-quebra-objecoes',            3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'), 'Técnicas de Fechamento',              'Métodos, gatilhos e ancoragem sem pressão',                                         'tecnicas-fechamento',              4),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'), 'Gestão de No-Show',                   'Protocolo de confirmação e redução de faltas',                                      'gestao-no-show',                   5);

-- Categoria 04: Funil, Follow-up e Reativação
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'funil-followup-reativacao'), 'Arquitetura do Funil Comercial',  'Etapas, responsáveis e maiores vazamentos',                                         'arquitetura-funil-comercial',  1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'funil-followup-reativacao'), 'Cadência de Follow-up',           'Sequência de mensagens por etapa de abandono',                                      'cadencia-followup',            2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'funil-followup-reativacao'), 'Reativação de Base (Quick Win)',  'Receita imediata com pacientes já existentes',                                      'reativacao-base-quick-win',    3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'funil-followup-reativacao'), 'WhatsApp Ativo',                  'Abordagem proativa com inativos, scripts e segmentação',                            'whatsapp-ativo',               4),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'funil-followup-reativacao'), 'Análise de Conversão por Etapa',  'Benchmarks e otimização com base em dados',                                         'analise-conversao-etapa',      5),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'funil-followup-reativacao'), 'Recuperação de Leads Perdidos',   'Como reabordar quem disse não ou sumiu',                                            'recuperacao-leads-perdidos',   6);

-- Categoria 05: Alto Ticket, Protocolos e Recorrência
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'alto-ticket-protocolos-recorrencia'), 'Por que Ticket Baixo Mata a Clínica', 'A matemática que prova que trabalhar mais não resolve',           'ticket-baixo-mata-clinica',     1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'alto-ticket-protocolos-recorrencia'), 'Anatomia de um Protocolo Premium',    'Resultado, experiência e valor percebido',                        'anatomia-protocolo-premium',   2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'alto-ticket-protocolos-recorrencia'), 'Construção do Seu Protocolo Premium', 'Combinar procedimentos, nomear e justificar o preço',             'construcao-protocolo-premium', 3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'alto-ticket-protocolos-recorrencia'), 'Venda de Alto Ticket no Atendimento', 'Como conduzir para fechar R$5k–R$25k sem parecer que vende',      'venda-alto-ticket-atendimento',4),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'alto-ticket-protocolos-recorrencia'), 'Pacotes, Combos e Manutenção',        'Recorrência que o paciente assina e não cancela',                 'pacotes-combos-manutencao',    5),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'alto-ticket-protocolos-recorrencia'), 'Upsell e Cross-sell Dentro da Consulta', 'Oferecer o próximo procedimento no momento certo',             'upsell-cross-sell-consulta',   6);

-- Categoria 06: Canais de Aquisição
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'), 'Programa de Indicação Estruturado',      'Paciente vira promotor ativo com sistema',                                          'programa-indicacao-estruturado',1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'), 'Social Selling',                         'Converter seguidores em pacientes pelo direct, sem anúncio',                        'social-selling',                2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'), 'Grupo de WhatsApp como Canal de Vendas', 'Comunidade própria para gerar demanda',                                             'grupo-whatsapp-vendas',         3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'), 'Parcerias Estratégicas',                 'Acordos com outros profissionais para geração mútua de base',                       'parcerias-estrategicas',        4),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'), 'Eventos Próprios na Clínica',            'Open House, Dia da Beleza, volume de leads em um dia',                              'eventos-proprios-clinica',      5),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'), 'Autoridade Digital como Ferramenta Comercial', 'Como a presença digital encurta o ciclo de venda',                          'autoridade-digital-comercial',  6);

-- Categoria 07: Montando sua Equipe Comercial
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'montando-equipe-comercial'), 'Perfil Ideal de Contratação',    'O que buscar em uma recepcionista/closer de clínica estética',                      'perfil-ideal-contratacao',  1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'montando-equipe-comercial'), 'Processo Seletivo Estruturado',  'Como avaliar, testar e selecionar com critério',                                    'processo-seletivo-estruturado',2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'montando-equipe-comercial'), 'Modelo de Comissionamento',      'Fixo + variável alinhado ao resultado, sem criar dependência',                      'modelo-comissionamento',    3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'montando-equipe-comercial'), 'Onboarding Completo',            'Como treinar do zero usando o arsenal e o CRM',                                    'onboarding-equipe-completo',4),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'montando-equipe-comercial'), 'Métricas Individuais',           'Como medir cada membro do time separadamente no CRM',                              'metricas-individuais-time', 5);

-- Categoria 08: Gestão do Time Comercial
INSERT INTO arsenal_ferramentas (categoria_id, nome, descricao, slug, ordem) VALUES
  ((SELECT id FROM arsenal_categorias WHERE slug = 'gestao-time-comercial'), 'Arquitetura de Processos Comerciais', 'Quem faz o quê, quando e como medir',                                             'arquitetura-processos-comerciais',1),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'gestao-time-comercial'), 'Delegação do Comercial',             'Como transferir responsabilidades sem perder controle',                             'delegacao-comercial',             2),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'gestao-time-comercial'), 'Cultura de Vendas',                  'Mentalidade vendedora na clínica, sem pressão, com método',                        'cultura-vendas',                  3),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'gestao-time-comercial'), 'Relatório Comercial Semanal',        'O ritual de leitura de números e tomada de decisão',                               'relatorio-comercial-semanal',     4),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'gestao-time-comercial'), 'SOPs Comerciais',                    'Processos padrão documentados, o negócio que roda sem o dono',                     'sops-comerciais',                 5);
