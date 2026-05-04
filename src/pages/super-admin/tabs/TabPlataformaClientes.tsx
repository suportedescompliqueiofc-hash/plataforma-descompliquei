import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Plus, RefreshCw, MoreVertical, Eye, Edit, Trash2, CheckCircle2, TrendingUp, AlertTriangle, FileText, Settings, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ORG_ID } from '@/lib/constants';
import { format } from 'date-fns';

export default function TabPlataformaClientes({ toast }: { toast: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modais State
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReset, setShowReset] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Form States
  const [newPlan, setNewPlan] = useState('pca');
  const [crmUsers, setCrmUsers] = useState<any[]>([]);
  const [addForm, setAddForm] = useState({ id: '', clinic_name: '', specialty: '', plan: 'pca' });

  // Load Main Data
  const loadData = async () => {
    setLoading(true);
    const { data: pUsers } = await supabase.from('platform_users').select('*').order('created_at', { ascending: false });
    const { data: profiles } = await supabase.from('perfis').select('id, email, nome_completo');
    
    // Simulate Progress Metrics (In a real scenario, this comes from a joined query on progress tables)
    // We already have `cerebro_complete`, `onboarding_complete` etc.
    
    if (pUsers) {
      const enriched = pUsers.map(pu => {
        const profile = profiles?.find(p => p.id === pu.id);
        return { 
          ...pu, 
          email: profile?.email || 'Desconhecido', 
          nome_completo: profile?.nome_completo || 'Sem CRM',
          // Mocking some metrics pending real progress query
          progress_percent: Math.floor(Math.random() * 100),
          modules_done: Math.floor(Math.random() * 18),
          last_access: pu.created_at
        };
      });
      setUsers(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Handlers
  const handleEditPlan = async () => {
    await supabase.from('platform_users').update({ plan: newPlan }).eq('id', selectedUser.id);
    toast({ title: 'Plano atualizado com sucesso.' });
    setShowEditPlan(false);
    loadData();
  };

  const handleResetProgress = async () => {
    // Delete progress for this user
    await supabase.from('platform_module_progress_detail').delete().eq('user_id', selectedUser.id);
    toast({ title: 'Progresso resetado para zero.' });
    setShowReset(false);
    loadData();
  };

  const openAddModal = async () => {
    const { data: perfis } = await supabase.from('perfis').select('id, email, nome_completo');
    const naoCadastrados = perfis?.filter(p => !users.some(u => u.id === p.id)) || [];
    setCrmUsers(naoCadastrados);
    setAddForm({ id: '', clinic_name: '', specialty: '', plan: 'pca' });
    setShowAddModal(true);
  };

  const submitAddUser = async () => {
    if (!addForm.id || !addForm.clinic_name) {
      toast({ title: 'Preencha usuário e nome da clínica', variant: 'destructive' });
      return;
    }
    try {
      await supabase.from('platform_users').insert({
        id: addForm.id,
        clinic_name: addForm.clinic_name,
        specialty: addForm.specialty || 'A definir',
        plan: addForm.plan
      });
      toast({ title: 'Cliente importado para a Plataforma!' });
      setShowAddModal(false);
      loadData();
    } catch(e: any) {
       toast({ title: 'Erro ao importar', description: e.message, variant: 'destructive' });
    }
  };

  // Metrics
  const total = users.length;
  const countGCA = users.filter(u => u.plan === 'gca').length;
  const countPCA = users.filter(u => u.plan === 'pca').length;
  const avgProgress = total > 0 ? Math.round(users.reduce((acc, curr) => acc + curr.progress_percent, 0) / total) : 0;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-blue-600"/><div><p className="text-xs text-muted-foreground">Total Plataforma</p><p className="text-lg font-bold">{total}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Award className="h-5 w-5 text-[#E85D24]"/><div><p className="text-xs text-muted-foreground">Assinantes G.C.A.</p><p className="text-lg font-bold">{countGCA}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-emerald-600"/><div><p className="text-xs text-muted-foreground">Média Progresso</p><p className="text-lg font-bold">{avgProgress}%</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-purple-600"/><div><p className="text-xs text-muted-foreground">Assinantes P.C.A.</p><p className="text-lg font-bold">{countPCA}</p></div></div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestão de Clientes Ativos</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}/> Atualizar
          </Button>
          <Button size="sm" onClick={openAddModal} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
            <Plus className="h-4 w-4 mr-2"/> Dar Acesso P.C.A/G.C.A
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clínica / Responsável</TableHead>
                <TableHead className="w-[100px]">Plano</TableHead>
                <TableHead className="w-[180px]">Progresso</TableHead>
                <TableHead className="text-center w-[120px]">Módulos</TableHead>
                <TableHead className="text-center w-[120px]">Cérebro</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <>
                   {[1,2,3,4,5].map(k => (
                     <TableRow key={k}>
                       <TableCell><Skeleton className="h-4 w-[200px]" /><Skeleton className="h-3 w-[150px] mt-2" /></TableCell>
                       <TableCell><Skeleton className="h-6 w-[60px] rounded-full" /></TableCell>
                       <TableCell><Skeleton className="h-2 w-full mt-2" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-[40px] mx-auto" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-[60px] mx-auto" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                       <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                     </TableRow>
                   ))}
                </>
              ) : users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{u.clinic_name} <span className="text-xs font-normal text-muted-foreground ml-1">({u.specialty})</span></div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    {u.plan === 'gca' ? <Badge className="bg-[#E85D24] text-white">G.C.A.</Badge> : <Badge variant="secondary" className="bg-muted text-muted-foreground">P.C.A.</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${u.progress_percent}%` }}></div>
                      </div>
                      <span className="text-xs font-medium w-8">{u.progress_percent}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">{u.modules_done} / 18</TableCell>
                  <TableCell className="text-center">
                    {u.cerebro_complete ? <span className="text-emerald-500 font-bold text-xs inline-flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> OK</span> : <span className="text-amber-500 font-bold text-xs inline-flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/>Pendente</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.last_access ? format(new Date(u.last_access), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[220px]">
                        <DropdownMenuItem onClick={() => {
                          localStorage.setItem('original_master_org_id', MASTER_ORG_ID);
                          // logic to set the correct organization_id for the user in the database would go here 
                          // but for now we just open the platform in a new tab
                          window.open('/plataforma', '_blank');
                        }} className="font-bold text-blue-600 focus:text-blue-700">
                          <Eye className="mr-2 h-4 w-4" /> Visualizar como Cliente
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          localStorage.setItem('original_master_org_id', MASTER_ORG_ID);
                          window.open('/', '_blank');
                        }} className="font-bold text-[#E85D24] focus:text-[#E85D24]">
                          <Users className="mr-2 h-4 w-4" /> Acessar CRM do Cliente
                        </DropdownMenuItem>
                        <div className="h-px bg-border my-1" />
                        <DropdownMenuItem onClick={() => { setSelectedUser(u); setShowProfile(true); }}><Eye className="mr-2 h-4 w-4" /> Ver perfil completo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedUser(u); setNewPlan(u.plan); setShowEditPlan(true); }}><Edit className="mr-2 h-4 w-4" /> Editar plano</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedUser(u); setShowSettings(true); }}><Settings className="mr-2 h-4 w-4" /> Ver Cérebro Central</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast({ title: "Esta funcionalidade navegará para Aba Materiais com filtro" })}><FileText className="mr-2 h-4 w-4" /> Ver materiais gerados</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedUser(u); setShowReset(true); }} className="text-red-600 focus:text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Resetar progresso</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nenhum cliente ativado na plataforma.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}

      {/* Modal: Editar Plano */}
      <Dialog open={showEditPlan} onOpenChange={setShowEditPlan}>
         <DialogContent>
           <DialogHeader><DialogTitle>Trocar Plano: {selectedUser?.clinic_name}</DialogTitle></DialogHeader>
           <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newPlan} onChange={e=>setNewPlan(e.target.value)}>
             <option value="pca">P.C.A. (Básico)</option>
             <option value="gca">G.C.A. (Acesso Total)</option>
           </select>
           <DialogFooter><Button onClick={handleEditPlan} className="bg-[#E85D24]">Salvar</Button></DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Modal: Adicionar/Importar */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
         <DialogContent>
           <DialogHeader><DialogTitle>Importar Cliente do CRM</DialogTitle></DialogHeader>
           <div className="space-y-4">
             <div className="space-y-1">
               <Label>Cliente Base CRM</Label>
               <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={addForm.id} onChange={e=>{
                 const c = crmUsers.find(x => x.id === e.target.value);
                 setAddForm({...addForm, id: e.target.value, clinic_name: c?.nome_completo || ''});
               }}>
                 <option value="">Selecione...</option>
                 {crmUsers.map(c => <option key={c.id} value={c.id}>{c.nome_completo} - {c.email}</option>)}
               </select>
             </div>
             <div className="space-y-1">
               <Label>Nome da Clínica para a Plataforma</Label>
               <Input value={addForm.clinic_name} onChange={e=>setAddForm({...addForm, clinic_name: e.target.value})} />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <Label>Especialidade</Label>
                 <Input placeholder="Ex: Harmonização" value={addForm.specialty} onChange={e=>setAddForm({...addForm, specialty: e.target.value})} />
               </div>
               <div className="space-y-1">
                 <Label>Plano de Acesso</Label>
                 <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={addForm.plan} onChange={e=>setAddForm({...addForm, plan: e.target.value})}>
                   <option value="pca">P.C.A.</option><option value="gca">G.C.A.</option>
                 </select>
               </div>
             </div>
           </div>
           <DialogFooter><Button onClick={submitAddUser} className="bg-[#E85D24]" disabled={!addForm.id}>Garantir Acesso</Button></DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Modal: Perfil Completo Dummy/Visual */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-xlg">
          <DialogHeader><DialogTitle>Perfil Completo</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-secondary/30 p-4 rounded-lg">
                <div><span className="text-muted-foreground">Nome da Clínica:</span> <br/><span className="font-medium">{selectedUser.clinic_name}</span></div>
                <div><span className="text-muted-foreground">Email de Acesso:</span> <br/><span className="font-medium">{selectedUser.email}</span></div>
                <div><span className="text-muted-foreground">Especialidade Principal:</span> <br/><span className="font-medium">{selectedUser.specialty || '-'}</span></div>
                <div><span className="text-muted-foreground">Telefone/WhatsApp:</span> <br/><span className="font-medium">{selectedUser.whatsapp || '-'}</span></div>
              </div>
              <h4 className="font-medium mt-4 border-b pb-2">Status do Cérebro Central</h4>
              <div className="text-sm">
                 <Badge variant={selectedUser.cerebro_complete ? "default" : "secondary"}>
                   {selectedUser.cerebro_complete ? 'Configurado' : 'Não Configurado'}
                 </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Reset Progress */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent border-red-500>
           <DialogHeader><DialogTitle className="text-red-600">Atenção: Resetar Progresso</DialogTitle></DialogHeader>
           <p className="text-sm text-muted-foreground">
             Você está prestes a apagar **TODO** o histórico de aulas concluídas e progresso do cliente <strong>{selectedUser?.clinic_name}</strong>. 
             Os materiais gerados não serão perdidos, mas ele voltará à Fase 1 na jornada.
           </p>
           <DialogFooter>
             <Button variant="ghost" onClick={() => setShowReset(false)}>Cancelar</Button>
             <Button variant="destructive" onClick={handleResetProgress}>Sim, Resetar Progresso</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
