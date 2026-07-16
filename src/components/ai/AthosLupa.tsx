import { useId } from "react";
import { cn } from "@/lib/utils";

// Símbolo canônico do Athos — lupa de cristal, grafite + acento laranja.
// Vetorial: nítido em qualquer tamanho. Cores trocam com o tema (dark:).
export function AthosLupa({ className, mono }: { className?: string; mono?: boolean }) {
  const gid = useId(); // id único do gradiente por instância (evita id duplicado)
  return (
    <svg viewBox="0 0 96 96" className={cn("shrink-0", className)} aria-hidden="true">
      <defs>
        <radialGradient id={`${gid}-flare`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(234,88,12,0.85)" />
          <stop offset="100%" stopColor="rgba(234,88,12,0)" />
        </radialGradient>
      </defs>
      {/* cabo */}
      <line x1="60" y1="60" x2="85" y2="85" strokeWidth="11" strokeLinecap="round"
            className={cn(mono ? "stroke-current" : "stroke-[#17161c] dark:stroke-[#ece7df]")} />
      {/* acento laranja no cabo */}
      <line x1="61.5" y1="58.5" x2="82" y2="79" stroke="#E85D24" strokeWidth="2.4"
            strokeLinecap="round" opacity="0.55" />
      {/* aro */}
      <circle cx="40" cy="40" r="30" fill="none" strokeWidth="7"
              className={cn(mono ? "stroke-current" : "stroke-[#17161c] dark:stroke-[#ece7df]")} />
      {/* brilho dimensional no aro: luz no claro, sombra no escuro (top-left) — omitido em mono (detalhe invisível a 18px) */}
      {!mono && (
        <path d="M15 26 A30 30 0 0 1 33 12" fill="none" strokeWidth="2.4" strokeLinecap="round"
              className="stroke-white/40 dark:stroke-black/25" />
      )}
      {/* corpo de vidro da lente (troca com tema, ou currentColor em mono) */}
      {mono ? (
        <circle cx="40" cy="40" r="25" fill="currentColor" fillOpacity={0.14} />
      ) : (
        <circle cx="40" cy="40" r="25"
                className="fill-[rgba(16,18,26,0.15)] dark:fill-[rgba(255,255,255,0.06)]" />
      )}
      {/* flare quente sutil */}
      <ellipse cx="52" cy="52" rx="9.5" ry="8.5" fill={`url(#${gid}-flare)`} opacity="0.55" />
      {/* reflexos de vidro */}
      <line x1="25" y1="44" x2="41" y2="26" strokeWidth="5.2" strokeLinecap="round"
            className={cn(mono ? "stroke-current" : "stroke-white/85 dark:stroke-white/60")} />
      <line x1="30" y1="51" x2="38" y2="41" strokeWidth="2.7" strokeLinecap="round" opacity="0.8"
            className={cn(mono ? "stroke-current" : "stroke-white/85 dark:stroke-white/60")} />
      {/* glint */}
      <circle cx="30.5" cy="29.5" r="2.3" className={cn(mono ? "fill-current" : "fill-white/85 dark:fill-white/60")} />
      {/* rim laranja interno */}
      <circle cx="40" cy="40" r="26.4" fill="none" stroke="#E85D24" strokeWidth="1.7" opacity="0.9" />
    </svg>
  );
}
