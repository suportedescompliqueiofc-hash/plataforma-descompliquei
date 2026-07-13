import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon, Video, PlayCircle, Clock, Zap, Target,
  ChevronLeft, ChevronRight, CalendarPlus, Tv2,
} from "lucide-react";
import { format, isPast, isFuture, addHours, isSameDay, subWeeks, addWeeks, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  type: string | null;
  title: string;
  description: string;
  scheduled_at: string;
  meet_link?: string;
  recording_url?: string;
};

export default function SessoesTaticas() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    async function loadSessions() {
      const { data, error } = await supabase
        .from('platform_sessoes_taticas')
        .select('*')
        .eq('active', true)
        .order('scheduled_at', { ascending: true });

      if (!error && data) {
        setSessions(data.filter(s => s.scheduled_at && !isNaN(new Date(s.scheduled_at).getTime())));
      }
      setLoading(false);
    }
    loadSessions();
  }, []);

  const futureSessions = sessions
    .filter(s => isFuture(new Date(s.scheduled_at)))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const pastSessions = sessions
    .filter(s => isPast(new Date(s.scheduled_at)) && s.recording_url)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  const nextSession = futureSessions[0];

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

  const openGoogleCalendar = (session: Session) => {
    const startDate = new Date(session.scheduled_at);
    const endDate = addHours(startDate, 1);
    const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Sessão Tática — ${session.type}: ${session.title}`,
      dates: `${fmt(startDate)}/${fmt(endDate)}`,
      details: `${session.description}\n\nLink: ${session.meet_link || 'disponibilizado na hora'}`,
      location: session.meet_link || 'Online',
    });
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
  };

  const typeColor = (type: string | null | undefined) =>
    (type || '').toLowerCase() === 'comercial' ? 'bg-emerald-500' : 'bg-blue-500';

  const typePill = (type: string | null | undefined) =>
    (type || '').toLowerCase() === 'comercial'
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      : 'bg-blue-500/10 text-blue-600 border-blue-500/20';

  const typeLabel = (type: string | null | undefined) =>
    (type || '').toLowerCase() === 'comercial' ? 'Comercial' : 'Demanda';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* ─── Hero ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] px-8 py-10 sm:px-12 sm:py-12">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full opacity-55 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #ea580c, transparent 65%)' }} />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-35 blur-[80px]"
          style={{ background: 'radial-gradient(circle, #d97706, transparent 65%)' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08]">
                <Tv2 className="h-5 w-5 text-white/80" />
              </div>
              <div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-white/20 to-transparent" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display leading-[1.15]">
                Sessões Táticas
              </h1>
              <p className="text-[13px] text-white/40 mt-2 max-w-sm leading-relaxed">
                Mentorias ao vivo toda semana com o time da Descompliquei.
              </p>
            </div>
          </div>

          {nextSession && (
            <div className="shrink-0 flex items-center gap-3 bg-white/[0.04] backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/[0.06]">
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', typeColor(nextSession.type))}>
                <Video className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Próxima sessão</p>
                <p className="text-[13px] font-semibold text-white leading-snug mt-0.5 max-w-[180px] line-clamp-1">{nextSession.title}</p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {format(new Date(nextSession.scheduled_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Próxima Sessão (destaque) ─── */}
      {nextSession && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">PRÓXIMA SESSÃO</p>
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border', typePill(nextSession.type))}>
                  {(nextSession.type || '').toLowerCase() === 'comercial'
                    ? <Target className="h-3 w-3" />
                    : <Zap className="h-3 w-3" />
                  }
                  {typeLabel(nextSession.type)}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(nextSession.scheduled_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <h3 className="text-lg font-bold text-foreground font-display">{nextSession.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{nextSession.description}</p>
            </div>

            <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
              <Button
                onClick={() => nextSession.meet_link && window.open(nextSession.meet_link, '_blank')}
                className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
              >
                <Video className="h-3.5 w-3.5" /> Entrar na Sessão
              </Button>
              <Button
                variant="outline"
                onClick={() => openGoogleCalendar(nextSession)}
                className="h-9 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Google Calendar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Calendário Semanal ─── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">CALENDÁRIO DA SEMANA</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
            <button
              onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px] font-semibold text-foreground capitalize px-2 min-w-[110px] text-center">
              {format(currentWeekStart, "MMM 'de' yyyy", { locale: ptBR })}
            </span>
            <button
              onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-7 gap-2">
          {weekDays.map((day, idx) => {
            const daySessions = sessions.filter(s => isSameDay(new Date(s.scheduled_at), day));
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={idx}
                className={cn(
                  'flex flex-col rounded-xl border overflow-hidden min-h-[130px] transition-all',
                  isToday
                    ? 'border-foreground/30 bg-foreground/[0.03]'
                    : 'border-border/50 bg-background/40'
                )}
              >
                <div className={cn(
                  'text-center py-2 border-b',
                  isToday ? 'border-foreground/10 bg-foreground/[0.04]' : 'border-border/40'
                )}>
                  <div className={cn(
                    'text-[9px] uppercase font-bold tracking-wider',
                    isToday ? 'text-foreground/60' : 'text-muted-foreground/50'
                  )}>
                    {format(day, 'EEE', { locale: ptBR }).replace('.', '')}
                  </div>
                  <div className={cn(
                    'text-base font-bold font-display mt-0.5',
                    isToday ? 'text-foreground' : 'text-foreground/70'
                  )}>
                    {format(day, 'dd')}
                  </div>
                </div>

                <div className="p-1.5 flex-1 flex flex-col gap-1.5">
                  {daySessions.length > 0 ? daySessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className="group w-full text-left rounded-lg p-1.5 text-[10px] border border-border/40 bg-card hover:border-border hover:shadow-sm transition-all overflow-hidden relative"
                    >
                      <div className={cn('absolute top-0 left-0 w-[3px] h-full', typeColor(session.type))} />
                      <div className="pl-2.5">
                        <div className="font-semibold leading-snug text-foreground line-clamp-2">{session.title}</div>
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground/60">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(session.scheduled_at), 'HH:mm')}
                        </div>
                      </div>
                    </button>
                  )) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex flex-col gap-0.5 items-center opacity-20">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Sessões Gravadas ─── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">SESSÕES GRAVADAS</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Assista quando quiser</p>
            </div>
          </div>
        </div>

        {pastSessions.length > 0 ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pastSessions.map(session => (
              <button
                key={session.id}
                onClick={() => window.open(session.recording_url, '_blank')}
                className="group w-full text-left overflow-hidden rounded-xl border border-border/60 bg-background hover:border-border hover:shadow-md transition-all"
              >
                <div className={cn('h-[3px] w-full', typeColor(session.type))} />
                <div className="p-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted group-hover:bg-muted/70 transition-colors shrink-0">
                    <PlayCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn('text-[9px] font-bold uppercase tracking-wider', (session.type || '').toLowerCase() === 'comercial' ? 'text-emerald-500' : 'text-blue-500')}>
                        {typeLabel(session.type)}
                      </span>
                      <span className="text-muted-foreground/30 text-[9px]">·</span>
                      <span className="text-[10px] text-muted-foreground/50 font-mono">
                        {format(new Date(session.scheduled_at), 'dd MMM yy', { locale: ptBR })}
                      </span>
                    </div>
                    <h4 className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">{session.title}</h4>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center p-6">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <PlayCircle className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma gravação disponível</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">As gravações aparecerão aqui após cada sessão.</p>
          </div>
        )}
      </div>

      {/* ─── Modal detalhes ─── */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-md">
          {selectedSession && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border', typePill(selectedSession.type))}>
                    {(selectedSession.type || '').toLowerCase() === 'comercial' ? <Target className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                    {typeLabel(selectedSession.type)}
                  </span>
                  {isPast(new Date(selectedSession.scheduled_at)) && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border border-border/60">
                      Realizada
                    </span>
                  )}
                </div>
                <DialogTitle className="text-base font-bold leading-tight font-display">{selectedSession.title}</DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground mt-1">
                  {selectedSession.description}
                </DialogDescription>
              </DialogHeader>

              <div className="py-3 space-y-3">
                <div className="flex items-center gap-3 text-[13px] font-medium text-foreground bg-muted/30 px-4 py-3 rounded-xl border border-border/60">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  {format(new Date(selectedSession.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </div>
                {selectedSession.meet_link && !isPast(new Date(selectedSession.scheduled_at)) && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Link de acesso</p>
                    <code className="block bg-muted px-3 py-2 rounded-lg text-[11px] truncate border border-border/60">
                      {selectedSession.meet_link}
                    </code>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {!isPast(new Date(selectedSession.scheduled_at)) ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openGoogleCalendar(selectedSession)}
                      className="h-9 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3 w-full sm:w-auto"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Salvar no Calendar
                    </Button>
                    <Button
                      onClick={() => selectedSession.meet_link && window.open(selectedSession.meet_link, '_blank')}
                      className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 w-full sm:w-auto"
                    >
                      <Video className="h-3.5 w-3.5" /> Entrar na Sessão
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedSession(null)}
                      className="h-9 rounded-lg text-[11px] font-medium border-border/60 px-4 w-full sm:w-auto"
                    >
                      Fechar
                    </Button>
                    {selectedSession.recording_url && (
                      <Button
                        onClick={() => window.open(selectedSession.recording_url, '_blank')}
                        className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 w-full sm:w-auto"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Assistir Gravação
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
