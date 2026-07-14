import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, UserX, CheckCircle2, Phone, ShieldOff, MessageCircle, ShieldCheck } from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface NonLead {
  lead_id: string;
  nome: string;
  telefone: string;
  reason: string;
  confidence: "alta" | "media" | "baixa";
}

interface OkLead {
  lead_id: string;
  nome: string;
  telefone: string;
  reason: string;
}

interface NonLeadAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  alta:  "bg-red-50 text-red-700 border-red-200/80",
  media: "bg-amber-50 text-amber-700 border-amber-200/80",
  baixa: "bg-slate-50 text-slate-600 border-slate-200/80",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  alta:  "Alta certeza",
  media: "Média certeza",
  baixa: "Baixa certeza",
};

type PeriodKey = "today" | "3d" | "7d" | "30d" | "custom";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "3d",    label: "3 dias" },
  { key: "7d",    label: "7 dias" },
  { key: "30d",   label: "30 dias" },
  { key: "custom", label: "Personalizado" },
];

function getDateRange(period: PeriodKey, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const to = endOfDay(now).toISOString();

  if (period === "today")  return { from: startOfDay(now).toISOString(), to };
  if (period === "3d")     return { from: startOfDay(subDays(now, 2)).toISOString(), to };
  if (period === "7d")     return { from: startOfDay(subDays(now, 6)).toISOString(), to };
  if (period === "30d")    return { from: startOfDay(subDays(now, 29)).toISOString(), to };
  // custom
  return {
    from: customFrom ? startOfDay(new Date(customFrom)).toISOString() : startOfDay(subDays(now, 6)).toISOString(),
    to:   customTo   ? endOfDay(new Date(customTo)).toISOString()     : to,
  };
}

