import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, User, Phone, Trash2, Inbox, ClipboardList, ExternalLink } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { LeadSelector } from "@/components/notifications/LeadSelector";
import { useAllNotifications, NotificationWithLead } from "@/hooks/useAllNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { NotificationMessage } from "@/components/conversations/NotificationMessage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NotificationCard = ({
  notification,
  onUpdateStatus,
  onNavigate,
}: {
  notification: NotificationWithLead;
  onUpdateStatus: (id: string, status: 'pendente' | 'resolvido') => void;
  onNavigate?: (leadId: string) => void;
}) => {
  const timeAgo = formatDistanceToNow(new Date(notification.criado_em), { addSuffix: true, locale: ptBR });
  const isPending = notification.status === 'pendente';
  const isFormulario = notification.tipo === 'novo_lead_formulario';

  return (
    <div className={cn(
      "group rounded-xl border bg-card transition-all duration-200 overflow-hidden",
      isPending
        ? "border-border/60 hover:border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        : "border-border/40 opacity-70 hover:opacity-100"
    )}>
      <div className="flex items-start gap-3.5 p-4">
        {/* Icon */}
        <div className={cn(
          "p-2 rounded-xl shrink-0 mt-0.5",
          isPending
            ? isFormulario ? "bg-orange-50 text-orange-500" : "bg-muted text-muted-foreground"
            : "bg-muted/40 text-muted-foreground/40"
        )}>
          {isFormulario ? <ClipboardList className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Type badge */}
          {isFormulario && (
            <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md">
              Meta Lead Ads
            </span>
          )}

          {/* Message */}
          <NotificationMessage message={notification.mensagem} />

          {/* Meta row */}
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="font-medium text-foreground/70 truncate max-w-[140px]">
                {notification.leads?.nome || 'Desconhecido'}
              </span>
            </div>
            {notification.leads?.telefone && (
              <div className="flex items-center gap-1.5 text-muted-foreground/60">
                <Phone className="h-3 w-3" />
                <span className="tabular-nums">{notification.leads.telefone}</span>
              </div>
            )}
            <span className="text-muted-foreground/40 tabular-nums ml-auto shrink-0">{timeAgo}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isFormulario && notification.dados?.lead_id && onNavigate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/40 hover:text-orange-600 hover:bg-orange-50 opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(notification.dados?.lead_id);
                if (isPending) onUpdateStatus(notification.id, 'resolvido');
              }}
              title="Ver lead"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          {isPending && (
            <Button
              data-tutorial="notificacoes-resolver"
              variant="ghost"
              size="icon"
              onClick={() => onUpdateStatus(notification.id, 'resolvido')}
              className="h-7 w-7 text-muted-foreground/40 hover:text-emerald-600 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-all"
              title="Resolver"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Notifications() {
  const today = new Date();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(today), to: endOfMonth(today) });
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>('todos');
  const [activeTab, setActiveTab] = useState<'pendentes' | 'resolvidas'>('pendentes');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { notifications, isLoading, updateStatus, deleteResolved, isDeletingResolved } = useAllNotifications({ dateRange, leadId: selectedLeadId });

  const { pending, resolved } = useMemo(() => {
    const pending = notifications.filter(n => n.status === 'pendente');
    const resolved = notifications.filter(n => n.status === 'resolvido');
    return { pending, resolved };
  }, [notifications]);

  const currentList = activeTab === 'pendentes' ? pending : resolved;

  return (
    <div className="space-y-6 pb-10 max-w-full overflow-hidden">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Notificações</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Alertas de atendimento e cadências</p>
      </div>

      {/* Toolbar: Tabs + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Custom pill tabs */}
        <div data-tutorial="notificacoes-tabs" className="flex items-center bg-muted/40 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('pendentes')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
              activeTab === 'pendentes'
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pendentes
            <span className={cn(
              "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md",
              activeTab === 'pendentes'
                ? "bg-background/20 text-background"
                : pending.length > 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
            )}>
              {isLoading ? '...' : pending.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('resolvidas')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
              activeTab === 'resolvidas'
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Resolvidas
            <span className={cn(
              "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md",
              activeTab === 'resolvidas'
                ? "bg-background/20 text-background"
                : "bg-muted text-muted-foreground"
            )}>
              {isLoading ? '...' : resolved.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'resolvidas' && resolved.length > 0 && (
            <Button
              data-tutorial="notificacoes-limpar"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmOpen(true)}
              className="h-8 rounded-lg text-[11px] font-medium border-destructive/30 text-destructive hover:bg-destructive/5 gap-1.5 px-3"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar Resolvidas
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div data-tutorial="notificacoes-filters" className="flex flex-col sm:flex-row gap-3 p-3.5 rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <DateRangePicker date={dateRange} setDate={setDateRange} className="w-full" hideQuickSelect />
        <LeadSelector selectedLeadId={selectedLeadId} setSelectedLeadId={setSelectedLeadId} />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : currentList.length > 0 ? (
        <div data-tutorial="notificacoes-list" className="space-y-2">
          {currentList.map((notification, idx) => (
            <div key={notification.id} {...(idx === 0 ? { 'data-tutorial': 'notificacoes-card' } : {})}>
              <NotificationCard
                notification={notification}
                onUpdateStatus={(id, s) => updateStatus({ notificationId: id, status: s })}
                onNavigate={(leadId) => navigate(`/crm/conversas/${leadId}`)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            {activeTab === 'pendentes' ? (
              <Inbox className="h-6 w-6 text-muted-foreground/40" />
            ) : (
              <CheckCircle className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {activeTab === 'pendentes' ? 'Nenhuma notificação pendente' : 'Nenhuma notificação resolvida'}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {activeTab === 'pendentes'
              ? 'Quando houver alertas, eles aparecerão aqui'
              : 'Notificações resolvidas neste período aparecerão aqui'
            }
          </p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">Limpar notificações resolvidas?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Todas as notificações com status "Resolvido" serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-2">
            <AlertDialogCancel className="rounded-lg text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { deleteResolved(); setIsConfirmOpen(false); }}
              className="bg-destructive hover:bg-destructive/90 rounded-lg text-xs"
              disabled={isDeletingResolved}
            >
              {isDeletingResolved ? "Limpando..." : "Sim, Limpar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
