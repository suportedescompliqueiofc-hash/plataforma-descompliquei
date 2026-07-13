import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Route, Plus, Sparkles, Loader2, CheckCircle2, Circle, Zap, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AthosCsChat } from '@/components/admin/AthosCsChat';
import {
  useCsClientJornadas, useCreateMonthlyJornada,
  type CsJornadaResumo,
} from '@/hooks/useCsJornada';

function statusPill(status: CsJornadaResumo['status']) {
  if (status === 'ativa') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-semibold"><Zap className="h-2.5 w-2.5" /> Ativa</span>;
  if (status === 'concluida') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold"><CheckCircle2 className="h-2.5 w-2.5" /> Concluída</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold"><Circle className="h-2.5 w-2.5" /> Rascunho</span>;
}

function tipoLabel(j: CsJornadaResumo): string {
  if (j.tipo === 'onboarding') return 'Onboarding';
  if (j.tipo === 'mensal' && j.periodo_ref) return format(parseISO(j.periodo_ref), "MMMM 'de' yyyy", { locale: ptBR });
  if (j.tipo === 'mensal') return 'Mensal';
  return 'Legado';
}

export function CsJornadaSection({ crmUserId, clientOrgId, clientName }: { crmUserId: string | null; clientOrgId: string; clientName?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: jornadas, isLoading } = useCsClientJornadas(crmUserId);
  const createMonthly = useCreateMonthlyJornada();
  const [athosOpen, setAthosOpen] = useState(false);

  const periodoRef = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const mesLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  function openEditor(jornadaId: string) {
    navigate(`/admin/cs/jornada/${jornadaId}/editar`, { state: { clientName } });
  }

  function refreshJornadas() {
    qc.invalidateQueries({ queryKey: ['cs-client-jornadas', crmUserId] });
    qc.invalidateQueries({ queryKey: ['cs-jornadas-progress'] });
    qc.invalidateQueries({ queryKey: ['cs-jornadas-overview'] });
  }

  async function handleNova() {
    if (!crmUserId) return;
    const res = await createMonthly.mutateAsync({ crmUserId, organizationId: clientOrgId, titulo: `Jornada de ${mesLabel}`, periodoRef });
    if (res?.id) openEditor(res.id);
  }

  if (!crmUserId) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted"><Route className="h-3.5 w-3.5 text-muted-foreground" /></span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Jornada do cliente</p>
        </div>
        <div className="py-8 text-center text-[12px] text-muted-foreground/50">Cliente sem usuário vinculado no CRM.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted"><Route className="h-3.5 w-3.5 text-muted-foreground" /></span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Jornada do cliente</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Consultoria mensal — o que a Descompliquei recomenda</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAthosOpen(true)} className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5">
            <Sparkles className="h-3 w-3" /> Montar com o Athos
          </Button>
          <Button variant="outline" onClick={handleNova} disabled={createMonthly.isPending} className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3">
            {createMonthly.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Nova em branco
          </Button>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (jornadas ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3"><Route className="h-6 w-6 text-muted-foreground/40" /></div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma jornada ainda</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Converse com o Athos CS para montar a primeira jornada mensal.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(jornadas ?? []).map(j => {
              const pct = j._total > 0 ? Math.round(j._done / j._total * 100) : 0;
              return (
                <button key={j.id} onClick={() => openEditor(j.id)}
                  className="w-full text-left rounded-xl border border-border/50 hover:border-border/80 bg-card p-3.5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[13px] font-semibold text-foreground truncate">{j.titulo}</span>
                        {statusPill(j.status)}
                        {j.gerada_por === 'ia' && <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-violet-500/10 text-violet-600">Athos</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                        <span className="capitalize">{tipoLabel(j)}</span>
                        <span className="font-mono tabular-nums">{j._done}/{j._total} tarefas · {pct}%</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted/50 overflow-hidden max-w-[220px]">
                        <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-foreground/70')} style={{ width: `${Math.max(pct, j._total > 0 ? 2 : 0)}%` }} />
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-muted-foreground/50 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={athosOpen} onOpenChange={setAthosOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-4 pb-0">
            <DialogTitle className="text-sm font-bold font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Montar jornada com o Athos CS{clientName ? ` — ${clientName}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="p-3">
            <AthosCsChat
              clientOrgId={clientOrgId}
              clientName={clientName}
              variant="jornada"
              onJornadaChanged={refreshJornadas}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