export function NonLeadAnalysisModal({ open, onClose, organizationId }: NonLeadAnalysisModalProps) {
  const navigate = useNavigate();
  const [phase, setPhase]               = useState<"idle" | "analyzing" | "results" | "removing">("idle");
  const [viewingConversation, setViewingConversation] = useState(false);
  const [showOkLeads, setShowOkLeads] = useState(false);
  const [period, setPeriod]             = useState<PeriodKey>("7d");
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState(format(new Date(), "yyyy-MM-dd"));
  const [nonLeads, setNonLeads]         = useState<NonLead[]>([]);
  const [okLeads, setOkLeads]           = useState<OkLead[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Resetar ao abrir
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setPeriod("7d");
      setCustomFrom("");
      setCustomTo(format(new Date(), "yyyy-MM-dd"));
      setNonLeads([]);
      setOkLeads([]);
      setSelected(new Set());
      setTotalAnalyzed(0);
      setShowOkLeads(false);
      setViewingConversation(false);
    }
  }, [open]);

  const canStart = period !== "custom" || (customFrom && customTo && customFrom <= customTo);

  const startAnalysis = async () => {
    if (!canStart) {
      toast.error("Selecione um período válido para continuar.");
      return;
    }
    setPhase("analyzing");
    const { from, to } = getDateRange(period, customFrom, customTo);

    // Usar fetch() direto com timeout de 2 minutos.
    // O cliente Supabase global tem timeout de 15s — insuficiente para esta análise.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-non-leads`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          "apikey": SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ organization_id: organizationId, date_from: from, date_to: to }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const found: NonLead[] = data.non_leads || [];
      const ok: OkLead[] = data.ok_leads || [];
      setNonLeads(found);
      setOkLeads(ok);
      setTotalAnalyzed(data.total_analyzed || 0);
      setSelected(new Set(found.map((nl) => nl.lead_id)));
      setPhase("results");
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError") {
        toast.error("A análise demorou mais que 2 minutos. Tente um período menor.");
      } else {
        toast.error("Erro ao analisar: " + (err.message || String(err)));
      }
      setPhase("idle");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === nonLeads.length) setSelected(new Set());
    else setSelected(new Set(nonLeads.map((nl) => nl.lead_id)));
  };

  const handleRemove = async () => {
    const toRemove = [
      ...nonLeads.filter((nl) => selected.has(nl.lead_id)),
      ...okLeads.filter((ol) => selected.has(ol.lead_id)),
    ];
    if (toRemove.length === 0) return;
    setPhase("removing");

    const ids = toRemove.map((nl) => nl.lead_id);
    const phones = toRemove.map((nl) => nl.telefone).filter(Boolean);

    try {
      // Excluir dados relacionados em paralelo antes de deletar o lead
      await Promise.all([
        supabase.from("mensagens").delete().in("lead_id", ids),
        supabase.from("lead_notas").delete().in("lead_id", ids),
        supabase.from("leads_tags").delete().in("lead_id", ids),
        supabase.from("lead_stage_history").delete().in("lead_id", ids),
        supabase.from("lead_cadencias").delete().in("lead_id", ids),
        supabase.from("agendamentos").delete().in("lead_id", ids),
        supabase.from("vendas").delete().in("lead_id", ids),
      ]);

      // Deletar os leads permanentemente
      const { error: deleteErr } = await supabase
        .from("leads")
        .delete()
        .in("id", ids);

      if (deleteErr) throw new Error("Erro ao excluir leads: " + deleteErr.message);

      // Inserir blacklist em lote
      if (phones.length > 0) {
        const blacklistRows = phones.map((tel) => ({
          organization_id: organizationId,
          telefone_normalizado: tel,
        }));
        const { error: blacklistErr } = await supabase
          .from("lead_blacklist")
          .upsert(blacklistRows, { onConflict: "organization_id,telefone_normalizado", ignoreDuplicates: true });

        if (blacklistErr) console.warn("[handleRemove] Blacklist parcialmente falhou:", blacklistErr.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${toRemove.length} contato${toRemove.length > 1 ? "s removidos" : " removido"} e bloqueado${toRemove.length > 1 ? "s" : ""} permanentemente`);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao remover contatos: " + (err.message || String(err)));
      setPhase("results");
    }
  };

  const allSelected = selected.size === nonLeads.length && nonLeads.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} modal={!viewingConversation}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden rounded-2xl border border-border/60 shadow-xl transition-all duration-300 max-w-[400px] w-[400px]",
          viewingConversation
            ? "left-4 top-[50%] -translate-y-1/2 translate-x-0"
            : ""
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >

        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                ANÁLISE DE CONTATOS COM IA
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                Identifica automaticamente quem não é lead real
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">

          {/* Idle */}
          {phase === "idle" && (
            <div className="flex flex-col gap-5">
              {/* Ícone + descrição */}
              <div className="flex flex-col items-center text-center pt-2">
                <div className="p-3.5 rounded-2xl bg-muted/40 mb-3">
                  <Sparkles className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold font-display text-foreground mb-1">Limpar contatos que não são leads</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[300px]">
                  A IA analisa até 50 contatos do período selecionado e identifica quem não é lead real — você revisa antes de qualquer remoção.
                </p>
              </div>

              {/* Critérios */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
                {["Candidatos a emprego", "Fornecedores", "Amigos pessoais", "Números errados", "Spam"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldOff className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              {/* Seletor de período */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  PERÍODO DE CADASTRO
                </p>

                {/* Pills */}
                <div className="bg-muted/40 rounded-xl p-1 flex gap-0.5">
                  {PERIOD_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPeriod(key)}
                      className={cn(
                        "flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all",
                        period === key
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Inputs de data personalizada */}
                {period === "custom" && (
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground mb-1">De</p>
                      <Input
                        type="date"
                        value={customFrom}
                        max={customTo || format(new Date(), "yyyy-MM-dd")}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="h-9 text-sm rounded-lg border-border/60"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground mb-1">Até</p>
                      <Input
                        type="date"
                        value={customTo}
                        min={customFrom}
                        max={format(new Date(), "yyyy-MM-dd")}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="h-9 text-sm rounded-lg border-border/60"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analyzing */}
          {phase === "analyzing" && (
            <div className="flex flex-col items-center text-center py-12">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
              <p className="text-sm font-semibold font-display">Analisando conversas...</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Isso pode levar alguns segundos dependendo do volume
              </p>
            </div>
          )}

          {/* Results */}
          {phase === "results" && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 mb-4">
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-foreground">
                    {nonLeads.length === 0
                      ? "Nenhum não-lead identificado"
                      : `${nonLeads.length} possível${nonLeads.length > 1 ? "is" : ""} não-lead${nonLeads.length > 1 ? "s" : ""} encontrado${nonLeads.length > 1 ? "s" : ""}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{totalAnalyzed} contatos analisados no período</p>
                </div>
                {nonLeads.length > 1 && (
                  <button
                    onClick={toggleAll}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {allSelected ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                )}
              </div>

              {nonLeads.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <p className="text-[12px] font-medium text-emerald-700">
                      Todos os contatos do período parecem ser leads legítimos.
                    </p>
                  </div>
                  {okLeads.length > 0 && (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                      {okLeads.map((ol) => {
                        const isSelected = selected.has(ol.lead_id);
                        return (
                          <div key={ol.lead_id} onClick={() => toggleSelect(ol.lead_id)} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all", isSelected ? "border-red-200/60 bg-red-50/40" : "border-border/30")}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(ol.lead_id)} className="shrink-0 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" onClick={(e) => e.stopPropagation()} />
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-[10px] font-bold bg-emerald-50 text-emerald-600">
                                {(ol.nome || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span className="text-[12px] font-semibold text-foreground truncate">{ol.nome}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic leading-snug truncate">"{ol.reason}"</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setViewingConversation(true); navigate(`/crm/conversas/${ol.lead_id}`); }} title="Abrir conversa" className="shrink-0 p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {nonLeads.map((nl) => {
                    const isSelected = selected.has(nl.lead_id);
                    return (
                      <div
                        key={nl.lead_id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                          isSelected
                            ? "border-red-200/60 bg-red-50/40"
                            : "border-border/30 bg-transparent opacity-40"
                        )}
                        onClick={() => toggleSelect(nl.lead_id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(nl.lead_id)}
                          className="mt-0.5 shrink-0 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">
                            {(nl.nome || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold text-foreground truncate">{nl.nome}</span>
                            <span className={cn(
                              "text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
                              CONFIDENCE_STYLES[nl.confidence] || CONFIDENCE_STYLES.media
                            )}>
                              {CONFIDENCE_LABELS[nl.confidence] || "Média certeza"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5 shrink-0" />
                            {nl.telefone}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1 italic leading-snug">
                            "{nl.reason}"
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingConversation(true);
                            navigate(`/crm/conversas/${nl.lead_id}`);
                          }}
                          title="Abrir conversa"
                          className="shrink-0 p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  </div>

                  {/* Leads OK — toggle "Ver todos" */}
                  {okLeads.length > 0 && (
                    <div className="border-t border-border/30 pt-2 mt-1">
                      <button
                        onClick={() => setShowOkLeads((v) => !v)}
                        className="flex items-center gap-1.5 w-full text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                        {showOkLeads ? "Ocultar" : "Ver"} {okLeads.length} lead{okLeads.length > 1 ? "s" : ""} considerado{okLeads.length > 1 ? "s" : ""} legítimo{okLeads.length > 1 ? "s" : ""}
                      </button>
                      {showOkLeads && (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 mt-1.5">
                          {okLeads.map((ol) => {
                            const isSelected = selected.has(ol.lead_id);
                            return (
                              <div key={ol.lead_id} onClick={() => toggleSelect(ol.lead_id)} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all", isSelected ? "border-red-200/60 bg-red-50/40" : "border-emerald-100/60 bg-emerald-50/20")}>
                                <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(ol.lead_id)} className="shrink-0 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" onClick={(e) => e.stopPropagation()} />
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarFallback className="text-[10px] font-bold bg-emerald-50 text-emerald-600">
                                    {(ol.nome || "?").charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                                    <span className="text-[12px] font-semibold text-foreground truncate">{ol.nome}</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic leading-snug truncate">"{ol.reason}"</p>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setViewingConversation(true); navigate(`/crm/conversas/${ol.lead_id}`); }} title="Abrir conversa" className="shrink-0 p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Removing */}
          {phase === "removing" && (
            <div className="flex flex-col items-center text-center py-12">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
              <p className="text-sm font-semibold font-display">Removendo e bloqueando contatos...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/40 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
            onClick={onClose}
            disabled={phase === "removing"}
          >
            {phase === "results" && nonLeads.length === 0 ? "Fechar" : "Cancelar"}
          </Button>

          {phase === "idle" && (
            <Button
              size="sm"
              disabled={!canStart}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 disabled:opacity-40"
              onClick={startAnalysis}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Iniciar análise
            </Button>
          )}

          {phase === "results" && nonLeads.length > 0 && (
            <Button
              size="sm"
              disabled={selected.size === 0}
              className="h-9 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 px-5 gap-1.5 disabled:opacity-40"
              onClick={handleRemove}
            >
              <UserX className="h-3.5 w-3.5" />
              Remover e bloquear {selected.size > 0 ? `${selected.size} ` : ""}selecionado{selected.size > 1 ? "s" : ""}
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
