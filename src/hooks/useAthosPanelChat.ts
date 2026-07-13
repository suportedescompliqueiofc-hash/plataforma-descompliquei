import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import type { ToolCallEvent } from "@/components/ai/ToolCard";

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
}

export interface AthosPanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallEvent[];
  isStreaming?: boolean;
  processingAttachments?: number;
  errorMessage?: string;
  retryText?: string;
  attachmentPreviews?: Array<{ url: string; name: string; isImage: boolean }>;
}

const PAGE_TOOLS = new Set(["criar_pagina", "atualizar_pagina", "mover_pagina", "excluir_pagina"]);
const MAX_MB = 20;

function convKey(paginaId: string) {
  return `notas_athos_conv_${paginaId}`;
}

// processFiles/base64 — mesmo comportamento de DescompliqueiOS.tsx (limite de
// tamanho, preview de imagem via blob URL, leitura em base64 pro backend).
export async function processFiles(files: File[]): Promise<Attachment[]> {
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
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    newAtts.push({ id: crypto.randomUUID(), name: file.name, mimeType: file.type, base64, previewUrl });
  }
  return newAtts;
}

// Reaproveita a MESMA sistemática de streaming/tool-calls do chat do Athos GS
// (DescompliqueiOS.tsx → edge function descompliquei-os), só que embutida como
// widget dentro de uma página de Notas — mesmo protocolo SSE, mesma engine.
export function useAthosPanelChat(paginaId: string, paginaTitulo: string) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<AthosPanelMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const conversationIdRef = useRef<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(convKey(paginaId)) : null
  );
  const abortRef = useRef<AbortController | null>(null);

  async function send(text: string, atts: Attachment[] = []) {
    const trimmed = text.trim();
    if ((!trimmed && !atts.length) || isStreaming) return;

    const isFirstMessage = messages.length === 0;
    const payloadText = isFirstMessage
      ? `[Contexto: estamos dentro da página "${paginaTitulo}" (pagina_id: ${paginaId}) em Notas. Quando eu pedir pra criar, ajustar, reescrever ou melhorar o conteúdo "desta página"/"aqui", use atualizar_pagina com pagina_id="${paginaId}" — só crie uma página nova se eu pedir explicitamente.]\n\n${trimmed}`
      : trimmed;

    const userMsg: AthosPanelMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      attachmentPreviews: atts.length > 0 ? atts.map((a) => ({
        url: a.previewUrl ?? "",
        name: a.name,
        isImage: a.mimeType.startsWith("image/") && !!a.previewUrl,
      })) : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const aId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: aId, role: "assistant", content: "", tool_calls: [], isStreaming: true }]);

    const activeToolCalls: ToolCallEvent[] = [];
    let streamedText = "";

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const history = messages.filter((m) => !m.isStreaming).map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${SUPABASE_URL}/functions/v1/descompliquei-os`, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: payloadText,
          conversation_id: conversationIdRef.current,
          history,
          attachments: atts.map((a) => ({ name: a.name, mimeType: a.mimeType, base64: a.base64 })),
        }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (!res.body) throw new Error("Stream vazio");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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

          if (ev.type === "processing_attachments") {
            setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, processingAttachments: ev.count } : m)));
          }
          if (ev.type === "attachments_done") {
            setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, processingAttachments: undefined } : m)));
          }
          if (ev.type === "tool_start") {
            activeToolCalls.push({ tool: ev.tool, input: ev.input, status: "running" });
            const tc = [...activeToolCalls];
            setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, tool_calls: tc } : m)));
          }
          if (ev.type === "tool_result") {
            const idx = [...activeToolCalls].reverse().findIndex((tc) => tc.tool === ev.tool && tc.status === "running");
            const ri = idx >= 0 ? activeToolCalls.length - 1 - idx : -1;
            if (ri >= 0) activeToolCalls[ri] = { ...activeToolCalls[ri], result: ev.result, status: "done" };
            const tc = [...activeToolCalls];
            setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, tool_calls: tc } : m)));

            // Athos alterou uma página — refaz a árvore e, se for a página aberta, o conteúdo dela.
            if (PAGE_TOOLS.has(ev.tool)) {
              qc.invalidateQueries({ queryKey: ["paginas-arvore"] });
              const afetada = ev.result?.pagina?.id ?? ev.result?.pagina_id;
              if (afetada) qc.invalidateQueries({ queryKey: ["pagina", afetada] });
            }
          }
          if (ev.type === "text_delta") {
            streamedText += ev.delta;
            const snapshot = streamedText;
            setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, content: snapshot } : m)));
          }
          if (ev.type === "done") {
            if (ev.conversation_id && !conversationIdRef.current) {
              conversationIdRef.current = ev.conversation_id;
              localStorage.setItem(convKey(paginaId), ev.conversation_id);
            }
            setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, isStreaming: false } : m)));
          }
          if (ev.type === "error") throw new Error(ev.message);
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        const errMsg = err?.message || "Erro ao consultar o Athos.";
        setMessages((prev) => prev.map((m) => (m.id === aId
          ? { ...m, isStreaming: false, processingAttachments: undefined, errorMessage: errMsg, retryText: trimmed }
          : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, isStreaming: false, processingAttachments: undefined } : m)));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return { messages, isStreaming, send, stop };
}
