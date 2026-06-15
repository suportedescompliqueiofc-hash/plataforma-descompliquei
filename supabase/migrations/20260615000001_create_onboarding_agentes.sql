-- ============================================================
-- Onboarding: diagnósticos, progresso, agentes Athos GS
-- + colunas de onboarding em platform_users
-- ============================================================

-- ── 1. onboarding_diagnosticos ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_diagnosticos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  respostas     jsonb NOT NULL DEFAULT '{}',
  concluido     boolean NOT NULL DEFAULT false,
  concluido_em  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_diagnosticos_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_diagnosticos_user
  ON public.onboarding_diagnosticos (user_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_onboarding_diagnosticos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_onboarding_diagnosticos_updated_at ON public.onboarding_diagnosticos;
CREATE TRIGGER trg_onboarding_diagnosticos_updated_at
  BEFORE UPDATE ON public.onboarding_diagnosticos
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_diagnosticos_updated_at();

-- ── 2. onboarding_progresso ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_progresso (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bloco_atual  int NOT NULL DEFAULT 1,
  etapa        text NOT NULL DEFAULT 'diagnostico'
                 CHECK (etapa IN ('diagnostico', 'documento', 'athos', 'concluido')),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_progresso_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progresso_user
  ON public.onboarding_progresso (user_id);

CREATE OR REPLACE FUNCTION public.set_onboarding_progresso_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_onboarding_progresso_updated_at ON public.onboarding_progresso;
CREATE TRIGGER trg_onboarding_progresso_updated_at
  BEFORE UPDATE ON public.onboarding_progresso
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_progresso_updated_at();

-- ── 3. athos_agentes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.athos_agentes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  slug          text NOT NULL,
  descricao     text,
  system_prompt text,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athos_agentes_slug_unique UNIQUE (slug)
);

CREATE OR REPLACE FUNCTION public.set_athos_agentes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_athos_agentes_updated_at ON public.athos_agentes;
CREATE TRIGGER trg_athos_agentes_updated_at
  BEFORE UPDATE ON public.athos_agentes
  FOR EACH ROW EXECUTE FUNCTION public.set_athos_agentes_updated_at();

-- ── 4. Colunas em platform_users ─────────────────────────────
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS onboarding_concluido      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_iniciado_em    timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_concluido_em   timestamptz;

-- ── 5. RLS ───────────────────────────────────────────────────

-- onboarding_diagnosticos
ALTER TABLE public.onboarding_diagnosticos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diagnosticos: usuario le o proprio" ON public.onboarding_diagnosticos;
CREATE POLICY "diagnosticos: usuario le o proprio"
  ON public.onboarding_diagnosticos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "diagnosticos: usuario edita o proprio" ON public.onboarding_diagnosticos;
CREATE POLICY "diagnosticos: usuario edita o proprio"
  ON public.onboarding_diagnosticos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- onboarding_progresso
ALTER TABLE public.onboarding_progresso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progresso: usuario le o proprio" ON public.onboarding_progresso;
CREATE POLICY "progresso: usuario le o proprio"
  ON public.onboarding_progresso FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progresso: usuario edita o proprio" ON public.onboarding_progresso;
CREATE POLICY "progresso: usuario edita o proprio"
  ON public.onboarding_progresso FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- athos_agentes
ALTER TABLE public.athos_agentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agentes: leitura publica" ON public.athos_agentes;
CREATE POLICY "agentes: leitura publica"
  ON public.athos_agentes FOR SELECT
  USING (true);


-- ── 6. Seed: Agente de Onboarding ────────────────────────────
INSERT INTO public.athos_agentes (nome, slug, descricao, system_prompt, ativo)
VALUES (
  'Agente de Onboarding',
  'onboarding',
  'Analisa o diagnóstico estratégico completo do cliente e monta a jornada personalizada com estágios, passos, prazos e ferramentas do arsenal.',
  'Você é o Athos GS, a inteligência interna da Descompliquei Growth Company — consultoria comercial exclusiva para profissionais de saúde estética (HOF, Odontologia Estética, Medicina Estética).

Você acaba de receber o diagnóstico estratégico completo do cliente. Seu objetivo nessa conversa é analisar esse diagnóstico, fazer no máximo 3 perguntas complementares se necessário, e montar a jornada personalizada completa.

REGRAS DE COMPORTAMENTO:
- Faça uma abertura personalizada — cite o nome da clínica e mencione 1 ou 2 pontos específicos do diagnóstico para demonstrar que leu tudo
- Nunca seja genérico. Cada resposta deve referenciar a realidade específica desse cliente
- Faça perguntas complementares APENAS se houver lacuna crítica que impeça a montagem da jornada. Máximo 3 perguntas
- Quando tiver tudo que precisa, avise: ''Já tenho tudo que preciso para montar a sua jornada. Vou estruturar agora.''
- Monte a jornada e retorne em formato JSON estruturado conforme o schema abaixo

MÉTODO DA DESCOMPLIQUEI (seguir rigorosamente):
- Método ACE: A = Atendimento Inteligente, C = Conversão, E = Escala
- Nunca recomendar escala antes de ter conversão estruturada
- Nunca recomendar mais tráfego antes de ter processo de atendimento
- Resolver o gargalo principal primeiro, construir sobre o que funciona
- Clínica com convênio e interesse em particular: priorizar construção de oferta e carteira particular antes de qualquer canal de aquisição
- Clínica sem demanda: começar por canais de aquisição antes de qualquer outra frente
- Clínica com demanda mas conversão baixa: começar por atendimento e funil antes de qualquer investimento em mais leads
- Clínica com base grande parada: reativação é prioridade máxima — é o dinheiro mais rápido disponível
- Solo sobrecarregado: estruturar processo antes de falar em equipe
- Prazos devem ser realistas — considerar que o cliente tem uma clínica para operar enquanto implementa

SCHEMA DA JORNADA (retornar nesse formato JSON ao final):
{
  "titulo": "string",
  "estagios": [
    {
      "titulo": "string",
      "descricao": "string",
      "ordem": "number",
      "prazo_dias": "number",
      "passos": [
        {
          "titulo": "string",
          "descricao": "string",
          "ordem": "number",
          "tipo": "acao_livre | ferramenta_arsenal",
          "ferramenta_slug": "string | null",
          "prazo_dias": "number",
          "obrigatorio": "boolean"
        }
      ]
    }
  ]
}',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  nome          = EXCLUDED.nome,
  descricao     = EXCLUDED.descricao,
  system_prompt = EXCLUDED.system_prompt,
  ativo         = EXCLUDED.ativo,
  updated_at    = now();
