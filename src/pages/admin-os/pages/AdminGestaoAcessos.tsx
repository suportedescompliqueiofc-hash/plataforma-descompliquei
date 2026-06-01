import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, RefreshCw, Users, AlertTriangle, ShieldOff, UserX, Copy, Check, Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, differenceInDays, parseISO } from 'date-fns';

type BadgeType = 'ativo' | 'expirando' | 'expirado' | 'bloqueado';

interface Product {
  id: string;
  nome: string;
  duracao_dias?: number;
}

interface UserRow {
  organization_id: string;
  org_name: string;
  email: string;
  nome_completo: string;
  clinic_name: string;
  product_name: string;
  status: string;
  trial_ends_at: string | null;
  monthly_fee: number;
  notes: string | null;
  dias_restantes: number;
  badge: BadgeType;
}

const BADGE_STYLES: Record<BadgeType, string> = {
  ativo:      'bg-green-100 text-green-700 border-green-200',
  expirando:  'bg-amber-100 text-amber-700 border-amber-200',
  expirado:   'bg-red-100 text-red-700 border-red-200',
  bloqueado:  'bg-gray-100 text-gray-600 border-gray-200',
};

const BADGE_LABELS: Record<BadgeType, string> = {
  ativo:     'Ativo',
  expirando: 'Expirando',
  expirado:  'Expirado',
  bloqueado: 'Bloqueado',
};

function calcBadge(status: string, trial_ends_at: string | null): { badge: BadgeType; dias: number } {
  const normalizedStatus = status?.toLowerCase() ?? '';
  if (normalizedStatus === 'bloqueado' || normalizedStatus === 'blocked') {
    return { badge: 'bloqueado', dias: 0 };
  }
  if (!trial_ends_at) return { badge: 'ativo', dias: 9999 };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const expiry = parseISO(trial_ends_at);
  const dias = differenceInDays(expiry, hoje);
  if (dias < 0)      return { badge: 'expirado',  dias };
  if (dias <= 7)     return { badge: 'expirando', dias };
  return { badge: 'ativo', dias };
}

