import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ConversationsList } from "@/components/conversations/ConversationsList";
import { ActiveConversation } from "@/components/conversations/ActiveConversation";
import { MaterialsSidebar } from "@/components/conversations/MaterialsSidebar";
import { MessageSquare, GitBranch, Tag as TagIcon, Zap, Bot, Globe, Trash2, MousePointerClick, ChevronLeft } from "lucide-react";
import { useLead } from "@/hooks/useLeads";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type BulkActionType = 'stage' | 'tag' | 'cadence' | 'ai' | 'origem' | 'delete';

interface BulkSelectionState {
  isActive: boolean;
  count: number;
  triggerAction: ((action: BulkActionType) => void) | null;
  cancelSelection: (() => void) | null;
}

const BULK_ACTIONS: { action: BulkActionType; label: string; icon: React.ElementType; danger?: boolean }[] = [
  { action: 'stage',   label: 'Alterar Etapa',    icon: GitBranch },
  { action: 'tag',     label: 'Adicionar Etiqueta', icon: TagIcon },
  { action: 'cadence', label: 'Iniciar Cadência',  icon: Zap },
  { action: 'ai',      label: 'Configurar IA',     icon: Bot },
  { action: 'origem',  label: 'Alterar Origem',    icon: Globe },
  { action: 'delete',  label: 'Excluir Leads',     icon: Trash2, danger: true },
];

