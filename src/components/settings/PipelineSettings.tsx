import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, GripVertical, Sparkles, Target, GitBranch, Loader2, Inbox } from "lucide-react";
import { useStagesManager } from "@/hooks/useStagesManager";
import { Stage } from "@/hooks/useStages";
import { STAGES_QUERY_KEY } from "@/hooks/useStages";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useProfile } from "@/hooks/useProfile";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const SortableStageRow = ({
  stage,
  onEdit,
  onDelete,
  onToggleFunnel
}: {
  stage: Stage;
  onEdit: (stage: Stage) => void;
  onDelete: (stage: Stage) => void;
  onToggleFunnel: (id: number, current: boolean) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
    >
      <div className="flex items-center gap-2.5">
        <span {...listeners} className="cursor-grab p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <GripVertical className="h-4 w-4" />
        </span>
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: stage.cor }}
        />
        <span className="text-sm font-medium text-foreground">{stage.nome}</span>
        {stage.em_funil && (
          <Badge variant="outline" className="text-[9px] font-medium border-emerald-200 bg-emerald-50 text-emerald-700 px-1.5 py-0">
            Funil
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleFunnel(stage.id, !!stage.em_funil)}
          className={cn(
            "h-7 w-7 rounded-full transition-all",
            stage.em_funil ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" : "text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
          )}
          title={stage.em_funil ? "Remover do funil" : "Incluir no funil"}
        >
          <Target className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEdit(stage)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(stage)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export function PipelineSettings() {
  const { stages, isLoading: isLoadingStages, createStage, updateStage, deleteStage, updateStagesOrder, toggleFunnelStage } = useStagesManager();
  const { profile, role, isLoading: isLoadingProfile } = useProfile();
  const [localStages, setLocalStages] = useState<Stage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [isDeleting, setIsDeleting] = useState<Stage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#cccccc");
  const [isResetting, setIsResetting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setLocalStages(stages);
  }, [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (isLoadingProfile || isLoadingStages) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openModal = (stage: Stage | null = null) => {
    if (stage) {
      setEditingStage(stage);
      setStageName(stage.nome);
      setStageColor(stage.cor);
    } else {
      setEditingStage(null);
      setStageName("");
      setStageColor("#cccccc");
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!stageName.trim()) return;
    if (editingStage) {
      updateStage.mutate({ id: editingStage.id, nome: stageName, cor: stageColor });
    } else {
      const maxOrder = stages.reduce((max, s) => Math.max(max, s.posicao_ordem), 0);
      createStage.mutate({ nome: stageName, cor: stageColor, posicao_ordem: maxOrder + 1, em_funil: false } as any);
    }
    setIsModalOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setLocalStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over!.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        const updates = newOrder.map((stage, index) => ({ id: stage.id, posicao_ordem: index + 1 }));
        updateStagesOrder.mutate(updates);
        return newOrder;
      });
    }
  };

  const DEFAULT_STAGES = [
    { nome: 'Em Atendimento', cor: '#f97316', posicao_ordem: 1, em_funil: true },
    { nome: 'Qualificação', cor: '#3b82f6', posicao_ordem: 2, em_funil: true },
    { nome: 'Qualificado', cor: '#8b5cf6', posicao_ordem: 3, em_funil: true },
    { nome: 'Handoff', cor: '#a855f7', posicao_ordem: 4, em_funil: true },
    { nome: 'Agendado', cor: '#10b981', posicao_ordem: 5, em_funil: true },
    { nome: 'Procedimento Fechado', cor: '#22c55e', posicao_ordem: 6, em_funil: true },
  ];

  const handleSeedStages = async () => {
    if (!profile?.organization_id) {
      toast.error("Organização não identificada. Recarregue a página.");
      return;
    }
    if (!confirm("Isso irá padronizar as etapas para o modelo padrão. Continuar?")) return;

    setIsResetting(true);
    try {
      const orgId = profile.organization_id;
      const { data: currentStages, error: fetchError } = await supabase
        .from('etapas').select('*').eq('organization_id', orgId).order('posicao_ordem', { ascending: true });
      if (fetchError) throw fetchError;

      const existing = currentStages ?? [];
      const updates: Promise<any>[] = [];
      const inserts: typeof DEFAULT_STAGES = [];

      for (let i = 0; i < DEFAULT_STAGES.length; i++) {
        const target = DEFAULT_STAGES[i];
        if (i < existing.length) {
          updates.push(
            supabase.from('etapas')
              .update({ nome: target.nome, cor: target.cor, posicao_ordem: target.posicao_ordem, em_funil: target.em_funil })
              .eq('id', existing[i].id)
              .then(({ error }) => { if (error) throw error; })
          );
        } else {
          inserts.push(target);
        }
      }

      if (updates.length > 0) await Promise.all(updates);
      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from('etapas').insert(inserts.map(s => ({ ...s, organization_id: orgId })));
        if (insertError) throw insertError;
      }

      await queryClient.invalidateQueries({ queryKey: STAGES_QUERY_KEY });
      toast.success("Etapas padronizadas!");
    } catch (err: any) {
      console.error('Erro ao padronizar etapas:', err);
      toast.error("Erro: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Etapas do Pipeline</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Arraste para reordenar. Clique no alvo para incluir no funil.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedStages}
              disabled={isResetting}
              className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Padrão
            </Button>
            <Button
              size="sm"
              onClick={() => openModal()}
              className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Etapa
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {localStages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma etapa criada</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Clique em "Padrão" para criar as etapas recomendadas</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localStages.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {localStages.map((stage) => (
                  <SortableStageRow
                    key={stage.id}
                    stage={stage}
                    onEdit={openModal}
                    onDelete={setIsDeleting}
                    onToggleFunnel={(id, curr) => toggleFunnelStage({ id, incluir: !curr })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{editingStage ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Ex: Em Atendimento"
                className="h-10 text-sm rounded-lg border-border/60"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cor</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={stageColor}
                  onChange={(e) => setStageColor(e.target.value)}
                  className="w-12 h-10 p-1 rounded-lg border-border/60 cursor-pointer"
                />
                <Input
                  value={stageColor}
                  onChange={(e) => setStageColor(e.target.value)}
                  className="h-10 text-sm rounded-lg border-border/60 font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="rounded-lg text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} className="rounded-lg text-xs bg-foreground text-background hover:bg-foreground/90">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!isDeleting} onOpenChange={() => setIsDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta etapa? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (isDeleting) deleteStage.mutate(isDeleting.id); setIsDeleting(null); }}
              className="bg-destructive hover:bg-destructive/90 rounded-lg text-xs"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
