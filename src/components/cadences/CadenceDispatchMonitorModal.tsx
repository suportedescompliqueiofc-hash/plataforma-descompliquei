import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInSeconds, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeadCadenceRow {
  id: string;
  lead_id: string;
  passo_atual_ordem: number;
  proxima_execucao: string;
  leads: { nome: string | null; telefone: string };
}

interface CadenceDispatchMonitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cadenceId: string | undefined;
  cadenceName: string | undefined;
}

export function CadenceDispatchMonitorModal({ open, onOpenChange, cadenceId, cadenceName }: CadenceDispatchMonitorModalProps) {
  const [logs, setLogs] = useState<LeadCadenceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !cadenceId) return;

    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('lead_cadencias')
        .select('id, lead_id, passo_atual_ordem, proxima_execucao, leads(nome, telefone)')
        .eq('cadencia_id', cadenceId)
        .eq('status', 'ativo')
        .order('proxima_execucao', { ascending: true });

      if (!error && data) setLogs(data as any);
      setLoading(false);
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [open, cadenceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-display">
            <Users className="h-5 w-5" /> Fila em Tempo Real: {cadenceName}
          </DialogTitle>
          <DialogDescription>Acompanhe os leads que estão ativos nesta cadência.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Próximo Passo</TableHead>
                        <TableHead>Momento Agendado</TableHead>
                        <TableHead>Falta (Tempo Real)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin h-6 w-6 inline" /></TableCell></TableRow>
                    ) : logs.map(log => (
                        <TimerRow key={log.id} log={log} />
                    ))}
                </TableBody>
            </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimerRow({ log }: { log: LeadCadenceRow }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const update = () => {
            const now = new Date();
            const target = parseISO(log.proxima_execucao);
            const diff = differenceInSeconds(target, now);
            
            if (diff <= 0) {
                setTimeLeft("Enviando...");
            } else {
                const duration = intervalToDuration({ start: now, end: target });
                const d = duration.days || 0;
                const h = duration.hours || 0;
                const m = duration.minutes || 0;
                const s = duration.seconds || 0;
                
                let text = '';
                if (d > 0) text += `${d}d `;
                if (h > 0) text += `${h}h `;
                if (m > 0 || h > 0 || d > 0) text += `${m}m `;
                text += `${s}s`;
                
                setTimeLeft(text.trim());
            }
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [log.proxima_execucao]);

    return (
        <TableRow>
            <TableCell>
                <div className="font-semibold text-sm">{log.leads.nome || "Lead sem nome"}</div>
                <div className="text-xs text-muted-foreground">{log.leads.telefone}</div>
            </TableCell>
            <TableCell className="font-display tabular-nums">Passo {log.passo_atual_ordem + 1}</TableCell>
            <TableCell className="font-display tabular-nums">{format(parseISO(log.proxima_execucao), "dd/MM/yyyy 'às' HH:mm:ss")}</TableCell>
            <TableCell className="font-mono text-primary font-medium">{timeLeft}</TableCell>
        </TableRow>
    )
}
