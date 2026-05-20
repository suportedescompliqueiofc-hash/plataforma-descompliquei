import { useEffect } from "react";
import { Bell, CheckCircle, ClipboardList, ExternalLink, Phone, AlertTriangle } from "lucide-react";
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
import { formatDistanceToNow, format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "../ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient, useQuery } from "@tanstack/react-query";

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

  // Query outbound próximas ações pendentes/atrasadas
  const { data: outboundAcoes = [] } = useQuery({
    queryKey: ['outbound_acoes_pendentes', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const now = new Date();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const { data, error } = await (supabase as any)
        .from('outbound_prospectos')
        .select('id, nome, clinica, proxima_acao, proxima_acao_data, total_tentativas, outbound_stages:stage_id(nome, cor, tipo)')
        .eq('organization_id', orgId)
        .not('proxima_acao_data', 'is', null)
        .lte('proxima_acao_data', endOfToday.toISOString())
        .order('proxima_acao_data', { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data || []).filter((p: any) => !p.outbound_stages || p.outbound_stages?.tipo === 'ativo');
    },
    enabled: !!orgId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const outboundAtrasados = outboundAcoes.filter((p: any) =>
    isBefore(new Date(p.proxima_acao_data), startOfDay(new Date()))
  );
  const outboundHoje = outboundAcoes.filter((p: any) =>
    !isBefore(new Date(p.proxima_acao_data), startOfDay(new Date()))
  );

  const totalBadge = pendingNotifications.length + outboundAcoes.length;

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
    // Outbound ação pendente → navegar para prospectos
    if (notification.tipo === 'outbound_acao_pendente') {
      navigate('/outbound/prospectos');
    // Para leads de formulário, navegar usando dados.lead_id
    } else if (notification.tipo === 'novo_lead_formulario' && notification.dados?.lead_id) {
      navigate(`/crm/conversas/${notification.dados.lead_id}`);
    } else if (notification.lead_id) {
      navigate(`/crm/conversas/${notification.lead_id}`);
    }
    // Marcar como resolvido ao clicar
    if (notification.status === 'pendente') {
      updateStatus({ notificationId: notification.id, status: 'resolvido' });
    }
  };

  const isOutboundAcao = (tipo?: string) => tipo === 'outbound_acao_pendente';

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
          {totalBadge > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {totalBadge > 99 ? '99+' : totalBadge}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificações Pendentes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {/* Outbound ações pendentes */}
          {outboundAcoes.length > 0 && (
            <>
              <div className="px-3 py-1.5 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#E85D24]" />
                <span className="text-xs font-semibold text-[#E85D24] uppercase tracking-wide">Outbound — Ações pendentes ({outboundAcoes.length})</span>
              </div>
              {outboundAtrasados.length > 0 && outboundAtrasados.map((p: any) => (
                <DropdownMenuItem
                  key={`ob-${p.id}`}
                  className="p-0 cursor-pointer"
                  onSelect={() => navigate('/outbound/prospectos')}
                >
                  <div className="flex flex-col p-2 w-full hover:bg-muted/50 border-l-4 border-l-red-400 bg-red-50/30">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <Badge className="text-[10px] px-1.5 py-0 bg-red-500 hover:bg-red-600 text-white">Atrasado</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{p.nome}</p>
                    {p.clinica && <p className="text-xs text-muted-foreground">{p.clinica}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {p.proxima_acao || 'Ação pendente'} — {format(new Date(p.proxima_acao_data), "dd/MM HH:mm")}
                      </p>
                      <span className="text-[10px] text-red-400 font-medium">
                        {formatDistanceToNow(new Date(p.proxima_acao_data), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              {outboundHoje.length > 0 && outboundHoje.map((p: any) => (
                <DropdownMenuItem
                  key={`ob-${p.id}`}
                  className="p-0 cursor-pointer"
                  onSelect={() => navigate('/outbound/prospectos')}
                >
                  <div className="flex flex-col p-2 w-full hover:bg-muted/50 border-l-4 border-l-amber-400 bg-amber-50/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Phone className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-600 text-white">Hoje</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{p.nome}</p>
                    {p.clinica && <p className="text-xs text-muted-foreground">{p.clinica}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {p.proxima_acao || 'Ação pendente'} — {format(new Date(p.proxima_acao_data), "dd/MM HH:mm")}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Notificações do sistema */}
          {isLoading ? (
            <div className="p-2 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : pendingNotifications.length === 0 && outboundAcoes.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground p-4">
              Nenhuma notificação pendente.
            </div>
          ) : pendingNotifications.length === 0 ? null : (
            pendingNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="p-0 cursor-pointer"
                onSelect={() => handleNotificationClick(notification)}
              >
                <div className={`flex flex-col p-2 w-full hover:bg-muted/50 ${
                  isFormularioMeta(notification.tipo)
                    ? "border-l-4 border-l-orange-400 bg-orange-50/50"
                    : isOutboundAcao(notification.tipo)
                    ? "border-l-4 border-l-[#E85D24] bg-[#E85D24]/5"
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
                    ) : isOutboundAcao(notification.tipo) ? (
                      <>
                        <Phone className="h-4 w-4 text-[#E85D24] shrink-0" />
                        <Badge className="text-[10px] px-1.5 py-0 bg-[#E85D24] hover:bg-[#E85D24]/90 text-white">
                          Outbound
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

                  {/* Lead/Prospecto name */}
                  <p className="text-xs text-muted-foreground mt-1">
                    {isOutboundAcao(notification.tipo)
                      ? `Prospecto: ${notification.dados?.prospecto_nome || 'Desconhecido'}`
                      : `Cliente: ${notification.leads?.nome || 'Desconhecido'}`}
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
