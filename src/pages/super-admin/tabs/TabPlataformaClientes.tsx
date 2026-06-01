import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Users, Plus, RefreshCw, MoreVertical, Eye, Edit, Trash2,
  CheckCircle2, TrendingUp, AlertTriangle, Settings, Award,
  Mail, Building2, Stethoscope, CreditCard, CalendarDays,
  MailCheck, Loader2, ChevronRight, BarChart3,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ORG_ID } from '@/lib/constants';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PlatformUser {
  id: string;
  clinic_name: string;
  specialty?: string;
  plan: string;
  cerebro_complete?: boolean;
  onboarding_complete?: boolean;
  created_at: string;
  email?: string;
  nome_completo?: string;
  progress_percent?: number;
  modules_done?: number;
}

interface Product {
  id: string;
  nome: string;
  plano?: string;
  duracao_dias?: number;
}

// ─── Label helpers ─────────────────────────────────────────────────────────────
const PLAN_LABEL: Record<string, string> = { gca: 'G.C.A.', pca: 'P.C.A.', basic: 'Básico' };
const planLabel = (p: string) => PLAN_LABEL[p] ?? p.toUpperCase();
const planColor = (p: string) =>
  p === 'gca' ? 'bg-[#E85D24]/10 text-[#E85D24] border-[#E85D24]/20' : 'bg-muted/60 text-muted-foreground border-border/40';

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TabPlataformaClientes() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

  // Add form
  const [addForm, setAddForm] = useState({
    email: '',
    responsible_name: '',
    clinic_name: '',
    specialty: '',
    product_id: '',
    monthly_fee: '',
    trial_ends_at: '',
    send_welcome: true,
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState<{ email: string; isExisting: boolean; emailSent: boolean; resendError?: string | null } | null>(null);

  // Edit plan form
  const [newProductId, setNewProductId] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const [{ data: pUsers }, { data: profiles }, { data: progress }] = await Promise.all([
      supabase.from('platform_users').select('*').order('created_at', { ascending: false }),
      supabase.from('perfis').select('id, email, nome_completo'),
      supabase.from('platform_module_progress_detail').select('user_id, completed').eq('completed', true),
    ]);

    if (pUsers) {
      const enriched = pUsers.map(pu => {
        const profile = profiles?.find(p => p.id === pu.id);
        const done = progress?.filter(p => p.user_id === pu.id).length ?? 0;
        const pct = Math.min(Math.round((done / 18) * 100), 100);
        return {
          ...pu,
          email: profile?.email ?? 'Desconhecido',
          nome_completo: profile?.nome_completo ?? '',
          progress_percent: pct,
          modules_done: done,
        };
      });
      setUsers(enriched);
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from('platform_products').select('id, nome, plano, duracao_dias').order('nome');
    if (data) setProducts(data);
  };

  useEffect(() => {
    loadData();
    loadProducts();
  }, []);

  // ── Submit: Novo Acesso ─────────────────────────────────────────────────────
  const handleAddSubmit = async () => {
    if (!addForm.email || !addForm.clinic_name) {
      toast.error('Preencha o email e o nome da clínica.');
      return;
    }
    setAddLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-platform-user', {
        body: {
          email: addForm.email.trim().toLowerCase(),
          responsible_name: addForm.responsible_name.trim() || addForm.clinic_name.trim(),
          clinic_name: addForm.clinic_name.trim(),
          specialty: addForm.specialty.trim() || 'A definir',
          product_id: addForm.product_id || null,
          monthly_fee: addForm.monthly_fee ? parseFloat(addForm.monthly_fee) : 0,
          trial_ends_at: addForm.trial_ends_at || null,
          send_welcome: addForm.send_welcome,
          site_url: window.location.origin,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? 'Erro ao criar acesso.');
        return;
      }

      setAddSuccess({
        email: addForm.email.trim().toLowerCase(),
        isExisting: data.is_existing,
        emailSent: data.email_sent,
        resendError: data.resend_error ?? null,
      });
      loadData();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro inesperado.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setAddForm({ email: '', responsible_name: '', clinic_name: '', specialty: '', product_id: '', monthly_fee: '', trial_ends_at: '', send_welcome: true });
    setAddSuccess(null);
    setShowAddModal(true);
  };

  const handleCloseAdd = () => {
    setShowAddModal(false);
    setAddSuccess(null);
  };

  // ── Submit: Editar Plano ────────────────────────────────────────────────────
  const handleEditPlan = async () => {
    if (!selectedUser || !newProductId) return;
    setEditLoading(true);
    const prod = products.find(p => p.id === newProductId);
    await supabase.from('platform_users').update({ plan: prod?.plano ?? 'pca' }).eq('id', selectedUser.id);
    // Also update tenant product
    const { data: perfil } = await supabase.from('perfis').select('organization_id').eq('id', selectedUser.id).maybeSingle();
    if (perfil?.organization_id) {
      await supabase.from('platform_tenants').update({ product_id: newProductId }).eq('organization_id', perfil.organization_id);
    }
    toast.success('Plano atualizado com sucesso.');
    setEditLoading(false);
    setShowEditPlan(false);
    loadData();
  };

  // ── Submit: Resetar Progresso ───────────────────────────────────────────────
  const handleResetProgress = async () => {
    if (!selectedUser) return;
    await supabase.from('platform_module_progress_detail').delete().eq('user_id', selectedUser.id);
    toast.success('Progresso resetado.');
    setShowReset(false);
    loadData();
  };

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const total = users.length;
  const countGCA = users.filter(u => u.plan === 'gca').length;
  const countPCA = users.filter(u => u.plan === 'pca').length;
  const avgProgress = total > 0 ? Math.round(users.reduce((a, u) => a + (u.progress_percent ?? 0), 0) / total) : 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total na Plataforma', value: total, icon: Users, color: '#3b82f6' },
          { label: 'Assinantes G.C.A.', value: countGCA, icon: Award, color: '#E85D24' },
          { label: 'Assinantes P.C.A.', value: countPCA, icon: TrendingUp, color: '#8b5cf6' },
          { label: 'Progresso Médio', value: `${avgProgress}%`, icon: CheckCircle2, color: '#10b981' },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: m.color + '15' }}>
                  <Icon className="h-4 w-4" style={{ color: m.color }} />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-bold font-display text-foreground leading-tight">{m.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Header + Ação ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-foreground font-display">Clientes Ativos</h2>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{total} clientes com acesso à plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="h-8 px-3 rounded-lg text-[11px] font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Atualizar
          </button>
          <button
            onClick={handleOpenAdd}
            className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Liberar Acesso
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_40px] gap-4 px-5 py-3 border-b border-border/40 bg-muted/[0.03]">
          {['Clínica / Responsável', 'Plano', 'Progresso', 'Módulos', 'Cérebro', ''].map(h => (
            <span key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/40">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_40px] gap-4 px-5 py-4 items-center">
                <div><Skeleton className="h-3.5 w-40 mb-1.5" /><Skeleton className="h-3 w-28" /></div>
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3.5 w-12 mx-auto" />
                <Skeleton className="h-3.5 w-16 mx-auto" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            ))
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3"><Users className="h-6 w-6 text-muted-foreground/40" /></div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum cliente ativo</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Clique em "Liberar Acesso" para adicionar o primeiro</p>
            </div>
          ) : users.map(u => (
            <div key={u.id} className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_40px] gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors">
              {/* Clínica */}
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{u.clinic_name}</p>
                <p className="text-[11px] text-muted-foreground/60 truncate">{u.email}</p>
              </div>
              {/* Plano */}
              <span className={cn('inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border', planColor(u.plan))}>
                {planLabel(u.plan)}
              </span>
              {/* Progresso */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${u.progress_percent ?? 0}%` }} />
                </div>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-8 text-right">{u.progress_percent ?? 0}%</span>
              </div>
              {/* Módulos */}
              <span className="text-[12px] font-mono text-muted-foreground text-center">{u.modules_done ?? 0}/18</span>
              {/* Cérebro */}
              <div className="flex justify-center">
                {u.cerebro_complete
                  ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />OK</span>
                  : <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500"><AlertTriangle className="h-3.5 w-3.5" />Pendente</span>
                }
              </div>
              {/* Ações */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem
                    onClick={() => window.open('/plataforma', '_blank')}
                    className="text-[#3b82f6] focus:text-[#3b82f6] font-medium"
                  >
                    <Eye className="mr-2 h-4 w-4" /> Ver como cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      localStorage.setItem('original_master_org_id', MASTER_ORG_ID);
                      window.open('/crm', '_blank', 'noopener,noreferrer');
                    }}
                    className="text-[#E85D24] focus:text-[#E85D24] font-medium"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" /> Acessar CRM do cliente
                  </DropdownMenuItem>
                  <div className="h-px bg-border my-1" />
                  <DropdownMenuItem onClick={() => { setSelectedUser(u); setNewProductId(products[0]?.id ?? ''); setShowEditPlan(true); }}>
                    <Edit className="mr-2 h-4 w-4" /> Editar plano
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedUser(u); setShowReset(true); }} className="text-red-500 focus:text-red-500">
                    <Trash2 className="mr-2 h-4 w-4" /> Resetar progresso
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MODAL: Liberar Acesso
      ═══════════════════════════════════════════════ */}
      <Dialog open={showAddModal} onOpenChange={handleCloseAdd}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-display font-bold tracking-tight">
              {addSuccess ? 'Acesso liberado!' : 'Liberar Acesso à Plataforma'}
            </DialogTitle>
          </DialogHeader>

          {addSuccess ? (
            /* ── Success State ── */
            <div className="flex flex-col items-center text-center py-6 px-2">
              <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl mb-4', addSuccess.emailSent ? 'bg-emerald-100' : 'bg-muted')}>
                {addSuccess.emailSent
                  ? <MailCheck className="h-7 w-7 text-emerald-600" />
                  : <CheckCircle2 className="h-7 w-7 text-muted-foreground" />
                }
              </div>
              <h3 className="text-[15px] font-bold text-foreground font-display mb-1">
                {addSuccess.isExisting ? 'Acesso atualizado!' : 'Acesso criado com sucesso!'}
              </h3>
              <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed mb-1">
                {addSuccess.emailSent
                  ? <>Email de boas-vindas enviado para <strong className="text-foreground">{addSuccess.email}</strong> com o link de acesso.</>
                  : <>Acesso criado para <strong className="text-foreground">{addSuccess.email}</strong>. O email de boas-vindas não foi enviado.</>
                }
              </p>
              {addSuccess.emailSent && (
                <p className="text-[11px] text-muted-foreground/50 mt-1">O magic link expira em 24 horas.</p>
              )}
              {!addSuccess.emailSent && addSuccess.resendError && (
                <div className="mt-3 w-full rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">Erro do Resend</p>
                  <p className="text-[11px] text-red-700 font-mono break-all">{addSuccess.resendError}</p>
                </div>
              )}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleCloseAdd}
                  className="h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => { setAddSuccess(null); setAddForm({ email: '', responsible_name: '', clinic_name: '', specialty: '', product_id: '', monthly_fee: '', trial_ends_at: '', send_welcome: true }); }}
                  className="h-9 px-4 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Novo acesso
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="overflow-y-auto flex-1 pr-1">
                <div className="space-y-5 py-1">

                  {/* Acesso */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Dados de Acesso</p>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3 w-3" />E-mail
                      </label>
                      <Input
                        type="email"
                        placeholder="email@clinica.com"
                        value={addForm.email}
                        onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                        className="h-10 text-sm rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60"
                      />
                      <p className="text-[10px] text-muted-foreground/50">Se já tiver conta, o acesso será atualizado.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3 w-3" />Nome do Responsável
                      </label>
                      <Input
                        placeholder="Dra. Maria Silva"
                        value={addForm.responsible_name}
                        onChange={e => setAddForm(f => ({ ...f, responsible_name: e.target.value }))}
                        className="h-10 text-sm rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60"
                      />
                    </div>
                  </div>

                  {/* Clínica */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Dados da Clínica</p>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />Nome da Clínica
                      </label>
                      <Input
                        placeholder="Clínica Odontológica Silva"
                        value={addForm.clinic_name}
                        onChange={e => setAddForm(f => ({ ...f, clinic_name: e.target.value }))}
                        className="h-10 text-sm rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Stethoscope className="h-3 w-3" />Especialidade
                      </label>
                      <Input
                        placeholder="Ex: Harmonização Facial"
                        value={addForm.specialty}
                        onChange={e => setAddForm(f => ({ ...f, specialty: e.target.value }))}
                        className="h-10 text-sm rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60"
                      />
                    </div>
                  </div>

                  {/* Plano */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Plano e Cobrança</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Award className="h-3 w-3" />Produto
                        </label>
                        <select
                          value={addForm.product_id}
                          onChange={e => {
                            const prod = products.find(p => p.id === e.target.value);
                            let trialDate = '';
                            if (prod && prod.duracao_dias && prod.duracao_dias < 99999) {
                              const d = new Date();
                              d.setDate(d.getDate() + prod.duracao_dias);
                              trialDate = d.toISOString().split('T')[0];
                            }
                            setAddForm(f => ({ ...f, product_id: e.target.value, trial_ends_at: trialDate }));
                          }}
                          className="flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border/60"
                        >
                          <option value="">Sem produto</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <CreditCard className="h-3 w-3" />Mensalidade (R$)
                        </label>
                        <Input
                          type="number"
                          placeholder="0,00"
                          value={addForm.monthly_fee}
                          onChange={e => setAddForm(f => ({ ...f, monthly_fee: e.target.value }))}
                          className="h-10 text-sm rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60"
                        />
                      </div>
                    </div>
                    {(() => {
                      const selectedProd = products.find(p => p.id === addForm.product_id);
                      const isVitalicio = selectedProd && (selectedProd.duracao_dias ?? 0) >= 99999;
                      return (
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <CalendarDays className="h-3 w-3" />Validade do Acesso
                          </label>
                          {isVitalicio ? (
                            <div className="h-10 rounded-lg border border-border/40 bg-muted/30 px-3 flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Vitalício — sem expiração</span>
                            </div>
                          ) : (
                            <Input
                              type="date"
                              value={addForm.trial_ends_at}
                              onChange={e => setAddForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                              className="h-10 text-sm rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60"
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

                  {/* Email toggle */}
                  <div
                    onClick={() => setAddForm(f => ({ ...f, send_welcome: !f.send_welcome }))}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all',
                      addForm.send_welcome
                        ? 'border-emerald-200/60 bg-emerald-50/40'
                        : 'border-border/60 bg-muted/20'
                    )}
                  >
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg shrink-0 transition-colors',
                      addForm.send_welcome ? 'bg-emerald-100' : 'bg-muted'
                    )}>
                      <Mail className={cn('h-4 w-4', addForm.send_welcome ? 'text-emerald-600' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[13px] font-semibold', addForm.send_welcome ? 'text-emerald-800' : 'text-foreground')}>
                        Enviar email de boas-vindas
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        Magic link para acesso imediato sem senha
                      </p>
                    </div>
                    <div className={cn(
                      'h-5 w-9 rounded-full transition-colors relative',
                      addForm.send_welcome ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                        addForm.send_welcome ? 'translate-x-4' : 'translate-x-0.5'
                      )} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/40 shrink-0">
                <button
                  onClick={handleCloseAdd}
                  className="h-9 px-4 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddSubmit}
                  disabled={addLoading || !addForm.email || !addForm.clinic_name}
                  className="h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {addLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Criando...</>
                  ) : (
                    <><Mail className="h-3.5 w-3.5" />Liberar Acesso</>
                  )}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          MODAL: Editar Plano
      ═══════════════════════════════════════════════ */}
      <Dialog open={showEditPlan} onOpenChange={setShowEditPlan}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-bold tracking-tight">Editar Plano</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-[11px] text-muted-foreground/60 mb-3">
                Cliente: <span className="font-semibold text-foreground">{selectedUser?.clinic_name}</span>
              </p>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Novo Produto</label>
              <select
                value={newProductId}
                onChange={e => setNewProductId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border/60"
              >
                <option value="">Selecione...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
            <button onClick={() => setShowEditPlan(false)} className="h-9 px-4 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleEditPlan}
              disabled={editLoading || !newProductId}
              className="h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {editLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Salvar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          MODAL: Resetar Progresso
      ═══════════════════════════════════════════════ */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-bold tracking-tight text-red-600">Resetar Progresso</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground leading-relaxed py-2">
            Todo o histórico de módulos concluídos de <strong className="text-foreground">{selectedUser?.clinic_name}</strong> será apagado. Esta ação não pode ser desfeita.
          </p>
          <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
            <button onClick={() => setShowReset(false)} className="h-9 px-4 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleResetProgress}
              className="h-9 px-5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Resetar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
