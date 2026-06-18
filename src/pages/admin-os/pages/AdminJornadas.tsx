import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Route, Plus, Loader2, Search, ChevronRight, User,
  CheckCircle2, Circle, Zap, Trash2, AlertTriangle, Bot, Pencil,
  Layers, Flag, X, Edit3, Calendar, Clock, Lock, ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useAdminJornadas, useAdminJornada, useCreateJornada, useDeleteJornada,
  type JornadaResumo,
} from '@/hooks/useAdminJornadas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return format(parseISO(iso), "d 'de' MMM, yyyy", { locale: ptBR });
}

function fmtRelative(iso: string) {
  return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
}

type EstagioStatus = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'bloqueado';

function getEstagioStatus(passos: any[], prevDone: boolean, index: number): EstagioStatus {
  if (index > 0 && !prevDone) return 'bloqueado';
  const required = passos.filter(p => p.obrigatorio);
  const check = required.length > 0 ? required : passos;
  if (check.length === 0) return 'concluido';
  const doneCount = check.filter(p => p.concluido).length;
  if (doneCount === 0) return 'nao_iniciado';
  if (doneCount >= check.length) return 'concluido';
  return 'em_andamento';
}

function getEstagioProgress(passos: any[]) {
  if (passos.length === 0) return { total: 0, done: 0, pct: 0 };
  const done = passos.filter(p => p.concluido).length;
  return { total: passos.length, done, pct: Math.round((done / passos.length) * 100) };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JornadaResumo['status'] }) {
  if (status === 'ativa') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wide">
      <Zap className="h-2.5 w-2.5" /> Ativa
    </span>
  );
  if (status === 'concluida') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wide">
      <CheckCircle2 className="h-2.5 w-2.5" /> Concluída
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 text-[10px] font-bold uppercase tracking-wide">
      <Circle className="h-2.5 w-2.5" /> Rascunho
    </span>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function JornadaDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: jornada, isLoading } = useAdminJornada(id);

  const estagios = jornada?.jornada_estagios ?? [];
  const allPassos = estagios.flatMap(e => e.jornada_passos ?? []);
  const totalPassos = allPassos.length;
  const donePassos = allPassos.filter(p => p.concluido).length;
  const pctGeral = totalPassos === 0 ? 0 : Math.round((donePassos / totalPassos) * 100);

  const totalEstagios = estagios.length;
  const doneEstagios = estagios.filter(e => {
    const ps = e.jornada_passos ?? [];
    const req = ps.filter((p: any) => p.obrigatorio);
    const check = req.length > 0 ? req : ps;
    return check.length === 0 || check.every((p: any) => p.concluido);
  }).length;

  const diasDesdeAtualizacao = jornada
    ? differenceInDays(new Date(), parseISO(jornada.updated_at))
    : 0;

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl w-full p-0 flex flex-col overflow-hidden rounded-2xl border border-border/60 max-h-[90vh]">
        {/* Header fixo */}
        <div className="shrink-0 px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="h-5 w-48 bg-muted/60 rounded animate-pulse" />
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <StatusBadge status={jornada!.status} />
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide',
                      jornada?.gerada_por === 'ia'
                        ? 'bg-violet-500/10 text-violet-600 border border-violet-500/20'
                        : 'bg-muted text-muted-foreground border border-border/40'
                    )}>
                      {jornada?.gerada_por === 'ia' ? '✦ Gerada por IA' : 'Manual'}
                    </span>
                  </div>
                  <h2 className="text-[15px] font-bold text-foreground leading-snug font-display">
                    {jornada!.titulo}
                  </h2>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isLoading && (
                <Button
                  onClick={() => { onClose(); navigate(`/admin/jornadas/${id}`); }}
                  className="h-8 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5"
                >
                  <Edit3 className="h-3 w-3" /> Editar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Body scrollável */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : !jornada ? null : (
            <div className="p-6 space-y-5">

              {/* Cliente */}
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/[0.03]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Cliente</p>
                </div>
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">
                      {jornada.perfis?.nome_completo || '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">{jornada.perfis?.email}</p>
                  </div>
                </div>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Progresso', value: `${pctGeral}%`, icon: TrendingUp, sub: `${donePassos}/${totalPassos} passos`, color: pctGeral === 100 ? 'text-emerald-500' : 'text-foreground' },
                  { label: 'Etapas', value: `${doneEstagios}/${totalEstagios}`, icon: Layers, sub: 'concluídas', color: 'text-foreground' },
                  { label: 'Concluídos', value: String(donePassos), icon: CheckCircle2, sub: 'passos ok', color: 'text-emerald-500' },
                  { label: 'Pendentes', value: String(totalPassos - donePassos), icon: Circle, sub: 'restantes', color: totalPassos - donePassos > 0 ? 'text-amber-500' : 'text-muted-foreground' },
                ].map(({ label, value, icon: Icon, sub, color }) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-card px-3.5 py-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Icon className={cn('h-3 w-3 shrink-0', color)} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
                    </div>
                    <p className={cn('text-xl font-bold tabular-nums font-display', color)}>{value}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Barra de progresso geral */}
              <div className="rounded-xl border border-border/60 bg-card px-4 py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Progresso Geral</p>
                  <span className="text-[12px] font-bold tabular-nums text-foreground">{pctGeral}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pctGeral === 100 ? 'bg-emerald-500' : 'bg-foreground')}
                    style={{ width: `${pctGeral}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                  <span>Criada {fmtRelative(jornada.created_at)}</span>
                  <span className={diasDesdeAtualizacao > 14 ? 'text-amber-500 font-medium' : ''}>
                    Atualizada {fmtRelative(jornada.updated_at)}
                  </span>
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Data de criação', value: fmtDate(jornada.created_at), icon: Calendar },
                  { label: 'Última atualização', value: fmtDate(jornada.updated_at), icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-card px-3.5 py-3 flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-muted shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">{label}</p>
                      <p className="text-[12px] font-semibold text-foreground">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Etapas */}
              {estagios.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Etapas da Jornada
                  </p>
                  {estagios.map((estagio, i) => {
                    const passos = estagio.jornada_passos ?? [];
                    const prevEstagio = i > 0 ? estagios[i - 1] : null;
                    const prevDone = prevEstagio
                      ? (() => {
                          const ps = prevEstagio.jornada_passos ?? [];
                          const req = ps.filter((p: any) => p.obrigatorio);
                          const check = req.length > 0 ? req : ps;
                          return check.length === 0 || check.every((p: any) => p.concluido);
                        })()
                      : true;
                    const estStatus = getEstagioStatus(passos, prevDone, i);
                    const { total, done, pct } = getEstagioProgress(passos);
                    const obrigatorios = passos.filter((p: any) => p.obrigatorio).length;

                    return (
                      <div
                        key={estagio.id}
                        className={cn(
                          'rounded-xl border overflow-hidden',
                          estStatus === 'concluido' ? 'border-emerald-500/20 bg-emerald-500/[0.02]' :
                          estStatus === 'em_andamento' ? 'border-blue-500/20 bg-blue-500/[0.02]' :
                          estStatus === 'bloqueado' ? 'border-border/40 bg-muted/10 opacity-60' :
                          'border-border/60 bg-card'
                        )}
                      >
                        {/* Stage header */}
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold',
                            estStatus === 'concluido' ? 'bg-emerald-500/10 text-emerald-600' :
                            estStatus === 'em_andamento' ? 'bg-blue-500/10 text-blue-600' :
                            estStatus === 'bloqueado' ? 'bg-muted text-muted-foreground/30' :
                            'bg-muted text-muted-foreground/50'
                          )}>
                            {estStatus === 'concluido' ? <CheckCircle2 className="h-4 w-4" /> :
                             estStatus === 'em_andamento' ? <Zap className="h-4 w-4" /> :
                             estStatus === 'bloqueado' ? <Lock className="h-3.5 w-3.5" /> :
                             <span>{i + 1}</span>}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[12px] font-semibold text-foreground truncate">{estagio.titulo}</p>
                              {obrigatorios > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wide shrink-0">
                                  {obrigatorios} obrig.
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground/50">{done}/{total} passos</span>
                              {estagio.prazo_dias > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                  <Clock className="h-2.5 w-2.5" />{estagio.prazo_dias}d de prazo
                                </span>
                              )}
                              {estagio.data_inicio && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                  <Calendar className="h-2.5 w-2.5" />Início: {fmtDate(estagio.data_inicio)}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className={cn('text-[13px] font-bold tabular-nums shrink-0', pct === 100 ? 'text-emerald-500' : 'text-foreground')}>
                            {pct}%
                          </p>
                        </div>

                        {/* Stage progress bar */}
                        {total > 0 && (
                          <div className="px-4 pb-2">
                            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  pct === 100 ? 'bg-emerald-500' :
                                  estStatus === 'em_andamento' ? 'bg-blue-500' : 'bg-muted-foreground/30'
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Passos */}
                        {passos.length > 0 && (
                          <div className="border-t border-border/30 divide-y divide-border/20">
                            {passos.map((passo: any) => (
                              <div
                                key={passo.id}
                                className={cn('px-4 py-2.5 flex items-start gap-3', passo.concluido ? 'bg-emerald-500/[0.01]' : '')}
                              >
                                {/* Checkbox visual */}
                                <div className={cn(
                                  'w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center',
                                  passo.concluido ? 'bg-emerald-500 border-emerald-500' : 'border-border/60 bg-background'
                                )}>
                                  {passo.concluido && (
                                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={cn(
                                      'text-[12px] font-medium',
                                      passo.concluido ? 'text-muted-foreground/60 line-through' : 'text-foreground'
                                    )}>
                                      {passo.titulo}
                                    </p>
                                    {passo.obrigatorio && (
                                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">req.</span>
                                    )}
                                    {passo.tipo === 'ferramenta_arsenal' && !passo.aula_id && (
                                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20 uppercase">Ferramenta</span>
                                    )}
                                    {passo.aula_id && (
                                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 uppercase">Aula</span>
                                    )}
                                    {passo.tipo === 'categoria_arsenal' && (
                                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase">Categoria</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    {passo.concluido && passo.concluido_em && (
                                      <span className="text-[10px] text-emerald-600/70">
                                        Concluído {fmtRelative(passo.concluido_em)}
                                      </span>
                                    )}
                                    {!passo.concluido && passo.prazo_dias && (
                                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                        <Clock className="h-2.5 w-2.5" />{passo.prazo_dias}d
                                      </span>
                                    )}
                                    {passo.descricao && (
                                      <span className="text-[10px] text-muted-foreground/40 truncate max-w-[200px]">
                                        {passo.descricao}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {passos.length === 0 && (
                          <div className="px-4 pb-3 text-[11px] text-muted-foreground/40 italic">
                            Nenhum passo cadastrado
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {estagios.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-2.5 rounded-xl bg-muted/40 mb-2.5">
                    <Layers className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-[12px] text-muted-foreground">Nenhuma etapa cadastrada</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">Clique em Editar para montar a estrutura</p>
                </div>
              )}

              {/* CTA Editar */}
              <div className="pt-2 pb-4">
                <Button
                  onClick={() => { onClose(); navigate(`/admin/jornadas/${id}`); }}
                  className="w-full h-9 rounded-xl text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Editar Estrutura da Jornada
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </div>

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Nova Jornada Modal ───────────────────────────────────────────────────────

function NovaJornadaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateJornada();
  const [titulo, setTitulo] = useState('');
  const [userId, setUserId] = useState('');
  const [search, setSearch] = useState('');

  const { data: users } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('perfis')
        .select('id, nome_completo, email')
        .order('nome_completo');
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (users ?? []).filter((u: any) =>
    !search || u.nome_completo?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!titulo.trim() || !userId) return;
    const jornada = await create.mutateAsync({ user_id: userId, titulo: titulo.trim() });
    onClose();
    navigate(`/admin/jornadas/${jornada.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl border border-border/60">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">Nova Jornada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Título da jornada
            </Label>
            <Input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Jornada de Lançamento de Consultório"
              className="h-10 text-sm rounded-lg border-border/60"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cliente
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="h-9 pl-9 text-sm rounded-lg border-border/60"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
              {filtered.slice(0, 20).map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setUserId(u.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                    userId === u.id ? 'bg-foreground/[0.06]' : 'hover:bg-muted/50'
                  )}
                >
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-foreground">{u.nome_completo || u.email}</p>
                    {u.nome_completo && <p className="text-[11px] text-muted-foreground/60">{u.email}</p>}
                  </div>
                  {userId === u.id && <CheckCircle2 className="h-4 w-4 text-foreground ml-auto" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-[12px] text-muted-foreground/60 text-center py-4">Nenhum cliente encontrado</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="h-9 rounded-lg text-xs">Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={!titulo.trim() || !userId || create.isPending}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
          >
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Criar e Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type FilterStatus = 'todas' | 'ativa' | 'concluida' | 'rascunho';

export default function AdminJornadas() {
  const { data: jornadas, isLoading } = useAdminJornadas();
  const deleteJornada = useDeleteJornada();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todas');
  const [showModal, setShowModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCliente, setFilterCliente] = useState('');
  const [filterGeradaPor, setFilterGeradaPor] = useState('');
  const [filterParadas, setFilterParadas] = useState(false);

  const all = jornadas ?? [];

  const stats = {
    total: all.length,
    ativas: all.filter(j => j.status === 'ativa').length,
    concluidas: all.filter(j => j.status === 'concluida').length,
    rascunhos: all.filter(j => j.status === 'rascunho').length,
    paradas: all.filter(j =>
      j.status === 'ativa' && differenceInDays(new Date(), parseISO(j.updated_at)) > 14
    ).length,
  };

  // Clientes únicos para o select
  const clientesUnicos = Array.from(
    new Map(all.map(j => [j.perfis?.email, { email: j.perfis?.email, nome: j.perfis?.nome_completo }])).entries()
  ).filter(([k]) => k).map(([, v]) => v);

  const filtered = all.filter(j => {
    if (filterStatus !== 'todas' && j.status !== filterStatus) return false;
    if (filterCliente && j.perfis?.email !== filterCliente) return false;
    if (filterGeradaPor && j.gerada_por !== filterGeradaPor) return false;
    if (filterParadas && !(j.status === 'ativa' && differenceInDays(new Date(), parseISO(j.updated_at)) > 14)) return false;
    if (!search) return true;
    return (
      j.titulo.toLowerCase().includes(search.toLowerCase()) ||
      j.perfis?.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
      j.perfis?.email?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const hasActiveFilters = filterCliente || filterGeradaPor || filterParadas;

  const FILTER_PILLS: { id: FilterStatus; label: string; count: number }[] = [
    { id: 'todas', label: 'Todas', count: stats.total },
    { id: 'ativa', label: 'Ativas', count: stats.ativas },
    { id: 'concluida', label: 'Concluídas', count: stats.concluidas },
    { id: 'rascunho', label: 'Rascunhos', count: stats.rascunhos },
  ];

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Route className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Jornadas</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Gerencie as jornadas personalizadas dos clientes</p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Nova Jornada
        </Button>
      </div>

      {/* Stats */}
      {!isLoading && all.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Layers, color: 'text-foreground' },
            { label: 'Ativas', value: stats.ativas, icon: Zap, color: 'text-blue-500' },
            { label: 'Concluídas', value: stats.concluidas, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Rascunhos', value: stats.rascunhos, icon: Circle, color: 'text-muted-foreground' },
            { label: 'Paradas +14d', value: stats.paradas, icon: AlertTriangle, color: stats.paradas > 0 ? 'text-amber-500' : 'text-muted-foreground' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn('h-3 w-3 shrink-0', color)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums font-display', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filtros */}
      <div className="space-y-2.5">
        {/* Linha 1: busca + selects */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente ou título..."
              className="h-10 pl-9 text-sm rounded-xl border-border/60"
            />
          </div>

          {/* Cliente */}
          <Select value={filterCliente} onValueChange={v => setFilterCliente(v === '__all__' ? '' : v)}>
            <SelectTrigger className={cn('h-10 w-auto min-w-[160px] rounded-xl text-xs border-border/60', filterCliente && 'border-foreground/30 bg-foreground/[0.04]')}>
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__all__" className="text-xs">Todos os clientes</SelectItem>
              {clientesUnicos.map(c => (
                <SelectItem key={c.email} value={c.email!} className="text-xs">
                  {c.nome || c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Gerada por */}
          <Select value={filterGeradaPor} onValueChange={v => setFilterGeradaPor(v === '__all__' ? '' : v)}>
            <SelectTrigger className={cn('h-10 w-auto min-w-[140px] rounded-xl text-xs border-border/60', filterGeradaPor && 'border-foreground/30 bg-foreground/[0.04]')}>
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__all__" className="text-xs">Qualquer origem</SelectItem>
              <SelectItem value="ia" className="text-xs">Gerada por IA</SelectItem>
              <SelectItem value="admin" className="text-xs">Criada manualmente</SelectItem>
            </SelectContent>
          </Select>

          {/* Limpar filtros */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={() => { setFilterCliente(''); setFilterGeradaPor(''); setFilterParadas(false); }}
              className="h-10 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground border border-border/60 shrink-0"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Linha 2: pills de status + toggle paradas */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-muted/40 rounded-xl p-1 gap-0.5">
            {FILTER_PILLS.map(pill => (
              <button
                key={pill.id}
                onClick={() => setFilterStatus(pill.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  filterStatus === pill.id
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {pill.label}
                <span className={cn(
                  'text-[10px] tabular-nums px-1 rounded-md font-bold',
                  filterStatus === pill.id ? 'text-background/70' : 'text-muted-foreground/50'
                )}>
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Toggle paradas */}
          <button
            onClick={() => setFilterParadas(v => !v)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-semibold border transition-all',
              filterParadas
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                : 'text-muted-foreground border-border/60 hover:text-foreground'
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            Paradas +14d
            {stats.paradas > 0 && (
              <span className={cn(
                'text-[10px] tabular-nums px-1 rounded-md font-bold',
                filterParadas ? 'text-amber-600/70' : 'text-muted-foreground/50'
              )}>
                {stats.paradas}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <Route className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Jornadas</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Route className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma jornada encontrada</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {search ? 'Tente outra busca' : 'Crie a primeira jornada para um cliente'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(j => {
              const { total, done } = j._progress ?? { total: 0, done: 0 };
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              const stages = j._stages;
              const isStagnant = j.status === 'ativa' && differenceInDays(new Date(), parseISO(j.updated_at)) > 14;
              const isConfirming = confirmDeleteId === j.id;
              const lastActivity = formatDistanceToNow(parseISO(j.updated_at), { locale: ptBR, addSuffix: true });

              let stageLabel: string | null = null;
              if (stages && stages.total > 0) {
                if (stages.currentIndex >= stages.total) {
                  stageLabel = 'Todas as etapas concluídas';
                } else {
                  stageLabel = `Etapa ${stages.currentIndex + 1} de ${stages.total}${stages.currentTitle ? ` · ${stages.currentTitle}` : ''}`;
                }
              }

              return (
                <div
                  key={j.id}
                  onClick={() => setSelectedId(j.id)}
                  className={cn(
                    'group flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer',
                    isStagnant ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.04]' : 'hover:bg-muted/20',
                    selectedId === j.id ? 'bg-muted/30' : ''
                  )}
                >
                  {/* Left icon */}
                  <div className={cn(
                    'shrink-0 w-8 h-8 rounded-xl flex items-center justify-center',
                    isStagnant ? 'bg-amber-500/10' : 'bg-muted/60'
                  )}>
                    {isStagnant
                      ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      : j.gerada_por === 'ia'
                        ? <Bot className="h-3.5 w-3.5 text-muted-foreground/50" />
                        : <Pencil className="h-3.5 w-3.5 text-muted-foreground/50" />
                    }
                  </div>

                  {/* Center info */}
                  <div className="flex-1 flex items-center gap-5 min-w-0">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-foreground truncate max-w-md">{j.titulo}</p>
                        <StatusBadge status={j.status} />
                        {isStagnant && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Parada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                          <User className="h-3 w-3" />
                          {j.perfis?.nome_completo || j.perfis?.email || '—'}
                        </span>
                        <span className="text-muted-foreground/20 text-[10px]">·</span>
                        <span className={cn('text-[11px]', isStagnant ? 'text-amber-500 font-medium' : 'text-muted-foreground/60')}>
                          Atualizado {lastActivity}
                        </span>
                        {stageLabel && (
                          <>
                            <span className="text-muted-foreground/20 text-[10px]">·</span>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                              <Flag className="h-3 w-3" />{stageLabel}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="shrink-0 flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-[13px] font-bold tabular-nums text-foreground">{pct}%</p>
                        <p className="text-[10px] text-muted-foreground/50">{done}/{total} passos</p>
                      </div>
                      <div className="w-24 space-y-1">
                        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all',
                              pct === 100 ? 'bg-emerald-500' : isStagnant ? 'bg-amber-400' : 'bg-foreground'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {stages && stages.total > 0 && (
                          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-400/60"
                              style={{ width: `${Math.min(100, Math.round((Math.min(stages.currentIndex, stages.total) / stages.total) * 100))}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="shrink-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    {isConfirming ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}
                          className="h-7 px-2.5 text-[11px] text-muted-foreground">
                          Cancelar
                        </Button>
                        <Button size="sm"
                          onClick={() => {
                            deleteJornada.mutate(j.id);
                            setConfirmDeleteId(null);
                            if (selectedId === j.id) setSelectedId(null);
                          }}
                          disabled={deleteJornada.isPending}
                          className="h-7 px-2.5 text-[11px] font-semibold bg-destructive text-white hover:bg-destructive/90 rounded-lg">
                          {deleteJornada.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="icon"
                        onClick={() => setConfirmDeleteId(j.id)}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NovaJornadaModal open={showModal} onClose={() => setShowModal(false)} />

      {selectedId && (
        <JornadaDetailSheet
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
