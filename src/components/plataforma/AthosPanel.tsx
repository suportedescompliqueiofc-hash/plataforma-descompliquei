import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, Trash2, PanelRightClose, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Editor } from '@tiptap/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'athos';
  content: string;
  isStreaming?: boolean;
}

export interface AthosPanelProps {
  editor: Editor | null;
  ferrSlug: string;
  ferramentaNome: string;
  ferramentaDescricao: string;
  ferramentaContexto: string | null;
  categoriaNome: string;
  onClose: () => void;
}

// ─── Display filter — oculta <TEMPLATE_UPDATE> do chat em tempo real ──────────

function looksLikeTemplate(content: string): boolean {
  if (!content) return false;
  return /<(h[1-6]|ul|ol|li|strong|p)\b/i.test(content) || /<TEMPLATE_UPDATE>/i.test(content);
}

function getDisplayContent(content: string): string {
  const withoutBlock = content.replace(/<TEMPLATE_UPDATE>[\s\S]*?<\/TEMPLATE_UPDATE>/gi, '').trim();
  if (withoutBlock !== content) return withoutBlock;
  const openIdx = content.search(/<TEMPLATE_UPDATE>/i);
  if (openIdx !== -1) return content.slice(0, openIdx).trim();
  return content;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function inline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted/60 px-1 rounded text-[11px] font-mono">$1</code>');
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      const level = hm[1].length;
      const cls = level <= 2
        ? 'text-[13px] font-bold text-foreground mt-2 mb-0.5'
        : 'text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-2 mb-0.5';
      elements.push(
        <p key={i} className={cls} dangerouslySetInnerHTML={{ __html: inline(hm[2]) }} />
      );
      i++; continue;
    }

    const isListLine = (l: string) => /^[\-\*•]\s+/.test(l.trim()) || /^\d+[.)]\s+/.test(l.trim());
    const isOrdered = (l: string) => /^\d+[.)]\s+/.test(l.trim());
    if (isListLine(line)) {
      const items: string[] = [];
      const ordered = isOrdered(line);
      while (i < lines.length && isListLine(lines[i])) {
        items.push(lines[i].replace(/^[\-\*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim());
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      elements.push(
        <Tag key={i} className={`pl-4 space-y-0.5 ${ordered ? 'list-decimal' : 'list-disc'} list-outside`}>
          {items.map((item, j) => (
            <li key={j} className="text-[12px] leading-relaxed" dangerouslySetInnerHTML={{ __html: inline(item) }} />
          ))}
        </Tag>
      );
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-border/30 my-1" />);
      i++; continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i]) && !/^[\-\*•]\s/.test(lines[i].trim()) && !/^\d+\.\s/.test(lines[i].trim())) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      elements.push(
        <p key={i} className="text-[12px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: inline(para.join(' ')) }} />
      );
    }
  }

  return <div className="space-y-1.5">{elements}</div>;
}

// ─── Athos Bubble ─────────────────────────────────────────────────────────────

function AthosBubble({ msg, onApply }: { msg: ChatMessage; onApply: (c: string) => void }) {
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!msg.isStreaming) { setElapsedSec(0); return; }
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [msg.isStreaming]);

  const isHtml = /<[a-z][\s\S]*>/i.test(msg.content);

  // onApply is kept in props for potential future use — not wired to a button currently
  void onApply;

  return (
    <div className="max-w-[95%] space-y-2">
      <div className="px-3 py-2.5 rounded-xl bg-muted/40 border border-border/40 text-foreground/80">
        {msg.isStreaming && looksLikeTemplate(msg.content) ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
            <span className="text-[13px] text-muted-foreground">Atualizando editor...</span>
            {elapsedSec > 0 && (
              <span className="text-[11px] text-muted-foreground/50 tabular-nums">{elapsedSec}s</span>
            )}
          </div>
        ) : msg.isStreaming && !msg.content ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
            <span className="text-[13px] text-muted-foreground">Pensando...</span>
            {elapsedSec > 0 && (
              <span className="text-[11px] text-muted-foreground/50 tabular-nums">{elapsedSec}s</span>
            )}
          </div>
        ) : isHtml ? (
          <div
            className="prose prose-sm max-w-none text-[12px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: msg.content }}
          />
        ) : (
          <MarkdownContent content={getDisplayContent(msg.content)} />
        )}
      </div>
    </div>
  );
}

// ─── Athos Panel ──────────────────────────────────────────────────────────────

