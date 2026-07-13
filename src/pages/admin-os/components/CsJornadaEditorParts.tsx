import { useState } from 'react';
import {
  Plus, Trash2, CheckCircle2,
  Sparkles, ListChecks, X, ChevronRight, GripVertical,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import {
  MATERIAL_CATEGORIAS, MATERIAL_CATEGORIA_LABELS,
  type DraftEstagio, type DraftTarefa, type DraftSubtarefa,
} from '@/hooks/useCsJornada';

let _idc = 0;
export const newId = () => `_d${++_idc}`;

export function blankSubtarefa(): DraftSubtarefa {
  return { _id: newId(), titulo: '', concluido: false };
}
export function blankTarefa(): DraftTarefa {
  return {
    _id: newId(), titulo: '', conteudo_md: '', tipo: 'acao_livre',
    material_categoria: null, material_brief: null, material_id: null,
    prazo_dias: null, obrigatorio: false, concluido: false, concluido_em: null, concluido_por: null,
    subtarefas: [],
  };
}
export function blankEstagio(): DraftEstagio {
  return { _id: newId(), titulo: '', descricao: '', prazo_dias: 7, data_inicio: null, passos: [] };
}

const FIELD_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';

// ─── Tarefa editor (colapsável) ─────────────────────────────────────────────────

function TarefaEditor({ passo, index, onChange, onDelete }: {
  passo: DraftTarefa; index: number;
  onChange: (p: DraftTarefa) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: passo._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 20 : undefined };
  const [open, setOpen] = useState(!passo.titulo); // nova tarefa começa aberta
  const subsDone = passo.subtarefas.filter(s => s.concluido).length;

  function addSub() { onChange({ ...passo, subtarefas: [...passo.subtarefas, blankSubtarefa()] }); }
  function updSub(i: number, v: string) { const n = [...passo.subtarefas]; n[i] = { ...n[i], titulo: v }; onChange({ ...passo, subtarefas: n }); }
  function delSub(i: number) { onChange({ ...passo, subtarefas: passo.subtarefas.filter((_, j) => j !== i) }); }

  return (
    <>
      {/* Row limpo — clicar abre o card de detalhes */}
      <div ref={setNodeRef} style={style} className={cn('group/t rounded-xl border bg-card transition-colors', isDragging ? 'border-foreground/40 shadow-lg' : 'border-border/50 hover:border-border/70')}>
        <div className="flex items-center gap-1.5 px-2.5 py-2">
          <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/70 touch-none" title="Arraste para reordenar"><GripVertical className="h-4 w-4" /></button>
          <span className="shrink-0 w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground/70 font-mono">{index + 1}</span>
          <button type="button" onClick={() => setOpen(true)} className="flex-1 min-w-0 text-left py-1.5">
            <span className={cn('text-[13px] font-medium truncate block', passo.titulo ? 'text-foreground' : 'text-muted-foreground/40 italic')}>
              {passo.titulo || 'Tarefa sem título'}
            </span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {passo.obrigatorio && <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Obrig.</span>}
            {passo.tipo === 'material' && <Sparkles className="h-3.5 w-3.5 text-violet-500" />}
            {passo.subtarefas.length > 0 && <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums px-0.5">{subsDone}/{passo.subtarefas.length}</span>}
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/t:opacity-100 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            <button type="button" onClick={() => setOpen(true)} className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted" title="Abrir detalhes">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Card de detalhes da tarefa */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-display flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground font-mono shrink-0">{index + 1}</span>
              Detalhes da tarefa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Título</Label>
              <Input
                value={passo.titulo}
                onChange={e => onChange({ ...passo, titulo: e.target.value })}
                placeholder="Título da tarefa"
                className="h-10 text-sm rounded-lg border-border/60 font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Descrição da tarefa</Label>
              <MarkdownEditor
                value={passo.conteudo_md}
                onChange={v => onChange({ ...passo, conteudo_md: v })}
                placeholder="Explique o que o cliente deve fazer e por quê. Use a barra para negrito, listas, subtítulos…"
                minHeight={140}
              />
            </div>

            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Tipo</Label>
              <Select
                value={passo.tipo}
                onValueChange={(v: any) => onChange({ ...passo, tipo: v, material_categoria: v === 'material' ? (passo.material_categoria ?? 'script_atendimento') : null })}
              >
                <SelectTrigger className="h-9 text-[12px] rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="acao_livre">Ação livre</SelectItem>
                  <SelectItem value="material">Construir material (Athos GS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {passo.tipo === 'material' && (
              <div className="space-y-2.5 rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600">
                  <Sparkles className="h-3 w-3" /> Material a construir com o Athos GS
                </div>
                <div className="space-y-1">
                  <Label className={FIELD_LABEL}>Categoria</Label>
                  <Select value={passo.material_categoria ?? ''} onValueChange={v => onChange({ ...passo, material_categoria: v || null })}>
                    <SelectTrigger className="h-9 text-[12px] rounded-lg border-border/60 bg-background"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {MATERIAL_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{MATERIAL_CATEGORIA_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className={FIELD_LABEL}>Brief (contexto específico)</Label>
                  <Textarea
                    value={passo.material_brief ?? ''}
                    onChange={e => onChange({ ...passo, material_brief: e.target.value || null })}
                    placeholder="Descreva o contexto para o Athos GS construir o material (ex.: script para primeira abordagem de harmonização facial, tom consultivo, foco em avaliação)…"
                    className="min-h-[76px] text-[12px] rounded-lg border-border/60 bg-background resize-y leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Subtarefas */}
            <div className="space-y-1.5">
              <Label className={cn(FIELD_LABEL, 'flex items-center gap-1')}><ListChecks className="h-3 w-3" /> Subtarefas</Label>
              {passo.subtarefas.map((s, i) => (
                <div key={s._id} className="flex items-center gap-2">
                  {s.concluido ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <span className="h-3.5 w-3.5 rounded-full border border-border/60 shrink-0" />}
                  <Input value={s.titulo} onChange={e => updSub(i, e.target.value)} placeholder="Subtarefa" className="h-8 text-[12px] rounded-lg border-border/60 flex-1" />
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive" onClick={() => delSub(i)}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <button onClick={addSub} className="text-[11px] text-muted-foreground/60 hover:text-foreground flex items-center gap-1 pl-0.5">
                <Plus className="h-3 w-3" /> Adicionar subtarefa
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2 pt-2.5">
                <Switch checked={passo.obrigatorio} onCheckedChange={v => onChange({ ...passo, obrigatorio: v })} className="scale-90" />
                <Label className="text-[12px] text-muted-foreground">Tarefa obrigatória</Label>
              </div>
              {passo.concluido && <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-600 pt-2.5"><CheckCircle2 className="h-3 w-3" /> Concluída pelo cliente</span>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Estágio (bloco) editor ─────────────────────────────────────────────────────

export function EstagioEditor({ estagio, index, onChange, onDelete }: {
  estagio: DraftEstagio; index: number;
  onChange: (e: DraftEstagio) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: estagio._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 30 : undefined };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addPasso() { onChange({ ...estagio, passos: [...estagio.passos, blankTarefa()] }); }
  function updPasso(i: number, p: DraftTarefa) { const n = [...estagio.passos]; n[i] = p; onChange({ ...estagio, passos: n }); }
  function delPasso(i: number) { onChange({ ...estagio, passos: estagio.passos.filter((_, j) => j !== i) }); }
  function onTarefaDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = estagio.passos.findIndex(p => p._id === active.id);
    const newI = estagio.passos.findIndex(p => p._id === over.id);
    if (oldI < 0 || newI < 0) return;
    onChange({ ...estagio, passos: arrayMove(estagio.passos, oldI, newI) });
  }

  return (
    <div ref={setNodeRef} style={style} className={cn('rounded-2xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden', isDragging ? 'border-foreground/40 shadow-lg' : 'border-border/60')}>
      <div className="h-[3px] w-full bg-foreground/80" />
      <div className="px-4 py-4 border-b border-border/40 bg-muted/[0.03] space-y-3">
        {/* Linha 1: número do bloco + controles */}
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/70 touch-none" title="Arraste para reordenar o bloco"><GripVertical className="h-4 w-4" /></button>
          <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center text-[12px] font-bold shrink-0 font-display">{index + 1}</div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Bloco {index + 1}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {/* Título — destaque de heading */}
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Título do bloco</Label>
          <Input
            value={estagio.titulo}
            onChange={e => onChange({ ...estagio, titulo: e.target.value })}
            placeholder="Ex.: Estruturar a triagem e o atendimento inicial"
            className="h-11 text-[16px] font-bold font-display rounded-lg border-border/60 bg-background"
          />
        </div>

        {/* Descrição — subtítulo em markdown */}
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Descrição do bloco</Label>
          <MarkdownEditor
            value={estagio.descricao}
            onChange={v => onChange({ ...estagio, descricao: v })}
            placeholder="Contexto do bloco: por que ele existe e o que o cliente deve alcançar. Use a barra para negrito, listas, subtítulos…"
            minHeight={80}
          />
        </div>
      </div>
      <div className="p-3 space-y-2 bg-muted/[0.02]">
        {estagio.passos.length === 0 && (
          <p className="text-[11px] text-muted-foreground/40 text-center py-3">Nenhuma tarefa neste bloco ainda.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTarefaDragEnd}>
          <SortableContext items={estagio.passos.map(p => p._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {estagio.passos.map((p, i) => (
                <TarefaEditor key={p._id} passo={p} index={i}
                  onChange={u => updPasso(i, u)} onDelete={() => delPasso(i)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button onClick={addPasso} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border/40 hover:border-border/70 text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-all">
          <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
        </button>
      </div>
    </div>
  );
}
