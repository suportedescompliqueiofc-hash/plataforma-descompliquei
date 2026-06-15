"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Search, Mic, Image as ImageIcon, Video, FileText, MoreVertical, Trash2, Pencil, Tag as TagIcon, X, ChevronRight, Hash, Filter, Globe, User, Clock, Calendar as CalendarIcon, CheckCircle, Megaphone, GitBranch, UserPlus, CheckSquare, Square, Zap, Bot, Loader2, Check, EyeOff, Eye, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversationsList, Conversation, useDeleteChat } from "@/hooks/useConversations";
import { format, isToday, isYesterday, isValid, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TAG_COLORS, useTags, Tag } from "@/hooks/useTags";
import { useStages } from "@/hooks/useStages";
import { useLeads } from "@/hooks/useLeads";
import { useCadences, useLeadCadence } from "@/hooks/useCadences";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { DateRange } from "react-day-picker";
import { LeadModal } from "@/components/leads/LeadModal";
import { NonLeadAnalysisModal } from "@/components/conversations/NonLeadAnalysisModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { ANNA_CLARA_ORG_ID } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const formatLastMessageTime = (timestamp?: string | null) => {
  if (!timestamp) return '';
  try {
    let date = parseISO(timestamp);
    if (!isValid(date)) {
      date = new Date(timestamp.replace(' ', 'T'));
    }
    if (!isValid(date)) return '';
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM');
  } catch (e) {
    return '';
  }
};

const MessagePreview = ({ content, type, sender }: { content?: string, type?: string, sender?: string }) => {
  if (!content && !type) return <span className="italic text-muted-foreground/60">Nenhuma mensagem</span>;
  const isOutgoing = sender === 'agente' || sender === 'bot' || sender === 'agente_crm';

  return (
    <div className="flex items-center gap-1 w-full overflow-hidden text-muted-foreground/80">
      {isOutgoing && <span className="font-medium text-primary shrink-0">Você:</span>}
      {type === 'audio' && <Mic className="h-3 w-3 shrink-0" />}
      {type === 'imagem' && <ImageIcon className="h-3 w-3 shrink-0" />}
      {type === 'video' && <Video className="h-3 w-3 shrink-0" />}
      {(type === 'pdf' || type === 'arquivo') && <FileText className="h-3 w-3 shrink-0" />}
      
      <span className="block truncate flex-1">
        {type !== 'texto' ? (type === 'audio' ? 'Áudio' : type === 'imagem' ? 'Foto' : type === 'video' ? 'Vídeo' : 'Arquivo') : content}
      </span>
    </div>
  );
};

