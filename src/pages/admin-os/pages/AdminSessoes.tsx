import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon, Clock, Link as LinkIcon, Video, Plus, Edit3,
  Loader2, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  format, isAfter, isBefore, startOfToday, addDays,
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ────────────────────────────────────────────────────────────────────
interface Sessao {
  id: string;
  title: string;
  type: string;
  scheduled_at: string;
  meet_link: string;
  recording_url: string;
  description: string;
  active: boolean;
}

interface CalEvent {
  id: string;
  title: string;
  type: string;
  start_at: string;
  end_at?: string;
  client_id?: string;
  meet_link?: string;
  description?: string;
  is_sessao_tatica?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminSessoes() {

  const [activeTab, setActiveTab] = useState<'sessoes' | 'calendario'>('sessoes');

  // ── Sessões state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [filterType, setFilterType] = useState('todas');
  const [filterTime, setFilterTime] = useState('todas');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Sessao>>({
    title: '', type: 'comercial', scheduled_at: '', meet_link: '', recording_url: '', description: '', active: true
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sessao | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Calendário state ───────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [clients, setClients] = useState<{ id: string; clinic_name: string }[]>([]);
  const [showCalModal, setShowCalModal] = useState(false);
  const [calForm, setCalForm] = useState<Partial<CalEvent>>({
    title: '', type: 'reuniao', start_at: '', end_at: '', meet_link: '', description: '', client_id: 'none'
  });
  const [calSaving, setCalSaving] = useState(false);

  useEffect(() => {
    document.title = 'Sessões Táticas · Admin OS | Descompliquei';
    loadSessoes();
    loadClients();
  }, []);

  useEffect(() => {
    loadCalData();
  }, [currentDate]);

  // ── Sessões functions ──────────────────────────────────────────────────────
  async function loadSessoes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_sessoes_taticas')
        .select('*')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      setSessoes(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSessao() {
    if (!formData.title || !formData.scheduled_at) {
      return toast.error('Título e Data são obrigatórios');
    }
    setSaving(true);
    try {
      if (formData.id) {
        const { error } = await supabase.from('platform_sessoes_taticas').update(formData).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('platform_sessoes_taticas').insert([formData]);
        if (error) throw error;
      }
      toast.success('Sessão salva com sucesso');
      setShowModal(false);
      loadSessoes();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      const { error } = await supabase.from('platform_sessoes_taticas').update({ active: !current }).eq('id', id);
      if (error) throw error;
      setSessoes(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function deleteSessao() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('platform_sessoes_taticas').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setSessoes(prev => prev.filter(s => s.id !== deleteTarget.id));
      toast.success('Sessão excluída com sucesso');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function openNew() {
    setFormData({ title: '', type: 'comercial', scheduled_at: '', meet_link: '', recording_url: '', description: '', active: true });
    setShowModal(true);
  }

  const hoje = startOfToday();
  const proximas = sessoes.filter(s => s.active && isAfter(new Date(s.scheduled_at), hoje));
  const proximaSessao = proximas.length > 0 ? proximas[0] : null;

  const filtered = sessoes.filter(s => {
    if (filterType !== 'todas' && s.type !== filterType) return false;
    if (filterTime === 'futuras' && !isAfter(new Date(s.scheduled_at), hoje)) return false;
    if (filterTime === 'passadas' && !isBefore(new Date(s.scheduled_at), hoje)) return false;
    return true;
  });

  // ── Calendário functions ───────────────────────────────────────────────────
  async function loadClients() {
    const { data } = await supabase.from('platform_users').select('id, clinic_name');
    if (data) setClients(data);
  }

  async function loadCalData() {
    setCalLoading(true);
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const start = startOfWeek(monthStart, { weekStartsOn: 0 }).toISOString();
      const end = endOfWeek(monthEnd, { weekStartsOn: 0 }).toISOString();

      const [{ data: adminEvts }, { data: sessaoData }] = await Promise.all([
        supabase.from('admin_events').select('*').gte('start_at', start).lte('start_at', end),
        supabase.from('platform_sessoes_taticas').select('*').eq('active', true).gte('scheduled_at', start).lte('scheduled_at', end),
      ]);

      const formattedSessoes: CalEvent[] = (sessaoData || []).map(s => ({
        id: s.id, title: s.title, type: 'sessao_tatica',
        start_at: s.scheduled_at, meet_link: s.meet_link,
        description: s.description, is_sessao_tatica: true
      }));

      setCalEvents([...(adminEvts || []), ...formattedSessoes]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCalLoading(false);
    }
  }

  async function saveCalEvent() {
    if (!calForm.title || !calForm.start_at) {
      return toast.error('Título e Data Inicial são obrigatórios');
    }
    if (calForm.is_sessao_tatica) {
      return toast.error('Sessões Táticas devem ser editadas na aba Sessões');
    }
    setCalSaving(true);
    try {
      const payload = { ...calForm };
      if (payload.client_id === 'none') payload.client_id = undefined;
      if (calForm.id) {
        const { error } = await supabase.from('admin_events').update(payload).eq('id', calForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('admin_events').insert([payload]);
        if (error) throw error;
      }
      toast.success('Evento salvo!');
      setShowCalModal(false);
      loadCalData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCalSaving(false);
    }
  }

  async function deleteCalEvent() {
    if (!calForm.id || calForm.is_sessao_tatica) return;
    if (!confirm('Deseja realmente excluir este evento?')) return;
    setCalSaving(true);
    try {
      const { error } = await supabase.from('admin_events').delete().eq('id', calForm.id);
      if (error) throw error;
      toast.success('Evento excluído!');
      setShowCalModal(false);
      loadCalData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCalSaving(false);
    }
  }

  const renderCalHeader = () => {
    let startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
    return (
      <div className="grid grid-cols-7 border-b border-border">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="text-center font-bold text-sm text-muted-foreground uppercase py-2">
            {format(addDays(startDate, i), 'EEE', { locale: ptBR })}
          </div>
        ))}
      </div>
    );
  };

  const renderCalCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const dayEvents = calEvents.filter(e => isSameDay(new Date(e.start_at), cloneDay));
        days.push(
          <div
            key={day.toString()}
            className={`min-h-[110px] p-2 border-r border-b border-border relative transition-colors ${
              !isSameMonth(day, monthStart) ? 'bg-muted/10 text-muted-foreground/30'
              : isToday(day) ? 'bg-blue-500/5'
              : 'hover:bg-muted/20 cursor-pointer'
            }`}
            onClick={() => {
              if (isSameMonth(cloneDay, monthStart)) {
                setCalForm({ title: '', type: 'reuniao', start_at: format(cloneDay, "yyyy-MM-dd'T'10:00"), client_id: 'none' });
                setShowCalModal(true);
              }
            }}
          >
            <div className={`text-right font-medium text-sm mb-1 ${isToday(day) ? 'text-blue-500 font-bold' : ''}`}>
              {format(day, 'd')}
            </div>
            <div className="flex flex-col gap-1">
              {dayEvents.map(evt => {
                let colorClass = 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30';
                if (evt.type === 'sessao_tatica') colorClass = 'bg-foreground/10 text-foreground border-foreground/20';
                if (evt.type === 'compromisso') colorClass = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
                if (evt.type === 'lembrete') colorClass = 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30';
                return (
                  <div
                    key={evt.id}
                    onClick={e => { e.stopPropagation(); setCalForm(evt); setShowCalModal(true); }}
                    className={`text-[10px] px-1.5 py-1 rounded border truncate font-medium cursor-pointer ${colorClass}`}
                    title={evt.title}
                  >
                    {format(new Date(evt.start_at), 'HH:mm')} - {evt.title}
                  </div>
                );
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7" key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div className="border-l border-t border-border bg-card rounded-b-lg overflow-hidden">{rows}</div>;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Sessões Táticas</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Gerencie os encontros ao vivo com seus clientes</p>
        </div>
        <Button onClick={openNew} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Nova Sessão
        </Button>
      </div>

      {/* TABS PILL */}
      <div className="flex items-center bg-muted/40 rounded-xl p-1 w-fit gap-0.5">
        {(['sessoes', 'calendario'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn('px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
              activeTab === t ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
            {t === 'sessoes' ? 'Sessões' : 'Calendário'}
          </button>
        ))}
      </div>

        {/* ── ABA SESSÕES ──────────────────────────────────────────────────── */}
        {activeTab === 'sessoes' && (
          <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Próxima sessão */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próxima Sessão</p>
              </div>
              <div className="p-5">
                {proximaSessao ? (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-foreground font-display">{proximaSessao.title}</h3>
                    <div className="flex items-center text-sm text-muted-foreground gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                      {format(new Date(proximaSessao.scheduled_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40 uppercase">
                      {proximaSessao.type}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma sessão futura agendada.</p>
                )}
              </div>
            </div>

            {/* Mini calendário 30 dias */}
            <div className="md:col-span-2 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próximos 30 dias</p>
              </div>
              <div className="p-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const d = addDays(hoje, i);
                    const hasSessao = sessoes.some(s => new Date(s.scheduled_at).toDateString() === d.toDateString());
                    if (!hasSessao && i > 14) return null;
                    return (
                      <div key={i} className={cn(
                        'shrink-0 flex flex-col items-center justify-center p-2 rounded-xl border w-14 h-16',
                        hasSessao ? 'border-foreground/20 bg-foreground/[0.06]' : 'border-border/40 bg-muted/20'
                      )}>
                        <span className="text-[9px] text-muted-foreground uppercase font-semibold">{format(d, 'EEE', { locale: ptBR })}</span>
                        <span className={cn('text-base font-bold', hasSessao ? 'text-foreground' : 'text-muted-foreground')}>{format(d, 'dd')}</span>
                        {hasSessao && <div className="w-1 h-1 rounded-full bg-foreground mt-0.5" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de sessões */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center gap-3 flex-wrap">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px] h-8 rounded-lg border-border/60 text-xs bg-background"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os Tipos</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="demanda">Demanda</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTime} onValueChange={setFilterTime}>
                <SelectTrigger className="w-[160px] h-8 rounded-lg border-border/60 text-xs bg-background"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os Períodos</SelectItem>
                  <SelectItem value="futuras">Futuras</SelectItem>
                  <SelectItem value="passadas">Passadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    {['Data/Hora', 'Título', 'Tipo', 'Links', 'Ativa', 'Ações'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loading
                    ? <tr><td colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    : filtered.length === 0
                      ? <tr><td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">Nenhuma sessão encontrada.</td></tr>
                      : filtered.map(s => (
                        <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground tabular-nums">{format(new Date(s.scheduled_at), 'dd/MM/yyyy HH:mm')}</td>
                          <td className="px-5 py-3.5 font-semibold text-[13px] text-foreground">{s.title}</td>
                          <td className="px-5 py-3.5">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40 uppercase">{s.type}</span>
                          </td>
                          <td className="px-5 py-3.5 space-y-1">
                            {s.meet_link && <a href={s.meet_link} target="_blank" rel="noreferrer" className="flex items-center text-xs text-blue-500 hover:underline gap-1"><LinkIcon className="h-3 w-3" /> Reunião</a>}
                            {s.recording_url && <a href={s.recording_url} target="_blank" rel="noreferrer" className="flex items-center text-xs text-emerald-500 hover:underline gap-1"><Video className="h-3 w-3" /> Gravação</a>}
                          </td>
                          <td className="px-5 py-3.5">
                            <Switch checked={s.active} onCheckedChange={() => toggleActive(s.id, s.active)} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setFormData(s); setShowModal(true); }}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10" onClick={() => setDeleteTarget(s)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {/* ── ABA CALENDÁRIO ───────────────────────────────────────────────── */}
        {activeTab === 'calendario' && (
          <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-base font-bold capitalize text-foreground font-display w-44 text-center">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" className="h-8 rounded-lg text-xs border-border/60 ml-1" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
              {calLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <Button onClick={() => { setCalForm({ title: '', type: 'reuniao', start_at: '', client_id: 'none' }); setShowCalModal(true); }}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Evento
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            {renderCalHeader()}
            {renderCalCells()}
          </div>

          <div className="flex gap-4 items-center text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500/70" /> Reunião</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-foreground/40" /> Sessão Tática</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> Compromisso</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500/70" /> Lembrete</div>
          </div>
        </div>
        )}

      {/* ── MODAL SESSÃO ─────────────────────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0"><DialogTitle>{formData.id ? 'Editar Sessão' : 'Nova Sessão'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</label>
              <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Sessão Tática #12 - Fechamento" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                  <SelectTrigger className="h-10 rounded-lg border-border/60 focus:ring-1 focus:ring-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="comercial">Comercial</SelectItem><SelectItem value="demanda">Demanda</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data e Hora</label>
                <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" type="datetime-local" value={formData.scheduled_at ? new Date(new Date(formData.scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setFormData({ ...formData, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Link da Reunião (Meet/Zoom)</label>
              <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={formData.meet_link || ''} onChange={e => setFormData({ ...formData, meet_link: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">URL da Gravação</label>
              <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={formData.recording_url || ''} onChange={e => setFormData({ ...formData, recording_url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</label>
              <Textarea className="rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={formData.active} onCheckedChange={c => setFormData({ ...formData, active: !!c })} />
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sessão ativa na plataforma</label>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={saveSessao} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL CALENDÁRIO ─────────────────────────────────────────────────── */}
      <Dialog open={showCalModal} onOpenChange={setShowCalModal}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0"><DialogTitle>{calForm.id ? 'Detalhes do Evento' : 'Novo Evento'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
            {calForm.is_sessao_tatica ? (
              <div className="p-4 bg-muted/50 rounded-lg border border-border text-center space-y-2">
                <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="font-bold text-foreground">{calForm.title}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(calForm.start_at!), "dd/MM/yyyy 'às' HH:mm")}</p>
                {calForm.meet_link && <a href={calForm.meet_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm block">Acessar Reunião</a>}
                <p className="text-xs mt-4 text-muted-foreground">Sessões Táticas devem ser editadas na aba Sessões.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</label>
                  <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={calForm.title} onChange={e => setCalForm({ ...calForm, title: e.target.value })} placeholder="Ex: Reunião de Alinhamento" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</label>
                    <Select value={calForm.type} onValueChange={v => setCalForm({ ...calForm, type: v })}>
                      <SelectTrigger className="h-10 rounded-lg border-border/60 focus:ring-1 focus:ring-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reuniao">Reunião</SelectItem>
                        <SelectItem value="compromisso">Compromisso</SelectItem>
                        <SelectItem value="lembrete">Lembrete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente (Opcional)</label>
                    <Select value={calForm.client_id || 'none'} onValueChange={v => setCalForm({ ...calForm, client_id: v })}>
                      <SelectTrigger className="h-10 rounded-lg border-border/60 focus:ring-1 focus:ring-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clinic_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Início</label>
                    <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" type="datetime-local" value={calForm.start_at ? new Date(new Date(calForm.start_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setCalForm({ ...calForm, start_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Fim (Opcional)</label>
                    <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" type="datetime-local" value={calForm.end_at ? new Date(new Date(calForm.end_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setCalForm({ ...calForm, end_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Link Reunião</label>
                  <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={calForm.meet_link || ''} onChange={e => setCalForm({ ...calForm, meet_link: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</label>
                  <Textarea className="rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={calForm.description || ''} onChange={e => setCalForm({ ...calForm, description: e.target.value })} rows={3} />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 flex justify-between items-center sm:justify-between">
            {(!calForm.is_sessao_tatica && calForm.id)
              ? <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={deleteCalEvent} disabled={calSaving}>Excluir</Button>
              : <div />
            }
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowCalModal(false)}>Cancelar</Button>
              {!calForm.is_sessao_tatica && (
                <Button onClick={saveCalEvent} disabled={calSaving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
                  {calSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null} Salvar
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE SESSÃO ────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              A sessão <strong>"{deleteTarget?.title}"</strong> será removida permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSessao} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
