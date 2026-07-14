import { useState } from "react";
import { GitMerge, Check, ChevronsUpDown, Loader2, Play, StopCircle, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCadences, useLeadCadence } from "@/hooks/useCadences";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CadenceLeadSelectorProps {
  leadId: string;
}

export function CadenceLeadSelector({ leadId }: CadenceLeadSelectorProps) {
  const [open, setOpen] = useState(false);
  const { cadences, isLoading: loadingCadences } = useCadences();
  const { activeCadence, startCadence, stopCadence, isStarting } = useLeadCadence(leadId);

  const handleSelect = (id: string) => {
    startCadence({ cadenceId: id });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 transition-all border font-medium px-3",
            activeCadence 
              ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {isStarting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitMerge className={cn("h-4 w-4", activeCadence && "animate-pulse")} />
          )}
          <span className="hidden sm:inline text-xs">
            {activeCadence ? "Cadência Ativa" : "Ativar Cadência"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        {activeCadence ? (
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold font-display flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" /> {activeCadence.cadencias?.nome}
              </h4>
              <p className="text-[11px] text-muted-foreground">O fluxo de mensagens automáticas está em andamento para este cliente.</p>
            </div>

            {/* Informação do Último Envio */}
            {activeCadence.ultima_execucao && (
              <div className={cn(
                "p-2 rounded-md border text-xs flex flex-col gap-1",
                activeCadence.status_ultima_execucao === 'sucesso' 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                  : "bg-red-50 border-red-100 text-red-700"
              )}>
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">
                    {activeCadence.status_ultima_execucao === 'sucesso' 
                      ? <CheckCircle2 className="h-3 w-3" /> 
                      : <AlertCircle className="h-3 w-3" />
                    }
                    <span>
                      {activeCadence.passo_atual_ordem === 0
                        ? "Fluxo iniciado / aguardando"
                        : `Passo ${activeCadence.passo_atual_ordem} enviado`}
                    </span>
                  </div>
                  <span className="text-[10px] opacity-70 font-display tabular-nums">
                    {format(parseISO(activeCadence.ultima_execucao), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {activeCadence.status_ultima_execucao === 'erro' && activeCadence.erro_log && (
                  <p className="text-[10px] italic leading-tight mt-0.5 line-clamp-2">
                    Erro: {activeCadence.erro_log}
                  </p>
                )}
              </div>
            )}
            
            {/* Informação do Próximo Envio */}
            {activeCadence.proxima_execucao && (
                <div className="bg-muted/50 p-2 rounded-md flex items-center gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Próximo envio: <strong className="font-display tabular-nums">{format(parseISO(activeCadence.proxima_execucao), "dd/MM 'às' HH:mm", { locale: ptBR })}</strong></span>
                </div>
            )}

            <Button 
                variant="destructive" 
                size="sm" 
                className="w-full h-8 text-xs gap-2" 
                onClick={() => { stopCadence(); setOpen(false); }}
            >
                <StopCircle className="h-3.5 w-3.5" /> Interromper Fluxo
            </Button>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Buscar fluxo..." className="h-9 text-xs" />
            <CommandList className="max-h-60 overflow-y-auto">
              <CommandEmpty className="py-4 text-xs text-center text-muted-foreground">Nenhuma cadência encontrada.</CommandEmpty>
              <CommandGroup heading="Escolha um fluxo para iniciar">
                {loadingCadences ? (
                  <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : (
                  cadences.map((cadence) => (
                    <CommandItem
                      key={cadence.id}
                      onSelect={() => handleSelect(cadence.id)}
                      className="cursor-pointer py-2"
                    >
                      <Play className="mr-2 h-3.5 w-3.5 text-emerald-500 opacity-50" />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{cadence.nome}</span>
                        <span className="text-[10px] text-muted-foreground">{cadence.passos?.length || 0} mensagens agendadas</span>
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}