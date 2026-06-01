import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Radio, Loader2, Inbox } from "lucide-react";
import { useSourcesManager, Source } from "@/hooks/useSourcesManager";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function SourceSettings() {
  const { sources, isLoading, createSource, updateSource, deleteSource } = useSourcesManager();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [isDeleting, setIsDeleting] = useState<Source | null>(null);
  const [sourceName, setSourceName] = useState("");

  const openModal = (source: Source | null = null) => {
    if (source) {
      setEditingSource(source);
      setSourceName(source.nome);
    } else {
      setEditingSource(null);
      setSourceName("");
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!sourceName.trim()) return;
    if (editingSource) {
      updateSource.mutate({ id: editingSource.id, nome: sourceName });
    } else {
      createSource.mutate({ nome: sourceName });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (isDeleting) {
      deleteSource.mutate(isDeleting.id);
      setIsDeleting(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Radio className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Fontes de Leads</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Gerencie as origens dos seus leads</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Fonte
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma fonte criada</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Adicione fontes como Facebook Ads, Indicação, etc.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-foreground/20" />
                  <span className="text-sm font-medium text-foreground">{source.nome}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openModal(source)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setIsDeleting(source)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{editingSource ? "Editar Fonte" : "Nova Fonte"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da Fonte</Label>
              <Input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Ex: Facebook Ads, Indicação, Google"
                className="h-10 text-sm rounded-lg border-border/60"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="rounded-lg text-xs">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="rounded-lg text-xs bg-foreground text-background hover:bg-foreground/90"
            >
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
            <AlertDialogDescription>
              Tem certeza que deseja excluir a fonte "{isDeleting?.nome}"? Leads existentes com esta fonte não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-lg text-xs">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
