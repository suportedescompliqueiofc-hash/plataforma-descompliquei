import { useState } from 'react';
import { Pencil, Plus, Search, Star, ArrowUp, ArrowDown, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCSNpsTemplates, useSaveNpsTemplate, type DraftNpsPergunta } from '@/hooks/useCSNps';
import { NPS_DIMENSAO_LABELS, NPS_DIMENSAO_COLORS, type CSNPSTemplate, type NPSDimensao } from '../types/cs';

function newPergunta(dimensao: NPSDimensao = 'resultado'): DraftNpsPergunta {
  return { _id: crypto.randomUUID(), dimensao, tipo: 'escala', texto: '', obrigatoria: true };
}

// ── PerguntaRow ──────────────────────────────────────────────────────────────

function PerguntaRow({ pergunta, index, total, onChange, onRemove, onMove }: {
  pergunta: DraftNpsPergunta;
  index: number;
  total: number;
  onChange: (p: DraftNpsPergunta) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const variaveis = Array.from(new Set((pergunta.texto.match(/\[([^\]]+)\]/g) ?? []).map(m => m.slice(1, -1))));

  return (
    <div className="rounded-xl border border-border/60 p-3.5 space-y-3 bg-muted/[0.02]">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-muted-foreground/50 w-4 shrink-0">{index + 1}</span>
        <div className="grid grid-cols-2 gap-2 flex-1">
          <Select value={pergunta.dimensao} onValueChange={v => onChange({ ...pergunta, dimensao: v as NPSDimensao })}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(NPS_DIMENSAO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pergunta.tipo} onValueChange={v => onChange({ ...pergunta, tipo: v as 'escala' | 'texto' })}>
            <SelectTrigger className="h-8 text-xs rounded-lg border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="escala">Escala 0-10</SelectItem>
              <SelectItem value="texto">Texto livre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={onRemove} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Textarea
        value={pergunta.texto}
        onChange={e => onChange({ ...pergunta, texto: e.target.value })}
        placeholder="Use [variavel] para inserir placeholders dinâmicos. Ex: De 0 a 10, [nome], como você avalia...?"
        rows={2}
        className="text-sm rounded-lg border-border/60 resize-none font-mono"
      />

      <div className="flex items-center justify-between">
        {variaveis.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 items-center">
            {variaveis.map(v => (
              <span key={v} className="text-[9px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">[{v}]</span>
            ))}
          </div>
        ) : <span />}
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[10px] text-muted-foreground">Obrigatória</span>
          <Switch checked={pergunta.obrigatoria} onCheckedChange={v => onChange({ ...pergunta, obrigatoria: v })} />
        </label>
      </div>
    </div>
  );
}

// ── EditTemplateModal ──────────────────────────────────────────────────────

