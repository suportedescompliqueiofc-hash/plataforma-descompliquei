import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Plus, Trash2, Loader2 } from "lucide-react";
import { useOutboundStages, OutboundStage } from "@/hooks/useOutboundStages";
import { useOutboundProspectos } from "@/hooks/useOutboundProspectos";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CORES = ["#6366f1", "#E85D24", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

interface StageRow {
  id: string;
  nome: string;
  cor: string;
  tipo: "ativo" | "ganho" | "perdido";
  isNew?: boolean;
}

function SortableStageRow({ stage, onUpdate, onDelete, canDelete }: {
  stage: StageRow;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
        <Input value={stage.nome} onChange={e => onUpdate(stage.id, "nome", e.target.value)} placeholder="Nome do stage" className="h-8 text-sm" />
        <Select value={stage.cor} onValueChange={v => onUpdate(stage.id, "cor", v)}>
          <SelectTrigger className="w-[60px] h-8 px-2">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: stage.cor }} />
          </SelectTrigger>
          <SelectContent>
            {CORES.map(c => (
              <SelectItem key={c} value={c}>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />{c}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stage.tipo} onValueChange={v => onUpdate(stage.id, "tipo", v)}>
          <SelectTrigger className="w-[110px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="ganho">Ganho</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => onDelete(stage.id)} disabled={!canDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function GerenciarStagesModal({ open, onOpenChange }: Props) {
  const { stages, createStage, updateStage, deleteStage } = useOutboundStages();
  const { prospectos } = useOutboundProspectos();
  const [rows, setRows] = useState<StageRow[]>([]);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (open) {
      setRows(stages.map(s => ({ id: s.id, nome: s.nome, cor: s.cor, tipo: s.tipo })));
    }
  }, [open, stages]);

  const prospectoCountByStage = (stageId: string) => prospectos.filter(p => p.stage_id === stageId).length;

  const handleUpdate = (id: string, field: string, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDelete = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleAdd = () => {
    setRows(prev => [...prev, {
      id: `new-${Date.now()}`,
      nome: "",
      cor: CORES[prev.length % CORES.length],
      tipo: "ativo",
      isNew: true,
    }]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex(r => r.id === active.id);
    const newIndex = rows.findIndex(r => r.id === over.id);
    setRows(arrayMove(rows, oldIndex, newIndex));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingIds = stages.map(s => s.id);
      const currentIds = rows.filter(r => !r.isNew).map(r => r.id);
      const deletedIds = existingIds.filter(id => !currentIds.includes(id));

      for (const id of deletedIds) {
        await deleteStage.mutateAsync(id);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.isNew) {
          if (!row.nome.trim()) continue;
          await createStage.mutateAsync({
            nome: row.nome.trim(),
            cor: row.cor,
            tipo: row.tipo,
            posicao_ordem: i,
          });
        } else {
          const original = stages.find(s => s.id === row.id);
          if (original && (original.nome !== row.nome || original.cor !== row.cor || original.tipo !== row.tipo || original.posicao_ordem !== i)) {
            await updateStage.mutateAsync({
              id: row.id,
              nome: row.nome.trim(),
              cor: row.cor,
              tipo: row.tipo,
              posicao_ordem: i,
            });
          }
        }
      }

      toast.success("Stages salvos com sucesso");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar stages: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Stages do Pipeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
              {rows.map(row => (
                <SortableStageRow
                  key={row.id}
                  stage={row}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  canDelete={row.isNew || prospectoCountByStage(row.id) === 0}
                />
              ))}
            </SortableContext>
          </DndContext>

          <Button variant="outline" className="w-full mt-3" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Stage
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Stages
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