export function AthosPanel({
  editor,
  ferrSlug,
  ferramentaNome,
  ferramentaDescricao,
  ferramentaContexto,
  categoriaNome,
  onClose,
}: AthosPanelProps) {
  const storageKey = `athos_chat_${ferrSlug}`;

  const makeWelcome = (nome: string): ChatMessage => ({
    id: crypto.randomUUID(),
    role: 'athos',
    content: `Olá! Estou aqui para te ajudar a construir **${nome}**.\n\nPode me perguntar qualquer coisa, pedir exemplos específicos para a sua clínica ou me pedir para gerar um trecho do conteúdo — você decide se quer aplicar no editor.`,
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [makeWelcome(ferramentaNome)];
    } catch {
      return [makeWelcome(ferramentaNome)];
    }
  });

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages, storageKey]);

  useEffect(() => {
    supabase.from('athos_agentes' as any)
      .select('system_prompt')
      .eq('slug', 'arsenal-copiloto')
      .single()
      .then(({ data }) => { if (data) setAgentPrompt((data as any).system_prompt); });
  }, []);

  const clearChat = () => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setMessages([makeWelcome(ferramentaNome)]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  const buildFerramentaContext = useCallback(() => {
    const editorHtml = editor?.isEmpty ? '' : (editor?.getHTML() ?? '');
    const stripHtml = (html: string) =>
      html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return [
      `FERRAMENTA: ${ferramentaNome}`,
      categoriaNome ? `CATEGORIA: ${categoriaNome}` : '',
      ferramentaDescricao ? `DESCRIÇÃO: ${ferramentaDescricao}` : '',
      ferramentaContexto ? `\nCONHECIMENTO DA FERRAMENTA (use como base para guiar o cliente):\n${stripHtml(ferramentaContexto)}` : '',
      editorHtml.trim() ? `\nO QUE O CLIENTE JÁ ESCREVEU NO EDITOR (HTML — copie exatamente e altere só o campo pedido):\n${editorHtml}` : '',
    ].filter(Boolean).join('\n');
  }, [ferramentaNome, ferramentaDescricao, ferramentaContexto, categoriaNome, editor]);

  const applyToEditor = useCallback((content: string) => {
    if (!editor) return;
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    if (isHtml) {
      editor.commands.insertContent(content);
    } else {
      editor.commands.insertContent(`<p>${content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`);
    }
    toast.success('Conteúdo aplicado no editor');
  }, [editor]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !agentPrompt) return;

    const trimmed = text.trim();
    const athosMsgId = crypto.randomUUID();

    const history = messagesRef.current
      .filter(m => !m.isStreaming)
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
      { id: athosMsgId, role: 'athos', content: '', isStreaming: true },
    ]);
    setInput('');
    setIsStreaming(true);

    let streamedText = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushText = () => {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      const snapshot = streamedText;
      setMessages(prev => prev.map(m => m.id === athosMsgId ? { ...m, content: snapshot } : m));
    };
    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => { flushTimer = null; flushText(); }, 80);
    };

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sem sessão');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/descompliquei-os`, {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          history,
          system_prompt_override: agentPrompt,
          ferramenta_context: buildFerramentaContext(),
          tools_override: [],
        }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          let ev: any;
          try { ev = JSON.parse(raw); } catch { continue; }

          if (ev.type === 'text_delta' && ev.delta) {
            streamedText += ev.delta;
            scheduleFlush();
          } else if (ev.type === 'done') {
            flushText();
          }
        }
      }

      flushText();

      const templateMatch = streamedText.match(/<TEMPLATE_UPDATE>([\s\S]*?)<\/TEMPLATE_UPDATE>/i);
      if (templateMatch && editor) {
        const templateHtml = templateMatch[1].trim();
        editor.commands.setContent(templateHtml);
        const cleanText = getDisplayContent(streamedText);
        setMessages(prev => prev.map(m => m.id === athosMsgId
          ? { ...m, content: cleanText, isStreaming: false }
          : m
        ));
        toast.success('Conteúdo atualizado no editor');
      } else {
        setMessages(prev => prev.map(m => m.id === athosMsgId ? { ...m, isStreaming: false } : m));
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setMessages(prev => prev.map(m => m.id === athosMsgId
        ? { ...m, content: 'Erro ao conectar. Tente novamente.', isStreaming: false }
        : m
      ));
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isStreaming, agentPrompt, buildFerramentaContext, editor]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-foreground/5">
            <Bot className="h-3.5 w-3.5 text-foreground/70" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-foreground">Athos</p>
            <p className="text-[10px] text-muted-foreground/50">Copiloto do Arsenal</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} title="Limpar conversa"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <PanelRightClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex flex-col gap-1.5', msg.role === 'user' ? 'items-end' : 'items-start')}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-3 py-2 rounded-xl bg-foreground text-background text-[12px] leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <AthosBubble msg={msg} onApply={applyToEditor} />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/40 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 focus-within:border-border transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte ao Athos..."
            rows={1}
            disabled={isStreaming || !agentPrompt}
            className="flex-1 resize-none text-[12px] bg-transparent outline-none placeholder:text-muted-foreground/40 py-0.5 disabled:opacity-50 overflow-hidden"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming || !agentPrompt}
            className="shrink-0 p-1.5 rounded-lg bg-foreground text-background disabled:opacity-40 hover:bg-foreground/90 transition-colors"
          >
            {isStreaming
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Send className="h-3 w-3" />}
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/30 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  );
}
