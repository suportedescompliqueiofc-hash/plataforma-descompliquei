import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LifeBuoy, Search, ChevronLeft, Bug, ArrowUpCircle, HelpCircle, MoreHorizontal,
  AlertCircle, RefreshCw, Clock, CheckCircle2, Send, Loader2, Video,
  Eye, Building2, Calendar, Paperclip, Filter, TrendingUp, XCircle, FileText,
  Image, User, LayoutList, LayoutGrid, X, Download,
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  useAdminTickets,
  useAdminTicketDetalhe,
  useAdminResponderTicket,
  useAdminAtualizarStatus,
  CATEGORIA_LABELS,
  PRIORIDADE_LABELS,
  STATUS_LABELS,
  PRIORIDADE_COLORS,
  STATUS_COLORS,
  CATEGORIA_COLORS,
  type TicketCategoria,
  type TicketPrioridade,
  type TicketStatus,
} from '@/hooks/useSuporteTickets';

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORIA_ICONS: Record<TicketCategoria, React.ReactNode> = {
  bug: <Bug className="h-3.5 w-3.5" />,
  melhoria: <ArrowUpCircle className="h-3.5 w-3.5" />,
  duvida: <HelpCircle className="h-3.5 w-3.5" />,
  outro: <MoreHorizontal className="h-3.5 w-3.5" />,
};

const STATUS_ICONS: Record<TicketStatus, React.ReactNode> = {
  aberto: <AlertCircle className="h-3.5 w-3.5" />,
  em_analise: <RefreshCw className="h-3.5 w-3.5" />,
  aguardando_info: <Clock className="h-3.5 w-3.5" />,
  resolvido: <CheckCircle2 className="h-3.5 w-3.5" />,
  fechado: <XCircle className="h-3.5 w-3.5" />,
};

const PRIORIDADE_DOT: Record<TicketPrioridade, string> = {
  baixa: 'bg-slate-400',
  media: 'bg-blue-400',
  alta: 'bg-amber-400',
  critica: 'bg-red-500',
};

const KANBAN_COLUMNS: { id: TicketStatus; color: string }[] = [
  { id: 'aberto',          color: 'bg-blue-500'    },
  { id: 'em_analise',      color: 'bg-violet-500'  },
  { id: 'aguardando_info', color: 'bg-amber-500'   },
  { id: 'resolvido',       color: 'bg-emerald-500' },
  { id: 'fechado',         color: 'bg-slate-400'   },
];

// ── Detalhe do Ticket (Admin) ──────────────────────────────────────────────

