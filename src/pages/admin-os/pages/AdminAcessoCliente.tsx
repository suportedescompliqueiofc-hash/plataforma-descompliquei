import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Loader2, Save, Brain, Users,
  CheckSquare2, BookOpen, Zap, Layers, Check, X as XIcon,
} from 'lucide-react';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';

// ─── tipos ────────────────────────────────────────────────────────────────────

type BadgeType = 'ativo' | 'expirando' | 'expirado' | 'bloqueado';

interface Produto {
  id: string;
  nome: string;
  preco_mensal: number;
  duracao_dias: number;
  pilares_liberados: string[];
  ias_liberadas: string[];
  acesso_cerebro: boolean;
  acesso_crm: boolean;
  acesso_sessoes_taticas: boolean;
  acesso_materiais: boolean;
  acesso_ia_comercial: boolean;
  max_leads: number;
  max_usuarios_crm: number;
}

interface Pilar { id: string; nome: string; icone: string | null; }
interface IAConfig { id: string; name: string; }

interface ClienteData {
  // platform_tenants
  organization_id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  monthly_fee: number;
  notes: string | null;
  product_id: string | null;
  access_starts_at: string | null;
  // platform_users
  platform_user_id: string | null;
  clinic_name: string;
  whatsapp: string;
  specialty: string;
  cidade_estado: string;
  last_seen: string | null;
  // perfis
  email: string;
  nome_completo: string;
  created_at: string | null;
  // org
  org_name: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<BadgeType, { border: string; color: string; bg: string }> = {
  ativo:     { border: '#22c55e', color: '#16a34a', bg: 'rgba(34,197,94,0.08)' },
  expirando: { border: '#f59e0b', color: '#d97706', bg: 'rgba(245,158,11,0.08)' },
  expirado:  { border: '#ef4444', color: '#dc2626', bg: 'rgba(239,68,68,0.08)' },
  bloqueado: { border: '#6b7280', color: '#4b5563', bg: 'rgba(107,114,128,0.08)' },
};
const BADGE_LABELS: Record<BadgeType, string> = {
  ativo: 'Ativo', expirando: 'Expirando', expirado: 'Expirado', bloqueado: 'Bloqueado',
};

function calcBadge(status: string, trial_ends_at: string | null): { badge: BadgeType; dias: number } {
  if ((status ?? '').toLowerCase() === 'bloqueado') return { badge: 'bloqueado', dias: 0 };
  if (!trial_ends_at) return { badge: 'ativo', dias: 9999 };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = differenceInDays(parseISO(trial_ends_at), hoje);
  if (dias < 0)  return { badge: 'expirado',  dias };
  if (dias <= 7) return { badge: 'expirando', dias };
  return { badge: 'ativo', dias };
}

const FUNCIONALIDADES = [
  { key: 'acesso_cerebro',         label: 'Cérebro',         icon: Brain },
  { key: 'acesso_crm',             label: 'CRM',             icon: Users },
  { key: 'acesso_sessoes_taticas', label: 'Sessões Táticas', icon: CheckSquare2 },
  { key: 'acesso_materiais',       label: 'Materiais',       icon: BookOpen },
  { key: 'acesso_ia_comercial',    label: 'IA Comercial',    icon: Zap },
] as const;

// ─── componente ───────────────────────────────────────────────────────────────

export default function AdminAcessoCliente({ orgId: propOrgId }: { orgId?: string } = {}) {
  const { orgId: paramOrgId } = useParams<{ orgId: string }>();
  const orgId = propOrgId ?? paramOrgId;
  const embedded = !!propOrgId; // quando usado como aba, esconde header/back
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [ias, setIas] = useState<IAConfig[]>([]);

  // overrides por cliente (null = herda do produto)
  const [featureOverrides, setFeatureOverrides] = useState<{
    acesso_cerebro: boolean | null;
    acesso_crm: boolean | null;
    acesso_sessoes_taticas: boolean | null;
    acesso_materiais: boolean | null;
    acesso_ia_comercial: boolean | null;
    pilares_liberados: string[] | null;
    ias_liberadas: string[] | null;
  }>({
    acesso_cerebro: null, acesso_crm: null, acesso_sessoes_taticas: null,
    acesso_materiais: null, acesso_ia_comercial: null,
    pilares_liberados: null, ias_liberadas: null,
  });

  // form editável
  const [form, setForm] = useState({
    clinic_name: '',
    email: '',
    whatsapp: '',
    specialty: '',
    cidade_estado: '',
    product_id: '',
    access_starts_at: '',
    trial_ends_at: '',
    monthly_fee: '',
    status: '',
    notes: '',
  });

  const produtoSelecionado = produtos.find(p => p.id === form.product_id) ?? null;

  // dias restantes calculados em tempo real
  const diasRestantes = (() => {
    if (!form.trial_ends_at) return null;
    try {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      return differenceInDays(parseISO(form.trial_ends_at), hoje);
    } catch { return null; }
  })();

  const { badge } = calcBadge(form.status, form.trial_ends_at || null);
  const badgeStyle = BADGE_STYLES[badge];

  // ── carregar dados ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [
        { data: tenant },
        { data: pilsList },
        { data: iaList },
        { data: prodList },
      ] = await Promise.all([
        supabase
          .from('platform_tenants')
          .select(`organization_id, plan, status, trial_ends_at, monthly_fee, notes,
                   product_id, access_starts_at, organizations(name),
                   acesso_cerebro, acesso_crm, acesso_sessoes_taticas,
                   acesso_materiais, acesso_ia_comercial,
                   pilares_liberados, ias_liberadas`)
          .eq('organization_id', orgId)
          .maybeSingle(),
        supabase.from('platform_pilares').select('id, nome, icone').order('ordem_index'),
        supabase.from('platform_ia_config').select('id, name').order('name'),
        supabase.from('platform_products').select('*').eq('ativo', true).order('ordem_index'),
      ]);

