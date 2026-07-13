export const AREA_OPTIONS = [
  { key: 'crm', label: 'CRM', acessoKey: 'acesso_crm' },
  { key: 'arsenal', label: 'Arsenal', acessoKey: 'acesso_arsenal' },
  { key: 'os', label: 'Athos GS', acessoKey: 'acesso_os' },
  { key: 'sessoes_taticas', label: 'Sessões Táticas', acessoKey: 'acesso_sessoes_taticas' },
  { key: 'materiais', label: 'Materiais', acessoKey: 'acesso_materiais' },
  { key: 'ia_comercial', label: 'IA Comercial', acessoKey: 'acesso_ia_comercial' },
] as const;

export type AreaKey = typeof AREA_OPTIONS[number]['key'];

export const CATEGORIA_OPTIONS = [
  { key: 'novidade', label: 'Novidade' },
  { key: 'melhoria', label: 'Melhoria' },
  { key: 'correcao', label: 'Correção' },
] as const;

export type CategoriaKey = typeof CATEGORIA_OPTIONS[number]['key'];
