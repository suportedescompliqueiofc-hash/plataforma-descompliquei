import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { History, RotateCcw, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Versao {
  id: string;
  board_id: string;
  organization_id: string;
  usuario_id: string | null;
  elements: any[];
  app_state: any;
  criado_em: string;
}

interface HistoricoVersoesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  currentElements: any[];
  currentAppState: any;
  onRestore: (elements: any[], appState: any) => void;
}

export function HistoricoVersoes({
  open,
  onOpenChange,
  boardId,
  currentElements,
  currentAppState,
  onRestore,
}: HistoricoVersoesProps) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const userId = profile?.id;
  const queryClient = useQueryClient();
  const [confirmRestore, setConfirmRestore] = useState<Versao | null>(null);

  const { data: versoes = [], isLoading } = useQuery({
    queryKey: ["canvas-versoes", boardId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("canvas_versoes") as any)
        .select("*")
        .eq("board_id", boardId)
        .order("criado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Versao[];
    },
    enabled: open && !!boardId,
  });

  const restoreVersion = useMutation({
    mutationFn: async (versao: Versao) => {
      // 1. Save current state as a new version before restoring
      await (supabase.from("canvas_versoes") as any).insert({
        board_id: boardId,
        organization_id: orgId,
        usuario_id: userId,
        elements: currentElements,
        app_state: currentAppState,
      });

      // 2. Update the board with the restored version
      const { error } = await (supabase.from("canvas_boards") as any)
        .update({
          elements: versao.elements,
          app_state: versao.app_state,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", boardId);
      if (error) throw error;

      return versao;
    },
    onSuccess: (versao) => {
      queryClient.invalidateQueries({ queryKey: ["canvas-versoes", boardId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-board-full", boardId] });
      onRestore(versao.elements, versao.app_state);
      toast.success("Versao restaurada! O estado anterior foi salvo no historico.");
      setConfirmRestore(null);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao restaurar versao"),
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[380px] sm:w-[420px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historico de Versoes
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 mt-4 -mx-2 px-2">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : versoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma versao salva ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  As versoes sao salvas automaticamente a cada 30 segundos
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {versoes.map((versao, index) => {
                  const isLatest = index === 0;
                  const elementCount = versao.elements?.length || 0;
                  const date = new Date(versao.criado_em);

                  return (
                    <div
                      key={versao.id}
                      className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">
                              {format(date, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                            </span>
                            {isLatest && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                                Mais recente
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {elementCount} elemento{elementCount !== 1 ? "s" : ""}
                          </p>
                        </div>

                        {!isLatest && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 shrink-0"
                            onClick={() => setConfirmRestore(versao)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirm Restore Dialog */}
      <AlertDialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar esta versao?</AlertDialogTitle>
            <AlertDialogDescription>
              O estado atual do canvas sera salvo automaticamente no historico antes de restaurar.
              Voce podera voltar ao estado atual a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRestore && restoreVersion.mutate(confirmRestore)}
              disabled={restoreVersion.isPending}
            >
              {restoreVersion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Restaurar versao
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
