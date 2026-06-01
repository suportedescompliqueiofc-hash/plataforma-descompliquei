import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Video, PlayCircle, ExternalLink, Download, Clock, Zap, Target, ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { format, isPast, isFuture, addHours, differenceInMinutes, startOfWeek, addDays, isSameDay, subWeeks, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";

type Session = {
  id: string;
  type: string;
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
      // Usando uma tabela simulada (ou a real se criada) 
      const { data, error } = await supabase
        .from('platform_sessoes_taticas')
        .select('*')
        .eq('active', true)
        .order('scheduled_at', { ascending: true });
        
      if (!error && data) {
        setSessions(data);
      } else {
        // Fallback visual/mock no Frontend caso a tabela ainda esteja vazia
        console.warn('Usando dados mock de sessão', error);
        const mockData: Session[] = [
          {
            id: '1',
            type: 'Comercial',
            title: 'Quebra de Objeções Premium',
            description: 'Aprenda na prática como não dar desconto em Harmonização usando as técnicas de contorno.',
            scheduled_at: new Date(new Date().getTime() + 1000 * 60 * 60 * 2).toISOString(), // Daqui a 2h
            meet_link: 'https://meet.google.com/xyz',
          },
          {
            id: '2',
            type: 'Demanda',
            title: 'Configurando Campanhas de Remarketing',
            description: 'Passo a passo no Gerenciador de Anúncios para reativar base.',
            scheduled_at: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(), // Daqui a 7 dias
            meet_link: 'https://meet.google.com/abc',
          },
          {
            id: '3',
            type: 'Comercial',
            title: 'Script Perfeito de Follow-up',
            description: 'Revisão do roteiro Tático D+1 e D+3 ao vivo e análise de cases.',
            scheduled_at: new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 dias atrás
            recording_url: 'https://youtube.com',
          }
        ];
        if (!data || data.length === 0) setSessions(mockData);
      }
      setLoading(false);
    }
    loadSessions();
  }, []);

  const now = new Date();
  const futureSessions = sessions.filter(s => isFuture(new Date(s.scheduled_at))).sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const pastSessions = sessions.filter(s => isPast(new Date(s.scheduled_at)) && s.recording_url).sort((a,b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  
  const nextSession = futureSessions[0];

  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

  const generateICS = (session: Session) => {
    const startDate = new Date(session.scheduled_at);
    const endDate = addHours(startDate, 1);

    const pad = (n: number) => n < 10 ? '0' + n : n;
    const formatICSDate = (date: Date) => {
      return date.getUTCFullYear() +
             pad(date.getUTCMonth() + 1) +
             pad(date.getUTCDate()) + 'T' +
             pad(date.getUTCHours()) +
             pad(date.getUTCMinutes()) +
             pad(date.getUTCSeconds()) + 'Z';
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Descompliquei//Sessoes Taticas//PT
BEGIN:VEVENT
UID:${session.id}@descompliquei.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:Sessão Tática - ${session.type}: ${session.title}
DESCRIPTION:${session.description}\\n\\nLink para participar: ${session.meet_link || 'Link será disponibilizado na hora'}
URL:${session.meet_link || ''}
LOCATION:Online
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:A Sessão Tática vai começar em 15min!
TRIGGER:-PT15M
END:VALARM
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sessao_Tatica_${session.title.replace(/\\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openGoogleCalendar = (session: Session) => {
    const startDate = new Date(session.scheduled_at);
    const endDate = addHours(startDate, 1);
    
    // Format: YYYYMMDDTHHmmssZ
    const formatGCalDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Sessão Tática - ${session.type}: ${session.title}`,
      dates: `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`,
      details: `${session.description || ''}\\n\\nLink para participar: ${session.meet_link || 'Link será disponibilizado na hora'}`,
      location: session.meet_link ? session.meet_link : 'Online'
    });
    
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
  };

  const getTypeStyle = (type: string) => {
    if (type.toLowerCase() === 'comercial') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400';
    if (type.toLowerCase() === 'demanda') return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400';
    return 'bg-muted text-muted-foreground border-border';
  };

  const getTypeIcon = (type: string) => {
    if (type.toLowerCase() === 'comercial') return <Target className="w-3.5 h-3.5 mr-1.5" />;
    if (type.toLowerCase() === 'demanda') return <Zap className="w-3.5 h-3.5 mr-1.5" />;
    return <Video className="w-3.5 h-3.5 mr-1.5" />;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12">
      {/* HEADER */}
      <div className="space-y-6 border-b border-border pb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground font-display">Sessões Táticas</h1>
          <p className="text-muted-foreground text-[15px] mt-1">Mentorias ao vivo toda semana com o time da Descompliquei.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 px-3 py-0.5 text-xs font-medium">
            <Target className="w-3 h-3 mr-1.5" /> Comercial
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 px-3 py-0.5 text-xs font-medium">
            <Zap className="w-3 h-3 mr-1.5" /> Demanda
          </Badge>
        </div>
      </div>

      {/* PRÓXIMA SESSÃO (DESTAQUE) */}
      {nextSession && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground font-display">Próxima Sessão</h2>
          <div className="rounded-xl border border-border shadow-card bg-card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#E85D24] rounded-r-full" />
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={getTypeStyle(nextSession.type) + " text-xs font-medium"}>
                    {getTypeIcon(nextSession.type)} {nextSession.type}
                  </Badge>
                  <span className="flex items-center text-xs font-medium text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    {format(new Date(nextSession.scheduled_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground leading-tight mb-1.5 font-display">{nextSession.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{nextSession.description}</p>
                </div>
              </div>
              <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto">
                <Button
                  size="lg"
                  onClick={() => window.open(nextSession.meet_link, '_blank')}
                  className="bg-[#E85D24] hover:bg-[#D04E1A] text-white min-w-[200px] font-medium text-sm"
                >
                  <Video className="w-4 h-4 mr-2" /> Entrar na Sessão
                </Button>
                <Button
                  variant="outline"
                  className="border-border text-foreground hover:bg-muted text-sm font-medium"
                  onClick={() => openGoogleCalendar(nextSession)}
                >
                  <CalendarPlus className="w-4 h-4 mr-2" /> Google Calendar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALENDÁRIO & GRAVAÇÕES (LAYOUT COM GRID) */}
      <div className="space-y-12">
        
        {/* CALENDÁRIO SEMANAL */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-4">
            <h2 className="text-base font-semibold text-foreground font-display">
              Calendário da Semana
            </h2>
            <div className="flex items-center gap-4 bg-muted/50 p-1 rounded-lg">
              <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-8 w-8 hover:bg-background shadow-sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-bold text-foreground capitalize min-w-[120px] text-center text-sm">
                {format(currentWeekStart, "MMM 'de' yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" onClick={handleNextWeek} className="h-8 w-8 hover:bg-background shadow-sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day, idx) => {
              const daySessions = sessions.filter(s => isSameDay(new Date(s.scheduled_at), day));
              const isToday = isSameDay(day, new Date());
              
              return (
                <div key={idx} className={`flex flex-col min-h-[160px] rounded-xl border ${isToday ? 'border-[#E85D24] bg-[#E85D24]/5 ring-1 ring-[#E85D24]/20' : 'border-border bg-card'} overflow-hidden shadow-sm transition-all`}>
                  <div className={`text-center py-2.5 border-b ${isToday ? 'bg-[#E85D24]/10 border-[#E85D24]/20' : 'border-border bg-muted/30'}`}>
                    <div className={`text-[10px] uppercase font-bold tracking-wider ${isToday ? 'text-[#E85D24]' : 'text-muted-foreground'}`}>
                      {format(day, 'EEEE', { locale: ptBR }).split('-')[0]}
                    </div>
                    <div className={`text-lg font-bold mt-0.5 font-display ${isToday ? 'text-[#E85D24]' : 'text-foreground'}`}>
                      {format(day, 'dd')}
                    </div>
                  </div>
                  <div className="p-2 flex-1 flex flex-col gap-2 relative">
                    {daySessions.length > 0 ? (
                      daySessions.map(session => (
                        <div 
                           key={session.id} 
                           title={session.description || session.title}
                           onClick={() => setSelectedSession(session)} 
                           className="group cursor-pointer rounded-md p-2 text-xs border border-border/60 bg-background hover:border-border/80 hover:shadow-sm transition-all relative overflow-hidden"
                        >
                           <div className={`absolute top-0 left-0 w-1 h-full ${session.type.toLowerCase() === 'comercial' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                           <div className="pl-1.5 flex flex-col justify-between h-full gap-1.5">
                             <div className="font-semibold leading-tight line-clamp-2 text-foreground group-hover:text-[#E85D24] transition-colors">
                               {session.title}
                             </div>
                             <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/50">
                               <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                 <Clock className="w-3 h-3" /> {format(new Date(session.scheduled_at), "HH:mm")}
                               </div>
                               <Badge variant="outline" className={`text-[8px] px-1 py-0 h-4 border-transparent ${session.type.toLowerCase() === 'comercial' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'}`}>
                                 {session.type.substring(0,3).toUpperCase()}
                               </Badge>
                             </div>
                           </div>
                        </div>
                      ))
                    ) : (
                       <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                         <div className="w-1 h-1 rounded-full bg-muted-foreground/30 mb-1" />
                         <div className="w-1 h-1 rounded-full bg-muted-foreground/30 mb-1" />
                         <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                       </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* GRAVAÇÕES DISPONÍVEIS */}
        <div className="space-y-6 pt-4 border-t border-border">
          <h2 className="text-base font-semibold text-foreground font-display">
            Sessões Gravadas
          </h2>
          {pastSessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastSessions.map(session => (
                <div key={session.id} className="rounded-xl border border-border bg-card shadow-card hover:bg-muted/30 transition-all group cursor-pointer p-4" onClick={() => window.open(session.recording_url, '_blank')}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <PlayCircle className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {format(new Date(session.scheduled_at), "dd MMM yy", { locale: ptBR })}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">•</span>
                        <span className="text-[10px] text-muted-foreground font-medium">{session.type}</span>
                      </div>
                      <h4 className="font-semibold text-foreground text-sm truncate">
                        {session.title}
                      </h4>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 bg-card rounded-xl border border-dashed border-border text-center space-y-4 shadow-card">
              <div className="w-11 h-11 bg-muted rounded-xl flex items-center justify-center">
                <PlayCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="text-base font-semibold text-foreground font-display">Sem gravações</h3>
                <p className="text-[13px] text-muted-foreground">As gravações das próximas sessões aparecerão aqui assim que forem disponibilizadas.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL DETALHES DA SESSÃO */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-md">
          {selectedSession && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={getTypeStyle(selectedSession.type) + " font-bold"}>
                    {getTypeIcon(selectedSession.type)} Tática de {selectedSession.type}
                  </Badge>
                  {isPast(new Date(selectedSession.scheduled_at)) && (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">Realizada</Badge>
                  )}
                </div>
                <DialogTitle className="text-lg font-bold leading-tight font-display">{selectedSession.title}</DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground mt-1">
                  {selectedSession.description}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <div className="flex items-center text-sm font-medium text-foreground bg-muted/30 p-3 rounded-lg border border-border">
                  <Clock className="w-4 h-4 mr-3 text-muted-foreground" />
                  {format(new Date(selectedSession.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </div>
                
                {selectedSession.meet_link && !isPast(new Date(selectedSession.scheduled_at)) && (
                   <div className="flex flex-col gap-2">
                     <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Link de Acesso</p>
                     <div className="flex items-center gap-2">
                       <code className="flex-1 bg-muted px-3 py-2 rounded text-xs truncate border border-border">
                         {selectedSession.meet_link}
                       </code>
                     </div>
                   </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                {!isPast(new Date(selectedSession.scheduled_at)) ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => openGoogleCalendar(selectedSession)}
                      className="w-full sm:w-auto"
                    >
                      <CalendarPlus className="w-4 h-4 mr-2" /> Salvar no Calendar
                    </Button>
                    <Button 
                      onClick={() => window.open(selectedSession.meet_link, '_blank')}
                      className="w-full sm:w-auto bg-[#E85D24] hover:bg-[#D04E1A] text-white font-semibold"
                    >
                      <Video className="w-4 h-4 mr-2" /> Entrar na Sessão
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedSession(null)}
                      className="w-full sm:w-auto"
                    >
                      Fechar
                    </Button>
                    {selectedSession.recording_url && (
                      <Button 
                        onClick={() => window.open(selectedSession.recording_url, '_blank')}
                        className="w-full sm:w-auto bg-[#E85D24] hover:bg-[#D04E1A] text-white font-semibold"
                      >
                        <PlayCircle className="w-4 h-4 mr-2" /> Assistir Gravação
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
