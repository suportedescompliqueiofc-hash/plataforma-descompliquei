import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Plus, ChevronDown, Loader2, GitMerge } from "lucide-react";
import { CadenceStep, useCadences, Cadence } from "@/hooks/useCadences";
import { CadenceStepCard } from "./CadenceStepCard";
import { cn } from "@/lib/utils";

interface CadenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cadence?: Cadence | null;
}

export function CadenceModal({ open, onOpenChange, cadence }: CadenceModalProps) {
  const { createCadence, updateCadence, isCreating, isUpdating } = useCadences();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [passos, setPassos] = useState<CadenceStep[]>([]);

  useEffect(() => {
    if (open) {
      if (cadence) {
        setNome(cadence.nome || "");
        setDescricao(cadence.descricao || "");
        setPassos(cadence.passos || []);
      } else {
        setNome("");
        setDescricao("");
        setPassos([]);
      }
    }
  }, [open, cadence]);

  const handleAddStep = () => {
    const nextPos = passos.length + 1;
    setPassos([...passos, {
      posicao_ordem: nextPos,
      tempo_espera: nextPos === 1 ? 1 : 24,
      unidade_tempo: nextPos === 1 ? 'minutos' : 'horas',
      tipo_mensagem: 'texto',
      conteudo: '',
      arquivo_path: null
    }]);
  };

  const updateStep = (index: number, updates: Partial<CadenceStep>) => {
    const newPassos = [...passos];
    newPassos[index] = { ...newPassos[index], ...updates };
    setPassos(newPassos);
  };

  const deleteStep = (index: number) => {
    const newPassos = passos
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, posicao_ordem: i + 1 }));
    setPassos(newPassos);
  };

  const handleSave = () => {
    if (!nome || passos.length === 0) return;
    if (cadence) {
      updateCadence({ id: cadence.id, nome, descricao, passos }, { onSuccess: () => onOpenChange(false) });
    } else {
      createCadence({ nome, descricao, passos }, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isPending = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-3xl h-[90vh] flex flex-col p-0 gap-0 rounded-2xl border-border/60 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-foreground font-display">
              {cadence ? "Detalhes da Cadência" : "Nova Cadência"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/70">
              {cadence ? "Visualize ou ajuste seu fluxo de mensagens" : "Construa seu fluxo de mensagens automáticas"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-6 py-6 space-y-6">
              {/* ── Identificação ── */}
              <div data-tutorial="cadence-modal-identity">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="p-1 rounded-md bg-muted"><GitMerge className="h-3 w-3 text-muted-foreground" /></span>
                  Identificação
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Nome <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Ex: Recuperação de Lead"
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      className="h-10 text-sm rounded-lg border-border/60"
                      data-tutorial="cadence-field-nome"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Descrição (interna)
                    </Label>
                    <Input
                      placeholder="Objetivo deste fluxo..."
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                      className="h-10 text-sm rounded-lg border-border/60"
                      data-tutorial="cadence-field-descricao"
                    />
                  </div>
                </div>
              </div>

              {/* ── Flow builder ── */}
              <div data-tutorial="cadence-steps">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <span className="p-1 rounded-md bg-muted"><Plus className="h-3 w-3 text-muted-foreground" /></span>
                  Passos do Fluxo
                </p>

                <div className="flex flex-col items-center">
                  {/* Start node */}
                  <div className="flex items-center gap-2 px-5 py-2 rounded-xl bg-foreground text-background text-[10px] font-bold uppercase tracking-widest">
                    Inicio do Fluxo
                  </div>

                  {/* Connector */}
                  <div className="flex flex-col items-center">
                    <div className="w-px h-5 bg-border" />
                    <ChevronDown className="h-3.5 w-3.5 text-border -mt-1" />
                  </div>

                  {/* Steps */}
                  <div className="w-full max-w-2xl space-y-0">
                    {passos.map((step, idx) => (
                      <div key={idx}>
                        <CadenceStepCard
                          step={step}
                          isLast={idx === passos.length - 1}
                          onUpdate={(upd) => updateStep(idx, upd)}
                          onDelete={() => deleteStep(idx)}
                        />
                        {/* Connector after each step */}
                        <div className="flex flex-col items-center">
                          <div className="w-px h-5 bg-border" />
                          <ChevronDown className="h-3.5 w-3.5 text-border -mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add step button */}
                  <Button
                    variant="outline"
                    className="w-full max-w-2xl h-12 border-dashed border-border/60 bg-muted/[0.03] hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all rounded-xl group gap-2"
                    onClick={handleAddStep}
                    data-tutorial="cadence-add-step"
                  >
                    <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">Adicionar Passo {passos.length + 1}</span>
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground px-4"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !nome || passos.length === 0}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            data-tutorial="cadence-submit"
          >
            {isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> {cadence ? "Salvar Alterações" : "Salvar Fluxo"}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
