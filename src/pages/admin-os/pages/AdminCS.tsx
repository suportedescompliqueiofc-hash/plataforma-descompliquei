import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  HeartHandshake, Users,
  MessageCircle, BarChart3, Star, Phone, Mail, Video, Plus,
  Activity, Target, RefreshCw, Search, ChevronDown,
  TrendingUp, TrendingDown, DollarSign, Route, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlaybooksTab } from '../components/PlaybooksTab';
import { PainelTab } from '../components/PainelTab';
import { DocsTab } from '../components/DocsTab';
import { NpsTemplatesTab } from '../components/NpsTemplatesTab';
import { NpsDispatchTab } from '../components/NpsDispatchTab';
import { NpsResponseRow } from '../components/NpsResponseRow';
import { AthosCsChat } from '@/components/admin/AthosCsChat';
import { useCSCrmMetrics } from '@/hooks/useCSCrm';
import { useCsJornadasProgress, useCsJornadasOverview, type JornadaOverviewItem } from '@/hooks/useCsJornada';
import {
  type CSClient,
  type CSTouchpoint,
  type CSNPSResponse,
  FASE_LABELS, FASE_COLORS,
  TIPO_LABELS, RESULTADO_COLORS, RESULTADO_LABELS,
  npsCategory,
  clientName, effectiveHealthV2,
  growthBadge, formatBRLCompact, formatMinutes,
} from '../types/cs';

// ── Hooks ──────────────────────────────────────────────────────────────────

function useCSClients() {
  return useQuery({
    queryKey: ['cs-clients'],
    queryFn: async () => {
      // A agregação roda inteira server-side na RPC get_cs_clients (SECURITY
      // DEFINER). Isso evita a variação de RLS entre superadmins/admins e o
      // resíduo de org de impersonação, que faziam clientes sumir e o nome da
      // clínica ser substituído pelo nome de um membro.
      const { data: rows, error } = await supabase.rpc('get_cs_clients');
      if (error) throw error;

      const enriched: CSClient[] = (rows || []).map((r: any) => ({
        id: r.id,
        crm_user_id: r.crm_user_id ?? null,
        organization_id: r.organization_id,
        clinic_name: r.clinic_name ?? null,
        nome_completo: r.nome_completo ?? null,
        product_name: r.product_name ?? null,
        cs_fase: r.cs_fase ?? null,
        cs_fase_desde: r.cs_fase_desde ?? null,
        cs_health_status: r.cs_health_status ?? null,
        cs_ultimo_touchpoint: r.cs_ultimo_touchpoint ?? null,
        cs_proximo_touchpoint: r.cs_proximo_touchpoint ?? null,
        onboarding_concluido: r.onboarding_concluido ?? null,
        onboarding_complete: r.onboarding_complete ?? null,
        joined_at: r.joined_at ?? null,
        latest_health: null,
      }));

      const ids = enriched.map(c => c.id);
      const healthMap: Record<string, CSClient['latest_health']> = {};
      if (ids.length > 0) {
        const { data: scores } = await supabase
          .from('cs_health_scores')
          .select('client_id, score_total, status_calculado, avaliado_em, dim_ativacao, dim_jornada, dim_arsenal, dim_crm, dim_responsividade')
          .in('client_id', ids)
          .order('avaliado_em', { ascending: false });
        (scores || []).forEach((s: any) => { if (!healthMap[s.client_id]) healthMap[s.client_id] = s; });
      }

      return enriched.map(c => ({ ...c, latest_health: healthMap[c.id] || null }));
    },
    staleTime: 2 * 60 * 1000,
  });
}

