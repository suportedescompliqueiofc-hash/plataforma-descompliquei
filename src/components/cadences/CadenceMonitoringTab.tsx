import { useCadenceMonitoring, CadenceLog } from "@/hooks/useCadenceMonitoring";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertCircle, StopCircle, User, MessageSquare, History } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DateRange } from "react-day-picker";

interface CadenceMonitoringTabProps {
  dateRange: DateRange | undefined;
}

export function CadenceMonitoringTab({ dateRange }: CadenceMonitoringTabProps) {
  const { logs, isLoading, stopCadence } = useCadenceMonitoring(dateRange);

  const getStatusBadge = (status: string) => {
    if (status === 'sucesso') {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1 shadow-none">
          <CheckCircle2 className="h-3 w-3" /> Enviado
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1 shadow-none">
        <AlertCircle className="h-3 w-3" /> Falha
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Carregando histórico de envios...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/5 rounded-2xl border border-dashed border-border/60">
        <History className="h-12 w-12 text-muted-foreground mb-3 opacity-20" />
        <p className="text-muted-foreground">Nenhum registro de envio encontrado no período.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Os envios automáticos aparecerão aqui assim que forem processados.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden animate-in fade-in duration-500">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="text-xs uppercase font-bold tracking-wider">Cliente</TableHead>
            <TableHead className="text-xs uppercase font-bold tracking-wider">Fluxo / Mensagem</TableHead>
            <TableHead className="text-xs uppercase font-bold tracking-wider">Data do Envio</TableHead>
            <TableHead className="text-xs uppercase font-bold tracking-wider">Status</TableHead>
            <TableHead className="text-right text-xs uppercase font-bold tracking-wider">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="group hover:bg-muted/10 transition-colors">
              <TableCell>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold text-sm">{log.leads?.nome || "Cliente Removido"}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground pl-4">{log.leads?.telefone}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{log.cadencias?.nome || "Fluxo Removido"}</span>
                  <div className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase">
                    <MessageSquare className="h-3 w-3" /> <span className="font-display tabular-nums">Passo {log.passo_ordem}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-display tabular-nums">
                    {format(parseISO(log.enviado_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {log.status === 'erro' ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          {getStatusBadge(log.status)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-destructive text-destructive-foreground p-2 max-w-[250px] text-[10px]">
                        {log.mensagem_erro || "Erro desconhecido"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  getStatusBadge(log.status)
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => stopCadence(log.lead_id)}
                  title="Interromper cadência deste cliente"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}