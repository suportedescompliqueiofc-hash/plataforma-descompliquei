import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Users, Search, LayoutGrid, List, Loader2,
  BrainCircuit, BookOpen, Clock, TrendingUp, ChevronRight, Mail, Plus, Copy, Check as CheckIcon, Trash2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────
interface ClientRow {
  id: string;              // organization_id (platform_tenants)
  platform_user_id: string | null; // platform_users.id (se existir)
  clinic_name: string | null;
  plan: string | null;
  product_name: string | null;
  has_trilha: boolean;
  cerebro_complete: boolean | null;
  status: string | null;
  trial_ends_at: string | null;
  updated_at: string | null;
  // from perfis
  email: string | null;
  nome_completo: string | null;
  org_name: string | null;
  // computed
  progress?: number;
  lastHealth?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function daysSince(d: string | null) {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function timeAgo(d: string | null): string {
  if (!d) return 'nunca';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

function healthColor(score: number | undefined) {
  if (!score) return 'bg-muted text-muted-foreground';
  if (score >= 70) return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
  if (score >= 40) return 'bg-amber-500/20 text-amber-700 dark:text-amber-400';
  return 'bg-red-500/20 text-red-700 dark:text-red-400';
}

function activityStatus(d: string | null) {
  const days = daysSince(d);
  if (days < 7) return { label: 'Ativo', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' };
  if (days < 14) return { label: 'Inativo', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-400' };
  return { label: 'Crítico', color: 'bg-red-500/20 text-red-700 dark:text-red-400' };
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AdminClientes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  // Filtros
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterActivity, setFilterActivity] = useState('todos');
  const [filterCerebro, setFilterCerebro] = useState('todos');

  // Criar cliente
  const [products, setProducts] = useState<{ id: string; nome: string; duracao_dias?: number }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', clinic_name: '', product_id: '', trial_ends_at: '' });
  const [createdResult, setCreatedResult] = useState<{ email: string; clinic: string; emailSent: boolean } | null>(null);

  // Auto-preenche a data de expiração quando o produto é selecionado
  useEffect(() => {
    const prod = products.find(p => p.id === createForm.product_id);
    if (!prod) { return; }
    if (prod.duracao_dias && prod.duracao_dias < 99999) {
      const d = new Date();
      d.setDate(d.getDate() + prod.duracao_dias);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setCreateForm(f => ({ ...f, trial_ends_at: `${yyyy}-${mm}-${dd}` }));
    } else {
      setCreateForm(f => ({ ...f, trial_ends_at: '' }));
    }
  }, [createForm.product_id, products]);

  // Excluir cliente
  const [deleteTarget, setDeleteTarget] = useState<{ organization_id: string; clinic_name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
        // Identificar orgs que pertencem EXCLUSIVAMENTE a superadmins (sem nenhum admin/atendente real)
        const { data: superadminPapeis } = await supabase
          .from('usuarios_papeis')
          .select('usuario_id')
          .eq('papel', 'superadmin');
        const superadminUserIds = new Set((superadminPapeis || []).map((p: any) => p.usuario_id));

        // Orgs onde ALGUM perfil é superadmin
        const { data: superadminPerfis } = superadminUserIds.size > 0
          ? await supabase.from('perfis').select('id, organization_id').in('id', [...superadminUserIds])
          : { data: [] };

        // Todos os perfis (reutilizados depois para perfilByOrg)
        const { data: todosPerfis } = await supabase
          .from('perfis')
          .select('id, organization_id, nome_completo, email');

        // Orgs com superadmin
        const orgsComSuperadmin = new Set((superadminPerfis || []).map((p: any) => p.organization_id).filter(Boolean));
        // Orgs com usuário que NÃO é superadmin
        const orgsComUsuarioReal = new Set(
          (todosPerfis || [])
            .filter((p: any) => p.organization_id && !superadminUserIds.has(p.id))
            .map((p: any) => p.organization_id)
        );
        // Excluir apenas orgs que têm superadmin mas NÃO têm nenhum usuário real
        const superadminOrgIds = new Set(
          [...orgsComSuperadmin].filter(orgId => !orgsComUsuarioReal.has(orgId))
        );

        // Base: TODOS os tenants (fonte de verdade dos clientes cadastrados), exceto orgs exclusivas de superadmin
        const { data: tenantsRaw } = await supabase
          .from('platform_tenants')
          .select('organization_id, status, trial_ends_at, product_id, pilares_liberados, organizations(name)')
          .order('created_at', { ascending: false });

        const tenants = (tenantsRaw || []).filter((t: any) => !superadminOrgIds.has(t.organization_id));

        // Produtos para mapear nome
        const { data: prods } = await supabase
          .from('platform_products')
          .select('id, nome, pilares_liberados, duracao_dias')
          .eq('ativo', true)
          .order('ordem_index');
        const prodMap: Record<string, { nome: string; has_trilha: boolean }> = {};
        (prods || []).forEach((p: any) => {
          prodMap[p.id] = { nome: p.nome, has_trilha: Array.isArray(p.pilares_liberados) && p.pilares_liberados.length > 0 };
        });
        setProducts((prods || []).map((p: any) => ({ id: p.id, nome: p.nome, duracao_dias: p.duracao_dias })));

        // Perfis por organization_id (email e nome real) — prefere não-superadmin, reutiliza query anterior
        const perfilByOrg: Record<string, { id: string; nome_completo: string | null; email: string | null }> = {};
        (todosPerfis || []).forEach((p: any) => {
          if (!p.organization_id) return;
          const existing = perfilByOrg[p.organization_id];
          // Substituir apenas se atual é superadmin e o novo não é, ou se não há registro ainda
          if (!existing || (superadminUserIds.has(existing.id) && !superadminUserIds.has(p.id))) {
            perfilByOrg[p.organization_id] = p;
          }
        });

        // Platform users por crm_user_id (enriquecimento opcional)
        const { data: platformUsers } = await supabase
          .from('platform_users')
          .select('id, crm_user_id, clinic_name, cerebro_complete, updated_at');
        const puByCrmUser: Record<string, any> = {};
        (platformUsers || []).forEach((pu: any) => {
          if (pu.crm_user_id) puByCrmUser[pu.crm_user_id] = pu;
        });

        // Total de módulos ativos na plataforma (denominador do progresso)
        const { count: totalModulosAtivos } = await supabase
          .from('platform_modules')
          .select('id', { count: 'exact', head: true })
          .eq('active', true);

        // Módulos concluídos por usuário (step=finalize + completed=true)
        const { data: progressDetails } = await supabase
          .from('platform_module_progress_detail')
          .select('user_id, module_id, step, completed')
          .eq('step', 'finalize')
          .eq('completed', true);

        // Agrupa: quantos módulos distintos cada user concluiu
        const progressMap: Record<string, number> = {};
        (progressDetails || []).forEach((p: any) => {
          if (!progressMap[p.user_id]) progressMap[p.user_id] = 0;
          progressMap[p.user_id]++;  // cada registro único é 1 módulo finalizado
        });

        // Health scores mais recentes por platform_user.id
        const { data: health } = await supabase
          .from('admin_client_health')
          .select('client_id, score, created_at')
          .order('created_at', { ascending: false });
        const healthMap: Record<string, number> = {};
        (health || []).forEach((h: any) => {
          if (!healthMap[h.client_id] && h.score != null) healthMap[h.client_id] = h.score;
        });

        // Normaliza status: aceita inglês (Active/Blocked) e português (ativo/bloqueado)
        function normalizeStatus(s: string | null): string {
          const v = (s ?? '').toLowerCase();
          if (v === 'active' || v === 'ativo') return 'ativo';
          if (v === 'blocked' || v === 'bloqueado') return 'bloqueado';
          return v || 'ativo';
        }

        const enriched: ClientRow[] = (tenants || []).map((t: any) => {
          const perfil = perfilByOrg[t.organization_id];
          const pu = perfil?.id ? puByCrmUser[perfil.id] : null;
          const modulosConcluidos = pu ? (progressMap[pu.id] ?? 0) : 0;
          const total = totalModulosAtivos ?? 0;
          const prog = total > 0 ? Math.round((modulosConcluidos / total) * 100) : 0;

          // has_trilha: usa override do tenant se existir, senão padrão do produto
          const tenantPilares: string[] | null = Array.isArray(t.pilares_liberados) ? t.pilares_liberados : null;
          const has_trilha = tenantPilares !== null
            ? tenantPilares.length > 0
            : (t.product_id ? (prodMap[t.product_id]?.has_trilha ?? false) : false);

          return {
            id: t.organization_id,
            platform_user_id: pu?.id ?? null,
            clinic_name: pu?.clinic_name ?? (t.organizations as any)?.name ?? null,
            plan: null,
            product_name: t.product_id ? (prodMap[t.product_id]?.nome ?? null) : null,
            has_trilha,
            cerebro_complete: pu?.cerebro_complete ?? null,
            status: normalizeStatus(t.status),
            trial_ends_at: t.trial_ends_at ?? null,
            updated_at: pu?.updated_at ?? null,
            email: perfil?.email ?? null,
            nome_completo: perfil?.nome_completo ?? null,
            org_name: (t.organizations as any)?.name ?? null,
            progress: prog,
            lastHealth: pu ? healthMap[pu.id] : undefined,
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

  // ── Filtros aplicados ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return clients.filter(c => {
      const name = (c.clinic_name || c.org_name || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const nomeCompleto = (c.nome_completo || '').toLowerCase();
      const q = search.toLowerCase();
      if (search && !name.includes(q) && !email.includes(q) && !nomeCompleto.includes(q)) return false;
      if (filterStatus !== 'todos' && (c.status ?? 'ativo') !== filterStatus) return false;
      if (filterActivity !== 'todos') {
        const days = daysSince(c.updated_at);
        if (filterActivity === 'ativos' && days >= 7) return false;
        if (filterActivity === 'inativos' && (days < 7 || days >= 14)) return false;
        if (filterActivity === 'criticos' && days < 14) return false;
      }
      if (filterCerebro !== 'todos') {
        if (filterCerebro === 'configurado' && !c.cerebro_complete) return false;
        if (filterCerebro === 'vazio' && c.cerebro_complete) return false;
      }
      return true;
    });
  }, [clients, search, filterStatus, filterActivity, filterCerebro]);

  // ── Métricas ────────────────────────────────────────────────────────
  const totalAtivos = clients.filter(c => (c.status ?? 'ativo') === 'ativo').length;
  const totalComProduto = clients.filter(c => c.product_name).length;
  const avgProgress = clients.filter(c => c.platform_user_id).length > 0
    ? Math.round(clients.filter(c => c.platform_user_id).reduce((s, c) => s + (c.progress || 0), 0) / clients.filter(c => c.platform_user_id).length)
    : 0;
  const withCerebro = clients.filter(c => c.cerebro_complete).length;

  // ── Criar cliente ────────────────────────────────────────────────────
  async function handleCreate() {
    if (!createForm.email || !createForm.clinic_name) {
      toast.error('Email e Nome/Clínica são obrigatórios.');
      return;
    }
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('create-platform-user', {
        body: {
          email: createForm.email,
          clinic_name: createForm.clinic_name,
          product_id: createForm.product_id || null,
          trial_ends_at: createForm.trial_ends_at || null,
          monthly_fee: 0,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          try { const b = await ctx.json(); if (b?.error) throw new Error(b.error); } catch (_) {}
        }
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

  // ── Excluir cliente ──────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteConfirm.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar.');
      return;
    }
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('delete-platform-user', {
        body: { organization_id: deleteTarget.organization_id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          try { const b = await ctx.json(); if (b?.error) throw new Error(b.error); } catch (_) {}
        }
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

  // ── Render ────────────────────────────────────────────────────────────
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

      <div className="space-y-6">

      {/* MÉTRICAS RÁPIDAS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: clients.length, icon: Users },
          { label: 'Ativos', value: totalAtivos, icon: TrendingUp },
          { label: 'Com Produto', value: totalComProduto, icon: Users },
          { label: 'Progresso Médio', value: `${avgProgress}%`, icon: BookOpen },
          { label: 'Com Cérebro', value: withCerebro, icon: BrainCircuit },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-muted shrink-0">
              <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</p>
              <p className="text-lg font-black tabular-nums text-foreground font-display">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por nome, email ou clínica..."
            className="pl-9 h-10 text-sm rounded-lg border-border/60"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {[
          { label: 'Status', state: filterStatus, set: setFilterStatus, opts: [['todos','Todos os status'],['ativo','Ativo'],['bloqueado','Bloqueado'],['trial','Trial']] },
          { label: 'Atividade', state: filterActivity, set: setFilterActivity, opts: [['todos','Toda atividade'],['ativos','Ativos (7d)'],['inativos','Inativos (7-14d)'],['criticos','Críticos (14d+)']] },
          { label: 'Cérebro', state: filterCerebro, set: setFilterCerebro, opts: [['todos','Todos'],['configurado','Configurado'],['vazio','Vazio']] },
        ].map(f => (
          <select
            key={f.label}
            value={f.state}
            onChange={e => f.set(e.target.value)}
            className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm min-w-36 text-foreground"
          >
            {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <div className="flex gap-0.5 bg-muted/40 rounded-xl p-1 ml-auto">
          <button onClick={() => setView('cards')} className={cn('p-1.5 rounded-lg transition-all', view === 'cards' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setView('table')} className={cn('p-1.5 rounded-lg transition-all', view === 'table' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* RESULTADO */}
      <p className="text-xs text-muted-foreground">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/60 bg-muted/[0.02]">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Users className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum cliente encontrado</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Não há clientes correspondentes aos filtros atuais</p>
        </div>
      ) : view === 'cards' ? (
        /* ── CARDS ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const activity = c.updated_at ? activityStatus(c.updated_at) : null;
            return (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden group hover:shadow-md hover:border-border/80 transition-all">
                <div className="p-5 space-y-4">
                  {/* Header do card */}
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-foreground/70">
                        {(c.nome_completo || c.clinic_name || c.org_name || 'C').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.nome_completo || c.clinic_name || c.org_name || 'Sem nome'}</p>
                      {(c.clinic_name || c.org_name) && c.nome_completo && (
                        <p className="text-xs text-muted-foreground truncate">{c.clinic_name || c.org_name}</p>
                      )}
                      {c.email && (
                        <p className="text-[11px] text-muted-foreground/70 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 shrink-0" /> {c.email}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0',
                      c.status === 'bloqueado'
                        ? 'bg-red-500/10 text-red-600 border-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    )}>
                      {c.status === 'bloqueado' ? 'Bloqueado' : 'Ativo'}
                    </span>
                  </div>

                  {/* Produto */}
                  {c.product_name && (
                    <p className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1.5 rounded-lg truncate border border-border/40">
                      {c.product_name}
                    </p>
                  )}

                  {/* Progresso */}
                  {c.platform_user_id && c.has_trilha && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Trilha de Aprendizado</span>
                        <span className="font-bold text-foreground tabular-nums font-mono">{c.progress ?? 0}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-foreground/40 rounded-full transition-all" style={{ width: `${c.progress ?? 0}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {activity && (
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', activity.color)}>
                        {activity.label}
                      </span>
                    )}
                    {c.platform_user_id && (
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1',
                        c.cerebro_complete
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border-border/40'
                      )}>
                        <BrainCircuit className="h-2.5 w-2.5" />
                        {c.cerebro_complete ? 'Cérebro OK' : 'Cérebro vazio'}
                      </span>
                    )}
                    {c.lastHealth != null && (
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', healthColor(c.lastHealth))}>
                        Health {c.lastHealth}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rodapé */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/20">
                  <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {c.updated_at ? timeAgo(c.updated_at) : 'Sem acesso'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => { setDeleteTarget({ organization_id: c.id, clinic_name: c.clinic_name || c.org_name || 'Cliente' }); setDeleteConfirm(''); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => navigate(`/admin/clientes/${c.id}`)}
                    >
                      Ver perfil <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABELA ── */
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/[0.03]">
                  {['Cliente','Email','Produto','Progresso','Cérebro','Último Acesso','Ações'].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map(c => {
                  const activity = c.updated_at ? activityStatus(c.updated_at) : null;
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-foreground/60">{(c.nome_completo || c.clinic_name || c.org_name || 'C').charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-[13px]">{c.nome_completo || c.clinic_name || c.org_name || '—'}</p>
                            {(c.clinic_name || c.org_name) && c.nome_completo && (
                              <p className="text-[11px] text-muted-foreground">{c.clinic_name || c.org_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-muted-foreground">{c.email || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-muted-foreground">{c.product_name || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.platform_user_id && c.has_trilha ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-foreground/40 rounded-full" style={{ width: `${c.progress ?? 0}%` }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums font-mono">{c.progress ?? 0}%</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {c.platform_user_id ? (
                          <span className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                            c.cerebro_complete ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border/40'
                          )}>
                            {c.cerebro_complete ? 'Configurado' : 'Vazio'}
                          </span>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {activity ? (
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', activity.color)}>{activity.label}</span>
                        ) : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40">Sem acesso</span>}
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{c.updated_at ? timeAgo(c.updated_at) : '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => navigate(`/admin/clientes/${c.id}`)}>
                          Ver perfil <ChevronRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>

      {/* MODAL — CRIAR CLIENTE */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Select
                value={createForm.product_id || '__none__'}
                onValueChange={v => setCreateForm(f => ({ ...f, product_id: v === '__none__' ? '' : v }))}
              >
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
                    <Input
                      className="h-10 text-sm rounded-lg border-border/60"
                      type="date"
                      value={createForm.trial_ends_at}
                      onChange={e => setCreateForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                    />
                  )}
                  {selectedProd && !isVitalicio && selectedProd.duracao_dias && (
                    <p className="text-[10px] text-muted-foreground/50">
                      Calculado automaticamente: {selectedProd.duracao_dias} dias a partir de hoje
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Criando...</> : 'Criar Acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL — CONFIRMAR EXCLUSÃO */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Excluir Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir <strong>{deleteTarget?.clinic_name}</strong> permanentemente. Esta ação não pode ser desfeita e removerá todos os dados associados.
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Digite <span className="font-mono font-bold text-red-600">EXCLUIR</span> para confirmar</Label>
              <Input
                placeholder="EXCLUIR"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                className="border-red-200 focus-visible:ring-red-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              className="h-9 rounded-lg text-xs font-semibold"
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirm.trim().toUpperCase() !== 'EXCLUIR'}
            >
              {isDeleting ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Excluindo...</> : 'Excluir Permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL — ACESSO CRIADO */}
      <Dialog open={!!createdResult} onOpenChange={o => !o && setCreatedResult(null)}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center text-center py-4 px-2 gap-3">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${createdResult?.emailSent ? 'bg-emerald-100' : 'bg-muted'}`}>
              {createdResult?.emailSent
                ? <CheckIcon className="h-7 w-7 text-emerald-600" />
                : <CheckIcon className="h-7 w-7 text-muted-foreground" />
              }
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground font-display mb-1">Acesso criado com sucesso!</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xs">
                {createdResult?.emailSent
                  ? <>Email de boas-vindas com o link de acesso enviado para <strong className="text-foreground">{createdResult.email}</strong>.</>
                  : <>Acesso liberado para <strong className="text-foreground">{createdResult?.email}</strong>. O email de boas-vindas não foi enviado — verifique as configurações do Resend.</>
                }
              </p>
              {createdResult?.emailSent && (
                <p className="text-[11px] text-muted-foreground/50 mt-2">O link de acesso expira em 24 horas.</p>
              )}
            </div>
            <Button
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-6 mt-2"
              onClick={() => setCreatedResult(null)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
