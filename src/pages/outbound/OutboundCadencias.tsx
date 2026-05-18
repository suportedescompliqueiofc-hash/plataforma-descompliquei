import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GitMerge, MoreVertical, Trash2, Calendar as CalendarIcon, Layout, ArrowRight, Activity, Zap, BarChart2, BarChart3 } from "lucide-react";
import { CadenceModal } from "@/components/cadences/CadenceModal";
import { BulkCadenceDispatchModal } from "@/components/cadences/BulkCadenceDispatchModal";
import { CadenceDispatchMonitorModal } from "@/components/cadences/CadenceDispatchMonitorModal";
import { useCadences, Cadence } from "@/hooks/useCadences";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { CadenceMonitoringTab } from "@/components/cadences/CadenceMonitoringTab";
import { CadenceDispatchReportTab } from "@/components/cadences/CadenceDispatchReportTab";
import { toast } from "sonner";

export default function OutboundCadencias() {
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

  const handleOpenCreate = () => {
    setSelectedCadence(null);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (cadence: Cadence) => {
    setSelectedCadence(cadence);
    setIsModalOpen(true);
  };

  const confirmDelete = () => {
    if (cadenceToDelete) {
      deleteCadence(cadenceToDelete.id);
      setCadenceToDelete(null);
    }
  };

  return (
    <div className="space-y-6 pb-20 p-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center">
            <GitMerge className="h-5 w-5 text-[#E85D24]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Cadências Outbound</h1>
            <p className="text-sm text-muted-foreground">Fluxos automáticos de mensagens para prospecção ativa</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "monitoramento" && (
            <DateRangePicker date={dateRange} setDate={setDateRange} />
          )}
          <Button onClick={handleOpenCreate} className="gap-2 bg-[#E85D24] hover:bg-[#E85D24]/90 shadow-md h-10">
            <Plus className="h-4 w-4" /> Nova Cadência
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="fluxos" className="gap-2">
            <Layout className="h-4 w-4" /> Biblioteca de Fluxos
          </TabsTrigger>
          <TabsTrigger value="monitoramento" className="gap-2">
            <Activity className="h-4 w-4" /> Monitoramento de Envios
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Relatório de Disparos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fluxos">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
            </div>
          ) : cadences.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/5 flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <GitMerge className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <CardTitle className="text-muted-foreground mb-2">Nenhuma cadência criada ainda.</CardTitle>
              <Button variant="link" onClick={handleOpenCreate} className="text-[#E85D24] font-bold underline-offset-4">Criar a primeira</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {cadences.map(cadence => (
                <Card key={cadence.id} className="group hover:border-[#E85D24]/50 transition-all duration-300 shadow-sm relative h-full flex flex-col">
                  <div className="absolute top-0 right-0 p-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => setCadenceToDelete(cadence)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CardHeader className="pb-4">
                    <Badge variant="outline" className="w-fit mb-2 text-[10px] uppercase font-bold tracking-widest bg-[#E85D24]/5 text-[#E85D24] border-[#E85D24]/20">
                      Fluxo de Mensagens
                    </Badge>
                    <CardTitle className="text-lg line-clamp-1">{cadence.nome}</CardTitle>
                    <CardDescription className="line-clamp-2 h-10">{cadence.descricao || "Sem descrição."}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0 flex-1 flex flex-col">
                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground border-t border-dashed pt-4 mt-auto">
                      <div className="flex items-center gap-1.5">
                        <Layout className="h-3.5 w-3.5" /> {cadence.passos?.length || 0} Passos
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" /> {format(new Date(cadence.criado_em), "dd/MM/yy", { locale: ptBR })}
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-3 flex flex-col gap-2 group/path cursor-default">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center text-[10px] font-bold shadow-sm">1</div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                        <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center text-[10px] font-bold shadow-sm opacity-60">2</div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                        <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center text-[10px] font-bold shadow-sm opacity-30">...</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-[#E85D24] hover:bg-[#E85D24]/10"
                          onClick={() => { setCadenceToMonitor(cadence); setIsMonitorOpen(true); }}
                          title="Monitorar envios"
                        >
                          <BarChart2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold text-[#E85D24] hover:bg-[#E85D24]/10"
                          onClick={() => { setCadenceToDispatch(cadence); setIsBulkDispatchOpen(true); }}
                        >
                          <Zap className="h-3 w-3 mr-1" /> Disparar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-[#E85D24] hover:bg-[#E85D24]/10"
                          onClick={() => handleOpenDetails(cadence)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="monitoramento">
          <CadenceMonitoringTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="relatorio">
          <CadenceDispatchReportTab />
        </TabsContent>
      </Tabs>

      <CadenceModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        cadence={selectedCadence}
      />

      <BulkCadenceDispatchModal
        open={isBulkDispatchOpen}
        onOpenChange={setIsBulkDispatchOpen}
        cadence={cadenceToDispatch}
        onConfirm={startBulkDispatch}
        origemFilter="outbound"
      />

      <CadenceDispatchMonitorModal
        open={isMonitorOpen}
        onOpenChange={setIsMonitorOpen}
        cadenceId={cadenceToMonitor?.id}
        cadenceName={cadenceToMonitor?.nome}
      />

      <AlertDialog open={!!cadenceToDelete} onOpenChange={() => setCadenceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cadência?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá permanentemente o fluxo "{cadenceToDelete?.nome}". Leads que estão atualmente neste fluxo deixarão de receber as mensagens agendadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Excluir Permanentemente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
