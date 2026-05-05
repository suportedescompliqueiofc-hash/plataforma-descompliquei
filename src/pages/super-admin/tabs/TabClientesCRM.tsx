import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Building2, Wifi, Plus, RefreshCw, MoreVertical, Eye, LogIn, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ORG_ID, DESCOMPLIQUEI_ORG_ID } from '@/lib/constants';
import { format } from 'date-fns';

interface TenantRow {
  organization_id: string; plan: string; status: string; monthly_fee: number; max_leads: number; created_at: string; organizations: { name: string } | null;
}
interface TenantWithExtra extends TenantRow {
  wp_status?: string | null; lead_count?: number; admin_name?: string; admin_email?: string;
}
const STATUS_COLORS: Record<string, string> = { active: 'bg-green-100 text-green-700', suspended: 'bg-red-100 text-red-700', trial: 'bg-amber-100 text-amber-700' };

export default function TabClientesCRM({ toast, user }: any) {
  const [tenants, setTenants] = useState<TenantWithExtra[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ org_name: '', admin_email: '', admin_password: '', admin_full_name: '', brand_name: '' });
  const [selectedTenant, setSelectedTenant] = useState<TenantWithExtra | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('platform_tenants').select(`organization_id, plan, status, monthly_fee, max_leads, created_at, organizations ( name )`).neq('organization_id', MASTER_ORG_ID).neq('organization_id', DESCOMPLIQUEI_ORG_ID).order('created_at', { ascending: false });
      if (!data) { setIsLoading(false); return; }
      
      const enriched: TenantWithExtra[] = await Promise.all(
        data.map(async (t: any) => {
          const { data: wp } = await supabase.from('whatsapp_connections').select('status').eq('organization_id', t.organization_id).maybeSingle();
          const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', t.organization_id);
          const { data: adminProfile } = await supabase.from('perfis').select('nome_completo, id, email').eq('organization_id', t.organization_id).limit(1).maybeSingle();
          return { ...t, wp_status: wp?.status || null, lead_count: count || 0, admin_name: adminProfile?.nome_completo || 'Desconhecido', admin_email: adminProfile?.email || 'Nenhum e-mail' };
        })
      );
      setTenants(enriched);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar clientes', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadTenants(); }, []);

  const handleCreate = async () => {
    if (!createForm.org_name || !createForm.admin_email || !createForm.admin_password || !createForm.admin_full_name) {
      toast({ title: 'Preencha todos os campos obrigatórios.', variant: 'destructive' }); return;
    }
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error } = await supabase.functions.invoke('super-admin-create-tenant', {
        body: { ...createForm, plan: 'basic', monthly_fee: 0 },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      
      toast({ title: '✅ Cliente criado!', description: result.message });
      setShowCreateModal(false);
      setCreateForm({ org_name: '', admin_email: '', admin_password: '', admin_full_name: '', brand_name: '' });
      await loadTenants();
    } catch (e: any) {
      toast({ title: 'Erro ao criar cliente', description: e.message, variant: 'destructive' });
    } finally { setIsCreating(false); }
  };

  const handleImpersonate = async (targetOrgId: string) => {
    if (!user) return;
    setIsImpersonating(true);
    try {
      // Verificar que o usuário está na org MASTER antes de permitir impersonação
      const { data: myProfile } = await supabase
        .from('perfis')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      if (myProfile?.organization_id !== MASTER_ORG_ID) {
        toast({ title: 'Acesso negado', description: 'Apenas superadmins da organização master podem acessar CRMs de clientes.', variant: 'destructive' });
        setIsImpersonating(false);
        return;
      }
      // Sempre salvar MASTER_ORG_ID como retorno (nunca a org atual, que pode estar errada)
      localStorage.setItem('original_master_org_id', MASTER_ORG_ID);
      const { error } = await supabase.from('perfis').update({ organization_id: targetOrgId as any }).eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Acesso Rápido Iniciado', description: 'Abrindo o CRM deste cliente...' });
      setTimeout(() => { window.location.href = '/crm'; }, 1000);
    } catch (err: any) {
      toast({ title: 'Falha ao acessar CRM', description: err.message, variant: 'destructive' });
      setIsImpersonating(false);
    }
  };

  const [isSeedingAll, setIsSeedingAll] = useState(false);

  const handleSeedAllStages = async () => {
    if (!confirm(`Isso irá padronizar as etapas do pipeline para todos os ${tenants.length} CRMs de clientes (exceto o CRM da Descompliquei). Continuar?`)) return;
    setIsSeedingAll(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('seed-stages', {
        body: { seedAll: true },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Etapas padronizadas!', description: data?.message });
    } catch (e: any) {
      toast({ title: 'Erro ao padronizar etapas', description: e.message, variant: 'destructive' });
    } finally {
      setIsSeedingAll(false);
    }
  };

  const activeCount = tenants.filter(t => t.status === 'active').length;
  const connectedCount = tenants.filter(t => t.wp_status === 'connected').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestão Base CRM</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTenants} disabled={isLoading}><RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}/> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={handleSeedAllStages} disabled={isSeedingAll}><Layers className="h-4 w-4 mr-2"/> {isSeedingAll ? 'Padronizando...' : 'Padronizar Etapas'}</Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90"><Plus className="h-4 w-4 mr-2"/> Novo Cliente</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-blue-600"/><div><p className="text-xs text-muted-foreground">Total Clientes</p><p className="text-lg font-bold">{tenants.length}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-green-600"/><div><p className="text-xs text-muted-foreground">Ativos</p><p className="text-lg font-bold">{activeCount}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Wifi className="h-5 w-5 text-emerald-600"/><div><p className="text-xs text-muted-foreground">WhatsApp OK</p><p className="text-lg font-bold">{connectedCount}</p></div></div></CardContent></Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead><TableHead>Responsável</TableHead><TableHead>Status</TableHead><TableHead>WhatsApp</TableHead><TableHead className="text-right">Volume Leads</TableHead><TableHead>Criado</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map(t => (
                <TableRow key={t.organization_id}>
                   <TableCell className="font-medium">{(t.organizations as any)?.name || '—'}</TableCell>
                   <TableCell><div className="flex flex-col"><span className="text-sm font-medium">{t.admin_name}</span><span className="text-xs text-muted-foreground">{t.admin_email}</span></div></TableCell>
                   <TableCell><Badge className={`${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-700'} border-0 text-xs`}>{t.status === 'active' ? 'Ativo' : t.status}</Badge></TableCell>
                   <TableCell>{t.wp_status === 'connected' ? <div className="flex items-center gap-1 text-green-600 text-xs"><Wifi className="h-3 w-3" /> Conectado</div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                   <TableCell className="text-right text-sm">{t.lead_count ?? '—'}</TableCell>
                   <TableCell className="text-sm text-muted-foreground">{t.created_at ? format(new Date(t.created_at), 'dd/MM/yyyy') : '—'}</TableCell>
                   <TableCell>
                      <DropdownMenu>
                         <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedTenant(t); setShowDetailsModal(true); }}><Eye className="mr-2 h-4 w-4" /> Detalhes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleImpersonate(t.organization_id)}><LogIn className="mr-2 h-4 w-4" /> Acessar CRM</DropdownMenuItem>
                         </DropdownMenuContent>
                      </DropdownMenu>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent><DialogHeader><DialogTitle>Novo Cliente CRM</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={createForm.org_name} onChange={e=>setCreateForm({...createForm, org_name: e.target.value})} placeholder="Clínica Xpto" />
            <Input value={createForm.admin_full_name} onChange={e=>setCreateForm({...createForm, admin_full_name: e.target.value})} placeholder="Nome Admin" />
            <Input value={createForm.admin_email} onChange={e=>setCreateForm({...createForm, admin_email: e.target.value})} placeholder="email@clinica.com" />
            <Input value={createForm.admin_password} type="password" onChange={e=>setCreateForm({...createForm, admin_password: e.target.value})} placeholder="Senha inicial" />
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={isCreating} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90">{isCreating ? "Criando..." : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
