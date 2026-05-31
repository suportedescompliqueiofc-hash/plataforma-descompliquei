import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Health { id: string; score: number; engajamento: string; satisfacao: string; risco_churn: string; observacao: string | null; created_at: string }
interface Props { clientId: string; healthHistory: Health[]; onRefresh: () => void }

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-16 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-8 border-muted" style={{ borderBottomColor: 'transparent' }} />
        <div className="absolute inset-0 rounded-t-full border-8 border-transparent"
          style={{ borderTopColor: color, borderLeftColor: pct > 25 ? color : 'transparent', borderRightColor: pct > 75 ? color : 'transparent', transform: `rotate(${(pct / 100) * 180 - 90}deg)`, transformOrigin: 'center bottom' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-2xl font-black tabular-nums" style={{ color }}>{score}</div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Health Score</p>
    </div>
  );
}

const BADGE_MAP: Record<string, Record<string, string>> = {
  engajamento: { alto: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', medio: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20', baixo: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', critico: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20' },
  risco_churn: { baixo: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', medio: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', alto: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20' },
};

export default function AbaHealthScore({ clientId, healthHistory, onRefresh }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ engajamento: 'medio', satisfacao: 'bom', risco_churn: 'medio', score: 60, observacao: '' });
  const [saving, setSaving] = useState(false);
  const latest = healthHistory[0];

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('admin_client_health').insert({ client_id: clientId, ...form, avaliado_por: user?.id });
    if (error) { toast.error('Erro ao salvar avaliação.'); }
    else { toast.success('Avaliação registrada!'); setOpen(false); onRefresh(); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Score atual */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 flex flex-col md:flex-row items-center gap-6">
        <ScoreGauge score={latest?.score ?? 0} />
        <div className="space-y-2 flex-1">
          {latest ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', BADGE_MAP.engajamento[latest.engajamento] || 'bg-muted text-muted-foreground border-border/40')}>
                  Engajamento: {latest.engajamento}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                  Satisfação: {latest.satisfacao}
                </span>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', BADGE_MAP.risco_churn[latest.risco_churn] || 'bg-muted text-muted-foreground border-border/40')}>
                  Churn: {latest.risco_churn}
                </span>
              </div>
              {latest.observacao && <p className="text-sm text-muted-foreground">{latest.observacao}</p>}
              <p className="text-[11px] text-muted-foreground/60 tabular-nums">Última avaliação: {new Date(latest.created_at).toLocaleDateString('pt-BR')}</p>
            </>
          ) : <p className="text-sm text-muted-foreground">Nenhuma avaliação registrada.</p>}
        </div>
        <Button onClick={() => setOpen(true)} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Nova Avaliação
        </Button>
      </div>

      {/* Histórico */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico de Avaliações</p>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {healthHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
            </div>
          ) : healthHistory.map(h => (
            <div key={h.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
              <div className={cn('text-xl font-black w-12 text-center tabular-nums font-display', h.score >= 70 ? 'text-emerald-600' : h.score >= 40 ? 'text-amber-600' : 'text-red-600')}>{h.score}</div>
              <div className="flex-1 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40">Eng.: {h.engajamento}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40">Churn: {h.risco_churn}</span>
              </div>
              <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nova Avaliação de Health Score</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { label: 'Engajamento', key: 'engajamento', opts: ['alto','medio','baixo','critico'] },
              { label: 'Satisfação', key: 'satisfacao', opts: ['otimo','bom','regular','ruim'] },
              { label: 'Risco de Churn', key: 'risco_churn', opts: ['baixo','medio','alto'] },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
                <select className="w-full h-10 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground"
                  value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score (0–100)</label>
              <Input className="h-10 rounded-lg border-border/60" type="number" min={0} max={100} value={form.score}
                onChange={e => setForm(p => ({ ...p, score: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observação</label>
              <Textarea className="rounded-lg border-border/60" rows={3} value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
