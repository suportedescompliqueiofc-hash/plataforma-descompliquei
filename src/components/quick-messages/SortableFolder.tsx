import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QuickMessageFolder } from "@/hooks/useQuickMessageFolders";
import { QuickMessage } from "@/hooks/useQuickMessages";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableMessageCard } from "./SortableMessageCard";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableFolderProps {
  folder: QuickMessageFolder;
  messages: QuickMessage[];
  onDeleteFolder: (id: string) => void;
  onEditMessage: (message: QuickMessage) => void;
  onDeleteMessage: (id: string) => void;
}

export function SortableFolder({ folder, messages, onDeleteFolder, onEditMessage, onDeleteMessage }: SortableFolderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: folder.id,
    data: { type: "Folder", folder },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-6 group/folder">
      {/* Folder Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded-md text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          <div
            className="h-5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: folder.color }}
          />

          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {folder.name}
          </h3>

          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {messages.length}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/folder:opacity-100 transition-all"
          onClick={() => onDeleteFolder(folder.id)}
          title="Excluir Pasta"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages Grid */}
      <div className={cn(
        "rounded-2xl p-4 border transition-colors min-h-[100px]",
        messages.length === 0
          ? "border-dashed border-border/60 bg-muted/[0.03] flex flex-col items-center justify-center"
          : "border-border/40 bg-card/50"
      )}>
        <SortableContext items={messages.map(m => m.id)} strategy={rectSortingStrategy}>
          {messages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {messages.map((msg) => (
                <SortableMessageCard
                  key={msg.id}
                  message={msg}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
              <p className="text-xs font-medium text-muted-foreground/40">Pasta vazia</p>
              <p className="text-[10px] text-muted-foreground/30 mt-0.5">Arraste mensagens para ca</p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
