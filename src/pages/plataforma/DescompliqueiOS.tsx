import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sparkles, Plus, Send, Loader2, Users, BarChart3, GitBranch,
  Calendar, DollarSign, Target, BadgeCheck, FileText, ArrowRight,
  CheckCircle2, PanelLeftOpen, PanelLeftClose, Trash2, Bot,
  TrendingUp, Zap, MessageSquare, Paperclip, X, ImageIcon, Mic,
  Clock, ArrowDownToLine, ArrowUpFromLine, Square,
  MoreHorizontal, Pin, Archive, Pencil, AlertCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ToolCard } from "@/components/ai/ToolCard";
import { MessageContent } from "@/components/ai/MessageContent";
import { AthosChatStyles } from "@/components/ai/AthosChatStyles";
import { AthosOrbAvatar } from "@/components/ai/AthosOrbAvatar";
import {
  useAthosOS, MODEL_CONTEXT,
  type OSConversation, type OSMessage,
} from "@/contexts/AthosOSContext";

// O estado do chat (mensagens, streaming, conversas) vive em AthosOSContext,
// num provider montado acima das <Routes> (App.tsx) — sobrevive à navegação
// para outras páginas e volta. Esta página é só a "view": refs de DOM e os
// efeitos que dependem delas (scroll, auto-resize, fechar menus).

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function DescompliqueiOS() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Captura a intenção "criar material" no mount (estável mesmo depois de limpar o param da URL).
  const initialAcaoRef = useRef(searchParams.get("acao"));
  const wantsNovoMaterial = initialAcaoRef.current === "criar-material";
  // Deep-link da Jornada: "Construir com o Athos" (passo/categoria/brief).
  const initialPassoRef = useRef(searchParams.get("passo"));
  const initialCategoriaRef = useRef(searchParams.get("categoria"));
  const initialBriefRef = useRef(searchParams.get("brief"));

  const {
    agentes, selectedAgentSlug, setSelectedAgentSlug, agentPickerOpen, setAgentPickerOpen,
    conversations, currentConversationId, messages, input, setInput, isStreaming,
    sidebarOpen, setSidebarOpen, loadingConv, attachments, setAttachments,
    plusMenuOpen, setPlusMenuOpen, lightboxUrl, setLightboxUrl,
    pinnedIds, archivedIds, showArchived, setShowArchived,
    selectConversation, newConversation, deleteConversation, renameConversation,
    pinConversation, archiveConversation, unarchiveConversation,
    sendMessage, stopStreaming, handleFileSelect, handlePaste, removeAttachment, handleKeyDown,
    startFreshConversation, startPendingPasso, justLoadedRef,
  } = useAthosOS();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu "+" ao clicar fora
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [setPlusMenuOpen]);

  // Fluxo "Criar com o Athos" (vindo da página de Materiais): abre conversa nova
  // já com um prompt indicativo de criação de material no campo. Roda uma vez no mount.
  useEffect(() => {
    if (!wantsNovoMaterial) return;
    startFreshConversation("Quero criar um novo material comercial. Me ajuda a construir?");
    setTimeout(() => textareaRef.current?.focus(), 200);
    // Limpa o param da URL para não re-disparar em refresh/navegação.
    const next = new URLSearchParams(searchParams);
    next.delete("acao");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link da Jornada: abre conversa nova, semeia o compositor com a tarefa e
  // registra o passo pendente para auto-vincular o material construído. Roda uma vez no mount.
  useEffect(() => {
    const passoId = initialPassoRef.current;
    if (!passoId) return;
    const brief = initialBriefRef.current;
    const categoria = initialCategoriaRef.current;
    startPendingPasso(passoId);
    startFreshConversation(
      brief
        ? `Preciso construir este material da minha jornada: ${brief}. Me ajuda a montar?`
        : `Preciso construir o material da minha jornada${categoria ? ` (${categoria.replace(/_/g, " ")})` : ""}. Me ajuda a montar?`
    );
    setTimeout(() => textareaRef.current?.focus(), 200);
    const next = new URLSearchParams(searchParams);
    next.delete("passo"); next.delete("categoria"); next.delete("brief");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toda vez que a página é montada (usuário entra na rota), a próxima aplicação da
  // lista de mensagens deve ser instantânea — sem isso, o React Router remonta o
  // componente e o scroll para o fim anima visivelmente ("rola de baixo pra cima").
  useEffect(() => {
    justLoadedRef.current = true;
  }, [justLoadedRef]);

  // Scroll para o fim — instantâneo ao entrar na página/trocar de conversa, suave durante o streaming.
  useEffect(() => {
    const behavior = justLoadedRef.current ? "auto" : "smooth";
    justLoadedRef.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages, justLoadedRef]);

  // Auto-resize do textarea — sincroniza altura com conteúdo
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const visibleConvs = conversations.filter(c => !archivedIds.has(c.id));
  const pinnedConvs  = visibleConvs.filter(c => pinnedIds.has(c.id));
  const grouped = groupConversations(visibleConvs.filter(c => !pinnedIds.has(c.id)));
  const hasMessages = messages.length > 0;
  const currentTitle = conversations.find(c => c.id === currentConversationId)?.titulo;

  return (
    <>
    <AthosChatStyles />
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
              onClick={() => { newConversation(); setTimeout(() => textareaRef.current?.focus(), 50); }}
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
                    Voltar ao Athos
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
            {currentTitle ?? "Athos"}
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
  const { sendMessage } = useAthosOS();
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
      <AthosOrbAvatar />

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
