import { useState, useCallback, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  PenLine, Plus, FolderPlus, ChevronRight, ChevronDown, MoreHorizontal,
  Grid3X3, List, Search, ArrowLeft, Pencil, Trash2, Copy, FolderInput,
  Loader2, Clock, FolderOpen, X, History, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ModalNovoBoard } from "@/components/canvas/ModalNovoBoard";
import { ModalNovaPasta } from "@/components/canvas/ModalNovaPasta";
import { ModalMoverBoard } from "@/components/canvas/ModalMoverBoard";
import { HistoricoVersoes } from "@/components/canvas/HistoricoVersoes";

// Lazy load Excalidraw (browser-only APIs)
const ExcalidrawWrapper = lazy(() => import("@/components/canvas/ExcalidrawWrapper"));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CanvasPasta {
  id: string;
  organization_id: string;
  pasta_pai_id: string | null;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  ordem: number;
  fixado: boolean;
  criado_em: string;
}

interface CanvasBoard {
  id: string;
  organization_id: string;
  pasta_id: string | null;
  titulo: string;
  descricao: string | null;
  thumbnail: string | null;
  cor: string;
  fixado: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface CanvasBoardFull extends CanvasBoard {
  elements: any[];
  app_state: any;
  files: any;
  usuario_id: string | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sortable Folder Item
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SortableFolderItem({
  pasta,
  pastas,
  selectedPastaId,
  onSelectPasta,
  onRenamePasta,
  onDeletePasta,
  onCreateSubpasta,
  onReorder,
  boardCounts,
  level,
}: {
  pasta: CanvasPasta;
  pastas: CanvasPasta[];
  selectedPastaId: string | null;
  onSelectPasta: (id: string | null) => void;
  onRenamePasta: (pasta: CanvasPasta) => void;
  onDeletePasta: (id: string) => void;
  onCreateSubpasta: (parentId: string) => void;
  onReorder: (parentId: string | null, oldIndex: number, newIndex: number) => void;
  boardCounts: Record<string, number>;
  level: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = pastas.some(p => p.pasta_pai_id === pasta.id);
  const isSelected = selectedPastaId === pasta.id;
  const count = boardCounts[pasta.id] || 0;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pasta.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "group flex items-center gap-1 px-1 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted/60 text-foreground/80"
        )}
        onClick={() => onSelectPasta(pasta.id)}
      >
        {/* Drag handle */}
        <button
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-opacity shrink-0 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        <button
          className="p-0.5 rounded hover:bg-muted/80 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(prev => !prev);
          }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="w-3" />
          )}
        </button>
        <FolderOpen
          className="h-4 w-4 shrink-0"
          style={{ color: pasta.cor }}
        />
        <span className="truncate flex-1">{pasta.nome}</span>
        {count > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded-full">
            {count}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onRenamePasta(pasta)}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateSubpasta(pasta.id)}>
              <FolderPlus className="h-3.5 w-3.5 mr-2" /> Nova subpasta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDeletePasta(pasta.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasChildren && expanded && (
        <FolderTree
          pastas={pastas}
          parentId={pasta.id}
          selectedPastaId={selectedPastaId}
          onSelectPasta={onSelectPasta}
          onRenamePasta={onRenamePasta}
          onDeletePasta={onDeletePasta}
          onCreateSubpasta={onCreateSubpasta}
          onReorder={onReorder}
          boardCounts={boardCounts}
          level={level + 1}
        />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Folder Tree Component (sortable)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function FolderTree({
  pastas,
  parentId = null,
  selectedPastaId,
  onSelectPasta,
  onRenamePasta,
  onDeletePasta,
  onCreateSubpasta,
  onReorder,
  boardCounts,
  level = 0,
}: {
  pastas: CanvasPasta[];
  parentId?: string | null;
  selectedPastaId: string | null;
  onSelectPasta: (id: string | null) => void;
  onRenamePasta: (pasta: CanvasPasta) => void;
  onDeletePasta: (id: string) => void;
  onCreateSubpasta: (parentId: string) => void;
  onReorder: (parentId: string | null, oldIndex: number, newIndex: number) => void;
  boardCounts: Record<string, number>;
  level?: number;
}) {
  const children = pastas
    .filter(p => p.pasta_pai_id === parentId)
    .sort((a, b) => a.ordem - b.ordem);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (children.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = children.findIndex(p => p.id === active.id);
    const newIndex = children.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(parentId, oldIndex, newIndex);
  };

  return (
    <div className={cn(level > 0 && "ml-3 border-l border-border/40 pl-1")}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={children.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {children.map(pasta => (
            <SortableFolderItem
              key={pasta.id}
              pasta={pasta}
              pastas={pastas}
              selectedPastaId={selectedPastaId}
              onSelectPasta={onSelectPasta}
              onRenamePasta={onRenamePasta}
              onDeletePasta={onDeletePasta}
              onCreateSubpasta={onCreateSubpasta}
              onReorder={onReorder}
              boardCounts={boardCounts}
              level={level}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Board Card Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BoardCard({
  board,
  onOpen,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
}: {
  board: CanvasBoard;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group border rounded-xl overflow-hidden bg-card hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-primary/30"
      onDoubleClick={onOpen}
    >
      {/* Thumbnail */}
      <div className="relative h-[160px] bg-muted/30 overflow-hidden">
        {board.thumbnail ? (
          <img
            src={board.thumbnail}
            alt={board.titulo}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: board.cor + "15" }}
          >
            <PenLine className="h-10 w-10" style={{ color: board.cor + "60" }} />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <Button
            variant="secondary"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm truncate flex-1">{board.titulo}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMove}>
                <FolderInput className="h-3.5 w-3.5 mr-2" /> Mover para pasta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(board.atualizado_em), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Editor TopBar Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EditorTopBar({
  board,
  saveStatus,
  onBack,
  onTitleChange,
  onOpenHistorico,
}: {
  board: CanvasBoardFull;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onOpenHistorico: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(board.titulo);

  return (
    <div className="h-12 bg-card border-b flex items-center px-3 gap-3 z-50 relative shrink-0">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 shrink-0">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="h-5 w-px bg-border" />

      {isEditing ? (
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            if (editTitle.trim() && editTitle !== board.titulo) {
              onTitleChange(editTitle.trim());
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setIsEditing(false);
              if (editTitle.trim() && editTitle !== board.titulo) {
                onTitleChange(editTitle.trim());
              }
            }
            if (e.key === "Escape") {
              setIsEditing(false);
              setEditTitle(board.titulo);
            }
          }}
          className="h-8 max-w-[300px] text-sm font-semibold"
          autoFocus
        />
      ) : (
        <button
          className="flex items-center gap-1.5 hover:bg-muted/60 px-2 py-1 rounded-md transition-colors"
          onClick={() => setIsEditing(true)}
        >
          <PenLine className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold truncate max-w-[300px]">{board.titulo}</span>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}

      <div className="flex-1" />

      <Button variant="ghost" size="sm" className="gap-1.5 text-xs shrink-0" onClick={onOpenHistorico}>
        <History className="h-3.5 w-3.5" /> Versoes
      </Button>

      <Badge
        variant="outline"
        className={cn(
          "text-[10px] shrink-0 transition-colors",
          saveStatus === "saving" && "text-amber-600 border-amber-200 bg-amber-50",
          saveStatus === "saved" && "text-emerald-600 border-emerald-200 bg-emerald-50",
          saveStatus === "error" && "text-red-600 border-red-200 bg-red-50",
          saveStatus === "idle" && "text-muted-foreground"
        )}
      >
        {saveStatus === "saving" && <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Salvando...</>}
        {saveStatus === "saved" && "Salvo"}
        {saveStatus === "error" && "Erro ao salvar"}
        {saveStatus === "idle" && ""}
      </Badge>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Canvas Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Canvas() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  // State
  const [selectedPastaId, setSelectedPastaId] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "created">("recent");

  // Dialogs
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [editPastaDialog, setEditPastaDialog] = useState<CanvasPasta | null>(null);
  const [showNewPastaModal, setShowNewPastaModal] = useState(false);
  const [newPastaParentId, setNewPastaParentId] = useState<string | null>(null);
  const [renameBoardDialog, setRenameBoardDialog] = useState<CanvasBoard | null>(null);
  const [moveBoardDialog, setMoveBoardDialog] = useState<CanvasBoard | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showHistorico, setShowHistorico] = useState(false);

  // Save status (driven by ExcalidrawWrapper)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Key to force remount ExcalidrawWrapper on version restore
  const [boardKey, setBoardKey] = useState(0);
  // Imperative save ref — call before closing editor
  const excalidrawSaveRef = useRef<(() => Promise<void>) | null>(null);

  // ━━━ Queries ━━━

  const { data: pastas = [], isLoading: pastasLoading } = useQuery({
    queryKey: ["canvas-pastas", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("canvas_pastas") as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("ordem");
      if (error) throw error;
      return data as CanvasPasta[];
    },
    enabled: !!orgId,
  });

  const { data: allBoards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["canvas-boards", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("canvas_boards") as any)
        .select("id, organization_id, pasta_id, titulo, descricao, thumbnail, cor, fixado, criado_em, atualizado_em")
        .eq("organization_id", orgId!)
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return data as CanvasBoard[];
    },
    enabled: !!orgId,
  });

  const { data: editingBoard, isLoading: boardLoading } = useQuery({
    queryKey: ["canvas-board-full", editingBoardId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("canvas_boards") as any)
        .select("*")
        .eq("id", editingBoardId!)
        .single();
      if (error) throw error;
      return data as CanvasBoardFull;
    },
    enabled: !!editingBoardId,
    staleTime: 0, // Always fetch fresh data when entering the editor
    gcTime: 0,    // Don't cache — each editor session should load latest
  });

  // Board counts per folder
  const boardCounts = allBoards.reduce<Record<string, number>>((acc, b) => {
    const key = b.pasta_id || "__root__";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // Filtered & sorted boards
  const filteredBoards = allBoards
    .filter(b => {
      if (selectedPastaId && b.pasta_id !== selectedPastaId) return false;
      if (!selectedPastaId) return true; // "Todos"
      return true;
    })
    .filter(b => !searchTerm || b.titulo.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.titulo.localeCompare(b.titulo);
      if (sortBy === "created") return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
      return new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime();
    });

  // Breadcrumb
  const getBreadcrumb = (): string[] => {
    if (!selectedPastaId) return ["Todos os Canvas"];
    const parts: string[] = [];
    let current = pastas.find(p => p.id === selectedPastaId);
    while (current) {
      parts.unshift(current.nome);
      current = pastas.find(p => p.id === current!.pasta_pai_id);
    }
    return parts;
  };

  // ━━━ Mutations ━━━

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("canvas_boards") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-boards"] });
      toast.success("Canvas excluido");
    },
  });

  const duplicateBoard = useMutation({
    mutationFn: async (board: CanvasBoard) => {
      // Fetch full board data
      const { data: full, error: fetchError } = await (supabase.from("canvas_boards") as any)
        .select("*")
        .eq("id", board.id)
        .single();
      if (fetchError) throw fetchError;

      const { error } = await (supabase.from("canvas_boards") as any)
        .insert({
          organization_id: orgId,
          pasta_id: full.pasta_id,
          titulo: `${full.titulo} (copia)`,
          elements: full.elements,
          app_state: full.app_state,
          files: full.files,
          thumbnail: full.thumbnail,
          cor: full.cor,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-boards"] });
      toast.success("Canvas duplicado!");
    },
  });

  const updateBoard = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await (supabase.from("canvas_boards") as any)
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-boards"] });
      queryClient.invalidateQueries({ queryKey: ["canvas-board-full"] });
    },
  });

  const deletePasta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("canvas_pastas") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-pastas"] });
      if (selectedPastaId) setSelectedPastaId(null);
      toast.success("Pasta excluida");
    },
  });

  // ━━━ Reorder pastas (drag & drop) ━━━

  const reorderPastas = useMutation({
    mutationFn: async (updates: { id: string; ordem: number }[]) => {
      // Batch update ordem for each pasta
      await Promise.all(
        updates.map(({ id, ordem }) =>
          (supabase.from("canvas_pastas") as any)
            .update({ ordem })
            .eq("id", id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-pastas"] });
    },
  });

  const handleReorderPastas = useCallback(
    (parentId: string | null, oldIndex: number, newIndex: number) => {
      // Get siblings for this parent, sorted by ordem
      const siblings = pastas
        .filter(p => p.pasta_pai_id === parentId)
        .sort((a, b) => a.ordem - b.ordem);

      const reordered = arrayMove(siblings, oldIndex, newIndex);

      // Optimistic update
      const updatedPastas = pastas.map(p => {
        const idx = reordered.findIndex(r => r.id === p.id);
        if (idx !== -1) return { ...p, ordem: idx };
        return p;
      });
      queryClient.setQueryData(["canvas-pastas", orgId], updatedPastas);

      // Persist to DB
      const updates = reordered.map((p, idx) => ({ id: p.id, ordem: idx }));
      reorderPastas.mutate(updates);
    },
    [pastas, orgId, queryClient, reorderPastas]
  );

  // ━━━ Editor handlers ━━━

  const handleCloseEditor = useCallback(async () => {
    // Save current state BEFORE unmounting the editor
    if (excalidrawSaveRef.current) {
      try {
        await excalidrawSaveRef.current();
      } catch {
        // Continue closing even if save fails
      }
    }
    // Now close and refresh with latest data
    setEditingBoardId(null);
    setSaveStatus("idle");
    queryClient.invalidateQueries({ queryKey: ["canvas-boards"] });
    queryClient.invalidateQueries({ queryKey: ["canvas-board-full"] });
  }, [queryClient]);

  // ━━━ MODO EDITOR ━━━
  if (editingBoardId) {
    if (boardLoading || !editingBoard) {
      return (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-[calc(100vh-0px)] -m-6 bg-background">
        <EditorTopBar
          board={editingBoard}
          saveStatus={saveStatus}
          onBack={handleCloseEditor}
          onTitleChange={(title) => updateBoard.mutate({ id: editingBoard.id, titulo: title })}
          onOpenHistorico={() => setShowHistorico(true)}
        />
        <div className="flex-1 relative">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Carregando canvas...</span>
              </div>
            }
          >
            <ExcalidrawWrapper
              key={boardKey}
              boardId={editingBoard.id}
              initialElements={editingBoard.elements || []}
              initialAppState={editingBoard.app_state || {}}
              initialFiles={editingBoard.files || {}}
              onSaveStatusChange={setSaveStatus}
              saveRef={excalidrawSaveRef}
            />
          </Suspense>
        </div>

        <HistoricoVersoes
          open={showHistorico}
          onOpenChange={setShowHistorico}
          boardId={editingBoard.id}
          currentElements={editingBoard.elements || []}
          currentAppState={editingBoard.app_state || {}}
          onRestore={() => {
            queryClient.invalidateQueries({ queryKey: ["canvas-board-full", editingBoardId] });
            setBoardKey(prev => prev + 1);
          }}
        />
      </div>
    );
  }

  // ━━━ MODO LISTA ━━━
  const breadcrumb = getBreadcrumb();

  return (
    <div className="flex h-[calc(100vh-64px)] -m-6 bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-[260px] border-r bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <PenLine className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">Canvas</h2>
          </div>
          <div className="space-y-2">
            <Button
              className="w-full justify-start gap-2"
              size="sm"
              onClick={() => setShowNewBoardModal(true)}
            >
              <Plus className="h-4 w-4" />
              Novo Canvas
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              size="sm"
              onClick={() => {
                setNewPastaParentId(selectedPastaId);
                setEditPastaDialog(null);
                setShowNewPastaModal(true);
              }}
            >
              <FolderPlus className="h-4 w-4" />
              Nova Pasta
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-2">
          {pastasLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-3/4" />
            </div>
          ) : (
            <FolderTree
              pastas={pastas}
              parentId={null}
              selectedPastaId={selectedPastaId}
              onSelectPasta={setSelectedPastaId}
              onRenamePasta={(p) => {
                setEditPastaDialog(p as any);
                setShowNewPastaModal(true);
              }}
              onDeletePasta={(id) => deletePasta.mutate(id)}
              onCreateSubpasta={(parentId) => {
                setNewPastaParentId(parentId);
                setEditPastaDialog(null);
                setShowNewPastaModal(true);
              }}
              onReorder={handleReorderPastas}
              boardCounts={boardCounts}
            />
          )}
        </ScrollArea>

        <div className="border-t p-2">
          <button
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              !selectedPastaId
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted/60 text-muted-foreground"
            )}
            onClick={() => setSelectedPastaId(null)}
          >
            <Grid3X3 className="h-4 w-4" />
            Todos os Canvas
            <span className="ml-auto text-[10px] bg-muted px-1.5 rounded-full">
              {allBoards.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {breadcrumb.map((part, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>
                    {part}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar canvas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 w-[200px] text-sm"
                />
                {searchTerm && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recente</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="created">Criado</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <button
                  className={cn(
                    "p-1.5 rounded-l-md transition-colors",
                    viewMode === "grid" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  className={cn(
                    "p-1.5 rounded-r-md transition-colors",
                    viewMode === "list" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Board Content */}
        <ScrollArea className="flex-1 p-4">
          {boardsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-[230px] rounded-xl" />
              ))}
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <PenLine className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-1">Nenhum canvas ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie seu primeiro canvas para comecar a desenhar
              </p>
              <Button onClick={() => setShowNewBoardModal(true)}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeiro canvas
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBoards.map(board => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onOpen={() => setEditingBoardId(board.id)}
                  onRename={() => {
                    setRenameBoardDialog(board);
                    setRenameValue(board.titulo);
                  }}
                  onDuplicate={() => duplicateBoard.mutate(board)}
                  onMove={() => setMoveBoardDialog(board)}
                  onDelete={() => deleteBoard.mutate(board.id)}
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Titulo</th>
                    <th className="text-left p-3 font-medium">Pasta</th>
                    <th className="text-left p-3 font-medium">Ultima edicao</th>
                    <th className="text-left p-3 font-medium">Criado em</th>
                    <th className="text-right p-3 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBoards.map(board => {
                    const pasta = pastas.find(p => p.id === board.pasta_id);
                    return (
                      <tr
                        key={board.id}
                        className="border-b hover:bg-muted/20 cursor-pointer"
                        onDoubleClick={() => setEditingBoardId(board.id)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                              style={{ backgroundColor: board.cor + "20" }}
                            >
                              <PenLine className="h-4 w-4" style={{ color: board.cor }} />
                            </div>
                            <span className="font-medium">{board.titulo}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{pasta?.nome || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {formatDistanceToNow(new Date(board.atualizado_em), { addSuffix: true, locale: ptBR })}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(board.criado_em).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => setEditingBoardId(board.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setRenameBoardDialog(board);
                                  setRenameValue(board.titulo);
                                }}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicateBoard.mutate(board)}>
                                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteBoard.mutate(board.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ━━━ Modals ━━━ */}

      <ModalNovoBoard
        open={showNewBoardModal}
        onOpenChange={setShowNewBoardModal}
        pastas={pastas}
        defaultPastaId={selectedPastaId}
        onCreated={(boardId) => setEditingBoardId(boardId)}
      />

      <ModalNovaPasta
        open={showNewPastaModal}
        onOpenChange={setShowNewPastaModal}
        pastas={pastas}
        defaultParentId={newPastaParentId}
        editingPasta={editPastaDialog as any}
      />

      {moveBoardDialog && (
        <ModalMoverBoard
          open={!!moveBoardDialog}
          onOpenChange={() => setMoveBoardDialog(null)}
          boardId={moveBoardDialog.id}
          boardTitulo={moveBoardDialog.titulo}
          currentPastaId={moveBoardDialog.pasta_id}
          pastas={pastas}
        />
      )}

      {/* Rename Board Dialog (kept inline — simple) */}
      <Dialog open={!!renameBoardDialog} onOpenChange={() => setRenameBoardDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear Canvas</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Titulo</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim() && renameBoardDialog) {
                  updateBoard.mutate({ id: renameBoardDialog.id, titulo: renameValue.trim() });
                  setRenameBoardDialog(null);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameBoardDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (renameValue.trim() && renameBoardDialog) {
                  updateBoard.mutate({ id: renameBoardDialog.id, titulo: renameValue.trim() });
                  setRenameBoardDialog(null);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
