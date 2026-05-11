import { useEffect } from "react";
import { Bell, CheckCircle, ClipboardList, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllNotifications } from "@/hooks/useAllNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "../ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";

export function NotificationsBell() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const { notifications, isLoading, updateStatus } = useAllNotifications({
    dateRange: undefined,
    leadId: 'todos',
  });

  const pendingNotifications = notifications.filter(n => n.status === 'pendente');

  // Real-time subscription para novos leads de formulário
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel('notificacoes-leads-form')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: `organization_id=eq.${orgId}`
      }, (payload: any) => {
        if (payload.new.tipo === 'novo_lead_formulario') {
          const leadId = payload.new.dados?.lead_id;
          toast(payload.new.titulo || '📋 Novo lead via formulário', {
            description: payload.new.mensagem,
            duration: 8000,
            action: leadId ? {
              label: "Ver lead",
              onClick: () => navigate(`/crm/conversas/${leadId}`),
            } : undefined,
          });
        }
        // Refetch notifications
        queryClient.invalidateQueries({ queryKey: ['all_notifications'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient, navigate]);

  const handleNotificationClick = (notification: any) => {
    // Para leads de formulário, navegar usando dados.lead_id
    if (notification.tipo === 'novo_lead_formulario' && notification.dados?.lead_id) {
      navigate(`/crm/conversas/${notification.dados.lead_id}`);
    } else if (notification.lead_id) {
      navigate(`/crm/conversas/${notification.lead_id}`);
    }
    // Marcar como resolvido ao clicar
    if (notification.status === 'pendente') {
      updateStatus({ notificationId: notification.id, status: 'resolvido' });
    }
  };

  const handleResolve = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    updateStatus({ notificationId, status: 'resolvido' });
  };

  const isFormularioMeta = (tipo?: string) => tipo === 'novo_lead_formulario';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {pendingNotifications.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {pendingNotifications.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificações Pendentes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-2 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : pendingNotifications.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground p-4">
              Nenhuma notificação pendente.
            </div>
          ) : (
            pendingNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="p-0 cursor-pointer"
                onSelect={() => handleNotificationClick(notification)}
              >
                <div className={`flex flex-col p-2 w-full hover:bg-muted/50 ${
                  isFormularioMeta(notification.tipo)
                    ? "border-l-4 border-l-orange-400 bg-orange-50/50"
                    : ""
                }`}>
                  {/* Header com ícone e tipo */}
                  <div className="flex items-center gap-2 mb-1">
                    {isFormularioMeta(notification.tipo) ? (
                      <>
                        <ClipboardList className="h-4 w-4 text-orange-500 shrink-0" />
                        <Badge className="text-[10px] px-1.5 py-0 bg-orange-500 hover:bg-orange-600 text-white">
                          Meta Lead Ads
                        </Badge>
                      </>
                    ) : null}
                  </div>

                  {/* Título (se existir) */}
                  {notification.titulo && (
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {notification.titulo}
                    </p>
                  )}

                  {/* Mensagem */}
                  <p className="text-sm text-foreground/80 line-clamp-2">
                    {notification.mensagem}
                  </p>

                  {/* Lead name */}
                  <p className="text-xs text-muted-foreground mt-1">
                    Cliente: {notification.leads?.nome || 'Desconhecido'}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.criado_em), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    <div className="flex items-center gap-1">
                      {isFormularioMeta(notification.tipo) && notification.dados?.lead_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-orange-600 hover:bg-orange-100 hover:text-orange-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/conversas/${notification.dados?.lead_id}`);
                            updateStatus({ notificationId: notification.id, status: 'resolvido' });
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver lead
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
                        onClick={(e) => handleResolve(e, notification.id)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolver
                      </Button>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
