import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Cadence } from "@/hooks/useCadences";
import { useLeads } from "@/hooks/useLeads";
import { useLeadOptions } from "@/hooks/useLeadOptions";
import { Loader2, Zap, Users, Tag as TagIcon } from "lucide-react";
import { differenceInDays, isWithinInterval, parseISO } from "date-fns";
import { useTags, getTagColorStyles } from "@/hooks/useTags";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BulkCadenceDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cadence: Cadence | null;
  onConfirm: (leadIds: string[], minDelay: number, maxDelay: number) => Promise<void>;
}

export function BulkCadenceDispatchModal({ open, onOpenChange, cadence, onConfirm }: BulkCadenceDispatchModalProps) {
  const { leads } = useLeads();
  const { stages, sources } = useLeadOptions();
  const { availableTags } = useTags();
  const [minDelay, setMinDelay] = useState(60);
  const [maxDelay, setMaxDelay] = useState(150);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [segmentation, setSegmentation] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters state
  const [daysSinceContact, setDaysSinceContact] = useState("");
  const [pipelineStage, setPipelineStage] = useState("all");
  const [source, setSource] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedTag, setSelectedTag] = useState("all");

  // Leads que já têm esta cadência registrada
  const { data: alreadySentIds = [] } = useQuery({
    queryKey: ['lead_cadencias_sent', cadence?.id],
    queryFn: async () => {
      if (!cadence?.id) return [];
      const { data } = await supabase
        .from('lead_cadencias')
        .select('lead_id')
        .eq('cadencia_id', cadence.id)
        .neq('status', 'cancelado');
      return (data ?? []).map(r => r.lead_id as string);
    },
    enabled: !!cadence?.id && open,
  });

  const alreadySentSet = useMemo(() => new Set(alreadySentIds), [alreadySentIds]);
  const [hideAlreadySent, setHideAlreadySent] = useState(false);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
        const matchesSearch = (l.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || l.telefone?.includes(searchTerm));
        if (!matchesSearch) return false;

        if (segmentation === 'filters') {
            if (pipelineStage !== "all" && l.posicao_pipeline.toString() !== pipelineStage) return false;
            if (source !== "all" && l.fonte !== source) return false;

            if (daysSinceContact) {
              const days = differenceInDays(new Date(), parseISO(l.ultimo_contato || l.criado_em));
              if (days < parseInt(daysSinceContact)) return false;
            }

            if (dateRange?.from && dateRange?.to) {
              const leadDate = parseISO(l.criado_em);
              if (!isWithinInterval(leadDate, { start: dateRange.from, end: dateRange.to })) return false;
            }

            if (selectedTag !== "all") {
              const leadTagIds = l.leads_tags?.map(lt => lt.tags?.id).filter(Boolean) || [];
              if (!leadTagIds.includes(selectedTag)) return false;
            }
        }
        if (hideAlreadySent && alreadySentSet.has(l.id)) return false;
        return true;
    });
  }, [leads, searchTerm, segmentation, pipelineStage, source, dateRange, selectedTag, hideAlreadySent, alreadySentSet]);


  const toggleLead = (id: string) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const toggleAll = () => {
    if (selectedLeads.size === filteredLeads.length) setSelectedLeads(new Set());
    else setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
  };

  const handleSubmit = async () => {
    if (selectedLeads.size === 0) return toast.error("Selecione pelo menos um lead.");
    setIsSubmitting(true);
    try {
      await onConfirm(Array.from(selectedLeads), minDelay, maxDelay);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Disparo em Massa: {cadence?.nome}</DialogTitle>
          <DialogDescription>Selecione o público alvo. O sistema agendará os envios com intervalos aleatórios para máxima segurança.</DialogDescription>
        </DialogHeader>
        
        {/* Intervalo Randômico */}
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <Zap className="h-4 w-4" /> Intervalo de Segurança Randômico (Segundos)
          </div>
          <div className="flex items-center gap-4">
            <div className="w-1/3">
                <Label className="text-amber-800 text-xs">MÍNIMO</Label>
                <Input className="border-amber-200" type="number" value={minDelay} onChange={e => setMinDelay(Number(e.target.value))} />
            </div>
            <span className="text-amber-500 pt-5">~</span>
            <div className="w-1/3">
                <Label className="text-amber-800 text-xs">MÁXIMO</Label>
                <Input className="border-amber-200" type="number" value={maxDelay} onChange={e => setMaxDelay(Number(e.target.value))} />
            </div>
            <p className="text-xs text-amber-700/80 mt-4 italic">O sistema irá esperar um tempo **diferente e aleatório** entre {minDelay} e {maxDelay} segundos antes de enviar para cada novo lead da lista.</p>
          </div>
        </div>

        {/* Segmentação */}
        <div className="space-y-4">
            <Label className="font-semibold text-sm">Segmentação de Público</Label>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-6">
                <RadioGroup value={segmentation} onValueChange={setSegmentation} className="flex gap-6">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="all" />
                        <Label htmlFor="all" className="cursor-pointer">Todos os Leads</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="filters" id="filters" />
                        <Label htmlFor="filters" className="cursor-pointer">Filtros Avançados</Label>
                    </div>
                </RadioGroup>
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground border p-2 rounded bg-muted/30">
                    <Users className="h-3 w-3" /> {filteredLeads.length} leads encontrados
                </div>
              </div>

              {segmentation === 'filters' && (
                <div className="grid grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">ÚLTIMO CONTATO HÁ + DE (DIAS)</Label>
                        <Input placeholder="Ex: 7" value={daysSinceContact} onChange={e => setDaysSinceContact(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">ETAPA DO PIPELINE</Label>
                        <Select value={pipelineStage} onValueChange={setPipelineStage}>
                            <SelectTrigger><SelectValue placeholder="Todas as Etapas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Etapas</SelectItem>
                                {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">ORIGEM DO LEAD</Label>
                        <Select value={source} onValueChange={setSource}>
                            <SelectTrigger><SelectValue placeholder="Todas as Origens" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Origens</SelectItem>
                                {sources.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">DATA DE CADASTRO</Label>
                        <DateRangePicker date={dateRange} setDate={setDateRange} hideQuickSelect={true} />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <TagIcon className="h-3 w-3" /> ETIQUETA
                        </Label>
                        <Select value={selectedTag} onValueChange={setSelectedTag}>
                            <SelectTrigger><SelectValue placeholder="Todas as Etiquetas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Etiquetas</SelectItem>
                                {availableTags.map(tag => {
                                    const styles = getTagColorStyles(tag.color);
                                    return (
                                        <SelectItem key={tag.id} value={tag.id}>
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${styles.className}`} style={styles.style} />
                                                {tag.name}
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              )}
            </div>
        </div>

        <Input 
            placeholder="Buscar por nome ou telefone..." 
            className="h-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />

        <div className="flex justify-between items-center text-sm font-medium">
            <div className="flex items-center gap-3">
              <span>Leads Selecionados {selectedLeads.size}</span>
              {alreadySentSet.size > 0 && (
                <button
                  onClick={() => setHideAlreadySent(h => !h)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${hideAlreadySent ? 'bg-amber-100 text-amber-800 border-amber-300' : 'text-muted-foreground border-border hover:border-amber-300 hover:text-amber-700'}`}
                >
                  {hideAlreadySent ? `Mostrando sem os ${alreadySentSet.size} já enviados` : `${alreadySentSet.size} já receberam esta cadência — ocultar`}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
                <Checkbox checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0} onCheckedChange={toggleAll} />
                <span>Selecionar todos os {filteredLeads.length} encontrados</span>
            </div>
        </div>

        <ScrollArea className="flex-1 border rounded-lg p-2 h-[300px] w-full bg-background overflow-y-auto">
          <div className="h-full">
            {filteredLeads.map(lead => {
              const alreadySent = alreadySentSet.has(lead.id);
              return (
                <div key={lead.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleLead(lead.id)}>
                  <Checkbox checked={selectedLeads.has(lead.id)} />
                  <div className="flex-1 flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className={alreadySent ? 'text-muted-foreground' : ''}>{lead.nome || "Lead sem nome"}</span>
                      {alreadySent && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-px leading-none">
                          já enviado
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">{lead.telefone}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedLeads.size === 0}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Iniciar Disparo ({selectedLeads.size} leads)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


