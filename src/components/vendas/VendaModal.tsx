import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useVendas, Venda } from "@/hooks/useVendas";
import { useProcedimentos } from "@/hooks/useProcedimentos";
import {
  CalendarIcon, Check, ChevronsUpDown, Loader2, DollarSign, User,
  CreditCard, Package, Receipt, FileText, X, Stethoscope,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/CurrencyInput";

interface VendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  venda?: Venda | null;
  onSaved?: () => void;
}

interface VendaFormData {
  id?: string;
  lead_id: string;
  valor_orcado: number | undefined;
  data_orcamento: Date | undefined;
  valor_fechado: number | undefined;
  data_fechamento: Date;
  forma_pagamento: string;
  produto_servico: string;
}

const initialFormState: VendaFormData = {
  lead_id: "",
  valor_orcado: undefined,
  data_orcamento: undefined,
  valor_fechado: undefined,
  data_fechamento: new Date(),
  forma_pagamento: "",
  produto_servico: "",
};

const FORMAS_PAGAMENTO = [
  { value: "Cartão de Crédito", label: "Cartão de Crédito", icon: CreditCard },
  { value: "PIX", label: "PIX", icon: DollarSign },
  { value: "Boleto", label: "Boleto", icon: FileText },
  { value: "Dinheiro", label: "Dinheiro", icon: DollarSign },
  { value: "Outro", label: "Outro", icon: Receipt },
];

