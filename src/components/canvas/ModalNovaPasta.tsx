import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Folder, Star, Briefcase, Lightbulb, Target, Zap, Heart, Bookmark, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#64748b",
];

const ICON_OPTIONS = [
  { value: "folder", label: "Pasta", Icon: Folder },
  { value: "star", label: "Estrela", Icon: Star },
  { value: "briefcase", label: "Trabalho", Icon: Briefcase },
  { value: "lightbulb", label: "Ideia", Icon: Lightbulb },
  { value: "target", label: "Meta", Icon: Target },
  { value: "zap", label: "Rapido", Icon: Zap },
  { value: "heart", label: "Favorito", Icon: Heart },
  { value: "bookmark", label: "Salvo", Icon: Bookmark },
];

interface CanvasPasta {
  id: string;
  nome: string;
  pasta_pai_id: string | null;
}

interface ModalNovaPastaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastas: CanvasPasta[];
  defaultParentId?: string | null;
  editingPasta?: CanvasPasta & { cor: string; icone: string; descricao: string | null } | null;
}

export function ModalNovaPasta({
  open,
  onOpenChange,
  pastas,
  defaultParentId = null,
  editingPasta = null,
}: ModalNovaPastaProps) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const isEdit = !!editingPasta;

  const [nome, setNome] = useState("");
  const [parentId, setParentId] = useState<string>("__none__");
  const [cor, setCor] = useState(COLOR_OPTIONS[0]);
  const [icone, setIcone] = useState("folder");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (open) {
      if (editingPasta) {
        setNome(editingPasta.nome);
        setParentId(editingPasta.pasta_pai_id || "__none__");
        setCor(editingPasta.cor || COLOR_OPTIONS[0]);
        setIcone(editingPasta.icone || "folder");
        setDescricao(editingPasta.descricao || "");
      } else {
        setNome("");
        setParentId(defaultParentId || "__none__");
        setCor(COLOR_OPTIONS[0]);
        setIcone("folder");
        setDescricao("");
      }
    }
  }, [open, editingPasta, defaultParentId]);

  const savePasta = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const { error } = await (supabase.from("canvas_pastas") as any)
          .update({
            nome: nome.trim(),
            pasta_pai_id: parentId === "__none__" ? null : parentId,
            cor,
            icone,
            descricao: descricao.trim() || null,
          })
          .eq("id", editingPasta!.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("canvas_pastas") as any)
          .insert({
            organization_id: orgId,
            nome: nome.trim(),
            pasta_pai_id: parentId === "__none__" ? null : parentId,
            cor,
            icone,
            descricao: descricao.trim() || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-pastas"] });
      toast.success(isEdit ? "Pasta atualizada!" : "Pasta criada!");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar pasta"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    savePasta.mutate();
  };

  // Filter out self and descendants to prevent circular references
  const availableParents = pastas.filter(p => {
    if (!editingPasta) return true;
    if (p.id === editingPasta.id) return false;
    // Check if p is a descendant of editingPasta
    let current: CanvasPasta | undefined = p;
    while (current) {
      if (current.pasta_pai_id === editingPasta.id) return false;
      current = pastas.find(pp => pp.id === current!.pasta_pai_id);
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Pasta" : "Nova Pasta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da pasta"
              autoFocus
              required
            />
          </div>

          <div>
            <Label>Pasta pai (opcional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (raiz)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma (raiz)</SelectItem>
                {availableParents.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-1.5">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all",
                    cor === c
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setCor(c)}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Icone</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {ICON_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  className={cn(
                    "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                    icone === value
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                  onClick={() => setIcone(value)}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Descricao (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Breve descrição..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!nome.trim() || savePasta.isPending}>
              {savePasta.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar" : "Criar Pasta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
