import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, Clock, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NOTE_TYPES = ['observacao', 'alerta', 'oportunidade', 'historico'] as const;
const NOTE_LABELS: Record<string, string> = {
  observacao: 'Observação', alerta: 'Alerta', oportunidade: 'Oportunidade', historico: 'Histórico',
};
const NOTE_COLORS: Record<string, string> = {
  observacao: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  alerta: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  oportunidade: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  historico: 'bg-muted text-muted-foreground border-border/40',
};

interface Note { id: string; content: string; type: string; created_at: string; created_by: string | null }
interface Props { clientId: string; notes: Note[]; onRefresh: () => void }

export default function AbaAnotacoes({ clientId, notes, onRefresh }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [type, setType] = useState<string>('observacao');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('admin_client_notes').insert({
      client_id: clientId, content, type, created_by: user?.id,
    });
    if (error) { toast.error('Erro ao salvar nota.'); }
    else { toast.success('Anotação adicionada!'); setContent(''); setOpen(false); onRefresh(); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar Anotação
        </Button>
      </div>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-border/60 bg-card">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <FileText className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma anotação ainda</p>
          </div>
        ) : notes.map(note => (
          <div key={note.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', NOTE_COLORS[note.type] || 'bg-muted text-muted-foreground border-border/40')}>
                {NOTE_LABELS[note.type] || note.type}
              </span>
              <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nova Anotação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</label>
              <select className="w-full h-10 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground"
                value={type} onChange={e => setType(e.target.value)}>
                {NOTE_TYPES.map(t => <option key={t} value={t}>{NOTE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Anotação *</label>
              <Textarea className="rounded-lg border-border/60" rows={4} placeholder="Escreva a anotação..." value={content} onChange={e => setContent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !content.trim()} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
