import { useState, useMemo, useEffect } from "react";
import { Phone, PhoneCall, Calendar, TrendingUp, AlertTriangle, Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, Eye, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDistanceToNow, format, isToday, isBefore, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { useAllOutboundLigacoes, useDeleteLigacao, OutboundLigacao } from "@/hooks/useOutboundLigacoes";
import { EditLigacaoModal } from "@/components/outbound/EditLigacaoModal";
import { useOutboundProspectos, OutboundProspecto } from "@/hooks/useOutboundProspectos";
import { useOutboundScripts } from "@/hooks/useOutboundScripts";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { useLigacaoModal } from "@/contexts/LigacaoContext";
import { ProspectoDetalheModal } from "@/components/outbound/ProspectoDetalheModal";

const ITEMS_PER_PAGE = 25;

const STATUS_COLORS: Record<string, string> = {
  atendeu: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  nao_atendeu: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  ocupado: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  caixa_postal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  numero_errado: "bg-red-500/20 text-red-400 border-red-500/30",
  recusou: "bg-red-500/20 text-red-500 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  atendeu: "Atendeu",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  caixa_postal: "Caixa postal",
  numero_errado: "Nº errado",
  recusou: "Recusou",
};

const RESULTADO_LABELS: Record<string, string> = {
  sem_interesse: "Sem interesse",
  qualificado: "Qualificado",
  agendou_call: "Agendou call",
  quer_mais_info: "Quer mais info",
  ligar_depois: "Ligar depois",
  nao_e_icp: "Não é ICP",
  ja_tem_solucao: "Já tem solução",
};

function formatDuracao(s: number | null): string {
  if (!s) return "—";
  const min = Math.floor(s / 60);
  const seg = s % 60;
  return `${min}:${seg.toString().padStart(2, "0")}`;
}

export default function OutboundLigacoes() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  });

  const { ligacoes, isLoading: ligacoesLoading, metricasDoDia } = useAllOutboundLigacoes();
  const { prospectos, isLoading: prospectosLoading } = useOutboundProspectos();
  const { activeScripts } = useOutboundScripts();
  const { users } = useOrgUsers();
  const { openRegistrarLigacao } = useLigacaoModal();

  const deleteLigacao = useDeleteLigacao();

  // Estado para modal de detalhe do prospecto (Fila do Dia clicável)
  const [selectedProspecto, setSelectedProspecto] = useState<OutboundProspecto | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);

  // Estado para editar/excluir ligação
  const [editLigacao, setEditLigacao] = useState<OutboundLigacao | null>(null);
  const [editLigacaoOpen, setEditLigacaoOpen] = useState(false);
  const [deleteLigacaoTarget, setDeleteLigacaoTarget] = useState<OutboundLigacao | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    status: "todos",
    resultado: "todos",
    usuario_id: "todos",
    script_id: "todos",
  });

  useEffect(() => { setCurrentPage(1); }, [filters]);

  // FILA DO DIA — prospectos com próxima ação hoje ou atrasada
  const filaDoDia = useMemo(() => {
    const hoje = startOfDay(new Date());
    return prospectos
      .filter(p => {
        if (!p.proxima_acao_data) return false;
        const d = new Date(p.proxima_acao_data);
        return isToday(d) || isBefore(d, hoje);
      })
      .sort((a, b) => new Date(a.proxima_acao_data!).getTime() - new Date(b.proxima_acao_data!).getTime());
  }, [prospectos]);

  // FILTROS DO HISTÓRICO
  const filteredLigacoes = useMemo(() => {
    return ligacoes.filter(l => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!(l.prospecto_nome || "").toLowerCase().includes(s) && !(l.prospecto_clinica || "").toLowerCase().includes(s)) return false;
      }
      if (filters.status !== "todos" && l.status !== filters.status) return false;
      if (filters.resultado !== "todos" && !(l.resultado || '').includes(filters.resultado)) return false;
      if (filters.usuario_id !== "todos" && l.usuario_id !== filters.usuario_id) return false;
      if (filters.script_id !== "todos" && l.script_id !== filters.script_id) return false;
      if (dateRange?.from) {
        const d = new Date(l.data_hora);
        if (d < startOfDay(dateRange.from)) return false;
        if (dateRange.to) {
          const endOfTo = new Date(dateRange.to);
          endOfTo.setHours(23, 59, 59, 999);
          if (d > endOfTo) return false;
        }
      }
      return true;
    });
  }, [ligacoes, filters, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filteredLigacoes.length / ITEMS_PER_PAGE));
  const paginatedLigacoes = filteredLigacoes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const hasActiveFilters = filters.search || filters.status !== "todos" || filters.resultado !== "todos" || filters.usuario_id !== "todos" || filters.script_id !== "todos";
  const clearFilters = () => setFilters({ search: "", status: "todos", resultado: "todos", usuario_id: "todos", script_id: "todos" });

  const isLoading = ligacoesLoading || prospectosLoading;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ligações</h1>
          <p className="text-sm text-muted-foreground">Central de controle de prospecção ativa</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker date={dateRange} setDate={setDateRange} />
          <Button onClick={() => openRegistrarLigacao()} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            <Phone className="h-4 w-4 mr-2" /> Registrar Ligação
          </Button>
        </div>
      </div>

      {/* MÉTRICAS DO PERÍODO */}
      {(() => {
        const totalLig = filteredLigacoes.length;
        const conexoes = filteredLigacoes.filter(l => l.status === 'atendeu').length;
        const callsAgendadas = filteredLigacoes.filter(l => (l.resultado || '').includes('agendou_call')).length;
        const taxaAtend = totalLig > 0 ? Math.round((conexoes / totalLig) * 100) : 0;
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-[#E85D24]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalLig}</p>
                  <p className="text-xs text-muted-foreground">Ligações no período</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <PhoneCall className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conexoes}</p>
                  <p className="text-xs text-muted-foreground">Conexões no período</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{callsAgendadas}</p>
                  <p className="text-xs text-muted-foreground">Calls agendadas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taxaAtend}%</p>
                  <p className="text-xs text-muted-foreground">Taxa atendimento</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* SEÇÃO 1 — FILA DO DIA */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#E85D24]" />
          <h2 className="text-lg font-semibold">Fila do Dia</h2>
          <Badge variant="outline" className="text-xs">{filaDoDia.length}</Badge>
        </div>

        {prospectosLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : filaDoDia.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum prospecto na fila para hoje
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filaDoDia.map(p => {
              const isOverdue = isBefore(new Date(p.proxima_acao_data!), startOfDay(new Date()));
              return (
                <Card
                  key={p.id}
                  className={`transition-all hover:shadow-md cursor-pointer ${isOverdue ? 'border-red-500/50' : ''}`}
                  onClick={() => { setSelectedProspecto(p); setDetalheOpen(true); }}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.clinica} • {p.telefone}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isOverdue && <Badge className="bg-red-500 text-white text-[10px]">ATRASADO</Badge>}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); setSelectedProspecto(p); setDetalheOpen(true); }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver detalhes</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.total_tentativas} tent.</span>
                        {p.stage_nome && (
                          <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: `${p.stage_cor}20`, color: p.stage_cor, borderColor: `${p.stage_cor}40` }}>{p.stage_nome}</Badge>
                        )}
                      </div>
                      <Button size="sm" className="h-7 text-xs bg-[#E85D24] hover:bg-[#E85D24]/90" onClick={(e) => { e.stopPropagation(); openRegistrarLigacao(p); }}>
                        <Phone className="h-3 w-3 mr-1" /> Ligar
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {p.proxima_acao && <span className="font-medium">{p.proxima_acao} — </span>}
                      {format(new Date(p.proxima_acao_data!), "dd/MM HH:mm")}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO 3 — HISTÓRICO DE LIGAÇÕES */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico de Ligações</h2>

        {/* FILTROS */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar prospecto..." className="pl-9 h-9" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.resultado} onValueChange={v => setFilters(f => ({ ...f, resultado: v }))}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos resultados</SelectItem>
              {Object.entries(RESULTADO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.usuario_id} onValueChange={v => setFilters(f => ({ ...f, usuario_id: v }))}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos SDRs</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome_completo || "Sem nome"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.script_id} onValueChange={v => setFilters(f => ({ ...f, script_id: v }))}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos scripts</SelectItem>
              {activeScripts.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9"><X className="h-4 w-4 mr-1" /> Limpar</Button>
          )}
        </div>

        {/* TABELA */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Prospecto</TableHead>
                <TableHead>Tentativa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Script</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Anotação</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 10 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                ))
              ) : paginatedLigacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    {hasActiveFilters ? "Nenhuma ligação encontrada com esses filtros" : "Nenhuma ligação registrada"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLigacoes.map(l => (
                  <TableRow key={l.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.data_hora), "dd/MM/yy HH:mm")}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{l.prospecto_nome || "—"}</p>
                        {l.prospecto_clinica && <p className="text-xs text-muted-foreground">{l.prospecto_clinica}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{l.numero_tentativa}ª</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[l.status] || ""}`}>{STATUS_LABELS[l.status] || l.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.resultado ? (
                        <div className="flex flex-wrap gap-1">
                          {l.resultado.split(',').map((r: string) => (
                            <span key={r} className="inline-block">{RESULTADO_LABELS[r.trim()] || r.trim()}</span>
                          ))}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{l.script_nome || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{formatDuracao(l.duracao_segundos)}</TableCell>
                    <TableCell className="text-xs">{l.perfil_nome || "—"}</TableCell>
                    <TableCell>
                      {l.anotacao ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-xs max-w-[150px] truncate block">{l.anotacao}</span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm"><p className="text-xs whitespace-pre-wrap">{l.anotacao}</p></TooltipContent>
                        </Tooltip>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditLigacao(l); setEditLigacaoOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => setDeleteLigacaoTarget(l)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINAÇÃO */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredLigacoes.length)} de {filteredLigacoes.length}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}><ChevronsLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="flex items-center px-3 text-sm">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}><ChevronsRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalhe do prospecto */}
      <ProspectoDetalheModal
        prospecto={selectedProspecto}
        open={detalheOpen}
        onOpenChange={(open) => { setDetalheOpen(open); if (!open) setSelectedProspecto(null); }}
        onEdit={() => {}}
      />

      {/* Edit Ligação Modal */}
      <EditLigacaoModal
        open={editLigacaoOpen}
        onOpenChange={(v) => { setEditLigacaoOpen(v); if (!v) setEditLigacao(null); }}
        ligacao={editLigacao}
      />

      {/* Delete Ligação Confirmation */}
      <AlertDialog open={!!deleteLigacaoTarget} onOpenChange={(v) => { if (!v) setDeleteLigacaoTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ligação?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O registro da ligação será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={async () => {
                if (deleteLigacaoTarget) {
                  await deleteLigacao.mutateAsync({ id: deleteLigacaoTarget.id, prospecto_id: deleteLigacaoTarget.prospecto_id });
                  setDeleteLigacaoTarget(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
