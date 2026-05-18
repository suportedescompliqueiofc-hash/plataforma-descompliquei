import { useState, useMemo, useCallback } from "react";
import { Plus, Settings2, Phone, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  closestCenter, PointerSensor, useSensor, useSensors, useDroppable,
  defaultDropAnimationSideEffects, DropAnimation,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOutboundProspectos, OutboundProspecto } from "@/hooks/useOutboundProspectos";
import { useOutboundStages, OutboundStage } from "@/hooks/useOutboundStages";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { useLigacaoModal } from "@/contexts/LigacaoContext";
import { ProspectoFormModal } from "@/components/outbound/ProspectoFormModal";
import { ProspectoDetalheModal } from "@/components/outbound/ProspectoDetalheModal";
import { GerenciarStagesModal } from "@/components/outbound/GerenciarStagesModal";
import { cn } from "@/lib/utils";

const SCORING_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-500",
  B: "bg-blue-500/20 text-blue-500",
  C: "bg-amber-500/20 text-amber-500",
  D: "bg-red-500/20 text-red-500",
};

const CANAL_LABELS: Record<string, string> = {
  google_maps: "Google Maps", instagram: "Instagram", base_comprada: "Base comprada",
  indicacao: "Indicação", evento: "Evento", outro: "Outro",
};

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

// ─── PROSPECTO CARD ────────────────────────────────────
function ProspectoCard({ prospecto, isOverlay, onClick, onLigar }: {
  prospecto: OutboundProspecto;
  isOverlay?: boolean;
  onClick?: () => void;
  onLigar?: (e: React.MouseEvent) => void;
}) {
  const initials = prospecto.nome.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const isOverdue = prospecto.proxima_acao_data && new Date(prospecto.proxima_acao_data) < new Date();

  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-card space-y-2 transition-shadow cursor-pointer group",
        isOverlay && "shadow-xl rotate-1 scale-105 ring-2 ring-[#E85D24]/50",
        !isOverlay && "hover:shadow-md"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{prospecto.nome}</p>
          {prospecto.clinica && <p className="text-xs text-muted-foreground truncate">{prospecto.clinica}</p>}
        </div>
        {prospecto.lead_scoring && (
          <Badge variant="outline" className={`text-[10px] px-1.5 flex-shrink-0 ${SCORING_COLORS[prospecto.lead_scoring] || ""}`}>{prospecto.lead_scoring}</Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prospecto.total_tentativas}</span>
          {prospecto.ultimo_contato && (
            <span>{formatDistanceToNow(new Date(prospecto.ultimo_contato), { addSuffix: true, locale: ptBR })}</span>
          )}
        </div>
        {prospecto.perfil_nome && (
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] bg-muted">{prospecto.perfil_nome.split(" ").map(n => n[0]).join("").substring(0, 2)}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {prospecto.proxima_acao && (
        <p className={cn("text-[11px] truncate", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
          {prospecto.proxima_acao}
          {prospecto.proxima_acao_data && ` • ${formatDistanceToNow(new Date(prospecto.proxima_acao_data), { addSuffix: true, locale: ptBR })}`}
        </p>
      )}

      <Button
        size="sm"
        className="w-full h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-[#E85D24] hover:bg-[#E85D24]/90"
        onClick={onLigar}
      >
        <Phone className="h-3 w-3 mr-1" /> Ligar
      </Button>
    </div>
  );
}

// ─── SORTABLE CARD WRAPPER ─────────────────────────────
function SortableProspectoCard({ prospecto, onClick, onLigar }: {
  prospecto: OutboundProspecto;
  onClick: () => void;
  onLigar: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prospecto.id,
    data: { type: "Prospecto", prospecto },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProspectoCard prospecto={prospecto} onClick={onClick} onLigar={onLigar} />
    </div>
  );
}

// ─── STAGE COLUMN ──────────────────────────────────────
function StageColumn({ stage, prospectos, onCardClick, onLigar }: {
  stage: OutboundStage;
  prospectos: OutboundProspecto[];
  onCardClick: (p: OutboundProspecto) => void;
  onLigar: (p: OutboundProspecto, e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "Column", stageId: stage.id },
  });

  const borderClass = stage.tipo === "ganho"
    ? "border-t-emerald-500"
    : stage.tipo === "perdido"
    ? "border-t-red-500"
    : "border-t-transparent";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[300px] min-w-[300px] rounded-lg border border-t-4 bg-muted/30 transition-colors",
        borderClass,
        isOver && "bg-[#E85D24]/5 ring-1 ring-[#E85D24]/30"
      )}
    >
      <div className="p-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.cor }} />
          <h3 className="text-sm font-semibold">{stage.nome}</h3>
        </div>
        <Badge variant="outline" className="text-xs">{prospectos.length}</Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
        <SortableContext items={prospectos.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {prospectos.map(p => (
            <SortableProspectoCard key={p.id} prospecto={p} onClick={() => onCardClick(p)} onLigar={(e) => onLigar(p, e)} />
          ))}
        </SortableContext>
        {prospectos.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum prospecto</p>
        )}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────
