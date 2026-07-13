import { cn } from "@/lib/utils";

// Avatar-chip do Athos usado em toda bolha de resposta — mesmo elemento em
// qualquer superfície de chat. Depende das classes de src/components/ai/AthosChatStyles.tsx
// (renderizar <AthosChatStyles /> uma vez por página/painel que use este avatar).
export function AthosOrbAvatar({ className }: { className?: string }) {
  return (
    <div className={cn("shrink-0 mt-1 flex items-center justify-center w-7 h-7 rounded-xl bg-muted/30 border border-border/30", className)}>
      <div
        className="w-3 h-3 rounded-full os-orb"
        style={{ animation: "os-iridescent 12s ease infinite", boxShadow: "0 0 6px rgba(80,140,230,0.12)" }}
      />
    </div>
  );
}
