-- ============================================================
-- ARSENAL RESTRUCTURE — Blocos, Aulas + Nova Estrutura Ferramentas
-- ============================================================

-- PASSO 1: Limpar estrutura atual (preservando progresso)
DELETE FROM arsenal_ferramentas;
DELETE FROM arsenal_categorias;

-- PASSO 2: Criar tabelas novas

CREATE TABLE IF NOT EXISTS arsenal_blocos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  slug text UNIQUE NOT NULL,
  ordem int NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('aulas', 'ferramentas')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arsenal_aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id uuid REFERENCES arsenal_blocos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  slug text UNIQUE NOT NULL,
  ordem int NOT NULL,
  video_url text,
  texto_aprenda text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arsenal_aulas_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  aula_id uuid REFERENCES arsenal_aulas(id) ON DELETE CASCADE,
  status text DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  anotacoes text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, aula_id)
);

-- RLS
ALTER TABLE arsenal_blocos ENABLE ROW LEVEL SECURITY;
ALTER TABLE arsenal_aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arsenal_aulas_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arsenal_blocos_public_read" ON arsenal_blocos
  FOR SELECT USING (true);

CREATE POLICY "arsenal_aulas_public_read" ON arsenal_aulas
  FOR SELECT USING (true);

CREATE POLICY "arsenal_aulas_progresso_own" ON arsenal_aulas_progresso
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- PASSO 3: Popular arsenal_blocos

INSERT INTO arsenal_blocos (nome, descricao, slug, ordem, tipo) VALUES
  ('Plataforma e Tecnologia', 'Como operar as ferramentas e extrair o máximo da tecnologia disponível.', 'plataforma-tecnologia', 1, 'aulas'),
  ('Mentalidade e Psicologia de Vendas', 'A camada invisível que define o teto comercial da clínica.', 'mentalidade-psicologia', 2, 'aulas');

-- PASSO 4: Popular arsenal_aulas

INSERT INTO arsenal_aulas (bloco_id, nome, slug, ordem) VALUES
  -- Bloco plataforma-tecnologia
  ((SELECT id FROM arsenal_blocos WHERE slug = 'plataforma-tecnologia'), 'Como Operar o CRM Descompliquei', 'operar-crm', 1),
  ((SELECT id FROM arsenal_blocos WHERE slug = 'plataforma-tecnologia'), 'Configurando a IA de Pré-Atendimento', 'configurar-ia', 2),
  ((SELECT id FROM arsenal_blocos WHERE slug = 'plataforma-tecnologia'), 'Como Usar o Athos GS', 'usar-athos', 3),
  ((SELECT id FROM arsenal_blocos WHERE slug = 'plataforma-tecnologia'), 'Leitura de Métricas e Tomada de Decisão', 'metricas-decisao', 4),
  -- Bloco mentalidade-psicologia
  ((SELECT id FROM arsenal_blocos WHERE slug = 'mentalidade-psicologia'), 'Diagnóstico de Mentalidade Comercial', 'diagnostico-mentalidade', 1),
  ((SELECT id FROM arsenal_blocos WHERE slug = 'mentalidade-psicologia'), 'Crenças Limitantes sobre Preço e Venda', 'crencas-limitantes', 2),
  ((SELECT id FROM arsenal_blocos WHERE slug = 'mentalidade-psicologia'), 'Psicologia da Decisão do Paciente', 'psicologia-decisao', 3);

-- PASSO 5: Popular arsenal_categorias

INSERT INTO arsenal_categorias (nome, slug, ordem, descricao, frase_ancora) VALUES
  ('Fundação Comercial', 'fundacao-comercial', 1,
   'O alicerce. Sem isso, nada que vier depois se sustenta.',
   'Antes de agir, enxergue.'),
  ('Oferta, Precificação e Posicionamento', 'oferta-precificacao-posicionamento', 2,
   'O que você vende, por quanto e como justifica.',
   'Ticket baixo com agenda lotada não é sucesso. É armadilha.'),
  ('Atendimento e Conversão', 'atendimento-conversao', 3,
   'Onde o dinheiro é ganho ou perdido.',
   'A venda não começa no fechamento. Começa no primeiro contato.'),
  ('Follow-up e Reativação', 'followup-reativacao', 4,
   'O dinheiro mais rápido está na base que você ignora.',
   'O dinheiro mais rápido da clínica está na base que você ignora.'),
  ('Canais de Aquisição', 'canais-aquisicao', 5,
   'Quem depende de uma fonte é refém dela.',
   'Múltiplos canais é previsibilidade. Previsibilidade é crescimento.'),
  ('Equipe Comercial', 'equipe-comercial', 6,
   'Montar, treinar, remunerar e gerir.',
   'Você não precisa fazer tudo sozinho. Mas precisa contratar certo.'),
  ('Metas e Gestão Comercial', 'metas-gestao-comercial', 7,
   'Gerir com dados, não com achismo.',
   'Meta sem dado é desejo. Projeção com dado é gestão.');

