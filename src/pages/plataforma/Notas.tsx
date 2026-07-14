import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePaginasArvore, useCriarPagina, type TipoPagina } from "@/hooks/usePaginas";
import { useAppChrome } from "@/contexts/AppChromeContext";
import { NotasSidebarTree } from "@/components/notas/NotasSidebarTree";
import { NotasHome } from "@/components/notas/NotasHome";
import { PaginaEditor } from "@/components/notas/PaginaEditor";
import { AthosPanel } from "@/components/notas/AthosPanel";
import { NotasTabBar, type NotaTab } from "@/components/notas/NotasTabBar";

function novaAba(pageId: string | null = null): NotaTab {
  return { id: crypto.randomUUID(), pageId };
}

export default function Notas() {
  const { data: arvore = [], isLoading } = usePaginasArvore();
  const criar = useCriarPagina();
  // Modelo de abas estilo navegador/Notion: cada aba guarda o id da página
  // aberta nela (null = tela inicial/dashboard). Reseta a cada entrada na
  // página (sem persistência) — decisão de produto (2026-07-13).
  const [tabs, setTabs] = useState<NotaTab[]>(() => [novaAba()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [athosOpen, setAthosOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { chromeHidden: fullscreen, setChromeHidden: setFullscreen } = useAppChrome();
  const treePanelRef = useRef<ImperativePanelHandle>(null);

  // Sair de Notas com a tela cheia ligada não pode deixar a sidebar/topbar
  // da plataforma escondida pro resto da navegação.
  useEffect(() => () => setFullscreen(false), [setFullscreen]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeId = activeTab.pageId ?? undefined;
  const paginaAtiva = arvore.find((p) => p.id === activeId);
  const notaAberta = paginaAtiva?.tipo === "nota";

  // Página aberta numa aba foi excluída/movida em outro lugar — evita a aba
  // ficar presa num spinner infinito; volta essa aba pra tela inicial.
  useEffect(() => {
    if (isLoading || !activeId) return;
    if (!arvore.find((p) => p.id === activeId)) {
      setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, pageId: null } : t)));
    }
  }, [arvore, isLoading, activeId, activeTabId]);

  // Abrir uma página SEMPRE navega dentro da aba atual (nunca cria aba nova) —
  // decisão de produto (2026-07-13), igual ao comportamento padrão do Notion.
  function abrir(id: string) {
    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, pageId: id } : t)));
    setAthosOpen(false);
  }

  function irParaHome() {
    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, pageId: null } : t)));
    setAthosOpen(false);
  }

  // "+" da barra de abas: abre uma aba nova na tela inicial — decisão de
  // produto (2026-07-13) — o usuário escolhe o que abrir/criar a partir dali.
  function novaAbaHome() {
    const aba = novaAba();
    setTabs((prev) => [...prev, aba]);
    setActiveTabId(aba.id);
    setAthosOpen(false);
  }

  function fecharAba(tabId: string) {
    setTabs((prev) => {
      if (prev.length <= 1) return prev; // sempre resta ao menos 1 aba
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        const vizinho = next[Math.max(0, idx - 1)] ?? next[0];
        setActiveTabId(vizinho.id);
      }
      return next;
    });
  }

  function selecionarAba(tabId: string) {
    setActiveTabId(tabId);
    setAthosOpen(false);
  }

  async function criarPagina(tipo: TipoPagina, parentId: string | null) {
    try {
      const id = await criar.mutateAsync({
        tipo,
        parent_id: parentId,
        titulo: tipo === "pasta" ? "Nova pasta" : "Sem título",
      });
      abrir(id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar.");
    }
  }

  function toggleFullscreen() {
    const next = !fullscreen;
    setFullscreen(next);
    // Tela cheia = mais espaço pro material; recolhe a árvore por padrão,
    // mas ela continua acessível pelo botão na barra de abas — só a
    // plataforma some.
    if (next) treePanelRef.current?.collapse();
    else treePanelRef.current?.expand();
  }

  function toggleSidebar() {
    const panel = treePanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand(); else panel.collapse();
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // h-[calc(100vh-4rem)]: mesmo padrão de Conversas.tsx — trava a altura no
  // viewport (descontando a topbar de 4rem) independente da altura do
  // conteúdo interno, senão o layout inteiro cresce com a página e o
  // sidebar/botão flutuante "descem" junto em vez de ficarem parados.
  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden relative flex flex-col" data-tutorial="notas-shell">
      <NotasTabBar
        tabs={tabs}
        paginas={arvore}
        activeTabId={activeTabId}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onSelectTab={selecionarAba}
        onCloseTab={fecharAba}
        onNewTab={novaAbaHome}
      />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" autoSaveId="notas-panels">
          <ResizablePanel
            ref={treePanelRef}
            defaultSize={22}
            minSize={16}
            maxSize={35}
            collapsible
            collapsedSize={0}
            onCollapse={() => setSidebarCollapsed(true)}
            onExpand={() => setSidebarCollapsed(false)}
            className="bg-muted/[0.03] border-r border-border/40"
          >
            <NotasSidebarTree paginas={arvore} activeId={activeId} onSelect={abrir} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={athosOpen ? 56 : 78} minSize={35}>
            {!activeId ? (
              // Tela inicial: dashboard global de notas
              <div className="h-full overflow-y-auto">
                <NotasHome
                  paginas={arvore}
                  onGoHome={irParaHome}
                  onOpenNota={abrir}
                  onOpenPasta={abrir}
                  onCriarNota={(parentId) => criarPagina("nota", parentId)}
                  onCriarPasta={(parentId) => criarPagina("pasta", parentId)}
                />
              </div>
            ) : !paginaAtiva ? (
              // activeId setado mas ainda não presente na árvore (logo após criar
              // ou selecionar, enquanto o refetch acontece).
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : paginaAtiva.tipo === "pasta" ? (
              // Pasta aberta: dashboard com escopo da pasta
              <div className="h-full overflow-y-auto">
                <NotasHome
                  paginas={arvore}
                  folderId={activeId}
                  onGoHome={irParaHome}
                  onOpenNota={abrir}
                  onOpenPasta={abrir}
                  onCriarNota={(parentId) => criarPagina("nota", parentId)}
                  onCriarPasta={(parentId) => criarPagina("pasta", parentId)}
                />
              </div>
            ) : (
              <PaginaEditor
                paginaId={activeId}
                arvore={arvore}
                onNavigate={abrir}
                onGoHome={irParaHome}
                isFullscreen={fullscreen}
                onToggleFullscreen={toggleFullscreen}
              />
            )}
          </ResizablePanel>

          {athosOpen && notaAberta && paginaAtiva && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={22} minSize={18} maxSize={40} className="border-l border-border/40">
                <AthosPanel
                  paginaId={activeId!}
                  paginaTitulo={paginaAtiva.titulo}
                  onClose={() => setAthosOpen(false)}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {notaAberta && !athosOpen && (
        <button
          data-tutorial="notas-athos-toggle"
          onClick={() => setAthosOpen(true)}
          title="Perguntar ao Athos"
          className={cn(
            "fixed bottom-6 right-6 h-12 w-12 rounded-full bg-foreground text-background z-40",
            "flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
            "hover:bg-foreground/90 transition-colors"
          )}
        >
          <Sparkles className="h-5 w-5 text-[#E85D24]" />
        </button>
      )}
    </div>
  );
}
