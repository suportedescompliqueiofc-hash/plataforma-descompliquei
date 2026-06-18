import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus, Pencil, Power, Layers, BookOpen,
  CheckSquare2, Loader2, Trash2, Bot, MessageSquare,
  Clock, Swords, Users, AlertTriangle, BarChart3, Settings2,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  duracao_dias: number;
  acesso_crm: boolean;
  acesso_arsenal: boolean;
  acesso_os: boolean;
  acesso_sessoes_taticas: boolean;
  acesso_materiais: boolean;
  ativo: boolean;
  ordem_index: number;
}

interface Tenant {
  organization_id: string;
  status: string;
  trial_ends_at: string | null;
  product_id: string | null;
  organizations: { name: string } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<Produto, 'id' | 'ordem_index'> = {
  nome: '',
  descricao: '',
  preco_mensal: 0,
  duracao_dias: 30,
  acesso_crm: false,
  acesso_arsenal: false,
  acesso_os: false,
  acesso_sessoes_taticas: false,
  acesso_materiais: false,
  ativo: true,
};

const FUNCIONALIDADES = [
  { key: 'acesso_crm',             label: 'CRM',             desc: 'Gestão de leads e WhatsApp',               icon: MessageSquare },
  { key: 'acesso_arsenal',         label: 'Arsenal',         desc: 'Aulas em vídeo e ferramentas comerciais',  icon: Swords },
  { key: 'acesso_os',              label: 'Athos GS',        desc: 'Agente estratégico e jornada personalizada', icon: Bot },
  { key: 'acesso_sessoes_taticas', label: 'Sessões Táticas', desc: 'Sessões de acompanhamento',                icon: CheckSquare2 },
  { key: 'acesso_materiais',       label: 'Materiais',       desc: 'Materiais complementares',                 icon: BookOpen },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDiasRestantes(trial_ends_at: string | null): number | null {
  if (!trial_ends_at) return null;
  return differenceInDays(parseISO(trial_ends_at), new Date());
}

function StatusTenant({ status, diasRestantes }: { status: string; diasRestantes: number | null }) {
  if (status === 'inactive' || status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        Inativo
      </span>
    );
  }
  if (diasRestantes !== null && diasRestantes < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Expirado
      </span>
    );
  }
  if (diasRestantes !== null && diasRestantes <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Expira em breve
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Ativo
    </span>
  );
}

// ─── Tab: Uso & Clientes ─────────────────────────────────────────────────────

