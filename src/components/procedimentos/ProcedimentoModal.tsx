import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Stethoscope } from "lucide-react";
import { useProcedimentos, Procedimento, ProcedimentoInput } from "@/hooks/useProcedimentos";
import { CurrencyInput } from "@/components/CurrencyInput";
import { toast } from "sonner";

const CATEGORIAS = [
  "Estética Facial",
  "Estética Corporal",
  "Capilar",
  "Odontologia",
  "Médico",
  "Outro",
];

interface ProcedimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedimento?: Procedimento | null;
}

const initialState: ProcedimentoInput = {
  nome: "",
  categoria: null,
  descricao: null,
  valor_base: null,
  duracao_minutos: null,
  ativo: true,
};

export function ProcedimentoModal({ open, onOpenChange, procedimento }: ProcedimentoModalProps) {
  const { createProcedimento, updateProcedimento, isMutating } = useProcedimentos();
  const [form, setForm] = useState<ProcedimentoInput>(initialState);

  const isEditMode = !!procedimento;

  useEffect(() => {
    if (open) {
      if (procedimento) {
        setForm({
          nome: procedimento.nome,
          categoria: procedimento.categoria,
          descricao: procedimento.descricao,
          valor_base: procedimento.valor_base,
          duracao_minutos: procedimento.duracao_minutos,
          ativo: procedimento.ativo,
        });
      } else {
        setForm(initialState);
      }
    }
  }, [open, procedimento]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("O nome do procedimento é obrigatório.");
      return;
    }
    const payload: ProcedimentoInput = {
      ...form,
      nome: form.nome.trim(),
      descricao: form.descricao?.trim() || null,
    };
    if (isEditMode && procedimento) {
      updateProcedimento({ id: procedimento.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createProcedimento(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg rounded-2xl border-border/60 p-0 gap-0 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-base font-semibold text-foreground font-display">
                {isEditMode ? "Editar Procedimento" : "Novo Procedimento"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <DialogDescription className="text-xs text-muted-foreground/70 ml-10">
            {isEditMode ? "Atualize os detalhes do procedimento" : "Cadastre um novo procedimento no seu catálogo"}
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-5 py-5 space-y-5">

            {/* Nome */}
            <div data-tutorial="procedimento-field-nome" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: Botox, Harmonização Facial, Preenchimento..."
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                className="h-10 rounded-lg text-sm border-border/60"
              />
            </div>

            {/* Categoria */}
            <div data-tutorial="procedimento-field-categoria" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Categoria
              </Label>
              <Select
                value={form.categoria || ""}
                onValueChange={v => setForm(p => ({ ...p, categoria: v || null }))}
              >
                <SelectTrigger className="h-10 rounded-lg text-sm border-border/60">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60">
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c} value={c} className="py-2.5">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor e Duracao */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div data-tutorial="procedimento-field-valor" className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor Base
                </Label>
                <CurrencyInput
                  id="valor-base"
                  value={form.valor_base ?? undefined}
                  onValueChange={v => setForm(p => ({ ...p, valor_base: v ?? null }))}
                  className="h-10 rounded-lg text-sm border-border/60"
                />
              </div>
              <div data-tutorial="procedimento-field-duracao" className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Duração (minutos)
                </Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex: 60"
                  value={form.duracao_minutos ?? ""}
                  onChange={e => setForm(p => ({ ...p, duracao_minutos: e.target.value ? Number(e.target.value) : null }))}
                  className="h-10 rounded-lg text-sm border-border/60"
                />
              </div>
            </div>

            {/* Descricao */}
            <div data-tutorial="procedimento-field-descricao" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Descrição
              </Label>
              <Textarea
                placeholder="Descreva o procedimento, indicações, cuidados pós..."
                value={form.descricao || ""}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value || null }))}
                className="rounded-lg text-sm border-border/60 min-h-[80px] resize-none"
              />
            </div>

            {/* Ativo */}
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-foreground">Procedimento ativo</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  Procedimentos inativos não aparecem nas sugestões de vendas
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground px-4"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isMutating}
              data-tutorial="procedimento-submit"
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            >
              {isMutating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
              ) : isEditMode ? "Salvar Alterações" : "Criar Procedimento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
