import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, EyeOff, X, ArrowLeft, ExternalLink, Bot, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LeadModal } from '@/components/leads/LeadModal';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ActiveConversation } from '@/components/conversations/ActiveConversation';

interface Lead {
  id: string;
  nome?: string;
  telefone?: string;
  criado_em: string;
  atualizado_em?: string;
  followup_gap_motivo?: string;
  horasSemContato?: number;
}

interface DashboardLeadsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  leads: Lead[];
}

export function DashboardLeadsModal({ open, onClose, title, leads }: DashboardLeadsModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [activatingFollow, setActivatingFollow] = useState<string | null>(null);

  const handleAtivarFollow = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setActivatingFollow(lead.id);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          followup_manual: true,
          followup_tentativas: 0,
          followup_ultima_tentativa: null,
          followup_pausado: false,
        })
        .eq('id', lead.id);
      if (error) throw error;
      toast.success(`Follow-up IA ativado para ${lead.nome || 'lead'}`);
      queryClient.invalidateQueries({ queryKey: ['followup-gap'] });
    } catch (err: any) {
      toast.error('Erro ao ativar follow-up: ' + (err.message || String(err)));
    } finally {
      setActivatingFollow(null);
    }
  };

  // Deriva a lista local excluindo IDs removidos — sem sync logic quebrada
  const localLeads = leads.filter(l => !removedIds.has(l.id));

  const sortedLeads = [...localLeads].sort((a, b) => {
    // Se ambos têm horasSemContato, ordenar do menor para o maior
    if (a.horasSemContato != null && b.horasSemContato != null) {
      return a.horasSemContato - b.horasSemContato;
    }
    // Fallback: mais recente primeiro
    const dateA = a.atualizado_em || a.criado_em;
    const dateB = b.atualizado_em || b.criado_em;
    return dateB.localeCompare(dateA);
  });

  const getInitials = (nome?: string) => {
    if (!nome) return '?';
    return nome.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const handleVerConversa = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setViewingLead(lead);
  };

  const handleSairConversa = () => setViewingLead(null);

  const handleClose = () => {
    setViewingLead(null);
    onClose();
  };

  const handleTirarMetricas = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setRemoving(lead.id);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ excluir_metricas: true })
        .eq('id', lead.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success(`${lead.nome || 'Lead'} removido das métricas`);
      setRemovedIds(prev => new Set([...prev, lead.id]));
      if (viewingLead?.id === lead.id) setViewingLead(null);
    } catch (err: any) {
      toast.error('Erro ao remover das métricas: ' + (err.message || String(err)));
    } finally {
      setRemoving(null);
    }
  };

  // ── Lead list rows (shared) ──────────────────────────────────────────────
  const leadRows = (
    <div className="flex-1 overflow-y-auto divide-y divide-border/40">
      {sortedLeads.map(lead => (
        <div
          key={lead.id}
          className={cn(
            "flex items-center gap-2.5 py-2.5 px-4 hover:bg-muted/30 transition-colors cursor-pointer",
            viewingLead?.id === lead.id && "bg-primary/5 border-l-2 border-l-primary"
          )}
          onClick={() => setSelectedLead(lead)}
        >
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-muted-foreground/30 flex-shrink-0">
            {getInitials(lead.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-medium truncate">{lead.nome || 'Sem nome'}</p>
              {lead.horasSemContato != null && lead.horasSemContato > 0 && (
                <span className="text-[9px] font-mono tabular-nums font-semibold text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5 shrink-0">
                  {lead.horasSemContato < 24 ? `${lead.horasSemContato}h` : `${Math.floor(lead.horasSemContato / 24)}d ${lead.horasSemContato % 24}h`}
                </span>
              )}
            </div>
            {lead.followup_gap_motivo ? (
              <p className="text-[10px] text-muted-foreground truncate">
                {lead.followup_gap_motivo}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground truncate">
                {format(new Date(lead.atualizado_em || lead.criado_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/50 truncate">
              Cad. {format(new Date(lead.criado_em), "dd/MM/yy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              disabled={removing === lead.id}
              onClick={(e) => handleTirarMetricas(e, lead)}
              title="Tirar das métricas"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost"
              className={cn("h-7 w-7 p-0", viewingLead?.id === lead.id ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              onClick={(e) => handleVerConversa(e, lead)}
              title="Ver conversa"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Split card view (lista + conversa lado a lado) ───────────────────────
  if (open && viewingLead) {
    return (
      <>
        {/* Backdrop leve para fechar ao clicar fora */}
        <div className="fixed inset-0 z-40" onClick={handleClose} />

        {/* Dois cards lado a lado, flutuando sobre o painel */}
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex gap-3 items-start">

          {/* Card esquerdo — lista */}
          <div className="w-[300px] h-[78vh] bg-background rounded-2xl border border-border/60 shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1 shrink-0" onClick={handleSairConversa}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold truncate">{title}</p>
                <p className="text-[10px] text-muted-foreground">{localLeads.length} lead{localLeads.length !== 1 ? 's' : ''}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {localLeads.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-8 text-[13px] text-muted-foreground">Nenhum lead.</div>
            ) : leadRows}
          </div>

          {/* Card direito — conversa */}
          <div
            className="w-[520px] h-[78vh] bg-background rounded-2xl border border-border/60 shadow-xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Banner: lead + tirar das métricas */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-muted-foreground/30 shrink-0">
                {getInitials(viewingLead.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{viewingLead.nome || 'Sem nome'}</p>
                <p className="text-[10px] text-muted-foreground">{viewingLead.telefone || '—'}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {viewingLead.followup_gap_motivo && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                    disabled={activatingFollow === viewingLead.id}
                    onClick={(e) => handleAtivarFollow(e, viewingLead)}
                  >
                    {activatingFollow === viewingLead.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                    Follow IA
                  </Button>
                )}
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] gap-1.5 border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                  disabled={removing === viewingLead.id}
                  onClick={(e) => handleTirarMetricas(e, viewingLead)}
                >
                  <EyeOff className="h-3 w-3" />
                  Tirar das métricas
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] gap-1.5 border-border/60 text-muted-foreground hover:text-foreground"
                  onClick={() => { handleClose(); navigate(`/crm/conversas/${viewingLead.id}`); }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Ir para conversa
                </Button>
              </div>
            </div>

            {/* Resumo IA — só aparece quando há análise de follow-up */}
            {viewingLead.followup_gap_motivo && (
              <div className="px-4 py-2.5 border-b border-amber-500/20 bg-amber-500/[0.04] shrink-0">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    <div className="h-4 w-4 rounded-full bg-amber-500/15 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/70">Análise da IA</p>
                      {viewingLead.horasSemContato != null && viewingLead.horasSemContato > 0 && (
                        <span className="text-[9px] font-mono font-semibold text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5">
                          {viewingLead.horasSemContato < 24
                            ? `${viewingLead.horasSemContato}h sem resposta`
                            : `${Math.floor(viewingLead.horasSemContato / 24)}d ${viewingLead.horasSemContato % 24}h sem resposta`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-900/70 dark:text-amber-200/70 leading-snug">
                      {viewingLead.followup_gap_motivo}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conversa */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ActiveConversation leadId={viewingLead.id} compactMode />
            </div>
          </div>
        </div>

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

  // ── Dialog normal (centralizado) ────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="flex flex-col p-0 gap-0 max-w-[520px] w-[520px] max-h-[80vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate">{title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{localLeads.length} lead{localLeads.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {localLeads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
              Nenhum lead neste segmento para o período selecionado.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {sortedLeads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 py-3 px-5 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-muted-foreground/30 flex-shrink-0">
                    {getInitials(lead.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium truncate">{lead.nome || 'Sem nome'}</p>
                      {lead.horasSemContato != null && lead.horasSemContato > 0 && (
                        <span className="text-[9px] font-mono tabular-nums font-semibold text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5 shrink-0">
                          {lead.horasSemContato < 24 ? `${lead.horasSemContato}h` : `${Math.floor(lead.horasSemContato / 24)}d ${lead.horasSemContato % 24}h`}
                        </span>
                      )}
                    </div>
                    {lead.followup_gap_motivo ? (
                      <p className="text-[11px] text-muted-foreground truncate">{lead.followup_gap_motivo}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground truncate">{lead.telefone || '—'}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 mr-1">
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(lead.atualizado_em || lead.criado_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      Cadastrado {format(new Date(lead.criado_em), "dd/MM/yy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm" variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      disabled={removing === lead.id}
                      onClick={(e) => handleTirarMetricas(e, lead)}
                      title="Tirar das métricas"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleVerConversa(e, lead)}
                      title="Ver conversa"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
