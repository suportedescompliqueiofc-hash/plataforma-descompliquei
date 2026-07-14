"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { Send, Smile, AlertTriangle, CheckCircle, Check, Phone, User, Bot, ChevronDown, Trash2, Mic, Zap, MoreVertical, ChevronLeft, Paperclip, Loader2, ImageIcon, FileText, Globe, Sparkles, Info, Pencil, UserCheck, Download, X, CalendarCheck, BadgeCheck, EyeOff, Reply, StickyNote, ShieldBan, Megaphone, Leaf, HeartPulse, Building2, RotateCcw, Users, Clock, Plus, Video } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import EmojiPicker from 'emoji-picker-react';
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { useLead, useLeads } from "@/hooks/useLeads";
import { useLeadCadence } from "@/hooks/useCadences";
import { useMessages, useSendMessage, Message, Attachment, useDeleteMessage, useEditMessage, useSendAudioMessage, useSendMediaMessage } from "@/hooks/useConversations";
import { useNotifications, useUpdateNotificationStatus } from "@/hooks/useNotifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useBranding } from "@/contexts/BrandingContext";
import { DESCOMPLIQUEI_ORG_ID, ANNA_CLARA_ORG_ID } from "@/lib/constants";
import { exportConversationPdf, type ConversationPdfMessage } from "@/lib/conversation-pdf";

import { AudioMessage } from "./AudioMessage";
import LeadNotas from "@/components/leads/LeadNotas";
import { MediaMessage } from "./MediaMessage";
import { FileMessage } from "./FileMessage";
import { NotificationMessage } from "./NotificationMessage";
import { AiLockControl } from "./AiLockControl";
import { CadenceLeadSelector } from "./CadenceLeadSelector";
import { TagManager } from "@/components/tags/TagManager";
import { useLeadAgendamento } from "@/hooks/useLeadAgendamento";
import { useLeadTriageLog, TriageLog } from "@/hooks/useTriageLogs";
import AgendamentoLeadModal from "@/components/agendamentos/AgendamentoLeadModal";
import { AiStatusBar } from "./AiStatusBar";
import { FollowupStatusBar } from "./FollowupStatusBar";
import { AudioRecorder } from "./AudioRecorder";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { FullscreenMediaViewer } from "./FullscreenMediaViewer";
import { LeadModal } from "@/components/leads/LeadModal";
import { VendaModal } from "@/components/vendas/VendaModal";
import { FormattedText } from "@/components/FormattedText";
import { LeadResumoIa } from "./LeadResumoIa";

const DateSeparator = ({ dateString }: { dateString: string }) => {
  const date = parseISO(dateString);
  let displayDate: string;
  if (isToday(date)) displayDate = 'Hoje';
  else if (isYesterday(date)) displayDate = 'Ontem';
  else displayDate = format(date, 'dd/MM/yyyy', { locale: ptBR });

  return (
    <div className="flex justify-center my-5 sticky top-0 z-10">
      <div className="bg-card/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-semibold text-muted-foreground/70 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-border/40 tracking-wide uppercase">{displayDate}</div>
    </div>
  );
};

const AttachmentRenderer = ({ 
  attachment, 
  isOutgoing, 
  onViewMedia 
}: { 
  attachment: Attachment; 
  isOutgoing: boolean;
  onViewMedia: (url: string, type: 'imagem' | 'video' | 'pdf', name?: string) => void;
}) => {
  const type = (attachment.file_type || '').toLowerCase();
  const path = (attachment.file_path || '').toLowerCase();
  const isAudio = type.includes('audio') || type.includes('ptt') || path.includes('.ogg') || path.includes('.mp3') || path.includes('.m4a') || path.includes('.webm');
  
  if (isAudio) return <AudioMessage filePath={attachment.file_path} variant={isOutgoing ? 'outgoing' : 'incoming'} />;
  
  if (type.includes('image') || type.includes('imagem') || type.includes('video')) {
    return (
      <MediaMessage 
        path={attachment.file_path} 
        type={type.includes('video') ? 'video' : 'imagem'} 
        onView={onViewMedia as any}
      />
    );
  }
  
  if (type.includes('pdf')) {
    return (
      <FileMessage 
        path={attachment.file_path} 
        fileName="Documento PDF" 
        onView={onViewMedia as any}
      />
    );
  }

  return <div className="p-2 bg-muted/20 border rounded text-xs text-muted-foreground mb-1 break-all">Anexo: {attachment.file_path}</div>;
};

// Ícone + rótulo para preview de mídia em citações/respostas (substitui glyphs de emoji por lucide-react)
const getMediaPreviewMeta = (tipo?: string): { Icon: React.ElementType; label: string } | null => {
  if (tipo === 'audio') return { Icon: Mic, label: 'Áudio' };
  if (tipo === 'imagem') return { Icon: ImageIcon, label: 'Imagem' };
  if (tipo === 'video') return { Icon: Video, label: 'Vídeo' };
  if (tipo === 'pdf') return { Icon: FileText, label: 'Documento' };
  return null;
};

const groupMessagesByDay = (messages: Message[]) => {
  const grouped: (Message | { type: 'separator', date: string })[] = [];
  let lastDate = '';
  messages.forEach(msg => {
    const currentDate = format(parseISO(msg.criado_em), 'yyyy-MM-dd');
    if (currentDate !== lastDate) {
      grouped.push({ type: 'separator', date: msg.criado_em });
      lastDate = currentDate;
    }
    grouped.push(msg);
  });
  return grouped;
};

const getMessageSelectionLabel = (message: Message) =>
  `${format(parseISO(message.criado_em), "dd/MM 'às' HH:mm", { locale: ptBR })} · ${message.remetente === "lead" ? "Lead" : "Equipe/IA"}`;

const getMessageExportText = (message: Message) => {
  const attachmentTypes = (message.message_attachments || []).map((attachment) => {
    if (attachment.file_type === "audio") return "[Áudio]";
    if (attachment.file_type === "video") return "[Vídeo]";
    if (attachment.file_type === "pdf") return "[PDF]";
    if (attachment.file_type === "imagem") return "[Imagem]";
    return "[Arquivo]";
  });

  const mediaFallback =
    message.tipo_conteudo === "audio"
      ? "[Áudio]"
      : message.tipo_conteudo === "imagem"
        ? "[Imagem]"
        : message.tipo_conteudo === "video"
          ? "[Vídeo]"
          : message.tipo_conteudo === "pdf"
            ? "[PDF]"
            : "";

  const parts = [message.conteudo?.trim(), ...attachmentTypes, mediaFallback]
    .filter(Boolean)
    .join("\n")
    .trim();

  return parts || "[Mensagem sem texto]";
};

interface ActiveConversationProps {
  leadId: string;
  showMateriais?: boolean;
  onToggleMateriais?: () => void;
  compactMode?: boolean;
}

