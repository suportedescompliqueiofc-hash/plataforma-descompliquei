import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LifeBuoy, Plus, X, ChevronRight, ChevronLeft, Upload, Image, Video,
  Clock, CheckCircle2, AlertCircle, MessageSquare, Paperclip, Send,
  ArrowUpCircle, Bug, Lightbulb, HelpCircle, MoreHorizontal, Loader2,
  FileText, Eye, RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import {
  useTickets,
  useTicketDetalhe,
  useCriarTicket,
  useResponderTicket,
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
  aberto: <AlertCircle className="h-3 w-3" />,
  em_analise: <RefreshCw className="h-3 w-3" />,
  aguardando_info: <Clock className="h-3 w-3" />,
  resolvido: <CheckCircle2 className="h-3 w-3" />,
  fechado: <CheckCircle2 className="h-3 w-3" />,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Upload Zone ────────────────────────────────────────────────────────────

function UploadZone({ files, onAdd, onRemove }: {
  files: File[];
  onAdd: (f: File[]) => void;
  onRemove: (i: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (dropped.length) onAdd(dropped);
  }, [onAdd]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => ref.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all',
          dragging
            ? 'border-foreground/40 bg-muted/40'
            : 'border-border/50 hover:border-foreground/20 hover:bg-muted/20'
        )}
      >
        <div className="p-2.5 rounded-lg bg-muted">
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Arraste arquivos ou clique para selecionar</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Imagens (JPG, PNG, WebP, GIF) e vídeos (MP4, MOV, WebM) · máx 100 MB cada</p>
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={e => {
            const picked = Array.from(e.target.files || []);
            if (picked.length) onAdd(picked);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 group">
              <div className="p-1.5 rounded bg-muted shrink-0">
                {f.type.startsWith('video/') ? (
                  <Video className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Image className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Novo Ticket Modal ──────────────────────────────────────────────────────

function NovoTicketModal({ onClose }: { onClose: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<TicketCategoria>('bug');
  const [prioridade, setPrioridade] = useState<TicketPrioridade>('media');
  const [descricao, setDescricao] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const criarTicket = useCriarTicket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descricao.trim()) return;
    await criarTicket.mutateAsync({ titulo, categoria, prioridade, descricao, arquivos });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <LifeBuoy className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nova Solicitação</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Descreva o problema ou melhoria desejada</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Título da solicitação
              </Label>
              <Input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Botão de agendamento não está funcionando"
                className="h-10 text-sm rounded-lg border-border/60"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Categoria
                </Label>
                <Select value={categoria} onValueChange={v => setCategoria(v as TicketCategoria)}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug / Erro</SelectItem>
                    <SelectItem value="melhoria">Melhoria</SelectItem>
                    <SelectItem value="duvida">Dúvida</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Prioridade
                </Label>
                <Select value={prioridade} onValueChange={v => setPrioridade(v as TicketPrioridade)}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Descrição detalhada
              </Label>
              <Textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva o que está acontecendo, quando ocorre, quais passos você seguiu, e qualquer outra informação relevante..."
                className="min-h-[120px] text-sm rounded-lg border-border/60 resize-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Anexos <span className="text-muted-foreground/40 normal-case font-normal">(opcional)</span>
              </Label>
              <UploadZone
                files={arquivos}
                onAdd={f => setArquivos(prev => [...prev, ...f])}
                onRemove={i => setArquivos(prev => prev.filter((_, idx) => idx !== i))}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/40 bg-muted/20 shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-9 rounded-lg text-xs font-medium text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criarTicket.isPending || !titulo.trim() || !descricao.trim()}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            >
              {criarTicket.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Abrir Ticket</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detalhe do Ticket ──────────────────────────────────────────────────────

function TicketDetalhe({ ticketId, orgId, onBack }: { ticketId: string; orgId: string; onBack: () => void }) {
  const { data: ticket, isLoading } = useTicketDetalhe(ticketId);
  const responder = useResponderTicket();
  const [resposta, setResposta] = useState('');

  const handleResponder = async () => {
    if (!resposta.trim()) return;
    await responder.mutateAsync({ ticketId, conteudo: resposta, orgId });
    setResposta('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) return null;

  const isFechado = ticket.status === 'fechado' || ticket.status === 'resolvido';

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div className="h-4 w-px bg-border/60" />
        <span className="text-[11px] text-muted-foreground/60">Ticket #{ticket.numero_ticket}</span>
      </div>

      {/* Ticket card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground/40">#{ticket.numero_ticket}</span>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_COLORS[ticket.status as TicketStatus])}>
                  {STATUS_ICONS[ticket.status as TicketStatus]}
                  {STATUS_LABELS[ticket.status as TicketStatus]}
                </span>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', CATEGORIA_COLORS[ticket.categoria as TicketCategoria])}>
                  {CATEGORIA_ICONS[ticket.categoria as TicketCategoria]}
                  {CATEGORIA_LABELS[ticket.categoria as TicketCategoria]}
                </span>
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold', PRIORIDADE_COLORS[ticket.prioridade as TicketPrioridade])}>
                  {PRIORIDADE_LABELS[ticket.prioridade as TicketPrioridade]}
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground font-display">{ticket.titulo}</h3>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Aberto em {format(parseISO(ticket.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>

        {/* Thread */}
        <div className="divide-y divide-border/30">
          {ticket.mensagens?.map((msg: any) => (
            <div
              key={msg.id}
              className={cn(
                'px-5 py-4',
                msg.autor_tipo === 'admin' && 'bg-muted/[0.03]'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  msg.autor_tipo === 'admin'
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {msg.autor_tipo === 'admin' ? 'D' : (msg.autor_nome?.charAt(0) || 'C')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {msg.autor_tipo === 'admin' ? 'Equipe Descompliquei' : msg.autor_nome}
                    </span>
                    {msg.autor_tipo === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-foreground text-background uppercase tracking-wider">
                        Suporte
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/50">
                      {format(parseISO(msg.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mídias */}
        {ticket.midias && ticket.midias.length > 0 && (
          <div className="px-5 py-4 border-t border-border/40 bg-muted/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-1.5">
              <Paperclip className="h-3 w-3" /> Anexos ({ticket.midias.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {ticket.midias.map((midia: any) => (
                midia.tipo === 'image' ? (
                  <a key={midia.id} href={midia.url_publica} target="_blank" rel="noreferrer" className="group relative">
                    <img
                      src={midia.url_publica}
                      alt={midia.nome_arquivo}
                      className="h-20 w-20 object-cover rounded-lg border border-border/60 group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Eye className="h-4 w-4 text-white" />
                    </div>
                  </a>
                ) : (
                  <a key={midia.id} href={midia.url_publica} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <Video className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-foreground">{midia.nome_arquivo}</span>
                  </a>
                )
              ))}
            </div>
          </div>
        )}

        {/* Reply */}
        {!isFechado && (
          <div className="px-5 py-4 border-t border-border/40 bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2.5 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Adicionar mensagem
            </p>
            <div className="flex gap-2">
              <Textarea
                value={resposta}
                onChange={e => setResposta(e.target.value)}
                placeholder="Escreva uma atualização ou informação adicional..."
                className="min-h-[80px] text-sm rounded-lg border-border/60 resize-none flex-1"
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button
                onClick={handleResponder}
                disabled={!resposta.trim() || responder.isPending}
                className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
              >
                {responder.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="h-3 w-3" /> Enviar mensagem</>
                )}
              </Button>
            </div>
          </div>
        )}

        {isFechado && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/10 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-[11px] text-muted-foreground">
              Este ticket está {STATUS_LABELS[ticket.status as TicketStatus].toLowerCase()} e não aceita mais mensagens.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lista de Tickets ───────────────────────────────────────────────────────

function TicketRow({ ticket, onClick }: { ticket: any; onClick: () => void }) {
  const categoriaColor = CATEGORIA_COLORS[ticket.categoria as TicketCategoria] ?? CATEGORIA_COLORS['outro'];
  const statusColor = STATUS_COLORS[ticket.status as TicketStatus] ?? STATUS_COLORS['aberto'];
  const prioridadeColor = PRIORIDADE_COLORS[ticket.prioridade as TicketPrioridade] ?? PRIORIDADE_COLORS['media'];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left group"
    >
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
        {CATEGORIA_ICONS[ticket.categoria as TicketCategoria] ?? CATEGORIA_ICONS['outro']}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground/40 font-mono">#{ticket.numero_ticket}</span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold', statusColor)}>
            {STATUS_ICONS[ticket.status as TicketStatus]}
            {STATUS_LABELS[ticket.status as TicketStatus]}
          </span>
          <span className={cn('inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold', prioridadeColor)}>
            {PRIORIDADE_LABELS[ticket.prioridade as TicketPrioridade]}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground truncate">{ticket.titulo}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
          {format(parseISO(ticket.created_at), "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function SuporteTab() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id || '';
  const { data: tickets, isLoading } = useTickets();
  const [novoAberto, setNovoAberto] = useState(false);
  const [ticketSelecionado, setTicketSelecionado] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<TicketStatus | 'todos'>('todos');

  if (ticketSelecionado) {
    return (
      <TicketDetalhe
        ticketId={ticketSelecionado}
        orgId={orgId}
        onBack={() => setTicketSelecionado(null)}
      />
    );
  }

  const ticketsFiltrados = (tickets || []).filter(t =>
    filtroStatus === 'todos' || t.status === filtroStatus
  );

  const contagens = {
    todos: tickets?.length || 0,
    aberto: tickets?.filter(t => t.status === 'aberto').length || 0,
    em_analise: tickets?.filter(t => t.status === 'em_analise').length || 0,
    aguardando_info: tickets?.filter(t => t.status === 'aguardando_info').length || 0,
    resolvido: tickets?.filter(t => t.status === 'resolvido').length || 0,
    fechado: tickets?.filter(t => t.status === 'fechado').length || 0,
  };

  return (
    <>
      {novoAberto && <NovoTicketModal onClose={() => setNovoAberto(false)} />}

      <div className="space-y-5">
        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: contagens.todos, icon: FileText, color: 'text-muted-foreground' },
            { label: 'Abertos', value: contagens.aberto + contagens.em_analise, icon: AlertCircle, color: 'text-blue-500' },
            { label: 'Aguardando', value: contagens.aguardando_info, icon: Clock, color: 'text-amber-500' },
            { label: 'Resolvidos', value: contagens.resolvido + contagens.fechado, icon: CheckCircle2, color: 'text-emerald-500' },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={cn('h-3.5 w-3.5', m.color)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{m.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground font-display tabular-nums">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Card principal */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <LifeBuoy className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Minhas Solicitações</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Acompanhe o status dos seus tickets</p>
              </div>
            </div>
            <Button
              onClick={() => setNovoAberto(true)}
              className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Ticket
            </Button>
          </div>

          {/* Filtros de status */}
          <div className="px-5 py-3 border-b border-border/30 bg-muted/[0.02] flex gap-1 overflow-x-auto scrollbar-none">
            {([
              { value: 'todos', label: 'Todos' },
              { value: 'aberto', label: 'Abertos' },
              { value: 'em_analise', label: 'Em Análise' },
              { value: 'aguardando_info', label: 'Aguardando Info' },
              { value: 'resolvido', label: 'Resolvidos' },
              { value: 'fechado', label: 'Fechados' },
            ] as const).map(f => (
              <button
                key={f.value}
                onClick={() => setFiltroStatus(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0',
                  filtroStatus === f.value
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-60">
                  {f.value === 'todos' ? contagens.todos
                    : f.value === 'aberto' ? contagens.aberto
                    : f.value === 'em_analise' ? contagens.em_analise
                    : f.value === 'aguardando_info' ? contagens.aguardando_info
                    : f.value === 'resolvido' ? contagens.resolvido
                    : contagens.fechado}
                </span>
              </button>
            ))}
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : ticketsFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <LifeBuoy className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {filtroStatus === 'todos' ? 'Nenhuma solicitação ainda' : 'Nenhum ticket neste status'}
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                {filtroStatus === 'todos'
                  ? 'Abra um ticket para reportar problemas ou sugerir melhorias'
                  : 'Tente selecionar outro filtro'}
              </p>
              {filtroStatus === 'todos' && (
                <Button
                  onClick={() => setNovoAberto(true)}
                  variant="outline"
                  className="mt-4 h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Abrir primeiro ticket
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {ticketsFiltrados.map(ticket => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => setTicketSelecionado(ticket.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info footer */}
        <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-muted shrink-0 mt-0.5">
            <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-foreground">Como funciona o suporte?</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-relaxed">
              Ao abrir um ticket, nossa equipe recebe a solicitação e responde diretamente por aqui.
              Você pode acompanhar o status e enviar mensagens adicionais a qualquer momento.
              Prazo médio de resposta: <strong>até 48 horas úteis</strong>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