function TabUsoClientes({ produtos }: { produtos: Produto[] }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('platform_tenants')
        .select('organization_id, status, trial_ends_at, product_id, organizations(name)')
        .order('trial_ends_at', { ascending: true });
      setTenants((data as Tenant[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  // Clientes sem produto vinculado
  const semProduto = tenants.filter(t => !t.product_id);

  // Estatísticas globais — mesma lógica do badge StatusTenant
  const totalAtivos = tenants.filter(t => {
    const d = calcDiasRestantes(t.trial_ends_at);
    const cancelado = t.status === 'inactive' || t.status === 'cancelled';
    return !cancelado && (d === null || d >= 0);
  }).length;
  const expirando = tenants.filter(t => {
    const d = calcDiasRestantes(t.trial_ends_at);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const expirados = tenants.filter(t => {
    const d = calcDiasRestantes(t.trial_ends_at);
    return d !== null && d < 0;
  }).length;

  return (
    <div className="space-y-6">

      {/* Resumo global */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Clientes Ativos', value: totalAtivos, color: 'text-emerald-500' },
          { label: 'Vencendo em 30 dias', value: expirando, color: 'text-amber-500' },
          { label: 'Expirados', value: expirados, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Por produto */}
      {produtos.map(produto => {
        const clientesDoProduto = tenants.filter(t => t.product_id === produto.id);
        if (clientesDoProduto.length === 0) return null;

        return (
          <div key={produto.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{produto.nome}</p>
                  {produto.descricao && (
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{produto.descricao}</p>
                  )}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/60 border border-border/40 px-2.5 py-1 rounded-lg">
                <Users className="h-3 w-3" />
                {clientesDoProduto.length} cliente{clientesDoProduto.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Lista de clientes */}
            <div className="divide-y divide-border/30">
              {clientesDoProduto.map(t => {
                const dias = calcDiasRestantes(t.trial_ends_at);
                const nome = t.organizations?.name || t.organization_id.slice(0, 8) + '...';
                const expirado = dias !== null && dias < 0;
                const urgente = dias !== null && dias >= 0 && dias <= 7;
                const expirando = dias !== null && dias >= 0 && dias <= 30 && !urgente;

                return (
                  <div
                    key={t.organization_id}
                    className={cn(
                      'flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/20',
                      expirado && 'bg-red-500/[0.02]',
                      urgente && 'bg-amber-500/[0.03]',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0',
                        expirado ? 'bg-red-500/10 text-red-600' :
                        urgente ? 'bg-amber-500/10 text-amber-600' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{nome}</p>
                        {t.trial_ends_at && (
                          <p className="text-[11px] text-muted-foreground/60">
                            Vence em {new Date(t.trial_ends_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {/* Dias restantes */}
                      {dias !== null && (
                        <div className={cn(
                          'text-right',
                          expirado ? 'text-red-500' :
                          urgente ? 'text-amber-500' :
                          expirando ? 'text-amber-400' :
                          'text-muted-foreground'
                        )}>
                          {expirado ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold">
                              <AlertTriangle className="h-3 w-3" />
                              {Math.abs(dias)}d expirado
                            </span>
                          ) : (
                            <span className="text-[12px] font-semibold tabular-nums">
                              {dias}d restantes
                            </span>
                          )}
                        </div>
                      )}
                      {dias === null && (
                        <span className="text-[11px] text-muted-foreground/50">Vitalício</span>
                      )}

                      <StatusTenant status={t.status} diasRestantes={dias} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Sem produto vinculado */}
      {semProduto.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-amber-500/[0.03] flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Sem produto vinculado</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{semProduto.length} cliente{semProduto.length !== 1 ? 's' : ''} sem plano definido</p>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {semProduto.map(t => (
              <div key={t.organization_id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                    {(t.organizations?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[13px] font-medium text-foreground">{t.organizations?.name || t.organization_id.slice(0, 8) + '...'}</p>
                </div>
                <StatusTenant status={t.status} diasRestantes={calcDiasRestantes(t.trial_ends_at)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminProdutos() {
  const [activeTab, setActiveTab] = useState<'produtos' | 'uso'>('produtos');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Produto, 'id' | 'ordem_index'>>(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('platform_products')
        .select('*')
        .order('ordem_index');
      if (error) throw error;
      setProdutos((data as Produto[]) || []);
    } catch {
      toast.error('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(p: Produto) {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      descricao: p.descricao || '',
      preco_mensal: p.preco_mensal,
      duracao_dias: p.duracao_dias,
      acesso_crm: p.acesso_crm ?? false,
      acesso_arsenal: p.acesso_arsenal ?? false,
      acesso_os: p.acesso_os ?? false,
      acesso_sessoes_taticas: p.acesso_sessoes_taticas ?? false,
      acesso_materiais: p.acesso_materiais ?? false,
      ativo: p.ativo,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await (supabase as any)
          .from('platform_products')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Produto atualizado.');
      } else {
        const maxIdx = produtos.length ? Math.max(...produtos.map(p => p.ordem_index)) + 1 : 1;
        const { error } = await (supabase as any)
          .from('platform_products')
          .insert({ ...form, ordem_index: maxIdx });
        if (error) throw error;
        toast.success('Produto criado.');
      }
      setModalOpen(false);
      loadData();
    } catch {
      toast.error('Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('platform_products')
        .delete()
        .eq('id', deleteId);
      if (error) throw error;
      toast.success('Produto excluído.');
      setDeleteId(null);
      loadData();
    } catch {
      toast.error('Erro ao excluir. Verifique se não está em uso por algum cliente.');
    } finally {
      setDeleting(false);
    }
  }

  async function toggleAtivo(p: Produto) {
    const { error } = await (supabase as any)
      .from('platform_products')
      .update({ ativo: !p.ativo })
      .eq('id', p.id);
    if (error) { toast.error('Erro ao alterar status.'); return; }
    toast.success(p.ativo ? 'Produto desativado.' : 'Produto ativado.');
    loadData();
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Produtos</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Planos, funcionalidades e uso por cliente</p>
        </div>
        {activeTab === 'produtos' && (
          <Button
            onClick={openCreate}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Novo Produto
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center bg-muted/40 rounded-xl p-1 gap-0.5">
        {[
          { id: 'produtos' as const, label: 'Produtos', icon: Settings2 },
          { id: 'uso' as const, label: 'Uso & Clientes', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Produtos ── */}
      {activeTab === 'produtos' && (
        loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : produtos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Layers className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum produto cadastrado</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Crie o primeiro plano da plataforma</p>
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-4 gap-1.5 h-8 rounded-lg text-[11px]">
              <Plus className="h-3.5 w-3.5" /> Criar produto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {produtos.map(p => (
              <div
                key={p.id}
                className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-opacity"
                style={{ opacity: p.ativo ? 1 : 0.5 }}
              >
                {/* Header do card */}
                <div className="px-5 pt-5 pb-4 border-b border-border/40">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-[15px] font-bold text-foreground font-display leading-tight flex-1 min-w-0">
                      {p.nome}
                    </h3>
                    <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      p.ativo
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border/40'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${p.ativo ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {p.descricao && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{p.descricao}</p>
                  )}
                </div>

                {/* Corpo */}
                <div className="px-5 py-4 space-y-4 flex-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="text-[12px] text-muted-foreground">
                      {p.duracao_dias >= 99999
                        ? <span className="font-semibold text-foreground">Acesso vitalício</span>
                        : <><span className="font-semibold text-foreground">{p.duracao_dias} dias</span> de acesso</>
                      }
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Funcionalidades</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FUNCIONALIDADES.map(f => {
                        const on = p[f.key as keyof Produto] as boolean;
                        return (
                          <div
                            key={f.key}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border transition-colors ${
                              on ? 'bg-foreground/[0.04] border-foreground/10' : 'bg-transparent border-border/30 opacity-40'
                            }`}
                          >
                            <f.icon className={`h-3 w-3 shrink-0 ${on ? 'text-foreground' : 'text-muted-foreground'}`} />
                            <span className={`text-[11px] font-medium truncate ${on ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {f.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/40 bg-muted/[0.03]">
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10"
                    onClick={() => setDeleteId(p.id)}
                    title="Excluir produto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm" variant="outline"
                      className={`h-8 text-[11px] font-medium gap-1.5 border-border/60 rounded-lg px-3 ${
                        p.ativo ? 'text-muted-foreground hover:text-red-500 hover:border-red-200' : 'text-emerald-600 hover:border-emerald-300'
                      }`}
                      onClick={() => toggleAtivo(p)}
                    >
                      <Power className="h-3 w-3" />
                      {p.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-[11px] font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 rounded-lg px-3"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Tab: Uso & Clientes ── */}
      {activeTab === 'uso' && <TabUsoClientes produtos={produtos} />}

      {/* Modal — Confirmar exclusão */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Excluir produto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza? Esta ação é <strong>irreversível</strong> e pode afetar clientes que utilizam este produto.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={deleting} className="h-9 rounded-lg text-xs font-semibold gap-1.5 bg-red-600 hover:bg-red-700 text-white">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <section className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Informações Gerais</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Nome do produto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    className="h-10 rounded-lg border-border/60 text-sm"
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Plano Essencial"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
                  <Textarea
                    className="rounded-lg border-border/60 text-sm"
                    value={form.descricao || ''}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Descreva o que está incluído neste plano..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Duração do acesso
                    </Label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Switch
                        checked={form.duracao_dias >= 99999}
                        onCheckedChange={val => setForm(f => ({ ...f, duracao_dias: val ? 99999 : 30 }))}
                      />
                      <span className="text-xs text-muted-foreground">Vitalício</span>
                    </label>
                  </div>
                  {form.duracao_dias < 99999 ? (
                    <Input
                      type="number" min={1}
                      className="h-10 rounded-lg border-border/60 text-sm"
                      value={form.duracao_dias}
                      onChange={e => setForm(f => ({ ...f, duracao_dias: Number(e.target.value) }))}
                      placeholder="Dias de acesso"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">Sem data de expiração</p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Funcionalidades do Sistema</h3>
              <div className="space-y-2">
                {FUNCIONALIDADES.map(f => (
                  <div key={f.key} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <f.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={form[f.key as keyof typeof form] as boolean}
                      onCheckedChange={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
