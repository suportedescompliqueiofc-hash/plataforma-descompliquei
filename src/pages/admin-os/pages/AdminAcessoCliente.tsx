import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Save, Users, CheckSquare2, BookOpen, Zap, Sparkles,
  Check, X as XIcon, Settings, CalendarDays, KeyRound,
} from 'lucide-react';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Produto {
  id: string;
  nome: string;
  duracao_dias: number;
  acesso_crm: boolean;
  acesso_arsenal: boolean;
  acesso_materiais: boolean;
  acesso_sessoes_taticas: boolean;
  acesso_os: boolean;
}

interface ClienteData {
  organization_id: string;
  status: string;
  trial_ends_at: string | null;
  notes: string | null;
  product_id: string | null;
  access_starts_at: string | null;
  platform_user_id: string | null;
  clinic_name: string;
  email: string;
  created_at: string | null;
  // feature overrides
  acesso_crm: boolean | null;
  acesso_arsenal: boolean | null;
  acesso_materiais: boolean | null;
  acesso_sessoes_taticas: boolean | null;
  acesso_os: boolean | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const FUNCIONALIDADES = [
  { key: 'acesso_crm',             label: 'CRM',             icon: Users },
  { key: 'acesso_arsenal',         label: 'Arsenal',         icon: Zap },
  { key: 'acesso_materiais',       label: 'Materiais',       icon: BookOpen },
  { key: 'acesso_sessoes_taticas', label: 'Sessões Táticas', icon: CheckSquare2 },
  { key: 'acesso_os',              label: 'Athos GS',        icon: Sparkles },
] as const;

type FeatureKey = typeof FUNCIONALIDADES[number]['key'];

// ── Component ──────────────────────────────────────────────────────────────────
export default function AdminAcessoCliente({ orgId: propOrgId }: { orgId?: string } = {}) {
  const { orgId: paramOrgId } = useParams<{ orgId: string }>();
  const orgId = propOrgId ?? paramOrgId;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [featureOverrides, setFeatureOverrides] = useState<Record<FeatureKey, boolean | null>>({
    acesso_crm: null, acesso_arsenal: null, acesso_materiais: null,
    acesso_sessoes_taticas: null, acesso_os: null,
  });

  const [form, setForm] = useState({
    clinic_name: '',
    product_id: '',
    access_starts_at: '',
    trial_ends_at: '',
    status: 'ativo',
    notes: '',
  });

  const produtoSelecionado = produtos.find(p => p.id === form.product_id) ?? null;

  const diasRestantes = (() => {
    if (!form.trial_ends_at) return null;
    try { return differenceInDays(parseISO(form.trial_ends_at), new Date()); } catch { return null; }
  })();

  const isVitalicio = produtoSelecionado ? produtoSelecionado.duracao_dias >= 99999 : (!form.trial_ends_at && !!form.product_id);

  const effectiveFeatures = Object.fromEntries(
    FUNCIONALIDADES.map(f => [
      f.key,
      featureOverrides[f.key] ?? produtoSelecionado?.[f.key as keyof Produto] ?? false,
    ])
  ) as Record<FeatureKey, boolean>;

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [{ data: tenant }, { data: prodList }] = await Promise.all([
        supabase
          .from('platform_tenants')
          .select(`organization_id, status, trial_ends_at, notes, product_id, access_starts_at,
                   acesso_crm, acesso_arsenal, acesso_materiais, acesso_sessoes_taticas, acesso_os`)
          .eq('organization_id', orgId)
          .maybeSingle(),
        supabase
          .from('platform_products')
          .select('id, nome, duracao_dias, acesso_crm, acesso_arsenal, acesso_materiais, acesso_sessoes_taticas, acesso_os')
          .eq('ativo', true)
          .order('ordem_index'),
      ]);

      setProdutos((prodList as Produto[]) ?? []);

      if (!tenant) { toast.error('Cliente não encontrado.'); if (!propOrgId) navigate('/admin/acessos'); return; }

      const { data: perfil } = await supabase
        .from('perfis')
        .select('id, email, criado_em')
        .eq('organization_id', orgId)
        .limit(1)
        .maybeSingle();

      let pu: any = null;
      if (perfil?.id) {
        const { data } = await supabase
          .from('platform_users')
          .select('id, clinic_name')
          .eq('crm_user_id', perfil.id)
          .maybeSingle();
        pu = data;
      }

      const t = tenant as any;

      const clienteData: ClienteData = {
        organization_id: t.organization_id,
        status: (t.status ?? 'ativo').toLowerCase().replace('active', 'ativo').replace('blocked', 'bloqueado'),
        trial_ends_at: t.trial_ends_at ?? null,
        notes: t.notes ?? null,
        product_id: t.product_id ?? null,
        access_starts_at: t.access_starts_at ?? null,
        platform_user_id: pu?.id ?? null,
        clinic_name: pu?.clinic_name ?? '',
        email: perfil?.email ?? '',
        created_at: (perfil as any)?.criado_em ?? t.access_starts_at ?? null,
        acesso_crm: t.acesso_crm ?? null,
        acesso_arsenal: t.acesso_arsenal ?? null,
        acesso_materiais: t.acesso_materiais ?? null,
        acesso_sessoes_taticas: t.acesso_sessoes_taticas ?? null,
        acesso_os: t.acesso_os ?? null,
      };

      setCliente(clienteData);
      setForm({
        clinic_name: clienteData.clinic_name,
        product_id: clienteData.product_id ?? '',
        access_starts_at: clienteData.access_starts_at?.substring(0, 10) ?? '',
        trial_ends_at: clienteData.trial_ends_at?.substring(0, 10) ?? '',
        status: clienteData.status,
        notes: clienteData.notes ?? '',
      });
      setFeatureOverrides({
        acesso_crm: t.acesso_crm ?? null,
        acesso_arsenal: t.acesso_arsenal ?? null,
        acesso_materiais: t.acesso_materiais ?? null,
        acesso_sessoes_taticas: t.acesso_sessoes_taticas ?? null,
        acesso_os: t.acesso_os ?? null,
      });
    } catch (err: any) {
      toast.error('Erro ao carregar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, navigate, propOrgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Auto-fill dates when product changes ───────────────────────────────────
  function handleSelectProduto(prodId: string) {
    const prod = produtos.find(p => p.id === prodId);
    if (!prod) { setForm(f => ({ ...f, product_id: prodId })); return; }

    const starts = form.access_starts_at || new Date().toISOString().substring(0, 10);
    const expiry = prod.duracao_dias >= 99999 ? '' : format(addDays(parseISO(starts), prod.duracao_dias), 'yyyy-MM-dd');

    setForm(f => ({ ...f, product_id: prodId, access_starts_at: starts, trial_ends_at: expiry }));
    setFeatureOverrides({ acesso_crm: null, acesso_arsenal: null, acesso_materiais: null, acesso_sessoes_taticas: null, acesso_os: null });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!orgId || !cliente) return;
    setSaving(true);
    try {
      // Auto-calcular expiração se estiver vazia e o produto tiver duração definida
      let trialEndsAt = form.trial_ends_at || null;
      if (!trialEndsAt && produtoSelecionado && produtoSelecionado.duracao_dias < 99999 && form.access_starts_at) {
        trialEndsAt = format(addDays(parseISO(form.access_starts_at), produtoSelecionado.duracao_dias), 'yyyy-MM-dd');
        setForm(f => ({ ...f, trial_ends_at: trialEndsAt! }));
      }

      const { error: tenantErr } = await supabase
        .from('platform_tenants')
        .update({
          product_id: form.product_id || null,
          access_starts_at: form.access_starts_at || null,
          trial_ends_at: trialEndsAt,
          status: form.status,
          acesso_crm: featureOverrides.acesso_crm,
          acesso_arsenal: featureOverrides.acesso_arsenal,
          acesso_materiais: featureOverrides.acesso_materiais,
          acesso_sessoes_taticas: featureOverrides.acesso_sessoes_taticas,
          acesso_os: featureOverrides.acesso_os,
        })
        .eq('organization_id', orgId);
      if (tenantErr) throw tenantErr;

      if (cliente.platform_user_id && form.clinic_name) {
        const { error: puErr } = await supabase
          .from('platform_users')
          .update({ clinic_name: form.clinic_name })
          .eq('id', cliente.platform_user_id);
        if (puErr) throw puErr;
      }

      toast.success('Alterações salvas com sucesso.');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Carregando...</span>
    </div>
  );

  if (!cliente) return null;

  return (
    <div className="space-y-4 max-w-2xl">

      {/* ── PRODUTO E ACESSO ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Produto e Acesso</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Plano, vigência e status da conta</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Produto */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</Label>
            <Select value={form.product_id || '__none__'} onValueChange={v => handleSelectProduto(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-10 rounded-lg border-border/60 text-sm">
                <SelectValue placeholder="— Nenhum —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {produtos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} · {p.duracao_dias >= 99999 ? 'Vitalício' : `${p.duracao_dias}d`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Início + Expiração + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Início do acesso</Label>
              <Input
                type="date"
                className="h-10 text-sm rounded-lg border-border/60"
                value={form.access_starts_at}
                onChange={e => {
                  const starts = e.target.value;
                  setForm(f => {
                    if (produtoSelecionado && produtoSelecionado.duracao_dias < 99999 && starts) {
                      const expiry = format(addDays(parseISO(starts), produtoSelecionado.duracao_dias), 'yyyy-MM-dd');
                      return { ...f, access_starts_at: starts, trial_ends_at: expiry };
                    }
                    return { ...f, access_starts_at: starts };
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Expiração</Label>
              {isVitalicio ? (
                <div className="flex items-center h-10 px-3 rounded-lg border border-border/60 bg-muted/30">
                  <span className="text-sm text-violet-600 font-semibold">Vitalício</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    type="date"
                    className="h-10 text-sm rounded-lg border-border/60"
                    value={form.trial_ends_at}
                    onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                  />
                  {diasRestantes !== null && (
                    <p className={cn(
                      'text-[10px] font-bold',
                      diasRestantes < 0 ? 'text-red-500' : diasRestantes <= 7 ? 'text-red-400' : diasRestantes <= 30 ? 'text-amber-500' : 'text-emerald-600'
                    )}>
                      {diasRestantes < 0 ? `Expirado há ${Math.abs(diasRestantes)}d` : diasRestantes === 0 ? 'Expira hoje' : `${diasRestantes}d restantes`}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-10 rounded-lg border-border/60 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── FUNCIONALIDADES ATIVAS ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Funcionalidades</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Clique para ativar ou desativar por cliente</p>
            </div>
          </div>
          {produtoSelecionado && (
            <span className="text-[10px] text-muted-foreground/40">
              Padrão: {produtoSelecionado.nome}
            </span>
          )}
        </div>
        <div className="p-5">
          {!produtoSelecionado ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <KeyRound className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">Selecione um produto para ver as funcionalidades</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {FUNCIONALIDADES.map(f => {
                const on = effectiveFeatures[f.key];
                const isOverridden = featureOverrides[f.key] !== null;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFeatureOverrides(prev => ({ ...prev, [f.key]: !on }))}
                    className={cn(
                      'flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer',
                      on
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100/60'
                        : 'bg-muted/30 text-muted-foreground/50 border-border/40 hover:border-border/70',
                      isOverridden && 'ring-1 ring-offset-1 ring-foreground/20'
                    )}
                    title={isOverridden ? 'Customizado para este cliente' : 'Padrão do produto'}
                  >
                    {on
                      ? <Check className="h-3 w-3" />
                      : <XIcon className="h-3 w-3 opacity-40" />
                    }
                    <f.icon className="h-3 w-3" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTÃO SALVAR ─────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-1 pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 h-9 px-6 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

    </div>
  );
}
