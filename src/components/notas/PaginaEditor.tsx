import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Users2, Lock, Share2, Smile, Maximize2, Minimize2, Headset, PanelLeft, ArrowLeft } from "lucide-react";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { usePagina, useAtualizarPagina, type PaginaResumo, type Visibilidade } from "@/hooks/usePaginas";
import { findBreadcrumb } from "@/lib/paginasTree";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { CompartilharDialog } from "@/components/notas/CompartilharDialog";
import { NotaIcone } from "@/lib/notasIcones";
import { IconePicker } from "@/components/notas/IconePicker";

interface PaginaEditorProps {
  paginaId: string;
  arvore: PaginaResumo[];
  onNavigate: (id: string) => void;
  onGoHome?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onToggleSidebar?: () => void;
}

export function PaginaEditor({ paginaId, arvore, onNavigate, onGoHome, isFullscreen = false, onToggleFullscreen, onToggleSidebar }: PaginaEditorProps) {
  const { profile } = useProfile();
  const { data: pagina, isLoading } = usePagina(paginaId);
  const atualizar = useAtualizarPagina();
  const [tituloLocal, setTituloLocal] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTituloLocal(pagina?.titulo ?? "");
  }, [pagina?.id, pagina?.titulo]);

  if (isLoading || !pagina) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-[13px]">
        Carregando...
      </div>
    );
  }

  const isOwner = pagina.criado_por === profile?.id;
  const trilha = findBreadcrumb(arvore, paginaId);

  function commitTitulo() {
    const titulo = tituloLocal.trim() || "Sem título";
    if (titulo !== pagina!.titulo) atualizar.mutate({ id: paginaId, titulo });
  }

  function commitConteudo(json: any) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      atualizar.mutate({ id: paginaId, conteudo: json });
    }, 700);
  }

  function setIcone(icone: string) {
    atualizar.mutate({ id: paginaId, icone });
  }

  function toggleVisibilidade(v: Visibilidade) {
    atualizar.mutate({ id: paginaId, visibilidade: v });
  }

  function toggleAtendimento() {
    const novoValor = !pagina!.disponivel_atendimento;
    atualizar.mutate({ id: paginaId, disponivel_atendimento: novoValor });
    toast.success(novoValor ? "Adicionada à conversa." : "Removida da conversa.");
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
      <div className="w-full px-10 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                title="Abrir/fechar a árvore de páginas"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {onGoHome && (
              <button
                onClick={onGoHome}
                title="Voltar para as Notas"
                className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="text-[12px] cursor-pointer"
                    onClick={() => onGoHome?.()}
                  >
                    Notas
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {trilha.map((p, i) => (
                  <span key={p.id} className="contents">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        className={cn("text-[12px] cursor-pointer", i === trilha.length - 1 && "font-medium text-foreground")}
                        onClick={() => onNavigate(p.id)}
                      >
                        {p.titulo}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? "Sair da tela cheia" : "Expandir para tela cheia"}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-6 mb-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/60 hover:bg-muted transition-colors shrink-0">
                <NotaIcone
                  nome={pagina.icone}
                  className="h-5 w-5 text-foreground"
                  fallback={<Smile className="h-4 w-4 text-muted-foreground" />}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3">
              <IconePicker
                value={pagina.icone}
                onSelect={(nome) => { setIcone(nome); }}
                onClear={() => atualizar.mutate({ id: paginaId, icone: null })}
              />
            </PopoverContent>
          </Popover>

          <input
            value={tituloLocal}
            onChange={(e) => setTituloLocal(e.target.value)}
            onBlur={commitTitulo}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Sem título"
            className="flex-1 text-3xl font-bold tracking-tight text-foreground font-display bg-transparent outline-none placeholder:text-muted-foreground/30"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-8 ml-[3px]">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            {pagina.perfis?.nome_completo || "Alguém"}
          </div>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Atualizado {formatDistanceToNow(new Date(pagina.atualizado_em), { addSuffix: true, locale: ptBR })}
          </span>

          {isOwner && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <div className="inline-flex items-center rounded-full bg-muted/50 p-0.5">
                <button
                  onClick={() => toggleVisibilidade("pessoal")}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-colors",
                    pagina.visibilidade === "pessoal" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Lock className="h-2.5 w-2.5" /> Pessoal
                </button>
                <button
                  onClick={() => toggleVisibilidade("empresa")}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-colors",
                    pagina.visibilidade === "empresa" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users2 className="h-2.5 w-2.5" /> Empresa
                </button>
              </div>

              {pagina.visibilidade === "pessoal" && (
                <button
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Share2 className="h-3 w-3" /> Compartilhar
                </button>
              )}

              <span className="text-muted-foreground/30">·</span>
              <button
                onClick={toggleAtendimento}
                title="Deixa esta página disponível no painel de materiais durante o atendimento"
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors",
                  pagina.disponivel_atendimento
                    ? "text-[#E85D24]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Headset className="h-3 w-3" />
                {pagina.disponivel_atendimento ? "Disponível na conversa" : "Adicionar à conversa"}
              </button>
            </>
          )}
        </div>

        <BlockEditor
          content={pagina.conteudo}
          onChange={commitConteudo}
          editable={isOwner || pagina.visibilidade === "empresa"}
        />
      </div>

      {isOwner && (
        <CompartilharDialog paginaId={paginaId} open={shareOpen} onOpenChange={setShareOpen} />
      )}
    </div>
  );
}
