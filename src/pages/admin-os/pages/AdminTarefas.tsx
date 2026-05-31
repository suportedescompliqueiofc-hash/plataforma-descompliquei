import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, Loader2, Plus, Calendar as CalendarIcon, Tag, Trash2, CheckCircle2, CheckSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isAfter, isBefore, startOfToday, endOfToday, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string; // 'pendente' | 'em_andamento' | 'concluida' | 'atrasada'
  priority: string; // 'urgente' | 'alta' | 'media' | 'baixa'
  due_date: string | null;
  client_id: string | null;
  tags: string[];
  subtasks: Subtask[];
  platform_users?: { clinic_name: string };
}

export default function AdminTarefas() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<{id:string, clinic_name:string}[]>([]);

  // Filters
  const [activeTab, setActiveTab] = useState<'minhas'|'todas'>((sessionStorage.getItem('admin_tarefas_tab') as any) || 'minhas');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todas');
  const [filterPriority, setFilterPriority] = useState('Todas');
  const [filterClient, setFilterClient] = useState('Todos');

  // Detail & New Task
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '', description: '', status: 'pendente', priority: 'media', due_date: '', client_id: 'none', tags: [], subtasks: []
  });
  const [newTag, setNewTag] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [modalNewTag, setModalNewTag] = useState('');
  const [modalNewSubtaskTitle, setModalNewSubtaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Tarefas · Admin OS | Descompliquei';
    loadData();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('admin_tarefas_tab', activeTab);
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch sequentially to prevent Supabase 'AbortError: Lock broken' from aggressive token refreshes
      const { data: clientsData } = await supabase.from('platform_users').select('id, clinic_name');
      if (clientsData) setClients(clientsData);

      const { data: tasksData, error } = await supabase
        .from('admin_tasks')
        .select(`*, platform_users(clinic_name)`)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setTasks(tasksData || []);
    } catch (err: any) {
      // Ignore AbortErrors that happen if component unmounts or lock is stolen during fast refreshes
      if (err.name !== 'AbortError' && err.message?.indexOf('AbortError') === -1) {
        toast.error(err.message || 'Erro ao carregar dados');
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    try {
      const { error } = await supabase.from('admin_tasks').update(updates).eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      if (selectedTask?.id === id) setSelectedTask({ ...selectedTask, ...updates });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function saveNewTask() {
    if (!newTask.title) return toast.error('Título é obrigatório');
    setSaving(true);
    try {
      const payload = { ...newTask };
      if (payload.client_id === 'none') payload.client_id = null;
      if (!payload.due_date) payload.due_date = null;

      const { error } = await supabase.from('admin_tasks').insert([payload]);
      if (error) throw error;
      
      toast.success('Tarefa criada!');
      setShowNewModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      const { error } = await supabase.from('admin_tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== id));
      if (selectedTask?.id === id) setSelectedTask(null);
      toast.success('Tarefa excluída.');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const hoje = startOfToday();
  const hojeFim = endOfToday();
  const semanaFim = endOfWeek(hoje, { weekStartsOn: 0 });

  const filtered = tasks.filter(t => {
    // Search
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.platform_users?.clinic_name?.toLowerCase().includes(search.toLowerCase())) return false;
    
    // Status (calculating 'Atrasada' virtually if not concluded and past due)
    const isAtrasada = t.status !== 'concluida' && t.due_date && isBefore(new Date(t.due_date), hoje);
    if (filterStatus === 'atrasada' && !isAtrasada) return false;
    if (filterStatus !== 'Todas' && filterStatus !== 'atrasada' && t.status !== filterStatus) return false;

    // Priority & Client
    if (filterPriority !== 'Todas' && t.priority !== filterPriority) return false;
    if (filterClient !== 'Todos' && t.client_id !== filterClient && !(filterClient === 'none' && !t.client_id)) return false;

    return true;
  });

  // Groups (using noon to avoid timezone date shifting)
  const getSafeDate = (d: string) => new Date(d.substring(0, 10) + 'T12:00:00');
  const safeHoje = new Date();
  
  const atrasadas = filtered.filter(t => t.status !== 'concluida' && t.due_date && isBefore(getSafeDate(t.due_date), hoje));
  const paraHoje = filtered.filter(t => t.status !== 'concluida' && t.due_date && isSameDay(getSafeDate(t.due_date), hoje));
  const estaSemana = filtered.filter(t => t.status !== 'concluida' && t.due_date && isAfter(getSafeDate(t.due_date), hojeFim) && isBefore(getSafeDate(t.due_date), addDays(semanaFim, 1)));
  const futuras = filtered.filter(t => t.status !== 'concluida' && (!t.due_date || isAfter(getSafeDate(t.due_date), semanaFim)));
  const concluidas = filtered.filter(t => t.status === 'concluida');

  const getPriorityColor = (p: string) => {
    if (p === 'urgente') return 'bg-red-500/20 text-red-500 hover:bg-red-500/30';
    if (p === 'alta') return 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30';
    if (p === 'media') return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30';
    return 'bg-green-500/20 text-green-500 hover:bg-green-500/30';
  };

  const getPriorityLabel = (p: string) => {
    if (p === 'urgente') return 'Urgente';
    if (p === 'alta') return 'Alta';
    if (p === 'media') return 'Média';
    return 'Baixa';
  };

  const renderTaskList = (list: Task[], title: string, dotColor?: string) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          {dotColor && <div className={cn('h-2 w-2 rounded-full shrink-0', dotColor)} />}
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{title}</p>
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground/40">{list.length}</span>
        </div>
        <div className="space-y-1.5">
          {list.map(t => {
            const subTotal = t.subtasks?.length || 0;
            const subDone = t.subtasks?.filter(s => s.completed).length || 0;
            return (
              <div key={t.id}
                className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3 flex items-center justify-between cursor-pointer hover:border-border/80 hover:bg-muted/20 transition-all group"
                onClick={() => setSelectedTask(t)}>
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={t.status === 'concluida'}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(c) => updateTask(t.id, { status: c ? 'concluida' : 'pendente' })}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm font-semibold', t.status === 'concluida' ? 'line-through text-muted-foreground/50' : 'text-foreground')}>
                        {t.title}
                      </span>
                      {t.priority && (
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', getPriorityColor(t.priority))}>
                          {getPriorityLabel(t.priority)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground/60 flex-wrap">
                      {t.platform_users?.clinic_name && (
                        <span className="px-1.5 py-0.5 rounded-md bg-muted/60 border border-border/40 text-[10px]">{t.platform_users.clinic_name}</span>
                      )}
                      {t.due_date && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" /> {format(new Date(t.due_date.substring(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')}
                        </span>
                      )}
                      {subTotal > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {subDone}/{subTotal}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteTask(t.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Gestão de Tarefas</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Organize e acompanhe o trabalho operacional</p>
        </div>
        <Button onClick={() => setShowNewModal(true)} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Nova Tarefa
        </Button>
      </div>

      {/* TABS PILL */}
      <div className="flex items-center bg-muted/40 rounded-xl p-1 w-fit gap-0.5">
        {([['minhas', 'Minhas Tarefas'], ['todas', 'Todas as Tarefas']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn('px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
              activeTab === id ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input placeholder="Buscar por título ou cliente..." className="pl-9 h-10 rounded-lg border-border/60 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] h-10 rounded-lg border-border/60"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todos os Status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="atrasada">Atrasada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[160px] h-10 rounded-lg border-border/60"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas as Prioridades</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[180px] h-10 rounded-lg border-border/60"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os Clientes</SelectItem>
            <SelectItem value="none">Sem Cliente</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clinic_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-40 mb-4" />
          <Skeleton className="h-[80px] w-full rounded-xl" />
          <Skeleton className="h-[80px] w-full rounded-xl" />
          <Skeleton className="h-[80px] w-full rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/60 bg-muted/[0.02]">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <CheckSquare className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma tarefa encontrada</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 mb-4">Não há tarefas correspondentes aos filtros atuais</p>
          <Button onClick={() => setShowNewModal(true)} variant="outline" className="h-8 rounded-lg text-xs border-border/60 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nova Tarefa
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {renderTaskList(atrasadas, 'Atrasadas', 'bg-red-500')}
          {renderTaskList(paraHoje, 'Para Hoje', 'bg-amber-400')}
          {renderTaskList(estaSemana, 'Esta Semana', 'bg-blue-500')}
          {renderTaskList(futuras, 'Futuras', 'bg-muted-foreground/40')}
          {renderTaskList(concluidas, 'Concluídas', 'bg-emerald-500')}
        </div>
      )}

      {/* DETALHES DA TAREFA (SHEET) */}
      <Sheet open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selectedTask && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>
                  <Input 
                    value={selectedTask.title} 
                    onChange={e => setSelectedTask({...selectedTask, title: e.target.value})}
                    onBlur={() => updateTask(selectedTask.id, { title: selectedTask.title })}
                    className="text-xl font-bold border-none px-0 focus-visible:ring-0" 
                  />
                </SheetTitle>
              </SheetHeader>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                    <Select value={selectedTask.status} onValueChange={v => updateTask(selectedTask.id, { status: v })}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Prioridade</label>
                    <Select value={selectedTask.priority} onValueChange={v => updateTask(selectedTask.id, { priority: v })}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgente">Urgente</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><CalendarIcon className="h-3 w-3"/> Vencimento</label>
                    <Input 
                      type="date" 
                      value={selectedTask.due_date ? selectedTask.due_date.substring(0, 10) : ''} 
                      onChange={e => updateTask(selectedTask.id, { due_date: e.target.value ? e.target.value + 'T12:00:00Z' : null })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Cliente Vinculado</label>
                    <Select value={selectedTask.client_id || 'none'} onValueChange={v => updateTask(selectedTask.id, { client_id: v === 'none' ? null : v })}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clinic_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Descrição</label>
                  <Textarea 
                    value={selectedTask.description || ''} 
                    onChange={e => setSelectedTask({...selectedTask, description: e.target.value})}
                    onBlur={() => updateTask(selectedTask.id, { description: selectedTask.description })}
                    rows={4} 
                    placeholder="Adicione detalhes à tarefa..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><Tag className="h-3 w-3"/> Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(selectedTask.tags || []).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="pr-1 flex items-center gap-1">
                        {tag} <button onClick={() => updateTask(selectedTask.id, { tags: selectedTask.tags.filter(t => t !== tag) })} className="hover:text-red-500 rounded-full p-0.5"><Trash2 className="h-3 w-3"/></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nova tag..." onKeyDown={e => {
                      if (e.key === 'Enter' && newTag) {
                        updateTask(selectedTask.id, { tags: [...(selectedTask.tags || []), newTag] });
                        setNewTag('');
                      }
                    }}/>
                    <Button variant="outline" onClick={() => {
                      if(newTag) { updateTask(selectedTask.id, { tags: [...(selectedTask.tags || []), newTag] }); setNewTag(''); }
                    }}>Add</Button>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Subtarefas</label>
                    <span className="text-xs text-muted-foreground">
                      {(selectedTask.subtasks || []).filter(s => s.completed).length}/{(selectedTask.subtasks || []).length} concluídas
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-[#E85D24] transition-all" style={{ width: `${(selectedTask.subtasks?.length ? (selectedTask.subtasks.filter(s => s.completed).length / selectedTask.subtasks.length) * 100 : 0)}%` }} />
                  </div>

                  <div className="space-y-2 mt-4">
                    {(selectedTask.subtasks || []).map(sub => (
                      <div key={sub.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={sub.completed} onCheckedChange={(c) => {
                            const newSubs = selectedTask.subtasks.map(s => s.id === sub.id ? { ...s, completed: !!c } : s);
                            updateTask(selectedTask.id, { subtasks: newSubs });
                          }} />
                          <span className={`text-sm ${sub.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{sub.title}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-500" onClick={() => {
                          updateTask(selectedTask.id, { subtasks: selectedTask.subtasks.filter(s => s.id !== sub.id) });
                        }}><Trash2 className="h-3 w-3"/></Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <Input value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Nova subtarefa..." onKeyDown={e => {
                      if (e.key === 'Enter' && newSubtaskTitle) {
                        updateTask(selectedTask.id, { subtasks: [...(selectedTask.subtasks || []), { id: Date.now().toString(), title: newSubtaskTitle, completed: false }] });
                        setNewSubtaskTitle('');
                      }
                    }}/>
                    <Button variant="secondary" onClick={() => {
                      if(newSubtaskTitle) { updateTask(selectedTask.id, { subtasks: [...(selectedTask.subtasks || []), { id: Date.now().toString(), title: newSubtaskTitle, completed: false }] }); setNewSubtaskTitle(''); }
                    }}><Plus className="h-4 w-4"/></Button>
                  </div>
                </div>

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* NOVA TAREFA MODAL */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título</label>
              <Input value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="Ex: Preparar material do cliente X" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={newTask.priority} onValueChange={v => setNewTask({...newTask, priority: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Vencimento</label>
                <Input type="date" value={newTask.due_date ? newTask.due_date.substring(0, 10) : ''} onChange={e => setNewTask({...newTask, due_date: e.target.value ? e.target.value + 'T12:00:00Z' : ''})} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cliente Vinculado</label>
              <Select value={newTask.client_id || 'none'} onValueChange={v => setNewTask({...newTask, client_id: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clinic_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} rows={2} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1"><Tag className="h-3 w-3"/> Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(newTask.tags || []).map((tag, i) => (
                  <Badge key={i} variant="secondary" className="pr-1 flex items-center gap-1">
                    {tag} <button onClick={() => setNewTask({...newTask, tags: newTask.tags?.filter(t => t !== tag)})} className="hover:text-red-500 rounded-full p-0.5"><Trash2 className="h-3 w-3"/></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={modalNewTag} onChange={e => setModalNewTag(e.target.value)} placeholder="Nova tag..." onKeyDown={e => {
                  if (e.key === 'Enter' && modalNewTag) {
                    setNewTask({...newTask, tags: [...(newTask.tags || []), modalNewTag]});
                    setModalNewTag('');
                  }
                }}/>
                <Button variant="outline" onClick={() => {
                  if(modalNewTag) { setNewTask({...newTask, tags: [...(newTask.tags || []), modalNewTag]}); setModalNewTag(''); }
                }}>Add</Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Subtarefas</span>
                <span className="text-xs text-muted-foreground font-normal">{(newTask.subtasks || []).length} adicionadas</span>
              </label>
              <div className="space-y-2 mt-2">
                {(newTask.subtasks || []).map(sub => (
                  <div key={sub.id} className="flex items-center justify-between bg-muted/30 p-2 rounded text-sm">
                    <span>{sub.title}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-500/10" onClick={() => {
                      setNewTask({...newTask, subtasks: newTask.subtasks?.filter(s => s.id !== sub.id)});
                    }}><Trash2 className="h-3 w-3"/></Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input value={modalNewSubtaskTitle} onChange={e => setModalNewSubtaskTitle(e.target.value)} placeholder="Nova subtarefa..." onKeyDown={e => {
                  if (e.key === 'Enter' && modalNewSubtaskTitle) {
                    setNewTask({...newTask, subtasks: [...(newTask.subtasks || []), { id: Date.now().toString(), title: modalNewSubtaskTitle, completed: false }]});
                    setModalNewSubtaskTitle('');
                  }
                }}/>
                <Button variant="secondary" onClick={() => {
                  if(modalNewSubtaskTitle) { setNewTask({...newTask, subtasks: [...(newTask.subtasks || []), { id: Date.now().toString(), title: modalNewSubtaskTitle, completed: false }]}); setModalNewSubtaskTitle(''); }
                }}><Plus className="h-4 w-4"/></Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button onClick={saveNewTask} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null} Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
