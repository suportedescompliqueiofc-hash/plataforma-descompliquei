-- Marca páginas de Notas como material de consulta rápida durante o
-- atendimento (substitui, para páginas novas, o painel de materiais da
-- conversa que hoje só lê de meus_materiais).
ALTER TABLE paginas ADD COLUMN disponivel_atendimento boolean NOT NULL DEFAULT false;

CREATE INDEX paginas_disponivel_atendimento_idx ON paginas(organization_id, disponivel_atendimento)
  WHERE disponivel_atendimento = true;
