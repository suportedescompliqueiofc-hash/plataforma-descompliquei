import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Lead } from "@/hooks/useLeads";
import LeadNotas from "@/components/leads/LeadNotas";

interface ClientInfoSidebarProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientInfoSidebar({ lead, open, onOpenChange }: ClientInfoSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Informações do Cliente</SheetTitle>
          <SheetDescription>
            Detalhes completos do lead e histórico de interações.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          {lead ? (
            <>
              <div className="space-y-2">
                <p><strong>Nome:</strong> {lead.nome}</p>
                <p><strong>Telefone:</strong> {lead.telefone}</p>
                <p><strong>Email:</strong> {lead.email || 'N/A'}</p>
              </div>

              {/* Notas do lead */}
              {lead.id && lead.organization_id && (
                <div className="mt-6">
                  <LeadNotas leadId={lead.id} organizationId={lead.organization_id} />
                </div>
              )}
            </>
          ) : (
            <p>Nenhum cliente selecionado.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}