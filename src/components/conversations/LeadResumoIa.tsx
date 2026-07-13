import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FormattedText } from "@/components/FormattedText";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadResumoIaProps {
  leadId: string;
}

interface ResumoIaData {
  resumo: string | null;
  procedimento_interesse: string | null;
  objetivo: string | null;
  objecao: string | null;
  enriquecido_em: string | null;
}

// Painel enxuto de leitura — mesma fonte de dados da aba "Resumo/IA" do card do lead
// (preenchida pelo Athos Escriba, assíncrono). Aqui é só consulta rápida durante o atendimento.
export function LeadResumoIa({ leadId }: LeadResumoIaProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["lead-resumo-ia", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("resumo, procedimento_interesse, objetivo, objecao, enriquecido_em")
        .eq("id", leadId)
        .maybeSingle();
      return data as ResumoIaData | null;
    },
    enabled: !!leadId,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const resumo = data?.resumo;
  const procedimentos = (data?.procedimento_interesse || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const atualizadoLabel = data?.enriquecido_em
    ? formatDistanceToNow(parseISO(data.enriquecido_em), { locale: ptBR, addSuffix: true })
    : null;

  if (!resumo && !data?.objetivo && !data?.objecao && procedimentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="p-2.5 rounded-xl bg-muted/40 mb-2">
          <Sparkles className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-[12px] font-medium text-muted-foreground">Ainda sem resumo da IA</p>
        <p className="text-[10.5px] text-muted-foreground/50 mt-0.5">
          O Athos analisa a conversa automaticamente após alguns minutos de silêncio
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Resumo da IA (Athos)</span>
        </div>
        {atualizadoLabel && (
          <span className="text-[10px] text-muted-foreground/50 shrink-0">atualizado {atualizadoLabel}</span>
        )}
      </div>

      {resumo && (
        <div className="text-[13px] text-foreground/90 leading-relaxed">
          <FormattedText content={resumo} />
        </div>
      )}

      {procedimentos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {procedimentos.map((p) => (
            <span
              key={p}
              className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50"
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {(data?.objetivo || data?.objecao) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {data?.objetivo && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Objetivo</span>
              <span className="text-[12.5px] text-foreground/90 leading-relaxed">{data.objetivo}</span>
            </div>
          )}
          {data?.objecao && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Objeção</span>
              <span className="text-[12.5px] text-foreground/90 leading-relaxed">{data.objecao}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
