-- Adiciona flag de acesso ao Arsenal nos produtos da plataforma
ALTER TABLE platform_products
  ADD COLUMN IF NOT EXISTS acesso_arsenal boolean NOT NULL DEFAULT false;
