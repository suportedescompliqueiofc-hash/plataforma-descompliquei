import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarIcon, Check, ChevronsUpDown, Loader2, DollarSign, User,
  CreditCard, Package, Receipt, FileText, X, Stethoscope, Plus, Trash2,
  Link2, ArrowRight, Minus,
} from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/CurrencyInput";

interface VendaModalInitialValues {
  produto_servico?: string;
  valor_fechado?: number;
  agendamento_id?: string;
  tipo_venda?: string;
}

interface VendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  venda?: Venda | null;
  onSaved?: () => void;
  initialValues?: VendaModalInitialValues;
}

interface PagamentoEntry {
  metodo: string;
  valor: number | undefined;
}

interface AgendamentoResumido {
  id: string;
  titulo: string;
  tipo: string;
  data_hora_inicio: string;
  valor_orcado: number | null;
}

interface VendaFormData {
  id?: string;
  lead_id: string;
  valor_orcado: number | undefined;
  data_orcamento: Date | undefined;
  valor_fechado: number | undefined;
  data_fechamento: Date;
  formasPagamento: PagamentoEntry[];
  produto_servico: string;
  agendamento_id: string | null;
  valor_bruto: number | undefined;
  valor_abatimento: number | undefined;
  tipo_venda: string;
}

function parseFormasPagamento(raw: string | null | undefined): PagamentoEntry[] {
  if (!raw) return [{ metodo: '', valor: undefined }];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [{ metodo: raw, valor: undefined }];
}

function serializeFormasPagamento(entries: PagamentoEntry[]): string | null {
  const valid = entries.filter(e => e.metodo);
  if (valid.length === 0) return null;
  if (valid.length === 1 && valid[0].valor === undefined) return valid[0].metodo;
  return JSON.stringify(valid);
}

const initialFormState: VendaFormData = {
  lead_id: "",
  valor_orcado: undefined,
  data_orcamento: undefined,
  valor_fechado: undefined,
  data_fechamento: new Date(),
  formasPagamento: [{ metodo: '', valor: undefined }],
  produto_servico: "",
  agendamento_id: null,
  valor_bruto: undefined,
  valor_abatimento: undefined,
  tipo_venda: "procedimento",
};

const FORMAS_PAGAMENTO = [
  { value: "Cartão de Crédito", label: "Cartão de Crédito", icon: CreditCard },
  { value: "PIX", label: "PIX", icon: DollarSign },
  { value: "Boleto", label: "Boleto", icon: FileText },
  { value: "Dinheiro", label: "Dinheiro", icon: DollarSign },
  { value: "Outro", label: "Outro", icon: Receipt },
];

