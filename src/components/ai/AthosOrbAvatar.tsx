import { cn } from "@/lib/utils";
import { AthosLupa } from "@/components/ai/AthosLupa";

// Avatar-chip do Athos usado em toda bolha de resposta — mesmo elemento em
// qualquer superfície de chat. Depende das classes de src/components/ai/AthosChatStyles.tsx
// (renderizar <AthosChatStyles /> uma vez por página/painel que use este avatar).
export function AthosOrbAvatar({ className }: { className?: string }) {
  return (
    <div className={cn("shrink-0 mt-1 flex items-center justify-center w-7 h-7 rounded-xl bg-muted/30 border border-border/30", className)}>
      <AthosLupa className="w-5 h-5" />
    </div>
  );
}
