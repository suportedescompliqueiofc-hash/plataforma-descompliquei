-- Seeds iniciais de templates de pesquisa NPS — cobrem os principais momentos
-- em que o CSM dispara uma pesquisa (padrão, pós-ativação, pós-atendimento,
-- pré-renovação, e uma versão relâmpago para reforço rápido).

INSERT INTO cs_nps_templates (nome, pergunta, variaveis) VALUES

('NPS padrão trimestral',
'Oi [nome]! De 0 a 10, o quanto você recomendaria a Descompliquei a um colega da sua área?',
ARRAY['nome']),

('NPS pós-ativação (30 dias)',
'Oi [nome]! Você já passou seu primeiro mês com a gente. De 0 a 10, o quanto você recomendaria a experiência até aqui?',
ARRAY['nome']),

('NPS pós-atendimento CS',
'Oi [nome]! Depois do nosso último atendimento, de 0 a 10, o quanto você recomendaria o suporte que você recebeu?',
ARRAY['nome']),

('NPS pré-renovação',
'Oi [nome]! Estamos chegando na época de renovar juntos. De 0 a 10, o quanto você recomendaria a Descompliquei hoje?',
ARRAY['nome']),

('NPS relâmpago',
'De 0 a 10, [nome], o quanto você recomendaria a Descompliquei?',
ARRAY['nome']);