-- PASSO 6: Popular arsenal_ferramentas

INSERT INTO arsenal_ferramentas (categoria_id, nome, slug, ordem, descricao) VALUES
  -- Fundação Comercial
  ((SELECT id FROM arsenal_categorias WHERE slug = 'fundacao-comercial'),
   'Diagnóstico Comercial da Clínica', 'diagnostico-comercial-clinica', 1,
   'Mapa dos gargalos e vazamentos da operação comercial.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'fundacao-comercial'),
   'Definição do Paciente Ideal (ICP)', 'definicao-paciente-ideal', 2,
   'Quem é o perfil mais lucrativo e como atrair mais dele.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'fundacao-comercial'),
   'Arquitetura do Funil Comercial', 'arquitetura-funil-comercial', 3,
   'Etapas do funil, responsáveis e métricas de cada fase.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'fundacao-comercial'),
   'Arquitetura de Processos Comerciais', 'arquitetura-processos-comerciais', 4,
   'Quem faz o quê, quando e como medir.'),

  -- Oferta, Precificação e Posicionamento
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-posicionamento'),
   'Posicionamento de Nicho', 'posicionamento-nicho', 1,
   'Como se especializar para cobrar mais e concorrer menos.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-posicionamento'),
   'Arquitetura da Oferta', 'arquitetura-oferta', 2,
   'Estruturar o que você vende para gerar valor antes do preço.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'oferta-precificacao-posicionamento'),
   'Precificação Estratégica', 'precificacao-estrategica', 3,
   'Precificar com base em valor, não em custo ou concorrência.'),

  -- Atendimento e Conversão
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'),
   'Estrutura de Atendimento Consultivo', 'estrutura-atendimento-consultivo', 1,
   'Do primeiro contato ao fechamento de alto ticket, com método.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'),
   'Banco de Quebra de Objeções', 'banco-quebra-objecoes', 2,
   'Respostas mapeadas e testadas por estágio do funil.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'atendimento-conversao'),
   'Experiência e Pós-Atendimento', 'experiencia-pos-atendimento', 3,
   'O processo que transforma cada atendimento em recorrência e indicação.'),

  -- Follow-up e Reativação
  ((SELECT id FROM arsenal_categorias WHERE slug = 'followup-reativacao'),
   'Follow-up de Leads Ativos', 'followup-leads-ativos', 1,
   'Cadência completa para leads que não fecharam.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'followup-reativacao'),
   'Reativação de Base Inativa', 'reativacao-base-inativa', 2,
   'Campanha de reativação para pacientes que sumiram.'),

  -- Canais de Aquisição
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'),
   'Priorização de Canal', 'priorizacao-canal', 1,
   'Como escolher por onde começar com base no perfil da clínica.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'),
   'Canais Orgânicos Digitais', 'canais-organicos-digitais', 2,
   'Instagram e WhatsApp como ferramentas de aquisição sem anúncio.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'),
   'Programa de Indicação Estruturado', 'programa-indicacao-estruturado', 3,
   'Paciente vira promotor ativo com sistema.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'canais-aquisicao'),
   'Parcerias Estratégicas', 'parcerias-estrategicas', 4,
   'Acordos com outros profissionais para geração mútua de base.'),

  -- Equipe Comercial
  ((SELECT id FROM arsenal_categorias WHERE slug = 'equipe-comercial'),
   'Perfil Ideal de Contratação', 'perfil-ideal-contratacao', 1,
   'O que buscar em recepcionista ou closer de clínica estética.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'equipe-comercial'),
   'Processo Seletivo Estruturado', 'processo-seletivo-estruturado', 2,
   'Como avaliar, testar e selecionar com critério.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'equipe-comercial'),
   'Modelo de Comissionamento', 'modelo-comissionamento', 3,
   'Fixo + variável alinhado ao resultado, sem criar dependência.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'equipe-comercial'),
   'Onboarding da Equipe', 'onboarding-equipe', 4,
   'Como treinar do zero usando o arsenal e o CRM.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'equipe-comercial'),
   'Delegação do Comercial', 'delegacao-comercial', 5,
   'Como transferir responsabilidades sem perder controle.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'equipe-comercial'),
   'SOPs Comerciais', 'sops-comerciais', 6,
   'Processos padrão documentados — o negócio que roda sem o dono.'),

  -- Metas e Gestão Comercial
  ((SELECT id FROM arsenal_categorias WHERE slug = 'metas-gestao-comercial'),
   'Forecasting', 'forecasting', 1,
   'Projeção de faturamento com base em dados reais da operação.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'metas-gestao-comercial'),
   'Metas Comerciais', 'metas-comerciais', 2,
   'Definir, acompanhar e revisar metas com método.'),
  ((SELECT id FROM arsenal_categorias WHERE slug = 'metas-gestao-comercial'),
   'Calendário Comercial', 'calendario-comercial', 3,
   'Planejamento anual cruzando sazonalidade com capacidade da clínica.');
