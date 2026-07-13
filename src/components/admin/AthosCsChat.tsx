// Chat do Athos CS — especialista de Customer Success (Admin OS).
// Modo geral (base), cliente (client_org_id) ou jornada em foco (jornada_id).
// Consome o stream SSE da edge function cs-athos. Segue a MESMA sistemática do
// Athos GS: streaming token-a-token, cards de tool, tempo de pensamento, botão
// de parar, barra de uso, card de erro com retry e botão "+" de atalhos.
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import {
  Sparkles, Send, Loader2, Plus, MessageSquare, User, TrendingDown, AlertTriangle,
  Target, History, Route, Pencil, ChevronDown, Square, RefreshCw, AlertCircle,
  CheckCircle2, Zap, Clock, ArrowDownToLine, ArrowUpFromLine,
  Users, Activity, DollarSign, Calendar, BarChart3, TrendingUp, BookOpen, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LLM_MODELS, CUSTOM_MODEL_SENTINEL, DEFAULT_LLM_MODEL, MODEL_CONTEXT } from '@/lib/llmModels';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCsAthosConversations, loadCsAthosMessages, useInvalidateCsAthos } from '@/hooks/useCsAthos';

interface ToolCallUI { tool: string; status: 'running' | 'done'; }
interface UsageInfo { inputTokens: number; outputTokens: number; totalTimeMs: number; toolCallsCount: number; model: string; }
interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCallUI[];
  usage?: UsageInfo;
  streaming?: boolean;
  errorMessage?: string;
  retryText?: string;
}

const TOOL_CONFIG: Record<string, { label: string; Icon: React.ComponentType<any> }> = {
  listar_clientes:        { label: 'Analisando a base',      Icon: Users },
  clientes_em_risco:      { label: 'Clientes em risco',      Icon: AlertTriangle },
  raio_x_cliente:         { label: 'Raio-x do CRM',          Icon: Activity },
  leads_para_acao:        { label: 'Leads para ação',        Icon: Target },
  vendas_recentes:        { label: 'Vendas recentes',        Icon: DollarSign },
  agenda_cliente:         { label: 'Agenda do cliente',      Icon: Calendar },
  dados_crm_cliente:      { label: 'Histórico do CRM',       Icon: BarChart3 },
  saude_e_tendencia:      { label: 'Saúde e tendência',      Icon: TrendingUp },
  metricas_periodo:       { label: 'Métricas do período',    Icon: BarChart3 },
  touchpoints_cliente:    { label: 'Touchpoints',            Icon: MessageSquare },
  jornada_e_materiais:    { label: 'Jornada e materiais',    Icon: Route },
  consultar_documentacao: { label: 'Metodologia de CS',      Icon: BookOpen },
  ver_jornadas_cliente:   { label: 'Lendo a jornada',        Icon: Route },
  salvar_jornada:         { label: 'Editando a jornada',     Icon: Pencil },
  excluir_jornada:        { label: 'Removendo a jornada',    Icon: Trash2 },
};

function friendlyErr(m?: string): string {
  return /provider|tool|\b400\b|model|function/i.test(m || '')
    ? 'Não consegui responder agora. Tente de novo — se persistir, troque o modelo no seletor.'
    : (m || 'Erro ao responder.');
}

// Renderização leve de markdown, agrupando linhas em parágrafos e listas.
function renderText(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const bulletLi = (s: string) =>
    `<li class="relative pl-3.5 before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1 before:h-1 before:rounded-full before:bg-foreground/40">${s}</li>`;

  const lines = text.trim().replace(/\n{3,}/g, '\n\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p class="mb-2">${para.map(inline).join('<br/>')}</p>`); para = []; } };
  const flushBullets = () => { if (bullets.length) { out.push(`<ul class="space-y-1 mb-2">${bullets.map(b => bulletLi(inline(b))).join('')}</ul>`); bullets = []; } };

  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flushPara(); continue; }
    if (/^[-•]\s+/.test(l)) { flushPara(); bullets.push(l.replace(/^[-•]\s+/, '')); continue; }
    if (/^#{1,3}\s+/.test(l)) { flushPara(); flushBullets(); out.push(`<p class="font-semibold text-foreground mt-2 mb-1">${inline(l.replace(/^#{1,3}\s+/, ''))}</p>`); continue; }
    flushBullets(); para.push(l);
  }
  flushPara(); flushBullets();
  return out.join('');
}

