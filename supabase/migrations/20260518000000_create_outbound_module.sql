-- ============================================================
-- MIGRATION: create_outbound_module
-- Módulo de Prospecção Ativa (Outbound) — Descompliquei
-- ============================================================

-- ============================================================
-- TABELA 1: outbound_stages
-- ============================================================
CREATE TABLE public.outbound_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6366f1',
  posicao_ordem INTEGER NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'ativo' CHECK (tipo IN ('ativo', 'ganho', 'perdido')),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 2: outbound_prospectos
-- ============================================================
CREATE TABLE public.outbound_prospectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cargo TEXT,
  clinica TEXT,
  cidade TEXT,
  especialidade TEXT,
  faturamento_estimado TEXT,
  tamanho_equipe INTEGER,
  tempo_mercado TEXT,
  canal_origem TEXT,
  stage_id UUID REFERENCES public.outbound_stages(id),
  lead_scoring TEXT CHECK (lead_scoring IN ('A', 'B', 'C', 'D')),
  script_id UUID,
  whatsapp_lead_id UUID REFERENCES public.leads(id),
  motivo_perda TEXT,
  observacoes TEXT,
  ultimo_contato TIMESTAMPTZ,
  proxima_acao TEXT,
  proxima_acao_data TIMESTAMPTZ,
  total_tentativas INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 3: outbound_ligacoes
-- ============================================================
CREATE TABLE public.outbound_ligacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospecto_id UUID NOT NULL REFERENCES public.outbound_prospectos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  duracao_segundos INTEGER,
  numero_tentativa INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN (
    'atendeu',
    'nao_atendeu',
    'ocupado',
    'caixa_postal',
    'numero_errado',
    'recusou'
  )),
  resultado TEXT CHECK (resultado IN (
    'sem_interesse',
    'qualificado',
    'agendou_call',
    'quer_mais_info',
    'ligar_depois',
    'nao_e_icp',
    'ja_tem_solucao'
  )),
  script_id UUID,
  anotacao TEXT,
  proxima_acao TEXT,
  proxima_acao_data TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 4: outbound_scripts
-- ============================================================
CREATE TABLE public.outbound_scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  objetivo TEXT NOT NULL CHECK (objetivo IN (
    'abertura',
    'qualificacao',
    'contorno_objecao',
    'fechamento_agendamento',
    'follow_up',
    'reativacao'
  )),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho',
    'em_teste',
    'aprovado',
    'arquivado'
  )),
  conteudo TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- FKs de script_id em prospectos e ligacoes
ALTER TABLE public.outbound_prospectos
  ADD CONSTRAINT outbound_prospectos_script_id_fkey
  FOREIGN KEY (script_id) REFERENCES public.outbound_scripts(id);

ALTER TABLE public.outbound_ligacoes
  ADD CONSTRAINT outbound_ligacoes_script_id_fkey
  FOREIGN KEY (script_id) REFERENCES public.outbound_scripts(id);

-- ============================================================
-- TABELA 5: outbound_script_prospectos
-- ============================================================
CREATE TABLE public.outbound_script_prospectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.outbound_scripts(id) ON DELETE CASCADE,
  prospecto_id UUID NOT NULL REFERENCES public.outbound_prospectos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  associado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(script_id, prospecto_id)
);

-- ============================================================
-- TABELA 6: outbound_historico
-- ============================================================
CREATE TABLE public.outbound_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospecto_id UUID NOT NULL REFERENCES public.outbound_prospectos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'stage_alterado',
    'scoring_alterado',
    'ligacao_registrada',
    'mensagem_enviada',
    'agendamento_criado',
    'script_associado',
    'nota_adicionada',
    'prospecto_criado',
    'campo_alterado',
    'venda_registrada'
  )),
  campo_alterado TEXT,
  valor_anterior TEXT,
  valor_novo TEXT,
  descricao TEXT,
  metadados JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 7: outbound_metas
