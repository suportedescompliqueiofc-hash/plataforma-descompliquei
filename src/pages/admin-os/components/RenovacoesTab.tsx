import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Clock, ChevronDown,
  ChevronUp, BarChart3, Plus, Pencil, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { type CSClient, clientName } from '../types/cs';
import { CurrencyInput } from '@/components/CurrencyInput';

// ── Tipos ─────────────────────────────────────────────────────────────────

interface CSRenovacao {
  id: string;
  client_id: string;
  data_vencimento: string;
  status: string;
  valor_contrato: number | null;
  notas: string | null;
  updated_at: string;
}

export interface RenovacaoRow {
  client: CSClient;
  trialEndsAt: string | null;
  renovacao: CSRenovacao | null;
  daysUntil: number | null;
}

export type Urgency = 'expired' | 'urgente' | 'atencao' | 'ok' | 'futuro' | 'sem_data';

export const STATUS_LABELS: Record<string, string> = {
  em_acompanhamento: 'Em acompanhamento',
  retrospectiva_agendada: 'Retrospectiva agendada',
  proposta_enviada: 'Proposta enviada',
  confirmado: 'Confirmado',
  em_risco: 'Em risco',
};

export const STATUS_COLORS: Record<string, string> = {
  em_acompanhamento: 'text-muted-foreground bg-muted/60',
  retrospectiva_agendada: 'text-blue-700 bg-blue-50',
  proposta_enviada: 'text-amber-700 bg-amber-50',
  confirmado: 'text-emerald-700 bg-emerald-50',
  em_risco: 'text-red-700 bg-red-50',
};

export function getUrgency(daysUntil: number | null): Urgency {
  if (daysUntil === null) return 'sem_data';
  if (daysUntil < 0) return 'expired';
  if (daysUntil <= 15) return 'urgente';
  if (daysUntil <= 30) return 'atencao';
  if (daysUntil <= 60) return 'ok';
  return 'futuro';
}

export const URGENCY_BADGE: Record<Urgency, string> = {
  expired: 'text-red-700 bg-red-50 border-red-200',
  urgente: 'text-red-700 bg-red-50 border-red-200',
  atencao: 'text-amber-700 bg-amber-50 border-amber-200',
  ok: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  futuro: 'text-muted-foreground bg-muted/40 border-border/40',
  sem_data: 'text-muted-foreground/50 bg-muted/20 border-border/20',
};

