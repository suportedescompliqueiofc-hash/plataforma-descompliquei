import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#64748b",
];

interface CanvasPasta {
  id: string;
  nome: string;
  pasta_pai_id: string | null;
}

interface ModalNovoBoardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastas: CanvasPasta[];
  defaultPastaId?: string | null;
  onCreated?: (boardId: string) => void;
}

export function ModalNovoBoard({
  open,
  onOpenChange,
  pastas,
  defaultPastaId = null,
  onCreated,
}: ModalNovoBoardProps) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const [titulo, setTitulo] = useState("Novo Canvas");
  const [pastaId, setPastaId] = useState<string>(defaultPastaId || "__none__");
  const [cor, setCor] = useState(COLOR_OPTIONS[0]);
  const [descricao, setDescricao] = useState("");

  const createBoard = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.from("canvas_boards") as any)
        .insert({
          organization_id: orgId,
          pasta_id: pastaId === "__none__" ? null : pastaId,
          titulo: titulo.trim() || "Novo Canvas",
          descricao: descricao.trim() || null,
          cor,
          elements: [],
          app_state: {},
          files: {},
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["canvas-boards"] });
      toast.success("Canvas criado!");
      resetForm();
      onOpenChange(false);
      onCreated?.(data.id);
    },
    onError: () => toast.error("Erro ao criar canvas"),
  });

  const resetForm = () => {
    setTitulo("Novo Canvas");
    setPastaId(defaultPastaId || "__none__");
    setCor(COLOR_OPTIONS[0]);
    setDescricao("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    createBoard.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Canvas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Titulo *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nome do canvas"
              autoFocus
              required
            />
          </div>

          <div>
            <Label>Pasta</Label>
            <Select value={pastaId} onValueChange={setPastaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a pasta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem pasta</SelectItem>
                {pastas.map(p => (
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
            <Label>Descricao (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Breve descrição do canvas..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!titulo.trim() || createBoard.isPending}>
              {createBoard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Canvas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