const ConversationItem = ({
  conversation,
  onDelete,
  onEditName,
  onQuickAction,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  messageSnippet,
  basePath = '/crm/conversas',
}: {
  conversation: Conversation,
  onDelete: (c: Conversation) => void,
  onEditName: (c: Conversation) => void,
  onQuickAction: (id: string, action: BulkActionType) => void,
  isSelectionMode: boolean,
  isSelected: boolean,
  onToggleSelection: (id: string) => void,
  messageSnippet?: string,
  basePath?: string,
}) => {
  const { leadId } = useParams();
  const isActive = leadId === conversation.id;
  const lastMessageTime = formatLastMessageTime(conversation.last_message_timestamp);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="relative group">
      <div
        className={cn(
          "flex gap-3 px-3 py-3.5 transition-all duration-150 cursor-pointer items-center w-full overflow-hidden",
          isActive
            ? "bg-gradient-to-r from-primary/[0.08] to-transparent border-l-[3px] border-l-primary"
            : "bg-transparent hover:bg-muted/30 border-l-[3px] border-l-transparent",
          isSelected && "bg-primary/5"
        )}
        onClick={() => isSelectionMode && onToggleSelection(conversation.id)}
      >
        <div className="flex items-center gap-3 shrink-0">
          {isSelectionMode && (
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelection(conversation.id)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </div>
          )}

          <Link
            to={`${basePath}/${conversation.id}`}
            className="shrink-0"
            onClick={(e) => isSelectionMode ? e.preventDefault() : e.stopPropagation()}
          >
            <Avatar className="h-11 w-11 border border-border/30 shadow-sm">
              <AvatarFallback className={cn("text-xs font-bold tracking-tight", isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                {getInitials(conversation.nome)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>

        <Link
          to={isSelectionMode ? "#" : `${basePath}/${conversation.id}`}
          className="flex-1 min-w-0 grid grid-rows-2 gap-y-0.5"
          onClick={(e) => isSelectionMode && e.preventDefault()}
        >
          <div className="flex items-center justify-between gap-2 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-semibold text-[13px] text-foreground truncate leading-tight">
                {conversation.nome || conversation.telefone}
              </span>
              
              {conversation.origem === 'marketing' ? (
                <Megaphone className="h-3 w-3 text-muted-foreground/60 shrink-0" title="Marketing" />
              ) : (
                <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" title="Orgânico" />
              )}
              
              {conversation.ia_ativa === true && (
                <Bot className="h-3 w-3 text-violet-500 shrink-0" title="IA Ativa" />
              )}

              {conversation.em_cadencia && (
                <Zap className="h-3 w-3 text-orange-500 fill-orange-500/20 shrink-0" title="Em Cadência" />
              )}



              {conversation.lead_scoring && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none"
                  style={{
                    backgroundColor: conversation.lead_scoring === 'A' ? '#E1F5EE' : conversation.lead_scoring === 'B' ? '#E6F1FB' : conversation.lead_scoring === 'C' ? '#FAEEDA' : '#FCEBEB',
                    color: conversation.lead_scoring === 'A' ? '#085041' : conversation.lead_scoring === 'B' ? '#0C447C' : conversation.lead_scoring === 'C' ? '#633806' : '#791F1F',
                  }}
                  title={`Scoring ${conversation.lead_scoring}`}
                >
                  {conversation.lead_scoring}
                </span>
              )}

              <div className="flex gap-0.5 shrink-0">
                {conversation.tags?.slice(0, 2).map(tag => {
                  const isHex = tag.color?.startsWith('#');
                  const preset = TAG_COLORS.find(c => c.name === tag.color);
                  return (
                    <div 
                      key={tag.id} 
                      className={cn("w-2 h-2 rounded-full border border-background shadow-xs", !isHex && preset?.selector)} 
                      style={isHex ? { backgroundColor: tag.color } : undefined}
                      title={tag.name}
                    />
                  );
                })}
              </div>
            </div>
            
            <span className="text-[10px] text-muted-foreground font-semibold whitespace-nowrap shrink-0">
              {lastMessageTime || '--:--'}
            </span>
          </div>

          <div className="min-w-0 overflow-hidden h-5">
            <div className="text-xs w-full">
              {messageSnippet ? (
                <div className="flex items-center gap-1 w-full overflow-hidden text-primary/80">
                  <Search className="h-3 w-3 shrink-0" />
                  <span className="block truncate flex-1 font-medium">{messageSnippet}</span>
                </div>
              ) : (
                <MessagePreview
                  content={conversation.last_message_content}
                  type={conversation.last_message_type}
                  sender={conversation.last_message_sender}
                />
              )}
            </div>
          </div>
        </Link>
      </div>

      {isSelectionMode && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={`${basePath}/${conversation.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border/60 shadow-sm hover:bg-muted transition-colors"
            title="Ver conversa"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      )}

      {!isSelectionMode && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-tutorial="conversations-item-menu-btn" variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/80 shadow-sm border">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-tutorial="conversations-item-menu" align="end" className="w-48">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEditName(conversation); }}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar Nome
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onQuickAction(conversation.id, 'stage'); }}>
                <GitBranch className="mr-2 h-4 w-4" />
                Alterar Etapa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onQuickAction(conversation.id, 'tag'); }}>
                <TagIcon className="mr-2 h-4 w-4" />
                Adicionar Etiqueta
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onQuickAction(conversation.id, 'cadence'); }}>
                <Zap className="mr-2 h-4 w-4" />
                Iniciar Cadência
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onQuickAction(conversation.id, 'ai'); }}>
                <Bot className="mr-2 h-4 w-4" />
                Configurar IA
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onQuickAction(conversation.id, 'origem'); }}>
                <Globe className="mr-2 h-4 w-4" />
                Alterar Origem
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => { e.preventDefault(); onDelete(conversation); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};

type BulkActionType = 'stage' | 'tag' | 'cadence' | 'ai' | 'origem' | 'delete' | 'metrics';

interface ConversationsListProps {
  origemFilter?: string;
  basePath?: string;
  onSelectionChange?: (
    isSelecting: boolean,
    ids: Set<string>,
    triggerAction: (action: BulkActionType) => void,
    cancelSelection: () => void
  ) => void;
}

export function ConversationsList({ origemFilter, basePath = '/crm/conversas', onSelectionChange }: ConversationsListProps = {}) {
  const navigate = useNavigate();
  const { leadId: activeLeadId } = useParams();
  const { data: conversations, isLoading } = useConversationsList();
  const { availableTags, isLoadingTags } = useTags();
  const { stages, isLoading: isLoadingStages } = useStages();
  const { mutate: deleteChat } = useDeleteChat();
  const { updateLead, deleteLead } = useLeads();
  const { cadences } = useCadences();
  const { startCadence } = useLeadCadence(undefined);
  const { profile } = useProfile();
  const isAnnaClaraOrg = profile?.organization_id === ANNA_CLARA_ORG_ID;

  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Conversation | null>(null);
  const [editingLead, setEditingLead] = useState<Conversation | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [showNonLeadModal, setShowNonLeadModal] = useState(false);

  // Busca profunda em mensagens (estilo WhatsApp)
  const [messageSearchLeadIds, setMessageSearchLeadIds] = useState<Set<string>>(new Set());
  const [messageSearchSnippets, setMessageSearchSnippets] = useState<Map<string, string>>(new Map());
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);

  // Debounced search in mensagens table
  useEffect(() => {
    const orgId = profile?.organization_id;
    if (!orgId || searchTerm.trim().length < 3) {
      setMessageSearchLeadIds(new Set());
      setMessageSearchSnippets(new Map());
      setIsSearchingMessages(false);
      return;
    }

    setIsSearchingMessages(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('mensagens')
          .select('lead_id, conteudo')
          .eq('organization_id', orgId)
          .ilike('conteudo', `%${searchTerm.trim()}%`)
          .order('criado_em', { ascending: false })
          .limit(200);

        if (!error && data) {
          const leadIds = new Set<string>();
          const snippets = new Map<string, string>();
          for (const row of data) {
            if (row.lead_id && !leadIds.has(row.lead_id)) {
              leadIds.add(row.lead_id);
              // Guardar trecho da mensagem encontrada como snippet
              const content = row.conteudo || '';
              const idx = content.toLowerCase().indexOf(searchTerm.toLowerCase());
              const start = Math.max(0, idx - 20);
              const end = Math.min(content.length, idx + searchTerm.length + 40);
              snippets.set(row.lead_id, (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : ''));
            }
          }
          setMessageSearchLeadIds(leadIds);
          setMessageSearchSnippets(snippets);
        }
      } catch (e) {
        // silently fail
      } finally {
        setIsSearchingMessages(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm, profile?.organization_id]);

  // Estados de Seleção Múltipla
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estados dos Modais de Ação em Massa
  const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
  const [bulkValue, setBulkValue] = useState<string>("");
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);

  // Ação rápida individual (3 pontinhos) — sem entrar em modo de seleção
  const [singleAction, setSingleAction] = useState<{ leadId: string; action: BulkActionType } | null>(null);

  // Estados de Filtro
  const [filters, setFilters] = useState({
    origin: "all",
    tagId: "all",
    stageId: "all",
    iaFilter: "all",
    dateRange: undefined as DateRange | undefined,
  });

  const filteredConversations = useMemo(() => {
    return conversations?.filter(c => {
      const searchLower = searchTerm.toLowerCase();
      // Busca por nome, telefone, última mensagem E mensagens profundas (via query)
      const nameMatch = !searchTerm ||
        (c.nome && c.nome.toLowerCase().includes(searchLower)) ||
        c.telefone.includes(searchLower) ||
        (c.last_message_content && c.last_message_content.toLowerCase().includes(searchLower)) ||
        messageSearchLeadIds.has(c.id);

      const originMatch = filters.origin === "all" || c.origem === filters.origin;
      const tagMatch = filters.tagId === "all" || c.tags?.some(tag => tag.id === filters.tagId);
      const stageMatch = filters.stageId === "all" || c.posicao_pipeline?.toString() === filters.stageId;
      const iaMatch = filters.iaFilter === "all"
        || (filters.iaFilter === "com_ia" && (c as any).ia_ja_ativada === true)
        || (filters.iaFilter === "sem_ia" && (c as any).ia_ja_ativada !== true);

      let dateMatch = true;
      if (filters.dateRange?.from) {
        const leadDate = parseISO(c.criado_em);
        const start = startOfDay(filters.dateRange.from);
        const end = filters.dateRange.to ? endOfDay(filters.dateRange.to) : endOfDay(filters.dateRange.from);
        dateMatch = (isAfter(leadDate, start) || leadDate.getTime() === start.getTime()) &&
                    (isBefore(leadDate, end) || leadDate.getTime() === end.getTime());
      }

      const outboundMatch = !origemFilter || c.origem === origemFilter || (c as any).fonte === 'prospecao_ativa';

      return nameMatch && originMatch && tagMatch && stageMatch && iaMatch && dateMatch && outboundMatch;
    });
  }, [conversations, searchTerm, filters, messageSearchLeadIds, origemFilter]);

  const hasActiveFilters = filters.origin !== "all" || filters.tagId !== "all" || filters.stageId !== "all" || filters.iaFilter !== "all" || !!filters.dateRange;

  const resetFilters = () => {
    setFilters({ origin: "all", tagId: "all", stageId: "all", dateRange: undefined });
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (filteredConversations) {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)));
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleQuickAction = (id: string, action: BulkActionType) => {
    const conv = conversations?.find(c => c.id === id);
    let initialValue = "";
    if (conv) {
      if (action === 'stage')  initialValue = conv.posicao_pipeline?.toString() ?? "";
      if (action === 'origem') initialValue = (conv as any).origem ?? "";
      if (action === 'ai')     initialValue = (conv as any).ia_ativa ? 'on' : 'off';
    }
    setBulkValue(initialValue);
    setSingleAction({ leadId: id, action });
  };

  // Notifica o componente pai sempre que o estado de seleção muda
  useEffect(() => {
    onSelectionChange?.(isSelectionMode, selectedIds, setBulkAction, handleCancelSelection);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectionMode, selectedIds]);

  const handleOpenEditName = (c: Conversation) => {
    setEditingLead(c);
    setEditingName(c.nome || c.telefone || "");
  };

  const handleSaveName = () => {
    if (!editingLead || !editingName.trim()) return;
    updateLead({ id: editingLead.id, nome: editingName.trim() });
    setEditingLead(null);
    setEditingName("");
  };

  const handleDeleteChat = () => {
    if (confirmDelete) {
      deleteChat({ leadId: confirmDelete.id, deleteLead: origemFilter === 'outbound' }, {
        onSuccess: () => {
          if (activeLeadId === confirmDelete.id) navigate(basePath);
          setConfirmDelete(null);
        }
      });
    }
  };

  // --- Lógica de Ações (em massa ou individual) ---
  const executeBulkAction = async () => {
    const activeAction = singleAction?.action ?? bulkAction;
    const idsArray = singleAction ? [singleAction.leadId] : Array.from(selectedIds);
    if (!activeAction || idsArray.length === 0) return;
    setIsBulkExecuting(true);

    try {
      if (activeAction === 'delete') {
        for (const id of idsArray) {
          await deleteLead(id);
        }
        toast.success(`${idsArray.length} ${idsArray.length === 1 ? 'lead excluído' : 'leads excluídos'} com sucesso.`);
      } else if (activeAction === 'stage') {
        const stagePos = parseInt(bulkValue);
        for (const id of idsArray) {
          await updateLead({ id, posicao_pipeline: stagePos });
        }
        toast.success('Etapa atualizada com sucesso.');
      } else if (activeAction === 'origem') {
        for (const id of idsArray) {
          await updateLead({ id, origem: bulkValue });
        }
        const origemLabels: Record<string, string> = {
          marketing: 'Marketing', organico: 'Orgânico',
          reativacao: 'Reativação', paciente: 'Paciente', convenio: 'Convênio',
        };
        toast.success(`Origem atualizada para "${origemLabels[bulkValue] ?? bulkValue}".`);
      } else if (activeAction === 'ai') {
        const aiActive = bulkValue === 'on';
        for (const id of idsArray) {
          await updateLead({ id, ia_ativa: aiActive });
        }
        toast.success(`IA ${aiActive ? 'ativada' : 'desativada'} com sucesso.`);
      } else if (activeAction === 'cadence') {
        toast.info("Iniciando fluxos automáticos...");
      }

      if (singleAction) {
        setSingleAction(null);
      } else {
        handleCancelSelection();
        setBulkAction(null);
      }
      setBulkValue("");
    } catch (err: any) {
      toast.error("Ocorreu um erro ao executar a ação.");
    } finally {
      setIsBulkExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card w-full overflow-hidden relative">
      
      {/* Barra de seleção — só contagem + cancelar; ações ficam no painel direito */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-foreground text-background animate-in slide-in-from-top duration-200 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-background/15 text-[10px] font-bold shrink-0">
                {selectedIds.size}
              </div>
              <span className="text-[12px] font-semibold truncate">
                {selectedIds.size === 1 ? 'conversa selecionada' : 'conversas selecionadas'}
              </span>
            </div>
            <button
              onClick={handleCancelSelection}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-background/15 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Padrão */}
      <div className="px-4 pt-5 pb-4 border-b border-border/60 bg-card shrink-0">
        <div className="flex items-center justify-between mb-4" data-tutorial="conversations-header">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-lg font-extrabold text-foreground tracking-tight font-display">Conversas</h2>
            {filteredConversations && (
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {filteredConversations.length}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-primary rounded-full h-9 w-9"
                onClick={() => setIsNewLeadModalOpen(true)}
                title="Novo Lead"
            >
                <UserPlus className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-tutorial="conversations-menu-btn" variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full h-9 w-9">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent data-tutorial="conversations-header-menu" align="end" className="w-52">
                <DropdownMenuItem data-tutorial="conversations-select-mode-btn" onClick={() => setIsSelectionMode(true)} className="gap-2">
                  <CheckSquare className="h-4 w-4" /> Selecionar Conversas
                </DropdownMenuItem>
                <DropdownMenuItem data-tutorial="conversations-select-all-btn" onClick={() => { setIsSelectionMode(true); handleSelectAll(); }} className="gap-2">
                  <Square className="h-4 w-4" /> Selecionar Tudo
                </DropdownMenuItem>
                {isSelectionMode && (
                   <DropdownMenuItem onClick={handleCancelSelection} className="text-destructive focus:text-destructive gap-2">
                      <X className="h-4 w-4" /> Cancelar Seleção
                   </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowNonLeadModal(true)} className="gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span>Analisar não-leads</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Botões invisíveis para o sistema de tutorial — sempre no DOM */}
        <button data-tutorial="conversations-select-mode-direct" className="sr-only" onClick={() => setIsSelectionMode(true)} tabIndex={-1} aria-hidden="true" />
        <button data-tutorial="conversations-cancel-selection-direct" className="sr-only" onClick={handleCancelSelection} tabIndex={-1} aria-hidden="true" />
        <button data-tutorial="conversations-select-first-direct" className="sr-only" onClick={() => { if (filteredConversations && filteredConversations.length > 0) { setIsSelectionMode(true); handleToggleSelection(filteredConversations[0].id); } }} tabIndex={-1} aria-hidden="true" />

        <div className="flex items-center gap-2">
            <div className="relative flex-1" data-tutorial="conversations-search">
              {isSearchingMessages ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                placeholder="Buscar nome, telefone ou mensagem..."
                className="pl-10 h-9 bg-muted/40 border-transparent focus-visible:border-border focus-visible:ring-1 focus-visible:ring-primary/20 rounded-full text-sm placeholder:text-muted-foreground/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  data-tutorial="conversations-filter"
                  className={cn(
                    "h-9 w-9 shrink-0 border-transparent bg-muted/40 rounded-full transition-colors hover:bg-muted",
                    hasActiveFilters && "border-primary/30 bg-primary/8 text-primary"
                  )}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                data-tutorial="conversations-filter-panel"
                className="w-[calc(100vw-1.5rem)] sm:w-[340px] p-0 shadow-xl border-border/60 rounded-2xl flex flex-col"
                style={{ maxHeight: 'var(--radix-popover-content-available-height, 80vh)' }}
                align="end"
                sideOffset={8}
                collisionPadding={16}
                avoidCollisions
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Filtros</p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar tudo
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                  {/* Origem */}
                  <div className="space-y-1.5" data-tutorial="conversations-filter-origin">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Globe className="h-3 w-3" /> Origem
                    </p>
                    <Select value={filters.origin} onValueChange={(v) => setFilters(f => ({ ...f, origin: v }))}>
                      <SelectTrigger className="h-9 text-xs rounded-lg border-border/60">
                        <SelectValue placeholder="Todas as origens" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as origens</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="organico">Orgânico</SelectItem>
                        <SelectItem value="reativacao">Reativação</SelectItem>
                        <SelectItem value="paciente">Paciente</SelectItem>
                        {isAnnaClaraOrg && <SelectItem value="convenio">Convênio</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Etapa do Pipeline */}
                  <div className="space-y-1.5" data-tutorial="conversations-filter-stage">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <GitBranch className="h-3 w-3" /> Etapa do Pipeline
                    </p>
                    <Select value={filters.stageId} onValueChange={(v) => setFilters(f => ({ ...f, stageId: v }))}>
                      <SelectTrigger className="h-9 text-xs rounded-lg border-border/60">
                        <SelectValue placeholder="Todas as etapas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as etapas</SelectItem>
                        {stages.map(stage => (
                          <SelectItem key={stage.id} value={stage.posicao_ordem.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.cor }} />
                              {stage.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Etiquetas */}
                  <div className="space-y-1.5" data-tutorial="conversations-filter-tags">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TagIcon className="h-3 w-3" /> Etiquetas
                    </p>
                    <Select value={filters.tagId} onValueChange={(v) => setFilters(f => ({ ...f, tagId: v }))}>
                      <SelectTrigger className="h-9 text-xs rounded-lg border-border/60">
                        <SelectValue placeholder="Todas as etiquetas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as etiquetas</SelectItem>
                        {availableTags.map(tag => (
                          <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Atendimento IA */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Bot className="h-3 w-3" /> Atendimento IA
                    </p>
                    <Select value={filters.iaFilter} onValueChange={(v) => setFilters(f => ({ ...f, iaFilter: v }))}>
                      <SelectTrigger className="h-9 text-xs rounded-lg border-border/60">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="com_ia">Atendidos pela IA</SelectItem>
                        <SelectItem value="sem_ia">Não atendidos pela IA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data de Cadastro */}
                  <div className="space-y-1.5" data-tutorial="conversations-filter-date">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="h-3 w-3" /> Data de Cadastro
                    </p>
                    <DateRangePicker
                      date={filters.dateRange}
                      setDate={(d) => setFilters(f => ({ ...f, dateRange: d }))}
                      hideQuickSelect
                      className="w-full"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
        </div>
      </div>

      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col">
          {isLoading || isLoadingTags || isLoadingStages ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border-b border-border/40">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : filteredConversations && filteredConversations.length > 0 ? (
            filteredConversations.map((conversation, index) => (
              index === 0 ? (
                <div key={conversation.id} data-tutorial="conversation-first-item">
                  <ConversationItem
                    conversation={conversation}
                    onDelete={setConfirmDelete}
                    onEditName={handleOpenEditName}
                    onQuickAction={handleQuickAction}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(conversation.id)}
                    onToggleSelection={handleToggleSelection}
                    messageSnippet={messageSearchSnippets.get(conversation.id)}
                    basePath={basePath}
                  />
                </div>
              ) : (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  onDelete={setConfirmDelete}
                  onEditName={handleOpenEditName}
                  onQuickAction={handleQuickAction}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(conversation.id)}
                  onToggleSelection={handleToggleSelection}
                  messageSnippet={messageSearchSnippets.get(conversation.id)}
                  basePath={basePath}
                />
              )
            ))
          ) : (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <div className="bg-muted/50 p-5 rounded-2xl">
                <Search className="h-6 w-6 opacity-30" />
              </div>
              <p className="text-xs px-4 text-muted-foreground/70">Nenhum cliente encontrado para os filtros selecionados.</p>
              {hasActiveFilters && <Button variant="link" size="sm" onClick={resetFilters}>Limpar filtros</Button>}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Dialog para Novo Lead */}
      {profile?.organization_id && (
        <NonLeadAnalysisModal
          open={showNonLeadModal}
          onClose={() => setShowNonLeadModal(false)}
          organizationId={profile.organization_id}
        />
      )}

      <LeadModal
        open={isNewLeadModalOpen}
        onOpenChange={setIsNewLeadModalOpen} 
        mode="create" 
      />

      {/* Modais de Ação em Massa */}
      {(() => {
        const activeDialogAction = singleAction?.action ?? bulkAction;
        const dialogCount = singleAction ? 1 : selectedIds.size;
        const closeDialog = () => { if (!isBulkExecuting) { setSingleAction(null); setBulkAction(null); } };
        return (
      <Dialog open={activeDialogAction !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md p-0 rounded-2xl border border-border/60 overflow-hidden gap-0">

          {/* Header */}
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className={cn("p-1.5 rounded-lg", activeDialogAction === 'delete' ? "bg-red-50" : "bg-muted")}>
                {activeDialogAction === 'stage'   && <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
                {activeDialogAction === 'tag'     && <TagIcon    className="h-3.5 w-3.5 text-muted-foreground" />}
                {activeDialogAction === 'cadence' && <Zap        className="h-3.5 w-3.5 text-muted-foreground" />}
                {activeDialogAction === 'ai'      && <Bot        className="h-3.5 w-3.5 text-muted-foreground" />}
                {activeDialogAction === 'origem'  && <Globe      className="h-3.5 w-3.5 text-muted-foreground" />}
                {activeDialogAction === 'delete'  && <Trash2     className="h-3.5 w-3.5 text-destructive" />}
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {activeDialogAction === 'stage'   && 'Alterar Etapa'}
                  {activeDialogAction === 'tag'     && 'Adicionar Etiqueta'}
                  {activeDialogAction === 'cadence' && 'Iniciar Cadência'}
                  {activeDialogAction === 'ai'      && 'Configurar IA'}
                  {activeDialogAction === 'origem'  && 'Alterar Origem'}
                  {activeDialogAction === 'delete'  && 'Excluir Leads'}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {dialogCount} {dialogCount === 1 ? 'conversa selecionada' : 'conversas selecionadas'}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            {activeDialogAction === 'delete' && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tem certeza que deseja excluir permanentemente{' '}
                <span className="font-semibold text-foreground">{dialogCount} {dialogCount === 1 ? 'lead' : 'leads'}</span>{' '}
                e todas as suas conversas? Esta ação não pode ser desfeita.
              </p>
            )}

            {activeDialogAction === 'stage' && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa de destino</p>
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                    <SelectValue placeholder="Selecione uma etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.posicao_ordem.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                          {s.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeDialogAction === 'tag' && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etiqueta para adicionar</p>
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                    <SelectValue placeholder="Selecione uma etiqueta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeDialogAction === 'cadence' && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fluxo de cadência</p>
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                    <SelectValue placeholder="Selecione um fluxo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cadences.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeDialogAction === 'ai' && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Configuração da IA</p>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {[
                    { value: 'on',  label: 'Ativar IA',    desc: 'A IA responderá automaticamente' },
                    { value: 'off', label: 'Desativar IA', desc: 'Atendimento manual apenas' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setBulkValue(opt.value)}
                      className={cn(
                        'flex items-center gap-3 h-12 px-4 rounded-xl border text-left transition-colors',
                        bulkValue === opt.value
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold leading-none">{opt.label}</p>
                        <p className={cn("text-[11px] mt-1", bulkValue === opt.value ? 'text-background/60' : 'text-muted-foreground')}>{opt.desc}</p>
                      </div>
                      {bulkValue === opt.value && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeDialogAction === 'origem' && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nova origem</p>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {[
                    { value: 'marketing',  label: 'Marketing',  color: '#f59e0b' },
                    { value: 'organico',   label: 'Orgânico',   color: '#10b981' },
                    { value: 'reativacao', label: 'Reativação', color: '#06b6d4' },
                    { value: 'paciente',   label: 'Paciente',   color: '#14b8a6' },
                    ...(isAnnaClaraOrg ? [{ value: 'convenio', label: 'Convênio', color: '#8b5cf6' }] : []),
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setBulkValue(opt.value)}
                      className={cn(
                        'flex items-center gap-3 h-10 px-4 rounded-xl border text-sm font-medium transition-colors',
                        bulkValue === opt.value
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border/60 hover:bg-muted/40 text-foreground'
                      )}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                      {opt.label}
                      {bulkValue === opt.value && <Check className="h-4 w-4 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/40 bg-muted/20">
            <button
              onClick={closeDialog}
              disabled={isBulkExecuting}
              className="h-9 rounded-lg text-xs font-semibold border border-border/60 px-4 hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={executeBulkAction}
              disabled={isBulkExecuting || (activeDialogAction !== 'delete' && !bulkValue)}
              className={cn(
                'h-9 rounded-lg text-xs font-semibold px-5 flex items-center gap-1.5 transition-colors disabled:opacity-40',
                activeDialogAction === 'delete'
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : 'bg-foreground text-background hover:bg-foreground/90'
              )}
            >
              {isBulkExecuting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {activeDialogAction === 'delete' ? 'Excluir permanentemente' : 'Confirmar'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
        );
      })()}

      {/* Dialog para Editar Nome do Lead */}
      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Editar Nome
            </DialogTitle>
            <DialogDescription>
              Altere o nome do contato <strong>{editingLead?.nome || editingLead?.telefone}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="Nome do contato"
              className="h-10"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingLead(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSaveName} disabled={!editingName.trim()} className="rounded-xl">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir histórico de conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apagará permanentemente todas as mensagens trocadas com <strong>{confirmDelete?.nome || confirmDelete?.telefone}</strong>. O registro do cliente no CRM continuará preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteChat}>
              Excluir Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}