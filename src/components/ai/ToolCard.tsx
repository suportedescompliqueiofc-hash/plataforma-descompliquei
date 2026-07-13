import {
  CheckCircle2, Loader2, Zap, FileText, FolderTree, Pencil, Trash2, List,
  Users, BarChart3, GitBranch, Calendar, DollarSign, Target, BadgeCheck, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolCallEvent {
  tool: string;
  input: any;
  result?: any;
  status: "running" | "done";
}

// Fonte única dos ícones/labels de tool-call do Athos — extraído de
// DescompliqueiOS.tsx. Qualquer superfície de chat do Athos usa este mesmo
// mapa; ao adicionar uma tool nova na edge function que mereça ícone próprio,
// adicione a entrada AQUI (não crie um TOOL_CONFIG paralelo em outro componente).
const TOOL_CONFIG: Record<string, { label: string; Icon: React.ComponentType<any> }> = {
  // CRM
  buscar_leads:         { label: "Buscando leads",        Icon: Users },
  obter_metricas_funil: { label: "Analisando funil",      Icon: BarChart3 },
  obter_pipeline:       { label: "Verificando pipeline",  Icon: GitBranch },
  obter_agendamentos:   { label: "Consultando agenda",    Icon: Calendar },
  obter_vendas_recentes:{ label: "Carregando vendas",     Icon: DollarSign },
  obter_metas:          { label: "Verificando metas",     Icon: Target },
  qualificar_lead:      { label: "Qualificando lead",     Icon: BadgeCheck },
  adicionar_nota:       { label: "Adicionando nota",      Icon: FileText },
  mover_etapa_pipeline: { label: "Movendo no pipeline",   Icon: ArrowRight },
  // Notas (páginas)
  criar_pagina:     { label: "Criando página",       Icon: FileText },
  atualizar_pagina: { label: "Atualizando página",   Icon: Pencil },
  mover_pagina:     { label: "Organizando páginas",  Icon: FolderTree },
  listar_paginas:   { label: "Consultando páginas",  Icon: List },
  excluir_pagina:   { label: "Excluindo página",     Icon: Trash2 },
};

// Chip de status de tool-call — mesmo padrão visual usado no chat do Athos
// (spinner enquanto roda, check verde ao concluir), reaproveitável em qualquer
// lugar que precise mostrar o Athos "trabalhando" em tempo real.
export function ToolCard({ call }: { call: ToolCallEvent }) {
  const cfg = TOOL_CONFIG[call.tool];
  const Icon = cfg?.Icon ?? Zap;
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
      call.status === "running"
        ? "bg-muted/50 border-border/50 text-muted-foreground"
        : "bg-muted/20 border-border/30 text-muted-foreground/60"
    )}>
      {call.status === "running"
        ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        : <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
      <Icon className="h-3 w-3 shrink-0" />
      <span>{cfg?.label ?? call.tool}</span>
    </div>
  );
}
