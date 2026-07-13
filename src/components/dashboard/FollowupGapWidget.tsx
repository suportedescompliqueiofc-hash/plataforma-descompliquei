import { useState } from "react";
import { AlertTriangle, Clock, TrendingDown, ChevronRight, Users, MessageCircle, ExternalLink, Bot, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useFollowupGap } from "@/hooks/useFollowupGap";
import { useDashboardLeadsModal } from "@/contexts/DashboardLeadsModalContext";
import { supabase } from "@/integrations/supabase/client";

function formatHoras(h: number): string {
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r > 0 ? `${d}d ${r}h` : `${d}d`;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface FollowupGapWidgetProps {
  dateRange?: DateRange;
  origem?: string;
}

export function FollowupGapWidget({ dateRange, origem }: FollowupGapWidgetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openModal } = useDashboardLeadsModal();
  const { leads, total, avgHorasSemContato, faturamentoEmRisco, isLoading } =
    useFollowupGap(dateRange, origem);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleAtivarFollow = async (e: React.MouseEvent, leadId: string, leadNome?: string | null) => {
    e.stopPropagation();
    setActivatingId(leadId);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          followup_manual: true,
          followup_tentativas: 0,
          followup_ultima_tentativa: null,
          followup_pausado: false,
        })
        .eq("id", leadId);
      if (error) throw error;
      toast.success(`Follow-up IA ativado para ${leadNome || "lead"}`);
      queryClient.invalidateQueries({ queryKey: ["followup-gap"] });
    } catch (err: any) {
      toast.error("Erro ao ativar follow-up: " + (err.message || String(err)));
    } finally {
      setActivatingId(null);
    }
  };

  if (isLoading) return null;
  if (total === 0) return null;

  const preview = leads.slice(0, 4);
  const hasMore = total > 4;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.03] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-amber-500/20 bg-amber-500/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700/80">
                LEADS SEM RETORNO
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                Detectados pela IA — equipe falou, lead sumiu
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold tabular-nums bg-amber-500/10 text-amber-700 rounded-lg px-2.5 py-1">
            {total} lead{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 divide-x divide-border/40 border-b border-border/40">
        <div className="px-4 py-3 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
              Aguardando follow
            </span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground leading-none mt-1">
            {total}
          </p>
        </div>
        <div className="px-4 py-3 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
              Média sem contato
            </span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 leading-none mt-1">
            {formatHoras(avgHorasSemContato)}
          </p>
        </div>
        <div className="px-4 py-3 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
              Faturamento em risco
            </span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-500 leading-none mt-1">
            {faturamentoEmRisco > 0 ? formatBRL(faturamentoEmRisco) : "—"}
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="divide-y divide-border/30">
        {preview.map((lead) => (
          <div key={lead.id} className="px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {lead.nome ?? lead.telefone ?? "Lead sem nome"}
              </p>
              {lead.followup_gap_motivo && (
                <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                  {lead.followup_gap_motivo}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-mono tabular-nums font-semibold text-amber-600 bg-amber-500/10 rounded-md px-2 py-0.5">
                {formatHoras(lead.horasSemContato)} sem resposta
              </span>
              <button
                onClick={(e) => handleAtivarFollow(e, lead.id, lead.nome)}
                disabled={activatingId === lead.id}
                title="Ativar follow-up IA"
                className="h-7 px-2 flex items-center justify-center gap-1 rounded-lg text-[10px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {activatingId === lead.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
                Follow IA
              </button>
              <button
                onClick={() => openModal("Leads sem retorno", [lead])}
                title="Ver conversa"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => navigate(`/crm/leads/${lead.id}`)}
                title="Ver jornada"
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {hasMore && (
        <div className="flex items-center justify-end px-5 py-3 border-t border-border/40 bg-muted/20">
          <button
            onClick={() => openModal("Leads sem retorno", leads)}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todos os {total} leads
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
