import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, EyeOff, X, ArrowLeft, ExternalLink, Bot, Loader2, Calendar, BadgeCheck, Tag, Info, Clock, Stethoscope, CreditCard, FileText, CheckCircle2, XCircle, AlertCircle, Send, MessageSquare, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LeadModal } from '@/components/leads/LeadModal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ActiveConversation } from '@/components/conversations/ActiveConversation';
import type { LeadsModalContext } from '@/contexts/DashboardLeadsModalContext';

interface Lead {
  id: string;
  nome?: string;
  telefone?: string;
  criado_em?: string;
  atualizado_em?: string;
  followup_gap_motivo?: string;
  horasSemContato?: number;
  followup_tentativas?: number;
  followup_ultima_tentativa?: string | null;
  followup_pausado?: boolean | null;
}

interface DashboardLeadsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  leads: Lead[];
  context?: LeadsModalContext;
}

interface FollowupEvent {
  id: string;
  tentativa: number;
  status: string;
  mensagem_enviada: string | null;
  motivo_ia: string | null;
  enviado_em: string;
  tipo: string | null;
}

const FOLLOWUP_EVENT_META: Record<string, { label: string; icon: React.ElementType; dot: string }> = {
  enviado:        { label: 'Follow-up enviado', icon: Send,          dot: 'bg-green-500' },
  lead_respondeu: { label: 'Lead respondeu',    icon: MessageSquare, dot: 'bg-emerald-500' },
  ignorado_ia:    { label: 'IA ignorou',        icon: Bot,           dot: 'bg-blue-400' },
  fora_horario:   { label: 'Fora do horário',   icon: Clock,         dot: 'bg-amber-500' },
  erro:           { label: 'Erro no envio',     icon: XCircle,       dot: 'bg-red-500' },
};

