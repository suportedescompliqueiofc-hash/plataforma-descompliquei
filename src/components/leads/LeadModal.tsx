import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useLeads } from "@/hooks/useLeads";
import MaskedInput, { PhoneInput, CpfInput } from "@/components/MaskedInput";
import { User, Mail, Phone, DollarSign, MapPin, Tag, Clock, MessageSquare, Pencil, MessageCircle, Briefcase, Globe, ImageOff, Megaphone, Calendar as CalendarIcon, Hash, UserCheck, ChevronRight, Plus, ArrowRight, Sparkles, Target, Activity, Zap, Copy, ExternalLink, CalendarDays, Shield, UserCog } from "lucide-react";
import { parse, format, differenceInYears, isValid, startOfDay, parseISO, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CreatableSelect } from "@/components/ui/CreatableSelect";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { ANNA_CLARA_ORG_ID } from "@/lib/constants";
import { VendaModal } from "@/components/vendas/VendaModal";
import AgendamentoLeadModal from "@/components/agendamentos/AgendamentoLeadModal";
import { FormattedText } from "@/components/FormattedText";
import { TagManager } from "@/components/tags/TagManager";
import LeadNotas from "@/components/leads/LeadNotas";
import { cn } from "@/lib/utils";
import { useTeamMembersForSelect, MemberSelectOption } from "@/hooks/useTeamMembersForSelect";
import { useJornadaPaciente, EventoTipo } from "@/hooks/useJornadaPaciente";
import { useLeadFotos, LeadFoto } from "@/hooks/useLeadFotos";
import { Loader2, History as HistoryIcon, Syringe, ImagePlus, Trash2, Camera, BellRing, X, ChevronDown } from "lucide-react";

// --- Funções Auxiliares (mantidas) ---
const calculateAge = (dobString: string | undefined): number | '' => {
  if (!dobString || dobString.length !== 10) return '';
  const dob = parse(dobString, 'dd/MM/yyyy', new Date());
  if (!isValid(dob)) return '';
  const age = differenceInYears(new Date(), dob);
  return age >= 0 ? age : '';
};

const toSupabaseDate = (displayDate: string): string | undefined => {
  if (!displayDate || displayDate.length !== 10) return undefined;
  const date = parse(displayDate, 'dd/MM/yyyy', new Date());
  return isValid(date) ? format(date, 'yyyy-MM-dd') : undefined;
};

const toDisplayDate = (supabaseDate: string | undefined): string => {
  if (!supabaseDate) return '';
  try {
    const date = parse(supabaseDate, 'yyyy-MM-dd', new Date());
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  } catch {
    return '';
  }
};

const toDisplayDateFromTimestamp = (supabaseTimestamp: string | undefined): string => {
  if (!supabaseTimestamp) return '';
  try {
    const date = parseISO(supabaseTimestamp);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  } catch {
    return '';
  }
};

const toSupabaseTimestamp = (displayDate: string): string | undefined => {
  if (!displayDate || displayDate.length !== 10) return undefined;
  const date = parse(displayDate, 'dd/MM/yyyy', new Date());
  return isValid(date) ? startOfDay(date).toISOString() : undefined;
};

const cleanPhoneNumber = (phone: string): string => phone.replace(/\D/g, '');

const initialFormData = {
  nome: "", telefone: "", resumo: "",
  origem: "organico", // Default agora é organico
  fonte: "",          // Novo campo para o detalhe (antiga origem)
  status: "Ativo", email: "", cpf: "", idade: "",
  genero: "", endereco: "",
  procedimento_interesse: "",
  criativo_id: "none",
  data_nascimento_display: "",
  criado_em_display: "",
  is_qualified: false,
  responsavel_id: "" as string,
};

// --- Componentes de UI ---

const formatPhoneDisplay = (phone: string) => {
  if (!phone) return '-';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) cleaned = cleaned.slice(2);
  if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  if (cleaned.length === 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return phone;
};

const InfoItem = ({ icon: Icon, label, value, className }: { icon: any, label: string, value: string | React.ReactNode, className?: string }) => (
  <div className={cn("flex items-start gap-3 py-2.5", className)}>
    <div className="p-1.5 rounded-lg bg-muted/50 shrink-0 mt-0.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
    </div>
    <div className="min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 block">{label}</span>
      <div className="text-[13px] text-foreground mt-0.5">{value}</div>
    </div>
  </div>
);

// ── Timeline compacta (aba Histórico) — reaproveita useJornadaPaciente ──
const HISTORICO_STYLE: Record<EventoTipo, { icon: any; dot: string }> = {
  entrada:     { icon: UserCheck,     dot: 'bg-emerald-500' },
  mensagem:    { icon: MessageCircle, dot: 'bg-blue-500' },
  agendamento: { icon: CalendarIcon,  dot: 'bg-indigo-500' },
  venda:       { icon: DollarSign,    dot: 'bg-violet-500' },
  scoring:     { icon: Target,        dot: 'bg-amber-500' },
  nota:        { icon: MessageSquare, dot: 'bg-slate-400' },
  tag:         { icon: Tag,           dot: 'bg-slate-400' },
  cadencia:    { icon: Zap,           dot: 'bg-cyan-500' },
  responsavel: { icon: UserCog,       dot: 'bg-teal-500' },
  ia:          { icon: Sparkles,      dot: 'bg-amber-500' },
  confirmacao: { icon: BellRing,      dot: 'bg-sky-500' },
};