export function VendaModal({ open, onOpenChange, lead: preselectedLead, venda: editingVenda, onSaved }: VendaModalProps) {
  const { leads, isLoading: isLoadingLeads } = useLeads();
  const { createVenda, updateVenda, isLoading: isMutating } = useVendas();
  const { procedimentos } = useProcedimentos();
  const [formData, setFormData] = useState<VendaFormData>(initialFormState);
  const [isLeadSelectorOpen, setIsLeadSelectorOpen] = useState(false);
  const [isProcSelectorOpen, setIsProcSelectorOpen] = useState(false);

  const procedimentosAtivos = useMemo(
    () => procedimentos.filter(p => p.ativo),
    [procedimentos]
  );

  const isEditMode = !!editingVenda;

  useEffect(() => {
    if (open) {
      if (editingVenda) {
        setFormData({
          id: editingVenda.id,
          lead_id: editingVenda.lead_id,
          valor_orcado: editingVenda.valor_orcado ?? undefined,
          data_orcamento: editingVenda.data_orcamento ? parseISO(editingVenda.data_orcamento) : undefined,
          valor_fechado: editingVenda.valor_fechado,
          data_fechamento: parseISO(editingVenda.data_fechamento),
          forma_pagamento: editingVenda.forma_pagamento || "",
          produto_servico: editingVenda.produto_servico || "",
        });
      } else if (preselectedLead) {
        setFormData({
          ...initialFormState,
          lead_id: preselectedLead.id,
          data_fechamento: new Date(),
        });
      } else {
        setFormData(initialFormState);
      }
    }
  }, [open, preselectedLead, editingVenda]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lead_id || formData.valor_fechado === undefined || formData.valor_fechado === null || !formData.data_fechamento || !formData.produto_servico) {
      toast.error("Preencha os campos obrigatórios: Cliente, Serviço/Produto, Valor Fechado e Data.");
      return;
    }

    const payload = {
      lead_id: formData.lead_id,
      valor_orcado: formData.valor_orcado ?? null,
      valor_fechado: formData.valor_fechado,
      data_orcamento: formData.data_orcamento ? format(formData.data_orcamento, 'yyyy-MM-dd') : null,
      data_fechamento: format(formData.data_fechamento, 'yyyy-MM-dd'),
      forma_pagamento: formData.forma_pagamento || null,
      produto_servico: formData.produto_servico,
    };

    if (isEditMode && formData.id) {
      updateVenda({ id: formData.id, ...payload }, {
        onSuccess: () => { onOpenChange(false); onSaved?.(); },
      });
    } else {
      createVenda(payload as any, {
        onSuccess: () => { onOpenChange(false); onSaved?.(); },
      });
    }
  };

  const selectedLead = useMemo(() => {
    return preselectedLead || leads.find(lead => lead.id === formData.lead_id) || null;
  }, [preselectedLead, formData.lead_id, leads]);

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "").replace(/^55/, "");
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    if (cleaned.length === 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-tutorial="venda-modal" className="w-[95vw] max-w-lg rounded-2xl border-border/60 p-0 gap-0 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/40">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {isEditMode ? "Editar Venda" : "Registrar Venda"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/70">
              Preencha os detalhes da venda realizada
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-5 py-5 space-y-5">

            {/* ── Cliente ── */}
            <div data-tutorial="venda-field-cliente" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cliente <span className="text-destructive">*</span>
              </Label>
              <Popover open={isLeadSelectorOpen && !preselectedLead && !isEditMode} onOpenChange={setIsLeadSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between h-10 rounded-lg text-sm font-normal border-border/60",
                      !selectedLead && "text-muted-foreground/50"
                    )}
                    disabled={!!preselectedLead || isEditMode}
                  >
                    {selectedLead ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-muted-foreground">
                            {(selectedLead.nome || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium text-foreground truncate">{selectedLead.nome || "Sem nome"}</p>
                        </div>
                      </div>
                    ) : (
                      <span>Selecione um cliente...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                  </Button>
                </PopoverTrigger>
                {!preselectedLead && !isEditMode && (
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-border/60"
                    align="start"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." className="text-sm h-10" />
                      <CommandList className="max-h-[220px]">
                        <CommandEmpty className="py-4 text-xs text-center text-muted-foreground/50">
                          Nenhum cliente encontrado
                        </CommandEmpty>
                        <CommandGroup>
                          {isLoadingLeads ? (
                            <CommandItem disabled>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Carregando...
                            </CommandItem>
                          ) : leads.map(lead => (
                            <CommandItem
                              key={lead.id}
                              value={`${lead.nome || ""} ${lead.telefone || ""}`}
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, lead_id: lead.id }));
                                setIsLeadSelectorOpen(false);
                              }}
                              className="py-2.5 px-3"
                            >
                              <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", formData.lead_id === lead.id ? "opacity-100 text-primary" : "opacity-0")} />
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                  <span className="text-[8px] font-bold text-muted-foreground">
                                    {(lead.nome || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium truncate">{lead.nome || "Sem nome"}</p>
                                  {lead.telefone && (
                                    <p className="text-[10px] text-muted-foreground/50 tabular-nums">{formatPhone(lead.telefone)}</p>
                                  )}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                )}
              </Popover>
            </div>

            {/* ── Procedimento / Servico ── */}
            <div data-tutorial="venda-field-procedimento" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Procedimento / Servico <span className="text-destructive">*</span>
              </Label>
              {procedimentosAtivos.length > 0 ? (
                <Popover open={isProcSelectorOpen} onOpenChange={setIsProcSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between h-10 rounded-lg text-sm font-normal border-border/60",
                        !formData.produto_servico && "text-muted-foreground/50"
                      )}
                    >
                      {formData.produto_servico ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate text-foreground">{formData.produto_servico}</span>
                        </div>
                      ) : (
                        <span>Selecione ou digite um procedimento...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-border/60"
                    align="start"
                    onWheel={e => e.stopPropagation()}
                  >
                    <Command>
                      <CommandInput
                        placeholder="Buscar ou digitar procedimento..."
                        className="text-sm h-10"
                        value={formData.produto_servico}
                        onValueChange={v => setFormData(prev => ({ ...prev, produto_servico: v }))}
                      />
                      <CommandList className="max-h-[220px]">
                        <CommandEmpty>
                          <button
                            type="button"
                            className="w-full py-3 px-4 text-left text-xs text-muted-foreground hover:bg-muted transition-colors"
                            onClick={() => setIsProcSelectorOpen(false)}
                          >
                            Usar <strong className="text-foreground">"{formData.produto_servico}"</strong> como procedimento personalizado
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {procedimentosAtivos.map(proc => (
                            <CommandItem
                              key={proc.id}
                              value={proc.nome}
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, produto_servico: proc.nome }));
                                setIsProcSelectorOpen(false);
                              }}
                              className="py-2.5 px-3"
                            >
                              <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", formData.produto_servico === proc.nome ? "opacity-100 text-primary" : "opacity-0")} />
                              <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium truncate">{proc.nome}</p>
                                  {proc.categoria && (
                                    <p className="text-[10px] text-muted-foreground/50">{proc.categoria}</p>
                                  )}
                                </div>
                                {proc.valor_base != null && (
                                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
                                    {proc.valor_base.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <Input
                  placeholder="Ex: Harmonizacao, Botox, Preenchimento..."
                  value={formData.produto_servico}
                  onChange={e => setFormData(prev => ({ ...prev, produto_servico: e.target.value }))}
                  className="h-10 rounded-lg text-sm border-border/60"
                />
              )}
            </div>

            {/* ── Valor e Data ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div data-tutorial="venda-field-valor" className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor Fechado <span className="text-destructive">*</span>
                </Label>
                <CurrencyInput
                  id="valor-fechado"
                  value={formData.valor_fechado}
                  onValueChange={value => setFormData(prev => ({ ...prev, valor_fechado: value }))}
                  className="h-10 rounded-lg text-sm border-border/60"
                />
              </div>
              <div data-tutorial="venda-field-data" className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Data do Fechamento <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-10 rounded-lg text-sm border-border/60",
                        !formData.data_fechamento && "text-muted-foreground/50"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {formData.data_fechamento
                        ? format(formData.data_fechamento, "dd 'de' MMM, yyyy", { locale: ptBR })
                        : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-border/60">
                    <Calendar
                      mode="single"
                      selected={formData.data_fechamento}
                      onSelect={date => setFormData(prev => ({ ...prev, data_fechamento: date || new Date() }))}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* ── Forma de Pagamento ── */}
            <div data-tutorial="venda-field-pagamento" className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Forma de Pagamento
              </Label>
              <Select value={formData.forma_pagamento} onValueChange={value => setFormData(prev => ({ ...prev, forma_pagamento: value }))}>
                <SelectTrigger className="h-10 rounded-lg text-sm border-border/60">
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60">
                  {FORMAS_PAGAMENTO.map(fp => (
                    <SelectItem key={fp.value} value={fp.value} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <fp.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{fp.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Footer ── */}
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
              data-tutorial="venda-submit"
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            >
              {isMutating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
              ) : (
                isEditMode ? "Salvar Alteracoes" : "Registrar Venda"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