export function VendaModal({ open, onOpenChange, lead: preselectedLead, venda: editingVenda, onSaved, initialValues }: VendaModalProps) {
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
          formasPagamento: parseFormasPagamento(editingVenda.forma_pagamento),
          produto_servico: editingVenda.produto_servico || "",
          agendamento_id: editingVenda.agendamento_id ?? null,
          valor_bruto: editingVenda.valor_orcado ?? undefined,
          valor_abatimento: editingVenda.valor_orcado != null && editingVenda.valor_fechado != null
            ? editingVenda.valor_orcado - editingVenda.valor_fechado
            : undefined,
          tipo_venda: editingVenda.tipo_venda ?? "procedimento",
        });
      } else if (preselectedLead) {
        setFormData({
          ...initialFormState,
          lead_id: preselectedLead.id,
          data_fechamento: new Date(),
          ...(initialValues ?? {}),
        });
      } else {
        setFormData(initialFormState);
      }
    }
  }, [open, preselectedLead, editingVenda]);

  // Fetch agendamentos realizados do lead selecionado (últimos 90 dias)
  const { data: agendamentosLead = [] } = useQuery<AgendamentoResumido[]>({
    queryKey: ["agendamentos-lead-venda", formData.lead_id],
    queryFn: async () => {
      if (!formData.lead_id) return [];
      const desde = format(subDays(new Date(), 90), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, titulo, tipo, data_hora_inicio, valor_orcado")
        .eq("lead_id", formData.lead_id)
        .eq("status", "realizado")
        .gte("data_hora_inicio", desde)
        .order("data_hora_inicio", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as AgendamentoResumido[];
    },
    enabled: !!formData.lead_id && open,
    staleTime: 60 * 1000,
  });

  const agendamentoSelecionado = useMemo(
    () => agendamentosLead.find(a => a.id === formData.agendamento_id) ?? null,
    [agendamentosLead, formData.agendamento_id]
  );

  // Quando agendamento consulta com valor_orcado é selecionado, pré-preenche abatimento
  useEffect(() => {
    if (
      agendamentoSelecionado &&
      agendamentoSelecionado.tipo === "consulta" &&
      agendamentoSelecionado.valor_orcado
    ) {
      setFormData(prev => ({
        ...prev,
        valor_abatimento: agendamentoSelecionado.valor_orcado!,
      }));
    } else if (!agendamentoSelecionado || agendamentoSelecionado.tipo !== "consulta") {
      setFormData(prev => ({ ...prev, valor_abatimento: undefined }));
    }
  }, [agendamentoSelecionado]);

  // abatimento: só quando o agendamento vinculado é consulta E não estamos registrando uma taxa de consulta
  // (taxa de consulta = venda direta, sem deducao; abatimento = desconto num procedimento pago apos consulta)
  const showAbatimento =
    !!agendamentoSelecionado &&
    agendamentoSelecionado.tipo === "consulta" &&
    formData.tipo_venda !== "consulta";

  // valor_fechado computado quando abatimento ativo
  const valorFechadoComputado =
    showAbatimento && formData.valor_bruto !== undefined
      ? Math.max(0, (formData.valor_bruto ?? 0) - (formData.valor_abatimento ?? 0))
      : undefined;

  const [isAgendamentoSelectorOpen, setIsAgendamentoSelectorOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const valorFinalFechado = showAbatimento ? valorFechadoComputado : formData.valor_fechado;

    if (!formData.lead_id || valorFinalFechado === undefined || valorFinalFechado === null || !formData.data_fechamento || !formData.produto_servico) {
      toast.error("Preencha os campos obrigatórios: Cliente, Serviço/Produto, Valor Fechado e Data.");
      return;
    }

    const payload = {
      lead_id: formData.lead_id,
      valor_orcado: showAbatimento ? (formData.valor_bruto ?? null) : (formData.valor_orcado ?? null),
      valor_fechado: valorFinalFechado,
      data_orcamento: formData.data_orcamento ? format(formData.data_orcamento, 'yyyy-MM-dd') : null,
      data_fechamento: format(formData.data_fechamento, 'yyyy-MM-dd'),
      forma_pagamento: serializeFormasPagamento(formData.formasPagamento),
      produto_servico: formData.produto_servico,
      agendamento_id: formData.agendamento_id ?? null,
      tipo_venda: formData.tipo_venda || "procedimento",
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
                                setFormData(prev => ({
                                  ...prev,
                                  produto_servico: proc.nome,
                                  // pré-preenche valor bruto com valor_base do procedimento (editável)
                                  valor_bruto: proc.valor_base ?? prev.valor_bruto,
                                  valor_fechado: prev.agendamento_id ? prev.valor_fechado : (proc.valor_base ?? prev.valor_fechado),
                                }));
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

            {/* ── Vincular Agendamento ── */}
            {formData.lead_id && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="h-3 w-3" />
                  Vincular Agendamento
                  <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">(opcional)</span>
                </Label>
                <Popover open={isAgendamentoSelectorOpen} onOpenChange={setIsAgendamentoSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between h-10 rounded-lg text-sm font-normal border-border/60",
                        !formData.agendamento_id && "text-muted-foreground/50"
                      )}
                    >
                      {agendamentoSelecionado ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            "h-5 w-5 rounded flex items-center justify-center shrink-0 text-[9px] font-bold",
                            agendamentoSelecionado.tipo === "consulta" ? "bg-blue-100 text-blue-600" :
                            agendamentoSelecionado.tipo === "retorno" ? "bg-purple-100 text-purple-600" :
                            "bg-emerald-100 text-emerald-600"
                          )}>
                            {agendamentoSelecionado.tipo.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate text-foreground">{agendamentoSelecionado.titulo}</span>
                          <span className="text-muted-foreground/50 text-[11px] shrink-0">
                            {format(parseISO(agendamentoSelecionado.data_hora_inicio), "dd/MM", { locale: ptBR })}
                          </span>
                        </div>
                      ) : agendamentosLead.length === 0 ? (
                        <span className="text-muted-foreground/40 text-xs">Nenhum agendamento realizado nos últimos 90 dias</span>
                      ) : (
                        <span>Selecione um agendamento realizado...</span>
                      )}
                      {agendamentoSelecionado ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, agendamento_id: null, valor_abatimento: undefined }));
                          }}
                          className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  {agendamentosLead.length > 0 && (
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-border/60"
                      align="start"
                      onWheel={e => e.stopPropagation()}
                    >
                      <Command>
                        <CommandInput placeholder="Buscar agendamento..." className="text-sm h-10" />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty className="py-4 text-xs text-center text-muted-foreground/50">
                            Nenhum resultado
                          </CommandEmpty>
                          <CommandGroup>
                            {agendamentosLead.map(ag => (
                              <CommandItem
                                key={ag.id}
                                value={`${ag.titulo} ${ag.tipo}`}
                                onSelect={() => {
                                  setFormData(prev => ({ ...prev, agendamento_id: ag.id }));
                                  setIsAgendamentoSelectorOpen(false);
                                }}
                                className="py-2.5 px-3"
                              >
                                <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", formData.agendamento_id === ag.id ? "opacity-100 text-primary" : "opacity-0")} />
                                <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-medium truncate">{ag.titulo}</p>
                                    <p className="text-[10px] text-muted-foreground/50 capitalize">
                                      {ag.tipo} · {format(parseISO(ag.data_hora_inicio), "dd 'de' MMM", { locale: ptBR })}
                                    </p>
                                  </div>
                                  {ag.valor_orcado != null && (
                                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
                                      {ag.valor_orcado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </span>
                                  )}
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
            )}

            {/* ── Valor e Data ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {showAbatimento ? (
                <div className="space-y-2 sm:col-span-2">
                  {/* Breakdown: bruto - abatimento = líquido */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1 rounded-md bg-muted">
                        <Minus className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cálculo com Abatimento de Consulta</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          Valor Bruto <span className="text-destructive">*</span>
                        </Label>
                        <CurrencyInput
                          value={formData.valor_bruto}
                          onValueChange={v => setFormData(prev => ({ ...prev, valor_bruto: v }))}
                          className="h-9 rounded-lg text-sm border-border/60"
                          placeholder="Valor do procedimento"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          Abatimento (consulta)
                        </Label>
                        <CurrencyInput
                          value={formData.valor_abatimento}
                          onValueChange={v => setFormData(prev => ({ ...prev, valor_abatimento: v }))}
                          className="h-9 rounded-lg text-sm border-amber-300/60 bg-amber-50/30"
                          placeholder="Sugestão editável"
                        />
                      </div>
                    </div>
                    {/* Resultado */}
                    {formData.valor_bruto !== undefined && (
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <ArrowRight className="h-3 w-3" />
                          <span>Valor líquido a registrar</span>
                        </div>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          valorFechadoComputado === 0 ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {(valorFechadoComputado ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
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
              )}
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

            {/* ── Formas de Pagamento ── */}
            <div data-tutorial="venda-field-pagamento" className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Formas de Pagamento
                </Label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, formasPagamento: [...prev.formasPagamento, { metodo: '', valor: undefined }] }))}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {formData.formasPagamento.map((fp, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select
                      value={fp.metodo}
                      onValueChange={val => setFormData(prev => ({
                        ...prev,
                        formasPagamento: prev.formasPagamento.map((e, i) => i === idx ? { ...e, metodo: val } : e)
                      }))}
                    >
                      <SelectTrigger className="h-10 rounded-lg text-sm border-border/60 flex-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/60">
                        {FORMAS_PAGAMENTO.map(f => (
                          <SelectItem key={f.value} value={f.value} className="py-2.5">
                            <div className="flex items-center gap-2">
                              <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{f.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <CurrencyInput
                      value={fp.valor}
                      onChange={val => setFormData(prev => ({
                        ...prev,
                        formasPagamento: prev.formasPagamento.map((e, i) => i === idx ? { ...e, valor: val } : e)
                      }))}
                      placeholder="Valor (opcional)"
                      className="h-10 w-36 rounded-lg text-sm border-border/60"
                    />
                    {formData.formasPagamento.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, formasPagamento: prev.formasPagamento.filter((_, i) => i !== idx) }))}
                        className="h-10 w-10 flex items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
