import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Check, Hash, RefreshCw, Tag, Inbox, Loader2 } from "lucide-react";
import { useTags, TAG_COLORS, Tag as TagType, getTagColorStyles } from "@/hooks/useTags";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function TagSettings() {
  const queryClient = useQueryClient();
  const { availableTags, isLoadingTags, createTag, updateTag, deleteTag, refetchTags } = useTags();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [isDeleting, setIsDeleting] = useState<TagType | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].hex);
  const [customHex, setCustomHex] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const syncLabelsFromWhatsApp = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const resLabels = await supabase.functions.invoke('manage-whatsapp', {
        body: { action: 'sync_labels' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resLabels.error) throw new Error(resLabels.error.message);

      const resLeads = await supabase.functions.invoke('manage-whatsapp', {
        body: { action: 'sync_leads_tags' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resLeads.error) console.error("Erro secundário ao sincronizar leads: ", resLeads.error);

      const { synced = 0 } = resLabels.data || {};
      const { syncedLeadsCount = 0 } = resLeads.data || {};

      toast({
        title: 'Etiquetas sincronizadas!',
        description: `${synced} etiqueta(s) importada(s). ${syncedLeadsCount} lead(s) atualizado(s).`,
      });
      refetchTags?.();
      queryClient.invalidateQueries({ queryKey: ['lead_tags'] });
    } catch (err: any) {
      toast({
        title: 'Erro ao sincronizar',
        description: err.message || 'Verifique se o WhatsApp está conectado.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const openModal = (tag: TagType | null = null) => {
    if (tag) {
      setEditingTag(tag);
      setTagName(tag.name);
      const isPreset = TAG_COLORS.some(c => c.name === tag.color);
      if (isPreset) {
        const preset = TAG_COLORS.find(c => c.name === tag.color);
        setTagColor(preset?.hex || TAG_COLORS[0].hex);
        setCustomHex("");
      } else {
        setTagColor(tag.color);
        setCustomHex(tag.color);
      }
    } else {
      setEditingTag(null);
      setTagName("");
      setTagColor(TAG_COLORS[0].hex);
      setCustomHex("");
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!tagName.trim()) return;
    let finalColor = tagColor;
    if (customHex && /^#[0-9A-F]{6}$/i.test(customHex)) {
      finalColor = customHex;
    } else {
      const preset = TAG_COLORS.find(c => c.hex.toLowerCase() === tagColor.toLowerCase());
      if (preset) {
        finalColor = preset.name;
      } else {
        finalColor = tagColor;
      }
    }

    if (editingTag) {
      updateTag.mutate({ id: editingTag.id, name: tagName, color: finalColor });
    } else {
      createTag.mutate({ name: tagName, color: finalColor });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (isDeleting) {
      deleteTag.mutate(isDeleting.id);
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
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Etiquetas</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Organize seus leads com etiquetas personalizadas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={syncLabelsFromWhatsApp}
              disabled={isSyncing}
              data-tutorial="tags-sync-whatsapp"
              className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar WhatsApp'}
            </Button>
            <Button
              size="sm"
              onClick={() => openModal()}
              data-tutorial="tags-new"
              className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Etiqueta
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {isLoadingTags ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : availableTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma etiqueta criada</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Crie etiquetas para categorizar seus leads</p>
          </div>
        ) : (
          <div className="space-y-1">
            {availableTags.map((tag) => {
              const styles = getTagColorStyles(tag.color);
              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn("text-[11px] font-normal transition-all", styles.className)} style={styles.style}>
                      {tag.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openModal(tag)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setIsDeleting(tag)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Criar/Editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold font-display">{editingTag ? "Editar Etiqueta" : "Nova Etiqueta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Ex: Prioridade Alta"
                className="h-10 text-sm rounded-lg border-border/60"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => { setTagColor(color.hex); setCustomHex(""); }}
                    className={cn(
                      "w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 hover:scale-110",
                      color.selector,
                      (tagColor === color.hex && !customHex) ? "ring-2 ring-offset-2 ring-foreground" : ""
                    )}
                    title={color.label}
                  >
                    {(tagColor === color.hex && !customHex) && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Hex personalizado (ex: #9568CF)"
                    value={customHex}
                    onChange={(e) => {
                      setCustomHex(e.target.value);
                      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) setTagColor(e.target.value);
                    }}
                    className="pl-8 h-10 text-sm rounded-lg border-border/60 font-mono"
                    maxLength={7}
                  />
                </div>
                <div
                  className="w-10 h-10 rounded-lg border border-border/60 shrink-0 transition-colors"
                  style={{ backgroundColor: customHex && /^#[0-9A-F]{6}$/i.test(customHex) ? customHex : tagColor }}
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

      {/* AlertDialog Exclusão */}
      <AlertDialog open={!!isDeleting} onOpenChange={() => setIsDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etiqueta "{isDeleting?.name}"? Esta ação não pode ser desfeita.
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