function useCSTouchpoints(limit = 100) {
  return useQuery({
    queryKey: ['cs-touchpoints', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_touchpoints')
        .select('*, platform_users(clinic_name, nome_completo)')
        .order('data_contato', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as CSTouchpoint[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

function useCSNPS() {
  return useQuery({
    queryKey: ['cs-nps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_nps_responses')
        .select('*, platform_users(clinic_name, nome_completo), cs_nps_campanhas(id, cs_nps_templates(nome))')
        .order('respondido_em', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CSNPSResponse[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── TouchpointModal ────────────────────────────────────────────────────────

function TouchpointModal({ open, onClose, clients, preselectedClientId }: {
  open: boolean;
  onClose: () => void;
  clients: CSClient[];
  preselectedClientId?: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [clientId, setClientId] = useState(preselectedClientId || '');
  const [tipo, setTipo] = useState('whatsapp');
  const [resultado, setResultado] = useState('positivo');
  const [notas, setNotas] = useState('');
  const [proximoContato, setProximoContato] = useState('');
  const [duracao, setDuracao] = useState('');
  const [clienteFaltou, setClienteFaltou] = useState(false);

  useEffect(() => {
    if (open && preselectedClientId) setClientId(preselectedClientId);
    if (!open) { setClientId(''); setNotas(''); setProximoContato(''); setDuracao(''); setClienteFaltou(false); }
  }, [open, preselectedClientId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cs_touchpoints').insert({
        client_id: clientId, csm_id: user?.id, tipo, resultado,
        notas: notas || null, proximo_contato: proximoContato || null,
        duracao_minutos: duracao ? parseInt(duracao) : null,
        data_contato: new Date().toISOString(),
        cliente_faltou: tipo === 'reuniao' ? clienteFaltou : null,
      });
      if (error) throw error;
      await supabase.from('platform_users').update({
        cs_ultimo_touchpoint: new Date().toISOString(),
        cs_proximo_touchpoint: proximoContato || null,
      }).eq('id', clientId);
    },
    onSuccess: () => {
      toast.success('Touchpoint registrado');
      qc.invalidateQueries({ queryKey: ['cs-touchpoints'] });
      qc.invalidateQueries({ queryKey: ['cs-clients'] });
      qc.invalidateQueries({ queryKey: ['cs-client-detail', clientId] });
      onClose();
      setNotas(''); setProximoContato(''); setDuracao(''); setClienteFaltou(false);
    },
    onError: () => toast.error('Erro ao registrar touchpoint'),
  });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Registrar Touchpoint</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                <SelectValue placeholder="Selecionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{clientName(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <Select value={tipo} onValueChange={v => { setTipo(v); if (v !== 'reuniao') setClienteFaltou(false); }}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resultado</Label>
              <Select value={resultado} onValueChange={setResultado}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RESULTADO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {tipo === 'reuniao' && (
            <div className="rounded-xl border border-border/60 px-4 py-3 flex items-center justify-between bg-muted/20">
              <p className="text-sm font-medium">Cliente não compareceu</p>
              <button
                onClick={() => setClienteFaltou(f => !f)}
                className={cn('w-9 h-5 rounded-full transition-colors relative', clienteFaltou ? 'bg-foreground' : 'bg-muted')}
              >
                <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm', clienteFaltou ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Duração (min)</Label>
              <Input type="number" value={duracao} onChange={e => setDuracao(e.target.value)} placeholder="30" className="h-10 text-sm rounded-lg border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Próximo contato</Label>
              <Input type="date" value={proximoContato} onChange={e => setProximoContato(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="O que foi discutido, próximos passos..." rows={3} className="text-sm rounded-lg border-border/60 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
              disabled={!clientId || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── HealthScoreModal (APOSENTADO) ──────────────────────────────────────────
// A avaliação manual de health (5 sliders) foi substituída pelo modelo 2-eixos
// automático (Adoção + Resultado no CRM) na ficha do cliente. Mantido apenas o
// NPS e Touchpoints como registros manuais do CSM.

// ── NPSModal ───────────────────────────────────────────────────────────────

function NPSModal({ open, onClose, clients, preselectedClientId }: {
  open: boolean; onClose: () => void; clients: CSClient[]; preselectedClientId?: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [clientId, setClientId] = useState(preselectedClientId || '');
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (score === null) throw new Error('Score obrigatório');
      const { error } = await supabase.from('cs_nps_responses').insert({
        client_id: clientId, score, comentario: comentario || null,
        coletado_por: user?.id, respondido_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('NPS registrado');
      qc.invalidateQueries({ queryKey: ['cs-nps'] });
      qc.invalidateQueries({ queryKey: ['cs-client-detail', clientId] });
      onClose(); setScore(null); setComentario(''); setClientId(preselectedClientId || '');
    },
    onError: () => toast.error('Erro ao registrar NPS'),
  });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Registrar NPS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                <SelectValue placeholder="Selecionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{clientName(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pontuação NPS (0–10)</Label>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i} onClick={() => setScore(i)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-sm font-semibold border transition-all',
                    score === i
                      ? i >= 9 ? 'bg-emerald-500 text-white border-emerald-500'
                        : i >= 7 ? 'bg-amber-400 text-white border-amber-400'
                          : 'bg-red-500 text-white border-red-500'
                      : 'border-border/60 text-muted-foreground hover:border-foreground/30'
                  )}
                >{i}</button>
              ))}
            </div>
            {score !== null && (
              <p className={cn('text-[11px] font-medium', npsCategory(score).color.split(' ')[0])}>
                {npsCategory(score).label}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comentário</Label>
            <Textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="O que o cliente disse..." rows={2} className="text-sm rounded-lg border-border/60 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
              disabled={!clientId || score === null || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab: Base de Clientes ──────────────────────────────────────────────────

function ClientesTab({ clients, onNewTouchpoint, onOpenDrawer }: {
  clients: CSClient[];
  onNewTouchpoint: (id: string) => void;
  onOpenDrawer: (c: CSClient) => void;
}) {
  const qc = useQueryClient();
  const { data: jornadaProgress } = useCsJornadasProgress();
  const [search, setSearch] = useState('');
  const [faseFilter, setFaseFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'growth' | 'faturamento' | 'nome'>('growth');

  const filtered = clients.filter(c => {
    if (search && !clientName(c).toLowerCase().includes(search.toLowerCase())) return false;
    if (faseFilter !== 'all' && c.cs_fase !== faseFilter) return false;
    if (healthFilter !== 'all' && effectiveHealthV2(c) !== healthFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'nome') return clientName(a).localeCompare(clientName(b));
    if (sortBy === 'faturamento') return (b.crm?.fat_30d ?? 0) - (a.crm?.fat_30d ?? 0);
    // growth: clientes com crescimento primeiro; "novo" (null) fica no meio; sem crm por último
    const rank = (c: CSClient) => {
      if (!c.crm) return -Infinity;
      return c.crm.fat_growth_pct ?? -0.5; // null (novo) ~ neutro
    };
    return rank(b) - rank(a);
  });

  const setFase = async (id: string, fase: string) => {
    await supabase.from('platform_users').update({ cs_fase: fase, cs_fase_desde: new Date().toISOString().slice(0, 10) }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['cs-clients'] });
    toast.success('Fase atualizada');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9 h-9 text-sm rounded-lg border-border/60" />
        </div>
        <Select value={faseFilter} onValueChange={setFaseFilter}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fases</SelectItem>
            {Object.entries(FASE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os scores</SelectItem>
            <SelectItem value="verde">Verde</SelectItem>
            <SelectItem value="amarelo">Amarelo</SelectItem>
            <SelectItem value="vermelho">Vermelho</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="growth">Ordenar: crescimento</SelectItem>
            <SelectItem value="faturamento">Ordenar: faturamento</SelectItem>
            <SelectItem value="nome">Ordenar: nome</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><Users className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum cliente encontrado</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Ajuste os filtros acima</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="divide-y divide-border/40">
            {sorted.map(c => {
              const hs = effectiveHealthV2(c);
              const days = c.cs_ultimo_touchpoint
                ? differenceInDays(new Date(), new Date(c.cs_ultimo_touchpoint))
                : null;
              const growth = c.crm ? growthBadge(c.crm.fat_growth_pct) : null;
              return (
                <div
                  key={c.id}
                  className="group px-5 py-3.5 flex items-center gap-4 hover:bg-muted/[0.03] transition-colors cursor-pointer"
                  onClick={() => onOpenDrawer(c)}
                >
                  {/* Avatar com borda colorida por health */}
                  <div className={cn(
                    'w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[11px] font-bold bg-muted text-muted-foreground',
                    hs === 'verde'    ? 'border-emerald-400' :
                    hs === 'amarelo'  ? 'border-amber-400'   :
                    hs === 'vermelho' ? 'border-red-400'     : 'border-border/40'
                  )}>
                    {clientName(c).split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{clientName(c)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {c.product_name && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/70 text-muted-foreground border border-border/40">
                          {c.product_name.split('—')[0].trim()}
                        </span>
                      )}
                      {c.cs_fase ? (
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md border', FASE_COLORS[c.cs_fase])}>{FASE_LABELS[c.cs_fase]}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">Sem fase</span>
                      )}
                      {days != null && (
                        <span className={cn('text-[10px]', days >= 14 ? 'text-amber-600 font-semibold' : 'text-muted-foreground/50')}>
                          · {days}d
                        </span>
                      )}
                      {days == null && <span className="text-[10px] text-muted-foreground/40">· nunca contactado</span>}
                      {c.crm_user_id && jornadaProgress?.[c.crm_user_id]?.total ? (
                        <span className={cn('text-[10px] font-medium tabular-nums',
                          jornadaProgress[c.crm_user_id].pct >= 70 ? 'text-emerald-600' :
                          jornadaProgress[c.crm_user_id].pct >= 30 ? 'text-amber-600' : 'text-rose-600')}>
                          · Jornada {jornadaProgress[c.crm_user_id].pct}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right w-[92px] flex-shrink-0">
                    {c.crm ? (
                      <>
                        <p className="text-sm font-bold tabular-nums font-display">{formatBRLCompact(c.crm.fat_30d)}</p>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          {growth && growth.dir === 'up' && <TrendingUp className="h-3 w-3 text-emerald-600" />}
                          {growth && growth.dir === 'down' && <TrendingDown className="h-3 w-3 text-rose-600" />}
                          <span className={cn('text-[10px] font-semibold tabular-nums',
                            growth?.dir === 'up' ? 'text-emerald-600' :
                            growth?.dir === 'down' ? 'text-rose-600' :
                            growth?.dir === 'new' ? 'text-muted-foreground/50' : 'text-muted-foreground/50'
                          )}>{growth?.label ?? '—'}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/30">—</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <Select onValueChange={v => setFase(c.id, v)}>
                      <SelectTrigger className="h-7 text-[10px] rounded-lg border-border/60 w-[85px] px-2"><SelectValue placeholder="Fase" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FASE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-lg border-border/60" onClick={() => onNewTouchpoint(c.id)}>
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Touchpoints ───────────────────────────────────────────────────────

function TouchpointsTab({ touchpoints, onNew }: { touchpoints: CSTouchpoint[]; onNew: () => void }) {
  const TIPO_ICONS: Record<string, React.ElementType> = {
    whatsapp: MessageCircle, reuniao: Video, email: Mail, ligacao: Phone, outro: Activity,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">{touchpoints.length} registros</p>
        <Button onClick={onNew} variant="outline" className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3">
          <Plus className="h-3.5 w-3.5" />Registrar touchpoint
        </Button>
      </div>
      {touchpoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><MessageCircle className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum touchpoint registrado</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="divide-y divide-border/40">
            {touchpoints.map(t => {
              const Icon = TIPO_ICONS[t.tipo] || Activity;
              return (
                <div key={t.id} className="px-5 py-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted flex-shrink-0 mt-0.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{clientName(t.platform_users || {})}</p>
                      <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">{TIPO_LABELS[t.tipo]}</span>
                      <span className={cn('text-[10px] font-medium', RESULTADO_COLORS[t.resultado])}>{RESULTADO_LABELS[t.resultado]}</span>
                    </div>
                    {t.notas && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.notas}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground/50">
                        {format(parseISO(t.data_contato), "d 'de' MMM, HH:mm", { locale: ptBR })}
                      </span>
                      {t.duracao_minutos && <span className="text-[10px] text-muted-foreground/50">{t.duracao_minutos} min</span>}
                      {t.proximo_contato && (
                        <span className="text-[10px] text-muted-foreground/50">
                          Próximo: {format(parseISO(t.proximo_contato), "d MMM", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: NPS ───────────────────────────────────────────────────────────────

interface ClientNpsGroupData {
  clientId: string;
  clientDisplay: { clinic_name: string | null; nome_completo: string | null } | null;
  responses: CSNPSResponse[];
}

function ClientNpsGroup({ group }: { group: ClientNpsGroupData }) {
  const [open, setOpen] = useState(false);
  const { responses } = group;
  const latest = responses[0];
  const cat = npsCategory(latest.score);

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/[0.03] transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('text-lg font-bold tabular-nums w-9 text-center flex-shrink-0', cat.color.split(' ')[0])}>{latest.score}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{clientName(group.clientDisplay || {})}</p>
            <p className="text-[10px] text-muted-foreground/50">
              {responses.length} resposta{responses.length > 1 ? 's' : ''} · última em {format(parseISO(latest.respondido_em), "d 'de' MMM yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', cat.color)}>{cat.label}</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 divide-y divide-border/40">
          {responses.map(r => <NpsResponseRow key={r.id} response={r} showClientName={false} />)}
        </div>
      )}
    </div>
  );
}

function NPSTab({ nps, onNew, clients }: { nps: CSNPSResponse[]; onNew: () => void; clients: CSClient[] }) {
  const [subTab, setSubTab] = useState<'respostas' | 'templates' | 'disparar'>('respostas');
  const promoters = nps.filter(n => n.score >= 9).length;
  const neutrals = nps.filter(n => n.score >= 7 && n.score <= 8).length;
  const detractors = nps.filter(n => n.score <= 6).length;
  const npsValue = nps.length > 0 ? Math.round((promoters - detractors) / nps.length * 100) : null;
  const avgScore = nps.length > 0 ? (nps.reduce((s, n) => s + n.score, 0) / nps.length).toFixed(1) : null;

  const npsByClient = useMemo<ClientNpsGroupData[]>(() => {
    const map = new Map<string, CSNPSResponse[]>();
    nps.forEach(n => {
      if (!map.has(n.client_id)) map.set(n.client_id, []);
      map.get(n.client_id)!.push(n);
    });
    return Array.from(map.entries())
      .map(([clientId, responses]) => ({
        clientId,
        clientDisplay: responses[0].platform_users ?? null,
        responses: [...responses].sort((a, b) => b.respondido_em.localeCompare(a.respondido_em)),
      }))
      .sort((a, b) => b.responses[0].respondido_em.localeCompare(a.responses[0].respondido_em));
  }, [nps]);

  return (
    <div className="space-y-6">
      <div className="bg-muted/40 rounded-xl p-1 flex gap-0.5 w-fit">
        {[
          { id: 'respostas', label: 'Respostas' },
          { id: 'templates', label: 'Templates de Pesquisa' },
          { id: 'disparar', label: 'Disparar Pesquisa' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', subTab === t.id ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'templates' && <NpsTemplatesTab />}
      {subTab === 'disparar' && <NpsDispatchTab clients={clients} />}
      {subTab === 'respostas' && (
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">{nps.length} respostas coletadas</p>
        <Button onClick={onNew} variant="outline" className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3">
          <Plus className="h-3.5 w-3.5" />Registrar NPS
        </Button>
      </div>
      {nps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><Star className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum NPS registrado</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">NPS</p>
              <p className="text-3xl font-bold font-display tabular-nums">{npsValue}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Meta: ≥ 40</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Média</p>
              <p className="text-3xl font-bold font-display tabular-nums">{avgScore}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">de 10</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 space-y-2">
              {[
                { label: 'Promotores', count: promoters, color: 'text-emerald-600' },
                { label: 'Neutros', count: neutrals, color: 'text-amber-600' },
                { label: 'Detratores', count: detractors, color: 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className={cn('text-[10px] font-medium', item.color)}>{item.label}</span>
                  <span className={cn('text-xs font-bold tabular-nums', item.color)}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {npsByClient.map(group => <ClientNpsGroup key={group.clientId} group={group} />)}
          </div>
        </>
      )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Métricas ──────────────────────────────────────────────────────────

function MetricasTab({ clients, touchpoints, nps }: {
  clients: CSClient[];
  touchpoints: CSTouchpoint[];
  nps: CSNPSResponse[];
}) {
  const active = clients.filter(c => c.onboarding_complete || c.onboarding_concluido);

  // ── Agregados de Resultado no CRM (base) ──
  const withCrm = clients.filter(c => c.crm);
  const fatBase30d = withCrm.reduce((s, c) => s + (c.crm!.fat_30d), 0);
  const fechBase30d = withCrm.reduce((s, c) => s + (c.crm!.fechamentos_30d), 0);
  const ticketBase = fechBase30d > 0 ? fatBase30d / fechBase30d : null;
  const growths = withCrm.map(c => c.crm!.fat_growth_pct).filter((g): g is number => g != null);
  const growthMed = growths.length > 0 ? Math.round(growths.reduce((s, g) => s + g, 0) / growths.length) : null;
  const crescendo = withCrm.filter(c => (c.crm!.fat_growth_pct ?? 0) > 3).length;
  const caindo = withCrm.filter(c => (c.crm!.fat_growth_pct ?? 0) < -3).length;
  const txFechs = withCrm.map(c => c.crm!.tx_fech).filter((t): t is number => t != null);
  const txFechMed = txFechs.length > 0 ? +(txFechs.reduce((s, t) => s + t, 0) / txFechs.length).toFixed(1) : null;
  const tempos = withCrm.map(c => c.crm!.tempo_1o_contato_med_min).filter((t): t is number => t != null);
  const tempoMed = tempos.length > 0 ? tempos.reduce((s, t) => s + t, 0) / tempos.length : null;
  const comMeta = withCrm.filter(c => c.crm!.tem_meta).length;
  const pctComMeta = withCrm.length > 0 ? Math.round(comMeta / withCrm.length * 100) : 0;

  const thirtyAgo = subDays(new Date(), 30);
  const tp30 = touchpoints.filter(t => new Date(t.data_contato) >= thirtyAgo);
  const clientsWithTp30 = new Set(tp30.map(t => t.client_id)).size;
  const tpRate = active.length > 0 ? Math.round(clientsWithTp30 / active.length * 100) : 0;
  const withScore = clients.filter(c => c.latest_health);
  const avgScore = withScore.length > 0
    ? Math.round(withScore.reduce((s, c) => s + (c.latest_health?.score_total || 0), 0) / withScore.length)
    : null;
  const promoters = nps.filter(n => n.score >= 9).length;
  const detractors = nps.filter(n => n.score <= 6).length;
  const npsValue = nps.length > 0 ? Math.round((promoters - detractors) / nps.length * 100) : null;
  const faseCount = Object.keys(FASE_LABELS).reduce((acc, f) => ({ ...acc, [f]: active.filter(c => c.cs_fase === f).length }), {} as Record<string, number>);
  const tpPositive = touchpoints.length > 0
    ? Math.round(touchpoints.filter(t => t.resultado === 'positivo').length / touchpoints.length * 100)
    : null;

  const kpis = [
    { label: 'Touchpoints (30d)', value: `${tpRate}%`, meta: '≥ 90%', ok: tpRate >= 90 },
    { label: 'Health Score Médio', value: avgScore != null ? String(avgScore) : '—', meta: '≥ 65', ok: avgScore != null && avgScore >= 65 },
    { label: 'NPS', value: npsValue != null ? String(npsValue) : '—', meta: '≥ 40', ok: npsValue != null && npsValue >= 40 },
    { label: 'Clientes em Maturidade', value: `${faseCount.maturidade || 0}`, meta: '≥ 20% da base', ok: (faseCount.maturidade || 0) / Math.max(active.length, 1) >= 0.2 },
    { label: 'Touchpoints Positivos', value: tpPositive != null ? `${tpPositive}%` : '—', meta: '≥ 60%', ok: tpPositive != null && tpPositive >= 60 },
  ];

  const crmKpis = [
    { label: 'Faturamento da base (30d)', value: formatBRLCompact(fatBase30d), hint: `${fechBase30d} fechamentos` },
    { label: 'Crescimento médio', value: growthMed != null ? `${growthMed > 0 ? '+' : ''}${growthMed}%` : '—', hint: `${crescendo} crescendo · ${caindo} em queda` },
    { label: 'Ticket médio da base', value: ticketBase != null ? formatBRLCompact(ticketBase) : '—', hint: 'faturamento / fechamentos' },
    { label: 'Conversão média (fech.)', value: txFechMed != null ? `${txFechMed}%` : '—', hint: 'lead → fechamento' },
    { label: 'Tempo médio 1º contato', value: formatMinutes(tempoMed), hint: 'atendimento ao lead' },
    { label: 'Base com meta configurada', value: `${pctComMeta}%`, hint: `${comMeta} de ${withCrm.length} clientes` },
  ];

  return (
    <div className="space-y-6">
      {/* Resultado no CRM — o que o cliente percebe */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Resultado no CRM (base)</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Faturamento e performance real dos clientes — janela de 30 dias</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
          {crmKpis.map(k => (
            <div key={k.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{k.label}</p>
              <p className="text-xl font-bold tabular-nums font-display mt-1">{k.value}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{k.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">KPIs do CS</p>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {kpis.map(kpi => (
            <div key={kpi.label} className="px-5 py-3.5 flex items-center gap-4">
              <div className={cn('w-1.5 h-6 rounded-full flex-shrink-0',
                kpi.value === '—' ? 'bg-muted' : kpi.ok ? 'bg-emerald-500' : 'bg-amber-400'
              )} />
              <div className="flex-1">
                <p className="text-sm font-medium">{kpi.label}</p>
                <p className="text-[10px] text-muted-foreground/60">Meta: {kpi.meta}</p>
              </div>
              <p className="text-xl font-bold tabular-nums font-display">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><Target className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Distribuição por Fase</p>
          </div>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {Object.entries(FASE_LABELS).map(([key, label]) => {
            const count = faseCount[key] || 0;
            const pct = active.length > 0 ? Math.round(count / active.length * 100) : 0;
            const colorClass = FASE_COLORS[key].split(' ')[1];
            return (
              <div key={key} className="text-center">
                <p className={cn('text-2xl font-bold tabular-nums font-display', colorClass)}>{count}</p>
                <p className="text-[11px] font-medium mt-0.5">{label}</p>
                <p className="text-[10px] text-muted-foreground/50">{pct}% da base</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Jornadas (visão da base) ──────────────────────────────────────────

function jornadaStatusPill(status: JornadaOverviewItem['status']) {
  if (status === 'ativa') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-semibold">Ativa</span>;
  if (status === 'concluida') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold">Concluída</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">Rascunho</span>;
}

function JornadasTab({ clients, onOpenJornada }: { clients: CSClient[]; onOpenJornada: (c: CSClient) => void }) {
  const { data: overview, isLoading } = useCsJornadasOverview();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'sem_mes' | 'rascunho' | 'baixo'>('all');

  const thisMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  const rows = clients.map(c => {
    const items = (c.crm_user_id && overview?.[c.crm_user_id]) ? overview[c.crm_user_id] : [];
    const mensais = items.filter(i => i.tipo !== 'onboarding');
    const doMes = mensais.find(i => i.periodo_ref === thisMonth) ?? null;
    const atual = doMes ?? mensais[0] ?? items[0] ?? null;
    return { c, items, atual, doMes, totalJornadas: items.length };
  });

  const filtered = rows.filter(r => {
    if (search && !clientName(r.c).toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'sem_mes' && r.doMes) return false;
    if (filter === 'rascunho' && r.atual?.status !== 'rascunho') return false;
    if (filter === 'baixo' && !(r.atual && r.atual.status === 'ativa' && r.atual.pct < 30)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const am = a.doMes ? 1 : 0, bm = b.doMes ? 1 : 0;
    if (am !== bm) return am - bm; // sem jornada do mês primeiro
    return (a.atual?.pct ?? -1) - (b.atual?.pct ?? -1); // menor progresso primeiro
  });

  const comMes = rows.filter(r => r.doMes).length;
  const semMes = rows.filter(r => r.c.crm_user_id && !r.doMes).length;
  const ativas = rows.filter(r => r.atual?.status === 'ativa');
  const mediaPct = ativas.length ? Math.round(ativas.reduce((a, r) => a + (r.atual?.pct ?? 0), 0) / ativas.length) : 0;

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const stats = [
    { label: 'Com jornada este mês', value: String(comMes), tone: 'text-emerald-600' },
    { label: 'Sem jornada este mês', value: String(semMes), tone: semMes > 0 ? 'text-rose-600' : 'text-muted-foreground' },
    { label: 'Progresso médio (ativas)', value: `${mediaPct}%`, tone: 'text-foreground' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{s.label}</p>
            <p className={cn('text-2xl font-bold font-display tabular-nums mt-1', s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9 h-9 text-sm rounded-lg border-border/60" />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            <SelectItem value="sem_mes">Sem jornada este mês</SelectItem>
            <SelectItem value="rascunho">Com rascunho pendente</SelectItem>
            <SelectItem value="baixo">Ativa com baixo progresso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><Route className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum cliente neste filtro</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Ajuste a busca ou o filtro acima</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="divide-y divide-border/40">
            {sorted.map(({ c, atual, doMes, totalJornadas }) => {
              const semUser = !c.crm_user_id;
              const pct = atual?.pct ?? 0;
              return (
                <div key={c.id} onClick={() => onOpenJornada(c)}
                  className="group px-5 py-3.5 flex items-center gap-4 hover:bg-muted/[0.03] transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{clientName(c)}</p>
                      {c.cs_fase && <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md border', FASE_COLORS[c.cs_fase])}>{FASE_LABELS[c.cs_fase]}</span>}
                      {atual ? jornadaStatusPill(atual.status) : (
                        <span className="text-[10px] text-muted-foreground/40">{semUser ? 'sem usuário no CRM' : 'sem jornada'}</span>
                      )}
                      {!doMes && !semUser && <span className="text-[10px] text-rose-600 font-semibold">· falta a deste mês</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 mt-0.5">
                      {atual && <span className="truncate max-w-[240px]">{atual.titulo}</span>}
                      {atual && <span className="font-display tabular-nums">{atual.done}/{atual.total} · {pct}%</span>}
                      {totalJornadas > 0 && <span>{totalJornadas} jornada{totalJornadas > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  {atual && (
                    <div className="w-[120px] flex-shrink-0">
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : pct >= 30 ? 'bg-foreground/70' : 'bg-rose-400')} style={{ width: `${Math.max(pct, atual.total > 0 ? 3 : 0)}%` }} />
                      </div>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-muted-foreground/50 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'painel', label: 'Painel' },
  { id: 'athos', label: 'Athos CS' },
  { id: 'clientes', label: 'Base de Clientes' },
  { id: 'jornadas', label: 'Jornadas' },
  { id: 'playbooks', label: 'Playbooks' },
  { id: 'touchpoints', label: 'Touchpoints' },
  { id: 'nps', label: 'NPS & Advocacy' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'docs', label: 'Documentação' },
];

export default function AdminCS() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('painel');
  const refreshJornadasCaches = () => {
    qc.invalidateQueries({ queryKey: ['cs-jornadas-overview'] });
    qc.invalidateQueries({ queryKey: ['cs-jornadas-progress'] });
    qc.invalidateQueries({ queryKey: ['cs-client-jornadas'] });
  };
  const [touchpointModal, setTouchpointModal] = useState<{ open: boolean; clientId?: string }>({ open: false });
  const [npsModal, setNPSModal] = useState<{ open: boolean; clientId?: string }>({ open: false });

  const { data: rawClients = [], isLoading: loadingClients } = useCSClients();
  const { data: crmMap = {} } = useCSCrmMetrics();
  const { data: touchpoints = [], isLoading: loadingTp } = useCSTouchpoints();
  const { data: nps = [] } = useCSNPS();

  // Anexa as métricas de Resultado no CRM a cada cliente (cruzando por org).
  const clients = useMemo(
    () => rawClients.map(c => ({ ...c, crm: crmMap[c.organization_id] ?? null })),
    [rawClients, crmMap],
  );

  const openDrawer = (c: CSClient) => navigate(`/admin/cs/cliente/${c.id}`);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <HeartHandshake className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Customer Success</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">
          Acompanhe a saúde da base, execute os playbooks e garanta resultados em cada cliente.
        </p>
      </div>

      <div className="bg-muted/40 rounded-xl p-1 flex gap-0.5 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
              tab === t.id ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(loadingClients || loadingTp) ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {tab === 'painel' && (
            <PainelTab
              clients={clients} touchpoints={touchpoints} nps={nps}
              onRegistrarTouchpoint={id => setTouchpointModal({ open: true, clientId: id })}
              onOpenDrawer={openDrawer}
            />
          )}
          {tab === 'playbooks' && <PlaybooksTab clients={clients} />}
          {tab === 'clientes' && (
            <ClientesTab
              clients={clients}
              onNewTouchpoint={id => setTouchpointModal({ open: true, clientId: id })}
              onOpenDrawer={openDrawer}
            />
          )}
          {tab === 'touchpoints' && (
            <TouchpointsTab touchpoints={touchpoints} onNew={() => setTouchpointModal({ open: true })} />
          )}
          {tab === 'nps' && <NPSTab nps={nps} onNew={() => setNPSModal({ open: true })} clients={clients} />}
          {tab === 'metricas' && <MetricasTab clients={clients} touchpoints={touchpoints} nps={nps} />}
          {tab === 'jornadas' && <JornadasTab clients={clients} onOpenJornada={c => navigate(`/admin/cs/cliente/${c.id}/jornada`)} />}
          {tab === 'athos' && <AthosCsChat onJornadaChanged={refreshJornadasCaches} />}
          {tab === 'docs' && <DocsTab />}
        </>
      )}

      <TouchpointModal
        open={touchpointModal.open}
        onClose={() => setTouchpointModal({ open: false })}
        clients={clients}
        preselectedClientId={touchpointModal.clientId}
      />
      <NPSModal
        open={npsModal.open}
        onClose={() => setNPSModal({ open: false })}
        clients={clients}
        preselectedClientId={npsModal.clientId}
      />

    </div>
  );
}
