import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, ChevronRight, ChevronDown, Check, Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasPasta {
  id: string;
  nome: string;
  pasta_pai_id: string | null;
  cor: string;
}

interface ModalMoverBoardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardTitulo: string;
  currentPastaId: string | null;
  pastas: CanvasPasta[];
}

function PastaTree({
  pastas,
  parentId = null,
  selected,
  onSelect,
  level = 0,
}: {
  pastas: CanvasPasta[];
  parentId?: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const children = pastas.filter(p => p.pasta_pai_id === parentId);
  if (children.length === 0) return null;

  return (
    <div className={cn(level > 0 && "ml-4 border-l border-border/40 pl-1")}>
      {children.map(pasta => {
        const hasChildren = pastas.some(p => p.pasta_pai_id === pasta.id);
        const isExpanded = expanded[pasta.id] ?? false;
        const isSelected = selected === pasta.id;

        return (
          <div key={pasta.id}>
            <button
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left",
                isSelected
                  ? "bg-primary/10 text-primary font-medium border border-primary/20"
                  : "hover:bg-muted/60 text-foreground/80"
              )}
              onClick={() => onSelect(pasta.id)}
            >
              {hasChildren ? (
                <span
                  className="shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(prev => ({ ...prev, [pasta.id]: !prev[pasta.id] }));
                  }}
                >
                  {isExpanded
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                </span>
              ) : (
                <span className="w-3.5" />
              )}
              <FolderOpen className="h-4 w-4 shrink-0" style={{ color: pasta.cor }} />
              <span className="truncate flex-1">{pasta.nome}</span>
              {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
            {hasChildren && isExpanded && (
              <PastaTree
                pastas={pastas}
                parentId={pasta.id}
                selected={selected}
                onSelect={onSelect}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ModalMoverBoard({
  open,
  onOpenChange,
  boardId,
  boardTitulo,
  currentPastaId,
  pastas,
}: ModalMoverBoardProps) {
  const queryClient = useQueryClient();
  const [selectedPasta, setSelectedPasta] = useState<string | null>(currentPastaId);

  const moveBoard = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("canvas_boards") as any)
        .update({
          pasta_id: selectedPasta,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", boardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-boards"] });
      toast.success("Canvas movido!");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao mover canvas"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mover Canvas</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Mover <span className="font-medium text-foreground">{boardTitulo}</span> para:
        </p>

        <ScrollArea className="max-h-[300px] border rounded-lg p-2">
          {/* Option: No folder */}
          <button
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left mb-1",
              selectedPasta === null
                ? "bg-primary/10 text-primary font-medium border border-primary/20"
                : "hover:bg-muted/60 text-foreground/80"
            )}
            onClick={() => setSelectedPasta(null)}
          >
            <Inbox className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1">Sem pasta (raiz)</span>
            {selectedPasta === null && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>

          <PastaTree
            pastas={pastas}
            parentId={null}
            selected={selectedPasta}
            onSelect={setSelectedPasta}
          />
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => moveBoard.mutate()}
            disabled={selectedPasta === currentPastaId || moveBoard.isPending}
          >
            {moveBoard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