      setPilares((pilsList as Pilar[]) ?? []);
      setIas((iaList as IAConfig[]) ?? []);
      setProdutos((prodList as Produto[]) ?? []);

      if (!tenant) { toast.error('Cliente não encontrado.'); navigate('/admin/acessos'); return; }

      // buscar perfil do usuário
      const { data: perfil } = await supabase
        .from('perfis')
        .select('id, nome_completo, email, created_at')
        .eq('organization_id', orgId)
        .limit(1)
        .maybeSingle();

      // buscar platform_user
      let pu: any = null;
      if (perfil?.id) {
        const { data } = await supabase
          .from('platform_users')
          .select('id, clinic_name, whatsapp, specialty, cidade_estado, updated_at')
          .eq('crm_user_id', perfil.id)
          .maybeSingle();
        pu = data;
      }

      const t = tenant as any;

      const clienteData: ClienteData = {
        organization_id: t.organization_id,
        plan: t.plan ?? '',
        status: t.status ?? 'ativo',
        trial_ends_at: t.trial_ends_at ?? null,
        monthly_fee: t.monthly_fee ?? 0,
        notes: t.notes ?? null,
        product_id: t.product_id ?? null,
        access_starts_at: t.access_starts_at ?? null,
        platform_user_id: pu?.id ?? null,
        clinic_name: pu?.clinic_name ?? t.organizations?.name ?? '',
        whatsapp: pu?.whatsapp ?? '',
        specialty: pu?.specialty ?? '',
        cidade_estado: pu?.cidade_estado ?? '',
        last_seen: pu?.updated_at ?? null,
        email: perfil?.email ?? '',
        nome_completo: perfil?.nome_completo ?? '',
        created_at: perfil?.created_at ?? t.access_starts_at ?? null,
        org_name: t.organizations?.name ?? '',
      };

