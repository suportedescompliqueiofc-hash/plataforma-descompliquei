import { useEffect, useRef, useState } from "react";
import {
  X, Send, Square, Loader2, Paperclip, Mic, FileText, AlertCircle, RefreshCw, Plus, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AthosChatStyles } from "@/components/ai/AthosChatStyles";
import { AthosOrbAvatar } from "@/components/ai/AthosOrbAvatar";
import { MessageContent } from "@/components/ai/MessageContent";
import { ToolCard } from "@/components/ai/ToolCard";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useAthosPanelChat, processFiles, type Attachment, type AthosPanelMessage,
} from "@/hooks/useAthosPanelChat";

const SUGESTOES = [
  "Crie um script de atendimento pra essa página",
  "Resuma o conteúdo desta página",
  "Reescreva de um jeito mais direto",
  "Monta uma quebra de objeção sobre valor",
];

interface AthosPanelProps {
  paginaId: string;
  paginaTitulo: string;
  onClose: () => void;
}

// Painel embutido do Athos dentro de Notas — MESMA estética/sistemática do
// chat principal (DescompliqueiOS.tsx): orbe, glow do composer, bolhas,
// tool cards, anexos, botão "+". Ver skill "athos-gs-chat" pra replicar em
// outro lugar sem deixar essas peças divergirem de novo. Modelo não é
// escolhido aqui — o backend sempre usa o modelo configurado em athos_config.
export function AthosPanel({ paginaId, paginaTitulo, onClose }: AthosPanelProps) {
  const { messages, isStreaming, send, stop } = useAthosPanelChat(paginaId, paginaTitulo);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value && !attachments.length) return;
    send(value, attachments);
    setInput("");
    setAttachments([]);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newAtts = await processFiles(files);
    setAttachments((prev) => [...prev, ...newAtts]);
    e.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <AthosChatStyles />

      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/[0.03] shrink-0">
        <AthosOrbAvatar className="w-8 h-8" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Athos</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">Consultivo — te ajuda a construir esta página</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-[12.5px] text-muted-foreground/70 leading-relaxed">
              Pergunte, peça pra criar ou ajustar o conteúdo desta página. O Athos busca dado real da sua clínica antes de gerar material.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left rounded-xl border border-border/60 px-3 py-2 text-[12px] text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} onRetry={(text) => send(text)} />
        ))}
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {attachments.map((att) => att.mimeType.startsWith("image/") && att.previewUrl ? (
            <div key={att.id} className="relative group rounded-xl overflow-hidden border border-border/40 bg-muted/40 shrink-0">
              <img src={att.previewUrl} alt={att.name} className="h-16 w-auto max-w-[120px] object-cover block" />
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : (
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

      <div className="px-3 pt-2 pb-3 shrink-0">
        <div className="os-input-glow">
          <div className="relative flex items-center gap-3 rounded-[16.5px] bg-card px-4 py-3.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,audio/*,.pdf,.txt,.docx,.doc,.xlsx,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isStreaming}
                  className="flex items-center justify-center h-7 w-7 rounded-lg transition-all disabled:opacity-30 text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  Adicionar arquivo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {SUGESTOES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleSend(s)} className="gap-2.5">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <textarea
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Peça pro Athos..."
              className="flex-1 resize-none border-0 bg-transparent text-sm outline-none p-0 leading-normal placeholder:text-muted-foreground/50 overflow-y-auto"
              style={{ height: "20px", maxHeight: "120px" }}
              disabled={isStreaming}
            />

            {isStreaming ? (
              <button
                onClick={stop}
                className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
                title="Parar geração"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
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
  );
}

function MessageBubble({ msg, onRetry }: { msg: AthosPanelMessage; onRetry: (text: string) => void }) {
  if (msg.role === "user") {
    const images = msg.attachmentPreviews?.filter((a) => a.isImage) ?? [];
    const files = msg.attachmentPreviews?.filter((a) => !a.isImage) ?? [];
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-1.5 max-w-[85%]">
          {images.length > 0 && (
            <div className={cn("grid gap-1.5", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {images.map((img, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden border border-border/20" style={{ maxWidth: 160 }}>
                  <img src={img.url} alt={img.name} className="w-full object-cover block" style={{ maxHeight: 140 }} />
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
            <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-foreground text-background text-sm leading-relaxed whitespace-pre-wrap break-words">
              {msg.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <AthosOrbAvatar className="w-7 h-7" />
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
                onClick={() => onRetry(msg.retryText!)}
                className="flex items-center gap-1.5 self-start rounded-md bg-destructive/15 hover:bg-destructive/25 border border-destructive/20 px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Tentar novamente
              </button>
            )}
          </div>
        ) : msg.isStreaming ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
            <span className="text-[13px] text-muted-foreground">
              {msg.processingAttachments
                ? `Analisando ${msg.processingAttachments} anexo${msg.processingAttachments > 1 ? "s" : ""}...`
                : "Pensando..."}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
