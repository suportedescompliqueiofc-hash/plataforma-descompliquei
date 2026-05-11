import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, Filter, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, UserCheck, Ban, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useStages } from "@/hooks/useStages";
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
import { format, parseISO } from "date-fns";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useTags } from "@/hooks/useTags";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Ativo":
      return "bg-success text-success-foreground";
    case "Inativo":
      return "bg-muted text-muted-foreground";
    case "Convertido":
      return "bg-info text-info-foreground";
    case "Perdido":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const ITEMS_PER_PAGE = 50;

export default function Leads() {
  const [showFilters, setShowFilters] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBlacklisting, setIsBlacklisting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { leads, isLoading: leadsLoading, deleteLead, blacklistLead } = useLeads();
  const { stages, isLoading: stagesLoading } = useStages();
  const { allSources } = useLeadSources();
  const { availableTags } = useTags();

  const isLoading = leadsLoading || stagesLoading;

  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "Todos",
    posicao_pipeline: "Todos",
    origem: "Todos",
    fonte: "",
    genero: "Todos",
    criativo: "",
    idade: "",
    cadastroMes: "",
    tagId: "Todos",
    procedimento: "",
  });

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const getStageByPosition = (position: number) => {
    return stages.find((stage) => stage.posicao_ordem === position);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const searchTermMatch =
        (lead.nome && lead.nome.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        lead.telefone.includes(filters.searchTerm);

      const statusMatch = filters.status === "Todos" || lead.status === filters.status;
      const etapaMatch = filters.posicao_pipeline === "Todos" || lead.posicao_pipeline.toString() === filters.posicao_pipeline;
      const origemMatch = filters.origem === "Todos" || lead.origem === filters.origem;
      const fonteMatch = !filters.fonte || (lead.fonte && lead.fonte.toLowerCase().includes(filters.fonte.toLowerCase()));
      const generoMatch = filters.genero === "Todos" || lead.genero === filters.genero;
      const criativoMatch = !filters.criativo || (lead.criativo_id && lead.criativo_id.toLowerCase().includes(filters.criativo.toLowerCase()));
      const idadeMatch = !filters.idade || lead.idade?.toString() === filters.idade;
      const cadastroMesMatch = !filters.cadastroMes || (lead.criado_em && lead.criado_em.startsWith(filters.cadastroMes));
      const procedimentoMatch = !filters.procedimento ||
        (lead.procedimento_interesse && lead.procedimento_interesse.toLowerCase().includes(filters.procedimento.toLowerCase()));
      const tagMatch = filters.tagId === "Todos" ||
        (lead.leads_tags && lead.leads_tags.some((leadTag) => leadTag.tags && leadTag.tags.id === filters.tagId));

      return searchTermMatch && statusMatch && etapaMatch && origemMatch && fonteMatch && generoMatch && criativoMatch && idadeMatch && cadastroMesMatch && tagMatch && procedimentoMatch;
    });
  }, [leads, filters]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentLeads = filteredLeads.slice(startIndex, endIndex);

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

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diff < 1) return 'agora';
    if (diff < 60) return `há ${diff} min`;
    if (diff < 1440) return `há ${Math.floor(diff / 60)}h`;
    return `há ${Math.floor(diff / 1440)} dias`;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestão de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Total: {leads.length} leads</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button className="gap-2 flex-1 sm:flex-none" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                className="pl-10 w-full"
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Convertido">Convertido</SelectItem>
                    <SelectItem value="Perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa do Funil</Label>
                <Select value={filters.posicao_pipeline} onValueChange={(value) => handleFilterChange('posicao_pipeline', value)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todas</SelectItem>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.posicao_ordem.toString()}>{stage.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Origem (Tipo)</Label>
                <Select value={filters.origem} onValueChange={(value) => handleFilterChange('origem', value)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todas</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="organico">Orgânico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fonte (Detalhe)</Label>
                <Input value={filters.fonte} className="h-9" onChange={(e) => handleFilterChange('fonte', e.target.value)} placeholder="Ex: Facebook" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Área/Serviço</Label>
                <Input
                  placeholder="Ex: Divórcio"
                  className="h-9"
                  value={filters.procedimento}
                  onChange={(e) => handleFilterChange('procedimento', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gênero</Label>
                <Select value={filters.genero} onValueChange={(value) => handleFilterChange('genero', value)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mês de Cadastro</Label>
                <Input
                  type="month"
                  className="h-9"
                  value={filters.cadastroMes}
                  onChange={(e) => handleFilterChange('cadastroMes', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etiqueta</Label>
                <Select value={filters.tagId} onValueChange={(value) => handleFilterChange('tagId', value)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todas as Etiquetas</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setIsBulkDeleting(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      <Card className="shadow-sm overflow-hidden border-none sm:border">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/10">
            <div className="min-w-[1000px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allCurrentSelected}
                        data-state={someCurrentSelected && !allCurrentSelected ? 'indeterminate' : undefined}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Etiquetas</TableHead>
                    <TableHead>Área/Serviço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Data de Cadastro</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12">
                        <p className="text-muted-foreground">Nenhum lead encontrado com os filtros aplicados</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentLeads.map((lead) => {
                      const stage = getStageByPosition(lead.posicao_pipeline);

                      return (
                        <TableRow key={lead.id} className="hover:bg-muted/50">
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(lead.id)}
                              onCheckedChange={() => toggleSelectOne(lead.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{lead.nome}</p>
                              {lead.is_qualified && (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] h-4 px-1.5 gap-1 border-none shadow-[0_2px_4px_rgba(16,185,129,0.2)] font-bold">
                                  <UserCheck className="h-2.5 w-2.5 fill-current" />
                                  MQL
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell><p className="text-sm text-muted-foreground">{lead.telefone}</p></TableCell>
                          <TableCell>
                            {lead.origem === 'marketing' ? (
                              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-0 text-[11px] font-medium">
                                Marketing
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[11px] font-medium">
                                🌿 Orgânico
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{lead.fonte || '-'}</span></TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {lead.leads_tags && lead.leads_tags.length > 0 ? (
                                lead.leads_tags.map((leadTag) => leadTag.tags && (
                                  <Badge
                                    key={leadTag.tags.id}
                                    variant="secondary"
                                    className="text-[10px] px-1 whitespace-nowrap"
                                    style={{
                                      backgroundColor: `${leadTag.tags.color}20`,
                                      color: leadTag.tags.color,
                                      borderColor: leadTag.tags.color,
                                    }}
                                  >
                                    {leadTag.tags.name}
                                  </Badge>
                                ))
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell><span className="text-sm font-medium text-primary">{lead.procedimento_interesse || '-'}</span></TableCell>
                          <TableCell><Badge className={getStatusColor(lead.status)}>{lead.status}</Badge></TableCell>
                          <TableCell>{stage && <Badge style={{ backgroundColor: stage.cor, color: 'white' }}>{stage.nome}</Badge>}</TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{formatDate(lead.criado_em)}</span></TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{formatTime(lead.ultimo_contato)}</span></TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(lead)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                onClick={() => handleBlacklistRequest(lead)}
                                title="Bloquear número permanentemente"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRequest(lead)}>
                                <Trash2 className="h-4 w-4" />
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
          </div>
        </CardContent>

        {filteredLeads.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t gap-4">
            <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredLeads.length)} de {filteredLeads.length} leads
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-xs sm:text-sm font-medium px-2">
                Pág {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <LeadModal open={isModalOpen} onOpenChange={handleModalOpenChange} lead={selectedLead} mode={modalMode} />
      <ImportLeadsDialog open={isImportOpen} onOpenChange={setIsImportOpen} />

      <AlertDialog open={isBulkDeleting} onOpenChange={setIsBulkDeleting}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os {selectedIds.size} leads selecionados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="flex-1 bg-destructive hover:bg-destructive/90">
              Sim, excluir todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o lead "{selectedLead?.nome}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="flex-1 bg-destructive hover:bg-destructive/90">
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBlacklisting} onOpenChange={setIsBlacklisting}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear número permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover o lead "{selectedLead?.nome || selectedLead?.telefone}" do CRM e colocar o número na blacklist. Depois disso, ele não será criado novamente e não voltará a aparecer no CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBlacklist} className="flex-1 bg-amber-600 hover:bg-amber-700">
              Sim, bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
