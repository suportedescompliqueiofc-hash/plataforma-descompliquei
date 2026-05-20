import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Upload, Phone, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Trash2, Users, UserPlus, GitMerge, CheckSquare, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDistanceToNow, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { useOutboundProspectos, OutboundProspecto } from "@/hooks/useOutboundProspectos";
import { useOutboundStages } from "@/hooks/useOutboundStages";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { useLigacaoModal } from "@/contexts/LigacaoContext";
import { ProspectoFormModal } from "@/components/outbound/ProspectoFormModal";
import { ProspectoDetalheModal } from "@/components/outbound/ProspectoDetalheModal";
import { ImportProspectosModal } from "@/components/outbound/ImportProspectosModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

// Searchable filter component using Popover + Command (cmdk)
function SearchableFilter({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value === "todos"
    ? placeholder
    : options.find(o => o.value === value)?.label || value;
  const isActive = value !== "todos";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 px-3 text-sm font-normal justify-between gap-1 min-w-0",
            isActive && "border-[#E85D24]/40 bg-[#E85D24]/5 text-[#E85D24]"
          )}
        >
          <span className="truncate max-w-[150px]">{selectedLabel}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="todos"
                onSelect={() => { onValueChange("todos"); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === "todos" ? "opacity-100" : "opacity-0")} />
                Todos
              </CommandItem>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => { onValueChange(opt.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.icon}
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ITEMS_PER_PAGE = 25;

const SCORING_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  B: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  C: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  D: "bg-red-500/20 text-red-500 border-red-500/30",
};

const CANAL_LABELS: Record<string, string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
  base_comprada: "Base comprada",
  indicacao: "Indicação",
  evento: "Evento",
  outro: "Outro",
};