// ── Card de tool (pílula com ícone + status) ─────────────────────────────────
function ToolCard({ call }: { call: ToolCallUI }) {
  const cfg = TOOL_CONFIG[call.tool];
  const Icon = cfg?.Icon ?? Zap;
  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all',
      call.status === 'running' ? 'bg-muted/50 border-border/50 text-muted-foreground' : 'bg-muted/20 border-border/30 text-muted-foreground/60'
    )}>
      {call.status === 'running'
        ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        : <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />}
      <Icon className="h-3 w-3 shrink-0" />
      <span>{cfg?.label ?? call.tool}</span>
    </div>
  );
}

// ── Barra de uso (tokens / tempo / tools / contexto) ─────────────────────────
function UsageBar({ usage }: { usage: UsageInfo }) {
  const ctx = MODEL_CONTEXT[usage.model];
  const ctxPct = ctx ? Math.min(Math.round((usage.inputTokens / ctx) * 100), 100) : null;
  const fmtN = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
  const timeStr = usage.totalTimeMs < 1_000 ? `${usage.totalTimeMs}ms`
    : usage.totalTimeMs < 60_000 ? `${(usage.totalTimeMs / 1_000).toFixed(1)}s`
    : `${Math.floor(usage.totalTimeMs / 60_000)}m${Math.round((usage.totalTimeMs % 60_000) / 1_000)}s`;
  const ctxLabel = ctx ? (ctx >= 1_000_000 ? `${ctx / 1_000_000}M` : `${ctx / 1_000}k`) : null;
  const barColor = ctxPct !== null && ctxPct > 90 ? 'bg-red-400/40' : ctxPct !== null && ctxPct > 70 ? 'bg-amber-400/40' : 'bg-muted-foreground/20';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-border/15 select-none">
      <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums text-muted-foreground/40" title="Tokens de entrada (contexto enviado ao modelo)">
        <ArrowDownToLine className="h-2.5 w-2.5 shrink-0" /><span>{fmtN(usage.inputTokens)}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums text-muted-foreground/40" title="Tokens gerados pelo modelo">
        <ArrowUpFromLine className="h-2.5 w-2.5 shrink-0" /><span>{fmtN(usage.outputTokens)}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40" title="Tempo total de processamento">
        <Clock className="h-2.5 w-2.5 shrink-0" /><span>{timeStr}</span>
      </div>
      {usage.toolCallsCount > 0 && (
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40" title="Ferramentas executadas">
          <Zap className="h-2.5 w-2.5 shrink-0" /><span>{usage.toolCallsCount} tool{usage.toolCallsCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      {ctxPct !== null && ctxLabel && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40" title={`Janela de contexto: ${fmtN(usage.inputTokens)} / ${ctxLabel} tokens`}>
          <div className="w-14 h-[3px] bg-muted/50 rounded-full overflow-hidden shrink-0">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${ctxPct}%` }} />
          </div>
          <span className="tabular-nums">{ctxPct}%</span><span className="text-muted-foreground/25">/ {ctxLabel}</span>
        </div>
      )}
      {usage.model && (
        <div className="ml-auto text-[9px] font-mono text-muted-foreground/25 truncate max-w-[150px]" title={usage.model}>
          {usage.model.split('/').pop()}
        </div>
      )}
    </div>
  );
}

// ── Linha da resposta do Athos ───────────────────────────────────────────────
function AssistantRow({ msg, onRetry }: { msg: ChatMsg; onRetry: (t: string) => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!msg.streaming) { setElapsed(0); return; }
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [msg.streaming]);
  const toolsDone = !msg.tool_calls || msg.tool_calls.every(t => t.status === 'done');

  return (
    <div className="flex gap-3">
      <span className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-background" />
      </span>
      <div className="flex-1 min-w-0 space-y-2">
        {msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.tool_calls.map((t, i) => <ToolCard key={`${t.tool}-${i}`} call={t} />)}
          </div>
        )}

        {msg.content ? (
          <div className="text-[13px] leading-relaxed text-foreground/90 [&_strong]:font-semibold [&_strong]:text-foreground [&>*:last-child]:mb-0 [&>*:first-child]:mt-0">
            <span dangerouslySetInnerHTML={{ __html: renderText(msg.content) }} />
            {msg.streaming && <span className="inline-block w-[3px] h-4 bg-foreground/30 rounded-sm ml-0.5 animate-pulse align-middle" />}
          </div>
        ) : msg.errorMessage ? (
          <div className="flex flex-col gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-[13px] text-destructive">{msg.errorMessage}</span>
            </div>
            {msg.retryText && (
              <button onClick={() => onRetry(msg.retryText!)}
                className="flex items-center gap-1.5 self-start rounded-md bg-destructive/15 hover:bg-destructive/25 border border-destructive/20 px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors">
                <RefreshCw className="h-3 w-3" /> Tentar novamente
              </button>
            )}
          </div>
        ) : msg.streaming && toolsDone ? (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
            <span>Pensando…</span>
            {elapsed > 0 && <span className="text-[11px] text-muted-foreground/50 tabular-nums">{elapsed}s</span>}
          </div>
        ) : null}

        {!msg.streaming && msg.usage && <UsageBar usage={msg.usage} />}
      </div>
    </div>
  );
}

const SUGESTOES_GERAL = [
  { icon: AlertTriangle, label: 'Quais clientes estão em risco hoje?', q: 'Quais clientes estão em risco de resultado hoje e por quê? Priorize e diga o que fazer com cada um.' },
  { icon: TrendingDown, label: 'Onde estão os maiores gaps na base?', q: 'Analise a base inteira e me diga onde estão os maiores gaps e oportunidades de CS agora.' },
  { icon: Sparkles, label: 'Meu plano de ação do dia', q: 'Monte meu plano de ação de CS para hoje: quem contatar primeiro, com qual objetivo, e qual playbook usar.' },
];
const SUGESTOES_CLIENTE = [
  { icon: Sparkles, label: 'O que faço agora com este cliente?', q: 'O que eu devo fazer agora com este cliente? Me dê a próxima ação concreta.' },
  { icon: TrendingDown, label: 'Diagnóstico completo', q: 'Faça um diagnóstico completo deste cliente: saúde, resultado no CRM, tendência, gaps e riscos.' },
  { icon: Target, label: 'Como faço ele crescer?', q: 'Com base nos dados dele, qual a maior alavanca para este cliente crescer o faturamento?' },
];
const SUGESTOES_JORNADA = [
  { icon: Sparkles, label: 'Montar a jornada deste mês', q: 'Analise o CRM deste cliente e monte a jornada mensal de consultoria dele para este mês, atacando o maior gargalo. Salve como rascunho para eu revisar.' },
  { icon: Route, label: 'Ver a jornada atual', q: 'Me mostre a jornada atual deste cliente: estágios, tarefas e o progresso.' },
  { icon: Pencil, label: 'Ajustar a jornada atual', q: 'Quero ajustar a jornada atual deste cliente. Primeiro me mostre como ela está para eu te dizer o que mudar.' },
];
const SUGESTOES_JORNADA_FOCO = [
  { icon: Sparkles, label: 'Analise esta jornada e sugira melhorias', q: 'Analise esta jornada bloco a bloco com base nos dados do CRM e me diga onde ela está fraca e o que melhorar. Seja específico.' },
  { icon: Target, label: 'Onde essa jornada está desalinhada com os dados?', q: 'Cruze esta jornada com o maior gargalo do funil do cliente. As tarefas atacam o problema certo? O que falta ou sobra?' },
  { icon: Pencil, label: 'Reforce o follow-up e a reativação', q: 'Deixe esta jornada mais forte em follow-up e reativação da base parada. Ajuste as tarefas e salve.' },
];

export function AthosCsChat({ clientOrgId = null, clientName, variant = 'geral', onJornadaChanged, jornadaId = null }: {
  clientOrgId?: string | null;
  clientName?: string;
  variant?: 'geral' | 'jornada';
  onJornadaChanged?: () => void;
  jornadaId?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const convIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
    el.style.overflowY = el.scrollHeight > 128 ? 'auto' : 'hidden';
  };

  // Seletor de modelo (paridade com o Athos GS)
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('cs_athos_model') || DEFAULT_LLM_MODEL);
  const [customModel, setCustomModel] = useState(() => localStorage.getItem('cs_athos_custom_model') || '');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const [modelMenuPos, setModelMenuPos] = useState({ bottom: 0, right: 0 });
  const effectiveModel = selectedModel === CUSTOM_MODEL_SENTINEL ? (customModel.trim() || DEFAULT_LLM_MODEL) : selectedModel;
  const modelLabel = selectedModel === CUSTOM_MODEL_SENTINEL ? (customModel || 'Custom') : (LLM_MODELS.find(m => m.id === selectedModel)?.label ?? 'Modelo');
  const openModelMenu = () => {
    if (modelBtnRef.current) {
      const r = modelBtnRef.current.getBoundingClientRect();
      setModelMenuPos({ bottom: window.innerHeight - r.top + 8, right: window.innerWidth - r.right });
    }
    setModelMenuOpen(v => !v);
  };
  const handleModelChange = (id: string) => { setSelectedModel(id); localStorage.setItem('cs_athos_model', id); };
  const handleCustomModel = (v: string) => { setCustomModel(v); localStorage.setItem('cs_athos_custom_model', v); };

  const { data: conversas = [] } = useCsAthosConversations(clientOrgId);
  const invalidate = useInvalidateCsAthos();
  const sugestoes = jornadaId ? SUGESTOES_JORNADA_FOCO : variant === 'jornada' ? SUGESTOES_JORNADA : clientOrgId ? SUGESTOES_CLIENTE : SUGESTOES_GERAL;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Fecha o menu "+" ao clicar fora
  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => { if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [plusOpen]);

  // Aborta o stream ao desmontar
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const novaConversa = () => { convIdRef.current = null; setMessages([]); };
  const stopStreaming = () => { abortRef.current?.abort(); };

  const abrirConversa = async (id: string) => {
    try {
      const msgs = await loadCsAthosMessages(id);
      convIdRef.current = id;
      setMessages(msgs.map((m, i) => ({ id: `h${i}`, role: m.role, content: m.content })));
    } catch { /* ignore */ }
  };

  const enviar = useCallback(async (texto: string) => {
    const msg = texto.trim();
    if (!msg || streaming) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '22px';
    const history = messages.filter(m => !m.streaming && !m.errorMessage).slice(-10).map(m => ({ role: m.role, content: m.content }));
    const uId = `u${Date.now()}`;
    const aId = `a${Date.now()}`;
    setMessages(prev => [...prev, { id: uId, role: 'user', content: msg }, { id: aId, role: 'assistant', content: '', tool_calls: [], streaming: true }]);
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;
    const activeTools: ToolCallUI[] = [];
    let acc = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => { flushTimer = null; const snap = acc; setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: snap } : m)); };
    const schedule = () => { if (!flushTimer) flushTimer = setTimeout(flush, 60); };

    let inactTimer: ReturnType<typeof setTimeout> | null = null;
    const resetInact = () => { if (inactTimer) clearTimeout(inactTimer); inactTimer = setTimeout(() => abort.abort(), 30_000); };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cs-athos`, {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ message: msg, conversation_id: convIdRef.current, history, client_org_id: clientOrgId, jornada_id: jornadaId, model: effectiveModel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro' }));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      if (!res.body) throw new Error('Stream vazio');
      const reader = res.body.getReader();
      abort.signal.addEventListener('abort', () => reader.cancel().catch(() => {}), { once: true });
      const decoder = new TextDecoder();
      let buffer = '';
      resetInact();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let ev: any;
          try { ev = JSON.parse(raw); } catch { continue; }
          resetInact();
          if (ev.type === 'tool_start') {
            activeTools.push({ tool: ev.name, status: 'running' });
            const snap = [...activeTools];
            setMessages(prev => prev.map(m => m.id === aId ? { ...m, tool_calls: snap } : m));
          }
          if (ev.type === 'tool_result') {
            const rev = [...activeTools].reverse().findIndex(t => t.tool === ev.name && t.status === 'running');
            const ri = rev >= 0 ? activeTools.length - 1 - rev : -1;
            if (ri >= 0) activeTools[ri] = { ...activeTools[ri], status: 'done' };
            const snap = [...activeTools];
            setMessages(prev => prev.map(m => m.id === aId ? { ...m, tool_calls: snap } : m));
          }
          if (ev.type === 'text_delta') { acc += ev.delta; schedule(); }
          if (ev.type === 'text') { acc = ev.content; flush(); } // compat
          if (ev.type === 'jornada_changed') onJornadaChanged?.();
          if (ev.type === 'usage') {
            setMessages(prev => prev.map(m => m.id === aId ? {
              ...m,
              usage: {
                inputTokens: ev.input_tokens ?? 0, outputTokens: ev.output_tokens ?? 0,
                totalTimeMs: ev.total_time_ms ?? 0, toolCallsCount: ev.tool_calls_count ?? 0, model: ev.model ?? '',
              },
            } : m));
          }
          if (ev.type === 'done') {
            if (flushTimer) clearTimeout(flushTimer);
            flush();
            if (ev.conversation_id) convIdRef.current = ev.conversation_id;
            setMessages(prev => prev.map(m => m.id === aId ? { ...m, streaming: false } : m));
            invalidate();
          }
          if (ev.type === 'error') throw new Error(ev.message);
        }
      }
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      // stream terminou sem "done" (conexão caiu)
      setMessages(prev => prev.map(m => m.id === aId && m.streaming
        ? { ...m, streaming: false, ...(!acc && !abort.signal.aborted ? { errorMessage: 'Conexão perdida com o servidor. Tente novamente.', retryText: msg } : {}) }
        : m));
    } catch (e: any) {
      if (flushTimer) clearTimeout(flushTimer);
      const aborted = e?.name === 'AbortError' || abort.signal.aborted;
      if (aborted) {
        // parado pelo usuário: mantém o texto parcial; se vazio, remove a bolha
        setMessages(prev => acc
          ? prev.map(m => m.id === aId ? { ...m, streaming: false } : m)
          : prev.filter(m => m.id !== aId));
      } else {
        setMessages(prev => prev.map(m => m.id === aId
          ? { ...m, streaming: false, content: acc, ...(acc ? {} : { errorMessage: friendlyErr(e?.message), retryText: msg }) }
          : m));
      }
    } finally {
      if (inactTimer) clearTimeout(inactTimer);
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, clientOrgId, invalidate, onJornadaChanged, jornadaId, effectiveModel]);

  return (
    <div className="flex gap-4 h-[calc(100vh-230px)] min-h-[440px]">
      {/* Histórico de conversas (modo geral) */}
      {!clientOrgId && (
        <div className="hidden lg:flex flex-col w-56 flex-shrink-0 rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <Button onClick={novaConversa} className="w-full h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nova conversa
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-0.5">
            {conversas.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 text-center py-6">Nenhuma conversa ainda</p>
            ) : conversas.map(c => (
              <button key={c.id} onClick={() => abrirConversa(c.id)}
                className={cn('w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2 hover:bg-muted/60 transition-colors',
                  convIdRef.current === c.id && 'bg-muted/70')}>
                <MessageSquare className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                <span className="text-[11px] text-foreground/80 line-clamp-2 leading-snug">{c.titulo || 'Conversa'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-background" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground font-display leading-tight">Athos CS</p>
            <p className="text-[10px] text-muted-foreground/60 truncate">
              {jornadaId ? `Especialista desta jornada · ${clientName || 'cliente'}` : clientOrgId ? `Especialista de CS · foco em ${clientName || 'este cliente'}` : 'Especialista de CS · base inteira'}
            </p>
          </div>
          {clientOrgId && (
            <div className="ml-auto flex items-center gap-1.5">
              <Popover open={histOpen} onOpenChange={setHistOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 rounded-lg text-[10px] gap-1 border-border/60">
                    <History className="h-3 w-3" /> Histórico{conversas.length > 0 ? ` (${conversas.length})` : ''}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-1.5 max-h-72 overflow-auto">
                  {conversas.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/50 text-center py-4">Nenhuma conversa anterior com este cliente</p>
                  ) : conversas.map(c => (
                    <button key={c.id} onClick={() => { abrirConversa(c.id); setHistOpen(false); }}
                      className="w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2 hover:bg-muted/60 transition-colors">
                      <MessageSquare className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-foreground/80 line-clamp-1 leading-snug">{c.titulo || 'Conversa'}</p>
                        <p className="text-[9px] text-muted-foreground/40">{format(parseISO(c.updated_at), "d 'de' MMM, HH:mm", { locale: ptBR })}</p>
                      </div>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <Button onClick={novaConversa} variant="outline" size="sm" className="h-7 rounded-lg text-[10px] gap-1 border-border/60">
                <Plus className="h-3 w-3" /> Nova
              </Button>
            </div>
          )}
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-5 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
              <span className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-muted-foreground/50" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {jornadaId ? 'Especialista nesta jornada' : clientOrgId ? `Como posso ajudar com ${clientName || 'este cliente'}?` : 'Seu copiloto de Customer Success'}
              </p>
              <p className="text-[12px] text-muted-foreground/60 mt-1 mb-5">
                {jornadaId
                  ? 'Já conheço os blocos e tarefas desta jornada e os dados do CRM do cliente. Peça análises e ajustes que eu aplico direto na jornada.'
                  : 'Pergunte sobre a base, gaps, riscos e o que fazer com cada cliente. Puxo os dados reais do CRM e recomendo a próxima ação.'}
              </p>
              <div className="w-full space-y-2">
                {sugestoes.map(s => {
                  const Icon = s.icon;
                  return (
                    <button key={s.label} onClick={() => enviar(s.q)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl border border-border/60 hover:bg-muted/50 hover:border-border transition-colors flex items-center gap-2.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-medium text-foreground/80">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map(m => (
            m.role === 'user' ? (
              <div key={m.id} className="flex gap-3 justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground text-background px-4 py-2.5">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
                <span className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </div>
            ) : (
              <AssistantRow key={m.id} msg={m} onRetry={enviar} />
            )
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/40 bg-muted/[0.02]">
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 focus-within:border-border transition-colors">
            {/* Botão + com atalhos de análise */}
            <div ref={plusRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPlusOpen(v => !v)}
                disabled={streaming}
                className={cn('h-7 w-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30',
                  plusOpen ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60')}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {plusOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden z-50">
                  <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Atalhos</p>
                  {sugestoes.map(s => {
                    const Icon = s.icon;
                    return (
                      <button key={s.label} onClick={() => { setPlusOpen(false); enviar(s.q); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors text-left">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input); } }}
              placeholder={clientOrgId ? 'Pergunte ou peça uma análise…' : 'Pergunte sobre a base…'}
              className="flex-1 resize-none border-0 bg-transparent text-sm outline-none p-0 leading-relaxed placeholder:text-muted-foreground/40 overflow-hidden"
              style={{ height: '22px', maxHeight: '128px' }}
              disabled={streaming}
            />

            {/* Pill seletor de modelo */}
            <div className="relative shrink-0">
              <button
                ref={modelBtnRef}
                type="button"
                onClick={openModelMenu}
                title={modelLabel}
                className="flex items-center gap-0.5 h-6 px-1.5 rounded-md text-[10px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <span className="max-w-[64px] truncate">{modelLabel}</span>
                <ChevronDown className="h-2.5 w-2.5 shrink-0" />
              </button>
              {modelMenuOpen && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setModelMenuOpen(false)} />
                  <div className="fixed z-[9999] w-60 rounded-xl border border-border/60 bg-card shadow-xl py-1" style={{ bottom: modelMenuPos.bottom, right: modelMenuPos.right }}>
                    <div className="max-h-72 overflow-y-auto">
                      {LLM_MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { handleModelChange(m.id); setModelMenuOpen(false); }}
                          className={cn('w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-muted/50 transition-colors text-left',
                            selectedModel === m.id && 'bg-muted/40 font-semibold')}
                        >
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 uppercase tracking-wide min-w-[46px] text-center">{m.badge}</span>
                          <span className="truncate flex-1">{m.label}</span>
                          {selectedModel === m.id && <span className="text-[10px] text-emerald-500 shrink-0">✓</span>}
                        </button>
                      ))}
                    </div>
                    {selectedModel === CUSTOM_MODEL_SENTINEL && (
                      <div className="px-3 pt-1 pb-2 border-t border-border/40 mt-1">
                        <input
                          type="text"
                          value={customModel}
                          onChange={e => handleCustomModel(e.target.value)}
                          placeholder="provider/model-id"
                          className="w-full h-7 text-[11px] px-2 rounded-lg border border-border/50 bg-muted/30 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
                        />
                      </div>
                    )}
                  </div>
                </>,
                document.body
              )}
            </div>

            {/* Enviar / Parar */}
            {streaming ? (
              <button onClick={stopStreaming} title="Parar geração"
                className="h-8 w-8 p-0 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center justify-center shrink-0 transition-all">
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <Button
                onClick={() => enviar(input)}
                disabled={!input.trim()}
                className="h-8 w-8 p-0 rounded-lg bg-foreground text-background hover:bg-foreground/90 flex-shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
            Enter para enviar · Shift+Enter nova linha · + para atalhos
          </p>
        </div>
      </div>
    </div>
  );
}
