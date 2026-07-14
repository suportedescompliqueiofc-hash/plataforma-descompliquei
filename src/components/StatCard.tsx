import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatCard — card de métrica/KPI CANÔNICO da plataforma (padrão do Painel).
 * Fonte única da verdade para métricas. Todo card de número de qualquer página
 * DEVE usar este componente para garantir mesma estrutura, fonte e espaçamento.
 *
 * - Número (`value`): text-[28px] font-bold font-display tabular-nums
 * - Rótulo (`label`): text-[11px] uppercase, muted
 * - Formate `value` com os helpers de `@/lib/format` (formatBRL/formatInt/formatPct).
 *
 * Use dentro de <StatCardGrid> para o visual "colado" com hairline (padrão do Painel),
 * ou solto (recebe borda/arredondamento próprios via `standalone`).
 */
export interface StatCardProps {
  label: string;
  /** Valor já formatado (use formatBRL/formatInt/formatPct de @/lib/format). */
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Variação vs período anterior (Evolução/Equipe). */
  delta?: { label: string; positive?: boolean };
  /** Linha auxiliar abaixo do número (ex.: "anterior: R$ 12.000"). */
  sublabel?: string;
  /** Ponto de cor à esquerda do rótulo (categorias/status). */
  dotColor?: string;
  /** Card com borda/arredondamento próprios (fora de um StatCardGrid). */
  standalone?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  sublabel,
  dotColor,
  standalone = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-5 py-5 bg-card",
        standalone &&
          "rounded-2xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
        {dotColor && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-[28px] leading-none font-bold font-display tabular-nums text-foreground">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "text-[11px] font-display tabular-nums font-semibold pb-0.5",
              delta.positive ? "text-emerald-600" : "text-red-600",
            )}
          >
            {delta.label}
          </span>
        )}
      </div>

      {sublabel && (
        <span className="text-[11px] text-muted-foreground/60">{sublabel}</span>
      )}
    </div>
  );
}

/**
 * StatCardGrid — grade "colada" canônica do Painel (hairline entre cards).
 * Passe o nº de colunas via `cols` (default 4). Ex.: <StatCardGrid cols={5}>.
 */
export function StatCardGrid({
  children,
  cols = 4,
  bare = false,
  flush = false,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
  /** Dentro de um card de seção (com header/borda própria): remove a borda/arredondamento
   *  externos do grid para evitar "moldura dupla". Mantém só as hairlines entre cards. */
  bare?: boolean;
  /** Remove as divisórias cinzas (hairlines) entre os cards — grade limpa, cards encostados. */
  flush?: boolean;
  className?: string;
}) {
  const colsClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5",
  }[cols];

  return (
    <div
      className={cn(
        "grid",
        flush ? "" : "gap-px bg-border/40",
        !bare && "rounded-2xl border border-border/60 overflow-hidden",
        colsClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
