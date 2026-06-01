import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Calendar as CalendarIcon, Clock, BarChart3, Kanban, UserCheck, Megaphone, Leaf, Users, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  defaultDropAnimationSideEffects,
  DropAnimation
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LeadModal } from "@/components/leads/LeadModal";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useStages } from "@/hooks/useStages";
import { formatDistanceToNow, startOfMonth, endOfMonth, format, isToday, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
// Popover/Calendar removidos — agendamento gerenciado no LeadModal
import { cn } from "@/lib/utils";
import { FunnelMetricsTab } from "@/components/pipeline/FunnelMetricsTab";
import { Skeleton } from "@/components/ui/skeleton";

// Animação de drop suave
const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.5' } },
  }),
};

// ══════════════════════════════════════════════
//  Formatação de telefone
// ══════════════════════════════════════════════
const formatPhone = (phone: string) => {
  if (!phone) return '-';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) cleaned = cleaned.slice(2);
  if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  if (cleaned.length === 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return phone;
};

// ══════════════════════════════════════════════
//  Stage Column
// ══════════════════════════════════════════════
function StageColumn({
  stage, leads, onCardClick, onUpdateLead, isFirst = false
}: {
  stage: { id: number; nome: string; cor: string; posicao_ordem: number };
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
  isFirst?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.posicao_ordem}`,
    data: { type: 'Column', stageOrder: stage.posicao_ordem }
  });

  return (
    <div className="w-[300px] flex-shrink-0 flex flex-col h-full" {...(isFirst ? { 'data-tutorial': 'pipeline-column' } : {})}>
      <div
        ref={setNodeRef}
        className={cn(
          "h-full flex flex-col rounded-xl transition-all duration-200",
          isOver
            ? "ring-2 ring-offset-2 ring-offset-background"
            : ""
        )}
        style={isOver ? { ringColor: stage.cor } : undefined}
      >
        {/* Column Header */}
        <div className="flex items-center gap-3 px-3 py-3 mb-2">
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.cor }}
          />
          <span className="text-[13px] font-semibold text-foreground truncate">{stage.nome}</span>
          <span className="ml-auto text-[11px] font-bold tabular-nums text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-md">
            {leads.length}
          </span>
        </div>

        {/* Cards Area */}
        <div className={cn(
          "flex-1 px-1 pb-2 space-y-2 overflow-y-auto min-h-[120px] rounded-lg transition-colors duration-200",
          isOver ? "bg-muted/30" : ""
        )}>
          <SortableContext
            items={leads.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="text-muted-foreground/20 mb-2">
                  <Users className="h-6 w-6" />
                </div>
                <p className="text-[11px] text-muted-foreground/40">Sem leads nesta etapa</p>
              </div>
            ) : (
              leads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  stageColor={stage.cor}
                  onClick={() => onCardClick(lead)}
                  onUpdateLead={onUpdateLead}
                />
              ))
            )}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  Lead Card
// ══════════════════════════════════════════════
function LeadCard({
  lead, onClick, onUpdateLead, stageColor, isOverlay = false
}: {
  lead: Lead;
  onClick?: () => void;
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
  stageColor?: string;
  isOverlay?: boolean;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging
  } = useSortable({
    id: lead.id,
    data: { type: 'Lead', lead }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const lastContactTime = lead.ultimo_contato
    ? formatDistanceToNow(new Date(lead.ultimo_contato), { locale: ptBR, addSuffix: true })
    : null;

  const initials = (lead.nome || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  // Schedule badge
  const scheduleBadge = useMemo(() => {
    if (!lead.agendamento) return null;
    const date = parseISO(lead.agendamento);
    const isLate = isPast(date) && !isToday(date);
    const isForToday = isToday(date);
    return { date, isLate, isForToday };
  }, [lead.agendamento]);

  const cardContent = (
    <>
      {/* Top — Avatar + Info */}
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground select-none">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-foreground truncate">{lead.nome || 'Sem nome'}</span>
            {lead.is_qualified && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60 shrink-0">
                <UserCheck className="h-2 w-2" />
                MQL
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums block mt-0.5">
            {formatPhone(lead.telefone)}
          </span>
        </div>
      </div>

      {/* Resumo */}
      {lead.resumo && (
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2 mt-2">
          {lead.resumo}
        </p>
      )}

      {/* Tags + Origem row */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
        {/* Origem */}
        <span className={cn(
          "inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border",
          lead.origem === 'marketing'
            ? "bg-amber-50 text-amber-700 border-amber-200/60"
            : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
        )}>
          {lead.origem === 'marketing' ? (
            <><Megaphone className="h-2 w-2" /> Mkt</>
          ) : (
            <><Leaf className="h-2 w-2" /> Org</>
          )}
        </span>

        {/* Fonte */}
        {lead.fonte && (
          <span className="inline-flex text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
            {lead.fonte}
          </span>
        )}

        {/* Tags */}
        {lead.leads_tags && lead.leads_tags.length > 0 && (
          <>
            {lead.leads_tags.slice(0, 2).map(lt => lt.tags && (
              <span
                key={lt.tags.id}
                className="inline-flex text-[9px] font-medium px-1.5 py-0.5 rounded-md border"
                style={{
                  backgroundColor: `${lt.tags.color}12`,
                  color: lt.tags.color,
                  borderColor: `${lt.tags.color}30`,
                }}
              >
                {lt.tags.name}
              </span>
            ))}
            {lead.leads_tags.length > 2 && (
              <span className="text-[9px] text-muted-foreground font-medium">+{lead.leads_tags.length - 2}</span>
            )}
          </>
        )}
      </div>

      {/* Footer — Schedule + Last contact */}
      {(scheduleBadge || lastContactTime) && (
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/40">
          {scheduleBadge && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border",
              scheduleBadge.isLate
                ? "bg-red-50 text-red-700 border-red-200/60"
                : scheduleBadge.isForToday
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  : "bg-blue-50 text-blue-700 border-blue-200/60"
            )}>
              <CalendarIcon className="h-2.5 w-2.5" />
              {format(scheduleBadge.date, "dd/MM", { locale: ptBR })}
            </span>
          )}
          {lastContactTime && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Clock className="h-2.5 w-2.5" />
              {lastContactTime}
            </span>
          )}
        </div>
      )}
    </>
  );

  if (isOverlay) {
    return (
      <div className="w-[284px] rounded-xl border border-border/60 bg-white dark:bg-card p-3.5 shadow-2xl rotate-[2deg] scale-[1.02] ring-2 ring-primary/30">
        {cardContent}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-card p-3.5 transition-all duration-150 cursor-grab active:cursor-grabbing group",
          "hover:border-border hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
          "shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
        )}
        onClick={onClick}
        data-tutorial="pipeline-card"
      >
        {cardContent}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  Pipeline Page
// ══════════════════════════════════════════════
export default function Pipeline() {
  const today = new Date();
  const initialDateRange = useMemo(() => ({
    from: startOfMonth(today),
    to: endOfMonth(today)
  }), []);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const [activeTab, setActiveTab] = useState("kanban");

  const { leads, isLoading: leadsLoading, updateLead } = useLeads(dateRange);
  const { stages, isLoading: stagesLoading } = useStages();

  const [optimisticLeads, setOptimisticLeads] = useState<Lead[]>([]);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);

  // Sincroniza scroll entre barra superior e container principal
  useEffect(() => {
    const top = topScrollRef.current;
    const main = scrollContainerRef.current;
    if (!top || !main) return;
    const onTopScroll = () => { main.scrollLeft = top.scrollLeft; };
    const onMainScroll = () => { top.scrollLeft = main.scrollLeft; };
    top.addEventListener('scroll', onTopScroll);
    main.addEventListener('scroll', onMainScroll);
    return () => {
      top.removeEventListener('scroll', onTopScroll);
      main.removeEventListener('scroll', onMainScroll);
    };
  }, []);

  useEffect(() => {
    if (leads) setOptimisticLeads(leads);
  }, [leads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const lead = optimisticLeads.find(l => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === 'Lead';
    const isOverALead = over.data.current?.type === 'Lead';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (!isActiveALead) return;

    if (isActiveALead && isOverALead) {
      setOptimisticLeads((prev) => {
        const activeIndex = prev.findIndex((l) => l.id === activeId);
        const overIndex = prev.findIndex((l) => l.id === overId);
        if (prev[activeIndex].posicao_pipeline !== prev[overIndex].posicao_pipeline) {
          const newLeads = [...prev];
          newLeads[activeIndex] = { ...newLeads[activeIndex], posicao_pipeline: prev[overIndex].posicao_pipeline };
          return arrayMove(newLeads, activeIndex, overIndex);
        }
        return arrayMove(prev, activeIndex, overIndex);
      });
    }

    if (isActiveALead && isOverAColumn) {
      setOptimisticLeads((prev) => {
        const activeIndex = prev.findIndex((l) => l.id === activeId);
        const newStageOrder = over.data.current?.stageOrder;
        if (prev[activeIndex].posicao_pipeline === newStageOrder) return prev;
        const newLeads = [...prev];
        newLeads[activeIndex] = { ...newLeads[activeIndex], posicao_pipeline: newStageOrder };
        return newLeads;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) { setOptimisticLeads(leads); return; }

    const leadId = active.id as string;
    let newStageOrder: number | undefined;

    if (over.data.current?.type === 'Column') {
      newStageOrder = over.data.current.stageOrder;
    } else if (over.data.current?.type === 'Lead') {
      const overLead = optimisticLeads.find(l => l.id === over.id);
      newStageOrder = overLead?.posicao_pipeline;
    }

    const originalLead = leads.find(l => l.id === leadId);
    if (newStageOrder && originalLead && originalLead.posicao_pipeline !== newStageOrder) {
      updateLead({ id: leadId, posicao_pipeline: newStageOrder });
    } else {
      setOptimisticLeads(leads);
    }
  };

  const handleCardClick = (lead: Lead) => {
    setViewingLead(lead);
    setModalOpen(true);
  };

  const handleUpdateLead = (leadId: string, updates: Partial<Lead>) => {
    updateLead({ id: leadId, ...updates });
  };

  const isLoading = leadsLoading || stagesLoading;

  // Stats
  const totalLeads = optimisticLeads.length;
  const qualifiedCount = optimisticLeads.filter(l => l.is_qualified).length;

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-4 w-36 rounded-md mt-2" />
          </div>
          <Skeleton className="h-9 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-80 rounded-lg" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[300px] shrink-0 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col pb-20">
      {/* ══════════ Page Header ══════════ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0" data-tutorial="pipeline-header">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground font-display">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalLeads} leads no funil
            <span className="mx-1.5 text-border">·</span>
            {qualifiedCount} qualificados
          </p>
        </div>
        <div className="flex items-center gap-2" data-tutorial="pipeline-filters">
          <DateRangePicker date={dateRange} setDate={setDateRange} hideQuickSelect />
        </div>
      </div>

      {/* ══════════ Tabs ══════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full overflow-hidden" data-tutorial="pipeline-tabs">
        <div className="flex-shrink-0 mb-4">
          <TabsList className="bg-muted/40 border border-border/40 p-0.5 rounded-lg inline-flex">
            <TabsTrigger value="kanban" className="text-xs font-semibold whitespace-nowrap rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 gap-1.5">
              <Kanban className="h-3.5 w-3.5" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="metrics" className="text-xs font-semibold whitespace-nowrap rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 gap-1.5" data-tutorial="pipeline-metrics-tab">
              <BarChart3 className="h-3.5 w-3.5" />
              Métricas
            </TabsTrigger>
          </TabsList>
          {/* Botões invisíveis para o sistema de tutorial */}
          <button data-tutorial="pipeline-open-metrics-direct" className="sr-only" onClick={() => setActiveTab('metrics')} tabIndex={-1} aria-hidden="true" />
          <button data-tutorial="pipeline-open-kanban-direct" className="sr-only" onClick={() => setActiveTab('kanban')} tabIndex={-1} aria-hidden="true" />
        </div>

        {/* ══════════ Kanban Tab ══════════ */}
        <TabsContent value="kanban" className="flex-1 h-full overflow-hidden mt-0" data-tutorial="pipeline-board">
          {/* Barra de scroll espelho no topo */}
          <div
            ref={topScrollRef}
            className="overflow-x-auto overflow-y-hidden scrollbar-always-visible"
            style={{ height: 12, scrollbarGutter: 'stable' }}
          >
            <div style={{ minWidth: `${stages.length * 312}px`, height: 1 }} />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={scrollContainerRef}
              className="overflow-x-auto pb-1 h-full"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              data-tutorial="pipeline-drag"
            >
              <div className="flex gap-3 h-full pb-2" style={{ minWidth: `${stages.length * 312}px` }}>
                {stages.map((stage, idx) => {
                  const stageLeads = optimisticLeads.filter(l => l.posicao_pipeline === stage.posicao_ordem);
                  return (
                    <StageColumn
                      key={stage.id}
                      stage={stage}
                      leads={stageLeads}
                      onCardClick={handleCardClick}
                      onUpdateLead={handleUpdateLead}
                      isFirst={idx === 0}
                    />
                  );
                })}
              </div>
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
              {activeLead ? <LeadCard lead={activeLead} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        {/* ══════════ Metrics Tab ══════════ */}
        <TabsContent value="metrics" className="flex-1 overflow-y-auto mt-0">
          <FunnelMetricsTab dateRange={dateRange} />
        </TabsContent>
      </Tabs>

      {/* ══════════ Lead Modal ══════════ */}
      <LeadModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setViewingLead(null);
        }}
        lead={viewingLead}
        mode="view"
      />
    </div>
  );
}