      setCliente(clienteData);
      setForm({
        clinic_name: clienteData.clinic_name,
        email: clienteData.email,
        whatsapp: clienteData.whatsapp,
        specialty: clienteData.specialty,
        cidade_estado: clienteData.cidade_estado,
        product_id: clienteData.product_id ?? '',
        access_starts_at: clienteData.access_starts_at
          ? clienteData.access_starts_at.substring(0, 10) : '',
        trial_ends_at: clienteData.trial_ends_at
          ? clienteData.trial_ends_at.substring(0, 10) : '',
        monthly_fee: String(clienteData.monthly_fee),
        status: clienteData.status,
        notes: clienteData.notes ?? '',
      });
      setFeatureOverrides({
        acesso_cerebro:         t.acesso_cerebro         ?? null,
        acesso_crm:             t.acesso_crm             ?? null,
        acesso_sessoes_taticas: t.acesso_sessoes_taticas ?? null,
        acesso_materiais:       t.acesso_materiais       ?? null,
        acesso_ia_comercial:    t.acesso_ia_comercial    ?? null,
        pilares_liberados:      t.pilares_liberados      ?? null,
        ias_liberadas:          t.ias_liberadas          ?? null,
      });
    } catch (err: any) {
      toast.error('Erro ao carregar cliente: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── ao selecionar produto: preencher defaults e resetar overrides ──────────
  function handleSelectProduto(prodId: string) {
    const prod = produtos.find(p => p.id === prodId);
    if (!prod) { setForm(f => ({ ...f, product_id: prodId })); return; }

    const starts = form.access_starts_at || new Date().toISOString().substring(0, 10);
    const isVitalicio = prod.duracao_dias >= 99999;
    const expiry = isVitalicio ? '' : format(addDays(parseISO(starts), prod.duracao_dias), 'yyyy-MM-dd');

    setForm(f => ({
      ...f,
      product_id: prodId,
      access_starts_at: starts,
      trial_ends_at: expiry,
    }));
    // Ao trocar produto, limpa overrides (herda defaults do novo produto)
    setFeatureOverrides({
      acesso_cerebro: null, acesso_crm: null, acesso_sessoes_taticas: null,
      acesso_materiais: null, acesso_ia_comercial: null,
      pilares_liberados: null, ias_liberadas: null,
    });
  }

  // ── valores efetivos: override do tenant ?? padrão do produto ──────────────
  const effectiveFeatures = {
    acesso_cerebro:         featureOverrides.acesso_cerebro         ?? produtoSelecionado?.acesso_cerebro         ?? false,
    acesso_crm:             featureOverrides.acesso_crm             ?? produtoSelecionado?.acesso_crm             ?? false,
    acesso_sessoes_taticas: featureOverrides.acesso_sessoes_taticas ?? produtoSelecionado?.acesso_sessoes_taticas ?? false,
    acesso_materiais:       featureOverrides.acesso_materiais       ?? produtoSelecionado?.acesso_materiais       ?? false,
    acesso_ia_comercial:    featureOverrides.acesso_ia_comercial    ?? produtoSelecionado?.acesso_ia_comercial    ?? false,
    pilares_liberados:      featureOverrides.pilares_liberados      ?? produtoSelecionado?.pilares_liberados      ?? [],
    ias_liberadas:          featureOverrides.ias_liberadas          ?? produtoSelecionado?.ias_liberadas          ?? [],
  };

  // ── salvar alterações principais ────────────────────────────────────────────
  async function handleSave() {
    if (!orgId || !cliente) return;
    setSaving(true);
    try {
      const { error: tenantErr } = await supabase
        .from('platform_tenants')
        .update({
          product_id:             form.product_id || null,
          access_starts_at:       form.access_starts_at || null,
          trial_ends_at:          form.trial_ends_at || null,
          status:                 form.status,
          acesso_cerebro:         featureOverrides.acesso_cerebro,
          acesso_crm:             featureOverrides.acesso_crm,
          acesso_sessoes_taticas: featureOverrides.acesso_sessoes_taticas,
          acesso_materiais:       featureOverrides.acesso_materiais,
          acesso_ia_comercial:    featureOverrides.acesso_ia_comercial,
          pilares_liberados:      featureOverrides.pilares_liberados,
          ias_liberadas:          featureOverrides.ias_liberadas,
        })
        .eq('organization_id', orgId);

      if (tenantErr) throw tenantErr;

      if (cliente.platform_user_id) {
        const { error: puErr } = await supabase
          .from('platform_users')
          .update({
            clinic_name: form.clinic_name,
            whatsapp: form.whatsapp,
            specialty: form.specialty,
            cidade_estado: form.cidade_estado,
          })
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

  // ── salvar notas ────────────────────────────────────────────────────────────
  async function handleSaveNotes() {
    if (!orgId) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('platform_tenants')
        .update({ notes: form.notes || null })
        .eq('organization_id', orgId);
      if (error) throw error;
      toast.success('Notas salvas.');
    } catch (err: any) {
      toast.error('Erro ao salvar notas: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  }

  // ─── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando cliente...</span>
      </div>
    );
  }

  if (!cliente) return null;

  const nomeExibido = form.clinic_name || cliente.org_name || 'Cliente';

  return (
    <div className="space-y-6 max-w-4xl">

      {/* HEADER */}
      {!embedded && (
        <div className="space-y-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate('/admin')} className="hover:text-foreground transition-colors">Admin OS</button>
            <ChevronRight className="h-3 w-3 opacity-40" />
            <button onClick={() => navigate('/admin/acessos')} className="hover:text-foreground transition-colors">Gestão de Acessos</button>
            <ChevronRight className="h-3 w-3 opacity-40" />
            <span className="text-foreground font-medium truncate max-w-[200px]">{nomeExibido}</span>
          </div>

          {/* Título + badge + botão voltar */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{nomeExibido}</h1>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                style={{ borderColor: badgeStyle.border, color: badgeStyle.color, background: badgeStyle.bg }}
              >
                {BADGE_LABELS[badge]}
                {diasRestantes !== null && badge !== 'bloqueado' && (
                  <span className="ml-1 opacity-70">
                    {diasRestantes < 0
                      ? `· ${Math.abs(diasRestantes)}d atrás`
                      : diasRestantes === 9999 ? '' : `· ${diasRestantes}d`}
                  </span>
                )}
              </span>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate('/admin/acessos')}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* SEÇÃO 1 — Informações do Cliente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-[#E85D24]">
            Informações do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nome / Clínica</Label>
            <Input value={form.clinic_name} onChange={e => setForm(f => ({ ...f, clinic_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email</Label>
            <Input value={form.email} disabled className="opacity-60 cursor-not-allowed" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">WhatsApp</Label>
            <Input
              value={form.whatsapp}
              onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Especialidade</Label>
            <Input
              value={form.specialty}
              onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
              placeholder="Ex: Dermatologia"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Cidade / Estado</Label>
            <Input
              value={form.cidade_estado}
              onChange={e => setForm(f => ({ ...f, cidade_estado: e.target.value }))}
              placeholder="Ex: São Paulo, SP"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Data de cadastro</Label>
            <Input
              value={cliente.created_at ? format(parseISO(cliente.created_at), 'dd/MM/yyyy') : '—'}
              disabled
              className="opacity-60 cursor-not-allowed"
            />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2 — Produto e Acesso */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-[#E85D24]">
            Produto e Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Produto</Label>
            <Select
              value={form.product_id || '__none__'}
              onValueChange={v => handleSelectProduto(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar produto..." />
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

          {(() => {
            const prodSelecionado = produtos.find(p => p.id === form.product_id);
            const isVitalicio = prodSelecionado ? prodSelecionado.duracao_dias >= 99999 : !form.trial_ends_at && !!form.product_id;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Início do acesso</Label>
                  <Input
                    type="date"
                    value={form.access_starts_at}
                    onChange={e => setForm(f => ({ ...f, access_starts_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Expiração do acesso</Label>
                  {isVitalicio ? (
                    <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/40">
                      <span className="text-sm text-[#E85D24] font-medium">♾️ Vitalício — sem expiração</span>
                    </div>
                  ) : (
                    <Input
                      type="date"
                      value={form.trial_ends_at}
                      onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                    />
                  )}
                  {!isVitalicio && diasRestantes !== null && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                    >
                      {diasRestantes < 0 ? `Expirado há ${Math.abs(diasRestantes)}d` : `${diasRestantes}d restantes`}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-start-2">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3 — Funcionalidades Ativas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-[#E85D24]">
              Funcionalidades Ativas
            </CardTitle>
            {produtoSelecionado && (
              <span className="text-[10px] text-muted-foreground">Clique para ativar/desativar por cliente</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!produtoSelecionado ? (
            <p className="text-sm text-muted-foreground italic">Selecione um produto para ver as funcionalidades.</p>
          ) : (
            <div className="space-y-5">
              {/* Funcionalidades toggle — clicáveis */}
              <div className="flex flex-wrap gap-2">
                {FUNCIONALIDADES.map(f => {
                  const on = effectiveFeatures[f.key as keyof typeof effectiveFeatures] as boolean;
                  const isOverridden = featureOverrides[f.key as keyof typeof featureOverrides] !== null;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFeatureOverrides(prev => ({
                        ...prev,
                        [f.key]: !on,
                      }))}
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer hover:opacity-80"
                      style={{
                        borderColor: on ? '#22c55e' : 'hsl(var(--border))',
                        color: on ? '#16a34a' : 'hsl(var(--muted-foreground))',
                        background: on ? 'rgba(34,197,94,0.08)' : 'transparent',
                        outline: isOverridden ? '2px solid #E85D24' : 'none',
                        outlineOffset: '2px',
                      }}
                      title={isOverridden ? 'Customizado para este cliente' : 'Padrão do produto'}
                    >
                      {on
                        ? <Check className="h-3 w-3" />
                        : <XIcon className="h-3 w-3 opacity-40" />}
                      <f.icon className="h-3 w-3" />
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Pilares — checkboxes */}
              {pilares.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Pilares liberados
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pilares.map(pilar => {
                      const active = effectiveFeatures.pilares_liberados.includes(pilar.id);
                      return (
                        <button
                          key={pilar.id}
                          type="button"
                          onClick={() => {
                            const current = effectiveFeatures.pilares_liberados;
                            const next = active
                              ? current.filter(id => id !== pilar.id)
                              : [...current, pilar.id];
                            setFeatureOverrides(prev => ({ ...prev, pilares_liberados: next }));
                          }}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer hover:opacity-80"
                          style={{
                            borderColor: active ? '#22c55e' : 'hsl(var(--border))',
                            color: active ? '#16a34a' : 'hsl(var(--muted-foreground))',
                            background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
                          }}
                        >
                          {active ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3 opacity-30" />}
                          <span className="font-medium">{pilar.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* IAs — checkboxes */}
              {ias.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> IAs liberadas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ias.map(ia => {
                      const active = effectiveFeatures.ias_liberadas.includes(ia.id);
                      return (
                        <button
                          key={ia.id}
                          type="button"
                          onClick={() => {
                            const current = effectiveFeatures.ias_liberadas;
                            const next = active
                              ? current.filter(id => id !== ia.id)
                              : [...current, ia.id];
                            setFeatureOverrides(prev => ({ ...prev, ias_liberadas: next }));
                          }}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer hover:opacity-80"
                          style={{
                            borderColor: active ? '#22c55e' : 'hsl(var(--border))',
                            color: active ? '#16a34a' : 'hsl(var(--muted-foreground))',
                            background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
                          }}
                        >
                          {active ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3 opacity-30" />}
                          <span className="font-medium">{ia.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 4 — Notas Internas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-[#E85D24]">
            Notas Internas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            placeholder="Observações sobre este cliente..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleSaveNotes}
            disabled={savingNotes}
          >
            {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {savingNotes ? 'Salvando...' : 'Salvar notas'}
          </Button>
        </CardContent>
      </Card>

      {/* SEÇÃO 5 — Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-[#E85D24]">
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border">
              <dt className="text-muted-foreground">Data de cadastro</dt>
              <dd className="font-medium text-foreground">
                {cliente.created_at ? format(parseISO(cliente.created_at), 'dd/MM/yyyy') : '—'}
              </dd>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <dt className="text-muted-foreground">Último acesso</dt>
              <dd className="font-medium text-foreground">
                {cliente.last_seen ? format(parseISO(cliente.last_seen), 'dd/MM/yyyy HH:mm') : '—'}
              </dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-muted-foreground">Produto atual</dt>
              <dd className="font-medium text-foreground">
                {produtoSelecionado?.nome ?? (form.product_id ? '—' : 'Nenhum vinculado')}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* BOTÃO SALVAR */}
      <div className="flex justify-end pt-2 pb-8">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-[#E85D24] hover:bg-[#d04e1a] text-white px-8"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}
