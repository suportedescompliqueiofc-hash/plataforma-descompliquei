import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal, flushSync } from "react-dom";
import { toast } from "sonner";
import { formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sparkles, Plus, Send, Loader2, Users, BarChart3, GitBranch,
  Calendar, DollarSign, Target, BadgeCheck, FileText, ArrowRight,
  CheckCircle2, PanelLeftOpen, PanelLeftClose, Trash2, Bot,
  TrendingUp, Zap, MessageSquare, Paperclip, X, ImageIcon, Mic,
  Clock, ArrowDownToLine, ArrowUpFromLine, Square,
  MoreHorizontal, Pin, Archive, Pencil, ChevronDown, AlertCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { extrairJornadaOS, salvarJornadaOS } from "@/lib/jornadaUtils";

// ── Models ────────────────────────────────────────────────────────────────────

const MODELS = [
  // ── OpenAI 2026 ───────────────────────────────────────────────────────────
  { id: "openai/gpt-5.4-nano",                    label: "GPT-5.4 Nano",           badge: "OpenAI" },
  { id: "openai/gpt-5.4-mini",                    label: "GPT-5.4 Mini",           badge: "OpenAI" },
  { id: "openai/gpt-5.4",                         label: "GPT-5.4",                badge: "OpenAI" },
  { id: "openai/gpt-5.5",                         label: "GPT-5.5",                badge: "OpenAI" },
  // ── Anthropic 2026 ───────────────────────────────────────────────────────
  { id: "anthropic/claude-fable-5",               label: "Claude Fable 5",         badge: "Anthropic" },
  { id: "anthropic/claude-opus-4.8",              label: "Claude Opus 4.8",        badge: "Anthropic" },
  { id: "anthropic/claude-opus-4.8-fast",         label: "Claude Opus 4.8 Fast",   badge: "Anthropic" },
  // ── Google 2026 ──────────────────────────────────────────────────────────
  { id: "google/gemini-3.5-flash",                label: "Gemini 3.5 Flash",       badge: "Google" },
  // ── xAI 2026 ─────────────────────────────────────────────────────────────
  { id: "x-ai/grok-4.3",                          label: "Grok 4.3",               badge: "xAI" },
  { id: "x-ai/grok-4.20",                         label: "Grok 4.20",              badge: "xAI" },
  // ── DeepSeek 2026 ────────────────────────────────────────────────────────
  { id: "deepseek/deepseek-v4-flash",             label: "DeepSeek V4 Flash",      badge: "DeepSeek" },
  { id: "deepseek/deepseek-v4-pro",               label: "DeepSeek V4 Pro",        badge: "DeepSeek" },
  // ── Qwen 2026 ────────────────────────────────────────────────────────────
  { id: "qwen/qwen3.7-max",                       label: "Qwen 3.7 Max",           badge: "Qwen" },
  // ── Mistral 2026 ─────────────────────────────────────────────────────────
  { id: "mistralai/mistral-medium-3-5",           label: "Mistral Medium 3.5",     badge: "Mistral" },
  // ── Personalizado ────────────────────────────────────────────────────────
  { id: "__custom__",                              label: "Personalizado...",        badge: "Custom" },
];

const CUSTOM_SENTINEL  = "__custom__";
const DEFAULT_MODEL    = MODELS[0].id;
const LS_MODEL_KEY     = "descompliquei_os_model";
const LS_CUSTOM_KEY    = "descompliquei_os_custom_model";

// ── Model context windows (tokens) ───────────────────────────────────────────

const MODEL_CONTEXT: Record<string, number> = {
  "openai/gpt-5.4-nano":             128_000,
  "openai/gpt-5.4-mini":             128_000,
  "openai/gpt-5.4":                  128_000,
  "openai/gpt-5.5":                  200_000,
  "anthropic/claude-fable-5":        200_000,
  "anthropic/claude-opus-4.8":       200_000,
  "anthropic/claude-opus-4.8-fast":  200_000,
  "google/gemini-3.5-flash":       1_000_000,
  "x-ai/grok-4.3":                   131_072,
  "x-ai/grok-4.20":                  256_000,
  "deepseek/deepseek-v4-flash":       64_000,
  "deepseek/deepseek-v4-pro":        128_000,
  "qwen/qwen3.7-max":                131_072,
  "mistralai/mistral-medium-3-5":    128_000,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string; // para imagens
}

interface OSConversation {
  id: string;
  titulo: string;
  criado_em: string;
  atualizado_em: string;
}

interface ToolCallEvent {
  tool: string;
  input: any;
  result?: any;
  status: "running" | "done";
}

interface OSMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallEvent[];
  isStreaming?: boolean;
  processingAttachments?: number;
  errorMessage?: string;
  retryText?: string;
  criado_em: string;
  attachmentPreviews?: Array<{ url: string; name: string; isImage: boolean }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTimeMs: number;
    toolCallsCount: number;
    model: string;
  };
}

// ── Tool Config ───────────────────────────────────────────────────────────────

const TOOL_CONFIG: Record<string, { label: string; Icon: React.ComponentType<any> }> = {
  buscar_leads:         { label: "Buscando leads",        Icon: Users },
  obter_metricas_funil: { label: "Analisando funil",      Icon: BarChart3 },
  obter_pipeline:       { label: "Verificando pipeline",  Icon: GitBranch },
  obter_agendamentos:   { label: "Consultando agenda",    Icon: Calendar },
  obter_vendas_recentes:{ label: "Carregando vendas",     Icon: DollarSign },
  obter_metas:          { label: "Verificando metas",     Icon: Target },
  qualificar_lead:      { label: "Qualificando lead",     Icon: BadgeCheck },
  adicionar_nota:       { label: "Adicionando nota",      Icon: FileText },
  mover_etapa_pipeline: { label: "Movendo no pipeline",   Icon: ArrowRight },
};

const SUGGESTIONS = [
  { Icon: BarChart3,  text: "Como está meu funil esta semana?" },
  { Icon: Users,      text: "Quais leads estão parados no pipeline?" },
  { Icon: Target,     text: "Estou no caminho certo para bater a meta?" },
  { Icon: BadgeCheck, text: "Me mostre os leads qualificados" },
  { Icon: Calendar,   text: "Quais são meus próximos agendamentos?" },
  { Icon: DollarSign, text: "Qual foi minha receita nos últimos 30 dias?" },
];

const FEATURE_PILLS = [
  { Icon: Bot,        label: "Conhece cada lead" },
  { Icon: BarChart3,  label: "Lê todas as métricas" },
  { Icon: TrendingUp, label: "Age no CRM" },
  { Icon: Sparkles,   label: "Planeja com você" },
];

// ── Markdown Renderer ─────────────────────────────────────────────────────────

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-muted/60 px-1.5 py-0.5 rounded-md text-[11px] font-mono text-foreground/80">$1</code>');
}

type MDBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; lines: string[] }
  | { type: "hr" };

