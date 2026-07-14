import {
  FileText,
  Folder,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import type { PaginaResumo } from "@/hooks/usePaginas";
import { NotaIcone } from "@/lib/notasIcones";
import { cn } from "@/lib/utils";

export interface NotaTab {
  id: string; // id único da aba (não é o id da página)
  pageId: string | null; // null = aba na tela inicial (Home); string = id da página aberta
}

interface NotasTabBarProps {
  tabs: NotaTab[];
  paginas: PaginaResumo[]; // árvore completa, pra resolver título/ícone/tipo de cada pageId
  activeTabId: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
}

function resolverConteudoTab(tab: NotaTab, paginas: PaginaResumo[]) {
  if (tab.pageId === null) {
    return {
      icone: <Home className="h-3.5 w-3.5 shrink-0" />,
      label: "Notas",
    };
  }

  const pagina = paginas.find((p) => p.id === tab.pageId);

  if (!pagina) {
    return {
      icone: <FileText className="h-3.5 w-3.5 shrink-0" />,
      label: "Carregando…",
    };
  }

  if (pagina.tipo === "pasta") {
    return {
      icone: <Folder className="h-3.5 w-3.5 shrink-0" />,
      label: pagina.titulo,
    };
  }

  return {
    icone: (
      <NotaIcone
        nome={pagina.icone}
        className="h-3.5 w-3.5 shrink-0"
        fallback={<FileText className="h-3.5 w-3.5 shrink-0" />}
      />
    ),
    label: pagina.titulo || "Sem título",
  };
}

export function NotasTabBar({
  tabs,
  paginas,
  activeTabId,
  sidebarCollapsed,
  onToggleSidebar,
  onSelectTab,
  onCloseTab,
  onNewTab,
}: NotasTabBarProps): JSX.Element {
  return (
    <div className="h-10 flex items-center gap-1 px-2 border-b border-border/40 bg-muted/[0.03] shrink-0">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title={sidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5" />
        )}
      </button>

      <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />

      <div
        className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const { icone, label } = resolverConteudoTab(tab, paginas);
          const ativo = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "group flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-lg text-[12px] font-medium max-w-[180px] shrink-0 transition-colors",
                ativo
                  ? "bg-card border border-border/60 text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 border border-transparent"
              )}
            >
              {icone}
              <span className="truncate">{label}</span>
              {tabs.length > 1 && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-black/10"
                  title="Fechar aba"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onNewTab}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Nova aba"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
