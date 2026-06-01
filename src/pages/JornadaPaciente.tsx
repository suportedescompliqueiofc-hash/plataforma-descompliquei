import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, ArrowRight, UserRound, Mail, MapPin, Stethoscope, Star,
  GitBranch, MessageSquare, CalendarDays, DollarSign, Bot, Zap,
  StickyNote, Tag, UserPlus, Clock, TrendingUp, Activity,
  ChevronDown, ChevronUp, ExternalLink, AlertCircle,
  Send, Inbox, FileText, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useJornadaPaciente, EventoTipo, JornadaEvento, AutorEvento } from "@/hooks/useJornadaPaciente";

// ── Config visual por tipo de evento ────────────────────────

const EVENTO_CONFIG: Record<EventoTipo, {
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
  borderColor: string;
  label: string;
}> = {
  entrada:     { icon: UserPlus,      bgColor: "bg-emerald-50",  iconColor: "text-emerald-600", borderColor: "border-emerald-200/60", label: "Entrada" },
  mensagem:    { icon: MessageSquare, bgColor: "bg-blue-50",     iconColor: "text-blue-600",    borderColor: "border-blue-200/60",   label: "Mensagens" },
  agendamento: { icon: CalendarDays,  bgColor: "bg-purple-50",   iconColor: "text-purple-600",  borderColor: "border-purple-200/60", label: "Agendamentos" },
  venda:       { icon: DollarSign,    bgColor: "bg-emerald-50",  iconColor: "text-emerald-600", borderColor: "border-emerald-200/60", label: "Vendas" },
  etapa:       { icon: GitBranch,     bgColor: "bg-amber-50",    iconColor: "text-amber-600",   borderColor: "border-amber-200/60",  label: "Etapas" },
  scoring:     { icon: Star,          bgColor: "bg-orange-50",   iconColor: "text-orange-600",  borderColor: "border-orange-200/60", label: "Qualificacao" },
  tag:         { icon: Tag,           bgColor: "bg-slate-100",   iconColor: "text-slate-600",   borderColor: "border-slate-200/60",  label: "Tags" },
  nota:        { icon: StickyNote,    bgColor: "bg-sky-50",      iconColor: "text-sky-600",     borderColor: "border-sky-200/60",    label: "Notas" },
  ia:          { icon: Bot,           bgColor: "bg-violet-50",   iconColor: "text-violet-600",  borderColor: "border-violet-200/60", label: "IA" },
  cadencia:    { icon: Zap,           bgColor: "bg-teal-50",     iconColor: "text-teal-600",    borderColor: "border-teal-200/60",   label: "Cadencias" },
  responsavel: { icon: UserCog,       bgColor: "bg-indigo-50",   iconColor: "text-indigo-600",  borderColor: "border-indigo-200/60", label: "Responsável" },
};

const SCORING_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  A: { label: "Lead dos Sonhos", bg: "bg-emerald-50 border-emerald-200/60", text: "text-emerald-700" },
  B: { label: "Qualificado com Ressalva", bg: "bg-blue-50 border-blue-200/60", text: "text-blue-700" },
  C: { label: "Em Desenvolvimento", bg: "bg-amber-50 border-amber-200/60", text: "text-amber-700" },
  D: { label: "Fora do ICP", bg: "bg-red-50 border-red-200/60", text: "text-red-700" },
};

const ALL_TIPOS: EventoTipo[] = ["entrada","mensagem","agendamento","venda","etapa","scoring","tag","nota","ia","cadencia","responsavel"];
const MACRO_TIPOS: EventoTipo[] = ["entrada", "etapa", "scoring", "agendamento", "venda"];

// ── Helpers ──────────────────────────────────────────────────

function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, "").replace(/^55/, "");
  if (cleaned.length === 11) return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
  if (cleaned.length === 10) return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
  return phone;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatEventDate(iso: string) {
  try {
    return format(parseISO(iso), "HH:mm:ss", { locale: ptBR });
  } catch { return "" }
}

// Retorna a data local (yyyy-MM-dd) de um ISO string, respeitando o fuso do browser
function toLocalDateKey(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch { return iso.slice(0, 10) }
}

function formatDayHeader(localDateKey: string) {
  try {
    // Compara só a data (yyyy-MM-dd) sem dependência de horário
    const hoje = format(new Date(), "yyyy-MM-dd");
    const ontem = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
    if (localDateKey === hoje) return "Hoje";
    if (localDateKey === ontem) return "Ontem";
    return format(parseISO(localDateKey + "T12:00:00"), "dd 'de' MMMM, yyyy", { locale: ptBR });
  } catch { return localDateKey }
}

