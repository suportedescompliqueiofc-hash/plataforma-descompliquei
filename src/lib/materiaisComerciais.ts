/**
 * Taxonomia fixa de categorias de "Meus Materiais" — mantida em sincronia manual
 * com o enum da tool `criar_material` em supabase/functions/descompliquei-os/index.ts
 * (runtimes diferentes — Deno edge function vs. Vite frontend — não dá para compartilhar módulo).
 */
export const MATERIAL_CATEGORIAS = [
  { value: "script_atendimento", label: "Script de Atendimento" },
  { value: "estrutura_processo", label: "Estrutura de Processo Comercial" },
  { value: "quebra_objecao", label: "Quebra de Objeção" },
  { value: "oferta", label: "Oferta e Precificação" },
  { value: "followup_reativacao", label: "Follow-up e Reativação" },
  { value: "otimizacao_comercial", label: "Otimização Comercial" },
  { value: "outro", label: "Outro" },
] as const;

export type MaterialCategoria = (typeof MATERIAL_CATEGORIAS)[number]["value"];

export function materialCategoriaLabel(categoria: string | null): string {
  return MATERIAL_CATEGORIAS.find((c) => c.value === categoria)?.label ?? "Sem categoria";
}
