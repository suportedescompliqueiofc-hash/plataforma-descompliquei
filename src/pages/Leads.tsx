import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, UserCheck, Ban, Upload, Users, Phone, Calendar, MoreHorizontal, X, SlidersHorizontal, ArrowUpDown, Clock, Tag, MapPin, ShieldBan, ShieldOff, Activity, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/PageHero";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useProfile } from "@/hooks/useProfile";
import { ANNA_CLARA_ORG_ID } from "@/lib/constants";
import { LeadModal } from "@/components/leads/LeadModal";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useTags } from "@/hooks/useTags";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { cn } from "@/lib/utils";
import { useTeamMembersForSelect } from "@/hooks/useTeamMembersForSelect";
import { useBlacklist } from "@/hooks/useBlacklist";
import { format as formatDate2 } from "date-fns";

const ITEMS_PER_PAGE = 50;

function LeadAvatar({ name }: { name: string }) {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="h-8 w-8 rounded-full bg-muted/80 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-semibold text-muted-foreground/80 select-none">{initials}</span>
    </div>
  );
}

export default function Leads() {
  const { profile } = useProfile();
  const isAnnaClaraOrg = profile?.organization_id === ANNA_CLARA_ORG_ID;
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBlacklisting, setIsBlacklisting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<'leads' | 'blacklist'>('leads');

  const { leads, isLoading: leadsLoading, deleteLead, blacklistLead, updateLead } = useLeads();
  const { entries: blacklistEntries, isLoading: blacklistLoading, removeFromBlacklist } = useBlacklist();
  const { allSources } = useLeadSources();
  const { availableTags } = useTags();
  const { members: teamMembers } = useTeamMembersForSelect();

  const isLoading = leadsLoading;

  const [filters, setFilters] = useState({
    searchTerm: "",
    origem: "Todos",
    fonte: "Todos",
    tagId: "Todos",
    responsavel_id: "Todos",
  });

  const [cadastroRange, setCadastroRange] = useState<DateRange | undefined>(undefined);

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.origem !== "Todos") count++;
    if (filters.fonte !== "Todos") count++;
    if (filters.tagId !== "Todos") count++;
    if (filters.responsavel_id !== "Todos") count++;
    if (cadastroRange?.from) count++;
    return count;
  }, [filters, cadastroRange]);

  const clearFilters = () => {
    setFilters({
      searchTerm: filters.searchTerm,
      origem: "Todos",
      fonte: "Todos",
      tagId: "Todos",
      responsavel_id: "Todos",
    });
    setCadastroRange(undefined);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const searchTermMatch =
        (lead.nome && lead.nome.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        lead.telefone.includes(filters.searchTerm);

      const origemMatch = filters.origem === "Todos" || lead.origem === filters.origem;
      const fonteMatch = filters.fonte === "Todos" || (lead.fonte && lead.fonte === filters.fonte);
      const tagMatch = filters.tagId === "Todos" ||
        (lead.leads_tags && lead.leads_tags.some((leadTag) => leadTag.tags && leadTag.tags.id === filters.tagId));

      const responsavelMatch = filters.responsavel_id === "Todos" ||
        (filters.responsavel_id === "sem_responsavel"
          ? !lead.responsavel_id
          : lead.responsavel_id === filters.responsavel_id);

      let cadastroMatch = true;
      if (cadastroRange?.from && lead.criado_em) {
        const leadDate = new Date(lead.criado_em);
        const rangeFrom = startOfDay(cadastroRange.from);
        const rangeTo = cadastroRange.to ? endOfDay(cadastroRange.to) : endOfDay(cadastroRange.from);
        cadastroMatch = isWithinInterval(leadDate, { start: rangeFrom, end: rangeTo });
      }

      return searchTermMatch && origemMatch && fonteMatch && tagMatch && responsavelMatch && cadastroMatch;
    });
  }, [leads, filters, cadastroRange]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentLeads = filteredLeads.slice(startIndex, endIndex);

  const handleView = (lead: Lead) => {
    setSelectedLead(lead);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedLead(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDeleting(true);
  };

  const handleBlacklistRequest = (lead: Lead) => {
    setSelectedLead(lead);
    setIsBlacklisting(true);
  };

  const confirmDelete = async () => {
    if (selectedLead) {
      await deleteLead(selectedLead.id);
    }
    setIsDeleting(false);
    setSelectedLead(null);
  };

  const confirmBlacklist = async () => {
    if (selectedLead) {
      await blacklistLead({
        id: selectedLead.id,
        nome: selectedLead.nome,
        telefone: selectedLead.telefone,
      });
    }
    setIsBlacklisting(false);
    setSelectedLead(null);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    // Remove o prefixo 55 (Brasil)
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      cleaned = cleaned.slice(2);
    }
    // Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff}min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return '-';
    try {
      const date = parseISO(timestamp);
      return format(date, 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  const handleModalOpenChange = useCallback((open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedLead(null);
    }
  }, []);

  const allCurrentSelected = currentLeads.length > 0 && currentLeads.every(l => selectedIds.has(l.id));
  const someCurrentSelected = currentLeads.some(l => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentLeads.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentLeads.forEach(l => next.add(l.id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const confirmBulkDelete = async () => {
    for (const id of Array.from(selectedIds)) {
      await deleteLead(id);
    }
    setSelectedIds(new Set());
    setIsBulkDeleting(false);
  };

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-32 rounded-md mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="space-y-0 rounded-xl border border-border/60 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border/40 last:border-b-0">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Stats ---
  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => l.status === 'Ativo').length;
  const qualifiedLeads = leads.filter(l => l.is_qualified).length;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
      {/* ══════════ Page Header ══════════ */}
      <PageHero
        icon={Users}
        title="Leads"
        subtitle={`${totalLeads} leads no total · ${activeLeads} ativos · ${qualifiedLeads} qualificados`}
        right={
          <div className="flex items-center gap-2" data-tutorial="leads-actions">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs font-medium gap-1.5 bg-white/10 hover:bg-white/15 text-white border-white/15 hover:text-white"
              onClick={() => setIsImportOpen(true)}
              data-tutorial="leads-import"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-lg text-xs font-medium gap-1.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white hover:text-white"
              onClick={handleCreate}
              data-tutorial="leads-add"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Lead
            </Button>
          </div>
        }
      />

      {/* ══════════ Tabs ══════════ */}
      <div className="bg-muted/40 rounded-xl p-1 inline-flex gap-0.5">
        <button
          className={cn("px-4 py-1.5 text-xs font-medium rounded-lg transition-colors", activeView === 'leads' ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
          onClick={() => setActiveView('leads')}
        >
          Leads
        </button>
        <button
          className={cn("px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5", activeView === 'blacklist' ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
          onClick={() => setActiveView('blacklist')}
        >
          <ShieldBan className="h-3 w-3" />
          Blacklist
          {blacklistEntries.length > 0 && (
            <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-display tabular-nums", activeView === 'blacklist' ? "bg-background/20" : "bg-muted text-muted-foreground")}>{blacklistEntries.length}</span>
          )}
        </button>
      </div>

      {/* ══════════ Search + Filters + Table (view: leads) ══════════ */}
      {activeView === 'leads' && (<><div className="space-y-3" data-tutorial="leads-search">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9 h-9 text-sm bg-card border-border/60 rounded-lg"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 rounded-lg text-xs font-medium gap-1.5 shrink-0",
              showFilters && "bg-foreground text-background hover:bg-foreground/90 border-foreground"
            )}
            onClick={() => setShowFilters(!showFilters)}
            data-tutorial="leads-filters-advanced"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className={cn(
                "text-[10px] font-bold font-display tabular-nums px-1.5 py-0.5 rounded-md",
                showFilters ? "bg-background/20 text-background" : "bg-foreground text-background"
              )}>
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel — Premium */}
        {showFilters && (
          <div className="rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Filtros avançados</span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3 w-3" />
                  Limpar
                </button>
              )}
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5" data-tutorial="leads-origin-filter">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Origem</Label>
                  <Select value={filters.origem} onValueChange={(value) => handleFilterChange('origem', value)}>
                    <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Todos">Todas as origens</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="organico">Orgânico</SelectItem>
                      {isAnnaClaraOrg && <SelectItem value="convenio">Convênio</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Fonte</Label>
                  <Select value={filters.fonte} onValueChange={(value) => handleFilterChange('fonte', value)}>
                    <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Todos">Todas as fontes</SelectItem>
                      {allSources.map((source) => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5" data-tutorial="leads-tags-filter">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Etiqueta</Label>
                  <Select value={filters.tagId} onValueChange={(value) => handleFilterChange('tagId', value)}>
                    <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Todos">Todas as etiquetas</SelectItem>
                      {availableTags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {teamMembers.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground/70">Responsável</Label>
                    <Select value={filters.responsavel_id} onValueChange={(v) => handleFilterChange('responsavel_id', v)}>
                      <SelectTrigger className="h-9 text-xs rounded-lg border-border/60 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Todos">Todos os responsáveis</SelectItem>
                        <SelectItem value="sem_responsavel">
                          <span className="text-muted-foreground">Sem responsável</span>
                        </SelectItem>
                        {teamMembers.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                {m.url_avatar
                                  ? <img src={m.url_avatar} className="h-full w-full object-cover" />
                                  : <span className="text-[8px] font-bold text-muted-foreground">{(m.nome || m.email).charAt(0).toUpperCase()}</span>
                                }
                              </div>
                              {m.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[11px] font-medium text-muted-foreground/70">Período de Cadastro</Label>
                  <DateRangePicker
                    date={cadastroRange}
                    setDate={setCadastroRange}
                    hideQuickSelect
                    placeholder="Selecionar período"
                    className="w-full [&>button]:h-9 [&>button]:text-xs [&>button]:rounded-lg [&>button]:border-border/60 [&>button]:bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ Bulk Selection Bar — Premium ══════════ */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-foreground/10 bg-foreground text-background shadow-lg" data-tutorial="leads-bulk-bar">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-background/15 text-background">
              <Users className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-bold font-display tabular-nums">{selectedIds.size}</span>
            <span className="text-xs font-medium text-background/70">selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
          </div>

          <div className="h-4 w-px bg-background/15 mx-1" />

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Bloquear Números */}
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 font-medium text-amber-300 hover:text-amber-200 hover:bg-background/10" onClick={() => {
              // Block all selected leads
              const selectedLeadsList = leads.filter(l => selectedIds.has(l.id));
              selectedLeadsList.forEach(lead => {
                blacklistLead({ id: lead.id, nome: lead.nome, telefone: lead.telefone });
              });
              setSelectedIds(new Set());
            }}>
              <ShieldBan className="h-3 w-3" />
              <span className="hidden sm:inline">Bloquear</span>
            </Button>

            {/* Excluir */}
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 font-medium text-red-300 hover:text-red-200 hover:bg-background/10" onClick={() => setIsBulkDeleting(true)}>
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">Excluir</span>
            </Button>

            <div className="h-4 w-px bg-background/15 mx-0.5" />

            {/* Cancelar */}
            <Button variant="ghost" size="sm" className="h-7 text-[11px] font-medium text-background/50 hover:text-background hover:bg-background/10" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════ Table ══════════ */}
      <div className="rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="leads-table">
        <div className="w-full overflow-x-auto overflow-y-hidden">
          <div className="min-w-[1000px] w-full">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60 hover:bg-transparent">
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={allCurrentSelected}
                      data-state={someCurrentSelected && !allCurrentSelected ? 'indeterminate' : undefined}
                      onCheckedChange={toggleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Lead</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Contato</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Origem</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Etiquetas</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Responsável</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Cadastro</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentLeads.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="py-20">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="bg-muted/40 p-6 rounded-2xl mb-4">
                          <Users className="h-8 w-8 text-muted-foreground/25" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground/70">Nenhum lead encontrado</p>
                        <p className="text-xs text-muted-foreground/50 mt-1">Tente ajustar os filtros ou adicione um novo lead.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentLeads.map((lead, idx) => {
                    return (
                      <TableRow
                        key={lead.id}
                        className={cn(
                          "border-b border-border/40 last:border-b-0 transition-colors duration-100 cursor-pointer",
                          selectedIds.has(lead.id) ? "bg-muted/30" : "hover:bg-muted/20"
                        )}
                        onClick={() => handleView(lead)}
                      >
                        {/* Checkbox */}
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(lead.id)}
                            onCheckedChange={() => toggleSelectOne(lead.id)}
                            className="rounded"
                          />
                        </TableCell>

                        {/* Lead — Avatar + Name + MQL */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <LeadAvatar name={lead.nome} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-semibold text-foreground truncate max-w-[160px] font-display">{lead.nome}</span>
                                {lead.is_qualified && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                                    <UserCheck className="h-2.5 w-2.5" />
                                    Qualificado
                                  </span>
                                )}
                              </div>
                              {lead.procedimento_interesse && (
                                <span className="text-[11px] text-muted-foreground/60 truncate block max-w-[160px]">{lead.procedimento_interesse}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Contato — Phone + Last Contact */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="text-[12px] text-foreground/80 font-display tabular-nums whitespace-nowrap">{formatPhone(lead.telefone)}</span>
                            {lead.ultimo_contato && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(lead.ultimo_contato)}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Origem + Fonte */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className={cn(
                              "inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                              lead.origem === 'marketing'
                                ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                : lead.origem === 'reativacao'
                                ? "bg-cyan-50 text-cyan-700 border border-cyan-200/60"
                                : lead.origem === 'paciente'
                                ? "bg-teal-50 text-teal-700 border border-teal-200/60"
                                : lead.origem === 'convenio'
                                ? "bg-violet-50 text-violet-700 border border-violet-200/60"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            )}>
                              {{ marketing: 'Marketing', organico: 'Orgânico', indicacao: 'Indicação', reativacao: 'Reativação', paciente: 'Paciente', convenio: 'Convênio' }[lead.origem as string] ?? lead.origem ?? 'Orgânico'}
                            </span>
                            {lead.fonte && (
                              <span className="text-[10px] text-muted-foreground/50 block truncate max-w-[100px]">{lead.fonte}</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Etiquetas */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[130px]">
                            {lead.leads_tags && lead.leads_tags.length > 0 ? (
                              lead.leads_tags.slice(0, 2).map((leadTag) => leadTag.tags && (
                                <span
                                  key={leadTag.tags.id}
                                  className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-md border"
                                  style={{
                                    backgroundColor: `${leadTag.tags.color}10`,
                                    color: leadTag.tags.color,
                                    borderColor: `${leadTag.tags.color}30`,
                                  }}
                                >
                                  {leadTag.tags.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted-foreground/30">-</span>
                            )}
                            {lead.leads_tags && lead.leads_tags.length > 2 && (
                              <span className="text-[10px] text-muted-foreground/50 font-medium">+{lead.leads_tags.length - 2}</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Responsável */}
                        <TableCell>
                          {(() => {
                            const resp = lead.responsavel_id ? teamMembers.find(m => m.id === lead.responsavel_id) : null;
                            if (!resp) return <span className="text-[11px] text-muted-foreground/30">—</span>;
                            return (
                              <div className="flex items-center gap-1.5">
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border/60">
                                  {resp.url_avatar
                                    ? <img src={resp.url_avatar} className="h-full w-full object-cover" />
                                    : <span className="text-[9px] font-bold text-muted-foreground">{resp.nome.charAt(0).toUpperCase()}</span>
                                  }
                                </div>
                                <span className="text-[11px] font-medium text-foreground/80 truncate max-w-[80px]">{resp.nome.split(' ')[0]}</span>
                              </div>
                            );
                          })()}
                        </TableCell>

                        {/* Cadastro */}
                        <TableCell>
                          <span className="text-[11px] text-muted-foreground/60 tabular-nums">{formatDate(lead.criado_em)}</span>
                        </TableCell>

                        {/* Actions — Dropdown */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground/50 hover:text-foreground" {...(idx === 0 ? { 'data-tutorial': 'leads-row-actions' } : {})}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl">
                              <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}`)} className="text-xs gap-2 rounded-lg">
                                <Activity className="h-3.5 w-3.5" />
                                Ver Jornada
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEdit(lead)} className="text-xs gap-2 rounded-lg">
                                <Pencil className="h-3.5 w-3.5" />
                                Editar Lead
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleBlacklistRequest(lead)} className="text-xs gap-2 rounded-lg text-amber-600 focus:text-amber-700">
                                <Ban className="h-3.5 w-3.5" />
                                Bloquear Número
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteRequest(lead)} className="text-xs gap-2 rounded-lg text-destructive focus:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                                Excluir Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ══════════ Pagination ══════════ */}
        {filteredLeads.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40" data-tutorial="leads-pagination">
            <span className="text-[11px] text-muted-foreground/60 font-display tabular-nums">
              {startIndex + 1}–{Math.min(endIndex, filteredLeads.length)} de {filteredLeads.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-medium text-muted-foreground px-2 font-display tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div></>)}

      {/* ══════════ Blacklist (view: blacklist) ══════════ */}
      {activeView === 'blacklist' && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <ShieldBan className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">BLACKLIST</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Números bloqueados permanentemente — não receberão atendimento</p>
              </div>
            </div>
          </div>

          {blacklistLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : blacklistEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <ShieldOff className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum número bloqueado</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Números bloqueados via "Bloquear número" aparecem aqui</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {blacklistEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                      <ShieldBan className="h-3.5 w-3.5 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground font-display tabular-nums">{entry.telefone}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {entry.motivo || 'Sem motivo registrado'}
                        <span className="mx-1.5 text-border">·</span>
                        {formatDate2(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={() => removeFromBlacklist(entry.id)}
                  >
                    <ShieldOff className="h-3 w-3" />
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ Modals ══════════ */}
      <LeadModal open={isModalOpen} onOpenChange={handleModalOpenChange} lead={selectedLead} mode={modalMode} />
      <ImportLeadsDialog open={isImportOpen} onOpenChange={setIsImportOpen} />

      {/* Bulk Delete */}
      <AlertDialog open={isBulkDeleting} onOpenChange={setIsBulkDeleting}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">Excluir {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta ação não pode ser desfeita. Os leads selecionados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="flex-1 bg-destructive hover:bg-destructive/90 rounded-xl">
              Sim, excluir todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta ação não pode ser desfeita. O lead "{selectedLead?.nome}" será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="flex-1 bg-destructive hover:bg-destructive/90 rounded-xl">
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blacklist */}
      <AlertDialog open={isBlacklisting} onOpenChange={setIsBlacklisting}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">Bloquear número?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              O lead "{selectedLead?.nome || selectedLead?.telefone}" será removido e o número será bloqueado permanentemente. Não será possível recriá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBlacklist} className="flex-1 bg-amber-600 hover:bg-amber-700 rounded-xl">
              Sim, bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