function EditTemplateModal({ template, onClose }: {
  template: CSNPSTemplate | null;
  onClose: () => void;
}) {
  const isNew = !template;
  const [nome, setNome] = useState(template?.nome ?? '');
  const [perguntas, setPerguntas] = useState<DraftNpsPergunta[]>(() =>
    // useCSNpsTemplates() já entrega cs_nps_perguntas ordenado por `ordem`.
    (template?.cs_nps_perguntas ?? []).map(p => ({
      _id: p.id, dbId: p.id, dimensao: p.dimensao, tipo: p.tipo, texto: p.texto, obrigatoria: p.obrigatoria,
    }))
  );

  const save = useSaveNpsTemplate();

  const hasRecomendacao = perguntas.some(p => p.dimensao === 'recomendacao');
  const canSave = nome.trim().length > 0 && perguntas.length > 0 && hasRecomendacao && perguntas.every(p => p.texto.trim().length > 0);

  const updatePergunta = (id: string, next: DraftNpsPergunta) =>
    setPerguntas(ps => ps.map(p => (p._id === id ? next : p)));

  const removePergunta = (id: string) =>
    setPerguntas(ps => ps.filter(p => p._id !== id));

  const movePergunta = (id: string, dir: -1 | 1) =>
    setPerguntas(ps => {
      const i = ps.findIndex(p => p._id === id);
      const j = i + dir;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const handleAddPergunta = () => {
    setPerguntas(ps => [...ps, newPergunta(hasRecomendacao ? 'resultado' : 'recomendacao')]);
  };

  const handleSave = () => {
    if (!canSave) return;
    save.mutate(
      { templateId: template?.id, nome, perguntas },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{isNew ? 'Novo template de NPS' : 'Editar template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 overflow-y-auto flex-1 pr-1">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome do template</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: NPS trimestral completo" className="h-10 text-sm rounded-lg border-border/60" />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perguntas</Label>
              <Button variant="outline" size="sm" className="h-7 rounded-lg text-[11px] gap-1.5 px-2.5" onClick={handleAddPergunta}>
                <Plus className="h-3 w-3" />Adicionar pergunta
              </Button>
            </div>
            {perguntas.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 py-3 text-center">Nenhuma pergunta ainda — adicione ao menos uma.</p>
            )}
            {perguntas.map((p, i) => (
              <PerguntaRow
                key={p._id}
                pergunta={p}
                index={i}
                total={perguntas.length}
                onChange={next => updatePergunta(p._id, next)}
                onRemove={() => removePergunta(p._id)}
                onMove={dir => movePergunta(p._id, dir)}
              />
            ))}
            {!hasRecomendacao && perguntas.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                É preciso ao menos 1 pergunta de dimensão "Recomendação" — é ela que alimenta o NPS oficial.
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-3 border-t border-border/40 shrink-0">
          <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
            disabled={!canSave || save.isPending}
            onClick={handleSave}
          >
            {save.isPending ? 'Salvando...' : isNew ? 'Criar template' : 'Salvar alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── TemplateCard ───────────────────────────────────────────────────────────

function TemplateCard({ template, onEdit }: { template: CSNPSTemplate; onEdit: () => void }) {
  const perguntas = template.cs_nps_perguntas ?? [];

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4">
        <p className="text-sm font-semibold mb-2.5">{template.nome}</p>
        <div className="space-y-1.5">
          {perguntas.map(p => (
            <div key={p.id} className="flex items-start gap-2">
              <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 mt-0.5', NPS_DIMENSAO_COLORS[p.dimensao])}>
                {NPS_DIMENSAO_LABELS[p.dimensao]}
              </span>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">{p.texto}</p>
            </div>
          ))}
          {perguntas.length === 0 && (
            <p className="text-xs text-muted-foreground/40 italic">Sem perguntas configuradas</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end px-5 py-3 border-t border-border/40 bg-muted/20">
        <Button size="sm" variant="outline" className="h-7 rounded-lg text-[10px] border-border/60 gap-1.5 px-2.5" onClick={onEdit}>
          <Pencil className="h-3 w-3" />Editar
        </Button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function NpsTemplatesTab() {
  const [search, setSearch] = useState('');
  const [editTemplate, setEditTemplate] = useState<CSNPSTemplate | 'new' | null>(null);

  const { data: templates = [] } = useCSNpsTemplates();

  const filtered = templates.filter(t =>
    !search
    || t.nome.toLowerCase().includes(search.toLowerCase())
    || (t.cs_nps_perguntas ?? []).some(p => p.texto.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar template..." className="pl-9 h-9 text-sm rounded-lg border-border/60" />
        </div>
        <Button
          className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5 flex-shrink-0"
          onClick={() => setEditTemplate('new')}
        >
          <Plus className="h-3.5 w-3.5" />Novo template
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><Star className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum template de NPS encontrado</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Crie um template para disparar pesquisas para clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => (
            <TemplateCard key={t.id} template={t} onEdit={() => setEditTemplate(t)} />
          ))}
        </div>
      )}

      {editTemplate !== null && (
        <EditTemplateModal
          template={editTemplate === 'new' ? null : editTemplate}
          onClose={() => setEditTemplate(null)}
        />
      )}
    </div>
  );
}
