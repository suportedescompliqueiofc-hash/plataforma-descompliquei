import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Trash2, Mic, Image as ImageIcon, Video, FileText, MessageSquare, GripVertical, Pencil } from "lucide-react";
import { QuickMessage } from "@/hooks/useQuickMessages";
import { cn } from "@/lib/utils";

interface SortableMessageCardProps {
  message: QuickMessage;
  onEdit: (message: QuickMessage) => void;
  onDelete: (id: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof MessageSquare; label: string; accent: string }> = {
  texto:  { icon: MessageSquare, label: "Texto",  accent: "bg-blue-50 text-blue-600 border-blue-200/60" },
  audio:  { icon: Mic,           label: "Audio",  accent: "bg-violet-50 text-violet-600 border-violet-200/60" },
  imagem: { icon: ImageIcon,     label: "Imagem", accent: "bg-emerald-50 text-emerald-600 border-emerald-200/60" },
  video:  { icon: Video,         label: "Video",  accent: "bg-amber-50 text-amber-600 border-amber-200/60" },
  pdf:    { icon: FileText,      label: "PDF",    accent: "bg-red-50 text-red-600 border-red-200/60" },
};

export function SortableMessageCard({ message, onEdit, onDelete }: SortableMessageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: message.id,
    data: { type: "Message", message },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const typeInfo = TYPE_CONFIG[message.tipo] || TYPE_CONFIG.texto;
  const TypeIcon = typeInfo.icon;

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <div className={cn(
        "h-full flex flex-col rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative group transition-all duration-200 hover:border-border hover:shadow-md overflow-hidden",
        isDragging && "border-foreground/20 shadow-lg ring-1 ring-foreground/10"
      )}>
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2.5 right-2.5 p-1 text-muted-foreground/20 hover:text-muted-foreground cursor-grab active:cursor-grabbing z-10 transition-colors"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Type badge */}
          <div className="mb-3">
            <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", typeInfo.accent)}>
              <TypeIcon className="h-2.5 w-2.5" />
              {typeInfo.label}
            </span>
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-foreground truncate pr-6 mb-1.5" title={message.titulo}>
            {message.titulo}
          </h4>

          {/* Preview */}
          <p className="text-[11px] text-muted-foreground/60 line-clamp-2 flex-1 leading-relaxed">
            {message.conteudo || (message.arquivo_path ? "Arquivo de mídia anexado" : "Sem conteúdo")}
          </p>

          {/* File indicator */}
          {message.arquivo_path && (
            <div className="mt-2">
              <span className="text-[9px] font-medium text-muted-foreground/40 bg-muted/50 px-2 py-0.5 rounded-md truncate inline-block max-w-full">
                {message.arquivo_path.split('/').pop()}
              </span>
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div className="flex items-center justify-end gap-1 px-3 py-2.5 border-t border-border/40 bg-muted/[0.03] opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors rounded-lg"
            onClick={(e) => { e.stopPropagation(); onEdit(message); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors rounded-lg"
            onClick={(e) => { e.stopPropagation(); onDelete(message.id); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
