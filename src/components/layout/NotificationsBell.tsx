import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCircle, ClipboardList, ExternalLink, Phone, AlertTriangle, X, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllNotifications } from "@/hooks/useAllNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, isLoading, updateStatus } = useAllNotifications({
    dateRange: undefined,
    leadId: 'todos',
  });

  const pendingNotifications = notifications.filter(n => n.status === 'pendente');

  // Outbound ações pendentes
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

  // Click outside to close — check both trigger and panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsideTrigger = triggerRef.current?.contains(target);
      const clickedInsidePanel = panelRef.current?.contains(target);
      if (!clickedInsideTrigger && !clickedInsidePanel) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Real-time subscription
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
          toast(payload.new.titulo || 'Novo lead via formulário', {
            description: payload.new.mensagem,
            duration: 8000,
            action: leadId ? {
              label: "Ver lead",
              onClick: () => navigate(`/crm/conversas/${leadId}`),
            } : undefined,
          });
        }
        queryClient.invalidateQueries({ queryKey: ['all_notifications'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient, navigate]);

  const handleNotificationClick = (notification: any) => {
    if (notification.tipo === 'outbound_acao_pendente') {
      navigate('/outbound/prospectos');
    } else if (notification.tipo === 'novo_lead_formulario' && notification.dados?.lead_id) {
      navigate(`/crm/conversas/${notification.dados.lead_id}`);
    } else if (notification.lead_id) {
      navigate(`/crm/conversas/${notification.lead_id}`);
    }
    if (notification.status === 'pendente') {
      updateStatus({ notificationId: notification.id, status: 'resolvido' });
    }
    setOpen(false);
  };

  const handleResolve = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    updateStatus({ notificationId, status: 'resolvido' });
  };

  const isFormularioMeta = (tipo?: string) => tipo === 'novo_lead_formulario';
  const isOutboundAcao = (tipo?: string) => tipo === 'outbound_acao_pendente';

  // Calculate popover position based on trigger button
  const getPopoverStyle = useCallback((): React.CSSProperties => {
    if (!triggerRef.current) return { top: 64, right: 8 };
    const rect = triggerRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      return {
        position: 'fixed',
        top: rect.bottom + 8,
        left: 8,
        right: 8,
        zIndex: 9999,
      };
    }
    return {
      position: 'fixed',
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
      width: 360,
      zIndex: 9999,
    };
  }, []);

  const popoverContent = open ? (
    <>
      {/* Backdrop — mobile only */}
      <div className="fixed inset-0 sm:hidden" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />

      <div
        ref={panelRef}
        style={getPopoverStyle()}
        className="rounded-2xl border border-border/60 bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-muted">
              <Bell className="h-3 w-3 text-muted-foreground" />
            </span>
            <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Notificações</p>
            {totalBadge > 0 && (
              <span className="text-[10px] font-bold tabular-nums bg-foreground text-background px-1.5 py-0.5 rounded-md">
                {totalBadge}
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[min(420px,calc(100vh-120px))]">
          <div className="p-2 space-y-1">
            {/* Outbound atrasados */}
            {outboundAtrasados.length > 0 && (
              <>
                <div className="px-2 pt-1.5 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-500/70">Atrasadas</p>
                </div>
                {outboundAtrasados.map((p: any) => (
                  <button
                    key={`ob-late-${p.id}`}
                    onClick={() => { navigate('/outbound/prospectos'); setOpen(false); }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-red-50/50 transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg bg-red-50 text-red-500 shrink-0 mt-0.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{p.nome}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {p.proxima_acao || 'Ação pendente'} — {format(new Date(p.proxima_acao_data), "dd/MM HH:mm")}
                        </p>
                        <p className="text-[10px] text-red-400 font-medium mt-0.5">
                          {formatDistanceToNow(new Date(p.proxima_acao_data), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Outbound hoje */}
            {outboundHoje.length > 0 && (
              <>
                <div className="px-2 pt-1.5 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70">Hoje</p>
                </div>
                {outboundHoje.map((p: any) => (
                  <button
                    key={`ob-today-${p.id}`}
                    onClick={() => { navigate('/outbound/prospectos'); setOpen(false); }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50/50 transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500 shrink-0 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{p.nome}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {p.proxima_acao || 'Ação pendente'} — {format(new Date(p.proxima_acao_data), "dd/MM HH:mm")}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Separator between outbound and system notifications */}
            {outboundAcoes.length > 0 && pendingNotifications.length > 0 && (
              <div className="h-px bg-border/40 mx-2 my-1" />
            )}

            {/* System notifications */}
            {pendingNotifications.length > 0 && (
              <>
                {outboundAcoes.length > 0 && (
                  <div className="px-2 pt-1.5 pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Sistema</p>
                  </div>
                )}
                {pendingNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        "p-1.5 rounded-lg shrink-0 mt-0.5",
                        isFormularioMeta(notification.tipo)
                          ? "bg-orange-50 text-orange-500"
                          : isOutboundAcao(notification.tipo)
                          ? "bg-amber-50 text-amber-500"
                          : "bg-muted/60 text-muted-foreground"
                      )}>
                        {isFormularioMeta(notification.tipo) ? (
                          <ClipboardList className="h-3.5 w-3.5" />
                        ) : isOutboundAcao(notification.tipo) ? (
                          <Phone className="h-3.5 w-3.5" />
                        ) : (
                          <Bell className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Type badge */}
                        {isFormularioMeta(notification.tipo) && (
                          <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md mb-1">
                            Meta Lead Ads
                          </span>
                        )}

                        <p className="text-[13px] text-foreground leading-snug line-clamp-2">
                          {notification.mensagem}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[11px] text-muted-foreground truncate">
                            {notification.leads?.nome || 'Desconhecido'}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
                            {formatDistanceToNow(new Date(notification.criado_em), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      {/* Resolve button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                        onClick={(e) => handleResolve(e, notification.id)}
                        title="Resolver"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Empty state */}
            {!isLoading && pendingNotifications.length === 0 && outboundAcoes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Inbox className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-[13px] font-medium text-muted-foreground/60">Tudo em dia</p>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">Nenhuma notificação pendente</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/40 bg-muted/[0.03]">
          <button
            onClick={() => { navigate('/notificacoes'); setOpen(false); }}
            className="w-full text-center text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Ver todas as notificações
          </button>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-[18px] w-[18px] text-muted-foreground" />
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background leading-none ring-2 ring-background">
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>

      {/* Portal — renders outside header stacking context */}
      {createPortal(popoverContent, document.body)}
    </>
  );
}
