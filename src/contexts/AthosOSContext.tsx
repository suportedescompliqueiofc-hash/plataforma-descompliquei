import {
  createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ToolCallEvent } from "@/components/ai/ToolCard";

// Estado do chat do Athos (DescompliqueiOS) vive aqui, num provider montado
// ACIMA das <Routes> (ver App.tsx) — assim ele sobrevive quando o usuário navega
// para outra página e volta, em vez de resetar junto com o unmount da rota.

const LS_CONV_KEY = (agentSlug: string | null) => `descompliquei_os_conv_${agentSlug ?? "default"}`;

export const MODEL_CONTEXT: Record<string, number> = {
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

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
}

export interface OSConversation {
  id: string;
  titulo: string;
  criado_em: string;
  atualizado_em: string;
}

export interface OSMessage {
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

export interface AthosAgente {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  system_prompt: string;
}

interface AthosOSContextValue {
  agentes: AthosAgente[];
  selectedAgentSlug: string | null;
  setSelectedAgentSlug: (slug: string | null) => void;
  agentPickerOpen: boolean;
  setAgentPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  conversations: OSConversation[];
  currentConversationId: string | null;
  messages: OSMessage[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isStreaming: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  loadingConv: boolean;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  plusMenuOpen: boolean;
  setPlusMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  lightboxUrl: string | null;
  setLightboxUrl: (url: string | null) => void;
  pinnedIds: Set<string>;
  archivedIds: Set<string>;
  showArchived: boolean;
  setShowArchived: React.Dispatch<React.SetStateAction<boolean>>;
  /** true = a próxima renderização da lista de mensagens deve pular a animação de scroll */
  justLoadedRef: React.MutableRefObject<boolean>;
  selectConversation: (conv: OSConversation) => void;
  newConversation: () => void;
  deleteConversation: (convId: string, e: React.MouseEvent) => void;
  renameConversation: (convId: string, title: string) => void;
  pinConversation: (convId: string) => void;
  archiveConversation: (convId: string) => void;
  unarchiveConversation: (convId: string) => void;
  sendMessage: (text: string, atts?: Attachment[]) => Promise<void>;
  stopStreaming: () => void;
  processFiles: (files: File[]) => Promise<Attachment[]>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => Promise<void>;
  removeAttachment: (id: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Reseta para uma conversa em branco com um texto inicial no compositor (fluxos de deep-link) */
  startFreshConversation: (initialInput: string) => void;
  /** Registra um passo de jornada pendente de vínculo automático quando a próxima geração terminar */
  startPendingPasso: (passoId: string) => void;
}

const AthosOSContext = createContext<AthosOSContextValue | null>(null);

export function AthosOSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [agentes, setAgentes] = useState<AthosAgente[]>([]);
  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string | null>(null);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [conversations, setConversations] = useState<OSConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OSMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("os_pinned") ?? "[]")); } catch { return new Set(); }
  });
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("os_archived") ?? "[]")); } catch { return new Set(); }
  });
  const [showArchived, setShowArchived] = useState(false);

  const jornadaSalvaRef = useRef(false);
  const autoStartRef = useRef(false);
  const conversationsLoadedRef = useRef(false);
  const hasAutoRestoredRef = useRef(false);
  const pendingPassoRef = useRef<{ id: string; since: string } | null>(null);
  const prevStreamingRef = useRef(false);
  const justLoadedRef = useRef(true);

  // Flush function ref — chamado pelo visibilitychange para descongelar ao voltar à aba
  const flushStreamRef = useRef<(() => void) | null>(null);
  // Abort controller do fetch ativo — permite cancelar o stream
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = () => {
    flushSync(() => {
      setIsStreaming(false);
      setMessages(prev => prev.map(m => m.isStreaming
        ? { ...m, isStreaming: false, processingAttachments: undefined }
        : m));
    });
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

  // Carrega agentes disponíveis
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("athos_agentes").select("id, slug, nome, descricao, system_prompt")
      .eq("ativo", true).order("created_at")
      .then(({ data }: any) => { if (data) setAgentes(data); });
  }, [user?.id]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingConv(true);
    justLoadedRef.current = true;
    const { data } = await supabase
      .from("os_messages" as any)
      .select("id, role, content, tool_calls, criado_em")
      .eq("conversation_id", convId)
      .order("criado_em", { ascending: true });
    if (data) setMessages((data as any[]).map(m => ({ ...m, tool_calls: m.tool_calls ?? undefined })));
    setLoadingConv(false);
  }, []);

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
    if (data) {
      setConversations(data as any);
      // Auto-restaura a última conversa aberta — apenas uma vez, no "cold start" do
      // provider (ele persiste entre navegações, então isso não deve repetir a cada
      // vez que o usuário volta para a página). Fluxos de deep-link (ver
      // startFreshConversation) marcam hasAutoRestoredRef antes disso se chegarem primeiro.
      if (!hasAutoRestoredRef.current) {
        hasAutoRestoredRef.current = true;
        const savedId = localStorage.getItem(LS_CONV_KEY(selectedAgentSlug));
        if (savedId && (data as any[]).some((c: any) => c.id === savedId)) {
          setCurrentConversationId(savedId);
          loadMessages(savedId);
        }
      }
    }
    conversationsLoadedRef.current = true;
  }, [user, selectedAgentSlug, loadMessages]);

  useEffect(() => {
    autoStartRef.current = false;
    conversationsLoadedRef.current = false;
  }, [selectedAgentSlug]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Auto-vínculo: quando um stream termina e há passo pendente, vincula o material
  // recém-criado (o mais recente desde o deep-link) ao passo da jornada e marca concluído.
  useEffect(() => {
    const was = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;
    if (!was || isStreaming || !pendingPassoRef.current || !user) return;
    const { id, since } = pendingPassoRef.current;
    (async () => {
      const { data } = await supabase
        .from("meus_materiais").select("id")
        .eq("user_id", user.id).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if ((data as any)?.id) {
        await (supabase as any).from("jornada_passos")
          .update({ material_id: (data as any).id, concluido: true, concluido_em: new Date().toISOString(), concluido_por: user.id })
          .eq("id", id);
        pendingPassoRef.current = null;
        toast.success("Material vinculado à sua jornada!");
      }
    })();
  }, [isStreaming, user]);

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

    flushStreamRef.current = flushText;

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => { flushTimer = null; flushText(); }, 80);
    };

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let cancelReaderOnAbort: (() => void) | null = null;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    let timedOutByInactivity = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const history = messages.filter(m => !m.isStreaming).slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const selectedAgent = agentes.find(a => a.slug === selectedAgentSlug);
      let systemPromptOverride = selectedAgent?.system_prompt ?? undefined;

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
          attachments: atts.map(a => ({ name: a.name, mimeType: a.mimeType, base64: a.base64 })),
          ...(systemPromptOverride ? { system_prompt_override: systemPromptOverride } : {}),
        }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (!res.body) throw new Error("Stream vazio");

      const reader = res.body.getReader();
      cancelReaderOnAbort = () => { reader.cancel().catch(() => {}); };
      abortController.signal.addEventListener("abort", cancelReaderOnAbort, { once: true });
      const decoder = new TextDecoder();
      let buffer = "";
      const INACTIVITY_TIMEOUT_MS = 30_000;
      inactivityTimer = setTimeout(() => {
        timedOutByInactivity = true;
        abortController.abort();
      }, INACTIVITY_TIMEOUT_MS);
      const resetInactivity = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
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
              localStorage.setItem(LS_CONV_KEY(selectedAgentSlug), ev.conversation_id);
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

      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (cancelReaderOnAbort) abortController.signal.removeEventListener("abort", cancelReaderOnAbort);
      flushText();
      setMessages(prev => prev.map(m => m.id === aId && m.isStreaming
        ? { ...m, isStreaming: false, processingAttachments: undefined,
            ...(!m.content && !abortController.signal.aborted
              ? { errorMessage: "Conexão perdida com o servidor. Tente novamente." }
              : {}) }
        : m));
    } catch (err: any) {
      flushStreamRef.current = null;
      if (flushTimer) clearTimeout(flushTimer);
      if (cancelReaderOnAbort) abortController.signal.removeEventListener("abort", cancelReaderOnAbort);
      if (err.name === "AbortError") {
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

  // Hard timeout — 120s absolutos, roda enquanto qualquer mensagem estiver em streaming,
  // independente da página do Athos estar montada ou não.
  useEffect(() => {
    const hasAnyStreaming = isStreaming || messages.some(m => m.isStreaming);
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
  }, [isStreaming, messages]);

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

  const selectConversation = (conv: OSConversation) => {
    setCurrentConversationId(conv.id);
    localStorage.setItem(LS_CONV_KEY(selectedAgentSlug), conv.id);
    loadMessages(conv.id);
  };

  const newConversation = () => {
    setCurrentConversationId(null);
    localStorage.removeItem(LS_CONV_KEY(selectedAgentSlug));
    setMessages([]);
    justLoadedRef.current = true;
    jornadaSalvaRef.current = false;
  };

  const startFreshConversation = (initialInput: string) => {
    hasAutoRestoredRef.current = true; // evita que o auto-restore (ainda em voo) sobrescreva este reset
    setCurrentConversationId(null);
    setMessages([]);
    justLoadedRef.current = true;
    localStorage.removeItem(LS_CONV_KEY(selectedAgentSlug));
    setInput(initialInput);
  };

  const startPendingPasso = (passoId: string) => {
    pendingPassoRef.current = { id: passoId, since: new Date().toISOString() };
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("os_conversations" as any).delete().eq("id", convId);
    if (currentConversationId === convId) newConversation();
    setConversations(prev => prev.filter(c => c.id !== convId));
  };

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
        const ext = item.type.split("/")[1] ?? "png";
        return new File([file], `print-${i + 1}.${ext}`, { type: item.type });
      });
    if (!imageFiles.length) return;
    e.preventDefault();
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

  const value: AthosOSContextValue = {
    agentes, selectedAgentSlug, setSelectedAgentSlug, agentPickerOpen, setAgentPickerOpen,
    conversations, currentConversationId, messages, input, setInput, isStreaming,
    sidebarOpen, setSidebarOpen, loadingConv, attachments, setAttachments,
    plusMenuOpen, setPlusMenuOpen, lightboxUrl, setLightboxUrl,
    pinnedIds, archivedIds, showArchived, setShowArchived,
    justLoadedRef,
    selectConversation, newConversation, deleteConversation, renameConversation,
    pinConversation, archiveConversation, unarchiveConversation,
    sendMessage, stopStreaming, processFiles, handleFileSelect, handlePaste,
    removeAttachment, handleKeyDown, startFreshConversation, startPendingPasso,
  };

  return <AthosOSContext.Provider value={value}>{children}</AthosOSContext.Provider>;
}

export function useAthosOS() {
  const ctx = useContext(AthosOSContext);
  if (!ctx) throw new Error("useAthosOS deve ser usado dentro de AthosOSProvider");
  return ctx;
}