export function DashboardLeadsModal({ open, onClose, title, leads, context }: DashboardLeadsModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [viewingDetail, setViewingDetail] = useState<Lead | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [activatingFollow, setActivatingFollow] = useState<string | null>(null);

  // Contexto explícito (via prop) tem prioridade; senão, infere pelo título.
  // "Fechados com/sem Agendamento" contém "agendad" — checar "fechad" primeiro
  const contextType: 'agendamento' | 'venda' | 'qualificacao' | 'followup' | null =
    context ??
    (/fechad|venda/i.test(title) ? 'venda' :
    /agendad/i.test(title) ? 'agendamento' :
    /qualificad|mql/i.test(title) ? 'qualificacao' :
    null);

  const isFollowup = contextType === 'followup';

  const leadIds = leads.map(l => l.id);

  const { data: agendamentosMap } = useQuery({
    queryKey: ['modal-enrich-agend', leadIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('lead_id, tipo, data_hora_inicio, valor_orcado, procedimento_interesse, status')
        .in('lead_id', leadIds)
        .neq('status', 'cancelado')
        .order('data_hora_inicio', { ascending: false });
      const map = new Map<string, any>();
      for (const a of data ?? []) {
        if (!map.has(a.lead_id)) map.set(a.lead_id, a);
      }
      return map;
    },
    enabled: open && contextType === 'agendamento' && leadIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const { data: vendasMap } = useQuery({
    queryKey: ['modal-enrich-vendas', leadIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendas')
        .select('lead_id, produto_servico, valor_fechado, data_fechamento')
        .in('lead_id', leadIds)
        .order('data_fechamento', { ascending: false });
      const map = new Map<string, any>();
      for (const v of data ?? []) {
        if (!map.has(v.lead_id)) map.set(v.lead_id, v);
      }
      return map;
    },
    enabled: open && contextType === 'venda' && leadIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Enriquecimento da LISTA no contexto follow-up — resumo por lead (como agendamentosMap)
  const { data: followupMap } = useQuery({
    queryKey: ['modal-enrich-followup', leadIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('ia_followup_log')
        .select('lead_id, status, tentativa, enviado_em')
        .in('lead_id', leadIds)
        .order('enviado_em', { ascending: true });
      const map = new Map<string, { enviados: number; ultimo: string | null; respondeu: boolean; maxTentativa: number }>();
      for (const f of data ?? []) {
        const cur = map.get(f.lead_id) ?? { enviados: 0, ultimo: null, respondeu: false, maxTentativa: 0 };
        if (f.status === 'enviado') {
          cur.enviados += 1;
          cur.ultimo = f.enviado_em;
          cur.maxTentativa = Math.max(cur.maxTentativa, f.tentativa ?? 0);
        }
        if (f.status === 'lead_respondeu') cur.respondeu = true;
        map.set(f.lead_id, cur);
      }
      return map;
    },
    enabled: open && isFollowup && leadIds.length > 0,
    staleTime: 60 * 1000,
  });

  const { data: agendamentoDetalhe } = useQuery({
    queryKey: ['modal-detail-agend', viewingDetail?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('lead_id', viewingDetail!.id)
        .neq('status', 'cancelado')
        .order('data_hora_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!viewingDetail && contextType === 'agendamento',
  });

  const { data: statusHistory } = useQuery({
    queryKey: ['modal-detail-agend-history', agendamentoDetalhe?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamento_status_history')
        .select('status_anterior, status_novo, alterado_em')
        .eq('agendamento_id', agendamentoDetalhe!.id)
        .order('alterado_em', { ascending: true });
      return data ?? [];
    },
    enabled: !!agendamentoDetalhe?.id,
  });

  const { data: vendaDetalhe } = useQuery({
    queryKey: ['modal-detail-venda', viewingDetail?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendas')
        .select('*')
        .eq('lead_id', viewingDetail!.id)
        .order('data_fechamento', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!viewingDetail && contextType === 'venda',
  });

  // Timeline de follow-ups do lead — cada disparo (enviado/respondeu/ignorado/erro)
  const { data: followupTimeline } = useQuery({
    queryKey: ['modal-detail-followup', viewingDetail?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('ia_followup_log')
        .select('id, tentativa, status, mensagem_enviada, motivo_ia, enviado_em, tipo')
        .eq('lead_id', viewingDetail!.id)
        .order('enviado_em', { ascending: true });
      return data ?? [];
    },
    enabled: !!viewingDetail && isFollowup,
  });

  const statusTextColor: Record<string, string> = {
    agendado:   'text-blue-500',
    confirmado: 'text-green-500',
    realizado:  'text-teal-500',
    cancelado:  'text-red-500',
    faltou:     'text-amber-500',
  };

  const getInfoColor = (lead: Lead) => {
    if (contextType === 'agendamento') {
      const s = agendamentosMap?.get(lead.id)?.status;
      return s ? statusTextColor[s] ?? 'text-muted-foreground' : 'text-muted-foreground';
    }
    if (contextType === 'venda') return 'text-green-500';
    return 'text-muted-foreground';
  };

  const getEnrichmentChip = (lead: Lead) => {
    const agend = agendamentosMap?.get(lead.id);
    const venda = vendasMap?.get(lead.id);

    if (agend) {
      const chipColor: Record<string, string> = {
        agendado:   'bg-blue-500/10 border-blue-500/15 text-blue-600',
        confirmado: 'bg-green-500/10 border-green-500/15 text-green-600',
        realizado:  'bg-teal-500/10 border-teal-500/15 text-teal-600',
        cancelado:  'bg-red-500/10 border-red-500/15 text-red-600',
        faltou:     'bg-amber-500/10 border-amber-500/15 text-amber-600',
      };
      const chipCls = chipColor[agend.status] ?? chipColor.agendado;
      return (
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-semibold shrink-0", chipCls)}>
            <Calendar className="h-2.5 w-2.5" />
            {format(new Date(agend.data_hora_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </span>
          {(agend.procedimento_interesse || agend.tipo) && (
            <span className="text-[9px] text-muted-foreground truncate">
              {agend.procedimento_interesse || (agend.tipo === 'consulta' ? 'Consulta' : agend.tipo === 'procedimento' ? 'Procedimento' : agend.tipo)}
            </span>
          )}
          {agend.valor_orcado && (
            <span className="text-[9px] font-display text-muted-foreground/70 tabular-nums shrink-0">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(agend.valor_orcado)}
            </span>
          )}
        </div>
      );
    }

    if (venda) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/15 text-[9px] font-semibold text-green-600 shrink-0">
            <BadgeCheck className="h-2.5 w-2.5" />
            {venda.valor_fechado
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(venda.valor_fechado))
              : 'Venda'}
          </span>
          {venda.data_fechamento && (
            <span className="text-[9px] text-muted-foreground/70 shrink-0 tabular-nums">
              {format(new Date(venda.data_fechamento + 'T00:00:00'), "dd/MM/yy", { locale: ptBR })}
            </span>
          )}
          {venda.produto_servico && (
            <span className="text-[9px] text-muted-foreground truncate">{venda.produto_servico}</span>
          )}
        </div>
      );
    }

    if (contextType === 'qualificacao') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/15 text-[9px] font-semibold text-violet-600 mt-0.5">
          <Tag className="h-2.5 w-2.5" />
          MQL
        </span>
      );
    }

    if (isFollowup) {
      const agg = followupMap?.get(lead.id);
      const enviados = agg?.enviados ?? lead.followup_tentativas ?? 0;
      const ult = agg?.ultimo ?? lead.followup_ultima_tentativa ?? null;
      const respondeu = agg?.respondeu ?? false;
      const paused = lead.followup_pausado;
      if (enviados === 0 && !ult && !respondeu) return null;
      return (
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {enviados > 0 && (
            <span className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-semibold shrink-0",
              paused ? "bg-amber-500/10 border-amber-500/15 text-amber-600" : "bg-blue-500/10 border-blue-500/15 text-blue-600"
            )}>
              <Send className="h-2.5 w-2.5" />
              {enviados} follow{enviados === 1 ? '' : 's'}{paused ? ' · esgotado' : ''}
            </span>
          )}
          {respondeu && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-[9px] font-semibold text-emerald-600 shrink-0">
              <MessageSquare className="h-2.5 w-2.5" />
              respondeu
            </span>
          )}
          {ult && (
            <span className="text-[9px] text-muted-foreground/70 shrink-0">
              último {formatDistanceToNow(new Date(ult), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  const handleAtivarFollow = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setActivatingFollow(lead.id);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          followup_manual: true,
          followup_tentativas: 0,
          followup_ultima_tentativa: null,
          followup_pausado: false,
        })
        .eq('id', lead.id);
      if (error) throw error;
      toast.success(`Follow-up IA ativado para ${lead.nome || 'lead'}`);
      queryClient.invalidateQueries({ queryKey: ['followup-gap'] });
    } catch (err: any) {
      toast.error('Erro ao ativar follow-up: ' + (err.message || String(err)));
    } finally {
      setActivatingFollow(null);
    }
  };

  // Deriva a lista local excluindo IDs removidos — sem sync logic quebrada
  const localLeads = leads.filter(l => !removedIds.has(l.id));

  const sortedLeads = [...localLeads].sort((a, b) => {
    // Se ambos têm horasSemContato, ordenar do menor para o maior
    if (a.horasSemContato != null && b.horasSemContato != null) {
      return a.horasSemContato - b.horasSemContato;
    }
    // Fallback: mais recente primeiro
    const dateA = a.atualizado_em || a.criado_em || a.followup_ultima_tentativa || '';
    const dateB = b.atualizado_em || b.criado_em || b.followup_ultima_tentativa || '';
    return dateB.localeCompare(dateA);
  });

  const getInitials = (nome?: string) => {
    if (!nome) return '?';
    return nome.trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const handleVerConversa = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setViewingDetail(null);
    setViewingLead(lead);
  };

  const handleVerDetalhe = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setViewingLead(null);
    setViewingDetail(lead);
  };

  const handleSairConversa = () => { setViewingLead(null); setViewingDetail(null); };

  const handleClose = () => {
    setViewingLead(null);
    setViewingDetail(null);
    onClose();
  };

  const handleTirarMetricas = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setRemoving(lead.id);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ excluir_metricas: true })
        .eq('id', lead.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast.success(`${lead.nome || 'Lead'} removido das métricas`);
      setRemovedIds(prev => new Set([...prev, lead.id]));
      if (viewingLead?.id === lead.id) setViewingLead(null);
    } catch (err: any) {
      toast.error('Erro ao remover das métricas: ' + (err.message || String(err)));
    } finally {
      setRemoving(null);
    }
  };

  // ── Lead list rows (shared) ──────────────────────────────────────────────
  const leadRows = (
    <div className="flex-1 overflow-y-auto divide-y divide-border/40">
      {sortedLeads.map(lead => (
        <div
          key={lead.id}
          className={cn(
            "flex items-center gap-2.5 py-2.5 px-4 hover:bg-muted/30 transition-colors cursor-pointer",
            viewingLead?.id === lead.id && "bg-primary/5 border-l-2 border-l-primary"
          )}
          onClick={() => setSelectedLead(lead)}
        >
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-muted-foreground/30 flex-shrink-0">
            {getInitials(lead.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-medium truncate">{lead.nome || 'Sem nome'}</p>
              {lead.horasSemContato != null && lead.horasSemContato > 0 && (
                <span className="text-[9px] font-display tabular-nums font-semibold text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5 shrink-0">
                  {lead.horasSemContato < 24 ? `${lead.horasSemContato}h` : `${Math.floor(lead.horasSemContato / 24)}d ${lead.horasSemContato % 24}h`}
                </span>
              )}
            </div>
            {getEnrichmentChip(lead)}
            {lead.followup_gap_motivo ? (
              <p className="text-[10px] text-muted-foreground truncate">
                {lead.followup_gap_motivo}
              </p>
            ) : (lead.atualizado_em || lead.criado_em) ? (
              <p className="text-[10px] text-muted-foreground truncate font-display tabular-nums">
                {format(new Date(lead.atualizado_em || lead.criado_em!), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </p>
            ) : lead.telefone ? (
              <p className="text-[10px] text-muted-foreground truncate font-display tabular-nums">{lead.telefone}</p>
            ) : null}
            {lead.criado_em && (
              <p className="text-[10px] text-muted-foreground/50 truncate font-display tabular-nums">
                Cad. {format(new Date(lead.criado_em), "dd/MM/yy", { locale: ptBR })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              disabled={removing === lead.id}
              onClick={(e) => handleTirarMetricas(e, lead)}
              title="Tirar das métricas"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
            {(contextType === 'agendamento' || contextType === 'venda' || isFollowup) && (
              <Button
                size="sm" variant="ghost"
                className={cn("h-7 w-7 p-0", getInfoColor(lead))}
                onClick={(e) => handleVerDetalhe(e, lead)}
                title="Ver detalhes"
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="sm" variant="ghost"
              className={cn("h-7 w-7 p-0", viewingLead?.id === lead.id ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              onClick={(e) => handleVerConversa(e, lead)}
              title="Ver conversa"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Detail panel content ─────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; icon: React.ElementType; color: string }> = {
      agendado:   { label: 'Agendado',   icon: Calendar,     color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
      confirmado: { label: 'Confirmado', icon: CheckCircle2, color: 'text-green-600 bg-green-500/10 border-green-500/20' },
      realizado:  { label: 'Realizado',  icon: CheckCircle2, color: 'text-teal-600 bg-teal-500/10 border-teal-500/20' },
      cancelado:  { label: 'Cancelado',  icon: XCircle,      color: 'text-red-600 bg-red-500/10 border-red-500/20' },
      faltou:     { label: 'Faltou',     icon: AlertCircle,  color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    };
    const s = map[status] ?? { label: status, icon: Calendar, color: 'text-muted-foreground bg-muted border-border/40' };
    const Icon = s.icon;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', s.color)}>
        <Icon className="h-3 w-3" />{s.label}
      </span>
    );
  };

  const statusLabel = (s: string) => {
    const m: Record<string, string> = {
      agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado',
      cancelado: 'Cancelado', faltou: 'Faltou',
    };
    return m[s] ?? s;
  };

  const statusDot: Record<string, string> = {
    agendado: 'bg-blue-500', confirmado: 'bg-green-500',
    realizado: 'bg-teal-500', cancelado: 'bg-red-500', faltou: 'bg-amber-500',
  };

  const TimelineEvent = ({ status, label, date, isFirst, isCurrent }: {
    status: string; label: string; date: string; isFirst?: boolean; isCurrent?: boolean;
  }) => (
    <div className="relative flex items-start gap-3 pb-3 last:pb-0">
      <div className={cn(
        'relative z-10 h-[22px] w-[22px] rounded-full border-2 border-background flex items-center justify-center shrink-0',
        statusDot[status] ?? 'bg-muted-foreground/30'
      )}>
        {isCurrent && <div className="h-2 w-2 rounded-full bg-white/80 animate-pulse" />}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={cn('text-[12px] font-semibold', isFirst ? 'text-muted-foreground' : 'text-foreground')}>{label}</p>
        <p className="text-[10px] text-muted-foreground/60 font-mono">{date}</p>
      </div>
    </div>
  );

  const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
        <div className="h-6 w-6 rounded-md bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">{label}</p>
          <p className="text-[12px] text-foreground mt-0.5">{value}</p>
        </div>
      </div>
    );
  };

  const detailPanelContent = viewingDetail && (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {contextType === 'agendamento' && (
        agendamentoDetalhe ? (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Detalhes do Agendamento</div>
            <div className="mb-2">{statusBadge(agendamentoDetalhe.status)}</div>
            <DetailRow icon={Calendar}     label="Data e Hora"     value={format(new Date(agendamentoDetalhe.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} />
            <DetailRow icon={Clock}        label="Duração"         value={agendamentoDetalhe.duracao_minutos ? `${agendamentoDetalhe.duracao_minutos} minutos` : null} />
            <DetailRow icon={Stethoscope}  label="Tipo"            value={agendamentoDetalhe.tipo === 'consulta' ? 'Consulta' : agendamentoDetalhe.tipo === 'procedimento' ? 'Procedimento' : agendamentoDetalhe.tipo} />
            <DetailRow icon={FileText}     label="Procedimento"    value={agendamentoDetalhe.procedimento_interesse} />
            <DetailRow icon={BadgeCheck}   label="Valor Orçado"    value={agendamentoDetalhe.valor_orcado ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(agendamentoDetalhe.valor_orcado) : null} />
            <DetailRow icon={FileText}     label="Observações"     value={agendamentoDetalhe.observacoes} />

            {/* Linha do tempo de status */}
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Linha do Tempo</p>
              <div className="relative">
                {/* Linha vertical */}
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border/40" />

                {/* Evento inicial — criação */}
                <TimelineEvent
                  status="agendado"
                  label="Agendado"
                  date={format(new Date(agendamentoDetalhe.criado_em ?? agendamentoDetalhe.created_at ?? ''), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  isFirst
                />

                {/* Mudanças de status registradas */}
                {statusHistory && statusHistory.map((h: { status_anterior: string; status_novo: string; alterado_em: string }, i: number) => (
                  <TimelineEvent
                    key={i}
                    status={h.status_novo}
                    label={statusLabel(h.status_novo)}
                    date={format(new Date(h.alterado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  />
                ))}

                {/* Status atual sem histórico registrado — usa atualizado_em */}
                {(!statusHistory || statusHistory.length === 0) && agendamentoDetalhe.status !== 'agendado' && (
                  <TimelineEvent
                    status={agendamentoDetalhe.status}
                    label={statusLabel(agendamentoDetalhe.status)}
                    date={
                      agendamentoDetalhe.atualizado_em
                        ? format(new Date(agendamentoDetalhe.atualizado_em), "dd/MM 'às' HH:mm", { locale: ptBR })
                        : agendamentoDetalhe.updated_at
                        ? format(new Date(agendamentoDetalhe.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                        : '—'
                    }
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3"><Calendar className="h-5 w-5 text-muted-foreground/40" /></div>
            <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado</p>
          </div>
        )
      )}
      {contextType === 'venda' && (
        vendaDetalhe ? (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Detalhes do Fechamento</div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border text-green-600 bg-green-500/10 border-green-500/20 mb-3">
              <CheckCircle2 className="h-3 w-3" />Fechado
            </span>
            <DetailRow icon={Calendar}     label="Data de Fechamento" value={vendaDetalhe.data_fechamento ? format(new Date(vendaDetalhe.data_fechamento + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR }) : null} />
            <DetailRow icon={BadgeCheck}   label="Valor Fechado"      value={vendaDetalhe.valor_fechado ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(vendaDetalhe.valor_fechado)) : null} />
            <DetailRow icon={Stethoscope}  label="Procedimento"       value={vendaDetalhe.produto_servico} />
            <DetailRow icon={CreditCard}   label="Forma de Pagamento" value={vendaDetalhe.forma_pagamento} />
            <DetailRow icon={FileText}     label="Observações"        value={vendaDetalhe.observacoes} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3"><BadgeCheck className="h-5 w-5 text-muted-foreground/40" /></div>
            <p className="text-sm text-muted-foreground">Nenhuma venda encontrada</p>
          </div>
        )
      )}
      {isFollowup && (
        followupTimeline && followupTimeline.length > 0 ? (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Histórico de Follow-up</div>
            <div className="relative">
              <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border/40" />
              {followupTimeline.map((f: FollowupEvent) => {
                const meta = FOLLOWUP_EVENT_META[f.status] ?? FOLLOWUP_EVENT_META.erro;
                const EvIcon = meta.icon;
                const detalhe = f.status === 'enviado' ? f.mensagem_enviada : f.motivo_ia;
                return (
                  <div key={f.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                    <div className={cn('relative z-10 h-[22px] w-[22px] rounded-full border-2 border-background flex items-center justify-center shrink-0', meta.dot)}>
                      <EvIcon className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] font-semibold text-foreground">{meta.label}</p>
                        {f.status !== 'lead_respondeu' && (
                          <span className="text-[9px] font-display font-bold tabular-nums text-muted-foreground bg-muted rounded px-1.5 py-0.5">T{f.tentativa}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 font-mono">
                        {format(new Date(f.enviado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {detalhe && (
                        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                          {f.status === 'enviado' ? `"${detalhe}"` : detalhe}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3"><Send className="h-5 w-5 text-muted-foreground/40" /></div>
            <p className="text-sm text-muted-foreground">Nenhum follow-up registrado</p>
          </div>
        )
      )}
    </div>
  );

  // ── Split card view (lista + conversa/detalhe lado a lado) ────────────────
  if (open && (viewingLead || viewingDetail)) {
    return (
      <>
        {/* Backdrop leve para fechar ao clicar fora */}
        <div className="fixed inset-0 z-40" onClick={handleClose} />

        {/* Dois cards lado a lado, flutuando sobre o painel */}
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex gap-3 items-start">

          {/* Card esquerdo — lista */}
          <div className="w-[300px] h-[78vh] bg-background rounded-2xl border border-border/60 shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1 shrink-0" onClick={handleSairConversa}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold truncate font-display">{title}</p>
                <p className="text-[10px] text-muted-foreground font-display tabular-nums">{localLeads.length} lead{localLeads.length !== 1 ? 's' : ''}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {localLeads.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-8 text-[13px] text-muted-foreground">Nenhum lead.</div>
            ) : leadRows}
          </div>

          {/* Card direito — conversa */}
          {viewingLead && (
          <div
            className="w-[520px] h-[78vh] bg-background rounded-2xl border border-border/60 shadow-xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Banner: lead + tirar das métricas */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-muted-foreground/30 shrink-0">
                {getInitials(viewingLead.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{viewingLead.nome || 'Sem nome'}</p>
                <p className="text-[10px] text-muted-foreground">{viewingLead.telefone || '—'}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {viewingLead.followup_gap_motivo && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                    disabled={activatingFollow === viewingLead.id}
                    onClick={(e) => handleAtivarFollow(e, viewingLead)}
                  >
                    {activatingFollow === viewingLead.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                    Follow IA
                  </Button>
                )}
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] gap-1.5 border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                  disabled={removing === viewingLead.id}
                  onClick={(e) => handleTirarMetricas(e, viewingLead)}
                >
                  <EyeOff className="h-3 w-3" />
                  Tirar das métricas
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] gap-1.5 border-border/60 text-muted-foreground hover:text-foreground"
                  onClick={() => { handleClose(); navigate(`/crm/conversas/${viewingLead.id}`); }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Ir para conversa
                </Button>
              </div>
            </div>

            {/* Resumo IA — só aparece quando há análise de follow-up */}
            {viewingLead.followup_gap_motivo && (
              <div className="px-4 py-2.5 border-b border-amber-500/20 bg-amber-500/[0.04] shrink-0">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    <div className="h-4 w-4 rounded-full bg-amber-500/15 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/70">Análise da IA</p>
                      {viewingLead.horasSemContato != null && viewingLead.horasSemContato > 0 && (
                        <span className="text-[9px] font-mono font-semibold text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5">
                          {viewingLead.horasSemContato < 24
                            ? `${viewingLead.horasSemContato}h sem resposta`
                            : `${Math.floor(viewingLead.horasSemContato / 24)}d ${viewingLead.horasSemContato % 24}h sem resposta`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-900/70 dark:text-amber-200/70 leading-snug">
                      {viewingLead.followup_gap_motivo}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conversa */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ActiveConversation leadId={viewingLead.id} compactMode />
            </div>
          </div>
          )}

          {/* Card direito — detalhes */}
          {viewingDetail && (
          <div
            className="w-[340px] h-[78vh] bg-background rounded-2xl border border-border/60 shadow-xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/40 bg-muted/20 shrink-0">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-muted-foreground/30 shrink-0">
                {getInitials(viewingDetail.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{viewingDetail.nome || 'Sem nome'}</p>
                <p className="text-[10px] text-muted-foreground">{viewingDetail.telefone || '—'}</p>
              </div>
              <Button
                size="sm" variant="outline"
                className="h-7 text-[11px] gap-1.5 border-border/60 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => { handleClose(); navigate(`/crm/conversas/${viewingDetail.id}`); }}
              >
                <ExternalLink className="h-3 w-3" />
                Conversa
              </Button>
            </div>
            {detailPanelContent}
          </div>
          )}
        </div>

        {selectedLead && (
          <LeadModal
            open={!!selectedLead}
            onOpenChange={(isOpen) => { if (!isOpen) setSelectedLead(null); }}
            lead={selectedLead}
            mode="view"
          />
        )}
      </>
    );
  }

  // ── Dialog normal (centralizado) ────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="flex flex-col p-0 gap-0 max-w-[520px] w-[520px] max-h-[80vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate font-display">{title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-display tabular-nums">{localLeads.length} lead{localLeads.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {localLeads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
              Nenhum lead neste segmento para o período selecionado.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {sortedLeads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 py-3 px-5 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-muted-foreground/30 flex-shrink-0">
                    {getInitials(lead.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium truncate">{lead.nome || 'Sem nome'}</p>
                      {lead.horasSemContato != null && lead.horasSemContato > 0 && (
                        <span className="text-[9px] font-display tabular-nums font-semibold text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5 shrink-0">
                          {lead.horasSemContato < 24 ? `${lead.horasSemContato}h` : `${Math.floor(lead.horasSemContato / 24)}d ${lead.horasSemContato % 24}h`}
                        </span>
                      )}
                    </div>
                    {getEnrichmentChip(lead)}
                    {lead.followup_gap_motivo ? (
                      <p className="text-[11px] text-muted-foreground truncate">{lead.followup_gap_motivo}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground truncate">{lead.telefone || '—'}</p>
                    )}
                  </div>
                  {(lead.atualizado_em || lead.criado_em) && (
                    <div className="text-right flex-shrink-0 mr-1">
                      <p className="text-[10px] text-muted-foreground font-display tabular-nums">
                        {format(new Date(lead.atualizado_em || lead.criado_em!), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {lead.criado_em && (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-display tabular-nums">
                          Cadastrado {format(new Date(lead.criado_em), "dd/MM/yy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm" variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      disabled={removing === lead.id}
                      onClick={(e) => handleTirarMetricas(e, lead)}
                      title="Tirar das métricas"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </Button>
                    {(contextType === 'agendamento' || contextType === 'venda' || isFollowup) && (
                      <Button
                        size="sm" variant="ghost"
                        className={cn("h-8 w-8 p-0", getInfoColor(lead))}
                        onClick={(e) => handleVerDetalhe(e, lead)}
                        title="Ver detalhes"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleVerConversa(e, lead)}
                      title="Ver conversa"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedLead && (
        <LeadModal
          open={!!selectedLead}
          onOpenChange={(isOpen) => { if (!isOpen) setSelectedLead(null); }}
          lead={selectedLead}
          mode="view"
        />
      )}
    </>
  );
}
