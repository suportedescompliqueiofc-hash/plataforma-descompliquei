import { Scissors, Stethoscope, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { StatCard, StatCardGrid } from "@/components/StatCard";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { useProjecaoFaturamento } from "@/hooks/useProjecaoFaturamento";
import { JANELA_TAXAS_DIAS } from "@/lib/agendamentos";
import { cn } from "@/lib/utils";

/**
 * "Quanto ainda tem para faturar este mês?" — projeção a partir dos agendamentos que
 * ainda vão acontecer.
 *
 * Regra de linguagem (decisão de produto, 2026-07-20): nada aqui é "confirmado". São dois
 * blocos de PROJEÇÃO, ponderados pelas taxas reais da clínica, com o valor bruto ao lado
 * como teto.
 */
export function ProjecaoFaturamento() {
  const p = useProjecaoFaturamento();

  if (p.isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card h-[168px] animate-pulse" />
    );
  }

  const nadaProjetado = p.procedimentos.quantidade === 0 && p.consultas.quantidade === 0;

  function memoriaDeCalculo(taxas: { label: string; valor: number }[], bruto: number) {
    const teto = `teto ${formatBRL(bruto)}`;
    if (!taxas.length) return `${teto} · sem histórico para ponderar`;
    return `${teto} · ${taxas.map((t) => `${t.label} ${formatPct(t.valor * 100, 0)}`).join(" x ")}`;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              RECEITA NA MESA
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              Projeção do que ainda pode ser faturado com os agendamentos deste mês
            </p>
          </div>
        </div>
      </div>

      {nadaProjetado ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Target className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nada a projetar ainda</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 max-w-sm">
            Vincule um procedimento aos agendamentos em aberto para ver quanto ainda há para
            faturar neste mês.
          </p>
        </div>
      ) : (
        <>
          <StatCardGrid cols={p.metaReceita != null ? 3 : 2} bare>
            <StatCard
              label="Projeção — procedimentos"
              value={formatBRL(p.procedimentos.ponderado)}
              icon={Scissors}
              sublabel={`${formatInt(p.procedimentos.quantidade)} agendados · ${memoriaDeCalculo(
                p.procedimentos.taxas,
                p.procedimentos.bruto,
              )}`}
            />
            <StatCard
              label="Projeção — consultas"
              value={formatBRL(p.consultas.ponderado)}
              icon={Stethoscope}
              sublabel={`${formatInt(p.consultas.quantidade)} com interesse · ${memoriaDeCalculo(
                p.consultas.taxas,
                p.consultas.bruto,
              )}`}
            />
            {p.metaReceita != null && (
              <StatCard
                label={p.gap! > 0 ? "Falta para a meta" : "Acima da meta"}
                value={formatBRL(Math.abs(p.gap!))}
                icon={Target}
                delta={{
                  label: `meta ${formatBRL(p.metaReceita)}`,
                  positive: p.gap! <= 0,
                }}
                sublabel={`já faturado ${formatBRL(p.receitaRealizada)} + projeção ${formatBRL(p.totalPonderado)}`}
              />
            )}
          </StatCardGrid>

          {(!p.podePonderar || p.semValor > 0 || p.vencidosEmAberto > 0) && (
            <div className="px-5 py-3 border-t border-border/40 bg-muted/20 space-y-1.5">
              {!p.podePonderar && (
                <Aviso>
                  Ainda não há histórico suficiente dos últimos {JANELA_TAXAS_DIAS} dias para
                  ponderar — os valores acima estão brutos, sem desconto de falta ou cancelamento.
                </Aviso>
              )}
              {p.semValor > 0 && (
                <Aviso>
                  {formatInt(p.semValor)}{" "}
                  {p.semValor === 1 ? "agendamento ficou de fora" : "agendamentos ficaram de fora"}{" "}
                  da projeção por não ter valor nem procedimento vinculado.
                </Aviso>
              )}
              {p.vencidosEmAberto > 0 && (
                <Aviso>
                  {formatInt(p.vencidosEmAberto)}{" "}
                  {p.vencidosEmAberto === 1 ? "agendamento passado segue" : "agendamentos passados seguem"}{" "}
                  com status em aberto — atualize para a projeção e as taxas ficarem corretas.
                </Aviso>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2 text-[11px] text-muted-foreground/70")}>
      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500/70" />
      <span>{children}</span>
    </div>
  );
}