function AdminTicketDetalhe({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { data: ticket, isLoading } = useAdminTicketDetalhe(ticketId);
  const responder = useAdminResponderTicket();
  const atualizarStatus = useAdminAtualizarStatus();
  const [resposta, setResposta] = useState('');
  const [novoStatus, setNovoStatus] = useState<TicketStatus | 'manter'>('manter');
  const [previewMidia, setPreviewMidia] = useState<{ url: string; nome: string; tipo: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!ticket) return null;

  const handleEnviarResposta = async () => {
    if (!resposta.trim()) return;
    await responder.mutateAsync({
      ticketId,
      orgId: ticket.organization_id,
      conteudo: resposta,
      novoStatus: novoStatus !== 'manter' ? novoStatus as TicketStatus : undefined,
    });
    setResposta('');
    setNovoStatus('manter');
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar para lista
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-muted shrink-0 mt-0.5">
                  <LifeBuoy className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground/40">#{ticket.numero_ticket}</span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_COLORS[ticket.status as TicketStatus])}>
                      {STATUS_ICONS[ticket.status as TicketStatus]}
                      {STATUS_LABELS[ticket.status as TicketStatus]}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', CATEGORIA_COLORS[ticket.categoria as TicketCategoria])}>
                      {CATEGORIA_ICONS[ticket.categoria as TicketCategoria]}
                      {CATEGORIA_LABELS[ticket.categoria as TicketCategoria]}
                    </span>
                    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold', PRIORIDADE_COLORS[ticket.prioridade as TicketPrioridade])}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORIDADE_DOT[ticket.prioridade as TicketPrioridade])} />
                      {PRIORIDADE_LABELS[ticket.prioridade as TicketPrioridade]}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-foreground font-display">{ticket.titulo}</h2>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    Aberto em {format(parseISO(ticket.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/30">
              {(ticket.mensagens || []).map((msg: any) => (
                <div key={msg.id} className={cn('px-5 py-4', msg.autor_tipo === 'admin' && 'bg-muted/[0.03]')}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      msg.autor_tipo === 'admin' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                    )}>
                      {msg.autor_tipo === 'admin' ? 'D' : (msg.autor_nome?.charAt(0)?.toUpperCase() || 'C')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {msg.autor_tipo === 'admin' ? 'Equipe Descompliquei' : msg.autor_nome}
                        </span>
                        {msg.autor_tipo === 'admin' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-foreground text-background uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/40">
                          {format(parseISO(msg.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!ticket.mensagens || ticket.mensagens.length === 0) && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                </div>
              )}
            </div>

            {ticket.midias && ticket.midias.length > 0 && (
              <div className="px-5 py-4 border-t border-border/40 bg-muted/[0.02]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-1.5">
                  <Paperclip className="h-3 w-3" /> Anexos ({ticket.midias.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {ticket.midias.map((midia: any) => (
                    midia.tipo === 'image' ? (
                      <button
                        key={midia.id}
                        onClick={() => setPreviewMidia({ url: midia.url_publica, nome: midia.nome_arquivo, tipo: 'image' })}
                        className="group relative"
                      >
                        <img src={midia.url_publica} alt={midia.nome_arquivo}
                          className="h-20 w-20 object-cover rounded-lg border border-border/60 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                          <Eye className="h-4 w-4 text-white" />
                        </div>
                      </button>
                    ) : (
                      <button
                        key={midia.id}
                        onClick={() => setPreviewMidia({ url: midia.url_publica, nome: midia.nome_arquivo, tipo: 'file' })}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-foreground">{midia.nome_arquivo}</span>
                      </button>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Caixa de resposta */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <Send className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Enviar Resposta</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">O cliente receberá a resposta nesta conversa</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <Textarea
                value={resposta}
                onChange={e => setResposta(e.target.value)}
                placeholder="Escreva a resposta para o cliente..."
                className="min-h-[120px] text-sm rounded-lg border-border/60 resize-none"
              />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Após envio:
                  </Label>
                  <Select value={novoStatus} onValueChange={v => setNovoStatus(v as TicketStatus | 'manter')}>
                    <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 w-[180px]">
                      <SelectValue placeholder="Manter status atual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manter">Manter status atual</SelectItem>
                      <SelectItem value="em_analise">Marcar Em Análise</SelectItem>
                      <SelectItem value="aguardando_info">Aguardando Info</SelectItem>
                      <SelectItem value="resolvido">Marcar Resolvido</SelectItem>
                      <SelectItem value="fechado">Fechar Ticket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleEnviarResposta}
                  disabled={!resposta.trim() || responder.isPending}
                  className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
                >
                  {responder.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</> : <><Send className="h-3.5 w-3.5" /> Enviar Resposta</>}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Informações</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-2.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-0.5">Cliente</p>
                  <p className="text-sm font-medium text-foreground">{ticket.organizations?.name || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-0.5">Aberto em</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(parseISO(ticket.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-0.5">Atualizado</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(parseISO(ticket.updated_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Alterar Status</p>
            </div>
            <div className="p-3 space-y-1">
              {(['aberto', 'em_analise', 'aguardando_info', 'resolvido', 'fechado'] as TicketStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => atualizarStatus.mutateAsync({ ticketId, status: s })}
                  disabled={ticket.status === s || atualizarStatus.isPending}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left',
                    ticket.status === s
                      ? cn(STATUS_COLORS[s], 'font-bold')
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <span className={cn('flex items-center', ticket.status === s ? '' : 'text-muted-foreground/50')}>
                    {STATUS_ICONS[s]}
                  </span>
                  {STATUS_LABELS[s]}
                  {ticket.status === s && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider opacity-50">Atual</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox de anexos — Portal para escapar de stacking contexts do layout */}
      {previewMidia && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setPreviewMidia(null)}
        >
          <div
            className="relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Botões flutuantes sobre a imagem */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <a
                href={previewMidia.url}
                download={previewMidia.nome}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </a>
              <button
                onClick={() => setPreviewMidia(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo */}
            {previewMidia.tipo === 'image' ? (
              <img
                src={previewMidia.url}
                alt={previewMidia.nome}
                className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
              />
            ) : (
              <div className="bg-background rounded-xl overflow-hidden shadow-2xl flex flex-col" style={{ height: '80vh', width: '80vw' }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/[0.03] shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground truncate">{previewMidia.nome}</span>
                </div>
                <iframe
                  src={previewMidia.url}
                  className="flex-1 w-full"
                  title={previewMidia.nome}
                />
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
}

// ── Kanban Card ────────────────────────────────────────────────────────────

function KanbanCard({ ticket, onClick }: { ticket: any; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border/60 bg-card p-3 cursor-grab active:cursor-grabbing shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-all select-none',
        isDragging && 'opacity-40 shadow-none'
      )}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORIDADE_DOT[ticket.prioridade as TicketPrioridade])} />
        <span className="text-[10px] font-mono text-muted-foreground/40">#{ticket.numero_ticket}</span>
        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ml-auto', CATEGORIA_COLORS[ticket.categoria as TicketCategoria])}>
          {CATEGORIA_ICONS[ticket.categoria as TicketCategoria]}
          {CATEGORIA_LABELS[ticket.categoria as TicketCategoria]}
        </span>
      </div>
      <p className="text-xs font-semibold text-foreground leading-snug mb-2">{ticket.titulo}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <Building2 className="h-3 w-3 text-muted-foreground/30 shrink-0" />
          <span className="text-[10px] text-muted-foreground/60 truncate">{ticket.organizations?.name || '—'}</span>
        </div>
        <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
          {format(parseISO(ticket.created_at), 'dd/MM HH:mm')}
        </span>
      </div>
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────────────

function KanbanColumn({
  status, color, tickets, onCardClick,
}: {
  status: TicketStatus;
  color: string;
  tickets: any[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[260px] w-[260px]">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', color)} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          {STATUS_LABELS[status]}
        </span>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground/40 bg-muted/50 rounded-full px-2 py-0.5">
          {tickets.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[400px] rounded-xl border-2 border-dashed transition-all p-2 space-y-2',
          isOver
            ? 'border-foreground/30 bg-muted/40'
            : 'border-border/40 bg-muted/[0.02]'
        )}
      >
        {tickets.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-center">
            <p className="text-[10px] text-muted-foreground/30">Nenhum ticket</p>
          </div>
        ) : (
          tickets.map(ticket => (
            <KanbanCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onCardClick(ticket.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Kanban Board ───────────────────────────────────────────────────────────

function KanbanBoard({ tickets, onCardClick }: { tickets: any[]; onCardClick: (id: string) => void }) {
  const atualizarStatus = useAdminAtualizarStatus();
  const [activeTicket, setActiveTicket] = useState<any>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: any) => {
    const ticket = tickets.find(t => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;
    const ticketId = active.id as string;
    const newStatus = over.id as TicketStatus;
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket && ticket.status !== newStatus) {
      atualizarStatus.mutate({ ticketId, status: newStatus });
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {KANBAN_COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            status={col.id}
            color={col.color}
            tickets={tickets.filter(t => t.status === col.id)}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket && (
          <div className="rounded-xl border border-border/60 bg-card p-3 shadow-xl opacity-95 w-[260px]">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={cn('h-2 w-2 rounded-full', PRIORIDADE_DOT[activeTicket.prioridade as TicketPrioridade])} />
              <span className="text-[10px] font-mono text-muted-foreground/40">#{activeTicket.numero_ticket}</span>
            </div>
            <p className="text-xs font-semibold text-foreground">{activeTicket.titulo}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Lista Row ──────────────────────────────────────────────────────────────

function TicketListRow({ ticket, onClick }: { ticket: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left border-b border-border/30 last:border-0 group"
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORIDADE_DOT[ticket.prioridade as TicketPrioridade])} />
      <span className="text-[11px] font-mono text-muted-foreground/40 shrink-0 w-14">#{ticket.numero_ticket}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold', STATUS_COLORS[ticket.status as TicketStatus])}>
            {STATUS_LABELS[ticket.status as TicketStatus]}
          </span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold', CATEGORIA_COLORS[ticket.categoria as TicketCategoria])}>
            {CATEGORIA_LABELS[ticket.categoria as TicketCategoria]}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground truncate">{ticket.titulo}</p>
      </div>
      <div className="hidden md:flex items-center gap-1.5 shrink-0 w-44">
        <Building2 className="h-3 w-3 text-muted-foreground/30 shrink-0" />
        <span className="text-xs text-muted-foreground/60 truncate">{ticket.organizations?.name || '—'}</span>
      </div>
      <div className="shrink-0 text-right w-24">
        <p className="text-[11px] text-muted-foreground/60">{format(parseISO(ticket.created_at), "d MMM yyyy", { locale: ptBR })}</p>
        <p className="text-[10px] text-muted-foreground/40">{format(parseISO(ticket.created_at), "HH:mm")}</p>
      </div>
    </button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function TabSuporte() {
  const [view, setView] = useState<'lista' | 'kanban'>('kanban');
  const [filtroStatus, setFiltroStatus] = useState<TicketStatus | 'todos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<TicketCategoria | 'todos'>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<TicketPrioridade | 'todos'>('todos');
  const [filtroCliente, setFiltroCliente] = useState<string>('todos');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [busca, setBusca] = useState('');
  const [ticketSelecionado, setTicketSelecionado] = useState<string | null>(null);

  const { data: tickets, isLoading } = useAdminTickets({ status: filtroStatus, categoria: filtroCategoria, prioridade: filtroPrioridade });

  // Clientes únicos para o select
  const clientesUnicos = Array.from(
    new Map((tickets || [])
      .filter(t => t.organizations?.name)
      .map(t => [t.organization_id, t.organizations.name])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const ticketsFiltrados = (tickets || []).filter(t => {
    if (filtroCliente !== 'todos' && t.organization_id !== filtroCliente) return false;
    if (dateRange?.from) {
      const criado = parseISO(t.created_at);
      if (criado < startOfDay(dateRange.from)) return false;
      if (dateRange.to && criado > endOfDay(dateRange.to)) return false;
    }
    if (!busca) return true;
    return (
      t.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      String(t.numero_ticket).includes(busca) ||
      t.organizations?.name?.toLowerCase().includes(busca.toLowerCase())
    );
  });

  if (ticketSelecionado) {
    return <AdminTicketDetalhe ticketId={ticketSelecionado} onBack={() => setTicketSelecionado(null)} />;
  }

  const total     = tickets?.length || 0;
  const abertos   = tickets?.filter(t => t.status === 'aberto').length || 0;
  const emAnalise = tickets?.filter(t => t.status === 'em_analise').length || 0;
  const criticos  = tickets?.filter(t => t.prioridade === 'critica' && !['resolvido','fechado'].includes(t.status)).length || 0;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <LifeBuoy className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Central de Suporte</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Gerencie todas as solicitações dos clientes</p>
        </div>

        {/* Toggle lista / kanban */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setView('lista')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              view === 'lista' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              view === 'kanban' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total de Tickets', value: total,     icon: FileText,    color: 'text-muted-foreground' },
          { label: 'Abertos',          value: abertos,   icon: AlertCircle, color: 'text-blue-500' },
          { label: 'Em Análise',       value: emAnalise, icon: RefreshCw,   color: 'text-violet-500' },
          { label: 'Críticos Abertos', value: criticos,  icon: TrendingUp,  color: 'text-red-500' },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className={cn('h-3.5 w-3.5', m.color)} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{m.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground font-display tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Filtros</p>
          </div>
        </div>
        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por título, nº ou cliente..."
              className="pl-9 h-10 text-sm rounded-lg border-border/60"
            />
          </div>
          <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v as any)}>
            <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="aguardando_info">Aguardando Info</SelectItem>
              <SelectItem value="resolvido">Resolvido</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={v => setFiltroCategoria(v as any)}>
            <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas categorias</SelectItem>
              <SelectItem value="bug">Bug / Erro</SelectItem>
              <SelectItem value="melhoria">Melhoria</SelectItem>
              <SelectItem value="duvida">Dúvida</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroPrioridade} onValueChange={v => setFiltroPrioridade(v as any)}>
            <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 w-[140px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCliente} onValueChange={setFiltroCliente}>
            <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 w-[180px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientesUnicos.map(([orgId, nome]) => (
                <SelectItem key={orgId} value={orgId}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-auto">
            <DateRangePicker
              date={dateRange}
              setDate={setDateRange}
              placeholder="Filtrar por período"
            />
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      {isLoading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard tickets={ticketsFiltrados} onCardClick={setTicketSelecionado} />
      ) : ticketsFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <LifeBuoy className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum ticket encontrado</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="space-y-4">
            {KANBAN_COLUMNS.map(col => {
              const grupo = ticketsFiltrados.filter(t => t.status === col.id);
              if (grupo.length === 0) return null;
              return (
                <div key={col.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                  {/* Cabeçalho do grupo */}
                  <div className="px-5 py-3 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2.5">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', col.color)} />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
                      {STATUS_LABELS[col.id]}
                    </span>
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground/40 bg-muted/60 rounded-full px-2 py-0.5">
                      {grupo.length}
                    </span>
                  </div>
                  {/* Sub-header colunas */}
                  <div className="px-5 py-2 border-b border-border/20 bg-muted/[0.01] hidden md:flex items-center gap-4">
                    <span className="w-2 shrink-0" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 w-14">Nº</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 flex-1">Título</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 w-44">Cliente</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 w-24 text-right">Data / Hora</span>
                  </div>
                  {grupo.map(ticket => (
                    <TicketListRow key={ticket.id} ticket={ticket} onClick={() => setTicketSelecionado(ticket.id)} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
