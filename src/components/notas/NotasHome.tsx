import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText, Folder, FolderPlus, Plus, Building2, Lock, FolderOpen,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useAtualizarPagina, useMoverPagina, type PaginaResumo } from "@/hooks/usePaginas";
import { findBreadcrumb } from "@/lib/paginasTree";
import { NotaIcone } from "@/lib/notasIcones";

interface NotasHomeProps {
  paginas: PaginaResumo[];
  folderId?: string;
  onOpenNota: (id: string) => void;
  onOpenPasta: (id: string) => void;
  onCriarNota: (parentId: string | null) => void;
  onCriarPasta: (parentId: string | null) => void;
  onGoHome: () => void;
}

export function NotasHome({
  paginas, folderId, onOpenNota, onOpenPasta, onCriarNota, onCriarPasta, onGoHome,
}: NotasHomeProps) {
  if (folderId) {
    return (
      <PastaView
        paginas={paginas}
        folderId={folderId}
        onOpenNota={onOpenNota}
        onOpenPasta={onOpenPasta}
        onCriarNota={onCriarNota}
        onCriarPasta={onCriarPasta}
        onGoHome={onGoHome}
      />
    );
  }
  return (
    <HomeGlobal
      paginas={paginas}
      onOpenNota={onOpenNota}
      onOpenPasta={onOpenPasta}
      onCriarNota={onCriarNota}
      onCriarPasta={onCriarPasta}
    />
  );
}

// ---------------------------------------------------------------------------
// Home global
// ---------------------------------------------------------------------------

interface HomeGlobalProps {
  paginas: PaginaResumo[];
  onOpenNota: (id: string) => void;
  onOpenPasta: (id: string) => void;
  onCriarNota: (parentId: string | null) => void;
  onCriarPasta: (parentId: string | null) => void;
}

