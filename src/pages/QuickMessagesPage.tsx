import { useState, useRef, useEffect } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, defaultDropAnimationSideEffects, DragStartEvent, DragOverEvent, DragEndEvent, DropAnimation
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQuickMessages, QuickMessage } from "@/hooks/useQuickMessages";
import { useQuickMessageFolders, QuickMessageFolder } from "@/hooks/useQuickMessageFolders";
import {
  Plus, Trash2, MessageSquare, Mic, Image as ImageIcon, Video, FileText, Upload,
  Zap, FolderPlus, Folder, Search, MessageCircle,
} from "lucide-react";
import { SortableFolder } from "@/components/quick-messages/SortableFolder";
import { SortableMessageCard } from "@/components/quick-messages/SortableMessageCard";
import { createPortal } from "react-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuickMessagesPage() {
  const { quickMessages, isLoading: isLoadingMsgs, createQuickMessage, updateQuickMessage, deleteQuickMessage, isCreating: isCreatingMsg, updateMessagesOrder } = useQuickMessages();
  const { folders, isLoading: isLoadingFolders, createFolder, deleteFolder, updateFoldersOrder } = useQuickMessageFolders();

  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [localFolders, setLocalFolders] = useState<QuickMessageFolder[]>([]);
  const [localMessages, setLocalMessages] = useState<QuickMessage[]>([]);
  const [msgToDelete, setMsgToDelete] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<QuickMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { setLocalFolders(folders); }, [folders]);
  useEffect(() => { setLocalMessages(quickMessages); }, [quickMessages]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const [msgFormData, setMsgFormData] = useState({ titulo: "", conteudo: "", tipo: "texto", folder_id: "none" });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [folderFormData, setFolderFormData] = useState({ name: "", color: "#3b82f6" });

  // Filter messages based on search
  const filteredMessages = searchQuery
    ? localMessages.filter(m => m.titulo.toLowerCase().includes(searchQuery.toLowerCase()) || (m.conteudo || "").toLowerCase().includes(searchQuery.toLowerCase()))
    : localMessages;

  const handleOpenCreateMsg = () => {
    setEditingMessage(null);
    setMsgFormData({ titulo: "", conteudo: "", tipo: "texto", folder_id: "none" });
    setFile(null);
    setIsMsgModalOpen(true);
  };

  const handleEditMessage = (message: QuickMessage) => {
    setEditingMessage(message);
    setMsgFormData({ titulo: message.titulo, conteudo: message.conteudo || "", tipo: message.tipo, folder_id: message.folder_id || "none" });
    setFile(null);
    setIsMsgModalOpen(true);
  };

  const handleMsgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...msgFormData, file };
    if (editingMessage) {
      updateQuickMessage({ id: editingMessage.id, ...payload }, { onSuccess: () => setIsMsgModalOpen(false) });
    } else {
      createQuickMessage(payload, { onSuccess: () => setIsMsgModalOpen(false) });
    }
  };

  const handleFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createFolder.mutate(folderFormData, { onSuccess: () => setIsFolderModalOpen(false) });
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
    setActiveItem(e.active.data.current?.type === "Folder" ? e.active.data.current.folder : e.active.data.current?.message);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || active.data.current?.type !== "Message") return;
    const activeId = active.id;
    const overId = over.id;
    const activeMsg = localMessages.find(m => m.id === activeId);
    const overMsg = localMessages.find(m => m.id === overId);
    const overFolder = localFolders.find(f => f.id === overId);
    if (!activeMsg) return;

    if (overMsg && activeMsg.folder_id !== overMsg.folder_id) {
      setLocalMessages(prev => {
        const activeIdx = prev.findIndex(i => i.id === activeId);
        const newItems = [...prev];
        newItems[activeIdx] = { ...newItems[activeIdx], folder_id: overMsg.folder_id };
        return arrayMove(newItems, activeIdx, prev.findIndex(i => i.id === overId));
      });
    } else if (overFolder && activeMsg.folder_id !== overFolder.id) {
        setLocalMessages(prev => {
            const activeIdx = prev.findIndex(i => i.id === activeId);
            const newItems = [...prev];
            newItems[activeIdx] = { ...newItems[activeIdx], folder_id: overFolder.id };
            return newItems;
        });
    } else if (overId === "uncategorized" && activeMsg.folder_id !== null) {
        setLocalMessages(prev => {
            const activeIdx = prev.findIndex(i => i.id === activeId);
            const newItems = [...prev];
            newItems[activeIdx] = { ...newItems[activeIdx], folder_id: null };
            return newItems;
        });
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over) {
        if (active.data.current?.type === "Folder" && active.id !== over.id) {
            const oldIdx = localFolders.findIndex(f => f.id === active.id);
            const newIdx = localFolders.findIndex(f => f.id === over.id);
            const newOrder = arrayMove(localFolders, oldIdx, newIdx);
            setLocalFolders(newOrder);
            updateFoldersOrder.mutate(newOrder.map((f, i) => ({ id: f.id, position: i + 1 })));
        } else if (active.data.current?.type === "Message") {
            const activeIdx = localMessages.findIndex(m => m.id === active.id);
            const overIdx = localMessages.findIndex(m => m.id === over.id);
            let newMsgs = [...localMessages];
            if (active.id !== over.id && overIdx !== -1) newMsgs = arrayMove(newMsgs, activeIdx, overIdx);
            setLocalMessages(newMsgs);
            updateMessagesOrder.mutate(newMsgs.map((m, i) => ({ id: m.id, position: i + 1, folder_id: m.folder_id || null })));
        }
    }
    setActiveId(null);
    setActiveItem(null);
  };

  const getMessagesByFolder = (fid: string | null) => filteredMessages.filter(m => (m.folder_id || null) === fid);

  const totalMsgs = localMessages.length;
  const totalFolders = localFolders.length;
  const isLoading = isLoadingMsgs || isLoadingFolders;

  const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#6b7280"];

  return (
    <div className="space-y-6 pb-10">
      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Mensagens Rápidas</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Crie e organize suas mensagens por pastas para envio rápido</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => { setFolderFormData({ name: "", color: "#3b82f6" }); setIsFolderModalOpen(true); }}
              className="h-9 gap-1.5 rounded-lg text-xs font-medium px-3"
              data-tutorial="quick-messages-folder-create"
            >
              <FolderPlus className="h-3.5 w-3.5" /> Nova Pasta
            </Button>
            <Button
              onClick={handleOpenCreateMsg}
              className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4"
              data-tutorial="quick-messages-create"
            >
              <Plus className="h-3.5 w-3.5" /> Nova Mensagem
            </Button>
          </div>
        </div>

        {/* Stats + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              <span className="tabular-nums font-medium">{totalMsgs} mensagens</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Folder className="h-3 w-3" />
              <span className="tabular-nums font-medium">{totalFolders} pastas</span>
            </div>
          </div>
          <div data-tutorial="quick-messages-search" className="flex-1 max-w-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Buscar mensagem..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-xs rounded-lg border-border/60 bg-muted/30 focus:bg-background"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1, 2, 3].map(j => <Skeleton key={j} className="h-36 rounded-2xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : totalMsgs === 0 && totalFolders === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="bg-muted/30 p-5 rounded-2xl mb-4">
            <Zap className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma mensagem criada</h3>
          <p className="text-sm text-muted-foreground/60 mb-5 text-center max-w-sm">
            Crie mensagens rápidas para agilizar o atendimento no WhatsApp
          </p>
          <Button onClick={handleOpenCreateMsg} className="gap-1.5 h-9 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-3.5 w-3.5" /> Criar Mensagem
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div data-tutorial="quick-messages-folders">
          <SortableContext items={localFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {localFolders.map(f => (
              <SortableFolder key={f.id} folder={f} messages={getMessagesByFolder(f.id)} onDeleteFolder={setFolderToDelete} onEditMessage={handleEditMessage} onDeleteMessage={setMsgToDelete} />
            ))}
          </SortableContext>
          </div>

          {getMessagesByFolder(null).length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sem Pasta</h3>
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">{getMessagesByFolder(null).length}</span>
              </div>
              <SortableContext id="uncategorized" items={getMessagesByFolder(null).map(m => m.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4 rounded-2xl border border-dashed border-border/60 bg-muted/[0.03]">
                  {getMessagesByFolder(null).map(m => (
                    <SortableMessageCard key={m.id} message={m} onEdit={handleEditMessage} onDelete={setMsgToDelete} />
                  ))}
                </div>
              </SortableContext>
            </div>
          )}

          {createPortal(
            <DragOverlay dropAnimation={defaultDropAnimationSideEffects as any}>
              {activeId && activeItem ? (
                activeItem.name ? (
                  <div className="bg-background border border-border/60 p-4 rounded-2xl shadow-xl">
                    <h3 className="text-sm font-semibold">{activeItem.name}</h3>
                  </div>
                ) : (
                  <div className="w-[280px]">
                    <SortableMessageCard message={activeItem} onEdit={() => {}} onDelete={() => {}} />
                  </div>
                )
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      )}

      {/* ═══ MSG MODAL ═══ */}
      <Dialog open={isMsgModalOpen} onOpenChange={setIsMsgModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl border-border/60 p-0 gap-0 overflow-hidden max-h-[92vh] overflow-y-auto">
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editingMessage ? "Editar Mensagem" : "Nova Mensagem Rápida"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/70">
                Configure o título, tipo e conteúdo da mensagem
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleMsgSubmit} className="flex flex-col">
            <div className="px-5 py-5 space-y-5">
              {/* Título */}
              <div data-tutorial="qm-field-titulo" className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Título do Botão <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={msgFormData.titulo}
                  onChange={e => setMsgFormData({...msgFormData, titulo: e.target.value})}
                  required
                  placeholder="Ex: Boas-vindas"
                  className="h-10 text-sm rounded-lg border-border/60"
                />
              </div>

              {/* Tipo + Pasta */}
              <div data-tutorial="qm-field-tipo" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Conteúdo</Label>
                  <Select value={msgFormData.tipo} onValueChange={v => setMsgFormData({...msgFormData, tipo: v as any})}>
                    <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60">
                      <SelectItem value="texto"><div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> Texto</div></SelectItem>
                      <SelectItem value="imagem"><div className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Imagem</div></SelectItem>
                      <SelectItem value="audio"><div className="flex items-center gap-2"><Mic className="h-3.5 w-3.5 text-muted-foreground" /> Audio</div></SelectItem>
                      <SelectItem value="video"><div className="flex items-center gap-2"><Video className="h-3.5 w-3.5 text-muted-foreground" /> Video</div></SelectItem>
                      <SelectItem value="pdf"><div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /> PDF</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pasta</Label>
                  <Select value={msgFormData.folder_id} onValueChange={v => setMsgFormData({...msgFormData, folder_id: v})}>
                    <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60">
                      <SelectItem value="none">Sem Pasta</SelectItem>
                      {folders.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conteudo */}
              {msgFormData.tipo === 'texto' ? (
                <div data-tutorial="qm-field-conteudo" className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Mensagem <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={msgFormData.conteudo}
                    onChange={e => setMsgFormData({...msgFormData, conteudo: e.target.value})}
                    className="h-32 text-sm rounded-lg border-border/60 resize-none"
                    required
                    placeholder="Digite o conteúdo da mensagem..."
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arquivo</Label>
                    <div
                      className="border-2 border-dashed border-border/60 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 hover:border-border transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="p-3 rounded-xl bg-muted/50 mb-3">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        {file ? file.name : "Clique para anexar arquivo"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 mt-1">ou arraste e solte aqui</span>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Legenda (Opcional)</Label>
                    <Input
                      value={msgFormData.conteudo}
                      onChange={e => setMsgFormData({...msgFormData, conteudo: e.target.value})}
                      placeholder="Legenda da mídia..."
                      className="h-10 text-sm rounded-lg border-border/60"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsMsgModalOpen(false)}
                className="h-9 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground px-4"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isCreatingMsg}
                className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5"
                data-tutorial="qm-submit"
              >
                {isCreatingMsg ? 'Salvando...' : editingMessage ? 'Salvar Alteracoes' : 'Criar Mensagem'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ FOLDER MODAL ═══ */}
      <Dialog open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
        <DialogContent className="w-[95vw] max-w-sm rounded-2xl border-border/60 p-0 gap-0 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold text-foreground">Nova Pasta</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/70">
                Organize suas mensagens em pastas tematicas
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleFolderSubmit} className="flex flex-col">
            <div className="px-5 py-5 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Nome da Pasta <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={folderFormData.name}
                  onChange={e => setFolderFormData({...folderFormData, name: e.target.value})}
                  required
                  placeholder="Ex: Boas-vindas"
                  className="h-10 text-sm rounded-lg border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cor</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFolderFormData({...folderFormData, color})}
                      className={cn(
                        "h-8 w-8 rounded-lg transition-all duration-150 border-2",
                        folderFormData.color === color ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative">
                    <input
                      type="color"
                      value={folderFormData.color}
                      onChange={e => setFolderFormData({...folderFormData, color: e.target.value})}
                      className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                    />
                    <div className="h-8 w-8 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center hover:border-border transition-colors">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFolderModalOpen(false)}
                className="h-9 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground px-4"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createFolder.isPending}
                className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5"
              >
                {createFolder.isPending ? 'Criando...' : 'Criar Pasta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE ALERTS ═══ */}
      <AlertDialog open={!!msgToDelete} onOpenChange={() => setMsgToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              A mensagem será removida permanentemente da sua biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 rounded-lg text-xs font-medium">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (msgToDelete) { deleteQuickMessage(msgToDelete); setMsgToDelete(null); } }}
              className="h-9 rounded-lg text-xs font-semibold bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!folderToDelete} onOpenChange={() => setFolderToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              A pasta será removida. As mensagens dentro dela ficarão sem pasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 rounded-lg text-xs font-medium">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (folderToDelete) { deleteFolder.mutate(folderToDelete); setFolderToDelete(null); } }}
              className="h-9 rounded-lg text-xs font-semibold bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