function groupByDay(eventos: JornadaEvento[]): { dia: string; eventos: JornadaEvento[] }[] {
  const map = new Map<string, JornadaEvento[]>();
  for (const e of eventos) {
    // Usa fuso local para agrupar — evita que eventos de 21h BRT apareçam no dia UTC seguinte
    const dia = toLocalDateKey(e.data);
    if (!map.has(dia)) map.set(dia, []);
    map.get(dia)!.push(e);
  }
  // Garante ordem cronológica dos grupos de dia
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, evs]) => ({ dia, eventos: evs }));
}

// ── MacroTimelineStrip ───────────────────────────────────────

function MacroTimelineStrip({ eventos }: { eventos: JornadaEvento[] }) {
  // Filtrar marcos macro, deduplicando: se há transição real para uma etapa,
  // não mostrar o evento de handoff separado (evita "Handoff" duplicado)
  // Todos os eventos de tipo macro — handoff agora vem integrado na etapa de pipeline
  const milestones = eventos.filter(e => MACRO_TIPOS.includes(e.tipo));
  if (milestones.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Visão Geral da Jornada</p>
          </div>
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">{milestones.length} marcos</span>
        </div>
      </div>
      <div className="px-5 py-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-start gap-0 min-w-max">
          {milestones.map((m, i) => {
            const cfg = EVENTO_CONFIG[m.tipo];
            const Icon = cfg.icon;
            const isLast = i === milestones.length - 1;

            const label =
              m.tipo === 'etapa'       ? (m.metadata?.etapa_nome || 'Etapa') :
              m.tipo === 'scoring'     ? `Score ${m.metadata?.scoring || ''}` :
              m.tipo === 'venda'       ? formatCurrency(m.metadata?.valor || 0) :
              m.tipo === 'entrada'     ? 'Entrou' :
              m.tipo === 'agendamento' ? (m.metadata?.procedimento || m.titulo.replace('Agendamento criado', 'Agendamento').slice(0, 16)) :
              m.titulo.slice(0, 14);

            const dotBg =
              m.tipo === 'venda'   ? "bg-emerald-100 border-emerald-300" :
              m.tipo === 'entrada' ? "bg-emerald-100 border-emerald-300" :
              cn(cfg.bgColor, cfg.borderColor.replace('/60', ''));

            return (
              <div key={m.id} className="flex items-start gap-0">
                <div className="flex flex-col items-center gap-1.5 px-2" style={{ minWidth: 76, maxWidth: 84 }}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0", dotBg)}>
                    <Icon className={cn("h-4 w-4", cfg.iconColor)} />
                  </div>
                  <p className="text-[9px] font-semibold text-foreground/70 text-center leading-tight line-clamp-2 w-full px-0.5">
                    {label}
                  </p>
                  <p className="text-[8px] text-muted-foreground/40 tabular-nums whitespace-nowrap font-mono">
                    {(() => { try { return format(parseISO(m.data), "dd/MM", { locale: ptBR }); } catch { return '' } })()}
                    <br />
                    {(() => { try { return format(parseISO(m.data), "HH:mm", { locale: ptBR }); } catch { return '' } })()}
                  </p>
                </div>
                {!isLast && (
                  <div className="flex items-center mt-[18px] shrink-0">
                    <div className="h-[1.5px] w-5 bg-border/50" />
                    <ArrowRight className="h-3 w-3 text-border/60 -ml-0.5 shrink-0" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── AutorBadge ───────────────────────────────────────────────

function AutorBadge({ autor }: { autor: AutorEvento }) {
  const initials = autor.nome.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border/60">
        {autor.url_avatar
          ? <img src={autor.url_avatar} className="h-full w-full object-cover" />
          : <span className="text-[8px] font-bold text-muted-foreground">{initials}</span>
        }
      </div>
      <span className="text-[10px] text-muted-foreground/60 font-medium">{autor.nome}</span>
    </div>
  );
}

// ── EventoCard ───────────────────────────────────────────────

const STATUS_AG_STYLE: Record<string, string> = {
  realizado:      "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  confirmado:     "bg-blue-50 text-blue-700 border-blue-200/60",
  agendado:       "bg-sky-50 text-sky-700 border-sky-200/60",
  cancelado:      "bg-red-50 text-red-700 border-red-200/60",
  nao_compareceu: "bg-red-50 text-red-700 border-red-200/60",
};
const STATUS_AG_LABEL: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", realizado: "Realizado",
  cancelado: "Cancelado", nao_compareceu: "Nao compareceu",
};
const SCORING_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: "bg-emerald-50 border-emerald-200/60", text: "text-emerald-700", label: "Lead dos Sonhos" },
  B: { bg: "bg-blue-50 border-blue-200/60",       text: "text-blue-700",    label: "Qualificado com Ressalva" },
  C: { bg: "bg-amber-50 border-amber-200/60",     text: "text-amber-700",   label: "Em Desenvolvimento" },
  D: { bg: "bg-red-50 border-red-200/60",         text: "text-red-700",     label: "Fora do ICP" },
};

function EventoCard({ evento, isLast }: { evento: JornadaEvento; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENTO_CONFIG[evento.tipo];
  const Icon = cfg.icon;

  const isHandoff     = evento.metadata?.subtipo === 'handoff';
  const hasLongDesc   = (evento.descricao?.length ?? 0) > 100;
  const showDesc      = expanded ? evento.descricao : evento.descricao?.slice(0, 100);

  // Handoff recebe borda e fundo destacados
  const cardBorder = isHandoff
    ? "border-violet-300/80 bg-violet-50/40"
    : cn("border bg-card", cfg.borderColor);

  return (
    <div className="flex gap-4">
      {/* Conector vertical + ícone */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center border shrink-0",
          isHandoff ? "bg-violet-100 border-violet-300" : cn(cfg.bgColor, cfg.borderColor)
        )}>
          <Icon className={cn("h-3.5 w-3.5", isHandoff ? "text-violet-700" : cfg.iconColor)} />
        </div>
        {!isLast && <div className="w-[2px] flex-1 bg-border/40 mt-1 min-h-[20px]" />}
      </div>

      {/* Card */}
      <div className={cn("flex-1 min-w-0", isLast ? "pb-0" : "pb-4")}>
        <div className={cn(
          "rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors",
          cardBorder
        )}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className={cn(
              "text-[13px] font-semibold leading-snug min-w-0",
              isHandoff ? "text-violet-800" : "text-foreground"
            )}>
              {evento.titulo}
            </p>
            <span className="text-[10px] tabular-nums text-muted-foreground/50 shrink-0 mt-0.5 font-mono">
              {formatEventDate(evento.data)}
            </span>
          </div>

          {/* ── Autor ── */}
          {evento.autor && <AutorBadge autor={evento.autor} />}

          {/* ── Venda ── */}
          {evento.tipo === 'venda' && evento.metadata?.valor && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[15px] font-extrabold text-emerald-600 tabular-nums font-display">
                {formatCurrency(evento.metadata.valor)}
              </span>
              {evento.metadata.pagamento && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                  {evento.metadata.pagamento}
                </span>
              )}
              {evento.metadata.produto && (
                <span className="text-[11px] text-muted-foreground/70 truncate">{evento.metadata.produto}</span>
              )}
            </div>
          )}

          {/* ── Mensagem: Primeiro contato ── */}
          {evento.tipo === 'mensagem' && evento.metadata?.subtipo === 'primeiro_contato' && (
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-700">
                <Inbox className="h-2.5 w-2.5" /> Primeiro contato
              </span>
            </div>
          )}

          {/* ── Mensagem: Humano assumiu ── */}
          {evento.tipo === 'mensagem' && evento.metadata?.subtipo === 'humano_assumiu' && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/60 text-blue-700">
                <UserRound className="h-2.5 w-2.5" /> Humano
              </span>
              {evento.metadata.tempo_apos_handoff_min !== undefined && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                  evento.metadata.tempo_apos_handoff_min <= 5
                    ? "bg-emerald-50 border-emerald-200/60 text-emerald-700"
                    : evento.metadata.tempo_apos_handoff_min <= 30
                    ? "bg-amber-50 border-amber-200/60 text-amber-700"
                    : "bg-red-50 border-red-200/60 text-red-700"
                )}>
                  <Clock className="h-2.5 w-2.5" />
                  {evento.metadata.tempo_apos_handoff_min < 1 ? '< 1 min' : `${evento.metadata.tempo_apos_handoff_min} min apos handoff`}
                </span>
              )}
            </div>
          )}

          {/* ── Mensagem: Primeira resposta com tempo + quem respondeu ── */}
          {evento.tipo === 'mensagem' && evento.metadata?.subtipo === 'primeira_resposta' && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {evento.metadata.atendente && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                  evento.metadata.atendente === 'ia'
                    ? "bg-violet-50 border-violet-200/60 text-violet-700"
                    : "bg-blue-50 border-blue-200/60 text-blue-700"
                )}>
                  {evento.metadata.atendente === 'ia' ? <Bot className="h-2.5 w-2.5" /> : <UserRound className="h-2.5 w-2.5" />}
                  {evento.metadata.atendente === 'ia' ? 'IA' : 'Humano'}
                </span>
              )}
              {evento.metadata.tempo_resposta_min !== undefined && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                  evento.metadata.tempo_resposta_min <= 5
                    ? "bg-emerald-50 border-emerald-200/60 text-emerald-700"
                    : evento.metadata.tempo_resposta_min <= 30
                    ? "bg-amber-50 border-amber-200/60 text-amber-700"
                    : "bg-red-50 border-red-200/60 text-red-700"
                )}>
                  <Clock className="h-2.5 w-2.5" />
                  {evento.metadata.tempo_resposta_min < 1 ? '< 1 min' : `${evento.metadata.tempo_resposta_min} min`}
                </span>
              )}
            </div>
          )}

          {/* ── Mensagem: fallback sem subtipo ── */}
          {evento.tipo === 'mensagem' && evento.metadata && !evento.metadata.subtipo && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {evento.metadata.entrada !== undefined && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/60 text-blue-700">
                  <Inbox className="h-2.5 w-2.5" /> {evento.metadata.entrada} recebidas
                </span>
              )}
              {evento.metadata.saida !== undefined && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 text-muted-foreground">
                  <Send className="h-2.5 w-2.5" /> {evento.metadata.saida} enviadas
                </span>
              )}
            </div>
          )}

          {/* ── Etapa ── */}
          {evento.tipo === 'etapa' && evento.metadata?.etapa_nome && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {evento.metadata.from_stage_nome && (
                <>
                  <div className="flex items-center gap-1">
                    {evento.metadata.from_stage_cor && (
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: evento.metadata.from_stage_cor }} />
                    )}
                    <span className="text-[11px] text-muted-foreground/50">{evento.metadata.from_stage_nome}</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                </>
              )}
              <div className="flex items-center gap-1">
                {evento.metadata.etapa_cor && (
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: evento.metadata.etapa_cor }} />
                )}
                <span className="text-[12px] font-semibold text-foreground">{evento.metadata.etapa_nome}</span>
              </div>
              {evento.metadata?.inferido === true && (
                <span className="text-[9px] text-muted-foreground/40 italic ml-1">(estimado)</span>
              )}
            </div>
          )}

          {/* ── Agendamento ── */}
          {evento.tipo === 'agendamento' && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {evento.metadata?.data_hora && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <CalendarDays className="h-3 w-3 text-purple-500" />
                  {(() => {
                    try {
                      return format(parseISO(evento.metadata.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                    } catch { return evento.metadata.data_hora }
                  })()}
                </span>
              )}
              {evento.metadata?.status && (
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                  STATUS_AG_STYLE[evento.metadata.status] || "bg-muted text-muted-foreground border-border/40"
                )}>
                  {STATUS_AG_LABEL[evento.metadata.status] || evento.metadata.status}
                </span>
              )}
              {evento.metadata?.valor_orcado && (
                <span className="text-[10px] font-medium text-muted-foreground">
                  Orçado: {formatCurrency(evento.metadata.valor_orcado)}
                </span>
              )}
            </div>
          )}

          {/* ── Scoring ── */}
          {evento.tipo === 'scoring' && evento.metadata?.scoring && (
            <div className="mt-1">
              {(() => {
                const s = SCORING_BADGE[evento.metadata.scoring];
                return s ? (
                  <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border", s.bg, s.text)}>
                    <Star className="h-3 w-3" />
                    {evento.metadata.scoring} — {s.label}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {/* ── Tag ── */}
          {evento.tipo === 'tag' && evento.metadata?.tag_name && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: evento.metadata.tag_color || '#888' }} />
              <span className="text-[12px] font-semibold text-foreground">{evento.metadata.tag_name}</span>
            </div>
          )}

          {/* ── Handoff IA → Humano ── */}
          {isHandoff && evento.descricao && (
            <div className="mt-1.5 text-[11px] text-violet-700/80 font-medium leading-relaxed">
              {evento.descricao}
            </div>
          )}

          {/* ── Descrição genérica (exceto os tipos que já têm visual próprio acima) ── */}
          {evento.descricao && !['venda','etapa','scoring','tag'].includes(evento.tipo) && !isHandoff && (
            <div className="mt-1.5">
              <p className="text-[12px] text-muted-foreground/80 leading-relaxed italic">
                {showDesc}{hasLongDesc && !expanded && "..."}
              </p>
              {hasLongDesc && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground mt-0.5 transition-colors"
                >
                  {expanded
                    ? <><ChevronUp className="h-3 w-3" /> Ver menos</>
                    : <><ChevronDown className="h-3 w-3" /> Ver mais</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function JornadaPaciente() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useJornadaPaciente(leadId);

  const [filtrosTipos, setFiltrosTipos] = useState<EventoTipo[]>([]);

  const eventosFiltrados = useMemo(() => {
    if (!data) return [];
    if (filtrosTipos.length === 0) return data.eventos;
    return data.eventos.filter(e => filtrosTipos.includes(e.tipo));
  }, [data, filtrosTipos]);

  const diasAgrupados = useMemo(() => groupByDay(eventosFiltrados), [eventosFiltrados]);

  const toggleFiltro = (tipo: EventoTipo) => {
    setFiltrosTipos(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <Skeleton className="h-16 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Paciente nao encontrado</p>
        <Button
          variant="ghost"
          className="mt-4 h-9 text-xs"
          onClick={() => navigate("/crm/leads")}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Voltar para Leads
        </Button>
      </div>
    );
  }

  const { lead, stats } = data;
  const scoring = lead.lead_scoring ? SCORING_CONFIG[lead.lead_scoring] : null;
  const initials = (lead.nome || lead.telefone || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const tiposPresentes = new Set(data.eventos.map(e => e.tipo));

  return (
    <div className="space-y-5 pb-10">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-muted shrink-0">
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground font-display truncate">
              Jornada de {lead.nome || formatPhone(lead.telefone)}
            </h1>
            <p className="text-[12px] text-muted-foreground">
              {stats.diasNoCRM === 0 ? "Entrou hoje" : `${stats.diasNoCRM} dia${stats.diasNoCRM !== 1 ? "s" : ""} no CRM`}
              {" · "}
              {data.eventos.length} evento{data.eventos.length !== 1 ? "s" : ""} registrado{data.eventos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

        {/* ══ LEFT: PATIENT CARD ══ */}
        <div className="space-y-3 lg:sticky lg:top-20">

          {/* Patient Identity */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Paciente</p>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center shrink-0 border border-border/40">
                  <span className="text-[15px] font-bold text-muted-foreground">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-foreground truncate">
                    {lead.nome || "Sem nome"}
                  </p>
                  <p className="text-[12px] text-muted-foreground/60 tabular-nums">
                    {formatPhone(lead.telefone)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {lead.email && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                {lead.origem && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span>{lead.origem}{lead.fonte ? ` · ${lead.fonte}` : ""}</span>
                  </div>
                )}
                {lead.procedimento_interesse && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Stethoscope className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span className="truncate">{lead.procedimento_interesse}</span>
                  </div>
                )}
              </div>

              {(lead.queixa_principal || lead.resumo) && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-2.5">
                  {lead.queixa_principal && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-0.5">Queixa principal</p>
                      <p className="text-[12px] text-foreground/80 leading-relaxed">{lead.queixa_principal}</p>
                    </div>
                  )}
                  {lead.resumo && (
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <FileText className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Resumo</p>
                      </div>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{lead.resumo}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Status badges */}
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-border/40">
                {stats.etapaAtual && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-muted/60 border border-border/40 text-muted-foreground">
                    {stats.etapaAtualCor && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stats.etapaAtualCor }} />
                    )}
                    {stats.etapaAtual}
                  </span>
                )}
                {scoring && (
                  <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border", scoring.bg, scoring.text)}>
                    <Star className="h-2.5 w-2.5" />
                    {lead.lead_scoring} · {scoring.label}
                  </span>
                )}
                {lead.is_closed && (
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-700">
                    Fechado
                  </span>
                )}
                {lead.ia_ativa && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200/60 text-violet-700">
                    <Bot className="h-2.5 w-2.5" /> IA ativa
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Resumo da Jornada</p>
              </div>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {[
                { label: "Mensagens", value: stats.totalMensagens, icon: MessageSquare, sub: `${stats.mensagensRecebidas} rec · ${stats.mensagensEnviadas} env` },
                { label: "Agendamentos", value: stats.totalAgendamentos, icon: CalendarDays },
                { label: "Vendas", value: stats.totalVendas, icon: DollarSign },
                {
                  label: "Faturamento",
                  value: stats.totalFaturamento > 0 ? formatCurrency(stats.totalFaturamento) : "—",
                  icon: TrendingUp,
                  accent: stats.totalFaturamento > 0,
                },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
                  <div className="flex items-center gap-1 mb-1">
                    <s.icon className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {s.label}
                    </span>
                  </div>
                  <p className={cn("text-[15px] font-extrabold tabular-nums font-display", s.accent ? "text-emerald-600" : "text-foreground")}>
                    {s.value}
                  </p>
                  {s.sub && <p className="text-[9px] text-muted-foreground/50 mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>

            <div className="px-5 pb-4 pt-1 space-y-2">
              {stats.tempoRespostaMin !== undefined && (
                <div className={cn(
                  "flex items-center gap-2 text-[11px] font-semibold rounded-xl px-3 py-2 border",
                  stats.tempoRespostaMin <= 5
                    ? "bg-emerald-50/60 border-emerald-200/40 text-emerald-700"
                    : stats.tempoRespostaMin <= 30
                    ? "bg-amber-50/60 border-amber-200/40 text-amber-700"
                    : "bg-red-50/60 border-red-200/40 text-red-700"
                )}>
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Tempo de resposta: {stats.tempoRespostaMin < 1 ? '< 1 min' : `${stats.tempoRespostaMin} min`}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 bg-muted/30 rounded-xl px-3 py-2 border border-border/40">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {stats.diasNoCRM === 0
                    ? "Entrou no CRM hoje"
                    : `No CRM ha ${stats.diasNoCRM} dia${stats.diasNoCRM !== 1 ? "s" : ""}`
                  }
                  {stats.totalSessoes > 0 && ` · ${stats.totalSessoes} sessã${stats.totalSessoes !== 1 ? 'ões' : 'o'}`}
                </span>
              </div>
            </div>
          </div>

          {/* Tags do lead */}
          {(lead.leads_tags?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tags</p>
                </div>
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-1.5">
                {lead.leads_tags?.map(lt => (
                  <span
                    key={lt.tags.name}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border/40 text-foreground bg-muted/30"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: lt.tags.color || '#888' }}
                    />
                    {lt.tags.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Acoes */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 rounded-xl text-xs border-border/60 gap-1.5"
              onClick={() => navigate(`/crm/conversas/${leadId}`)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Abrir Conversa
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 rounded-xl text-xs border-border/60 gap-1.5"
              onClick={() => navigate("/crm/leads")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver no Pipeline
            </Button>
          </div>
        </div>

        {/* ══ RIGHT: TIMELINE ══ */}
        <div className="space-y-4">

          {/* Macro Journey Overview */}
          <MacroTimelineStrip eventos={data.eventos} />

          {/* Filtros de tipo */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Filtrar por tipo
              </span>
              {filtrosTipos.length > 0 && (
                <button
                  onClick={() => setFiltrosTipos([])}
                  className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors underline"
                >
                  limpar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TIPOS.filter(t => tiposPresentes.has(t)).map(tipo => {
                const cfg = EVENTO_CONFIG[tipo];
                const Icon = cfg.icon;
                const ativo = filtrosTipos.includes(tipo);
                return (
                  <button
                    key={tipo}
                    onClick={() => toggleFiltro(tipo)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all",
                      ativo
                        ? cn(cfg.bgColor, cfg.borderColor, cfg.iconColor)
                        : "bg-muted/30 border-border/40 text-muted-foreground/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeline */}
          {eventosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-border/60 bg-card">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <Activity className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {filtrosTipos.length > 0 ? "Nenhum evento neste filtro" : "Nenhum evento registrado"}
              </p>
              {filtrosTipos.length > 0 && (
                <button
                  onClick={() => setFiltrosTipos([])}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground mt-1 transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Timeline</p>
                  </div>
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                    {eventosFiltrados.length}
                  </span>
                </div>
              </div>

              <div className="px-5 py-5 space-y-0">
                {diasAgrupados.map(({ dia, eventos: evsDia }) => (
                  <div key={dia}>
                    {/* Day divider */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-[1px] w-4 bg-border/40" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">
                        {formatDayHeader(dia)}
                      </span>
                      <div className="h-[1px] flex-1 bg-border/40" />
                    </div>

                    {/* Events for this day */}
                    <div className="space-y-0">
                      {evsDia.map((evento, idx) => (
                        <EventoCard
                          key={evento.id}
                          evento={evento}
                          isLast={idx === evsDia.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
