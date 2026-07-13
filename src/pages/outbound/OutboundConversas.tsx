import { useParams, useNavigate } from "react-router-dom";
import { ConversationsList } from "@/components/conversations/ConversationsList";
import { ActiveConversation } from "@/components/conversations/ActiveConversation";
import { MessageSquare, ArrowLeft, User } from "lucide-react";
import { useLead } from "@/hooks/useLeads";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { ProspectoDetalheModal } from "@/components/outbound/ProspectoDetalheModal";
import { ProspectoFormModal } from "@/components/outbound/ProspectoFormModal";
import { useOutboundProspectos } from "@/hooks/useOutboundProspectos";

export default function OutboundConversas() {
  const { leadId } = useParams<{ leadId: string }>();
  const { data: lead } = useLead(leadId || null);
  const { profile } = useProfile();
  const { prospectos } = useOutboundProspectos();

  const [prospectoModalOpen, setProspectoModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const linkedProspecto = leadId
    ? prospectos.find(p => p.whatsapp_lead_id === leadId) || null
    : null;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="flex h-full w-full lg:rounded-lg lg:border bg-background overflow-hidden relative">
        <div className="flex-1 min-w-0 h-full flex relative overflow-hidden">
          <div className={cn(
            "flex-shrink-0 h-full border-r bg-card/50 transition-all duration-300",
            leadId ? "hidden md:block w-64 lg:w-72 xl:w-80 2xl:w-96" : "w-full md:w-64 lg:w-72 xl:w-80 2xl:w-96"
          )}>
            <ConversationsList origemFilter="outbound" basePath="/outbound/conversas" />
          </div>

          <div className={cn(
            "flex-1 min-w-0 h-full bg-background relative transition-all duration-300",
            !leadId && "hidden md:block"
          )}>
            {leadId ? (
              <div className="flex flex-col h-full relative">
                {linkedProspecto && (
                  <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-[#E85D24]/5">
                    <User className="h-3.5 w-3.5 text-[#E85D24]" />
                    <span className="text-xs text-muted-foreground">Prospecto:</span>
                    <button
                      className="text-xs font-medium text-[#E85D24] hover:underline"
                      onClick={() => setProspectoModalOpen(true)}
                    >
                      {linkedProspecto.nome} {linkedProspecto.clinica ? `(${linkedProspecto.clinica})` : ''}
                    </button>
                    {linkedProspecto.lead_scoring && (
                      <Badge variant="outline" className="text-[9px] h-4">{linkedProspecto.lead_scoring}</Badge>
                    )}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <ActiveConversation leadId={leadId} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div className="space-y-3">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-[#E85D24]/10 flex items-center justify-center">
                    <MessageSquare className="h-7 w-7 text-[#E85D24]" />
                  </div>
                  <h2 className="text-xl font-bold">Conversas Outbound</h2>
                  <p className="text-sm text-muted-foreground">Selecione uma conversa de prospecção ativa</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {linkedProspecto && (
        <>
          <ProspectoDetalheModal
            open={prospectoModalOpen}
            onOpenChange={setProspectoModalOpen}
            prospecto={linkedProspecto}
            onEdit={() => { setProspectoModalOpen(false); setEditModalOpen(true); }}
          />
          <ProspectoFormModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            prospecto={linkedProspecto}
          />
        </>
      )}
    </div>
  );
}
