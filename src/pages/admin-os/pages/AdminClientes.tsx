import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Users, Search, LayoutGrid, List, Loader2,
  Plus, Check as CheckIcon, Trash2, TrendingUp, BookOpen, AlertTriangle, Infinity as InfinityIcon, GripVertical,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Sortable section wrapper ───────────────────────────────────────────────────
function SortableSection({ id, children }: { id: string; children: (handleProps: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface ClientRow {
  id: string;
  platform_user_id: string | null;
  clinic_name: string | null;
  product_name: string | null;
  status: string | null;
  trial_ends_at: string | null;
  access_starts_at: string | null;
  tenant_created_at: string | null;
  email: string | null;
  nome_completo: string | null;
  org_name: string | null;
  onboarding_concluido: boolean | null;
  onboarding_complete: boolean | null;
  platform_onboarding_enabled: boolean | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function avatarPalette(_name: string) {
  return 'bg-muted text-muted-foreground';
}

function trialDaysLeft(trial_ends_at: string | null): number | null {
  if (!trial_ends_at) return null;
  return Math.floor((new Date(trial_ends_at).getTime() - Date.now()) / 86400000);
}

function fmtMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

function getOnboardingBadge(c: ClientRow): { label: string; cls: string } | null {
  if (!c.platform_user_id) return { label: 'Nunca acessou', cls: 'bg-muted/60 text-muted-foreground/60 border-border/40' };
  if (!c.platform_onboarding_enabled) return null;
  if (c.onboarding_complete) return null;
  if (c.onboarding_concluido) return { label: 'Checklist pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200/70' };
  return { label: 'Onboarding pendente', cls: 'bg-orange-50 text-orange-700 border-orange-200/70' };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function AdminClientes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterVencimento, setFilterVencimento] = useState('todos');
  const [filterProduct, setFilterProduct] = useState('todos');
  const [groupByProduct, setGroupByProduct] = useState(true);

  const [products, setProducts] = useState<{ id: string; nome: string; duracao_dias?: number }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', clinic_name: '', product_id: '', trial_ends_at: '' });
  const [createdResult, setCreatedResult] = useState<{ email: string; clinic: string; emailSent: boolean } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ organization_id: string; clinic_name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-fill trial date based on product duration
  useEffect(() => {
    const prod = products.find(p => p.id === createForm.product_id);
    if (!prod) return;
    if (prod.duracao_dias && prod.duracao_dias < 99999) {
      const d = new Date();
      d.setDate(d.getDate() + prod.duracao_dias);
      setCreateForm(f => ({ ...f, trial_ends_at: d.toISOString().slice(0, 10) }));
    } else {
      setCreateForm(f => ({ ...f, trial_ends_at: '' }));
    }
  }, [createForm.product_id, products]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: superadminPapeis } = await supabase
        .from('usuarios_papeis').select('usuario_id').eq('papel', 'superadmin');
      const superadminUserIds = new Set((superadminPapeis || []).map((p: any) => p.usuario_id));

      const { data: superadminPerfis } = superadminUserIds.size > 0
        ? await supabase.from('perfis').select('id, organization_id').in('id', [...superadminUserIds])
        : { data: [] };

      const { data: todosPerfis } = await supabase
        .from('perfis').select('id, organization_id, nome_completo, email');

      const orgsComSuperadmin = new Set((superadminPerfis || []).map((p: any) => p.organization_id).filter(Boolean));
      const orgsComUsuarioReal = new Set(
        (todosPerfis || [])
          .filter((p: any) => p.organization_id && !superadminUserIds.has(p.id))
          .map((p: any) => p.organization_id)
      );
      const superadminOrgIds = new Set([...orgsComSuperadmin].filter(id => !orgsComUsuarioReal.has(id)));

      const { data: tenantsRaw } = await supabase
        .from('platform_tenants')
        .select('organization_id, status, trial_ends_at, product_id, access_starts_at, created_at, organizations(name)')
        .order('created_at', { ascending: false });

      const tenants = (tenantsRaw || []).filter((t: any) => !superadminOrgIds.has(t.organization_id));

      const { data: prods } = await supabase
        .from('platform_products').select('id, nome, duracao_dias').eq('ativo', true).order('ordem_index');
      const prodMap: Record<string, string> = {};
      (prods || []).forEach((p: any) => { prodMap[p.id] = p.nome; });
      setProducts((prods || []).map((p: any) => ({ id: p.id, nome: p.nome, duracao_dias: p.duracao_dias })));

      const perfilByOrg: Record<string, { id: string; nome_completo: string | null; email: string | null }> = {};
      (todosPerfis || []).forEach((p: any) => {
        if (!p.organization_id) return;
        const existing = perfilByOrg[p.organization_id];
        if (!existing || (superadminUserIds.has(existing.id) && !superadminUserIds.has(p.id))) {
          perfilByOrg[p.organization_id] = p;
        }
      });

      const { data: platformUsers } = await supabase
        .from('platform_users').select('id, crm_user_id, clinic_name, onboarding_concluido, onboarding_complete, platform_onboarding_enabled');
      const puByCrmUser: Record<string, any> = {};
      (platformUsers || []).forEach((pu: any) => {
        if (pu.crm_user_id) puByCrmUser[pu.crm_user_id] = pu;
      });

      function normalizeStatus(s: string | null): string {
        const v = (s ?? '').toLowerCase();
        if (v === 'active' || v === 'ativo') return 'ativo';
        if (v === 'blocked' || v === 'bloqueado') return 'bloqueado';
        return v || 'ativo';
      }

      const enriched: ClientRow[] = (tenants || []).map((t: any) => {
        const perfil = perfilByOrg[t.organization_id];
        const pu = perfil?.id ? puByCrmUser[perfil.id] : null;
        return {
          id: t.organization_id,
          platform_user_id: pu?.id ?? null,
          clinic_name: pu?.clinic_name ?? (t.organizations as any)?.name ?? null,
          product_name: t.product_id ? (prodMap[t.product_id] ?? null) : null,
          status: normalizeStatus(t.status),
          trial_ends_at: t.trial_ends_at ?? null,
          access_starts_at: t.access_starts_at ?? null,
          tenant_created_at: t.created_at ?? null,
          email: perfil?.email ?? null,
          nome_completo: perfil?.nome_completo ?? null,
          org_name: (t.organizations as any)?.name ?? null,
          onboarding_concluido: pu?.onboarding_concluido ?? null,
          onboarding_complete: pu?.onboarding_complete ?? null,
          platform_onboarding_enabled: pu?.platform_onboarding_enabled ?? null,
        };
      });

      setClients(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Clientes · Admin OS | Descompliquei';
    load();
  }, [load]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return clients.filter(c => {
      const q = search.toLowerCase();
      if (search) {
        const name = (c.clinic_name || c.org_name || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const nome = (c.nome_completo || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !nome.includes(q)) return false;
      }
      if (filterStatus !== 'todos' && (c.status ?? 'ativo') !== filterStatus) return false;
      if (filterProduct !== 'todos') {
        if (filterProduct === '__sem__' && c.product_name) return false;
        if (filterProduct !== '__sem__' && c.product_name !== filterProduct) return false;
      }
      if (filterVencimento !== 'todos') {
        const days = trialDaysLeft(c.trial_ends_at);
        if (filterVencimento === 'vitalicio' && c.trial_ends_at !== null) return false;
        if (filterVencimento === 'breve' && (days === null || days < 0 || days > 30)) return false;
        if (filterVencimento === 'expirado' && (days === null || days >= 0)) return false;
      }
      return true;
    });
  }, [clients, search, filterStatus, filterVencimento, filterProduct]);

  // ── Grouped by product ─────────────────────────────────────────────────────
  const groupedByProduct = useMemo(() => {
    const map = new Map<string, ClientRow[]>();
    for (const c of filtered) {
      const key = c.product_name ?? '__sem__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '__sem__') return 1;
      if (b === '__sem__') return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [filtered]);

  // ── Drag-and-drop order for product sections (persisted) ──────────────────
  const STORAGE_KEY = 'admin_clientes_section_order';
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (groupedByProduct.length === 0) return; // aguarda dados carregarem
    setSectionOrder(prev => {
      const keys = groupedByProduct.map(([k]) => k);
      const kept = prev.filter(k => keys.includes(k));
      const added = keys.filter(k => !prev.includes(k));
      const next = [...kept, ...added];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [groupedByProduct]);

  const orderedGroups = useMemo(() => {
    const map = new Map(groupedByProduct);
    return sectionOrder.filter(k => map.has(k)).map(k => [k, map.get(k)!] as [string, ClientRow[]]);
  }, [groupedByProduct, sectionOrder]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder(prev => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        const next = arrayMove(prev, oldIndex, newIndex);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  const totalAtivos = clients.filter(c => (c.status ?? 'ativo') === 'ativo').length;
  const totalBloqueados = clients.filter(c => c.status === 'bloqueado').length;
  const expirados = clients.filter(c => { const d = trialDaysLeft(c.trial_ends_at); return d !== null && d < 0; }).length;
  const vencendoEm7 = clients.filter(c => { const d = trialDaysLeft(c.trial_ends_at); return d !== null && d >= 0 && d <= 7; }).length;
  const vencendoEm30 = clients.filter(c => { const d = trialDaysLeft(c.trial_ends_at); return d !== null && d >= 0 && d <= 30; }).length;
  const semOnboarding = clients.filter(c => c.platform_user_id && c.platform_onboarding_enabled && !c.onboarding_complete).length;
  const nuncaAcessou = clients.filter(c => !c.platform_user_id).length;

  // ── Create / Delete ────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!createForm.email || !createForm.clinic_name) {
      toast.error('Email e Nome/Clínica são obrigatórios.');
      return;
    }
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('create-platform-user', {
        body: { email: createForm.email, clinic_name: createForm.clinic_name, product_id: createForm.product_id || null, trial_ends_at: createForm.trial_ends_at || null, monthly_fee: 0 },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') { try { const b = await ctx.json(); if (b?.error) throw new Error(b.error); } catch (_) {} }
        throw new Error(error.message);
      }
      if (data?.error) throw new Error(data.error);
      setShowCreateModal(false);
      setCreatedResult({ email: createForm.email, clinic: createForm.clinic_name, emailSent: data.email_sent ?? false });
      setCreateForm({ email: '', clinic_name: '', product_id: '', trial_ends_at: '' });
      await load();
    } catch (err: any) {
      toast.error('Erro ao criar acesso: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteConfirm.trim().toUpperCase() !== 'EXCLUIR') { toast.error('Digite EXCLUIR para confirmar.'); return; }
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('delete-platform-user', {
        body: { organization_id: deleteTarget.organization_id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') { try { const b = await ctx.json(); if (b?.error) throw new Error(b.error); } catch (_) {} }
        throw new Error(error.message);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(`"${deleteTarget.clinic_name}" excluído com sucesso.`);
      setDeleteTarget(null);
      setDeleteConfirm('');
      await load();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Clientes da Plataforma</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Gerencie e monitore todos os clientes do Hub de Gestão Comercial</p>
        </div>
        <Button
          className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 shrink-0"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Novo Cliente
        </Button>
      </div>

      <div className="space-y-5">

        {/* METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1 — Total */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-muted shrink-0">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Total</p>
            </div>
            <p className="text-2xl font-black tabular-nums font-display text-foreground leading-none">{clients.length}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1.5">
              {totalAtivos} ativo{totalAtivos !== 1 ? 's' : ''}
              {totalBloqueados > 0 && <span className="text-red-400"> · {totalBloqueados} bloqueado{totalBloqueados !== 1 ? 's' : ''}</span>}
            </p>
          </div>

          {/* Card 2 — Expirados */}
          <div className={cn('rounded-2xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4', expirados > 0 ? 'border-red-200/70' : 'border-border/60')}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn('p-1.5 rounded-lg shrink-0', expirados > 0 ? 'bg-red-50' : 'bg-muted')}>
                <AlertTriangle className={cn('h-3.5 w-3.5', expirados > 0 ? 'text-red-500' : 'text-muted-foreground')} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Expirados</p>
            </div>
            <p className={cn('text-2xl font-black tabular-nums font-display leading-none', expirados > 0 ? 'text-red-500' : 'text-foreground')}>{expirados}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1.5">
              {expirados > 0 ? 'Renovação urgente' : 'Nenhum expirado'}
            </p>
          </div>

          {/* Card 3 — Vencendo */}
          <div className={cn('rounded-2xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4', vencendoEm7 > 0 ? 'border-amber-200/70' : 'border-border/60')}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn('p-1.5 rounded-lg shrink-0', vencendoEm7 > 0 ? 'bg-amber-50' : 'bg-muted')}>
                <TrendingUp className={cn('h-3.5 w-3.5', vencendoEm7 > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Vencendo</p>
            </div>
            <p className={cn('text-2xl font-black tabular-nums font-display leading-none', vencendoEm7 > 0 ? 'text-amber-500' : 'text-foreground')}>{vencendoEm7}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1.5">
              em 7d
              {vencendoEm30 > vencendoEm7 && <span> · {vencendoEm30} em 30d</span>}
            </p>
          </div>

        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <Input
              placeholder="Buscar por nome, email ou clínica..."
              className="pl-9 h-9 text-sm rounded-lg border-border/60"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="h-9 w-48 text-sm rounded-lg border-border/60 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
              <SelectItem value="__sem__">Sem produto</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-36 text-sm rounded-lg border-border/60 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVencimento} onValueChange={setFilterVencimento}>
            <SelectTrigger className="h-9 w-44 text-sm rounded-lg border-border/60 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo período</SelectItem>
              <SelectItem value="breve">Vencendo em 30d</SelectItem>
              <SelectItem value="expirado">Expirado</SelectItem>
              <SelectItem value="vitalicio">Vitalício</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-0.5 bg-muted/40 rounded-xl p-1 ml-auto shrink-0">
            <button
              onClick={() => setGroupByProduct(g => !g)}
              title={groupByProduct ? 'Desagrupar' : 'Agrupar por produto'}
              className={cn('p-1.5 rounded-lg transition-all', groupByProduct ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView('cards')} className={cn('p-1.5 rounded-lg transition-all', view === 'cards' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView('table')} className={cn('p-1.5 rounded-lg transition-all', view === 'table' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/40">
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* CONTENT */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[148px] w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/60 bg-muted/[0.02]">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Users className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum cliente encontrado</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Nenhum cliente corresponde aos filtros aplicados</p>
          </div>
        ) : view === 'cards' ? (

          /* ── CARDS ─────────────────────────────────────────────────────── */
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groupByProduct ? sectionOrder : ['__all__']} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {(groupByProduct ? orderedGroups : [['__all__', filtered] as [string, ClientRow[]]]).map(([productKey, group]) => (
              <SortableSection key={productKey} id={productKey}>
                {(dragHandleProps) => (
              <div className="space-y-3">
                {groupByProduct && (
                  <div className="flex items-center gap-3 group/header">
                    <button
                      {...dragHandleProps}
                      className="cursor-grab active:cursor-grabbing p-0.5 rounded text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors touch-none"
                      title="Arrastar para reordenar"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        {productKey === '__sem__' ? 'Sem produto' : productKey}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground/50 border border-border/40 tabular-nums">
                        {group.length}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {group.map(c => {
              const displayName = c.clinic_name || c.nome_completo || c.org_name || 'Sem nome';
              const ownerName = c.nome_completo && c.nome_completo !== displayName ? c.nome_completo : null;
              const initial = displayName.charAt(0).toUpperCase();
              const palette = avatarPalette(displayName);
              const days = trialDaysLeft(c.trial_ends_at);
              const isBlocked = c.status === 'bloqueado';
              const onbBadge = getOnboardingBadge(c);
              const startDate = c.access_starts_at ?? c.tenant_created_at;

              // Expiration urgency
              const expUrgent = days !== null && days < 0;
              const expWarning = days !== null && days >= 0 && days <= 30;

              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/admin/clientes/${c.id}`)}
                  className={cn(
                    'group relative rounded-2xl border bg-card overflow-hidden cursor-pointer',
                    'shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200',
                    'hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] hover:-translate-y-[1px]',
                    isBlocked ? 'border-red-200/70 hover:border-red-300/70'
                    : expUrgent ? 'border-red-200/50 hover:border-red-300/60'
                    : expWarning ? 'border-amber-200/50 hover:border-amber-300/60'
                    : 'border-border/60 hover:border-border/90',
                  )}
                >
                  {/* Accent stripe */}
                  {isBlocked && <div className="h-[2.5px] w-full bg-red-400/70" />}
                  {!isBlocked && expUrgent && <div className="h-[2.5px] w-full bg-red-300/60" />}
                  {!isBlocked && !expUrgent && expWarning && <div className="h-[2.5px] w-full bg-amber-300/60" />}

                  <div className="p-4 space-y-3">
                    {/* Row 1: Avatar + Names + Delete */}
                    <div className="flex items-start gap-2.5">
                      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-[14px] font-black', palette)}>
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
                          <span className={cn('shrink-0 h-1.5 w-1.5 rounded-full', isBlocked ? 'bg-red-400' : 'bg-emerald-500')} />
                          <p className="text-[13px] font-bold text-foreground leading-snug truncate">{displayName}</p>
                        </div>
                        {ownerName && (
                          <p className="text-[11px] text-muted-foreground/60 truncate leading-snug">{ownerName}</p>
                        )}
                        {c.email && (
                          <p className="text-[10px] text-muted-foreground/40 truncate mt-0.5">{c.email}</p>
                        )}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 -mt-0.5 -mr-0.5 flex items-center justify-center rounded-lg text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
                        onClick={e => { e.stopPropagation(); setDeleteTarget({ organization_id: c.id, clinic_name: displayName }); setDeleteConfirm(''); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Pills row: product + status badges */}
                    <div className="flex flex-wrap gap-1">
                      {c.product_name ? (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[3px] rounded-md bg-foreground/[0.07] text-foreground/70 border border-border/40 truncate max-w-full">
                          {c.product_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-[3px] rounded-md bg-muted/30 text-muted-foreground/40 border border-border/30">
                          Sem produto
                        </span>
                      )}
                      {isBlocked && (
                        <span className="text-[9px] font-black tracking-wider px-1.5 py-[3px] rounded-md bg-red-50 text-red-600 border border-red-200/60">
                          BLOQUEADO
                        </span>
                      )}
                      {onbBadge && (
                        <span className={cn('text-[9px] font-bold px-1.5 py-[3px] rounded-md border', onbBadge.cls)}>
                          {onbBadge.label}
                        </span>
                      )}
                    </div>

                    {/* Footer: since + expiration */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-border/30">
                      <span className="text-[10px] text-muted-foreground/35 font-medium">
                        {startDate ? `Desde ${fmtMonthYear(startDate)}` : '—'}
                      </span>
                      {days !== null ? (
                        <span className={cn(
                          'text-[10px] font-bold tabular-nums',
                          days < 0 ? 'text-red-500' :
                          days <= 7 ? 'text-red-400' :
                          days <= 30 ? 'text-amber-500' :
                          'text-emerald-600'
                        )}>
                          {days < 0 ? `${Math.abs(days)}d expirado` : days === 0 ? 'Expira hoje' : `${days}d restantes`}
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-500">
                          <InfinityIcon className="h-3 w-3" /> Vitalício
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
              </SortableSection>
            ))}
          </div>
            </SortableContext>
          </DndContext>

        ) : (

          /* ── TABLE ──────────────────────────────────────────────────────── */
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groupByProduct ? sectionOrder : ['__all__']} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {(groupByProduct ? orderedGroups : [['__all__', filtered] as [string, ClientRow[]]]).map(([productKey, group]) => (
              <SortableSection key={productKey} id={productKey}>
                {(dragHandleProps) => (
              <div className="space-y-2">
                {groupByProduct && (
                  <div className="flex items-center gap-3">
                    <button
                      {...dragHandleProps}
                      className="cursor-grab active:cursor-grabbing p-0.5 rounded text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors touch-none"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                      {productKey === '__sem__' ? 'Sem produto' : productKey}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground/50 border border-border/40 tabular-nums">{group.length}</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                )}
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/[0.03]">
                          {['Cliente', 'Produto', 'Status', 'Vencimento', ''].map(h => (
                            <th key={h} className="text-left text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-5 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {group.map(c => {
                          const displayName = c.nome_completo || c.clinic_name || c.org_name || '—';
                          const palette = avatarPalette(displayName);
                          const days = trialDaysLeft(c.trial_ends_at);
                          return (
                            <tr key={c.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/admin/clientes/${c.id}`)}>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black', palette)}>
                                    {displayName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground text-[13px] leading-snug">{displayName}</p>
                                    {c.email && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{c.email}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="text-[11px] text-muted-foreground">{c.product_name || '—'}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                  c.status === 'bloqueado'
                                    ? 'bg-red-50 text-red-600 border-red-200/60'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                )}>
                                  {c.status === 'bloqueado' ? 'Bloqueado' : 'Ativo'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                {days !== null ? (
                                  <span className={cn(
                                    'text-[11px] font-bold tabular-nums',
                                    days < 0 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-muted-foreground'
                                  )}>
                                    {days < 0 ? `Expirado há ${Math.abs(days)}d` : days === 0 ? 'Expira hoje' : `${days}d restantes`}
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-violet-500">Vitalício</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <button
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground/25 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                  onClick={e => { e.stopPropagation(); setDeleteTarget({ organization_id: c.id, clinic_name: displayName }); setDeleteConfirm(''); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
                )}
              </SortableSection>
            ))}
          </div>
            </SortableContext>
          </DndContext>

        )}
      </div>

      {/* MODAL — CRIAR CLIENTE */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/[0.02]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted shrink-0">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">NOVO CLIENTE</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Crie um novo acesso à plataforma</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email *</Label>
              <Input className="h-10 text-sm rounded-lg border-border/60" type="email" placeholder="email@clinica.com" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome / Clínica *</Label>
              <Input className="h-10 text-sm rounded-lg border-border/60" placeholder="Clínica Exemplo" value={createForm.clinic_name} onChange={e => setCreateForm(f => ({ ...f, clinic_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</Label>
              <Select value={createForm.product_id || '__none__'} onValueChange={v => setCreateForm(f => ({ ...f, product_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="h-10 rounded-lg border-border/60"><SelectValue placeholder="— Nenhum —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const selectedProd = products.find(p => p.id === createForm.product_id);
              const isVitalicio = selectedProd && (selectedProd.duracao_dias ?? 0) >= 99999;
              return (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data de expiração</Label>
                  {isVitalicio ? (
                    <div className="flex h-10 w-full items-center rounded-lg border border-border/40 bg-muted/30 px-3 text-sm text-muted-foreground">
                      Vitalício — sem expiração
                    </div>
                  ) : (
                    <Input className="h-10 text-sm rounded-lg border-border/60" type="date" value={createForm.trial_ends_at} onChange={e => setCreateForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
                  )}
                  {selectedProd && !isVitalicio && selectedProd.duracao_dias && (
                    <p className="text-[10px] text-muted-foreground/50">Calculado automaticamente: {selectedProd.duracao_dias} dias a partir de hoje</p>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20">
            <button className="h-9 px-4 rounded-lg text-xs font-semibold border border-border/60 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowCreateModal(false)}>Cancelar</button>
            <button className="flex items-center gap-1.5 h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Criando...</> : <><Plus className="h-3.5 w-3.5" />Criar Acesso</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL — CONFIRMAR EXCLUSÃO */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="px-6 pt-6 pb-4 border-b border-red-200/40 bg-red-50/40">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-100 shrink-0">
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-red-600">EXCLUIR CLIENTE</p>
                <p className="text-[10px] text-red-500/60 mt-0.5">Esta ação é irreversível</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Você está prestes a excluir <strong className="text-foreground">{deleteTarget?.clinic_name}</strong> permanentemente. Todos os dados associados serão removidos.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Digite <span className="font-mono text-red-600">EXCLUIR</span> para confirmar
              </Label>
              <Input
                placeholder="EXCLUIR"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                className="h-10 text-sm rounded-lg border-red-200 focus-visible:ring-red-400"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20">
            <button className="h-9 px-4 rounded-lg text-xs font-semibold border border-border/60 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setDeleteTarget(null)}>Cancelar</button>
            <button
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40"
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirm.trim().toUpperCase() !== 'EXCLUIR'}
            >
              {isDeleting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Excluindo...</> : <><Trash2 className="h-3.5 w-3.5" />Excluir Permanentemente</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL — ACESSO CRIADO */}
      <Dialog open={!!createdResult} onOpenChange={o => !o && setCreatedResult(null)}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="flex flex-col items-center text-center px-8 pt-8 pb-6 gap-4">
            <div className={cn(
              'flex h-14 w-14 items-center justify-center rounded-2xl border',
              createdResult?.emailSent ? 'bg-emerald-50 border-emerald-200/60' : 'bg-muted border-border/40'
            )}>
              <CheckIcon className={cn('h-7 w-7', createdResult?.emailSent ? 'text-emerald-600' : 'text-muted-foreground')} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-[15px] font-bold text-foreground font-display">Acesso criado com sucesso!</h3>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {createdResult?.emailSent
                  ? <>Email de boas-vindas enviado para <strong className="text-foreground">{createdResult.email}</strong>.</>
                  : <>Acesso liberado para <strong className="text-foreground">{createdResult?.email}</strong>. Email de boas-vindas não enviado — verifique as configurações do Resend.</>
                }
              </p>
              {createdResult?.emailSent && (
                <p className="text-[10px] text-muted-foreground/40">O link de acesso expira em 24 horas.</p>
              )}
            </div>
          </div>
          <div className="flex justify-center px-8 pb-6">
            <button
              className="h-9 px-6 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
              onClick={() => setCreatedResult(null)}
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
