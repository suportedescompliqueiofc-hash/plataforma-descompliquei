import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Palette } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Aparência</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Personalize o visual da aplicação</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <RadioGroup
          value={theme}
          onValueChange={(value: 'light' | 'dark') => setTheme(value)}
          className="grid grid-cols-2 gap-4 max-w-sm"
        >
          {/* Light */}
          <div className="relative">
            <RadioGroupItem value="light" id="light" className="peer sr-only" />
            <Label
              htmlFor="light"
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border-2 p-5 cursor-pointer transition-all duration-200",
                "hover:bg-muted/30",
                theme === 'light'
                  ? "border-foreground bg-muted/20 shadow-sm"
                  : "border-border/60 bg-card"
              )}
            >
              {/* Preview */}
              <div className="w-full aspect-[4/3] rounded-lg border border-border/40 overflow-hidden bg-[#FAFAF8]">
                <div className="h-2.5 bg-[#1A1A1A] flex items-center px-1.5 gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-red-400" />
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
                  <div className="w-1 h-1 rounded-full bg-green-400" />
                </div>
                <div className="flex h-[calc(100%-10px)]">
                  <div className="w-1/4 bg-[#1A1A1A]" />
                  <div className="flex-1 p-1.5 space-y-1">
                    <div className="h-1.5 w-3/4 bg-[#E8E8E4] rounded-sm" />
                    <div className="h-1.5 w-1/2 bg-[#E8E8E4] rounded-sm" />
                    <div className="h-4 w-full bg-white rounded-sm border border-[#E8E8E4] mt-1" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Sun className={cn("h-4 w-4", theme === 'light' ? "text-foreground" : "text-muted-foreground")} />
                <span className={cn(
                  "text-sm font-medium",
                  theme === 'light' ? "text-foreground" : "text-muted-foreground"
                )}>
                  Claro
                </span>
              </div>
            </Label>
          </div>

          {/* Dark */}
          <div className="relative">
            <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
            <Label
              htmlFor="dark"
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border-2 p-5 cursor-pointer transition-all duration-200",
                "hover:bg-muted/30",
                theme === 'dark'
                  ? "border-foreground bg-muted/20 shadow-sm"
                  : "border-border/60 bg-card"
              )}
            >
              {/* Preview */}
              <div className="w-full aspect-[4/3] rounded-lg border border-border/40 overflow-hidden bg-[#0A0A0A]">
                <div className="h-2.5 bg-[#1A1A1A] flex items-center px-1.5 gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-red-400" />
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
                  <div className="w-1 h-1 rounded-full bg-green-400" />
                </div>
                <div className="flex h-[calc(100%-10px)]">
                  <div className="w-1/4 bg-[#111111]" />
                  <div className="flex-1 p-1.5 space-y-1">
                    <div className="h-1.5 w-3/4 bg-[#2A2A2A] rounded-sm" />
                    <div className="h-1.5 w-1/2 bg-[#2A2A2A] rounded-sm" />
                    <div className="h-4 w-full bg-[#1A1A1A] rounded-sm border border-[#2A2A2A] mt-1" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Moon className={cn("h-4 w-4", theme === 'dark' ? "text-foreground" : "text-muted-foreground")} />
                <span className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? "text-foreground" : "text-muted-foreground"
                )}>
                  Escuro
                </span>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
