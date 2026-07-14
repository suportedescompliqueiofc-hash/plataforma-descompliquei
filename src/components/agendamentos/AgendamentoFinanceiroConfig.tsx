import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Percent, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgendamentoFinanceiroConfig, AgendamentoFinanceiroConfig } from "@/hooks/useAgendamentoFinanceiroConfig";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AgendamentoFinanceiroConfig({ isOpen, onClose }: Props) {
  const { config, isLoading, saveConfig } = useAgendamentoFinanceiroConfig();

  const [form, setForm] = useState<AgendamentoFinanceiroConfig>({
    consulta_valor_padrao: null,
    consulta_abatimento_ativo: false,
    consulta_abatimento_tipo: "fixo",
    consulta_abatimento_valor: null,
  });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  async function handleSalvar() {
    await saveConfig.mutateAsync(form);
    onClose();
  }

  const abatimentoExemplo = (() => {
    if (!form.consulta_abatimento_ativo || !form.consulta_abatimento_valor) return null;
    const exemploProc = 1500;
    const exemploConsulta = form.consulta_valor_padrao ?? 300;
    if (form.consulta_abatimento_tipo === "percentual") {
      const desc = Math.round(exemploProc * form.consulta_abatimento_valor / 100 * 100) / 100;
      return { desconto: desc, final: exemploProc - desc, proc: exemploProc, consulta: exemploConsulta };
    }
    const desc = form.consulta_abatimento_valor;
    return { desconto: desc, final: exemploProc - desc, proc: exemploProc, consulta: exemploConsulta };
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </span>
            <div>
              <h2 className="text-base font-bold font-display text-foreground">Configurações Financeiras</h2>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">Consultas e abatimento no procedimento</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">

            {/* Valor padrão da consulta */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Valor padrão da consulta (R$)
              </Label>
              <p className="text-[10px] text-muted-foreground/50">Preenchido automaticamente ao criar uma consulta</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.consulta_valor_padrao ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, consulta_valor_padrao: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                  className="h-10 text-sm rounded-lg border-border/60 pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t border-border/40" />

            {/* Abatimento da consulta no procedimento */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Abatimento da consulta no procedimento</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    Desconta o valor da consulta ao registrar um procedimento para o mesmo lead
                  </p>
                </div>
                <Switch
                  checked={form.consulta_abatimento_ativo}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, consulta_abatimento_ativo: v }))}
                />
              </div>

              {form.consulta_abatimento_ativo && (
                <div className="space-y-3 pl-0">
                  {/* Tipo de abatimento */}
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Tipo de abatimento
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "fixo", label: "Valor fixo (R$)", icon: DollarSign },
                        { value: "percentual", label: "Percentual (%)", icon: Percent },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setForm((f) => ({ ...f, consulta_abatimento_tipo: opt.value as "fixo" | "percentual" }))}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition-colors",
                            form.consulta_abatimento_tipo === opt.value
                              ? "bg-foreground text-background border-foreground"
                              : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                          )}
                        >
                          <opt.icon className="h-3.5 w-3.5" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Valor do abatimento */}
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      {form.consulta_abatimento_tipo === "fixo" ? "Valor a abater (R$)" : "Percentual a abater (%)"}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-muted-foreground">
                        {form.consulta_abatimento_tipo === "fixo" ? "R$" : "%"}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max={form.consulta_abatimento_tipo === "percentual" ? 100 : undefined}
                        step="0.01"
                        value={form.consulta_abatimento_valor ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, consulta_abatimento_valor: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                        className="h-10 text-sm rounded-lg border-border/60 pl-9"
                        placeholder={form.consulta_abatimento_tipo === "fixo" ? "0,00" : "0"}
                      />
                    </div>
                  </div>

                  {/* Exemplo prático */}
                  {abatimentoExemplo && (
                    <div className="rounded-xl bg-muted/40 border border-border/40 p-3.5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Info className="h-3 w-3 text-muted-foreground/50" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Exemplo prático</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Consulta paga pelo lead</span>
                          <span className="font-semibold font-display tabular-nums">R$ {abatimentoExemplo.consulta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Procedimento (valor cheio)</span>
                          <span className="font-semibold font-display tabular-nums">R$ {abatimentoExemplo.proc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-red-600">
                          <span>Abatimento da consulta</span>
                          <span className="font-semibold font-display tabular-nums">– R$ {abatimentoExemplo.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="border-t border-border/40 pt-1 flex justify-between text-[12px] font-bold text-emerald-600">
                          <span>Lead paga pelo procedimento</span>
                          <span className="font-display tabular-nums">R$ {abatimentoExemplo.final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs rounded-lg">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={saveConfig.isPending || isLoading}
            className="h-9 text-xs rounded-lg px-5 font-semibold"
          >
            {saveConfig.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
