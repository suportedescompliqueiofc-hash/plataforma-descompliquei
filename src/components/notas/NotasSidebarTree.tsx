import { useMemo, useState } from "react";
import {
  DndContext, useDraggable, useDroppable, DragOverlay,
  type DragEndEvent, type DragOverEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  ChevronRight, FileText, Plus, MoreHorizontal, Trash2,
  ChevronUp, ChevronDown, FilePlus, Building2, Lock, Folder, FolderOpen,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PaginaResumo, TipoPagina } from "@/hooks/usePaginas";
import {
  useCriarPagina, useMoverPagina, useExcluirPagina,
} from "@/hooks/usePaginas";
import { buildTree, collectDescendantIds, type PaginaTreeNode } from "@/lib/paginasTree";
import { NotaIcone } from "@/lib/notasIcones";

const ROOT_DROP_ID = "__notas_root__";

type DropInfo = { overId: string; where: "antes" | "depois" | "dentro" } | null;

interface NotasSidebarTreeProps {
  paginas: PaginaResumo[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}

export function NotasSidebarTree({ paginas, activeId, onSelect }: NotasSidebarTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<PaginaResumo | null>(null);
  const [dropInfo, setDropInfo] = useState<DropInfo>(null);
  const [aExcluir, setAExcluir] = useState<PaginaResumo | null>(null);
  const criar = useCriarPagina();
  const mover = useMoverPagina();
  const excluir = useExcluirPagina();

  const tree = useMemo(() => buildTree(paginas), [paginas]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function novaPagina(parentId: string | null, tipo: TipoPagina) {
    try {
      const titulo = tipo === "pasta" ? "Nova pasta" : "Sem título";
      const id = await criar.mutateAsync({ titulo, parent_id: parentId, tipo });
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      onSelect(id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar página.");
    }
  }

  function excluirPagina(pagina: PaginaResumo) {
    setAExcluir(pagina);
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    try {
      await excluir.mutateAsync(aExcluir.id);
      toast.success("Página excluída.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir.");
    } finally {
      setAExcluir(null);
    }
  }

  function siblingsOf(pagina: PaginaResumo) {
    return paginas
      .filter((p) => p.parent_id === pagina.parent_id)
      .sort((a, b) => a.ordem_index - b.ordem_index);
  }

  async function moverEntreIrmaos(pagina: PaginaResumo, direcao: -1 | 1) {
    const irmaos = siblingsOf(pagina);
    const idx = irmaos.findIndex((p) => p.id === pagina.id);
    const alvo = irmaos[idx + direcao];
    if (!alvo) return;
    await Promise.all([
      mover.mutateAsync({ id: pagina.id, parent_id: pagina.parent_id, ordem_index: alvo.ordem_index }),
      mover.mutateAsync({ id: alvo.id, parent_id: alvo.parent_id, ordem_index: pagina.ordem_index }),
    ]);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || over.id === active.id) {
      setDropInfo(null);
      return;
    }
    if (over.id === ROOT_DROP_ID) {
      setDropInfo({ overId: ROOT_DROP_ID, where: "dentro" });
      return;
    }
    const alvo = paginas.find((p) => p.id === over.id);
    if (!alvo) {
      setDropInfo(null);
      return;
    }

    const overRect = over.rect;
    const activeRect = active.rect.current.translated;
    const centerY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top;
    const ratio = (centerY - overRect.top) / overRect.height;

    let where: "antes" | "depois" | "dentro";
    if (alvo.tipo === "pasta") {
      where = ratio < 0.3 ? "antes" : ratio > 0.7 ? "depois" : "dentro";
    } else {
      where = ratio < 0.5 ? "antes" : "depois";
    }
    setDropInfo({ overId: over.id as string, where });
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const info = dropInfo;
    setDropInfo(null);
    const { active, over } = event;
    if (!over || over.id === active.id || !info) return;

    const arrastado = paginas.find((p) => p.id === active.id);
    if (!arrastado) return;

    let parentIdDestino: string | null;
    let alvo: PaginaResumo | undefined;

    if (info.where === "dentro") {
      if (info.overId === ROOT_DROP_ID) {
        parentIdDestino = null;
      } else {
        alvo = paginas.find((p) => p.id === info.overId);
        if (!alvo || alvo.tipo !== "pasta") return;
        parentIdDestino = alvo.id;
      }
    } else {
      alvo = paginas.find((p) => p.id === info.overId);
      if (!alvo) return;
      parentIdDestino = alvo.parent_id;
    }

    if (
      parentIdDestino === arrastado.id ||
      (parentIdDestino && collectDescendantIds(paginas, arrastado.id).has(parentIdDestino))
    ) {
      toast.error("Não é possível mover uma página para dentro dela mesma.");
      return;
    }

    try {
      if (info.where === "dentro") {
        const novosIrmaos = paginas.filter((p) => p.parent_id === parentIdDestino && p.id !== arrastado.id);
        const proximoOrdem = novosIrmaos.length ? Math.max(...novosIrmaos.map((p) => p.ordem_index)) + 1 : 0;
        if (proximoOrdem === arrastado.ordem_index && parentIdDestino === arrastado.parent_id) return;
        await mover.mutateAsync({ id: arrastado.id, parent_id: parentIdDestino, ordem_index: proximoOrdem });
        if (parentIdDestino) setExpanded((prev) => new Set(prev).add(parentIdDestino as string));
      } else {
        const grupo = paginas
          .filter((p) => p.parent_id === parentIdDestino && p.id !== arrastado.id)
          .sort((a, b) => a.ordem_index - b.ordem_index);
        const idxAlvo = grupo.findIndex((p) => p.id === (alvo as PaginaResumo).id);
        const insertIdx = info.where === "depois" ? idxAlvo + 1 : idxAlvo;
        grupo.splice(insertIdx, 0, arrastado);

        const chamadas = grupo
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => p.ordem_index !== i || p.parent_id !== parentIdDestino)
          .map(({ p, i }) => mover.mutateAsync({ id: p.id, parent_id: parentIdDestino, ordem_index: i }));
        await Promise.all(chamadas);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao mover página.");
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(paginas.find((p) => p.id === e.active.id) ?? null)}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setDragging(null); setDropInfo(null); }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">Notas</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Nova página"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem onClick={() => novaPagina(null, "pasta")}>
                <Folder className="h-3.5 w-3.5 mr-2" /> Nova pasta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => novaPagina(null, "nota")}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Nova nota
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <RootDropZone dropInfo={dropInfo} />

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {tree.length === 0 && (
            <p className="text-[11px] text-muted-foreground/50 px-2 py-4 text-center">
              Nenhuma página ainda.
            </p>
          )}
          {tree.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              activeId={activeId}
              onToggle={toggle}
              onSelect={onSelect}
              onNovaSubpagina={novaPagina}
              onExcluir={excluirPagina}
              onMoverIrmao={moverEntreIrmaos}
              siblingsOf={siblingsOf}
              dropInfo={dropInfo}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {dragging && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border shadow-lg text-[13px]">
            <PaginaIcone node={dragging} />
            {dragging.titulo}
          </div>
        )}
      </DragOverlay>

      <AlertDialog open={!!aExcluir} onOpenChange={(open) => !open && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {aExcluir?.tipo === "pasta" ? "Excluir pasta" : "Excluir nota"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {aExcluir?.tipo === "pasta"
                ? `Excluir a pasta "${aExcluir?.titulo}"? As notas e subpastas dentro dela também serão excluídas.`
                : `Excluir "${aExcluir?.titulo}"? Essa ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}

function RootDropZone({ dropInfo }: { dropInfo: DropInfo }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  const ativo = isOver || dropInfo?.overId === ROOT_DROP_ID;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 mb-1 rounded-lg border border-dashed text-[10px] text-center py-1 transition-colors",
        ativo ? "border-foreground/40 bg-muted/50 text-foreground" : "border-transparent text-transparent h-0 py-0 overflow-hidden"
      )}
    >
      Soltar aqui para tirar da pasta
    </div>
  );
}

function PaginaIcone({ node, isOpen }: { node: { tipo: TipoPagina; icone: string | null }; isOpen?: boolean }) {
  if (node.tipo === "pasta") {
    return isOpen
      ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      : <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
  return (
    <NotaIcone
      nome={node.icone}
      className="h-3.5 w-3.5 text-muted-foreground shrink-0"
      fallback={<FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
    />
  );
}

interface TreeRowProps {
  node: PaginaTreeNode;
  depth: number;
  expanded: Set<string>;
  activeId: string | undefined;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onNovaSubpagina: (parentId: string, tipo: TipoPagina) => void;
  onExcluir: (pagina: PaginaResumo) => void;
  onMoverIrmao: (pagina: PaginaResumo, direcao: -1 | 1) => void;
  siblingsOf: (pagina: PaginaResumo) => PaginaResumo[];
  dropInfo: DropInfo;
}

function TreeRow({
  node, depth, expanded, activeId, onToggle, onSelect, onNovaSubpagina, onExcluir, onMoverIrmao, siblingsOf, dropInfo,
}: TreeRowProps) {
  const isPasta = node.tipo === "pasta";
  const isOpen = expanded.has(node.id);
  const hasChildren = node.filhos.length > 0;
  const podeExpandir = isPasta && hasChildren;
  const isActive = activeId === node.id;

  const [menuNovaAberto, setMenuNovaAberto] = useState(false);
  const [menuMaisAberto, setMenuMaisAberto] = useState(false);
  const menuAberto = menuNovaAberto || menuMaisAberto;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: node.id });

  const irmaos = siblingsOf(node);
  const idx = irmaos.findIndex((p) => p.id === node.id);

  const dropAqui = dropInfo?.overId === node.id ? dropInfo.where : null;

  return (
    <div>
      <div
        ref={(el) => { setDragRef(el); setDropRef(el); }}
        style={{ paddingLeft: 8 + depth * 16, opacity: isDragging ? 0.4 : 1 }}
        className={cn(
          "group relative flex items-center gap-1 rounded-lg pr-1.5 transition-colors",
          isActive ? "bg-foreground text-background" : "hover:bg-muted/60",
          dropAqui === "dentro" && !isDragging && "ring-2 ring-foreground/30"
        )}
      >
        {dropAqui === "antes" && !isDragging && (
          <div className="absolute left-2 right-2 -top-px h-0.5 bg-foreground rounded-full pointer-events-none" />
        )}
        {dropAqui === "depois" && !isDragging && (
          <div className="absolute left-2 right-2 -bottom-px h-0.5 bg-foreground rounded-full pointer-events-none" />
        )}
        <button
          onClick={() => podeExpandir && onToggle(node.id)}
          className={cn("p-0.5 rounded shrink-0", !podeExpandir && "invisible")}
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90", isActive ? "text-background/70" : "text-muted-foreground")} />
        </button>

        <button
          {...attributes}
          {...listeners}
          onClick={() => onSelect(node.id)}
          className="flex-1 flex items-center gap-1.5 py-1.5 text-[12.5px] font-medium truncate text-left cursor-pointer"
        >
          <PaginaIcone node={node} isOpen={isOpen} />
          <span className="truncate">{node.titulo}</span>
          {node.visibilidade === "empresa"
            ? <Building2 className={cn("h-2.5 w-2.5 shrink-0 ml-auto", isActive ? "text-background/60" : "text-muted-foreground/50")} />
            : <Lock className={cn("h-2.5 w-2.5 shrink-0 ml-auto opacity-0 group-hover:opacity-40", isActive && "text-background/60")} />}
        </button>

        <div
          className={cn(
            "flex items-center gap-0.5 shrink-0 opacity-0 pointer-events-none transition-opacity",
            "group-hover:opacity-100 group-hover:pointer-events-auto",
            menuAberto && "opacity-100 pointer-events-auto"
          )}
        >
          {idx > 0 && (
            <button onClick={() => onMoverIrmao(node, -1)} title="Mover para cima" className="p-1 rounded hover:bg-black/10">
              <ChevronUp className="h-3 w-3" />
            </button>
          )}
          {idx < irmaos.length - 1 && (
            <button onClick={() => onMoverIrmao(node, 1)} title="Mover para baixo" className="p-1 rounded hover:bg-black/10">
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
          {isPasta && (
            <DropdownMenu open={menuNovaAberto} onOpenChange={setMenuNovaAberto}>
              <DropdownMenuTrigger asChild>
                <button title="Nova página aqui" className="p-1 rounded hover:bg-black/10">
                  <FilePlus className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
                <DropdownMenuItem onClick={() => onNovaSubpagina(node.id, "pasta")}>
                  <Folder className="h-3.5 w-3.5 mr-2" /> Nova subpasta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNovaSubpagina(node.id, "nota")}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> Nova nota aqui
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu open={menuMaisAberto} onOpenChange={setMenuMaisAberto}>
            <DropdownMenuTrigger asChild>
              <button title="Mais" className="p-1 rounded hover:bg-black/10">
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={4} className="min-w-[9rem]">
              <DropdownMenuItem
                onClick={() => onExcluir(node)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isPasta && isOpen && hasChildren && (
        <div>
          {node.filhos.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              activeId={activeId}
              onToggle={onToggle}
              onSelect={onSelect}
              onNovaSubpagina={onNovaSubpagina}
              onExcluir={onExcluir}
              onMoverIrmao={onMoverIrmao}
              siblingsOf={siblingsOf}
              dropInfo={dropInfo}
            />
          ))}
        </div>
      )}
    </div>
  );
}