export function ActiveConversation({ leadId, showMateriais, onToggleMateriais, compactMode = false }: ActiveConversationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const { branding } = useBranding();
  const { profile } = useProfile();
  const isDescompliqueiOrg = profile?.organization_id === DESCOMPLIQUEI_ORG_ID;
  const isAnnaClaraOrg = profile?.organization_id === ANNA_CLARA_ORG_ID;

  const { data: lead, isLoading: leadLoading, isFetching: leadFetching } = useLead(leadId);
  const { agendamentoAtivo, invalidate: invalidateAgendamento } = useLeadAgendamento(leadId);
  const [showAgendamentoModal, setShowAgendamentoModal] = useState(false);
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [agendadoPopoverOpen, setAgendadoPopoverOpen] = useState(false);
  const [fechadoPopoverOpen, setFechadoPopoverOpen] = useState(false);

  const { data: allAgendamentos = [] } = useQuery({
    queryKey: ['lead-all-agendamentos', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('id, titulo, tipo, descricao, data_hora_inicio, data_hora_fim, status')
        .eq('lead_id', leadId!)
        .order('data_hora_inicio', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allVendas = [] } = useQuery({
    queryKey: ['lead-all-vendas', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendas')
        .select('id, produto_servico, valor_fechado, data_fechamento, forma_pagamento')
        .eq('lead_id', leadId!)
        .order('data_fechamento', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000,
  });
  const { activeCadence } = useLeadCadence(leadId);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(leadId);
  const { data: triageLog } = useLeadTriageLog(leadId);
  const { data: notifications } = useNotifications(leadId);
  // Query meta_ads for the lead's criativo (FK leads.criativo_id -> meta_ads.id)
  const { data: leadAdInfo } = useQuery({
    queryKey: ['lead_ad_header', lead?.criativo_id],
    queryFn: async () => {
      const { data } = await (supabase
        .from('meta_ads') as any)
        .select('id, nome, meta_ad_id, url_thumbnail')
        .eq('id', lead!.criativo_id!)
        .single();
      return data;
    },
    enabled: !!lead?.criativo_id,
    staleTime: 5 * 60 * 1000,
  });
  const { mutate: sendMessage } = useSendMessage();
  const { mutate: sendAudio, isPending: isSendingAudio } = useSendAudioMessage();
  const { mutate: sendMedia, isPending: isSendingMedia } = useSendMediaMessage();
  const { mutate: updateNotification } = useUpdateNotificationStatus(leadId);
  const { updateLead, deleteLead } = useLeads();
  const { mutate: deleteMessage } = useDeleteMessage();
  const { mutate: editMessage, isPending: isEditingMessage } = useEditMessage();

  const [messageContent, setMessageContent] = useState("");
  const [isAiActive, setIsAiActive] = useState(true);
  const [deletingMessage, setDeletingMessage] = useState<Message | null>(null);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExportMode, setIsExportMode] = useState(false);
  const [exportStartId, setExportStartId] = useState<string | null>(null);
  const [exportEndId, setExportEndId] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Reply/Quote State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Edit Message State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Notas Panel
  const [showNotas, setShowNotas] = useState(false);

  // Resumo da IA Panel
  const [showResumo, setShowResumo] = useState(false);

  // Follow-up IA manual
  const [isActivatingFollow, setIsActivatingFollow] = useState(false);

  const handleAtivarFollow = async () => {
    if (!lead) return;
    setIsActivatingFollow(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          followup_manual: true,
          followup_tentativas: 0,
          followup_ultima_tentativa: null,
          followup_pausado: false,
        })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success(`Follow-up IA ativado para ${lead.nome || "lead"}`);
      queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["followup-gap"] });
    } catch (err: any) {
      toast.error("Erro ao ativar follow-up: " + (err.message || String(err)));
    } finally {
      setIsActivatingFollow(false);
    }
  };

  // Blacklist
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState(false);
  const [isBlacklisting, setIsBlacklisting] = useState(false);

  // Scoring Modal
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [selectedScoring, setSelectedScoring] = useState<string | null>(null);

  const SCORING_OPTIONS = [
    { value: 'A', label: 'Lead dos sonhos', description: 'Estética, 60K+/mês, 4+ pessoas, 3+ anos de mercado', bg: '#E1F5EE', text: '#085041' },
    { value: 'B', label: 'Qualificado com ressalva', description: 'Estética, 30–60K/mês, equipe menor ou menos tempo', bg: '#E6F1FB', text: '#0C447C' },
    { value: 'C', label: 'Em desenvolvimento', description: 'Estética, abaixo de 30K/mês, clínica nova ou solo', bg: '#FAEEDA', text: '#633806' },
    { value: 'D', label: 'Fora do ICP', description: 'Fora do nicho de estética ou começando agora', bg: '#FCEBEB', text: '#791F1F' },
  ] as const;

  const handleOpenScoringModal = () => {
    setSelectedScoring(lead?.lead_scoring || null);
    setShowScoringModal(true);
  };

  const handleConfirmScoring = () => {
    if (!lead || !selectedScoring) return;
    updateLead({ id: lead.id, is_qualified: true, lead_scoring: selectedScoring });
    setShowScoringModal(false);
  };

  const handleRemoveQualified = () => {
    if (!lead) return;
    updateLead({ id: lead.id, is_qualified: false, lead_scoring: null });
  };

  // Media Preview States (Send)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isMediaPreviewOpen, setIsMediaPreviewOpen] = useState(false);

  // Fullscreen Viewer State (View)
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: 'imagem' | 'video' | 'pdf'; name?: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const groupedMessages = useMemo(() => groupMessagesByDay(messages), [messages]);
  
  // Nome do criativo associado (via meta_ads)
  const creativeName = leadAdInfo?.nome || (lead?.criativo_id ? `Criativo #${lead.criativo_id.slice(-6)}` : null);

  const messageIndexById = useMemo(
    () => new Map(messages.map((message, index) => [message.id, index])),
    [messages]
  );

  const exportStartIndex = exportStartId ? messageIndexById.get(exportStartId) ?? -1 : -1;
  const exportEndIndex = exportEndId ? messageIndexById.get(exportEndId) ?? -1 : -1;
  const hasValidExportRange = exportStartIndex >= 0 && exportEndIndex >= exportStartIndex;
  const exportStartMessage = exportStartIndex >= 0 ? messages[exportStartIndex] : null;
  const exportEndMessage = exportEndIndex >= 0 ? messages[exportEndIndex] : null;

  const selectedExportMessages = useMemo(() => {
    if (!hasValidExportRange) return [];
    return messages.slice(exportStartIndex, exportEndIndex + 1);
  }, [messages, exportStartIndex, exportEndIndex, hasValidExportRange]);

  useEffect(() => { if (lead) setIsAiActive(lead.ia_ativa ?? true); }, [lead]);
  // Map de mensagens por ID para lookup rápido de citações
  const messagesById = useMemo(() => new Map(messages.map(m => [m.id, m])), [messages]);

  const lastIncomingMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direcao === 'entrada') return messages[i];
    }
    return null;
  }, [messages]);

  useEffect(() => {
    setIsExportMode(false);
    setExportStartId(null);
    setExportEndId(null);
    setIsExportingPdf(false);
    setReplyingTo(null);
  }, [leadId]);
  
  useLayoutEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" }); 
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageContent.trim()) {
      sendMessage({
        leadId,
        content: messageContent.trim(),
        ...(replyingTo ? {
          quotedMessageId: replyingTo.id,
          quotedWaMsgId: replyingTo.id_mensagem || undefined,
          quotedParticipant: replyingTo.remetente === 'lead' ? lead?.telefone : undefined,
        } : {}),
      });
      setMessageContent("");
      setReplyingTo(null);
    }
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditText(msg.conteudo || '');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const handleSaveEdit = (msg: Message) => {
    if (!editText.trim() || editText.trim() === msg.conteudo) {
      handleCancelEdit();
      return;
    }
    editMessage({ messageId: msg.id, newText: editText.trim(), leadId }, {
      onSuccess: () => handleCancelEdit(),
    });
  };

  const canEditMessage = (msg: Message): boolean => {
    if (msg.direcao !== 'saida') return false;
    if (msg.tipo_conteudo !== 'texto') return false;
    if (!msg.id_mensagem) return false;
    const sentAt = new Date(msg.criado_em).getTime();
    return (Date.now() - sentAt) < 15 * 60 * 1000;
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary/40');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40'), 2000);
    }
  };

  const handleSendAudio = (blob: Blob) => { 
    setIsRecordingMode(false); 
    sendAudio({ leadId, audioBlob: blob }); 
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(files);
      setIsMediaPreviewOpen(true);
    }
    if (e.target) e.target.value = '';
  };

  const handleConfirmMediaSend = async (filesWithCaptions: { file: File; caption: string }[]) => {
    for (const item of filesWithCaptions) {
      let type: 'imagem' | 'video' | 'pdf' = 'imagem';
      if (item.file.type.includes('image')) type = 'imagem';
      else if (item.file.type.includes('video')) type = 'video';
      else if (item.file.type === 'application/pdf') type = 'pdf';
      
      sendMedia({ leadId, file: item.file, type, caption: item.caption });
    }
    setPendingFiles([]);
  };

  const handleAiToggle = async (checked: boolean) => {
    if (!lead) return;
    setIsAiActive(checked);
    updateLead({ id: lead.id, ia_ativa: checked });
  };

  const handleBlacklistLead = async () => {
    if (!lead || !profile?.organization_id) return;
    setIsBlacklisting(true);
    try {
      const { error } = await supabase.from('lead_blacklist').insert({
        organization_id: profile.organization_id,
        telefone: lead.telefone,
        telefone_normalizado: lead.telefone.replace(/\D/g, ''),
        motivo: 'Bloqueado manualmente via conversa',
        blocked_by: profile.id,
      });
      if (error && error.code !== '23505') {
        throw error;
      }
      await deleteLead(lead.id);
      queryClient.setQueryData<any[]>(['conversations', profile.organization_id], (old) =>
        (old || []).filter((c) => c.id !== lead.id)
      );
      toast.success(`Número ${lead.telefone} bloqueado e lead excluído.`);
      const segments = location.pathname.split('/');
      segments.pop();
      navigate(segments.join('/'));
      return;
    } catch (e: any) {
      console.error('Erro ao bloquear número:', e);
      toast.error('Erro ao bloquear número: ' + (e.message || 'erro desconhecido'));
    } finally {
      setIsBlacklisting(false);
      setShowBlacklistConfirm(false);
    }
  };

  const handleStartExportSelection = () => {
    setIsExportMode(true);
    setExportStartId(null);
    setExportEndId(null);
  };

  const handleCancelExportSelection = () => {
    setIsExportMode(false);
    setExportStartId(null);
    setExportEndId(null);
    setIsExportingPdf(false);
  };

  const handleSelectExportStart = (messageId: string) => {
    setExportStartId(messageId);
    const startIndex = messageIndexById.get(messageId) ?? -1;
    if (exportEndId) {
      const currentEndIndex = messageIndexById.get(exportEndId) ?? -1;
      if (currentEndIndex !== -1 && startIndex > currentEndIndex) {
        setExportEndId(null);
        toast.info("A mensagem final foi limpa. Escolha uma mensagem final abaixo da inicial.");
      }
    }
  };

  const handleSelectExportEnd = (messageId: string) => {
    const endIndex = messageIndexById.get(messageId) ?? -1;
    if (exportStartId) {
      const currentStartIndex = messageIndexById.get(exportStartId) ?? -1;
      if (currentStartIndex !== -1 && endIndex < currentStartIndex) {
        toast.info("Selecione uma mensagem final que venha depois da mensagem inicial.");
        return;
      }
    }
    setExportEndId(messageId);
  };

  const handleExportConversationPdf = async () => {
    if (!lead || !hasValidExportRange || selectedExportMessages.length === 0) {
      toast.error("Selecione a mensagem inicial e a final para exportar.");
      return;
    }

    const pdfMessages: ConversationPdfMessage[] = selectedExportMessages.map((message) => ({
      id: message.id,
      createdAt: message.criado_em,
      senderLabel: message.remetente === "lead" ? (lead.nome || "Lead") : (message.remetente === "bot" ? "Agente IA" : "Equipe"),
      direction: message.remetente === "lead" ? "incoming" : "outgoing",
      content: getMessageExportText(message),
    }));

    try {
      setIsExportingPdf(true);
      await exportConversationPdf({
        branding,
        leadName: lead.nome || "Lead",
        leadPhone: lead.telefone,
        messages: pdfMessages,
        periodLabel: "Intervalo selecionado na conversa",
      });
      toast.success("PDF exportado com sucesso.");
      handleCancelExportSelection();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível exportar a conversa em PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const openMediaViewer = (url: string, type: 'imagem' | 'video' | 'pdf', name?: string) => {
    setViewingMedia({ url, type, name });
  };

  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'L';
  // Apenas bloqueia na primeira carga absoluta (sem nenhum dado já carregado)
  const isFirstLoad = !lead && leadLoading && !messages.length;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      <header data-tutorial="conversation-header" className="flex flex-col border-b border-border/60 bg-card z-10 flex-shrink-0">
        {!compactMode && <div className="flex items-center justify-between px-3 py-2.5 gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 rounded-full" onClick={() => navigate('/crm/conversas')}><ChevronLeft className="h-5 w-5" /></Button>
                <Avatar className="h-10 w-10 border border-border/40 shadow-sm flex-shrink-0">
                    <AvatarFallback className="bg-foreground text-background text-xs font-bold tracking-tight">{getInitials(lead?.nome)}</AvatarFallback>
                </Avatar>
                <div data-tutorial="conversation-lead-info" className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                        <button
                            className="font-semibold truncate text-[13px] leading-tight tracking-tight hover:underline hover:text-primary transition-colors cursor-pointer"
                            onClick={() => setIsEditModalOpen(true)}
                            title="Abrir ficha do lead"
                        >
                            {lead?.nome || 'Lead'}
                        </button>
                        {activeCadence && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0 h-4 border border-orange-200">
                                <Zap className="h-2.5 w-2.5 mr-0.5" /> Em cadência
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                            <Phone className="h-2.5 w-2.5" />
                            {lead?.telefone}
                        </span>

                        {/* Badge de Origem — clicável para alterar */}
                        {(() => {
                            const origemMap: Record<string, { icon: React.ElementType; label: string; fullLabel: string }> = {
                                marketing:  { icon: Megaphone, label: 'MKT',  fullLabel: 'Marketing'  },
                                organico:   { icon: Globe,      label: 'ORG',  fullLabel: 'Orgânico'   },
                                reativacao: { icon: RotateCcw,  label: 'REAT', fullLabel: 'Reativação' },
                                paciente:   { icon: HeartPulse, label: 'PAC',  fullLabel: 'Paciente'   },
                                ...(isAnnaClaraOrg ? { convenio: { icon: Building2, label: 'CONV', fullLabel: 'Convênio' } } : {}),
                            };
                            const cfg = origemMap[lead?.origem as string] ?? { icon: Globe, label: 'ORG', fullLabel: 'Orgânico' };
                            const Icon = cfg.icon;
                            return (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            disabled={!lead}
                                            className="flex items-center gap-0.5 bg-muted/50 hover:bg-muted px-1 py-0.5 rounded-md border border-border/40 shrink-0 transition-colors disabled:opacity-50"
                                            title="Alterar origem do lead"
                                        >
                                            <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                                            <span className="text-[9px] font-bold uppercase text-muted-foreground">{cfg.label}</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-44">
                                        {Object.entries(origemMap).map(([value, opt]) => {
                                            const OptIcon = opt.icon;
                                            const isActive = lead?.origem === value;
                                            return (
                                                <DropdownMenuItem
                                                    key={value}
                                                    className={cn("text-xs gap-2", isActive && "bg-muted font-semibold")}
                                                    onSelect={() => {
                                                        if (!lead || isActive) return;
                                                        updateLead({ id: lead.id, origem: value });
                                                    }}
                                                >
                                                    <OptIcon className="h-3 w-3 text-muted-foreground" />
                                                    {opt.fullLabel}
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        })()}

                        {/* Badge de Criativo com thumbnail */}
                        {lead?.criativo_id && leadAdInfo && (
                            <div className="hidden sm:flex items-center gap-1 bg-orange-50 px-1 py-0.5 rounded-md border border-orange-200 shrink-0 max-w-[160px] lg:max-w-[220px]">
                                {leadAdInfo.url_thumbnail ? (
                                    <img src={leadAdInfo.url_thumbnail} className="w-4 h-4 rounded object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                    <Sparkles className="h-2.5 w-2.5 text-orange-500 flex-shrink-0" />
                                )}
                                <span className="text-[9px] font-medium text-orange-700 truncate">
                                    {leadAdInfo.nome || 'Criativo'}
                                </span>
                                <span className="text-[8px] text-orange-500 font-mono flex-shrink-0">
                                    #{leadAdInfo.meta_ad_id?.slice(-6)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <div className="hidden lg:block">
                    {leadId && <CadenceLeadSelector leadId={leadId} />}
                </div>

                <div className="flex items-center gap-1.5 pl-2 border-l border-border/40 ml-1" data-tutorial="conversation-ia-toggle">
                    <span className="text-[10px] font-medium text-muted-foreground hidden xl:inline">IA</span>
                    <Switch id="ai-toggle" checked={isAiActive} onCheckedChange={handleAiToggle} disabled={!lead} className="scale-75" />
                </div>
            </div>
        </div>}

        {/* ═══ Toolbar — scrollable row with all lead actions ═══ */}
        <div className={cn("flex items-center px-3 gap-3 overflow-x-auto scrollbar-none", compactMode ? "py-2" : "pb-2")}>
            {/* Status group: MQL + Agendado + Fechado */}
            <div className="flex items-center gap-1 shrink-0">
                {lead && (
                  <>
                    <Button
                      data-tutorial="conversation-mql"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-[10px] font-bold gap-1 transition-all duration-200 rounded-full uppercase tracking-wider shrink-0",
                        lead.is_qualified
                          ? isDescompliqueiOrg && lead.lead_scoring
                            ? "border-none shadow-sm active:scale-95"
                            : "bg-emerald-500 text-white hover:bg-emerald-600 border-none shadow-sm active:scale-95"
                          : "border-border/50 bg-transparent text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground hover:border-border/60"
                      )}
                      style={lead.is_qualified && lead.lead_scoring && isDescompliqueiOrg ? {
                        backgroundColor: SCORING_OPTIONS.find(s => s.value === lead.lead_scoring)?.bg || '#E1F5EE',
                        color: SCORING_OPTIONS.find(s => s.value === lead.lead_scoring)?.text || '#085041',
                      } : undefined}
                      onClick={() => {
                        if (isDescompliqueiOrg) {
                          lead.is_qualified ? handleRemoveQualified() : handleOpenScoringModal();
                        } else {
                          updateLead({ id: lead.id, is_qualified: !lead.is_qualified });
                        }
                      }}
                    >
                      <UserCheck className={cn("h-3 w-3", lead.is_qualified ? "fill-current" : "")} />
                      {lead.is_qualified && lead.lead_scoring && isDescompliqueiOrg ? `Qualificado ${lead.lead_scoring}` : 'Qualificado'}
                    </Button>
                    {/* ── Agendado Dialog ── */}
                    <Dialog open={agendadoPopoverOpen} onOpenChange={setAgendadoPopoverOpen}>
                      <DialogTrigger asChild>
                        <Button
                          data-tutorial="conversation-schedule"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-6 px-2 text-[10px] font-bold gap-1 transition-all duration-200 rounded-full uppercase tracking-wider shrink-0",
                            lead.is_scheduled
                              ? "bg-blue-500 text-white hover:bg-blue-600 border-none shadow-sm"
                              : "border-border/50 bg-transparent text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground hover:border-border/60"
                          )}
                        >
                          <CalendarCheck className={cn("h-3 w-3", lead.is_scheduled ? "fill-current" : "")} />
                          {lead.is_scheduled && agendamentoAtivo
                            ? `Agendado · ${format(parseISO(agendamentoAtivo.data_hora_inicio), "dd/MM")}`
                            : 'Agendado'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border border-border/60 gap-0 [&>button]:hidden">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="p-2 rounded-xl bg-blue-500/10">
                                <CalendarCheck className="h-4 w-4 text-blue-500" />
                              </span>
                              <div>
                                <p className="text-sm font-bold font-display text-foreground">Agendamentos</p>
                                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                  {lead.nome} · {allAgendamentos.length} registrado{allAgendamentos.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setAgendadoPopoverOpen(false)}
                              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {allAgendamentos.length > 0 && (() => {
                            const realizados = (allAgendamentos as any[]).filter(a => a.status === 'realizado').length;
                            const cancelados = (allAgendamentos as any[]).filter(a => a.status === 'cancelado').length;
                            const pendentes  = (allAgendamentos as any[]).filter(a => ['agendado','confirmado'].includes(a.status)).length;
                            return (
                              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
                                {pendentes > 0 && <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><span className="text-[11px] text-muted-foreground">{pendentes} pendente{pendentes !== 1 ? 's' : ''}</span></div>}
                                {realizados > 0 && <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[11px] text-muted-foreground">{realizados} realizado{realizados !== 1 ? 's' : ''}</span></div>}
                                {cancelados > 0 && <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-[11px] text-muted-foreground">{cancelados} cancelado{cancelados !== 1 ? 's' : ''}</span></div>}
                              </div>
                            );
                          })()}
                        </div>
                        {/* Próximo destaque */}
                        {agendamentoAtivo && (
                          <div className="mx-4 mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500/70 mb-1.5">Próximo agendamento</p>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-foreground leading-tight">
                                  {(agendamentoAtivo as any).titulo || 'Agendamento'}
                                </p>
                                {(agendamentoAtivo as any).tipo && (
                                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 capitalize">{(agendamentoAtivo as any).tipo}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Clock className="h-3 w-3 text-blue-500/70 shrink-0" />
                                  <span className="text-[12px] font-medium text-blue-600">
                                    {format(parseISO(agendamentoAtivo.data_hora_inicio), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full bg-blue-500/15 text-blue-600 shrink-0">
                                {(agendamentoAtivo as any).status}
                              </span>
                            </div>
                          </div>
                        )}
                        {/* Lista */}
                        <div className="px-5 mt-4 mb-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Todos os agendamentos</p>
                        </div>
                        <div className="max-h-56 overflow-y-auto px-4 pb-2">
                          {allAgendamentos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                                <CalendarCheck className="h-6 w-6 text-muted-foreground/30" />
                              </div>
                              <p className="text-sm font-medium font-display text-muted-foreground">Sem agendamentos ainda</p>
                              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Clique em novo para agendar</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {(allAgendamentos as any[]).map((ag) => {
                                const sc = {
                                  agendado:      { dot: 'bg-indigo-500',  badge: 'bg-indigo-500/10 text-indigo-600' },
                                  confirmado:    { dot: 'bg-sky-500',     badge: 'bg-sky-500/10 text-sky-600' },
                                  realizado:     { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600' },
                                  nao_compareceu:{ dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-600' },
                                  cancelado:     { dot: 'bg-red-400',     badge: 'bg-red-500/10 text-red-500' },
                                  remarcado:     { dot: 'bg-amber-400',   badge: 'bg-amber-500/10 text-amber-600' },
                                }[ag.status as string] ?? { dot: 'bg-muted-foreground/30', badge: 'bg-muted text-muted-foreground' };
                                return (
                                  <div key={ag.id} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border/40 hover:bg-muted/20 hover:border-border/60 transition-all">
                                    <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", sc.dot)} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-[12px] font-semibold text-foreground leading-tight">{ag.titulo || 'Agendamento'}</p>
                                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0", sc.badge)}>{ag.status}</span>
                                      </div>
                                      {ag.tipo && <p className="text-[10px] text-muted-foreground/60 mt-0.5 capitalize">{ag.tipo}</p>}
                                      <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                                        <Clock className="h-3 w-3 shrink-0" />
                                        {format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm")}
                                      </p>
                                      {ag.descricao && <p className="text-[10px] text-muted-foreground/50 mt-1 line-clamp-1">{ag.descricao}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {/* Footer */}
                        <div className="flex items-center justify-end px-5 py-3.5 border-t border-border/40 bg-muted/20 mt-3">
                          <Button
                            size="sm"
                            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
                            onClick={() => { setShowAgendamentoModal(true); setAgendadoPopoverOpen(false); }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Novo agendamento
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* ── Fechado Dialog ── */}
                    <Dialog open={fechadoPopoverOpen} onOpenChange={setFechadoPopoverOpen}>
                      <DialogTrigger asChild>
                        <Button
                          data-tutorial="conversation-closed"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-6 px-2 text-[10px] font-bold gap-1 transition-all duration-200 rounded-full uppercase tracking-wider shrink-0",
                            lead.is_closed
                              ? "bg-violet-500 text-white hover:bg-violet-600 border-none shadow-sm"
                              : "border-border/50 bg-transparent text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground hover:border-border/60"
                          )}
                        >
                          <BadgeCheck className={cn("h-3 w-3", lead.is_closed ? "fill-current" : "")} />
                          {lead.is_closed && allVendas.length > 0 ? `Fechado · ${allVendas.length}x` : 'Fechado'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border border-border/60 gap-0 [&>button]:hidden">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="p-2 rounded-xl bg-violet-500/10">
                                <BadgeCheck className="h-4 w-4 text-violet-500" />
                              </span>
                              <div>
                                <p className="text-sm font-bold font-display text-foreground">Fechamentos</p>
                                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                  {lead.nome} · {allVendas.length} venda{allVendas.length !== 1 ? 's' : ''} registrada{allVendas.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setFechadoPopoverOpen(false)}
                              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Métricas de receita */}
                          {allVendas.length > 0 && (() => {
                            const total = (allVendas as any[]).reduce((s, v) => s + (Number(v.valor_fechado) || 0), 0);
                            const media = total / allVendas.length;
                            return (
                              <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border/30">
                                <div>
                                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Receita total</p>
                                  <p className="text-[15px] font-bold font-display text-foreground tabular-nums mt-0.5">
                                    R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div className="h-8 w-px bg-border/40" />
                                <div>
                                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Ticket médio</p>
                                  <p className="text-[15px] font-bold font-display text-foreground tabular-nums mt-0.5">
                                    R$ {media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Lista */}
                        <div className="px-5 mt-4 mb-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Todas as vendas</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto px-4 pb-2">
                          {allVendas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                                <BadgeCheck className="h-6 w-6 text-muted-foreground/30" />
                              </div>
                              <p className="text-sm font-medium font-display text-muted-foreground">Nenhum fechamento ainda</p>
                              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Clique em nova venda para registrar</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {(allVendas as any[]).map((v) => (
                                <div key={v.id} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border/40 hover:bg-muted/20 hover:border-border/60 transition-all">
                                  <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0 mt-1.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="text-[12px] font-semibold text-foreground leading-tight">{v.produto_servico || 'Venda'}</p>
                                      {v.valor_fechado != null && (
                                        <span className="text-[13px] font-bold font-display text-emerald-600 shrink-0 tabular-nums">
                                          R$ {Number(v.valor_fechado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[10px] text-muted-foreground/60">
                                        {format(parseISO(v.data_fechamento), "dd/MM/yyyy")}
                                      </p>
                                      {v.forma_pagamento && (
                                        <>
                                          <div className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
                                          <p className="text-[10px] text-muted-foreground/60 capitalize">{v.forma_pagamento}</p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Footer */}
                        <div className="flex items-center justify-end px-5 py-3.5 border-t border-border/40 bg-muted/20 mt-3">
                          <Button
                            size="sm"
                            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
                            onClick={() => { setShowVendaModal(true); setFechadoPopoverOpen(false); }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Nova venda
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
            </div>

            {!compactMode && (
              <>
                {/* Follow IA — só para leads com gap detectado e sem follow já ativo */}
                {lead && (lead as any).followup_gap === 'PRECISA_FOLLOW' && !(lead as any).followup_manual && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[10px] font-bold gap-1 transition-all duration-200 rounded-full uppercase tracking-wider shrink-0 border-amber-500/40 bg-amber-500/[0.06] text-amber-700 hover:bg-amber-500/15 hover:border-amber-500/60"
                    disabled={isActivatingFollow}
                    onClick={handleAtivarFollow}
                  >
                    {isActivatingFollow ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                    Follow IA
                  </Button>
                )}

                {/* Separator */}
                {lead && <div className="h-4 w-px bg-border/40 shrink-0" />}

                {/* Tags + Materiais */}
                {lead && (
                    <div data-tutorial="conversation-tags-quick" className="flex items-center gap-1.5 shrink-0">
                        <TagManager leadId={lead.id} compact />
                        {onToggleMateriais && (
                            <Button
                                data-tutorial="conversation-materiais"
                                variant={showMateriais ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                    "h-6 px-2 rounded-full text-[10px] gap-1 shrink-0",
                                    showMateriais ? "bg-foreground text-background" : "text-muted-foreground"
                                )}
                                onClick={onToggleMateriais}
                            >
                                <FileText className="h-3 w-3" />
                                <span className="hidden lg:inline">Materiais</span>
                            </Button>
                        )}
                    </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Utility actions */}
                <div data-tutorial="conversation-utilities" className="flex items-center gap-0.5 shrink-0 border-l border-border/40 pl-1.5">
                    <div className="lg:hidden">
                        {leadId && <CadenceLeadSelector leadId={leadId} />}
                    </div>
                    {lead && (
                      <Button
                        data-tutorial="conversation-blacklist"
                        variant="ghost"
                        size="sm"
                        title="Bloquear número permanentemente"
                        className="h-6 w-6 p-0 rounded-full text-muted-foreground/60 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => setShowBlacklistConfirm(true)}
                      >
                        <ShieldBan className="h-3 w-3" />
                      </Button>
                    )}
                    {lead && (
                      <Button
                        data-tutorial="conversation-notas"
                        variant="ghost"
                        size="sm"
                        title="Notas"
                        className={cn(
                          "h-6 w-6 p-0 rounded-full transition-colors",
                          showNotas ? "bg-foreground text-background" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                        )}
                        onClick={() => setShowNotas(!showNotas)}
                      >
                        <StickyNote className="h-3 w-3" />
                      </Button>
                    )}
                    {lead && (
                      <Button
                        data-tutorial="conversation-resumo-ia"
                        variant="ghost"
                        size="sm"
                        title="Resumo da IA"
                        className={cn(
                          "h-6 w-6 p-0 rounded-full transition-colors",
                          showResumo ? "bg-foreground text-background" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                        )}
                        onClick={() => setShowResumo(!showResumo)}
                      >
                        <Sparkles className="h-3 w-3" />
                      </Button>
                    )}
                    <div className="xs:block">{lead && <AiLockControl lead={lead} lastIncomingMessage={lastIncomingMessage?.conteudo} lastIncomingMessageType={lastIncomingMessage?.tipo_conteudo} messages={messages} />}</div>
                </div>
              </>
            )}
        </div>
      </header>

      {/* Painel de Notas */}
      {showNotas && lead && lead.organization_id && (
        <div className="border-b bg-background px-4 py-3 flex-shrink-0 max-h-[40vh] overflow-y-auto">
          <LeadNotas leadId={lead.id} organizationId={lead.organization_id} />
        </div>
      )}

      {/* Painel de Resumo da IA */}
      {showResumo && lead && (
        <div className="border-b bg-background px-4 py-3 flex-shrink-0 max-h-[40vh] overflow-y-auto">
          <LeadResumoIa leadId={lead.id} />
        </div>
      )}

      {isExportMode && (
        <div className="border-b border-border/40 bg-primary/10 px-3 py-3 text-foreground flex-shrink-0">
          <div className="max-w-5xl mx-auto flex flex-col gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Selecione a primeira e a última mensagem para exportar</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Use os botões "Início" e "Fim" dentro da conversa. O PDF será gerado apenas com o trecho marcado e usando a identidade visual do CRM.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary bg-background text-primary hover:bg-primary/10"
                  onClick={handleCancelExportSelection}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!hasValidExportRange || isExportingPdf}
                  onClick={handleExportConversationPdf}
                >
                  {isExportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Baixar PDF
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-primary/20 bg-card/80 px-3 py-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary/70">Mensagem inicial</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {exportStartMessage
                    ? getMessageSelectionLabel(exportStartMessage)
                    : "Selecione a primeira mensagem do trecho."}
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-card/80 px-3 py-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary/70">Mensagem final</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {exportEndMessage
                    ? getMessageSelectionLabel(exportEndMessage)
                    : "Selecione a última mensagem do trecho."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!compactMode && notifications && notifications.length > 0 && (
        <div className="border-b border-border/40 flex-shrink-0 divide-y divide-border/30">
          {notifications.map(notif => (
            <div key={notif.id} className="flex items-start gap-3 p-3 bg-card hover:bg-muted/20 transition-colors">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500 shrink-0 mt-0.5">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <NotificationMessage message={notif.mensagem} />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 h-7 text-[11px] font-medium text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-lg gap-1 px-2"
                onClick={() => updateNotification(notif.id)}
              >
                <CheckCircle className="h-3 w-3" />
                Resolver
              </Button>
            </div>
          ))}
        </div>
      )}

      <AiStatusBar leadId={leadId} />
      <FollowupStatusBar
        leadId={leadId}
        followupManual={(lead as any)?.followup_manual}
        followupTentativas={(lead as any)?.followup_tentativas}
        followupUltimaTentativa={(lead as any)?.followup_ultima_tentativa}
        followupPausado={(lead as any)?.followup_pausado}
        ultimoContato={(lead as any)?.ultimo_contato}
        iaAtiva={(lead as any)?.ia_ativa}
      />

      <ScrollArea className="flex-1 bg-[hsl(var(--background))]">
        <div className="p-3 sm:p-4 space-y-1 max-w-4xl 2xl:max-w-5xl mx-auto min-h-full">
          {(isFirstLoad || messagesLoading) ? (
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedMessages.map((item, index) => {
            if (item.type === 'separator') return <DateSeparator key={`sep-${index}`} dateString={item.date} />;
            const msg = item as Message;
            const messageIndex = messageIndexById.get(msg.id) ?? -1;
            const isStartSelected = exportStartId === msg.id;
            const isEndSelected = exportEndId === msg.id;
            const isWithinExportRange =
              hasValidExportRange && messageIndex >= exportStartIndex && messageIndex <= exportEndIndex;
            
            const isOutgoing = msg.remetente !== 'lead';
            const isAi = msg.remetente === 'bot';
            
            const typeLower = (msg.tipo_conteudo || '').toLowerCase();
            const pathLower = (msg.media_path || '').toLowerCase();
            const contentLower = (msg.conteudo || '').toLowerCase();
            
            const isAudio = typeLower.includes('audio') || typeLower.includes('ptt') || pathLower.includes('.ogg') || pathLower.includes('.mp3') || pathLower.includes('.m4a') || pathLower.includes('.webm') || (isOutgoing && contentLower.startsWith('http') && (contentLower.includes('.ogg') || contentLower.includes('.mp3') || contentLower.includes('.m4a')));
            const isVisualMedia = !isAudio && (typeLower.includes('image') || typeLower.includes('imagem') || typeLower.includes('video') || pathLower.includes('.jpg') || pathLower.includes('.png') || pathLower.includes('.mp4'));
            const isPdf = typeLower.includes('pdf') || pathLower.includes('.pdf');

            const quotedMsg = msg.quoted_message_id ? messagesById.get(msg.quoted_message_id) : null;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={cn(
                  "group relative flex flex-col gap-0.5 py-0.5 animate-in fade-in slide-in-from-bottom-1 duration-200 transition-all",
                  isOutgoing ? "items-end" : "items-start",
                  isExportMode && "rounded-2xl px-2 py-2",
                  isWithinExportRange && "bg-primary/5 ring-1 ring-primary/15"
                )}
              >
                <div className={cn("flex items-end gap-1.5 max-w-[85%] sm:max-w-[78%] lg:max-w-[72%]", isOutgoing ? "flex-row-reverse" : "flex-row")}>
                  <Avatar className="h-6 w-6 flex-shrink-0 border border-border/30">
                    {isOutgoing ? (
                      <AvatarFallback className={cn("text-[10px]", isAi ? "bg-violet-100 text-violet-600" : "bg-muted text-muted-foreground")}>{isAi ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}</AvatarFallback>
                    ) : (<AvatarFallback className="bg-foreground/5 text-foreground/60 text-[9px] font-semibold">{getInitials(lead?.nome)}</AvatarFallback>)}
                  </Avatar>
                  <div className={cn("px-3 py-2 rounded-2xl relative transition-all min-w-[90px]", isOutgoing ? "bg-foreground text-background rounded-br-sm" : "bg-card border border-border/50 rounded-bl-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]")}>
                    {isExportMode && (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={isStartSelected ? "default" : "outline"}
                          className={cn(
                            "h-6 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider",
                            isOutgoing
                              ? "border-white/80 bg-white text-primary hover:bg-white/90"
                              : "border-border/60 bg-background text-foreground hover:bg-muted",
                            isStartSelected && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                          )}
                          onClick={() => handleSelectExportStart(msg.id)}
                        >
                          Início
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={isEndSelected ? "default" : "outline"}
                          className={cn(
                            "h-6 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider",
                            isOutgoing
                              ? "border-white/80 bg-white text-primary hover:bg-white/90"
                              : "border-border/60 bg-background text-foreground hover:bg-muted",
                            isEndSelected && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                          )}
                          onClick={() => handleSelectExportEnd(msg.id)}
                        >
                          Fim
                        </Button>
                        {isStartSelected && (
                          <Badge variant="secondary" className="h-6 rounded-full border-primary/20 bg-primary/10 text-[10px] font-semibold text-primary">
                            Primeira
                          </Badge>
                        )}
                        {isEndSelected && (
                          <Badge variant="secondary" className="h-6 rounded-full border-primary/20 bg-primary/10 text-[10px] font-semibold text-primary">
                            Última
                          </Badge>
                        )}
                      </div>
                    )}
                    {/* Bloco de citação (Quote) */}
                    {quotedMsg && (
                      <div
                        className={cn(
                          "mb-2 p-2 rounded-lg cursor-pointer transition-colors text-xs",
                          isOutgoing
                            ? "bg-black/15 hover:bg-black/25 border-l-3"
                            : "bg-muted/60 hover:bg-muted border-l-3",
                          quotedMsg.remetente === 'lead'
                            ? "border-l-[#E85D24]"
                            : "border-l-white"
                        )}
                        style={{ borderLeftWidth: '3px' }}
                        onClick={() => scrollToMessage(quotedMsg.id)}
                      >
                        <p className={cn("font-semibold text-[10px] mb-0.5", isOutgoing ? "text-primary-foreground/90" : "text-foreground/80")}>
                          {quotedMsg.remetente === 'lead' ? (lead?.nome || 'Lead') : (quotedMsg.remetente === 'bot' ? 'Agente IA' : 'Equipe')}
                        </p>
                        <p className={cn("line-clamp-2 text-[11px]", isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {(() => {
                            const media = getMediaPreviewMeta(quotedMsg.tipo_conteudo);
                            if (media) {
                              const { Icon, label } = media;
                              return <span className="inline-flex items-center gap-1 align-middle"><Icon className="h-3 w-3" />{label}</span>;
                            }
                            return (quotedMsg.conteudo || '').substring(0, 100) || 'Mensagem';
                          })()}
                          {quotedMsg.conteudo && quotedMsg.conteudo.length > 100 ? '...' : ''}
                        </p>
                      </div>
                    )}

                    <div className="mb-1 space-y-1">
                      {msg.message_attachments?.map(att => (
                        <AttachmentRenderer
                          key={att.id}
                          attachment={att}
                          isOutgoing={isOutgoing}
                          onViewMedia={openMediaViewer}
                        />
                      ))}
                    </div>
                    {!msg.message_attachments?.length && (msg.media_path || msg.conteudo) && (
                      <div className="mb-1">
                        {isAudio ? (
                          <AudioMessage filePath={msg.media_path || msg.conteudo || ''} variant={isOutgoing ? 'outgoing' : 'incoming'} />
                        ) : isVisualMedia ? (
                          <>
                            <MediaMessage
                              path={msg.media_path || msg.conteudo}
                              type={typeLower.includes('video') || pathLower.includes('.mp4') ? 'video' : 'imagem'}
                              onView={openMediaViewer as any}
                            />
                            {msg.conteudo && msg.media_path && (
                              <p className="text-[13px] whitespace-pre-wrap leading-relaxed break-words mt-1">{msg.conteudo}</p>
                            )}
                          </>
                        ) : isPdf ? (
                          <FileMessage 
                            path={msg.media_path || msg.conteudo || ''} 
                            fileName="Documento PDF" 
                            onView={openMediaViewer as any}
                          />
                        ) : null}
                      </div>
                    )}
                    {msg.conteudo && !isAudio && !isVisualMedia && !isPdf && (
                      editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full min-h-[60px] p-2 rounded-lg text-[13px] bg-black/10 border border-white/20 text-inherit resize-none focus:outline-none focus:ring-1 focus:ring-white/40"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(msg); }
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <div className="flex items-center gap-1 justify-end">
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6 rounded-full text-inherit hover:bg-white/20" onClick={handleCancelEdit} disabled={isEditingMessage}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6 rounded-full text-inherit hover:bg-white/20" onClick={() => handleSaveEdit(msg)} disabled={isEditingMessage}>
                              {isEditingMessage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13px] whitespace-pre-wrap leading-relaxed break-words">{msg.conteudo}</p>
                      )
                    )}
                    <div className={cn("flex items-center justify-end gap-1 mt-1.5", isOutgoing ? "text-background/50" : "text-muted-foreground/50")}>
                      {msg.is_edited && <span className="text-[9px] italic">editada</span>}
                      <span className="text-[9px] tabular-nums font-medium">{format(new Date(msg.criado_em), 'HH:mm')}</span>
                      {isOutgoing && <Check className="h-2.5 w-2.5" />}
                    </div>
                  </div>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className={cn("h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0", isOutgoing ? "mr-1" : "ml-1")}><ChevronDown className="h-3 w-3 text-muted-foreground" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align={isOutgoing ? "end" : "start"}>
                        {msg.id_mensagem && (
                          <DropdownMenuItem className="text-xs" onSelect={() => handleReply(msg)}>
                            <Reply className="mr-2 h-3.5 w-3.5" /><span>Responder</span>
                          </DropdownMenuItem>
                        )}
                        {canEditMessage(msg) && (
                          <DropdownMenuItem className="text-xs" onSelect={() => handleStartEdit(msg)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /><span>Editar</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive text-xs" onSelect={() => setDeletingMessage(msg)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /><span>Excluir</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
          {!(isFirstLoad || messagesLoading) && <div ref={messagesEndRef} className="h-4" />}
        </div>
      </ScrollArea>

      <footer data-tutorial="conversation-composer" className="border-t border-border/60 bg-card flex-shrink-0">
        {/* Reply Preview Bar */}
        {replyingTo && (
          <div className="px-3 pt-2 max-w-5xl mx-auto">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border/40">
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ backgroundColor: replyingTo.remetente === 'lead' ? '#E85D24' : '#ffffff' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground/80">
                  {replyingTo.remetente === 'lead' ? (lead?.nome || 'Lead') : (replyingTo.remetente === 'bot' ? 'Agente IA' : 'Equipe')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {(() => {
                    const media = getMediaPreviewMeta(replyingTo.tipo_conteudo);
                    if (media) {
                      const { Icon, label } = media;
                      return <span className="inline-flex items-center gap-1 align-middle"><Icon className="h-3 w-3" />{label}</span>;
                    }
                    return (replyingTo.conteudo || '').substring(0, 100) || 'Mensagem';
                  })()}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => setReplyingTo(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="p-2 sm:p-3">
        {isRecordingMode ? (
          <AudioRecorder onSend={handleSendAudio} onCancel={() => setIsRecordingMode(false)} />
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-full border border-border/50 focus-within:border-border focus-within:shadow-[0_0_0_3px_rgba(232,93,36,0.06)] transition-all max-w-5xl mx-auto relative">
            <div className="flex items-center shrink-0">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full text-muted-foreground hover:text-primary">
                            <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none" align="start" side="top">
                        <EmojiPicker onEmojiClick={(emoji) => setMessageContent(prev => prev + emoji.emoji)} />
                    </PopoverContent>
                </Popover>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-full text-muted-foreground hover:text-primary", isSendingMedia && "opacity-50")}
                            disabled={isSendingMedia}
                        >
                            {isSendingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-48 rounded-xl p-1 shadow-xl border-border/40">
                        <DropdownMenuItem className="gap-3 p-2 cursor-pointer rounded-lg" onClick={() => docInputRef.current?.click()}>
                            <div className="bg-indigo-100 p-2 rounded-full text-indigo-600"><FileText className="h-4 w-4" /></div>
                            <span className="font-medium text-sm">Documento</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-3 p-2 cursor-pointer rounded-lg" onClick={() => mediaInputRef.current?.click()}>
                            <div className="bg-blue-100 p-2 rounded-full text-blue-600"><ImageIcon className="h-4 w-4" /></div>
                            <span className="font-medium text-sm">Fotos e vídeos</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <input 
                    type="file" 
                    className="hidden" 
                    ref={mediaInputRef} 
                    multiple
                    onChange={handleFileSelection}
                    accept="image/*,video/*"
                />
                <input 
                    type="file" 
                    className="hidden" 
                    ref={docInputRef} 
                    multiple
                    onChange={handleFileSelection}
                    accept="application/pdf"
                />
            </div>

            <Input ref={inputRef} placeholder="Digite sua mensagem..." value={messageContent} onChange={(e) => setMessageContent(e.target.value)} autoComplete="off" className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 h-8 sm:h-9 text-sm" />
            
            <div className="flex-shrink-0">
                {messageContent.trim() ? (
                    <Button type="submit" size="icon" className="bg-foreground hover:bg-foreground/90 h-8 w-8 sm:h-9 sm:w-9 rounded-full shadow-sm transition-transform active:scale-95">
                        <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-background" />
                    </Button>
                ) : (
                    <Button type="button" size="icon" variant="ghost" className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-full text-muted-foreground", isSendingAudio && "opacity-50")} onClick={() => setIsRecordingMode(true)} disabled={isSendingAudio || isSendingMedia}>
                        <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                )}
            </div>
          </form>
        )}
        </div>
      </footer>

      <MediaPreviewModal 
        isOpen={isMediaPreviewOpen}
        files={pendingFiles}
        onClose={() => { setIsMediaPreviewOpen(false); setPendingFiles([]); }}
        onSend={handleConfirmMediaSend}
        onAddFiles={(newFiles) => setPendingFiles([...pendingFiles, ...newFiles])}
      />

      {viewingMedia && (
        <FullscreenMediaViewer 
          mediaUrl={viewingMedia.url}
          type={viewingMedia.type}
          fileName={viewingMedia.name}
          onClose={() => setViewingMedia(null)}
        />
      )}

      <AlertDialog open={!!deletingMessage} onOpenChange={(open) => !open && setDeletingMessage(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle className="font-display">Excluir mensagem?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="flex-1 bg-destructive hover:bg-destructive/90 rounded-xl" onClick={() => { if (deletingMessage) { deleteMessage({ messageId: deletingMessage.id, leadId, id_mensagem: deletingMessage.id_mensagem }); setDeletingMessage(null); } }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBlacklistConfirm} onOpenChange={setShowBlacklistConfirm}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display">
              <ShieldBan className="h-5 w-5 text-red-500" />
              Bloquear número permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O número <strong>{lead?.telefone}</strong> será adicionado à lista de bloqueio.
              Novas mensagens deste número serão ignoradas pelo sistema e nenhum lead será criado.
              Esta ação pode ser revertida na página de configurações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl" disabled={isBlacklisting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl"
              onClick={handleBlacklistLead}
              disabled={isBlacklisting}
            >
              {isBlacklisting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldBan className="h-4 w-4 mr-1" />}
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LeadModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        lead={lead}
        mode="view"
      />

      {lead && (
        <AgendamentoLeadModal
          isOpen={showAgendamentoModal}
          onClose={() => setShowAgendamentoModal(false)}
          leadId={lead.id}
          leadNome={lead.nome || "Lead"}
          agendamentoExistente={undefined}
          onSaved={() => {
            invalidateAgendamento();
            updateLead({ id: lead.id, is_scheduled: true });
            queryClient.invalidateQueries({ queryKey: ['lead-all-agendamentos', leadId] });
          }}
        />
      )}

      {lead && (
        <VendaModal
          open={showVendaModal}
          onOpenChange={setShowVendaModal}
          lead={lead}
          onSaved={() => {
            updateLead({ id: lead.id, is_closed: true });
            queryClient.invalidateQueries({ queryKey: ['lead-all-vendas', leadId] });
          }}
        />
      )}

      {/* Modal de Lead Scoring */}
      <Dialog open={showScoringModal} onOpenChange={setShowScoringModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display">Qualificar Lead</DialogTitle>
            <p className="text-sm text-muted-foreground">Selecione a classificação deste lead antes de qualificá-lo.</p>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {SCORING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedScoring(opt.value)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left",
                  selectedScoring === opt.value
                    ? "ring-2 ring-offset-1"
                    : "border-transparent hover:border-muted-foreground/20"
                )}
                style={{
                  backgroundColor: opt.bg,
                  borderColor: selectedScoring === opt.value ? opt.text : undefined,
                  ringColor: selectedScoring === opt.value ? opt.text : undefined,
                }}
              >
                <span
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-sm font-black flex-shrink-0"
                  style={{ backgroundColor: opt.text, color: opt.bg }}
                >
                  {opt.value}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: opt.text }}>{opt.label}</p>
                  <p className="text-xs mt-0.5 opacity-80" style={{ color: opt.text }}>{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowScoringModal(false)}>Cancelar</Button>
            <Button
              disabled={!selectedScoring}
              onClick={handleConfirmScoring}
              className="text-white font-bold"
              style={selectedScoring ? {
                backgroundColor: SCORING_OPTIONS.find(s => s.value === selectedScoring)?.text,
              } : { backgroundColor: '#10b981' }}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Qualificar como {selectedScoring || '...'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
