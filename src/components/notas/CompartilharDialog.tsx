import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCompartilhamentos, useCompartilharPagina, useRemoverCompartilhamento, type Permissao,
} from "@/hooks/usePaginas";

interface CompartilharDialogProps {
  paginaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompartilharDialog({ paginaId, open, onOpenChange }: CompartilharDialogProps) {
  const { profile } = useProfile();
  const [busca, setBusca] = useState("");
  const { data: compartilhamentos = [] } = useCompartilhamentos(paginaId);
  const compartilhar = useCompartilharPagina();
  const remover = useRemoverCompartilhamento();

  const { data: membros = [], isLoading } = useQuery({
    queryKey: ["org-membros", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("id, nome_completo, avatar_url")
        .eq("organization_id", profile!.organization_id)
        .neq("id", profile!.id);
      if (error) throw error;
      return (data ?? []) as { id: string; nome_completo: string | null; avatar_url: string | null }[];
    },
    enabled: open && !!profile?.organization_id,
  });

  const filtrados = membros.filter((m) =>
    !busca.trim() || (m.nome_completo ?? "").toLowerCase().includes(busca.trim().toLowerCase())
  );

  async function adicionar(userId: string) {
    try {
      await compartilhar.mutateAsync({ paginaId, userId, permissao: "visualizar" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao compartilhar.");
    }
  }

  async function mudarPermissao(compartilhamentoId: string, permissao: Permissao, userId: string) {
    try {
      await compartilhar.mutateAsync({ paginaId, userId, permissao });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar permissão.");
    }
  }

  async function remove(id: string) {
    try {
      await remover.mutateAsync({ id, paginaId });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Compartilhar página</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoa da equipe..."
            className="pl-9 h-9 text-[13px] rounded-lg border-border/60"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
          {isLoading && (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          )}
          {!isLoading && filtrados.length === 0 && (
            <p className="text-[12px] text-muted-foreground/60 text-center py-4">Ninguém encontrado.</p>
          )}
          {filtrados.map((m) => {
            const existente = compartilhamentos.find((c) => c.user_id === m.id);
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40">
                <span className="text-[12.5px] font-medium text-foreground/90 truncate">{m.nome_completo || "Sem nome"}</span>
                {existente ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={existente.permissao}
                      onValueChange={(v) => mudarPermissao(existente.id, v as Permissao, m.id)}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-[11px] rounded-lg border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visualizar">Visualizar</SelectItem>
                        <SelectItem value="editar">Editar</SelectItem>
                      </SelectContent>
                    </Select>
                    <button onClick={() => remove(existente.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg px-2.5 shrink-0" onClick={() => adicionar(m.id)}>
                    Compartilhar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