export default function Conversations() {
  const { leadId } = useParams<{ leadId: string }>();
  const { data: lead } = useLead(leadId || null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Painel direito da conversa: 'materiais' | null (fechado).
  const [activePanel, setActivePanel] = useState<'materiais' | null>(null);

  // Largura ajustável do painel direito (arrastar a borda esquerda). Persistida no localStorage.
  const PANEL_MIN = 256;
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('conversa_panel_width'));
    return saved && saved >= PANEL_MIN ? saved : 300;
  });

  const startPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    const max = Math.min(640, Math.round(window.innerWidth * 0.6));
    let lastWidth = startWidth;
    const onMove = (ev: MouseEvent) => {
      // Arrastar para a esquerda (clientX diminui) aumenta a largura.
      lastWidth = Math.max(PANEL_MIN, Math.min(max, startWidth + (startX - ev.clientX)));
      setPanelWidth(lastWidth);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('conversa_panel_width', String(lastWidth));
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // Estado de seleção em massa (alimentado pelo ConversationsList via callback)
  const [bulkSelection, setBulkSelection] = useState<BulkSelectionState>({
    isActive: false, count: 0, triggerAction: null, cancelSelection: null,
  });

  const handleSelectionChange = useCallback((
    isSelecting: boolean,
    ids: Set<string>,
    triggerAction: (action: BulkActionType) => void,
    cancelSelection: () => void
  ) => {
    setBulkSelection({ isActive: isSelecting, count: ids.size, triggerAction, cancelSelection });
  }, []);

  // O painel direito (Rápidas / Materiais) NÃO fecha ao trocar de conversa —
  // só fecha quando o usuário clica no X. Mantém a referência aberta durante o atendimento.


  return (
    <div className="h-[calc(100vh-4rem)]">
      {/* Container principal com borda e cantos arredondados */}
      <div className="flex h-full w-full lg:rounded-lg lg:border bg-background overflow-hidden relative">
        
        {/* Painel Esquerdo: Lista - Largura adaptada para telas grandes */}
        <div className={cn(
          "flex-shrink-0 h-full border-r bg-card/50 transition-all duration-300",
          leadId ? "hidden md:block w-60 lg:w-64 xl:w-72 2xl:w-80" : "w-full md:w-60 lg:w-64 xl:w-72 2xl:w-80"
        )} data-tutorial="conversations-list">
          <ConversationsList onSelectionChange={handleSelectionChange} />
        </div>

        {/* Painel Central: Chat Ativo — flex-1 com min-w-0 garante que encolhe */}
        <div className={cn(
          "flex-1 min-w-0 h-full bg-background relative transition-all duration-300",
          !leadId && "hidden md:block"
        )} data-tutorial="conversation-active">
          {leadId ? (
            <div className="flex flex-col h-full relative">
              {/* Banner de retorno à seleção */}
              {bulkSelection.isActive && (
                <div className="flex items-center justify-between px-4 py-2 bg-foreground text-background shrink-0 z-10">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-background/15 text-[10px] font-bold shrink-0">
                      {bulkSelection.count}
                    </div>
                    <span className="text-[12px] font-semibold">
                      {bulkSelection.count === 1 ? 'conversa selecionada' : 'conversas selecionadas'}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/crm/conversas')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold hover:bg-background/15 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Ver ações
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <ActiveConversation
                  leadId={leadId}
                  showMateriais={activePanel === 'materiais'}
                  onToggleMateriais={() => setActivePanel(p => p === 'materiais' ? null : 'materiais')}
                />
              </div>
            </div>
          ) : bulkSelection.isActive && bulkSelection.count > 0 ? (
            /* Painel de ações em massa — aparece no espaço direito quando em modo de seleção */
            <div data-tutorial="conversations-bulk-panel" className="flex flex-col items-center justify-center h-full px-8">
              <div className="w-full max-w-sm">
                {/* Cabeçalho */}
                <div className="flex flex-col items-center mb-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background mb-4 shadow-sm">
                    <MousePointerClick className="h-6 w-6" />
                  </div>
                  <p className="text-lg font-bold text-foreground font-display">
                    {bulkSelection.count} {bulkSelection.count === 1 ? 'conversa selecionada' : 'conversas selecionadas'}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-1">Escolha uma ação para aplicar em massa</p>
                </div>

                {/* Grade de ações */}
                <div className="grid grid-cols-2 gap-2.5">
                  {BULK_ACTIONS.map(({ action, label, icon: Icon, danger }) => (
                    <button
                      key={action}
                      onClick={() => bulkSelection.triggerAction?.(action)}
                      className={cn(
                        "flex flex-col items-start gap-3 p-4 rounded-xl border transition-all text-left group",
                        danger
                          ? "border-red-200/60 hover:bg-red-50 hover:border-red-300 text-red-600"
                          : "border-border/60 hover:bg-muted/40 hover:border-border text-foreground"
                      )}
                    >
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        danger ? "bg-red-100 group-hover:bg-red-200" : "bg-muted group-hover:bg-muted/70"
                      )}>
                        <Icon className={cn("h-4 w-4", danger ? "text-red-500" : "text-muted-foreground")} />
                      </span>
                      <span className="text-[13px] font-semibold leading-tight">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Cancelar */}
                <button
                  data-tutorial="conversations-bulk-cancel"
                  onClick={() => bulkSelection.cancelSelection?.()}
                  className="w-full mt-4 h-9 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancelar seleção
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <div className="bg-muted/40 p-8 rounded-3xl mb-5">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h2 className="text-base font-semibold text-foreground/80 tracking-tight">Selecione uma conversa</h2>
              <p className="text-xs text-muted-foreground/60 mt-1">Escolha um cliente na lista para iniciar o atendimento.</p>
            </div>
          )}
        </div>

        {/* Painel Direito Desktop: Materiais — largura ajustável arrastando a borda esquerda */}
        {!isMobile && activePanel && leadId && (
          <div
            className="hidden lg:flex h-full flex-shrink-0 border-l bg-card relative"
            style={{ width: panelWidth }}
          >
            {/* Alça de redimensionamento (borda esquerda) */}
            <div
              onMouseDown={startPanelResize}
              className="group absolute left-0 top-0 h-full w-2 -ml-1 cursor-col-resize z-20"
              title="Arraste para ajustar a largura"
            >
              <div className="h-full w-px mx-auto bg-transparent group-hover:bg-primary/40 transition-colors" />
            </div>
            <div className="flex-1 min-w-0 h-full">
              <MaterialsSidebar onClose={() => setActivePanel(null)} />
            </div>
          </div>
        )}

        {/* Painel Mobile: Materiais (Gaveta Inferior) */}
        {isMobile && leadId && (
            <Sheet open={activePanel !== null} onOpenChange={(open) => setActivePanel(open ? activePanel : null)}>
                <SheetContent side="bottom" className="h-[70vh] p-0 rounded-t-3xl overflow-hidden border-t-2">
                    <div className="h-full w-full">
                      <MaterialsSidebar onClose={() => setActivePanel(null)} />
                    </div>
                </SheetContent>
            </Sheet>
        )}
      </div>
    </div>
  );
}