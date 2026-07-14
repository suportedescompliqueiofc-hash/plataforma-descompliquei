// Formatação canônica de números da plataforma — FONTE ÚNICA DA VERDADE.
// Regra (design system, 2026-07-13): moeda sempre completa (R$ 80.300), 0 casas
// decimais, NUNCA abreviar ("80.3K"/"1.2M" são proibidos). Números em pt-BR.

/** Moeda BRL sem casas decimais e sem abreviação. Ex.: 80300 → "R$ 80.300". */
export function formatBRL(value: number | null | undefined): string {
  const v = Number.isFinite(value as number) ? (value as number) : 0;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** Inteiro em pt-BR com separador de milhar. Ex.: 1284 → "1.284". */
export function formatInt(value: number | null | undefined): string {
  const v = Number.isFinite(value as number) ? (value as number) : 0;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Percentual em pt-BR. Ex.: 12.5 → "12,5%". `decimals` controla as casas. */
export function formatPct(value: number | null | undefined, decimals = 1): string {
  const v = Number.isFinite(value as number) ? (value as number) : 0;
  return `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Número decimal genérico em pt-BR (ex.: ROAS 2,3). */
export function formatNum(value: number | null | undefined, decimals = 1): string {
  const v = Number.isFinite(value as number) ? (value as number) : 0;
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