export default function OutboundProspectos() {
  const { prospectos, isLoading, deleteProspecto, updateProspecto } = useOutboundProspectos();
  const { stages } = useOutboundStages();
  const { users } = useOrgUsers();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  const { openRegistrarLigacao } = useLigacaoModal();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDetalheOpen, setIsDetalheOpen] = useState(false);
  const [selectedProspecto, setSelectedProspecto] = useState<OutboundProspecto | null>(null);
  const [editProspecto, setEditProspecto] = useState<OutboundProspecto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; names: string[] } | null>(null);
  const [isBulkActing, setIsBulkActing] = useState(false);

  const [ultimoContatoRange, setUltimoContatoRange] = useState<DateRange | undefined>(undefined);

  const [filters, setFilters] = useState({
    search: "",
    stage_id: "todos",
    scoring: "todos",
    usuario_id: "todos",
    canal_origem: "todos",
    proxima_acao: "todos",
    cidade: "todos",
    uf: "todos",
    especialidade: "todos",
    tentativas: "todos",
    ultimo_status: "todos",
  });

  // Extract pure city names and UFs from "Cidade - UF" format
  const { cidadesUnicas, ufsUnicas } = useMemo(() => {
    const cidadeSet = new Set<string>();
    const ufSet = new Set<string>();
    prospectos.forEach(p => {
      if (!p.cidade) return;
      const parts = p.cidade.split(" - ");
      if (parts.length >= 2) {
        const cidade = parts.slice(0, -1).join(" - ").trim();
        const uf = parts[parts.length - 1].trim();
        ufSet.add(uf);
        // Only include cities that match the selected UF filter
        if (filters.uf === "todos" || uf === filters.uf) {
          cidadeSet.add(cidade);
        }
      } else {
        if (filters.uf === "todos") cidadeSet.add(p.cidade.trim());
      }
    });
    return {
      cidadesUnicas: Array.from(cidadeSet).sort(),
      ufsUnicas: Array.from(ufSet).sort(),
    };
  }, [prospectos, filters.uf]);

  const especialidadesUnicas = useMemo(() => {
    const set = new Set(prospectos.map(p => p.especialidade).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [prospectos]);

  useEffect(() => { setCurrentPage(1); }, [filters]);

  const filteredProspectos = useMemo(() => {
    return prospectos.filter(p => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!p.nome.toLowerCase().includes(s) && !p.telefone.includes(s) && !(p.clinica || "").toLowerCase().includes(s)) return false;
      }
      if (filters.stage_id !== "todos" && p.stage_id !== filters.stage_id) return false;
      if (filters.scoring !== "todos" && p.lead_scoring !== filters.scoring) return false;
      if (filters.usuario_id !== "todos" && p.usuario_id !== filters.usuario_id) return false;
      if (filters.canal_origem !== "todos" && p.canal_origem !== filters.canal_origem) return false;
      if (filters.cidade !== "todos") {
        if (!p.cidade) return false;
        const parts = p.cidade.split(" - ");
        const cidadePura = parts.length >= 2 ? parts.slice(0, -1).join(" - ").trim() : p.cidade.trim();
        if (cidadePura !== filters.cidade) return false;
      }
      if (filters.uf !== "todos") {
        if (!p.cidade) return false;
        const parts = p.cidade.split(" - ");
        const uf = parts.length >= 2 ? parts[parts.length - 1].trim() : "";
        if (uf !== filters.uf) return false;
      }
      if (filters.especialidade !== "todos" && p.especialidade !== filters.especialidade) return false;
      if (filters.tentativas !== "todos") {
        const t = p.total_tentativas || 0;
        if (filters.tentativas === "0" && t !== 0) return false;
        if (filters.tentativas === "1-3" && (t < 1 || t > 3)) return false;
        if (filters.tentativas === "4-6" && (t < 4 || t > 6)) return false;
        if (filters.tentativas === "7+" && t < 7) return false;
      }
      if (filters.ultimo_status !== "todos" && p.ultimo_status !== filters.ultimo_status) return false;
      if (ultimoContatoRange?.from) {
        if (!p.ultimo_contato) return false;
        const d = new Date(p.ultimo_contato);
        if (d < startOfDay(ultimoContatoRange.from)) return false;
        if (ultimoContatoRange.to) {
          const endOfTo = new Date(ultimoContatoRange.to);
          endOfTo.setHours(23, 59, 59, 999);
          if (d > endOfTo) return false;
        }
      }
      if (filters.proxima_acao !== "todos") {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfWeek = new Date(todayStart);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        if (!p.proxima_acao_data) return false;
        const actionDate = new Date(p.proxima_acao_data);
        if (filters.proxima_acao === "hoje" && actionDate.toDateString() !== now.toDateString()) return false;
        if (filters.proxima_acao === "semana" && (actionDate < todayStart || actionDate > endOfWeek)) return false;
        if (filters.proxima_acao === "atrasados" && actionDate >= todayStart) return false;
      }
      if (dateRange?.from) {
        const d = new Date(p.criado_em);
        if (d < startOfDay(dateRange.from)) return false;
        if (dateRange.to) {
          const endOfTo = new Date(dateRange.to);
          endOfTo.setHours(23, 59, 59, 999);
          if (d > endOfTo) return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (!a.ultimo_contato && !b.ultimo_contato) return 0;
      if (!a.ultimo_contato) return 1;
      if (!b.ultimo_contato) return -1;
      return new Date(b.ultimo_contato).getTime() - new Date(a.ultimo_contato).getTime();
    });
  }, [prospectos, filters, dateRange, ultimoContatoRange]);

  const totalPages = Math.max(1, Math.ceil(filteredProspectos.length / ITEMS_PER_PAGE));
  const paginatedProspectos = filteredProspectos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const hasActiveFilters = filters.search || filters.stage_id !== "todos" || filters.scoring !== "todos" || filters.usuario_id !== "todos" || filters.canal_origem !== "todos" || filters.proxima_acao !== "todos" || filters.cidade !== "todos" || filters.uf !== "todos" || filters.especialidade !== "todos" || filters.tentativas !== "todos" || filters.ultimo_status !== "todos" || !!ultimoContatoRange?.from;

  const clearFilters = () => { setFilters({ search: "", stage_id: "todos", scoring: "todos", usuario_id: "todos", canal_origem: "todos", proxima_acao: "todos", cidade: "todos", uf: "todos", especialidade: "todos", tentativas: "todos", ultimo_status: "todos" }); setUltimoContatoRange(undefined); };

  const handleVer = (p: OutboundProspecto) => { setSelectedProspecto(p); setIsDetalheOpen(true); };
  const handleLigacao = (p: OutboundProspecto) => { openRegistrarLigacao(p); };
  const handleNovo = () => { setEditProspecto(null); setIsFormOpen(true); };
  const handleEditFromDetalhe = () => { setIsDetalheOpen(false); setEditProspecto(selectedProspecto); setIsFormOpen(true); };

  // Selection helpers
  const isAllPageSelected = paginatedProspectos.length > 0 && paginatedProspectos.every(p => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllPageSelected) {
      paginatedProspectos.forEach(p => next.delete(p.id));
    } else {
      paginatedProspectos.forEach(p => next.add(p.id));
    }
    setSelectedIds(next);
  };
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSingle = (p: OutboundProspecto) => {
    setDeleteConfirm({ ids: [p.id], names: [p.nome] });
  };

  const handleDeleteSelected = () => {
    const selected = prospectos.filter(p => selectedIds.has(p.id));
    setDeleteConfirm({ ids: selected.map(p => p.id), names: selected.map(p => p.nome) });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsBulkActing(true);
    try {
      for (const id of deleteConfirm.ids) {
        await (supabase as any).from('outbound_prospectos').delete().eq('id', id);
      }
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      toast.success(`${deleteConfirm.ids.length} prospecto(s) excluído(s)`);
      setSelectedIds(prev => {
        const next = new Set(prev);
        deleteConfirm.ids.forEach(id => next.delete(id));
        return next;
      });
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    } finally {
      setIsBulkActing(false);
      setDeleteConfirm(null);
    }
  };

  const handleBulkStage = async (stageId: string) => {
    setIsBulkActing(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await (supabase as any).from('outbound_prospectos').update({ stage_id: stageId }).eq('id', id);
      }
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      toast.success(`Stage alterado para ${ids.length} prospecto(s)`);
      clearSelection();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleBulkAssign = async (usuarioId: string) => {
    setIsBulkActing(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await (supabase as any).from('outbound_prospectos').update({ usuario_id: usuarioId }).eq('id', id);
      }
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      toast.success(`SDR atribuído para ${ids.length} prospecto(s)`);
      clearSelection();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setIsBulkActing(false);
    }
  };

  const activeStages = stages.filter(s => s.tipo === 'ativo');

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospectos</h1>
          <p className="text-sm text-muted-foreground">{filteredProspectos.length} prospecto{filteredProspectos.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker date={dateRange} setDate={setDateRange} />
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar Lista
          </Button>
          <Button size="sm" onClick={handleNovo} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Prospecto
          </Button>
        </div>
      </div>

      {/* BARRA DE SELEÇÃO */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#E85D24]/5 border border-[#E85D24]/20 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="h-4 w-4 text-[#E85D24]" />
            <span>{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs" disabled={isBulkActing}>
                  <GitMerge className="h-3.5 w-3.5 mr-1" /> Alterar Stage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {activeStages.map(s => (
                  <DropdownMenuItem key={s.id} onSelect={() => handleBulkStage(s.id)}>
                    <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.cor }} />
                    {s.nome}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs" disabled={isBulkActing}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Atribuir SDR
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {users.map(u => (
                  <DropdownMenuItem key={u.id} onSelect={() => handleBulkAssign(u.id)}>
                    {u.nome_completo || "Sem nome"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10" disabled={isBulkActing} onClick={handleDeleteSelected}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>

            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearSelection}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar nome, telefone, clínica..." className="pl-9 h-9" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>
        <SearchableFilter
          value={filters.stage_id}
          onValueChange={v => setFilters(f => ({ ...f, stage_id: v }))}
          placeholder="Stage"
          options={stages.map(s => ({
            value: s.id,
            label: s.nome,
            icon: <span className="w-2 h-2 rounded-full mr-1 shrink-0" style={{ backgroundColor: s.cor }} />,
          }))}
        />
        <SearchableFilter
          value={filters.scoring}
          onValueChange={v => setFilters(f => ({ ...f, scoring: v }))}
          placeholder="Scoring"
          options={[
            { value: "A", label: "A — Lead dos sonhos" },
            { value: "B", label: "B — Qualificado" },
            { value: "C", label: "C — Em desenvolvimento" },
            { value: "D", label: "D — Fora do ICP" },
          ]}
        />
        <SearchableFilter
          value={filters.usuario_id}
          onValueChange={v => setFilters(f => ({ ...f, usuario_id: v }))}
          placeholder="SDR"
          options={users.map(u => ({ value: u.id, label: u.nome_completo || "Sem nome" }))}
        />
        <SearchableFilter
          value={filters.canal_origem}
          onValueChange={v => setFilters(f => ({ ...f, canal_origem: v }))}
          placeholder="Canal"
          options={Object.entries(CANAL_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        />
        {ufsUnicas.length > 0 && (
          <SearchableFilter
            value={filters.uf}
            onValueChange={v => setFilters(f => ({ ...f, uf: v, cidade: "todos" }))}
            placeholder="UF"
            options={ufsUnicas.map(u => ({ value: u, label: u }))}
          />
        )}
        {cidadesUnicas.length > 0 && (
          <SearchableFilter
            value={filters.cidade}
            onValueChange={v => setFilters(f => ({ ...f, cidade: v }))}
            placeholder="Cidade"
            options={cidadesUnicas.map(c => ({ value: c, label: c }))}
          />
        )}
        {especialidadesUnicas.length > 0 && (
          <SearchableFilter
            value={filters.especialidade}
            onValueChange={v => setFilters(f => ({ ...f, especialidade: v }))}
            placeholder="Especialidade"
            options={especialidadesUnicas.map(e => ({ value: e, label: e }))}
          />
        )}
        <SearchableFilter
          value={filters.tentativas}
          onValueChange={v => setFilters(f => ({ ...f, tentativas: v }))}
          placeholder="Tentativas"
          options={[
            { value: "0", label: "Nunca ligou (0)" },
            { value: "1-3", label: "1 a 3" },
            { value: "4-6", label: "4 a 6" },
            { value: "7+", label: "7 ou mais" },
          ]}
        />
        <SearchableFilter
          value={filters.ultimo_status}
          onValueChange={v => setFilters(f => ({ ...f, ultimo_status: v }))}
          placeholder="Status Ligação"
          options={[
            { value: "atendeu", label: "Atendeu" },
            { value: "nao_atendeu", label: "Não atendeu" },
            { value: "ocupado", label: "Ocupado" },
            { value: "caixa_postal", label: "Caixa postal" },
            { value: "numero_errado", label: "Nº errado" },
            { value: "recusou", label: "Recusou" },
          ]}
        />
        <DateRangePicker
          date={ultimoContatoRange}
          setDate={setUltimoContatoRange}
          placeholder="Últ. Contato"
          hideQuickSelect
        />
        <SearchableFilter
          value={filters.proxima_acao}
          onValueChange={v => setFilters(f => ({ ...f, proxima_acao: v }))}
          placeholder="Próx. Ação"
          options={[
            { value: "hoje", label: "Hoje" },
            { value: "semana", label: "Esta semana" },
            { value: "atrasados", label: "Atrasados" },
          ]}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* TABELA */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllPageSelected && paginatedProspectos.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Prospecto</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Scoring</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Último Contato</TableHead>
              <TableHead>Próxima Ação</TableHead>
              <TableHead>SDR</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : paginatedProspectos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                  {hasActiveFilters ? "Nenhum prospecto encontrado com esses filtros" : "Nenhum prospecto cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedProspectos.map(p => {
                const initials = p.nome.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
                const isOverdue = p.proxima_acao_data && new Date(p.proxima_acao_data) < new Date();
                const isChecked = selectedIds.has(p.id);
                return (
                  <TableRow key={p.id} className={`group hover:bg-muted/50 ${isChecked ? 'bg-[#E85D24]/5' : ''}`}>
                    <TableCell>
                      <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(p.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-[#E85D24]/10 text-[#E85D24] text-xs font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{p.nome}</p>
                          {p.clinica && <p className="text-xs text-muted-foreground">{p.clinica}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{p.telefone}</TableCell>
                    <TableCell>
                      {p.stage_nome ? (
                        <Badge variant="outline" style={{ backgroundColor: `${p.stage_cor}20`, color: p.stage_cor, borderColor: `${p.stage_cor}40` }}>{p.stage_nome}</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {p.lead_scoring ? (
                        <Badge variant="outline" className={SCORING_COLORS[p.lead_scoring]}>{p.lead_scoring}</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.total_tentativas}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.ultimo_contato ? formatDistanceToNow(new Date(p.ultimo_contato), { addSuffix: true, locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell>
                      {p.proxima_acao ? (
                        <div>
                          <p className="text-xs">{p.proxima_acao}</p>
                          {p.proxima_acao_data && (
                            <p className={`text-[11px] ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                              {formatDistanceToNow(new Date(p.proxima_acao_data), { addSuffix: true, locale: ptBR })}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{p.perfil_nome || "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleVer(p)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[#E85D24]" onClick={() => handleLigacao(p)}>
                          <Phone className="h-3.5 w-3.5 mr-1" /> Ligação
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDeleteSingle(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredProspectos.length)} de {filteredProspectos.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center px-3 text-sm">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* MODAIS */}
      <ImportProspectosModal open={isImportOpen} onOpenChange={setIsImportOpen} />
      <ProspectoFormModal open={isFormOpen} onOpenChange={setIsFormOpen} prospecto={editProspecto} />
      <ProspectoDetalheModal open={isDetalheOpen} onOpenChange={setIsDetalheOpen} prospecto={selectedProspecto} onEdit={handleEditFromDetalhe} />

      {/* CONFIRM DELETE */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteConfirm?.ids.length === 1 ? 'prospecto' : `${deleteConfirm?.ids.length} prospectos`}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.ids.length === 1
                ? `"${deleteConfirm.names[0]}" será removido permanentemente.`
                : `${deleteConfirm?.ids.length} prospectos serão removidos permanentemente. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkActing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isBulkActing} className="bg-destructive hover:bg-destructive/90">
              {isBulkActing ? 'Excluindo...' : 'Excluir Permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