-- ============================================================
CREATE TABLE public.outbound_metas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  periodo_tipo TEXT NOT NULL CHECK (periodo_tipo IN ('semanal', 'mensal', 'trimestral')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  meta_ligacoes INTEGER,
  meta_conexoes INTEGER,
  meta_qualificados INTEGER,
  meta_calls_agendadas INTEGER,
  meta_show_rate NUMERIC(5,2),
  meta_fechamentos INTEGER,
  meta_receita NUMERIC(12,2),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: atualizado_em (reutiliza handle_updated_at existente)
-- ============================================================
CREATE TRIGGER trigger_outbound_stages_updated_at
  BEFORE UPDATE ON public.outbound_stages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_outbound_prospectos_updated_at
  BEFORE UPDATE ON public.outbound_prospectos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_outbound_scripts_updated_at
  BEFORE UPDATE ON public.outbound_scripts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_outbound_metas_updated_at
  BEFORE UPDATE ON public.outbound_metas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TRIGGER: atualizar total_tentativas + ultimo_contato
-- ============================================================
DROP FUNCTION IF EXISTS public.update_prospecto_total_tentativas() CASCADE;

CREATE OR REPLACE FUNCTION public.update_prospecto_total_tentativas()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.outbound_prospectos
  SET total_tentativas = (
    SELECT COUNT(*) FROM public.outbound_ligacoes
    WHERE prospecto_id = NEW.prospecto_id
  ),
  ultimo_contato = NEW.data_hora,
  atualizado_em = NOW()
  WHERE id = NEW.prospecto_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tentativas
  AFTER INSERT ON public.outbound_ligacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_prospecto_total_tentativas();

-- ============================================================
-- TRIGGER: histórico automático (stage + scoring)
-- ============================================================
DROP FUNCTION IF EXISTS public.registrar_historico_prospecto() CASCADE;

CREATE OR REPLACE FUNCTION public.registrar_historico_prospecto()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO public.outbound_historico
      (organization_id, prospecto_id, tipo, campo_alterado, valor_anterior, valor_novo, descricao)
    VALUES
      (NEW.organization_id, NEW.id, 'stage_alterado', 'stage_id',
       OLD.stage_id::TEXT, NEW.stage_id::TEXT, 'Stage do prospecto alterado');
  END IF;

  IF OLD.lead_scoring IS DISTINCT FROM NEW.lead_scoring THEN
    INSERT INTO public.outbound_historico
      (organization_id, prospecto_id, tipo, campo_alterado, valor_anterior, valor_novo, descricao)
    VALUES
      (NEW.organization_id, NEW.id, 'scoring_alterado', 'lead_scoring',
       OLD.lead_scoring, NEW.lead_scoring,
       'Scoring do prospecto alterado de ' || COALESCE(OLD.lead_scoring,'?') || ' para ' || NEW.lead_scoring);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_historico_prospecto
  AFTER UPDATE ON public.outbound_prospectos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_prospecto();

-- ============================================================
-- RLS: habilitar + políticas por organização
-- ============================================================
ALTER TABLE public.outbound_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_stages_org_policy" ON public.outbound_stages
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.perfis WHERE id = auth.uid()
    )
  );

ALTER TABLE public.outbound_prospectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_prospectos_org_policy" ON public.outbound_prospectos
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.perfis WHERE id = auth.uid()
    )
  );

ALTER TABLE public.outbound_ligacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_ligacoes_org_policy" ON public.outbound_ligacoes
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.perfis WHERE id = auth.uid()
    )
  );

ALTER TABLE public.outbound_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_scripts_org_policy" ON public.outbound_scripts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.perfis WHERE id = auth.uid()
    )
  );

ALTER TABLE public.outbound_script_prospectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_script_prospectos_org_policy" ON public.outbound_script_prospectos
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.perfis WHERE id = auth.uid()
    )
  );

ALTER TABLE public.outbound_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_historico_org_policy" ON public.outbound_historico
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.perfis WHERE id = auth.uid()
    )
  );

ALTER TABLE public.outbound_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_metas_org_policy" ON public.outbound_metas
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.perfis WHERE id = auth.uid()
    )
  );
