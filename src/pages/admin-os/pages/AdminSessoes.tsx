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
  Loader2, Trash2, ChevronLeft, ChevronRight, Youtube, PlayCircle, FileVideo,
  Repeat, RefreshCw
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

interface SessaoRecorrente {
  id: string;
  title: string;
  description?: string;
  day_of_week: number; // 0=domingo ... 6=sábado (Date.getDay())
  time_of_day: string; // "HH:MM" ou "HH:MM:SS"
  meet_link?: string;
  weeks_ahead: number;
  active: boolean;
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

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

  const [activeTab, setActiveTab] = useState<'sessoes' | 'calendario' | 'gravacoes' | 'recorrencia'>('sessoes');

  // ── Sessões state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
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

  // ── Gravações state ────────────────────────────────────────────────────────
  const [showRecModal, setShowRecModal] = useState(false);
  const [recForm, setRecForm] = useState<{ id: string; title: string; recording_url: string }>({ id: '', title: '', recording_url: '' });
  const [recSaving, setRecSaving] = useState(false);

  // ── Recorrência (sessão padronizada semanal) state ─────────────────────────
  const [recorrencias, setRecorrencias] = useState<SessaoRecorrente[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [showRecRuleModal, setShowRecRuleModal] = useState(false);
  const [recRuleForm, setRecRuleForm] = useState<Partial<SessaoRecorrente>>({
    title: '', description: '', day_of_week: 1, time_of_day: '09:00', meet_link: '', weeks_ahead: 12, active: true
  });
  const [recRuleSaving, setRecRuleSaving] = useState(false);
  const [recRuleDeleteTarget, setRecRuleDeleteTarget] = useState<SessaoRecorrente | null>(null);
  const [gerandoId, setGerandoId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sessões Táticas · Admin OS | Descompliquei';
    loadSessoes();
    loadClients();
    loadRecorrencias();
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

  // ── Gravações helpers ──────────────────────────────────────────────────────
  function getYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  async function saveRecordingUrl() {
    if (!recForm.recording_url.trim()) { toast.error('Cole o link do YouTube'); return; }
    setRecSaving(true);
    try {
      const { error } = await supabase
        .from('platform_sessoes_taticas')
        .update({ recording_url: recForm.recording_url.trim() })
        .eq('id', recForm.id);
      if (error) throw error;
      toast.success('Gravação vinculada com sucesso');
      setShowRecModal(false);
      loadSessoes();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRecSaving(false);
    }
  }

  async function removeRecordingUrl(id: string) {
    const { error } = await supabase
      .from('platform_sessoes_taticas')
      .update({ recording_url: '' })
      .eq('id', id);
    if (error) { toast.error('Erro ao remover gravação'); return; }
    toast.success('Gravação removida');
    loadSessoes();
  }

  // ── Recorrência functions ──────────────────────────────────────────────────
  async function loadRecorrencias() {
    setRecLoading(true);
    try {
      const { data, error } = await supabase.from('platform_sessoes_recorrentes').select('*').order('day_of_week');
      if (error) throw error;
      const regras = data || [];
      setRecorrencias(regras);
      // Rola o horizonte de ocorrências futuras toda vez que a página é aberta
      for (const regra of regras.filter((r: SessaoRecorrente) => r.active)) {
        await gerarOcorrencias(regra);
      }
      loadSessoes();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRecLoading(false);
    }
  }

  async function gerarOcorrencias(regra: SessaoRecorrente): Promise<number> {
    const [hh, mm] = (regra.time_of_day || '09:00').split(':').map(Number);
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    const diff = ((regra.day_of_week - cursor.getDay()) + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    const candidatas: Date[] = [];
    for (let i = 0; i < (regra.weeks_ahead || 12); i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i * 7);
      d.setHours(hh || 9, mm || 0, 0, 0);
      if (d.getTime() > Date.now()) candidatas.push(d);
    }
    if (candidatas.length === 0) return 0;

    const { data: existentes, error: selError } = await supabase
      .from('platform_sessoes_taticas')
      .select('scheduled_at')
      .eq('recorrencia_id', regra.id);
    if (selError) throw selError;

    const existentesSet = new Set((existentes || []).map((e: any) => new Date(e.scheduled_at).getTime()));
    const novas = candidatas.filter(d => !existentesSet.has(d.getTime()));
    if (novas.length === 0) return 0;

    const payload = novas.map(d => ({
      title: regra.title,
      description: regra.description || null,
      type: 'comercial',
      scheduled_at: d.toISOString(),
      meet_link: regra.meet_link || null,
      active: true,
      recorrencia_id: regra.id,
    }));

    const { error } = await supabase.from('platform_sessoes_taticas').insert(payload);
    if (error) throw error;
    return novas.length;
  }

  function openNewRecRule() {
    setRecRuleForm({ title: '', description: '', type: 'comercial', day_of_week: 1, time_of_day: '09:00', meet_link: '', weeks_ahead: 12, active: true });
    setShowRecRuleModal(true);
  }

  async function saveRecRule() {
    if (!recRuleForm.title || recRuleForm.day_of_week === undefined || !recRuleForm.time_of_day) {
      return toast.error('Título, dia da semana e horário são obrigatórios');
    }
    setRecRuleSaving(true);
    try {
      const payload = {
        title: recRuleForm.title,
        description: recRuleForm.description || null,
        day_of_week: Number(recRuleForm.day_of_week),
        time_of_day: recRuleForm.time_of_day,
        meet_link: recRuleForm.meet_link || null,
        weeks_ahead: Number(recRuleForm.weeks_ahead) || 12,
        active: recRuleForm.active !== false,
      };
      let regraId = recRuleForm.id;
      if (regraId) {
        const { error } = await supabase.from('platform_sessoes_recorrentes').update(payload).eq('id', regraId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('platform_sessoes_recorrentes').insert([payload]).select().single();
        if (error) throw error;
        regraId = data.id;
      }
      let geradas = 0;
      if (payload.active && regraId) {
        geradas = await gerarOcorrencias({ ...payload, id: regraId });
      }
      toast.success(geradas > 0 ? `Recorrência salva! ${geradas} sessão(ões) geradas no calendário.` : 'Recorrência salva!');
      setShowRecRuleModal(false);
      loadRecorrencias();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRecRuleSaving(false);
    }
  }

  async function toggleRecRuleActive(regra: SessaoRecorrente) {
    try {
      const { error } = await supabase.from('platform_sessoes_recorrentes').update({ active: !regra.active }).eq('id', regra.id);
      if (error) throw error;
      const atualizada = { ...regra, active: !regra.active };
      setRecorrencias(prev => prev.map(r => r.id === regra.id ? atualizada : r));
      if (atualizada.active) {
        const geradas = await gerarOcorrencias(atualizada);
        if (geradas > 0) { toast.success(`${geradas} sessão(ões) geradas`); loadSessoes(); }
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function deleteRecRule() {
    if (!recRuleDeleteTarget) return;
    try {
      const { error } = await supabase.from('platform_sessoes_recorrentes').delete().eq('id', recRuleDeleteTarget.id);
      if (error) throw error;
      toast.success('Recorrência removida. Sessões já geradas continuam no calendário.');
      setRecRuleDeleteTarget(null);
      loadRecorrencias();
    } catch (err: any) {
      toast.error(err.message);
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
  const statsData = [
    { label: 'Total', value: sessoes.length, sub: 'sessões cadastradas' },
    { label: 'Próximas', value: sessoes.filter(s => s.active && isAfter(new Date(s.scheduled_at), hoje)).length, sub: 'agendadas' },
    { label: 'Realizadas', value: sessoes.filter(s => isBefore(new Date(s.scheduled_at), hoje)).length, sub: 'sessões passadas' },
    { label: 'Gravações', value: sessoes.filter(s => s.recording_url && s.recording_url.trim() !== '').length, sub: 'disponíveis' },
  ];

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
        {(activeTab === 'sessoes' || activeTab === 'gravacoes') && (
          <Button onClick={openNew} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" /> Nova Sessão
          </Button>
        )}
        {activeTab === 'recorrencia' && (
          <Button onClick={openNewRecRule} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" /> Nova Recorrência
          </Button>
        )}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsData.map(({ label, value, sub }) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
            <p className="text-3xl font-bold tabular-nums text-foreground font-display">{value}</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* TABS PILL */}
      <div className="inline-flex items-center bg-muted/40 rounded-xl p-1 gap-0.5">
        {([
          { id: 'sessoes', label: 'Sessões' },
          { id: 'recorrencia', label: 'Recorrência' },
          { id: 'gravacoes', label: 'Gravações' },
          { id: 'calendario', label: 'Calendário' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
              activeTab === t.id ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ABA SESSÕES ────────────────────────────────────────────────────── */}
      {activeTab === 'sessoes' && (
        <div className="space-y-5">

          {/* Próxima sessão — destaque */}
          {proximaSessao ? (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próxima Sessão</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Encontro ao vivo mais próximo</p>
                </div>
              </div>
              <div className="p-5 flex items-center gap-6">
                {/* Date badge */}
                <div className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl border border-border/60 bg-muted/30">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {format(new Date(proximaSessao.scheduled_at), 'MMM', { locale: ptBR })}
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-foreground leading-none mt-0.5">
                    {format(new Date(proximaSessao.scheduled_at), 'dd')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground font-display truncate">{proximaSessao.title}</h3>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(proximaSessao.scheduled_at), "HH:mm '·' EEEE", { locale: ptBR })}
                    </span>
                    {proximaSessao.description && (
                      <span className="text-[12px] text-muted-foreground/60 truncate max-w-xs">{proximaSessao.description}</span>
                    )}
                  </div>
                </div>
                {proximaSessao.meet_link && (
                  <a href={proximaSessao.meet_link} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3 shrink-0">
                      <LinkIcon className="h-3 w-3" /> Acessar
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/[0.02] flex flex-col items-center justify-center py-10 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <CalendarIcon className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma sessão futura agendada</p>
              <p className="text-[11px] text-muted-foreground/40 mt-0.5">Crie a próxima sessão usando o botão acima</p>
            </div>
          )}

          {/* Lista de sessões */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <Video className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Todas as Sessões</p>
              </div>
              <Select value={filterTime} onValueChange={setFilterTime}>
                <SelectTrigger className="w-[150px] h-7 rounded-lg border-border/60 text-[11px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os períodos</SelectItem>
                  <SelectItem value="futuras">Somente futuras</SelectItem>
                  <SelectItem value="passadas">Somente passadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhuma sessão encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filtered.map(s => {
                  const isFutura = isAfter(new Date(s.scheduled_at), hoje);
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
                      {/* Date badge */}
                      <div className={cn(
                        'shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl border text-center',
                        isFutura ? 'border-foreground/15 bg-foreground/[0.05]' : 'border-border/40 bg-muted/20'
                      )}>
                        <span className="text-[9px] font-bold uppercase text-muted-foreground leading-none">
                          {format(new Date(s.scheduled_at), 'MMM', { locale: ptBR })}
                        </span>
                        <span className={cn('text-sm font-bold tabular-nums leading-tight', isFutura ? 'text-foreground' : 'text-muted-foreground')}>
                          {format(new Date(s.scheduled_at), 'dd')}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn('text-[13px] font-semibold truncate', !s.active && 'text-muted-foreground line-through')}>{s.title}</p>
                          {!s.active && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground/60 border border-border/40">
                              Inativa
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                            <Clock className="h-3 w-3" />
                            {format(new Date(s.scheduled_at), "HH:mm '·' EEE", { locale: ptBR })}
                          </span>
                          {s.meet_link && (
                            <a href={s.meet_link} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 hover:underline">
                              <LinkIcon className="h-3 w-3" /> Meet
                            </a>
                          )}
                          {s.recording_url && (
                            <a href={s.recording_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-emerald-500 hover:text-emerald-600 hover:underline">
                              <Video className="h-3 w-3" /> Gravação
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Status pill */}
                      <span className={cn(
                        'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1',
                        isFutura
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground/60 border-border/40'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', isFutura ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                        {isFutura ? 'Agendada' : 'Realizada'}
                      </span>

                      {/* Actions */}
                      <div className="shrink-0 flex items-center gap-2">
                        <Switch checked={s.active} onCheckedChange={() => toggleActive(s.id, s.active)} />
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => { setFormData({ ...s, type: s.type || 'comercial' }); setShowModal(true); }}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => setDeleteTarget(s)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA RECORRÊNCIA ────────────────────────────────────────────────── */}
      {activeTab === 'recorrencia' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-muted/[0.02] px-5 py-4 text-[12px] text-muted-foreground leading-relaxed">
            Configure um dia da semana e horário fixos (ex: toda Segunda às 09:00) para gerar automaticamente sessões de mentoria no calendário dos clientes — sem precisar cadastrar uma por uma. As próximas semanas são geradas sempre que esta página é aberta, ou na hora pelo botão "Gerar agora".
          </div>

          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sessões Padronizadas</p>
            </div>

            {recLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : recorrencias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Repeat className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhuma recorrência configurada</p>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">Crie uma para gerar sessões automaticamente toda semana</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {recorrencias.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
                    <div className={cn(
                      'shrink-0 flex flex-col items-center justify-center w-16 h-14 rounded-xl border text-center',
                      r.active ? 'border-foreground/15 bg-foreground/[0.05]' : 'border-border/40 bg-muted/20'
                    )}>
                      <span className="text-[9px] font-bold uppercase text-muted-foreground leading-none">{DIAS_SEMANA[r.day_of_week]?.slice(0, 3)}</span>
                      <span className={cn('text-sm font-bold tabular-nums leading-tight mt-0.5', r.active ? 'text-foreground' : 'text-muted-foreground')}>
                        {(r.time_of_day || '').slice(0, 5)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn('text-[13px] font-semibold truncate', !r.active && 'text-muted-foreground line-through')}>{r.title}</p>
                        {!r.active && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground/60 border border-border/40">Pausada</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        Toda {DIAS_SEMANA[r.day_of_week]} · próximas {r.weeks_ahead} semanas geradas automaticamente
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        size="sm" variant="outline"
                        className="h-7 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={gerandoId === r.id}
                        onClick={async () => {
                          setGerandoId(r.id);
                          try {
                            const n = await gerarOcorrencias(r);
                            toast.success(n > 0 ? `${n} sessão(ões) geradas` : 'Calendário já está em dia');
                            if (n > 0) loadSessoes();
                          } catch (err: any) {
                            toast.error(err.message);
                          } finally {
                            setGerandoId(null);
                          }
                        }}
                      >
                        {gerandoId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Gerar agora
                      </Button>
                      <Switch checked={r.active} onCheckedChange={() => toggleRecRuleActive(r)} />
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => { setRecRuleForm(r); setShowRecRuleModal(true); }}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
                          onClick={() => setRecRuleDeleteTarget(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA CALENDÁRIO ─────────────────────────────────────────────────── */}
      {activeTab === 'calendario' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-base font-bold capitalize text-foreground font-display w-44 text-center">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
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

          <div className="flex gap-5 items-center text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-blue-500/70" /> Reunião</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-foreground/40" /> Sessão Tática</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-emerald-500/70" /> Compromisso</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-amber-500/70" /> Lembrete</div>
          </div>
        </div>
      )}

      {/* ── ABA GRAVAÇÕES ───────────────────────────────────────────────────── */}
      {activeTab === 'gravacoes' && (() => {
        const comGravacao = sessoes.filter(s => s.recording_url && s.recording_url.trim() !== '');
        const semGravacao = sessoes.filter(s => isBefore(new Date(s.scheduled_at), hoje) && (!s.recording_url || s.recording_url.trim() === ''));

        return (
          <div className="space-y-8">
            {/* Grid de gravações */}
            {comGravacao.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Youtube className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhuma gravação vinculada ainda</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Adicione links do YouTube nas sessões passadas abaixo</p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">
                  {comGravacao.length} gravação{comGravacao.length !== 1 ? 'ões' : ''} disponível{comGravacao.length !== 1 ? 'is' : ''}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {comGravacao.map(s => {
                    const ytId = getYoutubeId(s.recording_url);
                    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                    return (
                      <div key={s.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden group">
                        {/* Thumbnail */}
                        <a href={s.recording_url} target="_blank" rel="noreferrer" className="block relative aspect-video bg-muted overflow-hidden">
                          {thumb ? (
                            <img src={thumb} alt={s.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlayCircle className="h-12 w-12 text-white drop-shadow-lg" />
                          </div>
                        </a>
                        {/* Info */}
                        <div className="px-4 py-3">
                          <p className="text-[13px] font-semibold text-foreground leading-tight line-clamp-1">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {format(new Date(s.scheduled_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        {/* Footer */}
                        <div className="flex items-center justify-end px-4 py-2.5 border-t border-border/40 bg-muted/[0.03]">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Editar link"
                              onClick={() => { setRecForm({ id: s.id, title: s.title, recording_url: s.recording_url }); setShowRecModal(true); }}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
                              title="Remover gravação"
                              onClick={() => removeRecordingUrl(s.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sessões sem gravação */}
            {semGravacao.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">
                  Sessões passadas sem gravação
                </p>
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-border/30">
                  {semGravacao.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded-lg bg-muted shrink-0">
                          <FileVideo className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground/60">
                            {format(new Date(s.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 text-[11px] font-medium border-border/60 gap-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-4"
                        onClick={() => { setRecForm({ id: s.id, title: s.title, recording_url: '' }); setShowRecModal(true); }}
                      >
                        <Youtube className="h-3 w-3" />
                        Adicionar gravação
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data e Hora</label>
                <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" type="datetime-local" value={formData.scheduled_at ? new Date(new Date(formData.scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setFormData({ ...formData, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Foco da Sessão</label>
                <Select value={formData.type || 'comercial'} onValueChange={v => setFormData({ ...formData, type: v })}>
                  <SelectTrigger className="h-10 rounded-lg border-border/60 focus:ring-1 focus:ring-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="demanda">Geração de Demanda</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* ── MODAL GRAVAÇÃO ───────────────────────────────────────────────────── */}
      <Dialog open={showRecModal} onOpenChange={setShowRecModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500" />
              {recForm.recording_url ? 'Editar gravação' : 'Adicionar gravação'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">{recForm.title}</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Link do YouTube
              </label>
              <Input
                className="h-10 rounded-lg border-border/60 text-sm"
                placeholder="https://www.youtube.com/watch?v=..."
                value={recForm.recording_url}
                onChange={e => setRecForm(f => ({ ...f, recording_url: e.target.value }))}
                autoFocus
              />
              {recForm.recording_url && getYoutubeId(recForm.recording_url) && (
                <div className="mt-2 rounded-lg overflow-hidden aspect-video bg-muted">
                  <img
                    src={`https://img.youtube.com/vi/${getYoutubeId(recForm.recording_url)}/mqdefault.jpg`}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowRecModal(false)} disabled={recSaving}>
              Cancelar
            </Button>
            <Button
              onClick={saveRecordingUrl}
              disabled={recSaving}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            >
              {recSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL RECORRÊNCIA ────────────────────────────────────────────────── */}
      <Dialog open={showRecRuleModal} onOpenChange={setShowRecRuleModal}>
        <DialogContent className="max-w-xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0"><DialogTitle>{recRuleForm.id ? 'Editar Recorrência' : 'Nova Sessão Recorrente'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</label>
              <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={recRuleForm.title || ''} onChange={e => setRecRuleForm({ ...recRuleForm, title: e.target.value })} placeholder="Ex: Sessão Tática Semanal" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dia da Semana</label>
                <Select value={String(recRuleForm.day_of_week ?? 1)} onValueChange={v => setRecRuleForm({ ...recRuleForm, day_of_week: Number(v) })}>
                  <SelectTrigger className="h-10 rounded-lg border-border/60 focus:ring-1 focus:ring-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Horário</label>
                <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" type="time" value={recRuleForm.time_of_day || '09:00'} onChange={e => setRecRuleForm({ ...recRuleForm, time_of_day: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gerar quantas semanas à frente</label>
              <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" type="number" min={1} max={52} value={recRuleForm.weeks_ahead ?? 12} onChange={e => setRecRuleForm({ ...recRuleForm, weeks_ahead: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Link da Reunião (Meet/Zoom)</label>
              <Input className="h-10 rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={recRuleForm.meet_link || ''} onChange={e => setRecRuleForm({ ...recRuleForm, meet_link: e.target.value })} placeholder="Link fixo usado toda semana" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</label>
              <Textarea className="rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-border/60" value={recRuleForm.description || ''} onChange={e => setRecRuleForm({ ...recRuleForm, description: e.target.value })} rows={3} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={recRuleForm.active !== false} onCheckedChange={c => setRecRuleForm({ ...recRuleForm, active: !!c })} />
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recorrência ativa</label>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowRecRuleModal(false)}>Cancelar</Button>
            <Button onClick={saveRecRule} disabled={recRuleSaving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              {recRuleSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DELETE RECORRÊNCIA ───────────────────────────────────────── */}
      <AlertDialog open={!!recRuleDeleteTarget} onOpenChange={open => !open && setRecRuleDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra <strong>"{recRuleDeleteTarget?.title}"</strong> deixará de gerar novas sessões. As sessões já criadas no calendário continuam existindo — remova-as manualmente na aba Sessões, se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRecRule} className="bg-red-600 hover:bg-red-700 text-white">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