export default function OutboundPipeline() {
  const { prospectos, isLoading: prospectosLoading, updateProspecto } = useOutboundProspectos();
  const { stages, isLoading: stagesLoading } = useOutboundStages();
  const { users } = useOrgUsers();
  const { openRegistrarLigacao } = useLigacaoModal();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetalheOpen, setIsDetalheOpen] = useState(false);
  const [isStagesOpen, setIsStagesOpen] = useState(false);
  const [selectedProspecto, setSelectedProspecto] = useState<OutboundProspecto | null>(null);
  const [editProspecto, setEditProspecto] = useState<OutboundProspecto | null>(null);
  const [activeProspecto, setActiveProspecto] = useState<OutboundProspecto | null>(null);
  const [optimisticProspectos, setOptimisticProspectos] = useState<OutboundProspecto[]>([]);
  const [filters, setFilters] = useState({ search: "", scoring: "todos", usuario_id: "todos", canal_origem: "todos" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const displayProspectos = optimisticProspectos.length > 0 ? optimisticProspectos : prospectos;

  // Stages ordenados: ativos por posicao_ordem, depois ganho, depois perdido
  const sortedStages = useMemo(() => {
    const ativos = stages.filter(s => s.tipo === "ativo").sort((a, b) => a.posicao_ordem - b.posicao_ordem);
    const ganho = stages.filter(s => s.tipo === "ganho").sort((a, b) => a.posicao_ordem - b.posicao_ordem);
    const perdido = stages.filter(s => s.tipo === "perdido").sort((a, b) => a.posicao_ordem - b.posicao_ordem);
    return [...ativos, ...ganho, ...perdido];
  }, [stages]);

  // Filtro dos prospectos
  const filteredProspectos = useMemo(() => {
    return displayProspectos.filter(p => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!p.nome.toLowerCase().includes(s) && !(p.clinica || "").toLowerCase().includes(s)) return false;
      }
      if (filters.scoring !== "todos" && p.lead_scoring !== filters.scoring) return false;
      if (filters.usuario_id !== "todos" && p.usuario_id !== filters.usuario_id) return false;
      if (filters.canal_origem !== "todos" && p.canal_origem !== filters.canal_origem) return false;
      return true;
    });
  }, [displayProspectos, filters]);

  // Prospectos por coluna
  const prospectosByStage = useMemo(() => {
    const map: Record<string, OutboundProspecto[]> = {};
    sortedStages.forEach(s => { map[s.id] = []; });
    filteredProspectos.forEach(p => {
      if (p.stage_id && map[p.stage_id]) {
        map[p.stage_id].push(p);
      }
    });
    return map;
  }, [filteredProspectos, sortedStages]);

  const handleDragStart = (event: DragStartEvent) => {
    const p = event.active.data.current?.prospecto as OutboundProspecto;
    setActiveProspecto(p || null);
    setOptimisticProspectos([...prospectos]);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    let targetStageId: string | undefined;

    if (over.data.current?.type === "Column") {
      targetStageId = over.data.current.stageId;
    } else if (over.data.current?.type === "Prospecto") {
      const overProspecto = optimisticProspectos.find(p => p.id === over.id);
      targetStageId = overProspecto?.stage_id || undefined;
    }

    if (!targetStageId) return;

    setOptimisticProspectos(prev =>
      prev.map(p => p.id === activeId ? { ...p, stage_id: targetStageId! } : p)
    );
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProspecto(null);

    if (!over) {
      setOptimisticProspectos([]);
      return;
    }

    const prospectoId = active.id as string;
    let targetStageId: string | undefined;

    if (over.data.current?.type === "Column") {
      targetStageId = over.data.current.stageId;
    } else if (over.data.current?.type === "Prospecto") {
      const overProspecto = optimisticProspectos.find(p => p.id === over.id);
      targetStageId = overProspecto?.stage_id || undefined;
    }

    const original = prospectos.find(p => p.id === prospectoId);
    if (targetStageId && original && original.stage_id !== targetStageId) {
      updateProspecto.mutate({ id: prospectoId, stage_id: targetStageId });
    }

    setOptimisticProspectos([]);
  }, [prospectos, optimisticProspectos, updateProspecto]);

  const handleCardClick = (p: OutboundProspecto) => { setSelectedProspecto(p); setIsDetalheOpen(true); };
  const handleLigar = (p: OutboundProspecto, e: React.MouseEvent) => { e.stopPropagation(); openRegistrarLigacao(p); };
  const handleEditFromDetalhe = () => { setIsDetalheOpen(false); setEditProspecto(selectedProspecto); setIsFormOpen(true); };

  const hasActiveFilters = filters.search || filters.scoring !== "todos" || filters.usuario_id !== "todos" || filters.canal_origem !== "todos";
  const clearFilters = () => setFilters({ search: "", scoring: "todos", usuario_id: "todos", canal_origem: "todos" });

  const isLoading = prospectosLoading || stagesLoading;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Pipeline Outbound</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsStagesOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Gerenciar Stages
          </Button>
          <Button size="sm" onClick={() => { setEditProspecto(null); setIsFormOpen(true); }} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Prospecto
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9 h-9" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>
        <Select value={filters.scoring} onValueChange={v => setFilters(f => ({ ...f, scoring: v }))}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem>
            <SelectItem value="C">C</SelectItem><SelectItem value="D">D</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.usuario_id} onValueChange={v => setFilters(f => ({ ...f, usuario_id: v }))}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos SDRs</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome_completo || "Sem nome"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.canal_origem} onValueChange={v => setFilters(f => ({ ...f, canal_origem: v }))}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos canais</SelectItem>
            {Object.entries(CANAL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9"><X className="h-4 w-4 mr-1" /> Limpar</Button>
        )}
      </div>

      {/* KANBAN */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[300px] min-w-[300px] space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : sortedStages.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">Nenhum stage configurado</p>
          <Button onClick={() => setIsStagesOpen(true)} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            <Settings2 className="h-4 w-4 mr-2" /> Configurar Stages
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4">
              {sortedStages.map(stage => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  prospectos={prospectosByStage[stage.id] || []}
                  onCardClick={handleCardClick}
                  onLigar={handleLigar}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
              {activeProspecto && <ProspectoCard prospecto={activeProspecto} isOverlay />}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* MODAIS */}
      <ProspectoFormModal open={isFormOpen} onOpenChange={setIsFormOpen} prospecto={editProspecto} />
      <ProspectoDetalheModal open={isDetalheOpen} onOpenChange={setIsDetalheOpen} prospecto={selectedProspecto} onEdit={handleEditFromDetalhe} />
      <GerenciarStagesModal open={isStagesOpen} onOpenChange={setIsStagesOpen} />
    </div>
  );
}
