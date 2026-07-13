import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus, GitMerge, MoreVertical, Trash2, Calendar as CalendarIcon, Layout, ArrowRight,
  Activity, Zap, BarChart3, BarChart2, Clock, ChevronRight,
} from "lucide-react";
import { CadenceModal } from "@/components/cadences/CadenceModal";
import { BulkCadenceDispatchModal } from "@/components/cadences/BulkCadenceDispatchModal";
import { CadenceDispatchMonitorModal } from "@/components/cadences/CadenceDispatchMonitorModal";
import { useCadences, Cadence } from "@/hooks/useCadences";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { CadenceMonitoringTab } from "@/components/cadences/CadenceMonitoringTab";
import { CadenceDispatchReportTab } from "@/components/cadences/CadenceDispatchReportTab";
import { PageHero } from "@/components/PageHero";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Cadences() {
  const today = new Date();
  const initialDateRange: DateRange = { from: startOfMonth(today), to: endOfMonth(today) };

  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const { cadences, isLoading, deleteCadence, bulkStartCadence } = useCadences();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkDispatchOpen, setIsBulkDispatchOpen] = useState(false);
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [selectedCadence, setSelectedCadence] = useState<Cadence | null>(null);
  const [cadenceToDispatch, setCadenceToDispatch] = useState<Cadence | null>(null);
  const [cadenceToMonitor, setCadenceToMonitor] = useState<Cadence | null>(null);
  const [cadenceToDelete, setCadenceToDelete] = useState<Cadence | null>(null);
  const [activeTab, setActiveTab] = useState("fluxos");

  const startBulkDispatch = async (leadIds: string[], minDelay: number, maxDelay: number) => {
    if (!cadenceToDispatch) return;
    try {
        await bulkStartCadence({ cadenceId: cadenceToDispatch.id, leadIds, minDelay, maxDelay });
        setIsBulkDispatchOpen(false);
    } catch (e) {
        toast.error("Erro ao disparar");
    }
  };

  const handleOpenCreate = () => { setSelectedCadence(null); setIsModalOpen(true); };
  const handleOpenDetails = (cadence: Cadence) => { setSelectedCadence(cadence); setIsModalOpen(true); };
  const confirmDelete = () => { if (cadenceToDelete) { deleteCadence(cadenceToDelete.id); setCadenceToDelete(null); } };

  const TAB_ITEMS = [
    { id: "fluxos", label: "Fluxos", icon: Layout },
    { id: "monitoramento", label: "Monitoramento", icon: Activity },
    { id: "relatorio", label: "Relatório", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* ═══ PAGE HEADER ═══ */}
      <PageHero
        icon={GitMerge}
        title="Cadências"
        subtitle="Crie fluxos automáticos de follow-up para nutrir seus leads"
        right={
          <Button
            onClick={handleOpenCreate}
            className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-white text-[#1a0e06] hover:bg-white/90 px-4"
            data-tutorial="cadences-create"
          >
            <Plus className="h-3.5 w-3.5" /> Nova Cadência
          </Button>
        }
      />

      {/* ═══ TOOLBAR (stats + filtros) ═══ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <GitMerge className="h-3 w-3" />
            <span className="tabular-nums font-medium">{cadences.length} fluxos</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span className="tabular-nums font-medium">
              {cadences.reduce((sum, c) => sum + (c.passos?.length || 0), 0)} passos totais
            </span>
          </div>
        </div>
        {activeTab === "monitoramento" && (
          <DateRangePicker date={dateRange} setDate={setDateRange} />
        )}
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div data-tutorial="cadences-tabs" className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-fit">
          {TAB_ITEMS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── FLUXOS TAB ── */}
        <TabsContent value="fluxos" className="mt-6" data-tutorial="cadences-list">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
            </div>
          ) : cadences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="bg-muted/30 p-5 rounded-2xl mb-4">
                <GitMerge className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma cadência criada</h3>
              <p className="text-sm text-muted-foreground/60 mb-5 text-center max-w-sm">
                Crie fluxos automáticos de mensagens para nutrir seus leads
              </p>
              <Button
                onClick={handleOpenCreate}
                className="gap-1.5 h-9 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90"
              >
                <Plus className="h-3.5 w-3.5" /> Criar Cadência
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cadences.map((cadence, cadenceIdx) => {
                const stepsCount = cadence.passos?.length || 0;
                return (
                  <div
                    key={cadence.id}
                    {...(cadenceIdx === 0 ? { 'data-tutorial': 'cadences-card' } : {})}
                    className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative group transition-all duration-200 hover:border-border hover:shadow-md overflow-hidden flex flex-col"
                  >
                    {/* Menu */}
                    <div className="absolute top-3 right-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-border/60 min-w-[140px]">
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive text-xs gap-2 rounded-lg"
                            onSelect={() => setCadenceToDelete(cadence)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Body */}
                    <div className="p-5 flex-1 flex flex-col">
                      {/* Overline */}
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
                        Fluxo de Mensagens
                      </span>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-foreground line-clamp-1 mb-1 pr-8">
                        {cadence.nome}
                      </h3>
                      <p className="text-[11px] text-muted-foreground/60 line-clamp-2 leading-relaxed mb-4">
                        {cadence.descricao || "Sem descrição"}
                      </p>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-4">
                        <div className="flex items-center gap-1.5">
                          <Layout className="h-3 w-3" />
                          <span className="tabular-nums font-medium">{stepsCount} passos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span className="tabular-nums font-medium">
                            {format(new Date(cadence.criado_em), "dd MMM yy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      {/* Step flow preview */}
                      <div className="flex items-center gap-1.5 mb-4">
                        {Array.from({ length: Math.min(stepsCount, 5) }).map((_, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className={cn(
                              "h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold tabular-nums border",
                              i === 0
                                ? "bg-foreground text-background border-foreground"
                                : "bg-muted/50 text-muted-foreground border-border/60"
                            )}>
                              {i + 1}
                            </div>
                            {i < Math.min(stepsCount, 5) - 1 && (
                              <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                            )}
                          </div>
                        ))}
                        {stepsCount > 5 && (
                          <>
                            <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                            <span className="text-[10px] text-muted-foreground/40 font-medium">+{stepsCount - 5}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="flex items-center gap-2 px-5 py-3.5 border-t border-border/40 bg-muted/[0.03]">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                        onClick={() => { setCadenceToMonitor(cadence); setIsMonitorOpen(true); }}
                        title="Monitorar envios"
                      >
                        <BarChart2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-semibold rounded-lg gap-1.5 border-border/60"
                        onClick={() => { setCadenceToDispatch(cadence); setIsBulkDispatchOpen(true); }}
                        data-tutorial={cadenceIdx === 0 ? 'cadences-dispatch' : undefined}
                      >
                        <Zap className="h-3 w-3" /> Disparar
                      </Button>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[11px] font-medium rounded-lg text-muted-foreground hover:text-foreground gap-1"
                        onClick={() => handleOpenDetails(cadence)}
                      >
                        Detalhes <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── MONITORAMENTO TAB ── */}
        <TabsContent value="monitoramento" className="mt-6" data-tutorial="cadences-monitoring">
          <CadenceMonitoringTab dateRange={dateRange} />
        </TabsContent>

        {/* ── RELATORIO TAB ── */}
        <TabsContent value="relatorio" className="mt-6" data-tutorial="cadences-report">
          <CadenceDispatchReportTab />
        </TabsContent>
      </Tabs>

      {/* ═══ MODALS ═══ */}
      <CadenceModal open={isModalOpen} onOpenChange={setIsModalOpen} cadence={selectedCadence} />
      <BulkCadenceDispatchModal open={isBulkDispatchOpen} onOpenChange={setIsBulkDispatchOpen} cadence={cadenceToDispatch} onConfirm={startBulkDispatch} />
      <CadenceDispatchMonitorModal open={isMonitorOpen} onOpenChange={setIsMonitorOpen} cadenceId={cadenceToMonitor?.id} cadenceName={cadenceToMonitor?.nome} />

      {/* ═══ DELETE DIALOG ═══ */}
      <AlertDialog open={!!cadenceToDelete} onOpenChange={() => setCadenceToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir Cadência?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              O fluxo "{cadenceToDelete?.nome}" será removido permanentemente. Leads neste fluxo deixarão de receber mensagens agendadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 rounded-lg text-xs font-medium">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="h-9 rounded-lg text-xs font-semibold bg-destructive hover:bg-destructive/90"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
