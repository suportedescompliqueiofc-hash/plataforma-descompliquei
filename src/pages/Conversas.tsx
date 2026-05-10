import { useParams } from "react-router-dom";
import { ConversationsList } from "@/components/conversations/ConversationsList";
import { ActiveConversation } from "@/components/conversations/ActiveConversation";
import { QuickMessagesSidebar } from "@/components/conversations/QuickMessagesSidebar";
import { MessageSquare } from "lucide-react";
import { useLead } from "@/hooks/useLeads";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function Conversations() {
  const { leadId } = useParams<{ leadId: string }>();
  const { data: lead } = useLead(leadId || null);
  const isMobile = useIsMobile();
  
  // Por padrão, inicia fechado (false)
  const [showQuickMessages, setShowQuickMessages] = useState(false);

  // Fecha o painel de mensagens rápidas sempre que o leadId mudar (clique em nova conversa)
  useEffect(() => {
    setShowQuickMessages(false);
  }, [leadId]);

  return (
    <div className="h-[calc(100vh-4rem)]">
      {/* Container principal com borda e cantos arredondados */}
      <div className="flex h-full w-full lg:rounded-lg lg:border bg-background overflow-hidden relative">
        
        {/* Área Flexível (Lista + Chat) */}
        <div className="flex-1 min-w-0 h-full flex relative overflow-hidden">
            
            {/* Painel Esquerdo: Lista - Largura adaptada para telas grandes */}
            <div className={cn(
              "flex-shrink-0 h-full border-r bg-card/50 transition-all duration-300",
              leadId ? "hidden md:block w-64 lg:w-72 xl:w-80 2xl:w-96" : "w-full md:w-64 lg:w-72 xl:w-80 2xl:w-96"
            )}>
              <ConversationsList />
            </div>
            
            {/* Painel Central: Chat Ativo */}
            <div className={cn(
              "flex-1 min-w-0 h-full bg-background relative transition-all duration-300",
              !leadId && "hidden md:block"
            )}>
              {leadId ? (
                <div className="flex flex-col h-full relative">
                  <div className="flex-1 overflow-hidden">
                    <ActiveConversation 
                      leadId={leadId} 
                      showQuickMessages={showQuickMessages}
                      onToggleQuickMessages={() => setShowQuickMessages(!showQuickMessages)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground bg-muted/5">
                  <div className="bg-muted p-6 rounded-full mb-4">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Selecione uma conversa</h2>
                  <p className="px-4">Escolha um cliente na lista para iniciar o atendimento.</p>
                </div>
              )}
            </div>
        </div>

        {/* Painel Direito Desktop: Mensagens Rápidas (Lateral) - Largura adaptada para telas grandes */}
        {!isMobile && showQuickMessages && leadId && (
          <div className="hidden lg:block h-full flex-shrink-0 border-l bg-card w-64 xl:w-72 2xl:w-80">
            <QuickMessagesSidebar lead={lead || null} />
          </div>
        )}

        {/* Painel Mobile: Mensagens Rápidas (Gaveta Inferior) */}
        {isMobile && leadId && (
            <Sheet open={showQuickMessages} onOpenChange={setShowQuickMessages}>
                <SheetContent side="bottom" className="h-[70vh] p-0 rounded-t-3xl overflow-hidden border-t-2">
                    <div className="h-full w-full">
                        <QuickMessagesSidebar lead={lead || null} />
                    </div>
                </SheetContent>
            </Sheet>
        )}
      </div>
    </div>
  );
}