export default function AdminGestaoAcessos() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [semTenant, setSemTenant] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ email: string; senha: string; clinic: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [createForm, setCreateForm] = useState({
    email: '', clinic_name: '', product_id: '', trial_ends_at: '', monthly_fee: '0',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Carregar produtos para referência
      const { data: prods } = await supabase
        .from('platform_products')
        .select('id, nome, duracao_dias')
        .eq('ativo', true)
        .order('ordem_index');
      setProducts(prods ?? []);

      const prodMap = new Map((prods ?? []).map((p: any) => [p.id, p.nome]));

      // Buscar IDs de superadmin para excluir da seleção de perfil
      const { data: superadminRoles } = await supabase
        .from('usuarios_papeis')
        .select('usuario_id')
        .eq('papel', 'superadmin');
      const superadminIds = new Set((superadminRoles ?? []).map((r: any) => r.usuario_id));

      const { data: tenants, error } = await supabase
        .from('platform_tenants')
        .select(`
          organization_id, plan, status, trial_ends_at, monthly_fee, notes, product_id,
          organizations ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched: UserRow[] = await Promise.all(
        (tenants ?? []).map(async (t: any) => {
          // Busca todos os perfis da org e escolhe o primeiro que NÃO seja superadmin
          const { data: perfisOrg } = await supabase
            .from('perfis')
            .select('id, nome_completo, email')
            .eq('organization_id', t.organization_id);
          const perfil = perfisOrg?.find(p => !superadminIds.has(p.id))
            ?? perfisOrg?.[0] ?? null;

          let clinic_name = '';
          if (perfil?.id) {
            const { data: pu } = await supabase
              .from('platform_users')
              .select('clinic_name')
              .eq('crm_user_id', perfil.id)
              .maybeSingle();
            clinic_name = pu?.clinic_name ?? '';
          }

          const { badge, dias } = calcBadge(t.status, t.trial_ends_at);

          return {
            organization_id: t.organization_id,
            org_name: (t.organizations as any)?.name ?? '—',
            email: perfil?.email ?? '—',
            nome_completo: perfil?.nome_completo ?? '—',
            clinic_name: clinic_name || (t.organizations as any)?.name || '—',
            product_name: t.product_id ? (prodMap.get(t.product_id) ?? '—') : '—',
            status: t.status ?? '—',
            trial_ends_at: t.trial_ends_at ?? null,
            monthly_fee: t.monthly_fee ?? 0,
            notes: t.notes ?? null,
            dias_restantes: dias,
            badge,
          };
        })
      );

      setRows(enriched);

      const { count } = await supabase
        .from('platform_users')
        .select('id', { count: 'exact', head: true })
        .is('crm_user_id', null);
      setSemTenant(count ?? 0);
    } catch (err: any) {
      toast.error('Erro ao carregar dados: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
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
          monthly_fee: parseFloat(createForm.monthly_fee) || 0,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) {
        const ctx = error.context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.error) throw new Error(body.error);
          } catch (_) { /* fall through */ }
        }
        throw new Error(error.message);
      }
      if (data?.error) throw new Error(data.error);

      setShowCreateModal(false);
      setCreatedResult({
        email: createForm.email,
        senha: data.senha_temporaria,
        clinic: createForm.clinic_name,
      });
      setCreateForm({ email: '', clinic_name: '', product_id: '', trial_ends_at: '', monthly_fee: '0' });
      await loadData();
    } catch (err: any) {
      toast.error('Erro ao criar acesso: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
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
          try {
            const b = await ctx.json();
            if (b?.error) throw new Error(b.error);
          } catch (_) {}
        }
        throw new Error(error.message);
      }
      if (data?.error) throw new Error(data.error);

      toast.success(`Cliente "${deleteTarget.clinic_name}" excluído (${data?.deleted_users ?? 0} usuários).`);
      setDeleteTarget(null);
      setDeleteConfirm('');
      await loadData();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const hoje = new Date();
  const ativos     = rows.filter(r => r.badge === 'ativo').length;
  const expirando  = rows.filter(r => r.badge === 'expirando').length;
  const bloqueados = rows.filter(r => r.badge === 'bloqueado').length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Acessos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os acessos à plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" /> Criar Acesso
          </Button>
        </div>
      </div>

      {/* SEÇÃO 1 — CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{ativos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expirando em 7 dias</p>
              <p className="text-2xl font-bold">{expirando}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <ShieldOff className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bloqueados</p>
              <p className="text-2xl font-bold">{bloqueados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <UserX className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem tenant</p>
              <p className="text-2xl font-bold">{semTenant}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 2 — TABELA */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Clínica</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead className="text-right">Dias restantes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhum acesso encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(row => (
                  <TableRow
                    key={row.organization_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate('/admin/acessos/' + row.organization_id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{row.clinic_name}</span>
                        {row.org_name !== row.clinic_name && (
                          <span className="text-xs text-muted-foreground">{row.org_name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold tracking-wider">{row.product_name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${BADGE_STYLES[row.badge]} border text-xs font-semibold`}>
                        {BADGE_LABELS[row.badge]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.trial_ends_at
                        ? format(parseISO(row.trial_ends_at), 'dd/MM/yyyy')
                        : row.product_name !== '—'
                          ? <span className="text-[#E85D24] font-medium text-xs">♾️ Vitalício</span>
                          : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.trial_ends_at ? (
                        <span className={row.dias_restantes < 0 ? 'text-red-600 font-bold' : row.dias_restantes <= 7 ? 'text-amber-600 font-bold' : ''}>
                          {row.dias_restantes < 0 ? `${Math.abs(row.dias_restantes)}d atrás` : `${row.dias_restantes}d`}
                        </span>
                      ) : row.product_name !== '—'
                        ? <span className="text-[#E85D24] font-medium text-xs">∞</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-[#E85D24] hover:text-[#E85D24]"
                          onClick={e => { e.stopPropagation(); navigate('/admin/acessos/' + row.organization_id); }}
                        >
                          Gerenciar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(row); setDeleteConfirm(''); }}
                          title="Excluir cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL CRIAR ACESSO */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Acesso</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="email@clinica.com"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome / Clínica *</Label>
              <Input
                placeholder="Clínica Exemplo"
                value={createForm.clinic_name}
                onChange={e => setCreateForm(f => ({ ...f, clinic_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Produto</Label>
              <Select
                value={createForm.product_id || '__none__'}
                onValueChange={v => {
                  const prod = products.find(p => p.id === v);
                  let trialDate = '';
                  if (prod && prod.duracao_dias && prod.duracao_dias < 99999) {
                    const d = new Date();
                    d.setDate(d.getDate() + prod.duracao_dias);
                    trialDate = d.toISOString().split('T')[0];
                  }
                  setCreateForm(f => ({ ...f, product_id: v === '__none__' ? '' : v, trial_ends_at: trialDate }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const selectedProd = products.find(p => p.id === createForm.product_id);
              const isVitalicio = selectedProd && (selectedProd.duracao_dias ?? 0) >= 99999;
              return (
                <div className="space-y-2">
                  <Label>Data de expiração</Label>
                  {isVitalicio ? (
                    <div className="flex h-9 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground items-center">
                      Vitalício — sem expiração
                    </div>
                  ) : (
                    <Input
                      type="date"
                      value={createForm.trial_ends_at}
                      onChange={e => setCreateForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                    />
                  )}
                  {selectedProd && !isVitalicio && selectedProd.duracao_dias && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Calculado automaticamente: {selectedProd.duracao_dias} dias a partir de hoje
                    </p>
                  )}
                </div>
              );
            })()}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button
              className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Criando...' : 'Criar Acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL SENHA TEMPORÁRIA */}
      <Dialog open={!!createdResult} onOpenChange={(o) => !o && setCreatedResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-700">Acesso criado com sucesso!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Envie os dados abaixo para <strong>{createdResult?.clinic}</strong>. O cliente poderá trocar a senha após o primeiro login.
            </p>

            <div className="space-y-3 bg-muted/50 p-4 rounded-lg border border-border">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Email</p>
                <p className="text-sm font-mono text-foreground">{createdResult?.email}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Senha temporária</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-bold text-foreground bg-background px-2 py-1 rounded border border-border flex-1">
                    {createdResult?.senha}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(`Email: ${createdResult?.email}\nSenha: ${createdResult?.senha}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-amber-600 font-medium">
              Atenção: esta senha não será exibida novamente. Copie e envie ao cliente agora.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedResult(null)} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EXCLUSÃO */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirm(''); } }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Excluir cliente permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Esta ação <strong>não pode ser desfeita</strong>. Serão removidos definitivamente:
                </p>
                <ul className="list-disc pl-5 text-xs space-y-1 text-muted-foreground">
                  <li>A organização <strong>{deleteTarget?.clinic_name}</strong></li>
                  <li>O tenant da plataforma e todos os acessos vinculados</li>
                  <li>Os usuários, perfis e papéis da organização</li>
                  <li>O usuário do Supabase Auth (login não funcionará mais)</li>
                </ul>
                <p className="pt-2">
                  Para confirmar, digite <strong className="font-mono">EXCLUIR</strong> abaixo.
                </p>
                <Input
                  autoFocus
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="EXCLUIR"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isDeleting || deleteConfirm.trim().toUpperCase() !== 'EXCLUIR'}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo...</> : 'Excluir definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
