import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Building2, Wifi, Plus, RefreshCw, MoreVertical, Eye, LogIn, Layers, Bot, Save, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ORG_ID, DESCOMPLIQUEI_ORG_ID } from '@/lib/constants';
import { format } from 'date-fns';

const MODEL_SUGGESTIONS = [
  { label: 'OpenAI', items: ['gpt-4.1-mini', 'gpt-4o-mini'] },
  { label: 'OpenRouter', items: [
    'openrouter/openai/gpt-4.1-mini',
    'openrouter/anthropic/claude-haiku-4-5-20251001',
    'openrouter/google/gemini-2.5-flash-preview',
    'openrouter/deepseek/deepseek-v4-flash',
    'openrouter/meta-llama/llama-4-scout',
    'openrouter/x-ai/grok-4-1-fast',
  ]},
  { label: 'xAI', items: ['grok-4-1-fast-non-reasoning'] },
];

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

  // AI Config state for details modal
  const [aiModelo, setAiModelo] = useState('');
  const [aiAcumulo, setAiAcumulo] = useState(45);
  const [aiPromptId, setAiPromptId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  const loadAiConfig = async (orgId: string) => {
    setAiLoading(true);
    setAiSaved(false);
    try {
      const { data } = await supabase
        .from('organization_ai_prompts')
        .select('id, modelo_ia, acumulo_mensagens')
        .eq('organization_id', orgId)
        .maybeSingle();
      setAiPromptId(data?.id || null);
      setAiModelo(data?.modelo_ia || 'openrouter/deepseek/deepseek-v4-flash');
      setAiAcumulo(data?.acumulo_mensagens ?? 45);
    } catch (e) {
      console.error('Erro ao carregar config IA:', e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiConfig = async () => {
    if (!selectedTenant) return;
    setAiSaving(true);
    try {
      if (aiPromptId) {
        await supabase
          .from('organization_ai_prompts')
          .update({ modelo_ia: aiModelo.trim(), acumulo_mensagens: aiAcumulo, updated_at: new Date().toISOString() })
          .eq('id', aiPromptId);
      } else {
        await supabase
          .from('organization_ai_prompts')
          .insert({ organization_id: selectedTenant.organization_id, modelo_ia: aiModelo.trim(), acumulo_mensagens: aiAcumulo, delay_entre_mensagens: 2000, ia_ativa: false, prompt: '' });
      }
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
      toast({ title: 'Configuração de IA salva!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setAiSaving(false);
    }
  };

  const openDetails = (t: TenantWithExtra) => {
    setSelectedTenant(t);
    setShowDetailsModal(true);
    loadAiConfig(t.organization_id);
  };

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
      const { data: myProfile } = await supabase
        .from('perfis')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      const currentOrg = myProfile?.organization_id;
      if (currentOrg !== MASTER_ORG_ID && currentOrg !== DESCOMPLIQUEI_ORG_ID) {
        toast({ title: 'Acesso negado', description: 'Apenas superadmins da organização master podem acessar CRMs de clientes.', variant: 'destructive' });
        setIsImpersonating(false);
        return;
      }
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
                            <DropdownMenuItem onClick={() => openDetails(t)}><Eye className="mr-2 h-4 w-4" /> Detalhes</DropdownMenuItem>
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

      {/* Details + AI Config Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{(selectedTenant?.organizations as any)?.name || 'Detalhes do Cliente'}</DialogTitle>
            <p className="text-xs text-muted-foreground">{selectedTenant?.admin_email}</p>
          </DialogHeader>

          {selectedTenant && (
            <div className="space-y-5">
              {/* Info Geral */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Responsável</span>
                  <p className="font-medium">{selectedTenant.admin_name}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Status</span>
                  <p><Badge className={`${STATUS_COLORS[selectedTenant.status] || 'bg-gray-100 text-gray-700'} border-0 text-xs`}>{selectedTenant.status === 'active' ? 'Ativo' : selectedTenant.status}</Badge></p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">WhatsApp</span>
                  <p className="text-sm">{selectedTenant.wp_status === 'connected' ? <span className="text-green-600 font-medium">Conectado</span> : <span className="text-muted-foreground">Desconectado</span>}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Leads</span>
                  <p className="font-medium">{selectedTenant.lead_count ?? 0}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Criado em</span>
                  <p className="text-sm text-muted-foreground">{selectedTenant.created_at ? format(new Date(selectedTenant.created_at), 'dd/MM/yyyy') : '—'}</p>
                </div>
              </div>

              {/* Separador */}
              <div className="border-t border-border/60" />

              {/* Config IA */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-muted">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Configuração da IA</span>
                </div>

                {aiLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Modelo */}
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modelo de IA</Label>
                      <Input
                        value={aiModelo}
                        onChange={(e) => { setAiModelo(e.target.value); setAiSaved(false); }}
                        placeholder="openrouter/deepseek/deepseek-v4-flash"
                        className="h-9 text-sm"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {MODEL_SUGGESTIONS.flatMap(s => s.items).map(model => (
                          <button
                            key={model}
                            type="button"
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] transition-colors ${aiModelo === model ? 'bg-foreground text-background border-foreground' : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            onClick={() => { setAiModelo(model); setAiSaved(false); }}
                          >
                            {model.split('/').pop()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Acúmulo */}
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Acúmulo de mensagens</Label>
                      <Select value={aiAcumulo.toString()} onValueChange={(v) => { setAiAcumulo(parseInt(v)); setAiSaved(false); }}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 segundos</SelectItem>
                          <SelectItem value="30">30 segundos</SelectItem>
                          <SelectItem value="45">45 segundos</SelectItem>
                          <SelectItem value="60">60 segundos</SelectItem>
                          <SelectItem value="90">90 segundos</SelectItem>
                          <SelectItem value="120">120 segundos</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground/60">Tempo que a IA espera acumulando mensagens antes de responder.</p>
                    </div>

                    {/* Delay + Transcrição (read-only info) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Delay entre msgs</span>
                        <p className="text-sm font-mono font-medium mt-0.5">2-3s</p>
                      </div>
                      <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcrição</span>
                        <p className="text-sm font-medium text-green-600 mt-0.5">Whisper ativo</p>
                      </div>
                    </div>

                    {/* Save */}
                    <Button
                      onClick={handleSaveAiConfig}
                      disabled={aiSaving || aiSaved}
                      className="w-full h-9 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
                    >
                      {aiSaving ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Salvando...</>
                      ) : aiSaved ? (
                        <><Check className="h-3.5 w-3.5 mr-1.5" /> Salvo!</>
                      ) : (
                        <><Save className="h-3.5 w-3.5 mr-1.5" /> Salvar Configuração IA</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
