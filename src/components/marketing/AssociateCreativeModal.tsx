import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Link } from "lucide-react";
import { Criativo } from "@/hooks/useMarketing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AssociateCreativeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCreative: Criativo | null;
  availableCreatives: Criativo[];
  onConfirm: (targetId: string) => void;
}

export function AssociateCreativeModal({ 
  open, 
  onOpenChange, 
  sourceCreative, 
  availableCreatives, 
  onConfirm 
}: AssociateCreativeModalProps) {
  const [targetId, setTargetId] = useState<string>("");

  const filteredCreatives = useMemo(() => {
    // Remove o próprio criativo da lista para evitar auto-seleção
    return availableCreatives.filter(c => c.id !== sourceCreative?.id);
  }, [availableCreatives, sourceCreative]);

  const handleConfirm = () => {
    if (targetId) {
      onConfirm(targetId);
      onOpenChange(false);
      setTargetId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Link className="h-5 w-5 text-primary" />
            Identificar Criativo
          </DialogTitle>
          <DialogDescription>
            Vincule a identidade visual de um criativo do CRM a esta campanha importada para facilitar a identificação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/30 p-3 rounded border">
            <Label className="text-xs text-muted-foreground">Campanha (Meta Ads)</Label>
            <p className="font-medium text-sm truncate">{sourceCreative?.nome || "Campanha Selecionada"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Gasto: R$ {sourceCreative?.platform_metrics?.spend.toFixed(2)} | Impressões: {sourceCreative?.platform_metrics?.impressions}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Criativo Visual (CRM)</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o criativo..." />
              </SelectTrigger>
              <SelectContent>
                {filteredCreatives.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome || c.titulo || "Sem Nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A imagem e o texto deste criativo serão exibidos na linha da campanha.
            </p>
          </div>

          <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <Info className="h-4 w-4 text-blue-800" />
            <AlertTitle>Informação</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              Esta ação copiará a <strong>identidade visual</strong> (imagem/vídeo e texto) do criativo selecionado para a linha da campanha. As métricas originais do Meta serão mantidas e nenhuma métrica será transferida para o criativo do CRM.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!targetId}>Confirmar Identificação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}