function getProximoPasso(status: string, daysUntil: number | null): string {
  if (status === 'confirmado') return 'Renovação confirmada — emitir novo contrato e registrar data de renovação.';
  if (status === 'em_risco') return 'Escalar para líder de CS imediatamente — definir plano de salvamento.';
  if (status === 'proposta_enviada') return 'Acompanhar decisão — tratar objeções e confirmar reunião de fechamento.';
  if (status === 'retrospectiva_agendada') return 'Preparar e apresentar proposta de renovação com novos objetivos e métricas de resultado.';
  // em_acompanhamento
  if (daysUntil === null) return 'Definir data de vencimento para ativar o acompanhamento.';
  if (daysUntil < 0) return 'Contrato vencido — contato urgente para extensão ou formalização do cancelamento.';
  if (daysUntil <= 30) return 'Apresentar proposta de renovação imediatamente — prazo crítico.';
  if (daysUntil <= 45) return 'Agendar reunião de retrospectiva esta semana — D-45 atingido.';
  if (daysUntil <= 60) return 'Agendar reunião de retrospectiva (meta: 45 dias antes do vencimento).';
  return 'Monitorar saúde — agendar retrospectiva quando restar 60 dias.';
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useRenovacoes(clients: CSClient[]) {
  return useQuery({
    queryKey: ['cs-renovacoes-pipeline', clients.map(c => c.id)],
    queryFn: async () => {
      if (clients.length === 0) return [];
      const orgIds = [...new Set(clients.map(c => c.organization_id))];
      const clientIds = clients.map(c => c.id);

      const [{ data: tenants }, { data: renovacoes }] = await Promise.all([
        supabase.from('platform_tenants').select('organization_id, trial_ends_at').in('organization_id', orgIds),
        supabase.from('cs_renovacoes').select('*').in('client_id', clientIds),
      ]);

      const trialMap: Record<string, string> = {};
      (tenants || []).forEach((t: any) => { if (t.trial_ends_at) trialMap[t.organization_id] = t.trial_ends_at; });
      const renovacaoMap: Record<string, CSRenovacao> = {};
      (renovacoes || []).forEach((r: any) => { renovacaoMap[r.client_id] = r; });

      const today = new Date();
      const rows: RenovacaoRow[] = clients.map(c => {
        const raw = renovacaoMap[c.id]?.data_vencimento || trialMap[c.organization_id] || null;
        const daysUntil = raw ? differenceInDays(new Date(raw), today) : null;
        return { client: c, trialEndsAt: raw, renovacao: renovacaoMap[c.id] ?? null, daysUntil };
      });

      // Sort: expired first, then by days ascending, clients without date last
      return rows.sort((a, b) => {
        if (a.daysUntil === null && b.daysUntil === null) return 0;
        if (a.daysUntil === null) return 1;
        if (b.daysUntil === null) return -1;
        return a.daysUntil - b.daysUntil;
      });
    },
    enabled: clients.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}

// ── EditRenovacaoModal ─────────────────────────────────────────────────────

export function EditRenovacaoModal({ row, onClose }: { row: RenovacaoRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(row.renovacao?.status ?? 'em_acompanhamento');
  const [dataVencimento, setDataVencimento] = useState(row.renovacao?.data_vencimento ?? row.trialEndsAt ?? '');
  const [valor, setValor] = useState<number | null>(row.renovacao?.valor_contrato ?? null);
  const [notas, setNotas] = useState(row.renovacao?.notas ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: row.client.id,
        data_vencimento: dataVencimento,
        status,
        valor_contrato: valor,
        notas: notas || null,
        updated_at: new Date().toISOString(),
      };
      if (row.renovacao) {
        const { error } = await supabase.from('cs_renovacoes').update(payload).eq('id', row.renovacao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cs_renovacoes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Renovação atualizada');
      qc.invalidateQueries({ queryKey: ['cs-renovacoes-pipeline'] });
      onClose();
    },
    onError: () => toast.error('Erro ao salvar renovação'),
  });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Renovação — {clientName(row.client)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data de vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor do contrato</Label>
            <CurrencyInput value={valor} onValueChange={v => setValor(v ?? null)} className="h-10 text-sm rounded-lg border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas e observações</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Objeções levantadas, decisores envolvidos, próximos passos..." rows={3} className="text-sm rounded-lg border-border/60 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
              disabled={!dataVencimento || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── RenovacaoCard ──────────────────────────────────────────────────────────

function RenovacaoCard({ row, onEdit }: { row: RenovacaoRow; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const urgency = getUrgency(row.daysUntil);
  const status = row.renovacao?.status ?? 'em_acompanhamento';
  const proximoPasso = getProximoPasso(status, row.daysUntil);

  const daysLabel = row.daysUntil === null
    ? 'Sem data'
    : row.daysUntil < 0
      ? `Vencido há ${Math.abs(row.daysUntil)}d`
      : row.daysUntil === 0
        ? 'Vence hoje'
        : `${row.daysUntil}d restantes`;

  return (
    <div className={cn(
      'rounded-2xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all',
      urgency === 'expired' || urgency === 'urgente' ? 'border-red-200/60' : 'border-border/60'
    )}>
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Urgency countdown */}
        <div className={cn('flex-shrink-0 text-center px-3 py-2 rounded-xl border min-w-[72px]', URGENCY_BADGE[urgency])}>
          <p className="text-lg font-bold tabular-nums leading-none">
            {row.daysUntil === null ? '—' : Math.abs(row.daysUntil)}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5">
            {row.daysUntil === null ? 'sem data' : row.daysUntil < 0 ? 'atraso' : 'dias'}
          </p>
        </div>

        {/* Client info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{clientName(row.client)}</p>
            <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded', STATUS_COLORS[status])}>
              {STATUS_LABELS[status]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {row.trialEndsAt && (
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                Vence {format(parseISO(row.trialEndsAt), "d 'de' MMM yyyy", { locale: ptBR })}
              </span>
            )}
            {row.renovacao?.valor_contrato && (
              <span className="text-[10px] font-semibold text-muted-foreground/70 tabular-nums">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.renovacao.valor_contrato)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-lg border-border/60" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: próximo passo + notas */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/[0.02]">
          <div className="px-5 py-3.5 space-y-3">
            <div className="flex items-start gap-2">
              <div className="p-1 rounded-lg bg-muted flex-shrink-0 mt-0.5">
                <AlertTriangle className="h-3 w-3 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Próximo passo</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{proximoPasso}</p>
              </div>
            </div>
            {row.renovacao?.notas && (
              <div className="flex items-start gap-2">
                <div className="p-1 rounded-lg bg-muted flex-shrink-0 mt-0.5">
                  <BarChart3 className="h-3 w-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Notas</p>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">{row.renovacao.notas}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const STATUS_ORDER = ['em_risco', 'em_acompanhamento', 'retrospectiva_agendada', 'proposta_enviada', 'confirmado'];

export function RenovacoesTab({ clients }: { clients: CSClient[] }) {
  const [editRow, setEditRow] = useState<RenovacaoRow | 'new' | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: rows = [], isLoading } = useRenovacoes(clients);

  const withDate = rows.filter(r => r.trialEndsAt !== null);
  const total = withDate.length;
  const confirmados = withDate.filter(r => r.renovacao?.status === 'confirmado').length;
  const emRisco = withDate.filter(r => r.renovacao?.status === 'em_risco').length;
  const vencendoEm30 = withDate.filter(r => r.daysUntil !== null && r.daysUntil >= 0 && r.daysUntil <= 30 && r.renovacao?.status !== 'confirmado').length;

  const filtered = rows.filter(r => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'sem_data') return r.trialEndsAt === null;
    const s = r.renovacao?.status ?? 'em_acompanhamento';
    return s === statusFilter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'No pipeline', value: total, icon: BarChart3 },
          { label: 'Confirmadas', value: confirmados, icon: CheckCircle2 },
          { label: 'Em risco', value: emRisco, icon: AlertTriangle },
          { label: 'Vencem em 30d', value: vencendoEm30, icon: Clock },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 rounded-lg bg-muted"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{m.label}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums font-display">{m.value}</p>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="bg-muted/40 rounded-xl p-1 flex gap-0.5 flex-wrap flex-1">
          {[
            { v: 'all', l: `Todos (${total})` },
            { v: 'em_risco', l: `Em risco (${emRisco})` },
            { v: 'em_acompanhamento', l: 'Acompanhamento' },
            { v: 'retrospectiva_agendada', l: 'Retrospectiva' },
            { v: 'proposta_enviada', l: 'Proposta' },
            { v: 'confirmado', l: `Confirmados (${confirmados})` },
            { v: 'sem_data', l: `Sem data (${rows.filter(r => !r.trialEndsAt).length})` },
          ].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', statusFilter === v ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {l}
            </button>
          ))}
        </div>
        <Button
          className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5 flex-shrink-0"
          onClick={() => setEditRow('new')}
        >
          <Plus className="h-3.5 w-3.5" />Registrar renovação
        </Button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-border/60 bg-card">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><Calendar className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma renovação encontrada</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {rows.length === 0
              ? 'Configure datas de vencimento nos perfis dos clientes para ativar o pipeline'
              : 'Ajuste o filtro acima'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row, i) => (
            <RenovacaoCard key={row.client.id} row={row} onEdit={() => setEditRow(row)} />
          ))}
        </div>
      )}

      {/* Clientes sem data de vencimento */}
      {statusFilter === 'all' && rows.filter(r => !r.trialEndsAt).length > 0 && (
        <div className="rounded-2xl border border-dashed border-border/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40 bg-muted/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{rows.filter(r => !r.trialEndsAt).length} clientes sem data de vencimento cadastrada</p>
          </div>
          <div className="divide-y divide-border/30">
            {rows.filter(r => !r.trialEndsAt).map(row => (
              <div key={row.client.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground/60">{clientName(row.client)}</p>
                <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg border-border/60 px-2.5" onClick={() => setEditRow(row)}>
                  Configurar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editRow && editRow !== 'new' && (
        <EditRenovacaoModal row={editRow} onClose={() => setEditRow(null)} />
      )}
      {editRow === 'new' && (
        <EditRenovacaoModal
          row={{ client: clients[0], trialEndsAt: null, renovacao: null, daysUntil: null }}
          onClose={() => setEditRow(null)}
        />
      )}
    </div>
  );
}