const HistoricoTimeline = ({ leadId }: { leadId: string }) => {
  const { data, isLoading } = useJornadaPaciente(leadId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const eventos = data?.eventos || []; // cronológico — mais antigo no topo, mais recente embaixo

  if (eventos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <HistoryIcon className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nenhum evento ainda</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">O histórico do lead aparecerá aqui</p>
      </div>
    );
  }

  // Agrupa eventos por dia (fuso local — nunca .slice(0,10), que usaria UTC)
  const grupos: { diaKey: string; data: Date; itens: typeof eventos }[] = [];
  for (const e of eventos) {
    const d = new Date(e.data);
    const diaKey = format(d, 'yyyy-MM-dd');
    const grupoAtual = grupos[grupos.length - 1];
    if (grupoAtual && grupoAtual.diaKey === diaKey) {
      grupoAtual.itens.push(e);
    } else {
      grupos.push({ diaKey, data: d, itens: [e] });
    }
  }

  const diaLabel = (d: Date): string => {
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-5">
      {grupos.map((grupo) => (
        <div key={grupo.diaKey} className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2.5 mb-3.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{diaLabel(grupo.data)}</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          {grupo.itens.map((e, i) => {
            const style = HISTORICO_STYLE[e.tipo] ?? HISTORICO_STYLE.nota;
            const Icon = style.icon;
            const isLast = i === grupo.itens.length - 1;
            let quando = '';
            try {
              quando = format(new Date(e.data), 'HH:mm', { locale: ptBR });
            } catch { /* data inválida */ }
            return (
              <div key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!isLast && <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/60" />}
                <div className="relative z-10 h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 ring-4 ring-card">
                  <span className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-card", style.dot)} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-foreground leading-snug">{e.titulo}</p>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 mt-0.5">{quando}</span>
                  </div>
                  {e.descricao && (
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed break-words">{e.descricao}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ── Aba de IA — resumo da conversa, tempo atendido pela IA e análise de follow-up ──
const formatMinutosLabel = (min: number): string => {
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const IaTab = ({ lead }: { lead: any }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['lead-ia-tab', lead.id],
    queryFn: async () => {
      const [msgsRes, fuRes, handoffRes] = await Promise.all([
        supabase
          .from('mensagens')
          .select('remetente, direcao, criado_em')
          .eq('lead_id', lead.id)
          .eq('automatica', false) // ignora confirmação/lembrete de agendamento
          .order('criado_em', { ascending: true }),
        supabase
          .from('leads')
          .select('resumo, objetivo, objecao, followup_gap, followup_gap_motivo, followup_tentativas, followup_ultima_tentativa, ultimo_contato')
          .eq('id', lead.id)
          .maybeSingle(),
        // Handoff REAL: a IA transferiu e disparou a notificação (etapa 'notificacao_enviada')
        supabase
          .from('ai_execution_logs')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('etapa', 'notificacao_enviada')
          .limit(1),
      ]);
      return {
        msgs: (msgsRes.data || []) as any[],
        fu: (fuRes.data || {}) as any,
        hasHandoff: (handoffRes.data?.length ?? 0) > 0,
      };
    },
    enabled: !!lead.id,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const msgs = data?.msgs || [];
  const fu = data?.fu || {};
  const resumo = fu.resumo || lead.resumo;

  const botMsgs = msgs.filter((m) => m.remetente === 'bot');
  const respondeuIA = botMsgs.length > 0;

  let tempoIAmin: number | null = null;
  let humanoAssumiu = false;
  if (respondeuIA) {
    const idxFirstBot = msgs.findIndex((m) => m.remetente === 'bot');
    const firstBotT = new Date(msgs[idxFirstBot].criado_em).getTime();
    const primeiraHumana = msgs.find((m, i) => i > idxFirstBot && m.direcao === 'saida' && m.remetente !== 'bot' && m.remetente !== 'ia');
    humanoAssumiu = !!primeiraHumana;
    const fimT = primeiraHumana
      ? new Date(primeiraHumana.criado_em).getTime()
      : new Date(botMsgs[botMsgs.length - 1].criado_em).getTime();
    tempoIAmin = Math.max(0, Math.round((fimT - firstBotT) / 60000));
  }

  const hasHandoff = data?.hasHandoff ?? false;
  // 3 estados distintos: transferência real da IA (handoff) × humano que entrou no meio × ainda na IA
  const statusAtendimento = hasHandoff
    ? { label: 'Transferido pela IA para atendente humano', cls: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-900' }
    : humanoAssumiu
      ? { label: 'Um humano entrou na conversa (sem transferência da IA)', cls: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900' }
      : { label: 'Em atendimento pela IA', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900' };

  const horasSemContato = fu.ultimo_contato
    ? Math.floor((Date.now() - new Date(fu.ultimo_contato).getTime()) / 3600000)
    : null;
  const temFollowup = !!(fu.followup_gap_motivo || fu.followup_gap === 'PRECISA_FOLLOW' || (fu.followup_tentativas ?? 0) > 0);

  if (!resumo && !respondeuIA && !temFollowup && !fu.objetivo && !fu.objecao) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <Sparkles className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade de IA ainda</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">Resumo e análises aparecem quando a IA atua neste lead</p>
      </div>
    );
  }

  const gapLabels: Record<string, { label: string; cls: string }> = {
    PRECISA_FOLLOW: { label: 'Precisa de follow-up', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    PENDENTE:       { label: 'Em análise',           cls: 'text-muted-foreground bg-muted border-border/60' },
    NAO_PRECISA:    { label: 'Sem necessidade',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  };
  const labelCls = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5";
  const valueCls = "text-[13px] font-semibold text-foreground";

  return (
    <div className="space-y-4">

      {/* Atendimento pela IA */}
      {respondeuIA && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Atendimento pela IA</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <span className={labelCls}>Tempo atendido pela IA</span>
              <span className={cn(valueCls, "tabular-nums")}>{tempoIAmin != null ? formatMinutosLabel(tempoIAmin) : '—'}</span>
            </div>
            <div>
              <span className={labelCls}>Respostas da IA</span>
              <span className={cn(valueCls, "tabular-nums")}>{botMsgs.length}</span>
            </div>
            <div className="col-span-2">
              <span className={labelCls}>Status</span>
              <span className={cn("inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-md border", statusAtendimento.cls)}>
                {statusAtendimento.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Resumo da conversa (IA) */}
      {resumo && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Resumo da conversa (IA)</span>
          </div>
          <div className="p-4 text-[13px] text-foreground/90 leading-relaxed space-y-2">
            <FormattedText content={resumo} />
          </div>
        </div>
      )}

      {/* Leitura do lead — objetivo e objeção (extraídos pelo Athos Escriba) */}
      {(fu.objetivo || fu.objecao) && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Leitura do lead</span>
          </div>
          <div className="p-4 space-y-3">
            {fu.objetivo && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Objetivo</span>
                <span className="text-[13px] text-foreground/90 leading-relaxed">{fu.objetivo}</span>
              </div>
            )}
            {fu.objecao && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Objeção</span>
                <span className="text-[13px] text-foreground/90 leading-relaxed">{fu.objecao}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Análise de Follow-Up (Athos) */}
      {temFollowup && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Análise de Follow-Up</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {fu.followup_gap && gapLabels[fu.followup_gap] && (
                <span className={cn("inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border", gapLabels[fu.followup_gap].cls)}>
                  {gapLabels[fu.followup_gap].label}
                </span>
              )}
              {horasSemContato != null && (
                <span className="text-[11px] text-muted-foreground">Sem contato há <span className="font-semibold text-foreground tabular-nums">{horasSemContato}h</span></span>
              )}
            </div>
            {fu.followup_gap_motivo && (
              <p className="text-[13px] text-foreground/80 leading-relaxed break-words">{fu.followup_gap_motivo}</p>
            )}
            {((fu.followup_tentativas ?? 0) > 0 || fu.followup_ultima_tentativa) && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 border-t border-border/40">
                {(fu.followup_tentativas ?? 0) > 0 && (
                  <span className="text-[11px] text-muted-foreground pt-2">Tentativas: <span className="font-semibold text-foreground tabular-nums">{fu.followup_tentativas}</span></span>
                )}
                {fu.followup_ultima_tentativa && (
                  <span className="text-[11px] text-muted-foreground pt-2">Última: <span className="font-semibold text-foreground">{formatDistanceToNow(new Date(fu.followup_ultima_tentativa), { addSuffix: true, locale: ptBR })}</span></span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Slot individual de upload (antes ou depois) com pré-visualização ──
const FotoSlot = ({
  label, file, onChange,
}: {
  label: "Antes" | "Depois"; file: File | null; onChange: (f: File | null) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="space-y-1.5">
      <span
        className={cn(
          "inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border",
          label === "Antes" ? "bg-slate-50 text-slate-700 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200",
        )}
      >
        {label}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="group relative rounded-lg overflow-hidden border border-border/50 bg-muted/20 aspect-square">
          <img src={preview} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            title="Remover"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-square flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 hover:bg-muted/30 transition-colors"
        >
          <Camera className="h-5 w-5 text-muted-foreground/50" />
          <span className="text-[11px] text-muted-foreground">Selecionar foto</span>
        </button>
      )}
    </div>
  );
};

// ── Miniatura de uma foto (antes ou depois) ──
const FotoThumb = ({ foto, onRemove, onOpenImage }: { foto: LeadFoto; onRemove: (f: LeadFoto) => void; onOpenImage: (url: string) => void }) => (
  <div className="group relative rounded-lg overflow-hidden border border-border/50 bg-muted/20 aspect-square">
    {foto.signedUrl ? (
      <button
        type="button"
        onClick={() => onOpenImage(foto.signedUrl!)}
        className="block h-full w-full cursor-zoom-in"
      >
        <img src={foto.signedUrl} className="h-full w-full object-cover" />
      </button>
    ) : (
      <div className="h-full w-full flex items-center justify-center">
        <ImageOff className="h-5 w-5 text-muted-foreground/40" />
      </div>
    )}
    <span
      className={cn(
        "absolute top-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border pointer-events-none",
        foto.tipo === "antes" ? "bg-slate-50 text-slate-700 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200",
      )}
    >
      {foto.tipo}
    </span>
    <button
      onClick={() => onRemove(foto)}
      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
      title="Remover foto"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  </div>
);

// ── Bloco de uma sessão (par antes/depois de uma data) — colapsável, escondido por padrão ──
const FotoBlocoAccordion = ({
  grupo, data, fotos, onRemove, onOpenImage,
}: {
  grupo: string; data: string; fotos: LeadFoto[]; onRemove: (f: LeadFoto) => void; onOpenImage: (url: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const antes = fotos.filter((f) => f.tipo === "antes");
  const depois = fotos.filter((f) => f.tipo === "depois");

  return (
    <div>
      <div className="w-full flex items-center justify-between px-2 hover:bg-muted/20 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between gap-2 px-2 py-3 text-left"
        >
          <span className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
            {grupo}
            <span className="text-muted-foreground/50">—</span>
            <span className="tabular-nums text-muted-foreground">{format(parseISO(data), "dd/MM/yyyy")}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{fotos.length} foto{fotos.length !== 1 ? "s" : ""}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => fotos.forEach((f) => onRemove(f))}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
          title="Excluir este antes/depois"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="p-4 flex justify-center">
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {antes.map((f) => <FotoThumb key={f.id} foto={f} onRemove={onRemove} onOpenImage={onOpenImage} />)}
            {depois.map((f) => <FotoThumb key={f.id} foto={f} onRemove={onRemove} onOpenImage={onOpenImage} />)}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Card de um grupo (procedimento) — blocos por sessão (data), cada um colapsável ──
const FotoGrupoCard = ({
  grupo, items, onRemove, onOpenImage,
}: {
  grupo: string; items: LeadFoto[]; onRemove: (f: LeadFoto) => void; onOpenImage: (url: string) => void;
}) => {
  const blocos = new Map<string, LeadFoto[]>();
  for (const f of items) {
    const k = (f.data_procedimento || f.criado_em).slice(0, 10);
    if (!blocos.has(k)) blocos.set(k, []);
    blocos.get(k)!.push(f);
  }
  const blocosOrdenados = [...blocos.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
        <Syringe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{grupo}</span>
      </div>
      <div className="divide-y divide-border/40">
        {blocosOrdenados.map(([data, fotos]) => (
          <FotoBlocoAccordion key={data} grupo={grupo} data={data} fotos={fotos} onRemove={onRemove} onOpenImage={onOpenImage} />
        ))}
      </div>
    </div>
  );
};

// ── Aba de Galeria — antes/depois vinculada ao procedimento fechado ──
const FotosTab = ({ lead, vendasLead = [] }: { lead: any; vendasLead?: any[] }) => {
  const { fotos, isLoading, upload, remove } = useLeadFotos(lead.id);
  const [showForm, setShowForm] = useState(false);
  const [antesFile, setAntesFile] = useState<File | null>(null);
  const [depoisFile, setDepoisFile] = useState<File | null>(null);
  const [proc, setProc] = useState("");
  const [dataProcedimento, setDataProcedimento] = useState<Date>(new Date());
  const [dataAutoPreenchida, setDataAutoPreenchida] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Primário: procedimentos realmente fechados (vendas). Fallback: interesse declarado no lead.
  const procedimentosFechados = [...new Set(
    (vendasLead as any[]).map((v) => v.produto_servico?.trim()).filter(Boolean)
  )] as string[];
  const procOptions = procedimentosFechados.length > 0
    ? procedimentosFechados
    : String(lead.procedimento_interesse || "")
        .split(/[,;•\n]|\s+e\s+/i)
        .map((p) => p.trim())
        .filter(Boolean);

  // Data de pagamento mais recente por procedimento — usada pra preencher a data automaticamente
  const dataPagamentoPorProduto = new Map<string, string>();
  for (const v of vendasLead as any[]) {
    const key = v.produto_servico?.trim();
    if (!key || !v.data_fechamento) continue;
    const atual = dataPagamentoPorProduto.get(key);
    if (!atual || v.data_fechamento > atual) dataPagamentoPorProduto.set(key, v.data_fechamento);
  }

  useEffect(() => {
    const dataPagamento = proc ? dataPagamentoPorProduto.get(proc) : undefined;
    if (dataPagamento) {
      setDataProcedimento(parseISO(dataPagamento));
      setDataAutoPreenchida(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc]);

  const resetForm = () => {
    setAntesFile(null); setDepoisFile(null); setProc(""); setDataProcedimento(new Date()); setDataAutoPreenchida(false); setShowForm(false);
  };

  const isSaving = upload.isPending;

  const handleSubmit = async () => {
    if (!antesFile && !depoisFile) return;
    const data_procedimento = format(dataProcedimento, "yyyy-MM-dd");
    try {
      if (antesFile) await upload.mutateAsync({ file: antesFile, tipo: "antes", procedimento: proc || undefined, data_procedimento });
      if (depoisFile) await upload.mutateAsync({ file: depoisFile, tipo: "depois", procedimento: proc || undefined, data_procedimento });
      resetForm();
    } catch {
      // erro já sinalizado via toast pela mutation
    }
  };

  const grupos = new Map<string, LeadFoto[]>();
  for (const f of fotos) {
    const k = f.procedimento?.trim() || "Sem procedimento";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(f);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Galeria antes / depois</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Adicionar fotos
        </Button>
      </div>

      {/* Form de upload */}
      {showForm && (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Procedimento</span>
            {procedimentosFechados.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50">Nenhuma venda registrada para este lead ainda — digite um procedimento manualmente ou registre a venda.</p>
            )}
            <CreatableSelect
              options={procOptions}
              value={proc}
              onChange={setProc}
              placeholder="Selecione o procedimento fechado..."
              searchPlaceholder="Buscar ou criar procedimento..."
              emptyPlaceholder="Nenhum procedimento encontrado."
            />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" /> Data do procedimento
            </span>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-9 rounded-lg text-sm border-border/60 bg-background"
                >
                  <CalendarDays className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {format(dataProcedimento, "EEE, dd 'de' MMM", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-xl border-border/60" align="start">
                <Calendar
                  mode="single"
                  selected={dataProcedimento}
                  onSelect={(d) => { if (d) { setDataProcedimento(d); setDataAutoPreenchida(false); setIsDatePickerOpen(false); } }}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {dataAutoPreenchida && (
              <p className="text-[10px] text-muted-foreground/60">Preenchida automaticamente pela data do pagamento — pode ser alterada.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FotoSlot label="Antes" file={antesFile} onChange={setAntesFile} />
            <FotoSlot label="Depois" file={depoisFile} onChange={setDepoisFile} />
          </div>

          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="text-[11px] h-8 text-muted-foreground" onClick={resetForm}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={(!antesFile && !depoisFile) || isSaving}
              className="h-8 rounded-lg text-[11px] font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-4"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />} Salvar
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && fotos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Camera className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma foto ainda</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Registre o antes e o depois dos procedimentos</p>
        </div>
      )}

      {[...grupos.entries()].map(([grupo, items]) => (
        <FotoGrupoCard key={grupo} grupo={grupo} items={items} onRemove={(f) => remove.mutate(f)} onOpenImage={setLightboxUrl} />
      ))}

      {/* Lightbox — expande a foto centralizada em vez de abrir nova aba */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background/95 border-border/60">
          <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
          {lightboxUrl && (
            <img src={lightboxUrl} className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ViewContent = ({
  lead, creativeName, creativeAd,
  isEditing = false, formData, handleInputChange, handleSourceChange, allSources,
  teamMembers = [],
}: {
  lead: any; creativeName?: string; creativeAd?: any;
  isEditing?: boolean; formData?: any;
  handleInputChange?: (field: string, value: any) => void;
  handleSourceChange?: (value: string) => void;
  allSources?: string[];
  teamMembers?: MemberSelectOption[];
}) => {
  /* helpers */
  const { profile: viewProfile } = useProfile();
  const isAnnaClaraOrg = viewProfile?.organization_id === ANNA_CLARA_ORG_ID;
  const queryClient = useQueryClient();
  const [showAgendamentoModal, setShowAgendamentoModal] = useState(false);
  const [showVendaModal, setShowVendaModal] = useState(false);
  const onEdit = (field: string, value: any) => { if (isEditing && handleInputChange) handleInputChange(field, value); };
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Ativo": return { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Ativo" };
      case "Inativo": return { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", label: "Inativo" };
      case "Convertido": return { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", label: "Convertido" };
      case "Perdido": return { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Perdido" };
      default: return { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", label: status };
    }
  };

  const getScoreConfig = (score: string | null) => {
    switch (score) {
      case "A": return { label: "A", color: "#10B981", text: "Lead dos Sonhos" };
      case "B": return { label: "B", color: "#3B82F6", text: "Qualificado" };
      case "C": return { label: "C", color: "#F59E0B", text: "Em Desenvolvimento" };
      case "D": return { label: "D", color: "#EF4444", text: "Fora do ICP" };
      default: return null;
    }
  };

  const displayStatus = isEditing && formData ? formData.status : lead.status;
  const statusConfig = getStatusConfig(displayStatus);
  const scoreConfig = getScoreConfig(lead.lead_scoring);

  const { data: agendamentos = [] } = useQuery({
    queryKey: ['lead-modal-agendamentos', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('id, titulo, tipo, descricao, data_hora_inicio, status')
        .eq('lead_id', lead.id)
        .order('data_hora_inicio', { ascending: false });
      return data || [];
    },
    enabled: !!lead.id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: vendasLead = [] } = useQuery({
    queryKey: ['lead-modal-vendas', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendas')
        .select('id, produto_servico, valor_fechado, data_fechamento, forma_pagamento')
        .eq('lead_id', lead.id)
        .order('data_fechamento', { ascending: false });
      return data || [];
    },
    enabled: !!lead.id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: lastMessage } = useQuery({
    queryKey: ['lead-modal-last-message', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('mensagens')
        .select('criado_em')
        .eq('lead_id', lead.id)
        .neq('remetente', 'ia')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!lead.id,
    staleTime: 2 * 60 * 1000,
  });

  const displayName = isEditing && formData ? formData.nome : lead.nome;
  const initials = (displayName || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  const [activeTab, setActiveTab] = useState<'resumo' | 'ia' | 'historico' | 'consultas' | 'financeiro' | 'fotos' | 'etiquetas' | 'notas'>('resumo');
  const TABS = [
    { id: 'resumo',     label: 'Resumo',     icon: User },
    { id: 'ia',         label: 'IA',         icon: Sparkles },
    { id: 'historico',  label: 'Histórico',  icon: Activity },
    { id: 'consultas',  label: 'Consultas',  icon: CalendarIcon, count: agendamentos.length },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, count: vendasLead.length },
    { id: 'fotos',      label: 'Galeria',    icon: Camera },
    { id: 'etiquetas',  label: 'Etiquetas',  icon: Tag },
    { id: 'notas',      label: 'Notas',      icon: MessageSquare },
  ] as const;

  const lastContactRaw = lead.ultimo_contato || lastMessage?.criado_em || null;
  const lastContactTime = lastContactRaw
    ? formatDistanceToNow(new Date(lastContactRaw), { addSuffix: true, locale: ptBR })
    : null;
  const createdDate = lead.criado_em
    ? formatDistanceToNow(new Date(lead.criado_em), { addSuffix: true, locale: ptBR })
    : null;

  const proxAgendamento = (agendamentos as any[])
    .filter((a) => a.data_hora_inicio && new Date(a.data_hora_inicio).getTime() > Date.now() && a.status !== 'cancelado')
    .sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime())[0];
  const hasProcedimentoInteresse = !!(lead.procedimento_interesse && String(lead.procedimento_interesse).trim());
  const respLead = teamMembers.find((m) => m.id === lead.responsavel_id);
  const hasInfoBlock = !!(respLead || lead.data_nascimento || lead.genero || lead.cpf || lead.endereco);
  const resumoIsEmpty = !proxAgendamento && vendasLead.length === 0 && !hasProcedimentoInteresse && !hasInfoBlock && !scoreConfig;

  return (
    <div className="bg-[#fafaf8] dark:bg-[#141414]">

      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="bg-card px-6 pt-6 pb-5 border-b border-border/60">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center ring-1 ring-border/60">
              <span className="text-xl font-extrabold text-muted-foreground select-none font-display tracking-tight">{initials}</span>
            </div>
            <div className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-card", statusConfig.dot)} />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            {isEditing ? (
              /* ── Edit mode hero ── */
              <div className="space-y-2.5 max-w-md">
                <Input
                  value={formData.nome}
                  onChange={(e) => onEdit('nome', e.target.value)}
                  placeholder="Nome do lead"
                  className="h-10 text-lg font-bold tracking-tight rounded-lg border-border/60 bg-background"
                />
                <PhoneInput
                  value={formData.telefone}
                  onChange={(e: any) => onEdit('telefone', e.target.value)}
                  className="h-9 text-[13px] rounded-lg border-border/60 bg-background"
                  required
                />
                <div className="flex items-center gap-2.5">
                  <Switch
                    checked={formData.is_qualified}
                    onCheckedChange={(checked) => onEdit('is_qualified', checked)}
                    className="data-[state=checked]:bg-emerald-500 scale-[0.8]"
                  />
                  <span className="text-[11px] font-medium text-muted-foreground">Lead Qualificado</span>
                </div>
              </div>
            ) : (
              /* ── View mode hero ── */
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-extrabold tracking-tight text-foreground font-display leading-tight">{lead.nome || 'Lead sem nome'}</h3>
                  {lead.is_qualified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <UserCheck className="h-3 w-3" />
                      Qualificado
                    </span>
                  )}
                  {scoreConfig && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-md" style={{ backgroundColor: scoreConfig.color }}>
                      <Target className="h-3 w-3" />
                      Score {scoreConfig.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span className="font-mono tabular-nums">{formatPhoneDisplay(lead.telefone)}</span>
                  </span>
                  {lead.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      {lead.email}
                    </span>
                  )}
                  {lead.idade ? (
                    <span className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      {lead.idade} anos
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* Ações rápidas — topo do card */}
          {!isEditing && (
            <div className="flex items-center gap-2 shrink-0 mr-8">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAgendamentoModal(true)}
                className="h-9 rounded-lg text-xs font-semibold gap-1.5 border-border/60 hover:bg-muted/50"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Agendar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowVendaModal(true)}
                className="h-9 rounded-lg text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm px-4"
              >
                <DollarSign className="h-3.5 w-3.5" />
                Registrar Venda
              </Button>
            </div>
          )}
        </div>

      </div>

      {/* ═══════════════ TABS (somente view mode) ═══════════════ */}
      {!isEditing && (
        <div className="px-6 pt-5 flex justify-center">
          <div className="inline-flex items-center gap-0.5 bg-muted/40 rounded-xl p-1 max-w-full overflow-x-auto">
            {TABS.map((t) => {
              const TabIcon = t.icon;
              const active = activeTab === t.id;
              const count = (t as any).count as number | undefined;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors whitespace-nowrap",
                    active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {t.label}
                  {count != null && count > 0 && (
                    <span className={cn(
                      "text-[9px] font-bold px-1 rounded tabular-nums",
                      active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ ORIGEM / CADASTRO / ÚLTIMO CONTATO (centralizado, sempre visível) ═══════════════ */}
      {!isEditing && (
        <div className="px-6 pt-3 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
            <span>
              <span className="text-muted-foreground">Origem: </span>
              <span className={cn("font-semibold", {
                'text-amber-600': lead.origem === 'marketing',
                'text-emerald-600': lead.origem === 'organico' || lead.origem === 'indicacao',
                'text-cyan-600': lead.origem === 'reativacao',
                'text-teal-600': lead.origem === 'paciente',
                'text-violet-600': lead.origem === 'convenio',
                'text-muted-foreground': !['marketing','organico','indicacao','reativacao','paciente','convenio'].includes(lead.origem),
              })}>
                {{ marketing: 'Marketing', organico: 'Orgânico', indicacao: 'Orgânico', reativacao: 'Reativação', paciente: 'Paciente', convenio: 'Convênio' }[lead.origem as string] ?? lead.origem ?? '—'}
              </span>
            </span>
            <span className="text-border/60">•</span>
            <span>
              <span className="text-muted-foreground">Cadastro: </span>
              <span className="font-semibold text-foreground">{createdDate || '—'}</span>
            </span>
            <span className="text-border/60">•</span>
            <span>
              <span className="text-muted-foreground">Último contato: </span>
              <span className={cn("font-semibold", lastContactTime ? "text-foreground" : "text-muted-foreground/50")}>{lastContactTime || 'Sem contato'}</span>
            </span>
          </div>
        </div>
      )}

      {/* ═══════════════ RESPONSÁVEL (edição) ═══════════════ */}
      {isEditing && (
        <div className="px-6 pt-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/20">
              <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Responsável</span>
            </div>
            <div className="px-4 py-3">
              {isEditing ? (
                <Select
                  value={formData?.responsavel_id || 'none'}
                  onValueChange={(v) => handleInputChange && handleInputChange('responsavel_id', v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background w-full">
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Sem responsável</span>
                    </SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {m.url_avatar
                              ? <img src={m.url_avatar} className="h-full w-full object-cover" />
                              : <span className="text-[9px] font-bold text-muted-foreground">{(m.nome || m.email).charAt(0).toUpperCase()}</span>
                            }
                          </div>
                          <span>{m.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (() => {
                const resp = teamMembers.find(m => m.id === lead.responsavel_id);
                if (!resp) return <span className="text-[13px] text-muted-foreground">—</span>;
                return (
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                      {resp.url_avatar
                        ? <img src={resp.url_avatar} className="h-full w-full object-cover" />
                        : <span className="text-[10px] font-bold text-muted-foreground">{resp.nome.charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-foreground">{resp.nome}</span>
                      <span className="text-[11px] text-muted-foreground block">{resp.email}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ BODY CONTENT ═══════════════ */}
      <div className="px-6 pt-5 pb-2 space-y-4">


        {/* ═══════════════ INFORMAÇÕES (edição) ═══════════════ */}
        {isEditing && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Informações</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Origem</label>
                <Select value={formData.origem} onValueChange={(v) => onEdit('origem', v)}>
                  <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="marketing"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" />Marketing</div></SelectItem>
                    <SelectItem value="organico"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" />Orgânico</div></SelectItem>
                    <SelectItem value="reativacao"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-cyan-500" />Reativação</div></SelectItem>
                    <SelectItem value="paciente"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-teal-500" />Paciente</div></SelectItem>
                    {isAnnaClaraOrg && <SelectItem value="convenio"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-violet-500" />Convênio</div></SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Data de Cadastro</label>
                <MaskedInput
                  mask="99/99/9999"
                  placeholder="DD/MM/AAAA"
                  value={formData.criado_em_display}
                  onChange={(e: any) => onEdit('criado_em_display', e.target.value)}
                  className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ RESUMO (view) ═══════════════ */}
        {!isEditing && activeTab === 'resumo' && (
          <div className="space-y-4">

            {/* Empty state — nenhuma informação relevante ainda */}
            {resumoIsEmpty && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <User className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade registrada ainda</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Agendamentos, vendas e procedimentos de interesse aparecem aqui</p>
              </div>
            )}

            {/* Próximo agendamento em destaque */}
            {proxAgendamento && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 shrink-0">
                    <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Próximo agendamento</span>
                    <span className="text-[13px] font-semibold text-foreground">
                      {proxAgendamento.titulo || 'Agendamento'} · {format(parseISO(proxAgendamento.data_hora_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Resumo financeiro — vendas fechadas com este lead */}
            {vendasLead.length > 0 && (() => {
              const total = (vendasLead as any[]).reduce((s, v) => s + (Number(v.valor_fechado) || 0), 0);
              return (
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 shrink-0">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                        {vendasLead.length} procedimento{vendasLead.length !== 1 ? 's' : ''} fechado{vendasLead.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[13px] font-semibold text-foreground tabular-nums font-display">
                        R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Procedimento(s) de interesse — preenchido automaticamente pela IA */}
            {hasProcedimentoInteresse && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
                  <Syringe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Procedimento de interesse</span>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {String(lead.procedimento_interesse)
                    .split(/[,;•\n]|\s+e\s+/i)
                    .map((p) => p.trim())
                    .filter(Boolean)
                    .map((proc, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center text-[12px] font-semibold text-foreground bg-muted/60 border border-border/50 px-2.5 py-1 rounded-lg"
                      >
                        {proc}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Informações — dados do lead que não estão no topo (inclui Responsável) */}
            {hasInfoBlock && (() => {
              const resp = respLead;
              return (
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Informações</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
                    {resp && (
                      <div className="col-span-2 flex items-center gap-2.5 pb-3.5 border-b border-border/40">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                          {resp.url_avatar
                            ? <img src={resp.url_avatar} className="h-full w-full object-cover" />
                            : <span className="text-[11px] font-bold text-muted-foreground">{resp.nome.charAt(0).toUpperCase()}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Responsável</span>
                          <span className="text-[13px] font-semibold text-foreground truncate block">{resp.nome}</span>
                        </div>
                      </div>
                    )}
                    {lead.data_nascimento && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Nascimento</span>
                        <span className="text-[13px] font-semibold text-foreground tabular-nums">
                          {toDisplayDate(lead.data_nascimento)}
                          {lead.idade ? <span className="text-muted-foreground font-normal ml-1">({lead.idade}a)</span> : ''}
                        </span>
                      </div>
                    )}
                    {lead.genero && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Gênero</span>
                        <span className="text-[13px] font-semibold text-foreground">{lead.genero === 'M' ? 'Masculino' : lead.genero === 'F' ? 'Feminino' : lead.genero}</span>
                      </div>
                    )}
                    {lead.cpf && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">CPF</span>
                        <span className="text-[13px] font-semibold text-foreground font-mono tabular-nums">{lead.cpf}</span>
                      </div>
                    )}
                    {lead.endereco && (
                      <div className="col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Endereço</span>
                        <span className="text-[13px] font-medium text-foreground">{lead.endereco}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Lead Score — só quando definido */}
            {scoreConfig && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <svg width="56" height="56" viewBox="0 0 64 64" className="transform -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/60" />
                      <circle
                        cx="32" cy="32" r="28" fill="none" stroke={scoreConfig.color} strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - (scoreConfig.label === 'A' ? 0.95 : scoreConfig.label === 'B' ? 0.75 : scoreConfig.label === 'C' ? 0.50 : 0.25))}`}
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-extrabold font-display" style={{ color: scoreConfig.color }}>{scoreConfig.label}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Lead Score</span>
                    <span className="text-sm font-bold text-foreground block mt-0.5">{scoreConfig.text}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ CONSULTAS (agendamentos) ═══════════════ */}
        {!isEditing && activeTab === 'consultas' && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border/40 bg-blue-50/50 dark:bg-blue-950/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                      <CalendarIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Agendamentos</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {agendamentos.length > 0 ? `${agendamentos.length} registro${agendamentos.length !== 1 ? 's' : ''}` : 'Nenhum registro'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAgendamentoModal(true)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 px-2 py-1 rounded-lg transition-colors"
                    title="Novo agendamento"
                  >
                    <Plus className="h-3 w-3" />
                    Novo
                  </button>
                </div>
              </div>
              {agendamentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 rounded-xl bg-muted/40 mb-3">
                    <CalendarIcon className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum agendamento</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">Nada registrado ainda</p>
                </div>
              ) : (
                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                  {(agendamentos as any[]).map((a) => {
                    const sMap: Record<string, { bar: string; badge: string; text: string; label: string }> = {
                      agendado:      { bar: 'bg-indigo-500',  badge: 'bg-indigo-50 dark:bg-indigo-900/30',  text: 'text-indigo-700 dark:text-indigo-300',  label: 'Agendado'       },
                      confirmado:    { bar: 'bg-sky-500',     badge: 'bg-sky-50 dark:bg-sky-900/30',        text: 'text-sky-700 dark:text-sky-300',        label: 'Confirmado'     },
                      realizado:     { bar: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Realizado'     },
                      nao_compareceu:{ bar: 'bg-red-500',     badge: 'bg-red-50 dark:bg-red-900/30',        text: 'text-red-600 dark:text-red-400',        label: 'Não compareceu' },
                      cancelado:     { bar: 'bg-red-400',     badge: 'bg-red-50/50 dark:bg-red-900/20',     text: 'text-red-500 dark:text-red-400',        label: 'Cancelado'      },
                      remarcado:     { bar: 'bg-amber-500',   badge: 'bg-amber-50 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-300',    label: 'Remarcado'      },
                    };
                    const s = sMap[a.status] ?? sMap.realizado;
                    return (
                      <div key={a.id} className="rounded-xl border border-border/50 bg-background hover:bg-muted/20 transition-colors overflow-hidden flex">
                        <div className={cn("w-1 shrink-0", s.bar)} />
                        <div className="flex-1 min-w-0 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-[12px] font-semibold text-foreground leading-tight">{a.titulo || 'Agendamento'}</p>
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 border border-border/30", s.badge, s.text)}>{s.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            <p className="text-[11px] text-muted-foreground/60 tabular-nums">
                              {a.data_hora_inicio ? format(parseISO(a.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                            </p>
                          </div>
                          {(a.tipo || a.descricao) && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {a.tipo && <span className="text-[9px] font-semibold bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md capitalize border border-border/40">{a.tipo}</span>}
                              {a.descricao && <p className="text-[10px] text-muted-foreground/50 truncate">{a.descricao}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        )}

        {/* ═══════════════ FINANCEIRO (fechamentos) ═══════════════ */}
        {!isEditing && activeTab === 'financeiro' && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border/40 bg-emerald-50/50 dark:bg-emerald-950/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Fechamentos</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {vendasLead.length > 0 ? `${vendasLead.length} venda${vendasLead.length !== 1 ? 's' : ''} registrada${vendasLead.length !== 1 ? 's' : ''}` : 'Nenhuma venda'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowVendaModal(true)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 px-2 py-1 rounded-lg transition-colors"
                    title="Novo fechamento"
                  >
                    <Plus className="h-3 w-3" />
                    Novo
                  </button>
                </div>
              </div>
              {vendasLead.length > 0 && (() => {
                const total = (vendasLead as any[]).reduce((s, v) => s + (Number(v.valor_fechado) || 0), 0);
                const media = total / vendasLead.length;
                return (
                  <div className="grid grid-cols-2 divide-x divide-border/40 border-b border-border/40">
                    <div className="px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Receita total</p>
                      <p className="text-[14px] font-bold text-foreground tabular-nums font-display">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Ticket médio</p>
                      <p className="text-[14px] font-bold text-foreground tabular-nums font-display">R$ {media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                );
              })()}
              {vendasLead.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 rounded-xl bg-muted/40 mb-3">
                    <DollarSign className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma venda registrada</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">Ainda não há fechamentos</p>
                </div>
              ) : (
                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                  {(vendasLead as any[]).map((v) => (
                    <div key={v.id} className="rounded-xl border border-border/50 bg-background hover:bg-muted/20 transition-colors overflow-hidden flex">
                      <div className="w-1 shrink-0 bg-violet-500" />
                      <div className="flex-1 min-w-0 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-[12px] font-semibold text-foreground leading-tight">{v.produto_servico || 'Venda'}</p>
                          {v.valor_fechado != null && (
                            <span className="text-[13px] font-bold text-emerald-600 shrink-0 tabular-nums font-display">
                              R$ {Number(v.valor_fechado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CalendarDays className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <p className="text-[11px] text-muted-foreground/60 tabular-nums">
                            {v.data_fechamento ? format(parseISO(v.data_fechamento), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                          </p>
                          {v.forma_pagamento && (
                            <span className="text-[9px] font-semibold bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md capitalize border border-border/40">{v.forma_pagamento}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        )}

        {/* ═══════════════ IA ═══════════════ */}
        {!isEditing && activeTab === 'ia' && (
          <IaTab lead={lead} />
        )}

        {/* ═══════════════ HISTÓRICO ═══════════════ */}
        {!isEditing && activeTab === 'historico' && (
          <HistoricoTimeline leadId={lead.id} />
        )}

        {/* ═══════════════ FOTOS ═══════════════ */}
        {!isEditing && activeTab === 'fotos' && (
          <FotosTab lead={lead} vendasLead={vendasLead} />
        )}

        {/* ═══════════════ ETIQUETAS ═══════════════ */}
        {!isEditing && activeTab === 'etiquetas' && (
          <TagManager leadId={lead.id} fullPage />
        )}

        {/* ═══════════════ NOTAS ═══════════════ */}
        {!isEditing && activeTab === 'notas' && lead.organization_id && (
          <LeadNotas leadId={lead.id} organizationId={lead.organization_id} />
        )}

        {/* Sub-modais de criação */}
        <AgendamentoLeadModal
          isOpen={showAgendamentoModal}
          onClose={() => setShowAgendamentoModal(false)}
          leadId={lead.id}
          leadNome={lead.nome || ''}
          onSaved={() => {
            setShowAgendamentoModal(false);
            queryClient.invalidateQueries({ queryKey: ['lead-modal-agendamentos', lead.id] });
          }}
        />
        <VendaModal
          open={showVendaModal}
          onOpenChange={setShowVendaModal}
          lead={lead}
          onSaved={() => {
            setShowVendaModal(false);
            queryClient.invalidateQueries({ queryKey: ['lead-modal-vendas', lead.id] });
          }}
        />
      </div>
    </div>
  );
};

const FormField = ({ label, required, children }: { label: string, required?: boolean, children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-1">
      {label}
      {required && <span className="text-red-500 text-[10px]">*</span>}
    </label>
    {children}
  </div>
);

const FormContent = ({ formData, handleInputChange, handleSubmit, stages, handleClose, isEdit, handleSourceChange, teamMembers = [] }: any) => {
  const { allSources } = useLeadSources();
  const { profile: formProfile } = useProfile();
  const formOrgId = formProfile?.organization_id;
  const isAnnaClaraOrg = formOrgId === ANNA_CLARA_ORG_ID;
  const { data: metaAdsOptions = [] } = useQuery({
    queryKey: ['meta_ads_select', formOrgId],
    queryFn: async () => {
      const { data } = await (supabase
        .from('meta_ads') as any)
        .select('id, nome, meta_ad_id, url_thumbnail, status')
        .eq('organization_id', formOrgId!)
        .order('criado_em', { ascending: false });
      return data || [];
    },
    enabled: !!formOrgId,
  });

  const initials = (formData.nome || "?").split(" ").slice(0, 2).map((w: string) => w[0] || "").join("").toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto">
      {/* Header visual com avatar */}
      <div className="flex items-center gap-4 px-6 pb-5 border-b border-border/50">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-muted-foreground select-none">
            {formData.nome ? initials : <User className="h-5 w-5 text-muted-foreground" />}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{formData.nome || 'Novo lead'}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formData.telefone ? formData.telefone : 'Preencha os dados abaixo'}
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Seção: Identificação */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <div className="p-1.5 rounded-lg bg-muted">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Identificação</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div data-tutorial="lead-field-nome">
              <FormField label="Nome">
                <Input
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Nome completo"
                  className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
                />
              </FormField>
            </div>
            <div data-tutorial="lead-field-telefone">
              <FormField label="Telefone" required>
                <PhoneInput
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  required
                  className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Seção: Origem & Funil */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <div className="p-1.5 rounded-lg bg-muted">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Origem & Funil</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div data-tutorial="lead-field-origem">
              <FormField label="Origem">
                <Select value={formData.origem} onValueChange={(value) => handleInputChange('origem', value)}>
                  <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="marketing">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" />Marketing</div>
                    </SelectItem>
                    <SelectItem value="organico">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" />Orgânico</div>
                    </SelectItem>
                    <SelectItem value="reativacao">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-cyan-500" />Reativação</div>
                    </SelectItem>
                    <SelectItem value="paciente">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-teal-500" />Paciente</div>
                    </SelectItem>
                    {isAnnaClaraOrg && (
                      <SelectItem value="convenio">
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-violet-500" />Convênio</div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div data-tutorial="lead-field-data">
              <FormField label="Data de Cadastro">
                <MaskedInput
                  mask="99/99/9999"
                  placeholder="DD/MM/AAAA"
                  value={formData.criado_em_display}
                  onChange={(e) => handleInputChange('criado_em_display', e.target.value)}
                  className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Seção: Responsável */}
        {teamMembers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <div className="p-1.5 rounded-lg bg-muted">
                <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Responsável</span>
            </div>
            <Select
              value={formData.responsavel_id || 'none'}
              onValueChange={(v) => handleInputChange('responsavel_id', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background w-full">
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">
                  <span className="text-muted-foreground">Sem responsável</span>
                </SelectItem>
                {teamMembers.map((m: MemberSelectOption) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {m.url_avatar
                          ? <img src={m.url_avatar} className="h-full w-full object-cover" />
                          : <span className="text-[9px] font-bold text-muted-foreground">{(m.nome || m.email).charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <span>{m.nome}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Seção: Resumo IA */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <div className="p-1.5 rounded-lg bg-amber-50">
              <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Resumo do Atendimento (IA)</span>
          </div>
          <Textarea
            value={formData.resumo}
            onChange={(e) => handleInputChange('resumo', e.target.value)}
            placeholder="Resumo gerado pela IA sobre o atendimento..."
            className="min-h-[80px] text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30 resize-none"
          />
        </div>
      </div>

      {/* Footer com ações */}
      <div className="flex items-center gap-2 px-6 py-4 border-t border-border/40 bg-muted/20 rounded-b-2xl">
        <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={handleClose}>
          {isEdit ? "Cancelar" : "Fechar"}
        </Button>
        <div className="flex-1" />
        <Button
          type="submit"
          size="sm"
          data-tutorial="lead-submit"
          className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-5"
        >
          {isEdit ? (
            <>
              <Pencil className="h-3 w-3" />
              Salvar Alterações
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Criar Lead
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// --- Componente Principal ---

interface LeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: any;
  mode?: 'view' | 'edit' | 'create';
}

export function LeadModal({ open, onOpenChange, lead, mode = 'create' }: LeadModalProps) {
  const { createLead, updateLead } = useLeads();
  const { allSources, createSource } = useLeadSources();
  const { profile: currentProfile } = useProfile();
  const { members: teamMembers } = useTeamMembersForSelect();
  const currentOrgId = currentProfile?.organization_id;
  const isAnnaClaraOrg = currentOrgId === ANNA_CLARA_ORG_ID;
  const { data: metaAdsData = [] } = useQuery({
    queryKey: ['meta_ads_select', currentOrgId],
    queryFn: async () => {
      const { data } = await (supabase
        .from('meta_ads') as any)
        .select('id, nome, meta_ad_id, url_thumbnail')
        .eq('organization_id', currentOrgId!)
        .order('criado_em', { ascending: false });
      return data || [];
    },
    enabled: !!currentOrgId,
  });
  const [formData, setFormData] = useState(initialFormData);
  const [currentMode, setCurrentMode] = useState(mode);
  const [isVendaModalOpen, setIsVendaModalOpen] = useState(false);
  const navigate = useNavigate();

  const isView = currentMode === 'view';
  const isEdit = currentMode === 'edit' && !!lead;

  useEffect(() => {
    if (open) {
      setCurrentMode(mode);
      if (lead) {
        // Strip country code "55" for PhoneInput display (expects 10-11 digits)
        let telForForm = lead.telefone || "";
        const rawTel = telForForm.replace(/\D/g, '');
        if (rawTel.startsWith('55') && rawTel.length >= 12) {
          telForForm = rawTel.slice(2);
        }
        setFormData({
          nome: lead.nome || "", telefone: telForForm,
          resumo: lead.resumo || "",
          origem: lead.origem || "organico",
          fonte: lead.fonte || "",

          status: lead.status || "Ativo", email: lead.email || "", cpf: lead.cpf || "",
          idade: lead.idade?.toString() || "", genero: lead.genero || "", endereco: lead.endereco || "",
          procedimento_interesse: lead.procedimento_interesse || "",
          criativo_id: lead.criativo_id || "none",
          data_nascimento_display: toDisplayDate(lead.data_nascimento),
          criado_em_display: toDisplayDateFromTimestamp(lead.criado_em),
          is_qualified: lead.is_qualified || false,
          responsavel_id: lead.responsavel_id || "",
        });
      } else {
        setFormData({
            ...initialFormData,
            criado_em_display: format(new Date(), 'dd/MM/yyyy'),
        });
      }
    }
  }, [open, lead, mode]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => {
      const newState = { ...prev, [field]: value };
      if (field === 'data_nascimento_display') {
        newState.idade = String(calculateAge(value as string));
      }
      return newState;
    });
  };

  const handleSourceChange = (value: string) => {
    handleInputChange('fonte', value);
    if (value && !allSources.includes(value)) {
      createSource({ name: value });
    }
  };

  const doSubmit = () => {
    let cleanedPhone = cleanPhoneNumber(formData.telefone);
    if (!cleanedPhone || cleanedPhone.length < 10) {
      alert("O campo Telefone é obrigatório e deve ser válido.");
      return;
    }
    // Re-add country code "55" if it was stripped for display
    if (!cleanedPhone.startsWith('55') && (cleanedPhone.length === 10 || cleanedPhone.length === 11)) {
      cleanedPhone = '55' + cleanedPhone;
    }

    const data = {
      ...formData,
      telefone: cleanedPhone,
      idade: formData.idade ? parseInt(formData.idade) : undefined,
      data_nascimento: toSupabaseDate(formData.data_nascimento_display),
      criado_em: toSupabaseTimestamp(formData.criado_em_display),
      nome: formData.nome || undefined,
      origem: formData.origem || undefined,
      fonte: formData.fonte || undefined,
      resumo: formData.resumo || undefined,
      email: formData.email || undefined,
      cpf: formData.cpf || undefined,
      genero: formData.genero || undefined,
      endereco: formData.endereco || undefined,
      procedimento_interesse: formData.procedimento_interesse || undefined,
      criativo_id: formData.criativo_id === "none" ? null : formData.criativo_id,
      is_qualified: formData.is_qualified,
      responsavel_id: formData.responsavel_id || null,
    };

    delete (data as any).data_nascimento_display;
    delete (data as any).criado_em_display;

    if (isEdit) {
      updateLead({ id: lead.id, ...data });
    } else {
      createLead(data as any);
    }
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleClose = () => onOpenChange(false);
  const handleEditClient = () => setCurrentMode('edit');
  
  const handleOpenConversation = () => {
    if (lead?.id) {
      navigate(`/crm/conversas/${lead.id}`);
      onOpenChange(false);
    }
  };

  const creativeAd = lead?.criativo_id
    ? metaAdsData.find((a: any) => a.id === lead.criativo_id)
    : null;
  const creativeName = creativeAd?.nome || (lead?.criativo_id ? `Criativo #${lead.criativo_id.slice(-6)}` : undefined);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent data-tutorial="lead-modal" className={cn(
          "max-h-[90vh] rounded-2xl p-0 gap-0 overflow-hidden",
          (isView || isEdit)
            ? "max-w-4xl flex flex-col bg-[#fafaf8] dark:bg-[#141414]"
            : "max-w-2xl bg-white dark:bg-[#1a1a1a]"
        )}>
          {(isView || isEdit) ? (
            <>
              {/* Área rolável — header + abas + conteúdo. O rodapé de ações fica FORA
                  desta div (ver abaixo), como item de flex separado, para nunca sobrepor
                  o conteúdo enquanto o usuário rola uma aba longa (ex: Histórico). */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <DialogHeader className="sr-only">
                  <DialogTitle>{isEdit ? 'Editar Lead' : 'Detalhes do Lead'}</DialogTitle>
                </DialogHeader>

                {lead ? (
                  <div className="pb-0 min-w-0">
                    <ViewContent
                      lead={lead}
                      creativeName={creativeName}
                      creativeAd={creativeAd}
                      isEditing={isEdit}
                      formData={isEdit ? formData : undefined}
                      handleInputChange={isEdit ? handleInputChange : undefined}
                      handleSourceChange={isEdit ? handleSourceChange : undefined}
                      allSources={isEdit ? allSources : undefined}
                      teamMembers={teamMembers}
                    />
                  </div>
                ) : (
                  <FormContent
                    formData={formData}
                    handleInputChange={handleInputChange}
                    handleSubmit={handleSubmit}
                    handleClose={handleClose}
                    isEdit={false}
                    handleSourceChange={handleSourceChange}
                    teamMembers={teamMembers}
                  />
                )}

                {/* Notas do lead — em view mode fica na aba Notas */}
                {isEdit && lead?.id && lead?.organization_id && (
                  <div className="border-t border-border/40 pt-5 pb-3 px-6">
                    <LeadNotas leadId={lead.id} organizationId={lead.organization_id} />
                  </div>
                )}
              </div>

              {isView && (
                <div className="flex items-center gap-2 px-6 py-4 border-t border-border/40 bg-white dark:bg-[#1a1a1a] shrink-0">
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={handleClose}>Fechar</Button>
                  <div className="flex-1" />
                  <Button type="button" size="sm" variant="outline" onClick={handleOpenConversation} className="h-8 rounded-lg text-xs font-semibold gap-1.5 border-border/60 hover:bg-muted/50">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Conversa
                  </Button>
                  <Button type="button" size="sm" onClick={handleEditClient} className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-sm">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              )}

              {isEdit && (
                <div className="flex items-center gap-2 px-6 py-4 border-t border-border/40 bg-white dark:bg-[#1a1a1a] shrink-0">
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setCurrentMode('view')}>
                    Cancelar
                  </Button>
                  <div className="flex-1" />
                  <Button
                    type="button"
                    size="sm"
                    onClick={doSubmit}
                    className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-sm px-5"
                  >
                    <Pencil className="h-3 w-3" />
                    Salvar Alterações
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Create mode — separate header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/40">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-50">
                      <Plus className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <DialogTitle className="font-display font-bold tracking-tight text-lg">
                        Novo Lead
                      </DialogTitle>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Preencha os dados para adicionar um novo lead
                      </p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <FormContent
                formData={formData}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                handleClose={handleClose}
                isEdit={false}
                handleSourceChange={handleSourceChange}
                teamMembers={teamMembers}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <VendaModal
        open={isVendaModalOpen}
        onOpenChange={setIsVendaModalOpen}
        lead={lead}
      />
    </>
  );
}