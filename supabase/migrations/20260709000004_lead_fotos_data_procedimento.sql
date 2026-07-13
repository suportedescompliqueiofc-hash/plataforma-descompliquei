-- Data em que o procedimento (antes/depois) foi realizado — distinta de criado_em (data de upload).
ALTER TABLE lead_fotos ADD COLUMN IF NOT EXISTS data_procedimento date;
