import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useCSNpsTemplates, useCSNpsCampaigns, useDispatchNpsSurvey, useCancelNpsCampaign } from '@/hooks/useCSNps';
import { clientName, NPS_DIMENSAO_LABELS, NPS_DIMENSAO_COLORS, type CSClient } from '../types/cs';

function campaignStatusBadge(status: string, snoozedUntil: string | null) {
  if (status === 'pendente' && snoozedUntil && new Date(snoozedUntil) > new Date()) {
    return { label: `Adiada até ${format(parseISO(snoozedUntil), "d 'de' MMM", { locale: ptBR })}`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (status === 'pendente') return { label: 'Pendente', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (status === 'respondida') return { label: 'Respondida', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  return { label: 'Cancelada', color: 'text-muted-foreground bg-muted border-border/60' };
}

export function NpsDispatchTab({ clients }: { clients: CSClient[] }) {
  const { user } = useAuth();
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');

  const { data: templates = [] } = useCSNpsTemplates();
  const { data: campaigns = [] } = useCSNpsCampaigns();
  const dispatch = useDispatchNpsSurvey();
  const cancel = useCancelNpsCampaign();

  const hasPending = campaigns.some(c => c.client_id === clientId && c.status === 'pendente');
  const selectedTemplate = templates.find(t => t.id === templateId);

  const handleDispatch = () => {
    if (!clientId || !templateId) return;
    dispatch.mutate(
      { clientId, templateId, dispatchedBy: user?.id },
      { onSuccess: () => { setClientId(''); setTemplateId(''); } }
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Send className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Disparar pesquisa</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">O cliente verá um popup no CRM dele com a pergunta</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{clientName(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                  <SelectValue placeholder="Selecionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedTemplate && (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 space-y-1.5">
              {(selectedTemplate.cs_nps_perguntas ?? []).map(p => (
                <div key={p.id} className="flex items-start gap-2">
                  <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 mt-0.5', NPS_DIMENSAO_COLORS[p.dimensao])}>
                    {NPS_DIMENSAO_LABELS[p.dimensao]}
                  </span>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{p.texto}</p>
                </div>
              ))}
            </div>
          )}
          {hasPending && (
            <p className="text-[11px] text-amber-700">Este cliente já tem uma pesquisa pendente.</p>
          )}
          <Button
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            disabled={!clientId || !templateId || hasPending || dispatch.isPending}
            onClick={handleDispatch}
          >
            <Send className="h-3.5 w-3.5" />
            {dispatch.isPending ? 'Disparando...' : 'Disparar pesquisa'}
          </Button>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Histórico de disparos</p>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3"><Send className="h-6 w-6 text-muted-foreground/40" /></div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma pesquisa disparada ainda</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="divide-y divide-border/40">
              {campaigns.map(c => {
                const badge = campaignStatusBadge(c.status, c.snoozed_until);
                return (
                  <div key={c.id} className="px-5 py-4 flex items-center gap-4 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{clientName(c.platform_users || {})}</p>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', badge.color)}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{c.cs_nps_templates?.nome}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        Disparada em {format(parseISO(c.disparado_em), "d 'de' MMM yyyy", { locale: ptBR })}
                        {c.snooze_count > 0 && ` · adiada ${c.snooze_count}x`}
                      </p>
                    </div>
                    {c.status === 'pendente' && (
                      <Button
                        size="sm" variant="outline"
                        className="h-7 rounded-lg text-[10px] border-border/60 gap-1.5 px-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate({ campanhaId: c.id, canceledBy: user?.id })}
                      >
                        <Ban className="h-3 w-3" />Cancelar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
