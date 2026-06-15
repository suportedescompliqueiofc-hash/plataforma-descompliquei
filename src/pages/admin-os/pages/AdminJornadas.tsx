import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Route, Plus, Loader2, Search, ChevronRight, User, CheckCircle2, Circle, Zap, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAdminJornadas, useCreateJornada, useDeleteJornada, type JornadaResumo } from '@/hooks/useAdminJornadas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JornadaResumo['status'] }) {
  if (status === 'ativa') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-semibold">
      <Zap className="h-3 w-3" /> Ativa
    </span>
  );
  if (status === 'concluida') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold">
      <CheckCircle2 className="h-3 w-3" /> Concluída
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
      <Circle className="h-3 w-3" /> Rascunho
    </span>
  );
}

// ─── New jornada modal ────────────────────────────────────────────────────────

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

export default function AdminJornadas() {
  const navigate = useNavigate();
  const { data: jornadas, isLoading } = useAdminJornadas();
  const deleteJornada = useDeleteJornada();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = (jornadas ?? []).filter(j =>
    !search ||
    j.titulo.toLowerCase().includes(search.toLowerCase()) ||
    j.perfis?.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
    j.perfis?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente ou título..."
          className="h-10 pl-9 text-sm rounded-xl border-border/60"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Route className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">JORNADAS</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{filtered.length} jornadas</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Route className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma jornada encontrada</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Crie a primeira jornada para um cliente</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(j => {
              const { total, done } = j._progress ?? { total: 0, done: 0 };
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              const isConfirming = confirmDeleteId === j.id;
              return (
                <div key={j.id} className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                  <button
                    onClick={() => navigate(`/admin/jornadas/${j.id}`)}
                    className="flex-1 flex items-center gap-4 text-left min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-[13px] font-semibold text-foreground">{j.titulo}</p>
                        <StatusBadge status={j.status} />
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground/70">
                        <User className="h-3 w-3" />
                        <span>{j.perfis?.nome_completo || j.perfis?.email || '—'}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{format(parseISO(j.updated_at), "d MMM yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[12px] font-semibold tabular-nums text-foreground">{pct}%</p>
                        <p className="text-[10px] text-muted-foreground/60">{done}/{total} passos</p>
                      </div>
                      <div className="w-20 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  </button>

                  {/* Delete */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isConfirming ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-7 px-2.5 text-[11px] text-muted-foreground"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { deleteJornada.mutate(j.id); setConfirmDeleteId(null); }}
                          disabled={deleteJornada.isPending}
                          className="h-7 px-2.5 text-[11px] font-semibold bg-destructive text-white hover:bg-destructive/90 rounded-lg"
                        >
                          {deleteJornada.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDeleteId(j.id)}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
                      >
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
    </div>
  );
}
