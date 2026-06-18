import { useState, useEffect } from "react";
import { Clock, Unlock, Loader2, Trash2, Save, RefreshCw, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLeads, Lead } from "@/hooks/useLeads";
import { Message } from "@/hooks/useConversations";
import { addSeconds, isAfter, differenceInMinutes, differenceInHours } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface AiLockControlProps {
  lead: Lead;
  lastIncomingMessage?: string;
  lastIncomingMessageType?: string;
  messages?: Message[];
}



export function AiLockControl({ lead, lastIncomingMessage, lastIncomingMessageType, messages = [] }: AiLockControlProps) {
  const { updateLead } = useLeads();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [newDuration, setNewDuration] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const calculateStatus = () => {
    if (!lead.ia_paused_until) {
      setIsBlocked(false);
      setTimeDisplay(null);
      return;
    }
    const end = new Date(lead.ia_paused_until);
    const now = new Date();
    if (isAfter(end, now)) {
      setIsBlocked(true);
      const hours = differenceInHours(end, now);
      const minutes = differenceInMinutes(end, now) % 60;
      if (hours > 0) {
        setTimeDisplay(`${hours}h ${minutes > 0 ? `${minutes}m` : ''}`);
      } else {
        setTimeDisplay(`${minutes}m`);
      }
    } else {
      setIsBlocked(false);
      setTimeDisplay(null);
    }
  };

  useEffect(() => {
    calculateStatus();
    const timer = setInterval(calculateStatus, 30000);
    return () => clearInterval(timer);
  }, [lead.ia_paused_until]);

  const handleSaveBlock = async () => {
    const seconds = parseInt(newDuration, 10);
    if (isNaN(seconds) || seconds <= 0) {
      toast.warning("Por favor, insira um tempo válido em segundos.");
      return;
    }
    setIsLoading(true);
    const newPausedUntil = addSeconds(new Date(), seconds).toISOString();

    updateLead(
      { id: lead.id, ia_paused_until: newPausedUntil },
      {
        onSuccess: () => {
          toast.success(`Bloqueio de ${seconds} segundos ativado.`);
          setIsPopoverOpen(false);
          setNewDuration("");
        },
        onError: () => toast.error("Erro ao salvar o bloqueio."),
        onSettled: () => setIsLoading(false),
      }
    );
  };

  const handleRemoveBlock = async () => {
    setIsLoading(true);

    updateLead(
      { id: lead.id, ia_paused_until: null },
      {
        onSuccess: () => {
          toast.success("Bloqueio removido com sucesso.");
          setIsPopoverOpen(false);
        },
        onError: () => toast.error("Erro ao remover o bloqueio."),
        onSettled: () => setIsLoading(false),
      }
    );
  };

  // ── Reiniciar atendimento IA do zero ──────────────────────────────────────
  const handleRestartAi = async () => {
    if (!window.confirm(
      "Tem certeza que quer reiniciar o atendimento da IA para este lead?\n\n" +
      "Isso vai:\n" +
      "• Reativar a IA (ia_ativa = true)\n" +
      "• Remover qualquer pausa ou bloqueio\n" +
      "• Apagar toda a memória de conversa armazenada\n" +
      "• Resetar o ciclo de follow-ups automáticos\n\n" +
      "A IA irá tratar a próxima mensagem como se fosse o primeiro contato."
    )) {
      return;
    }

    setIsRestarting(true);
    const sessionId = lead.id;

    try {
      // 1. Limpar memória do agente para este lead
      const { error: memErr } = await supabase
        .from("memoria_agente")
        .delete()
        .eq("session_id", sessionId);

      if (memErr) {
        console.warn("Aviso ao limpar memória:", memErr.message);
        // Continua mesmo com erro na memória
      }

      // 2. Reativar IA e remover todos os bloqueios + resetar follow-ups
      const { error: leadsErr } = await supabase
        .from("leads")
        .update({
          ia_ativa: true,
          ia_paused_until: null,
          ai_pending_since: null,
          followup_tentativas: 0,
          followup_ultima_tentativa: null,
          followup_pausado: false,
          atualizado_em: new Date().toISOString(),
        } as any)
        .eq("id", lead.id);

      if (leadsErr) throw leadsErr;

      toast.success("✅ IA reiniciada! A próxima mensagem será tratada do zero.");
      setIsPopoverOpen(false);
    } catch (err: any) {
      console.error("Erro ao reiniciar IA:", err);
      toast.error("Erro ao reiniciar a IA. Tente novamente.");
    } finally {
      setIsRestarting(false);
    }
  };

  const handleDispatchAi = async () => {
    if (!lastIncomingMessage) {
      toast.warning("Nenhuma mensagem de entrada encontrada para enviar à IA.");
      return;
    }

    setIsDispatching(true);
    try {
      // Montar histórico das últimas mensagens (excluindo a última de entrada que vai como mensagem_usuario)
      const recentMessages = messages.slice(-20);
      const lastIncomingIdx = recentMessages.findLastIndex(m => m.direcao === 'entrada');
      const historyMessages = lastIncomingIdx > 0 ? recentMessages.slice(0, lastIncomingIdx) : recentMessages.slice(0, -1);

      const historico_conversa = historyMessages
        .filter(m => m.conteudo && m.tipo_conteudo === 'texto')
        .map(m => ({
          role: m.direcao === 'entrada' ? 'user' : 'assistant',
          content: m.conteudo,
        }));

      const { error } = await supabase.functions.invoke('whatsapp-ai-agent', {
        body: {
          lead_id: lead.id,
          organization_id: lead.organization_id,
          mensagem_usuario: lastIncomingMessage,
          tipo_mensagem: lastIncomingMessageType || 'texto',
          historico_conversa: historico_conversa.length > 0 ? historico_conversa : null,
        },
      });

      if (error) throw error;
      toast.success("IA disparada com sucesso! A resposta será enviada em instantes.");
      setIsPopoverOpen(false);
    } catch (err: any) {
      console.error("Erro ao disparar IA:", err);
      toast.error("Erro ao disparar a IA. Tente novamente.");
    } finally {
      setIsDispatching(false);
    }
  };

  // IA permanentemente desativada por transbordo humano
  const iaPermBlocked = lead.ia_ativa === false;

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 transition-all border font-medium w-[120px] justify-center text-xs",
            iaPermBlocked
              ? "bg-red-50 text-red-600 border-red-300 hover:bg-red-100 hover:text-red-700"
              : isBlocked
              ? "bg-[#FEF3C7] text-[#D97706] border-[#FCD34D] hover:bg-[#FDE68A] hover:text-[#B45309]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {iaPermBlocked ? (
            <>
              <Bot className="h-4 w-4" />
              <span className="text-xs">IA Desativada</span>
            </>
          ) : isBlocked ? (
            <>
              <Clock className="h-4 w-4" />
              <span>{timeDisplay || "Bloqueado"}</span>
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Desbloqueado</span>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Controle da IA</h4>
            <p className="text-sm text-muted-foreground">
              Gerencie o bloqueio e reinicialização da IA para este lead.
            </p>
          </div>

          {/* Aviso de transbordo ativo */}
          {iaPermBlocked && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm font-medium text-red-800">⚠️ IA desativada por transbordo</p>
              <p className="text-xs text-red-600 mt-1">
                A IA foi pausada quando um atendente humano foi notificado.
                Use "Reiniciar IA" abaixo para voltar ao atendimento automático.
              </p>
            </div>
          )}

          {/* Bloqueio temporário ativo */}
          {isBlocked && !iaPermBlocked && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-amber-800">Bloqueio Ativo</p>
                  <p className="text-xs text-amber-600">Tempo restante: ~{timeDisplay}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveBlock}
                  disabled={isLoading}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remover
                </Button>
              </div>
            </div>
          )}

          {/* Disparar IA manualmente */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={handleDispatchAi}
              disabled={isDispatching || !lastIncomingMessage}
            >
              {isDispatching
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />
              }
              Disparar IA
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              Executa a IA para a última mensagem recebida
            </p>
          </div>

          {/* Reiniciar IA — sempre disponível */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              onClick={handleRestartAi}
              disabled={isRestarting}
            >
              {isRestarting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
              Reiniciar Atendimento IA
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              Reativa a IA e apaga a memória da conversa
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}