function HomeGlobal({ paginas, onOpenNota, onOpenPasta, onCriarNota, onCriarPasta }: HomeGlobalProps) {
  const pastas = useMemo(() => paginas.filter((p) => p.tipo === "pasta"), [paginas]);
  const notas = useMemo(() => paginas.filter((p) => p.tipo === "nota"), [paginas]);
  const notasEmpresa = useMemo(() => notas.filter((n) => n.visibilidade === "empresa"), [notas]);
  const pastasRaiz = useMemo(() => pastas.filter((p) => p.parent_id === null), [pastas]);
  const notasSoltas = useMemo(() => notas.filter((n) => n.parent_id === null), [notas]);

  const notasRecentes = useMemo(
    () => [...notas].sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime()).slice(0, 6),
    [notas]
  );

  const ultimaEdicao = notasRecentes[0]?.atualizado_em;

  return (
    <div className="max-w-[1080px] w-full mx-auto px-6 sm:px-10 py-8 sm:py-10">
      {/* header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-muted flex items-center justify-center">
              <FileText className="h-[18px] w-[18px] text-foreground" />
            </div>
            <h1 className="text-[26px] sm:text-[28px] font-extrabold tracking-tight text-foreground font-display">
              Suas notas
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1.5 ml-[46px]">
            Tudo o que a clínica documenta — organizado em pastas, sempre à mão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3.5"
            onClick={() => onCriarPasta(null)}
          >
            <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
          </Button>
          <Button
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            onClick={() => onCriarNota(null)}
          >
            <Plus className="h-3.5 w-3.5" /> Nova nota
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
        <StatCard label="Pastas" value={pastas.length} />
        <StatCard label="Notas" value={notas.length} />
        <StatCard label="Da empresa" value={notasEmpresa.length} suffix="compartilhadas" />
        <StatCard
          label="Última edição"
          value={ultimaEdicao ? formatDistanceToNow(new Date(ultimaEdicao), { addSuffix: true, locale: ptBR }) : "—"}
          small
        />
      </div>

      {/* continuar de onde parou */}
      {notasRecentes.length > 0 && (
        <Section overline="Continuar de onde parou">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
            {notasRecentes.map((nota) => (
              <NoteCard key={nota.id} nota={nota} onClick={() => onOpenNota(nota.id)} />
            ))}
          </div>
        </Section>
      )}

      {/* pastas */}
      <Section overline="Pastas">
        {pastasRaiz.length === 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            <NovaPastaCard onClick={() => onCriarPasta(null)} />
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {pastasRaiz.map((pasta) => (
              <FolderCard key={pasta.id} pasta={pasta} onClick={() => onOpenPasta(pasta.id)} />
            ))}
            <NovaPastaCard onClick={() => onCriarPasta(null)} />
          </div>
        )}
      </Section>

      {/* notas soltas na raiz */}
      {notasSoltas.length > 0 && (
        <Section overline="Notas soltas · na raiz">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
            {notasSoltas.map((nota) => (
              <NoteCard key={nota.id} nota={nota} onClick={() => onOpenNota(nota.id)} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View de pasta
// ---------------------------------------------------------------------------

interface PastaViewProps {
  paginas: PaginaResumo[];
  folderId: string;
  onOpenNota: (id: string) => void;
  onOpenPasta: (id: string) => void;
  onCriarNota: (parentId: string | null) => void;
  onCriarPasta: (parentId: string | null) => void;
  onGoHome: () => void;
}

function PastaView({ paginas, folderId, onOpenNota, onOpenPasta, onCriarNota, onCriarPasta, onGoHome }: PastaViewProps) {
  const pasta = paginas.find((p) => p.id === folderId);
  const atualizar = useAtualizarPagina();
  const mover = useMoverPagina();
  const [tituloLocal, setTituloLocal] = useState("");
  const [descricaoLocal, setDescricaoLocal] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTituloLocal(pasta?.titulo ?? "");
  }, [pasta?.id, pasta?.titulo]);

  useEffect(() => {
    setDescricaoLocal(pasta?.descricao ?? "");
  }, [pasta?.id, pasta?.descricao]);

  function commitTitulo() {
    const titulo = tituloLocal.trim() || "Nova pasta";
    if (pasta && titulo !== pasta.titulo) atualizar.mutate({ id: folderId, titulo });
  }

  const subpastas = useMemo(
    () => paginas.filter((p) => p.parent_id === folderId && p.tipo === "pasta"),
    [paginas, folderId]
  );
  const notasDiretas = useMemo(
    () => paginas.filter((p) => p.parent_id === folderId && p.tipo === "nota"),
    [paginas, folderId]
  );

  // Ordem local para drag & drop — semeada por ordem_index e ressincronizada
  // quando as notas mudam (evita "flash" logo após persistir a nova ordem).
  const [notasOrdenadas, setNotasOrdenadas] = useState<PaginaResumo[]>([]);

  useEffect(() => {
    setNotasOrdenadas([...notasDiretas].sort((a, b) => a.ordem_index - b.ordem_index));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notasDiretas]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = notasOrdenadas.findIndex((n) => n.id === active.id);
    const newIndex = notasOrdenadas.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordenadas = arrayMove(notasOrdenadas, oldIndex, newIndex);
    setNotasOrdenadas(reordenadas);

    reordenadas.forEach((nota, index) => {
      if (nota.ordem_index !== index) {
        mover.mutateAsync({ id: nota.id, parent_id: folderId, ordem_index: index });
      }
    });
  }

  function handleDescricaoChange(value: string) {
    setDescricaoLocal(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      atualizar.mutate({ id: folderId, descricao: value.trim() || null } as any);
    }, 700);
  }

  if (!pasta) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground/50 text-[13px]">
        Pasta não encontrada.
      </div>
    );
  }

  const vazia = subpastas.length === 0 && notasDiretas.length === 0;
  const trilha = findBreadcrumb(paginas, folderId);
  const ancestrais = trilha.slice(0, -1);

  return (
    <div className="max-w-[1080px] w-full mx-auto px-6 sm:px-10 py-8 sm:py-10">
      {/* breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="text-[12px] cursor-pointer" onClick={() => onGoHome()}>
              Notas
            </BreadcrumbLink>
          </BreadcrumbItem>
          {ancestrais.map((p) => (
            <span key={p.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="text-[12px] cursor-pointer" onClick={() => onOpenPasta(p.id)}>
                  {p.titulo}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </span>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              className="text-[12px] font-medium text-foreground cursor-pointer"
              onClick={() => onOpenPasta(folderId)}
            >
              {pasta.titulo}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mt-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Folder className="h-[18px] w-[18px] text-foreground" />
            </div>
            <input
              value={tituloLocal}
              onChange={(e) => setTituloLocal(e.target.value)}
              onBlur={commitTitulo}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder="Nova pasta"
              className="flex-1 min-w-0 text-[26px] sm:text-[28px] font-extrabold tracking-tight text-foreground font-display bg-transparent outline-none placeholder:text-muted-foreground/30"
            />
          </div>
          <div className="ml-[46px] mt-2">
            <Textarea
              value={descricaoLocal}
              onChange={(e) => handleDescricaoChange(e.target.value)}
              placeholder="Adicione uma descrição curta para esta pasta..."
              rows={2}
              className="resize-none text-[13px] text-muted-foreground border-none bg-transparent px-0 py-0 h-auto min-h-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            className="h-9 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3.5"
            onClick={() => onCriarPasta(folderId)}
          >
            <FolderPlus className="h-3.5 w-3.5" /> Nova subpasta
          </Button>
          <Button
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            onClick={() => onCriarNota(folderId)}
          >
            <Plus className="h-3.5 w-3.5" /> Nova nota
          </Button>
        </div>
      </div>

      {vazia ? (
        <div className="flex flex-col items-center justify-center py-16 text-center mt-4">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Esta pasta está vazia</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            Crie uma subpasta ou uma nota para começar a organizar
          </p>
        </div>
      ) : (
        <>
          {subpastas.length > 0 && (
            <Section overline="Subpastas">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {subpastas.map((sub) => (
                  <FolderCard key={sub.id} pasta={sub} onClick={() => onOpenPasta(sub.id)} />
                ))}
              </div>
            </Section>
          )}

          {notasOrdenadas.length > 0 && (
            <Section overline="Notas">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={notasOrdenadas.map((n) => n.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
                    {notasOrdenadas.map((nota) => (
                      <SortableNoteCard key={nota.id} nota={nota} onClick={() => onOpenNota(nota.id)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças reutilizáveis
// ---------------------------------------------------------------------------

function Section({ overline, children }: { overline: string; children: React.ReactNode }) {
  return (
    <div className="mt-9">
      <div className="flex items-center justify-between mb-3.5">
        <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/50">
          {overline}
        </span>
      </div>
      {children}
    </div>
  );
}

function StatCard({
  label, value, suffix, small,
}: { label: string; value: string | number; suffix?: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={cn(
        "mt-1.5 font-display font-extrabold tracking-tight text-foreground tabular-nums",
        small ? "text-[16px]" : "text-[24px]"
      )}>
        {value}
        {suffix && <span className="text-[12px] font-semibold text-muted-foreground ml-1 normal-case">{suffix}</span>}
      </p>
    </div>
  );
}

function NoteCard({ nota, onClick }: { nota: PaginaResumo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left flex flex-col gap-2.5 min-h-[130px]",
        "rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "px-4 py-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      )}
    >
      <div className="flex items-center justify-between">
        <NotaIcone nome={nota.icone} className="h-5 w-5 text-muted-foreground/70" />
      </div>
      <p className="text-[14px] font-bold tracking-tight text-foreground leading-snug line-clamp-2">
        {nota.titulo || "Sem título"}
      </p>
      <div className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <VisibilidadeTag visibilidade={nota.visibilidade} />
        <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
        <span>Atualizado {formatDistanceToNow(new Date(nota.atualizado_em), { addSuffix: true, locale: ptBR })}</span>
      </div>
    </button>
  );
}

// Wrapper sortable — envolve o `NoteCard` existente com `useSortable`, sem
// alterar o componente original (também usado, sem DnD, na Home global).
function SortableNoteCard({ nota, onClick }: { nota: PaginaResumo; onClick: () => void }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: nota.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none transition-opacity",
        isDragging && "opacity-60 scale-[0.98] z-10"
      )}
    >
      <NoteCard nota={nota} onClick={onClick} />
    </div>
  );
}

function FolderCard({ pasta, onClick }: { pasta: PaginaResumo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left flex items-center gap-3",
        "rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      )}
    >
      <span className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Folder className="h-4.5 w-4.5 text-foreground" strokeWidth={1.9} />
      </span>
      <span className="text-[14.5px] font-bold tracking-tight text-foreground truncate">{pasta.titulo}</span>
    </button>
  );
}

function NovaPastaCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 min-h-[96px]",
        "rounded-2xl border border-dashed border-border/60 text-muted-foreground",
        "text-[13px] font-semibold transition-colors hover:bg-muted/40 hover:text-foreground"
      )}
    >
      <Plus className="h-4 w-4" /> Nova pasta
    </button>
  );
}

function VisibilidadeTag({ visibilidade }: { visibilidade: PaginaResumo["visibilidade"] }) {
  if (visibilidade === "empresa") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E85D24]/10 text-[#E85D24]">
        <Building2 className="h-2.5 w-2.5" /> Empresa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      <Lock className="h-2.5 w-2.5" /> Pessoal
    </span>
  );
}
