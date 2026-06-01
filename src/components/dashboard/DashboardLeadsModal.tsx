import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LeadModal } from '@/components/leads/LeadModal';

interface Lead {
  id: string;
  nome?: string;
  telefone?: string;
  criado_em: string;
  atualizado_em?: string;
  posicao_pipeline?: number;
}

interface Stage {
  posicao_ordem: number;
  nome: string;
  cor?: string | null;
}

interface DashboardLeadsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  leads: Lead[];
  stages: Stage[];
}

export function DashboardLeadsModal({ open, onClose, title, leads, stages }: DashboardLeadsModalProps) {
  const navigate = useNavigate();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const sortedLeads = [...leads].sort((a, b) => {
    const dateA = a.atualizado_em || a.criado_em;
    const dateB = b.atualizado_em || b.criado_em;
    return dateB.localeCompare(dateA);
  });

  const getStageName = (pos?: number) => {
    if (!pos) return '—';
    return stages.find(s => s.posicao_ordem === pos)?.nome ?? '—';
  };

  const getStageColor = (pos?: number) => {
    if (!pos) return '#94a3b8';
    return stages.find(s => s.posicao_ordem === pos)?.cor ?? '#94a3b8';
  };

  const getInitials = (nome?: string) => {
    if (!nome) return '?';
    return nome.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const handleVerConversa = (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation();
    onClose();
    navigate(`/crm/conversas/${leadId}`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
            <p className="text-xs text-muted-foreground">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
          </DialogHeader>

          {leads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
              Nenhum lead neste segmento para o período selecionado.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-border -mx-6 px-6">
              {sortedLeads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 py-3 hover:bg-muted/30 -mx-6 px-6 transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: getStageColor(lead.posicao_pipeline) }}
                  >
                    {getInitials(lead.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.nome || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.telefone || '—'}</p>
                  </div>
                  <div className="hidden sm:block text-right flex-shrink-0">
                    <p className="text-xs font-medium" style={{ color: getStageColor(lead.posicao_pipeline) }}>
                      {getStageName(lead.posicao_pipeline)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(lead.atualizado_em || lead.criado_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-shrink-0 h-8 px-2 gap-1.5 text-xs"
                    onClick={(e) => handleVerConversa(e, lead.id)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Conversa</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedLead && (
        <LeadModal
          open={!!selectedLead}
          onOpenChange={(isOpen) => { if (!isOpen) setSelectedLead(null); }}
          lead={selectedLead}
          mode="view"
        />
      )}
    </>
  );
}