function parseBlocks(content: string): MDBlock[] {
  const lines = content.split("\n");
  const blocks: MDBlock[] = [];
  let i = 0;

  const isListItem = (l: string) =>
    /^[\-\*•]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];

    // blank
    if (!line.trim()) { i++; continue; }

    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++; continue;
    }

    // Heading
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      blocks.push({ type: "heading", level: Math.min(hm[1].length, 4) as 1|2|3|4, text: hm[2] });
      i++; continue;
    }

    // Code block
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lines: codeLines });
      continue;
    }

    // Table
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parseRow = (row: string) =>
        row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
      const isSep = (row: string) => /^\|[\s\-:|]+\|/.test(row);
      if (tableLines.length >= 2 && isSep(tableLines[1])) {
        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    // List
    if (isListItem(line)) {
      const items: string[] = [];
      const ordered = /^\d+\./.test(line.trim());
      while (i < lines.length && isListItem(lines[i])) {
        items.push(lines[i].replace(/^[\-\*•]\s+/, "").replace(/^\d+\.\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "list", items, ordered });
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break;
      if (/^#{1,4}\s/.test(l)) break;
      if (l.trim().startsWith("|")) break;
      if (l.trim().startsWith("```")) break;
      if (/^[-*_]{3,}$/.test(l.trim())) break;
      if (isListItem(l) && paraLines.length === 0) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length) blocks.push({ type: "paragraph", lines: paraLines });
  }

  return blocks;
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null;
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed">
      {blocks.map((block, i) => {
        switch (block.type) {

          case "heading": {
            const styles: Record<number, string> = {
              1: "text-[15px] font-bold text-foreground mt-2 mb-0.5",
              2: "text-[13px] font-bold text-foreground mt-2 mb-0.5",
              3: "text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-2 mb-0.5",
              4: "text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-1",
            };
            return (
              <p key={i} className={styles[block.level]}
                dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
            );
          }

          case "hr":
            return <hr key={i} className="border-border/30 my-1" />;

          case "code":
            return (
              <pre key={i} className="bg-muted/40 border border-border/40 rounded-xl px-4 py-3 overflow-x-auto my-1">
                <code className="text-[11px] font-mono text-foreground/80 whitespace-pre">
                  {block.lines.join("\n")}
                </code>
              </pre>
            );

          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-border/40 my-1">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/40">
                      {block.headers.map((h, j) => (
                        <th key={j} className="px-3 py-2 text-left font-semibold text-muted-foreground text-[10px] uppercase tracking-wider whitespace-nowrap">
                          <span dangerouslySetInnerHTML={{ __html: renderInline(h) }} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j} className={cn(
                        "border-b border-border/20 last:border-0 transition-colors",
                        j % 2 === 1 ? "bg-muted/[0.03]" : ""
                      )}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-2 text-foreground/80">
                            <span dangerouslySetInnerHTML={{ __html: renderInline(cell) }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "list":
            return (
              <ul key={i} className="space-y-1.5 my-0.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2 items-start">
                    {block.ordered ? (
                      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground/40 mt-[1px] min-w-[18px] tabular-nums">{j + 1}.</span>
                    ) : (
                      <span className="shrink-0 text-muted-foreground/30 mt-[5px] text-[8px] leading-none">▸</span>
                    )}
                    <span className="flex-1 text-foreground/85"
                      dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                  </li>
                ))}
              </ul>
            );

          case "paragraph":
            return (
              <p key={i} className="text-foreground/85"
                dangerouslySetInnerHTML={{ __html: renderInline(block.lines.join("<br/>")) }} />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

// ── Tool Card ─────────────────────────────────────────────────────────────────

function ToolCard({ call }: { call: ToolCallEvent }) {
  const cfg = TOOL_CONFIG[call.tool];
  const Icon = cfg?.Icon ?? Zap;
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
      call.status === "running"
        ? "bg-muted/50 border-border/50 text-muted-foreground"
        : "bg-muted/20 border-border/30 text-muted-foreground/60"
    )}>
      {call.status === "running"
        ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        : <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
      <Icon className="h-3 w-3 shrink-0" />
      <span>{cfg?.label ?? call.tool}</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupConversations(conversations: OSConversation[]) {
  const today: OSConversation[] = [];
  const yesterday: OSConversation[] = [];
  const older: OSConversation[] = [];
  for (const c of conversations) {
    const d = parseISO(c.atualizado_em);
    if (isToday(d)) today.push(c);
    else if (isYesterday(d)) yesterday.push(c);
    else older.push(c);
  }
  return { today, yesterday, older };
}

// ── Tipos de Agentes ──────────────────────────────────────────────────────────

interface AthosAgente {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  system_prompt: string;
}

// ── Extração e salvamento de jornada (onboarding agent) — ver @/lib/jornadaUtils ──

// ── Main Component ────────────────────────────────────────────────────────────

export default function DescompliqueiOS() {
  const { user } = useAuth();
  const { setConcluido } = usePlataforma();
  const [searchParams] = useSearchParams();
  const [agentes, setAgentes] = useState<AthosAgente[]>([]);
  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string | null>(() => searchParams.get("agente") ?? null);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const jornadaSalvaRef = useRef(false);
  const autoStartRef = useRef(false);
  const conversationsLoadedRef = useRef(false);
  const [conversations, setConversations] = useState<OSConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OSMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem(LS_MODEL_KEY) ?? DEFAULT_MODEL
  );
  const [customModelInput, setCustomModelInput] = useState<string>(
    () => localStorage.getItem(LS_CUSTOM_KEY) ?? ""
  );

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem(LS_MODEL_KEY, modelId);
  };
  const handleCustomModelChange = (value: string) => {
    setCustomModelInput(value);
    localStorage.setItem(LS_CUSTOM_KEY, value);
  };
  const activeModel = selectedModel === CUSTOM_SENTINEL ? customModelInput || DEFAULT_MODEL : selectedModel;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const [modelMenuPos, setModelMenuPos] = useState({ bottom: 0, right: 0 });

  const openModelMenu = () => {
    if (modelBtnRef.current) {
      const r = modelBtnRef.current.getBoundingClientRect();
      setModelMenuPos({ bottom: window.innerHeight - r.top + 8, right: window.innerWidth - r.right });
    }
    setModelMenuOpen(v => !v);
  };

  // Flush function ref — chamado pelo visibilitychange para descongelar ao voltar à aba
  const flushStreamRef = useRef<(() => void) | null>(null);
  // Abort controller do fetch ativo — permite cancelar o stream
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = () => {
    // flushSync força o React a aplicar o state IMEDIATAMENTE, bypassando a fila de renders.
    // Crítico quando o markdown rendering está saturado (tabelas/listas longas em streaming):
    // sem flushSync o clique fica pendente e o usuário acha que o botão não funciona.
    flushSync(() => {
      setIsStreaming(false);
      setMessages(prev => prev.map(m => m.isStreaming
        ? { ...m, isStreaming: false, processingAttachments: undefined }
        : m));
    });
    // Aborta o fetch DEPOIS do setState — assim a UI já liberou mesmo se o abort demorar
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && flushStreamRef.current) {
        flushStreamRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Fecha o menu "+" ao clicar fora
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Carrega agentes disponíveis
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("athos_agentes").select("id, slug, nome, descricao, system_prompt")
      .eq("ativo", true).order("created_at")
      .then(({ data }: any) => { if (data) setAgentes(data); });
  }, [user?.id]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    let q = (supabase as any)
      .from("os_conversations")
      .select("id, titulo, criado_em, atualizado_em")
      .eq("user_id", user.id);
    if (selectedAgentSlug) {
      q = q.eq("agente_slug", selectedAgentSlug);
    } else {
      q = q.is("agente_slug", null);
    }
    const { data } = await q.order("atualizado_em", { ascending: false }).limit(50);
    if (data) setConversations(data as any);
    conversationsLoadedRef.current = true;
  }, [user, selectedAgentSlug]);

  // Reset dos refs de auto-start quando o agente muda
  useEffect(() => {
    autoStartRef.current = false;
    conversationsLoadedRef.current = false;
  }, [selectedAgentSlug]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Auto-start do Athos no fluxo de onboarding — dispara a primeira mensagem automaticamente
  useEffect(() => {
    if (
      selectedAgentSlug !== "onboarding" ||
      autoStartRef.current ||
      !conversationsLoadedRef.current ||
      conversations.length > 0 ||
      agentes.length === 0 ||
      isStreaming ||
      currentConversationId
    ) return;

    autoStartRef.current = true;
    const timer = setTimeout(() => {
      sendMessage("Olá! Acabei de finalizar o diagnóstico.");
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentSlug, conversations, agentes, isStreaming, currentConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize do textarea — sincroniza altura com conteúdo
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const loadMessages = async (convId: string) => {
    setLoadingConv(true);
    const { data } = await supabase
      .from("os_messages" as any)
      .select("id, role, content, tool_calls, criado_em")
      .eq("conversation_id", convId)
      .order("criado_em", { ascending: true });
    if (data) setMessages((data as any[]).map(m => ({ ...m, tool_calls: m.tool_calls ?? undefined })));
    setLoadingConv(false);
  };

  const selectConversation = (conv: OSConversation) => {
    setCurrentConversationId(conv.id);
    loadMessages(conv.id);
  };

  const newConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    jornadaSalvaRef.current = false;
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Detecta JSON de jornada quando o agente de onboarding está ativo
  useEffect(() => {
    if (selectedAgentSlug !== "onboarding" || isStreaming || jornadaSalvaRef.current) return;
    const lastMsg = [...messages].reverse().find(m => m.role === "assistant" && !m.isStreaming && m.content);
    if (!lastMsg) return;
    const jornada = extrairJornadaOS(lastMsg.content);
    if (jornada && user) {
      jornadaSalvaRef.current = true;
      salvarJornadaOS(jornada, user.id).then(async ok => {
        if (ok) {
          toast.success("Jornada salva com sucesso!");
          // Marca onboarding como concluído e atualiza contexto local para exibir o checklist
          await (supabase as any).from("platform_users")
            .update({ onboarding_concluido: true })
            .eq("crm_user_id", user!.id);
          setConcluido();
        }
      });
    }
  }, [isStreaming, messages, selectedAgentSlug, user?.id]);

  // Hard timeout via useEffect — 120s absolutos.
  // Dispara enquanto QUALQUER mensagem ou o state global indicar streaming,
  // garantindo que o usuário nunca fique preso mesmo com state dessincronizado.
  const hasAnyStreaming = isStreaming || messages.some(m => m.isStreaming);
  useEffect(() => {
    if (!hasAnyStreaming) return;
    const timer = window.setTimeout(() => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setMessages(prev => prev.map(m => m.isStreaming
        ? { ...m, isStreaming: false, processingAttachments: undefined,
            errorMessage: "Tempo limite atingido (120s). O modelo demorou demais para responder." }
        : m));
      setIsStreaming(false);
    }, 120_000);
    return () => window.clearTimeout(timer);
  }, [hasAnyStreaming]);

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("os_conversations" as any).delete().eq("id", convId);
    if (currentConversationId === convId) newConversation();
    setConversations(prev => prev.filter(c => c.id !== convId));
  };

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("os_pinned") ?? "[]")); } catch { return new Set(); }
  });
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("os_archived") ?? "[]")); } catch { return new Set(); }
  });

  const renameConversation = async (convId: string, newTitle: string) => {
    await supabase.from("os_conversations" as any).update({ titulo: newTitle }).eq("id", convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, titulo: newTitle } : c));
  };

  const pinConversation = (convId: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId); else next.add(convId);
      localStorage.setItem("os_pinned", JSON.stringify([...next]));
      return next;
    });
  };

  const archiveConversation = (convId: string) => {
    setArchivedIds(prev => {
      const next = new Set(prev);
      next.add(convId);
      localStorage.setItem("os_archived", JSON.stringify([...next]));
      return next;
    });
    if (currentConversationId === convId) newConversation();
  };

  const unarchiveConversation = (convId: string) => {
    setArchivedIds(prev => {
      const next = new Set(prev);
      next.delete(convId);
      localStorage.setItem("os_archived", JSON.stringify([...next]));
      return next;
    });
  };

  const [showArchived, setShowArchived] = useState(false);

  const sendMessage = async (text: string, atts: Attachment[] = []) => {
    if ((!text.trim() && !atts.length) || isStreaming) return;

    const userMsg: OSMessage = {
      id: crypto.randomUUID(), role: "user",
      content: text.trim(), criado_em: new Date().toISOString(),
      attachmentPreviews: atts.length > 0 ? atts.map(a => ({
        url: a.previewUrl ?? "",
        name: a.name,
        isImage: a.mimeType.startsWith("image/") && !!a.previewUrl,
      })) : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachments([]);
    setIsStreaming(true);

    const aId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: aId, role: "assistant", content: "",
      tool_calls: [], isStreaming: true, criado_em: new Date().toISOString(),
      retryText: text.trim(),
    }]);

    // ── Streaming buffer ─────────────────────────────────────────────────────
    // Acumula texto num ref para evitar re-renders em cada caractere.
    // Faz flush a cada 80ms OU imediatamente ao voltar à aba (visibilitychange).
    let streamedText = "";
    let lastFlushedText = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const activeToolCalls: ToolCallEvent[] = [];

    const flushText = () => {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (streamedText === lastFlushedText) return;
      lastFlushedText = streamedText;
      const snapshot = streamedText;
      setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: snapshot } : m));
    };

    // Expõe o flush para o listener de visibilidade
    flushStreamRef.current = flushText;

    const scheduleFlush = () => {
      if (flushTimer) return; // já agendado
      flushTimer = setTimeout(() => { flushTimer = null; flushText(); }, 80);
    };

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const history = messages.filter(m => !m.isStreaming).slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      // Monta o system_prompt_override do agente selecionado
      const selectedAgent = agentes.find(a => a.slug === selectedAgentSlug);
      let systemPromptOverride = selectedAgent?.system_prompt ?? undefined;

      // Agente de onboarding: injeta diagnóstico no primeiro contexto
      if (selectedAgentSlug === "onboarding" && !currentConversationId) {
        const { data: diagDoc } = await (supabase as any)
          .from("meus_materiais").select("conteudo")
          .eq("user_id", user!.id).eq("categoria", "diagnostico")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (diagDoc?.conteudo) {
          systemPromptOverride = (systemPromptOverride ?? "") + `\n\n---\n\nDIAGNÓSTICO DO CLIENTE:\n${diagDoc.conteudo}`;
        }
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/descompliquei-os`, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversation_id: currentConversationId,
          history,
          model: activeModel,
          attachments: atts.map(a => ({ name: a.name, mimeType: a.mimeType, base64: a.base64 })),
          ...(systemPromptOverride ? { system_prompt_override: systemPromptOverride } : {}),
        }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (!res.body) throw new Error("Stream vazio");

      const reader = res.body.getReader();
      // Garante cancelamento do reader quando abort dispara (reader.cancel resolve em vez de rejeitar)
      const cancelReaderOnAbort = () => { reader.cancel().catch(() => {}); };
      abortController.signal.addEventListener("abort", cancelReaderOnAbort, { once: true });
      const decoder = new TextDecoder();
      let buffer = "";
      // Inactivity = nenhum byte do servidor (NEM heartbeat) por N ms.
      // Heartbeats chegam a cada 3s do backend, então 30s é mais que suficiente.
      // O hard timeout de 120s no useEffect global é a rede de segurança final.
      const INACTIVITY_TIMEOUT_MS = 30_000;
      let timedOutByInactivity = false;
      let inactivityTimer = setTimeout(() => {
        timedOutByInactivity = true;
        abortController.abort();
      }, INACTIVITY_TIMEOUT_MS);
      const resetInactivity = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          timedOutByInactivity = true;
          abortController.abort();
        }, INACTIVITY_TIMEOUT_MS);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          let ev: any;
          try { ev = JSON.parse(raw); } catch { continue; }
          // Heartbeat (e qualquer outro evento) reseta o timer — basta um sinal de vida do servidor.
          resetInactivity();
          if (ev.type === "processing_attachments") {
            setMessages(prev => prev.map(m => m.id === aId
              ? { ...m, processingAttachments: ev.count }
              : m));
          }
          if (ev.type === "attachments_done") {
            setMessages(prev => prev.map(m => m.id === aId
              ? { ...m, processingAttachments: undefined }
              : m));
          }
          if (ev.type === "tool_start") {
            activeToolCalls.push({ tool: ev.tool, input: ev.input, status: "running" });
            const tc = [...activeToolCalls];
            setMessages(prev => prev.map(m => m.id === aId ? { ...m, tool_calls: tc } : m));
          }
          if (ev.type === "tool_result") {
            const idx = [...activeToolCalls].reverse().findIndex(tc => tc.tool === ev.tool && tc.status === "running");
            const ri = idx >= 0 ? activeToolCalls.length - 1 - idx : -1;
            if (ri >= 0) activeToolCalls[ri] = { ...activeToolCalls[ri], result: ev.result, status: "done" };
            const tc = [...activeToolCalls];
            setMessages(prev => prev.map(m => m.id === aId ? { ...m, tool_calls: tc } : m));
          }
          if (ev.type === "text_delta") {
            streamedText += ev.delta;
            scheduleFlush();
          }
          if (ev.type === "usage") {
            setMessages(prev => prev.map(m => m.id === aId ? {
              ...m,
              usage: {
                inputTokens:   ev.input_tokens    ?? 0,
                outputTokens:  ev.output_tokens   ?? 0,
                totalTimeMs:   ev.total_time_ms   ?? 0,
                toolCallsCount: ev.tool_calls_count ?? 0,
                model:         ev.model            ?? "",
              },
            } : m));
          }
          if (ev.type === "done") {
            flushText();
            if (ev.conversation_id && !currentConversationId) {
              setCurrentConversationId(ev.conversation_id);
              if (selectedAgentSlug) {
                await (supabase as any).from("os_conversations")
                  .update({ agente_slug: selectedAgentSlug })
                  .eq("id", ev.conversation_id);
              }
            }
            loadConversations();
            setMessages(prev => prev.map(m => m.id === aId ? { ...m, isStreaming: false } : m));
          }
          if (ev.type === "error") throw new Error(ev.message);
        }
      }

      clearTimeout(inactivityTimer);
      abortController.signal.removeEventListener("abort", cancelReaderOnAbort);
      flushText();
      // Stream terminou — log para debug
      console.log("[Athos] Stream ended. aborted:", abortController.signal.aborted);
      // Stream terminou sem evento "done" (conexão caiu, tab switch, timeout do browser)
      // Sempre limpar o estado — se "done" já tratou, é no-op
      setMessages(prev => prev.map(m => m.id === aId && m.isStreaming
        ? { ...m, isStreaming: false, processingAttachments: undefined,
            ...(!m.content && !abortController.signal.aborted
              ? { errorMessage: "Conexão perdida com o servidor. Tente novamente." }
              : {}) }
        : m));
    } catch (err: any) {
      flushStreamRef.current = null;
      if (flushTimer) clearTimeout(flushTimer);
      abortController.signal.removeEventListener("abort", cancelReaderOnAbort);
      if (err.name === "AbortError") {
        // Distingue abort por timeout (silêncio do servidor) vs cancelamento explícito do usuário.
        flushText();
        const errorMessage = timedOutByInactivity
          ? "Sem resposta do servidor por 30 segundos. A conexão pode ter caído — tente novamente."
          : undefined;
        setMessages(prev => prev.map(m => m.id === aId
          ? { ...m, isStreaming: false, processingAttachments: undefined,
              ...(errorMessage && !m.content ? { errorMessage } : {}) }
          : m));
      } else {
        const errMsg = err.message ?? "Erro desconhecido";
        flushText();
        setMessages(prev => prev.map(m => m.id === aId
          ? { ...m, isStreaming: false, processingAttachments: undefined, errorMessage: errMsg }
          : m));
      }
    } finally {
      flushStreamRef.current = null;
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const processFiles = async (files: File[]): Promise<Attachment[]> => {
    const MAX_MB = 20;
    const newAtts: Attachment[] = [];
    for (const file of files) {
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`"${file.name}" é muito grande (máx ${MAX_MB}MB)`);
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file) : undefined;
      newAtts.push({ id: crypto.randomUUID(), name: file.name, mimeType: file.type, base64, previewUrl });
    }
    return newAtts;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newAtts = await processFiles(files);
    setAttachments(prev => [...prev, ...newAtts]);
    e.target.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, i) => {
        const file = item.getAsFile()!;
        // Clipboard items não têm nome — gera um nome legível
        const ext = item.type.split("/")[1] ?? "png";
        return new File([file], `print-${i + 1}.${ext}`, { type: item.type });
      });
    if (!imageFiles.length) return;
    e.preventDefault(); // evita colar texto da imagem (ex: nome do arquivo)
    const newAtts = await processFiles(imageFiles);
    setAttachments(prev => [...prev, ...newAtts]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input, attachments); }
  };

  const visibleConvs = conversations.filter(c => !archivedIds.has(c.id));
  const pinnedConvs  = visibleConvs.filter(c => pinnedIds.has(c.id));
  const grouped = groupConversations(visibleConvs.filter(c => !pinnedIds.has(c.id)));
  const hasMessages = messages.length > 0;
  const currentTitle = conversations.find(c => c.id === currentConversationId)?.titulo;

  return (
    <>
    <style>{`
      @keyframes os-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @keyframes os-morph {
        0%, 100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
        25% { border-radius: 70% 30% 46% 54% / 30% 29% 71% 70%; }
        50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
        75% { border-radius: 55% 45% 30% 70% / 65% 35% 55% 45%; }
      }
      @keyframes os-gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      @keyframes os-pulse-ring { 0%, 100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.22; transform: scale(1.04); } }
      @keyframes os-pulse-ring-2 { 0%, 100% { opacity: 0.05; transform: scale(1); } 50% { opacity: 0.1; transform: scale(1.02); } }
      @keyframes os-orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes os-particle-drift {
        0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
        25% { transform: translateY(-8px) translateX(4px); opacity: 0.7; }
        50% { transform: translateY(-4px) translateX(-3px); opacity: 0.3; }
        75% { transform: translateY(6px) translateX(5px); opacity: 0.6; }
      }
      .os-orb {
        border-radius: 50%;
        background-color: #0a0a14;
        background-image:
          radial-gradient(ellipse 60% 45% at 30% 25%, rgba(56,189,248,1), transparent 70%),
          radial-gradient(ellipse 55% 50% at 75% 30%, rgba(168,85,247,0.95), transparent 65%),
          radial-gradient(ellipse 65% 45% at 55% 75%, rgba(236,72,153,0.85), transparent 70%),
          radial-gradient(ellipse 50% 50% at 20% 75%, rgba(34,211,238,0.8), transparent 65%),
          radial-gradient(ellipse 50% 45% at 80% 80%, rgba(249,115,22,0.7), transparent 65%),
          radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0a0a14 100%);
        background-size: 100% 100%;
        animation: os-float 6s ease-in-out infinite, os-iridescent 14s ease infinite;
        box-shadow:
          0 0 60px rgba(168,85,247,0.35),
          0 0 120px rgba(56,189,248,0.2),
          0 12px 40px rgba(0,0,0,0.35),
          inset 0 -20px 40px rgba(0,0,0,0.5),
          inset 0 3px 10px rgba(255,255,255,0.1),
          inset -5px -10px 30px rgba(168,85,247,0.2);
      }
      @keyframes os-iridescent {
        0%, 100% { filter: hue-rotate(0deg) saturate(1); }
        33% { filter: hue-rotate(25deg) saturate(1.15); }
        66% { filter: hue-rotate(-15deg) saturate(1.1); }
      }
      @keyframes os-spec-rotate {
        0%, 100% { transform: rotate(0deg) translateX(0); }
        50% { transform: rotate(180deg) translateX(2px); }
      }
      .os-orb-highlight {
        border-radius: 50%;
        background:
          radial-gradient(ellipse 60% 35% at 32% 22%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, transparent 65%),
          radial-gradient(ellipse 25% 15% at 28% 18%, rgba(255,255,255,0.7) 0%, transparent 70%);
        animation: os-float 6s ease-in-out infinite;
        animation-delay: -2s;
      }
      .os-orb-shimmer {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background:
          conic-gradient(from 0deg at 50% 50%,
            transparent 0deg,
            rgba(255,255,255,0.04) 60deg,
            transparent 120deg,
            rgba(168,85,247,0.06) 180deg,
            transparent 240deg,
            rgba(56,189,248,0.05) 300deg,
            transparent 360deg);
        animation: os-spec-rotate 8s linear infinite;
        mix-blend-mode: screen;
        pointer-events: none;
      }
      .os-orb-rim {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 50%, transparent 62%, rgba(255,255,255,0.08) 70%, transparent 78%);
        pointer-events: none;
      }
      .os-ring { border: 1px solid rgba(234,88,12,0.07); border-radius: 50%; animation: os-pulse-ring 4s ease-in-out infinite; }
      .os-ring-2 { border: 1px dashed rgba(139,92,246,0.05); border-radius: 50%; animation: os-pulse-ring-2 5s ease-in-out infinite; }
      .os-orbit { animation: os-orbit-spin 20s linear infinite; }
      .os-particle { animation: os-particle-drift 7s ease-in-out infinite; }
      .os-particle-2 { animation: os-particle-drift 9s ease-in-out infinite; animation-delay: -3s; }
      .os-particle-3 { animation: os-particle-drift 11s ease-in-out infinite; animation-delay: -6s; }
      @keyframes os-border-glow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      .os-input-glow {
        position: relative;
        padding: 1.5px;
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(234,88,12,0.15), rgba(139,92,246,0.15), rgba(6,182,212,0.15), rgba(234,88,12,0.15));
        background-size: 300% 300%;
        animation: os-border-glow 8s ease infinite;
      }
      .os-input-glow::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 18px;
        background: inherit;
        filter: blur(12px);
        opacity: 0.4;
        z-index: -1;
      }
      .os-input-glow:focus-within {
        background: linear-gradient(135deg, rgba(234,88,12,0.3), rgba(139,92,246,0.3), rgba(6,182,212,0.3), rgba(234,88,12,0.3));
        background-size: 300% 300%;
        animation: os-border-glow 4s ease infinite;
      }
      .os-input-glow:focus-within::before { opacity: 0.6; }
    `}</style>
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden relative bg-background">
      {/* Page background gradient overlay — adapts to theme via opacity blends */}
      <div className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(234,88,12,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 70% 60% at 100% 100%, rgba(139,92,246,0.07) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 0% 100%, rgba(6,182,212,0.05) 0%, transparent 55%)
          `,
        }}
      />

      {/* ── Conversation Sidebar ─────────────────────────────────────────── */}
      <aside className={cn(
        "relative z-10 flex-shrink-0 flex flex-col border-r border-border/50 bg-background/40 backdrop-blur-sm transition-[width] duration-200 overflow-hidden",
        sidebarOpen ? "w-60" : "w-0"
      )}>
        {/* Keep content visible only when sidebar is open */}
        <div className="flex flex-col h-full w-60">

          {/* ── Header ── */}
          <div className="px-3 pt-4 pb-3 border-b border-border/40 shrink-0 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">Conversas</span>
              {agentes.length > 0 && (
                <button
                  onClick={() => setAgentPickerOpen(v => !v)}
                  title="Agentes"
                  className={cn(
                    "flex items-center justify-center h-6 w-6 rounded-md transition-colors",
                    selectedAgentSlug
                      ? "text-foreground bg-foreground/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Bot className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={newConversation}
              className="flex items-center justify-center gap-1.5 w-full h-8 rounded-lg border border-border/60 bg-background text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova conversa
            </button>
          </div>

          {/* ── Agent picker panel ── */}
          {agentPickerOpen && agentes.length > 0 && (
            <div className="absolute inset-x-0 top-[104px] bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t border-border/40 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Agentes</span>
                </div>
                <button
                  onClick={() => setAgentPickerOpen(false)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {agentes.map(ag => (
                  <button
                    key={ag.slug}
                    onClick={() => {
                      const next = selectedAgentSlug === ag.slug ? null : ag.slug;
                      setSelectedAgentSlug(next);
                      setAgentPickerOpen(false);
                      newConversation();
                    }}
                    className={cn(
                      "flex items-start gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all",
                      selectedAgentSlug === ag.slug
                        ? "bg-foreground text-background"
                        : "hover:bg-muted/60 text-foreground/80 hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      selectedAgentSlug === ag.slug ? "bg-white/15" : "bg-muted"
                    )}>
                      <Bot className={cn("h-3.5 w-3.5", selectedAgentSlug === ag.slug ? "text-background" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold leading-tight">{ag.nome}</p>
                      {ag.descricao && (
                        <p className={cn("text-[10px] mt-0.5 leading-snug line-clamp-2",
                          selectedAgentSlug === ag.slug ? "text-background/60" : "text-muted-foreground/60")}>
                          {ag.descricao}
                        </p>
                      )}
                    </div>
                    {selectedAgentSlug === ag.slug && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-background/70" />
                    )}
                  </button>
                ))}
              </div>
              {selectedAgentSlug && (
                <div className="px-3 py-2.5 border-t border-border/40">
                  <button
                    onClick={() => { setSelectedAgentSlug(null); setAgentPickerOpen(false); newConversation(); }}
                    className="flex items-center gap-1.5 w-full justify-center text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Voltar ao Athos GS
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-3">
                <div className="p-2 rounded-xl bg-muted/40 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground/30" />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground/60">Nenhuma conversa</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">Comece uma nova acima</p>
              </div>
            ) : (
              <>
                {pinnedConvs.length > 0 && (
                  <div>
                    <p className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Fixadas</p>
                    {pinnedConvs.map(c => (
                      <ConvItem key={c.id} conv={c} active={currentConversationId === c.id} isPinned
                        onSelect={() => selectConversation(c)}
                        onRename={t => renameConversation(c.id, t)}
                        onPin={() => pinConversation(c.id)}
                        onArchive={() => archiveConversation(c.id)}
                        onDelete={e => deleteConversation(c.id, e)} />
                    ))}
                  </div>
                )}
                {grouped.today.length > 0 && (
                  <div>
                    <p className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Hoje</p>
                    {grouped.today.map(c => (
                      <ConvItem key={c.id} conv={c} active={currentConversationId === c.id} isPinned={false}
                        onSelect={() => selectConversation(c)}
                        onRename={t => renameConversation(c.id, t)}
                        onPin={() => pinConversation(c.id)}
                        onArchive={() => archiveConversation(c.id)}
                        onDelete={e => deleteConversation(c.id, e)} />
                    ))}
                  </div>
                )}
                {grouped.yesterday.length > 0 && (
                  <div>
                    <p className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Ontem</p>
                    {grouped.yesterday.map(c => (
                      <ConvItem key={c.id} conv={c} active={currentConversationId === c.id} isPinned={false}
                        onSelect={() => selectConversation(c)}
                        onRename={t => renameConversation(c.id, t)}
                        onPin={() => pinConversation(c.id)}
                        onArchive={() => archiveConversation(c.id)}
                        onDelete={e => deleteConversation(c.id, e)} />
                    ))}
                  </div>
                )}
                {grouped.older.length > 0 && (
                  <div>
                    <p className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Anteriores</p>
                    {grouped.older.map(c => (
                      <ConvItem key={c.id} conv={c} active={currentConversationId === c.id} isPinned={false}
                        onSelect={() => selectConversation(c)}
                        onRename={t => renameConversation(c.id, t)}
                        onPin={() => pinConversation(c.id)}
                        onArchive={() => archiveConversation(c.id)}
                        onDelete={e => deleteConversation(c.id, e)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Rodapé — Arquivadas */}
          {archivedIds.size > 0 && (
            <div className="shrink-0 border-t border-border/40 px-2 py-2">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                <Archive className="h-3 w-3 shrink-0" />
                <span className="flex-1 text-left">Arquivadas</span>
                <span className="text-[10px] bg-muted/60 rounded px-1.5 py-0.5">{archivedIds.size}</span>
              </button>
              {showArchived && (
                <div className="mt-1 space-y-0.5">
                  {conversations.filter(c => archivedIds.has(c.id)).map(c => (
                    <div
                      key={c.id}
                      onClick={() => selectConversation(c)}
                      className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/40 text-foreground/40 hover:text-foreground/70 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">{c.titulo}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); unarchiveConversation(c.id); }}
                        title="Desarquivar"
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-5 w-5 rounded text-muted-foreground/40 hover:text-foreground transition-all"
                      >
                        <Archive className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Chat Area ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 h-11 border-b border-border/40 shrink-0 bg-background/40 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <div className="h-4 w-px bg-border/60 shrink-0" />
          <span className="text-[13px] font-semibold text-foreground truncate flex-1 font-display">
            {currentTitle ?? "Athos GS"}
          </span>

          {selectedAgentSlug && (() => {
            const ag = agentes.find(a => a.slug === selectedAgentSlug);
            return ag ? (
              <div className="flex items-center gap-1 shrink-0 bg-muted/60 border border-border/60 rounded-full px-2 py-0.5">
                <Bot className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground">{ag.nome}</span>
                <button
                  onClick={() => { setSelectedAgentSlug(null); newConversation(); }}
                  className="ml-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : null;
          })()}

        </div>

        {/* Messages / Welcome */}
        <div className="flex-1 overflow-y-auto">
          {loadingConv ? (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : !hasMessages ? (
            <WelcomeScreen onSuggestion={sendMessage} userName={user?.user_metadata?.full_name ?? user?.email} />
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 w-full">
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} onImageClick={setLightboxUrl} />)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 shrink-0 border-t border-border/40 bg-background/40 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto">
            {/* Chips de anexo */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map(att => att.mimeType.startsWith("image/") && att.previewUrl ? (
                  // Imagem — card com thumbnail clicável
                  <div key={att.id} className="relative group rounded-xl overflow-hidden border border-border/40 bg-muted/40 shrink-0">
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="h-16 w-auto max-w-[120px] object-cover cursor-pointer block"
                      onClick={() => setLightboxUrl(att.previewUrl!)}
                    />
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  // Arquivo genérico — chip
                  <div key={att.id} className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-muted/60 border border-border/40 text-[11px] text-muted-foreground max-w-[200px]">
                    {att.mimeType.startsWith("audio/") ? <Mic className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{att.name}</span>
                    <button onClick={() => removeAttachment(att.id)} className="shrink-0 hover:text-foreground transition-colors ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="os-input-glow">
            <div className="relative flex items-center gap-3 rounded-[16.5px] bg-card px-4 py-3.5">
              {/* Input oculto de arquivo */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,audio/*,.pdf,.txt,.docx,.doc,.xlsx,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Botão + com menu de ações */}
              <div ref={plusMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setPlusMenuOpen(v => !v)}
                  disabled={isStreaming}
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-lg transition-all disabled:opacity-30",
                    plusMenuOpen
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                {plusMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden z-50">
                    {/* Arquivo */}
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => { fileInputRef.current?.click(); setPlusMenuOpen(false); }}
                    >
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      Adicionar arquivo
                    </button>

                    <div className="h-px bg-border/40 mx-3" />

                    {/* Ações rápidas */}
                    {([
                      { Icon: BarChart3,   label: "Resumo do dia",             prompt: "Me dê um resumo completo do dia de hoje" },
                      { Icon: TrendingUp,  label: "Análise do funil",           prompt: "Como está meu funil esta semana?" },
                      { Icon: Users,       label: "Leads parados",              prompt: "Quais leads estão parados no pipeline?" },
                      { Icon: BadgeCheck,  label: "Leads qualificados",   prompt: "Me mostre os leads qualificados" },
                      { Icon: Calendar,    label: "Próximos agendamentos",      prompt: "Quais são meus próximos agendamentos?" },
                      { Icon: DollarSign,  label: "Vendas recentes",            prompt: "Me mostre as vendas fechadas recentemente" },
                      { Icon: Target,      label: "Meta do mês",                prompt: "Estou no caminho certo para bater a meta do mês?" },
                    ] as { Icon: React.ComponentType<any>; label: string; prompt: string }[]).map(({ Icon, label, prompt }) => (
                      <button
                        key={label}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => { sendMessage(prompt); setPlusMenuOpen(false); }}
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Pergunte algo, peça uma análise ou dê uma instrução..."
                className="flex-1 resize-none border-0 bg-transparent text-sm outline-none p-0 leading-normal placeholder:text-muted-foreground/50 overflow-y-auto"
                style={{ height: "20px", maxHeight: "160px" }}
                disabled={isStreaming}
              />
              {/* Pill seletor de modelo */}
              <div className="relative shrink-0">
                <button
                  ref={modelBtnRef}
                  onClick={openModelMenu}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-transparent hover:border-border/40"
                >
                  <span className="max-w-[110px] truncate">
                    {selectedModel === CUSTOM_SENTINEL
                      ? (customModelInput || "Custom")
                      : (MODELS.find(m => m.id === selectedModel)?.label ?? "Modelo")}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </button>
                {modelMenuOpen && createPortal(
                  <>
                    {/* Backdrop — raiz do DOM, sem stacking context de pai */}
                    <div className="fixed inset-0 z-[9998]" onClick={() => setModelMenuOpen(false)} />
                    {/* Dropdown */}
                    <div
                      className="fixed z-[9999] w-60 rounded-xl border border-border/60 bg-card shadow-xl py-1"
                      style={{ bottom: modelMenuPos.bottom, right: modelMenuPos.right }}
                    >
                      <div className="max-h-72 overflow-y-auto">
                        {MODELS.map(m => (
                          <button
                            key={m.id}
                            onClick={() => { handleModelChange(m.id); setModelMenuOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-muted/50 transition-colors text-left",
                              selectedModel === m.id && "bg-muted/40 font-semibold"
                            )}
                          >
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 uppercase tracking-wide min-w-[46px] text-center">{m.badge}</span>
                            <span className="truncate flex-1">{m.label}</span>
                            {selectedModel === m.id && <span className="text-[10px] text-emerald-500 shrink-0">✓</span>}
                          </button>
                        ))}
                      </div>
                      {selectedModel === CUSTOM_SENTINEL && (
                        <div className="px-3 pt-1 pb-2 border-t border-border/40 mt-1">
                          <input
                            type="text"
                            value={customModelInput}
                            onChange={e => handleCustomModelChange(e.target.value)}
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

              {(isStreaming || messages.some(m => m.isStreaming)) ? (
                <button
                  onClick={stopStreaming}
                  className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
                  title="Parar geração"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input, attachments)}
                  disabled={!input.trim() && !attachments.length}
                  className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-25 transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            </div>
            <p className="text-[10px] text-muted-foreground/30 text-center mt-2">
              Enter para enviar · Shift+Enter para nova linha · + para ações e arquivos
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Lightbox */}
    {lightboxUrl && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setLightboxUrl(null)}
      >
        <button
          className="absolute top-4 right-4 flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={() => setLightboxUrl(null)}
        >
          <X className="h-4 w-4" />
        </button>
        <img
          src={lightboxUrl}
          alt="Preview"
          className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConvItem({ conv, active, isPinned, onSelect, onRename, onPin, onArchive, onDelete }: {
  conv: OSConversation; active: boolean; isPinned: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(conv.titulo);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  const submitRename = () => {
    if (renameVal.trim() && renameVal.trim() !== conv.titulo) onRename(renameVal.trim());
    setRenaming(false);
  };

  return (
    <div
      onClick={renaming ? undefined : onSelect}
      className={cn(
        "group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
        active ? "bg-foreground/8 text-foreground" : "hover:bg-muted/40 text-foreground/60"
      )}
    >
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
            onClick={e => e.stopPropagation()}
            className="w-full bg-transparent border-b border-border text-[12px] font-medium outline-none py-0.5 text-foreground"
          />
        ) : (
          <>
            <p className={cn("text-[12px] truncate flex items-center gap-1", active ? "font-semibold" : "font-medium")}>
              {isPinned && <Pin className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />}
              {conv.titulo}
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              {formatDistanceToNow(parseISO(conv.atualizado_em), { locale: ptBR, addSuffix: true })}
            </p>
          </>
        )}
      </div>

      {!renaming && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-5 w-5 rounded text-muted-foreground/40 hover:text-foreground transition-all"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-50 w-44 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden py-1">
              <button
                onClick={e => { e.stopPropagation(); setRenaming(true); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted/50 transition-colors text-left"
              >
                <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" /> Renomear
              </button>
              <button
                onClick={e => { e.stopPropagation(); onPin(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted/50 transition-colors text-left"
              >
                <Pin className="h-3 w-3 shrink-0 text-muted-foreground" /> {isPinned ? "Desafixar" : "Fixar"}
              </button>
              <button
                onClick={e => { e.stopPropagation(); onArchive(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted/50 transition-colors text-left"
              >
                <Archive className="h-3 w-3 shrink-0 text-muted-foreground" /> Arquivar
              </button>
              <div className="my-1 border-t border-border/40" />
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(e); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted/50 transition-colors text-left text-destructive"
              >
                <Trash2 className="h-3 w-3 shrink-0" /> Excluir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({ onSuggestion, userName }: { onSuggestion: (text: string) => void; userName?: string }) {
  const firstName = userName?.split(' ')[0];

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-8">
      {/* Floating particles — só os pequenos, blobs ficam no bg da página */}
      <div className="os-particle absolute top-[15%] right-[24%] w-1.5 h-1.5 rounded-full bg-amber-400/15 pointer-events-none" />
      <div className="os-particle-2 absolute bottom-[25%] left-[18%] w-1 h-1 rounded-full bg-violet-400/12 pointer-events-none" />
      <div className="os-particle-3 absolute top-[55%] right-[15%] w-[3px] h-[3px] rounded-full bg-cyan-400/10 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center -mt-8">

        {/* Orb — compacto, iridescente */}
        <div className="relative mx-auto mb-5" style={{ width: '140px', height: '140px' }}>
          {/* Outer rings */}
          <div className="os-ring absolute" style={{ inset: '14px' }} />
          <div className="os-ring-2 absolute" style={{ inset: '4px' }} />

          {/* Orb body */}
          <div className="absolute" style={{ inset: '22px' }}>
            <div className="os-orb absolute inset-0">
              <div className="os-orb-shimmer" />
            </div>
            <div className="os-orb-highlight absolute inset-0 pointer-events-none" />
            <div className="os-orb-rim" />
          </div>

          {/* Orbiting particles */}
          <div className="os-orbit absolute" style={{ inset: '10px' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300/70 shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
            <div className="absolute bottom-[8%] right-[5%] w-1 h-1 rounded-full bg-violet-400/60 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
            <div className="absolute top-[38%] left-0 w-[3px] h-[3px] rounded-full bg-pink-400/50 shadow-[0_0_6px_rgba(236,72,153,0.4)]" />
          </div>
        </div>

        {/* Greeting + Headline */}
        {firstName && (
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30 mb-1.5">
            Olá, {firstName}
          </p>
        )}
        <h1
          className="text-[32px] font-bold font-display leading-[1.1] tracking-tight mb-2"
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #8b5cf6 50%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Como posso ajudar?
        </h1>
        <p className="text-[12px] text-muted-foreground/40 mb-6 max-w-[240px] leading-relaxed">
          Acesso total ao CRM — pergunte, analise e execute.
        </p>

        {/* Feature pills — single row */}
        <div className="flex items-center justify-center gap-4 mb-0">
          {FEATURE_PILLS.map(({ Icon, label }, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Icon className="h-2.5 w-2.5 text-muted-foreground/20" />
              <span className="text-[10px] text-muted-foreground/30 tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onImageClick }: { msg: OSMessage; onImageClick: (url: string) => void }) {
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!msg.isStreaming) { setElapsedSec(0); return; }
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [msg.isStreaming]);

  if (msg.role === "user") {
    const images = msg.attachmentPreviews?.filter(a => a.isImage) ?? [];
    const files = msg.attachmentPreviews?.filter(a => !a.isImage) ?? [];
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-1.5 max-w-[75%]">
          {images.length > 0 && (
            <div className={cn("grid gap-1.5", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {images.map((img, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden border border-border/20 cursor-zoom-in"
                  style={{ maxWidth: images.length === 1 ? 280 : 160 }}
                  onClick={() => onImageClick(img.url)}>
                  <img src={img.url} alt={img.name} className="w-full object-cover block" style={{ maxHeight: 200 }} />
                </div>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="flex flex-col gap-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/10 border border-border/30">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[12px] text-foreground/70 truncate max-w-[180px]">{f.name}</span>
                </div>
              ))}
            </div>
          )}
          {msg.content && (
            <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-foreground text-background text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="shrink-0 mt-1 flex items-center justify-center w-7 h-7 rounded-xl bg-muted/30 border border-border/30">
        <div className="w-3 h-3 rounded-full os-orb" style={{ animation: 'os-iridescent 12s ease infinite', boxShadow: '0 0 6px rgba(80,140,230,0.12)' }} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.tool_calls.map((tc, i) => <ToolCard key={i} call={tc} />)}
          </div>
        )}

        {msg.content ? (
          <div className="text-foreground">
            <MessageContent content={msg.content} />
            {msg.isStreaming && (
              <span className="inline-block w-[3px] h-4 bg-foreground/30 rounded-sm ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        ) : msg.errorMessage ? (
          <div className="flex flex-col gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-[13px] text-destructive">{msg.errorMessage}</span>
            </div>
            {msg.retryText && (
              <button
                onClick={() => sendMessage(msg.retryText!)}
                className="flex items-center gap-1.5 self-start rounded-md bg-destructive/15 hover:bg-destructive/25 border border-destructive/20 px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Tentar novamente
              </button>
            )}
          </div>
        ) : msg.isStreaming && (!msg.tool_calls || msg.tool_calls.every(tc => tc.status === "done")) ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
            {msg.processingAttachments ? (
              <span className="text-[13px] text-muted-foreground">
                Analisando {msg.processingAttachments} anexo{msg.processingAttachments > 1 ? "s" : ""}...
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">Pensando...</span>
            )}
            {elapsedSec > 0 && (
              <span className="text-[11px] text-muted-foreground/50 tabular-nums">{elapsedSec}s</span>
            )}
          </div>
        ) : null}

        {!msg.isStreaming && msg.usage && (
          <UsageBar usage={msg.usage} />
        )}
      </div>
    </div>
  );
}

// ── Usage Bar ─────────────────────────────────────────────────────────────────

function UsageBar({ usage }: { usage: NonNullable<OSMessage["usage"]> }) {
  const ctx = MODEL_CONTEXT[usage.model];
  const ctxPct = ctx ? Math.min(Math.round((usage.inputTokens / ctx) * 100), 100) : null;

  const fmtN = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(1)}k`
    : String(n);

  const timeStr =
    usage.totalTimeMs < 1_000   ? `${usage.totalTimeMs}ms`
    : usage.totalTimeMs < 60_000 ? `${(usage.totalTimeMs / 1_000).toFixed(1)}s`
    : `${Math.floor(usage.totalTimeMs / 60_000)}m${Math.round((usage.totalTimeMs % 60_000) / 1_000)}s`;

  const ctxLabel = ctx
    ? ctx >= 1_000_000 ? `${ctx / 1_000_000}M` : `${ctx / 1_000}k`
    : null;

  const barColor =
    ctxPct !== null && ctxPct > 90 ? "bg-red-400/40"
    : ctxPct !== null && ctxPct > 70 ? "bg-amber-400/40"
    : "bg-muted-foreground/20";

  const ctxTextColor =
    ctxPct !== null && ctxPct > 90 ? "text-red-400/70"
    : ctxPct !== null && ctxPct > 70 ? "text-amber-400/70"
    : "";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-border/15 select-none">

      {/* Input tokens */}
      <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums text-muted-foreground/40"
           title="Tokens de entrada (contexto enviado ao modelo)">
        <ArrowDownToLine className="h-2.5 w-2.5 shrink-0" />
        <span>{fmtN(usage.inputTokens)}</span>
      </div>

      {/* Output tokens */}
      <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums text-muted-foreground/40"
           title="Tokens gerados pelo modelo">
        <ArrowUpFromLine className="h-2.5 w-2.5 shrink-0" />
        <span>{fmtN(usage.outputTokens)}</span>
      </div>

      {/* Time */}
      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40"
           title="Tempo total de processamento">
        <Clock className="h-2.5 w-2.5 shrink-0" />
        <span>{timeStr}</span>
      </div>

      {/* Tool calls */}
      {usage.toolCallsCount > 0 && (
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40"
             title="Chamadas de ferramentas executadas">
          <Zap className="h-2.5 w-2.5 shrink-0" />
          <span>{usage.toolCallsCount} tool{usage.toolCallsCount !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Context window bar */}
      {ctxPct !== null && ctxLabel && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/40"
             title={`Janela de contexto: ${fmtN(usage.inputTokens)} / ${ctxLabel} tokens`}>
          <div className="w-14 h-[3px] bg-muted/50 rounded-full overflow-hidden shrink-0">
            <div className={cn("h-full rounded-full transition-all", barColor)}
                 style={{ width: `${ctxPct}%` }} />
          </div>
          <span className={cn("tabular-nums", ctxTextColor)}>{ctxPct}%</span>
          <span className="text-muted-foreground/25">/ {ctxLabel}</span>
        </div>
      )}

      {/* Model name */}
      <div className="ml-auto text-[9px] font-mono text-muted-foreground/25 truncate max-w-[150px]"
           title={usage.model}>
        {usage.model.split("/").pop()}
      </div>

    </div>
  );
}
