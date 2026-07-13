"use client";

import { useMemo, useState } from "react";
import { generateHTML } from "@tiptap/core";
import { usePaginasAtendimento, usePaginaConteudo } from "@/hooks/usePaginas";
import { getRichExtensions } from "@/components/editor/RichEditor";
import { MATERIAL_CATEGORIAS, materialCategoriaLabel } from "@/lib/materiaisComerciais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, FileText, X, Copy, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MaterialsSidebarProps {
  onClose?: () => void;
}

// Prose compacto — versão reduzida para a coluna estreita do sidebar (~256px),
// menor que o PROSE_STYLES da tela cheia de Materiais.
const SIDEBAR_PROSE = `
  [&_h1]:text-[14px] [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mb-1.5 [&_h1]:mt-4 [&_h1]:leading-snug [&_h1:first-child]:mt-0
  [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2:first-child]:mt-0
  [&_h3]:text-[10px] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-foreground/60 [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:pt-3 [&_h3]:border-t [&_h3]:border-border/40 [&_h3:first-child]:mt-0 [&_h3:first-child]:pt-0 [&_h3:first-child]:border-t-0
  [&_p]:text-[12px] [&_p]:text-foreground/80 [&_p]:leading-[1.55] [&_p]:mb-1.5 [&_p:last-child]:mb-0
  [&_strong]:font-bold [&_strong]:text-foreground
  [&_em]:italic
  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2
  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2
  [&_li]:text-[12px] [&_li]:text-foreground/80 [&_li]:mb-1 [&_li]:leading-[1.5]
  [&_li_p]:mb-0
  [&_hr]:border-border/40 [&_hr]:my-3
`;

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
}

function MaterialConteudo({ materialId }: { materialId: string }) {
  const { data: conteudoJson, isLoading } = usePaginaConteudo(materialId);

  const html = useMemo(() => {
    if (!conteudoJson) return "";
    try {
      return generateHTML(conteudoJson, getRichExtensions());
    } catch {
      return "";
    }
  }, [conteudoJson]);

  async function handleCopiar() {
    if (!html) return;
    await navigator.clipboard.writeText(stripHtml(html));
    toast.success("Texto copiado.");
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs py-4 justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={SIDEBAR_PROSE + " break-words"} dangerouslySetInnerHTML={{ __html: html }} />
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-md text-[11px] gap-1.5"
        onClick={handleCopiar}
      >
        <Copy className="h-3 w-3" /> Copiar texto
      </Button>
    </div>
  );
}

export function MaterialsSidebar({ onClose }: MaterialsSidebarProps) {
  const { data: materiaisTodos = [], isLoading } = usePaginasAtendimento();
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");

  const contagemPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materiaisTodos) map.set(m.categoria ?? "outro", (map.get(m.categoria ?? "outro") ?? 0) + 1);
    return map;
  }, [materiaisTodos]);

  const materiais = useMemo(() => {
    return materiaisTodos.filter((m) => {
      const matchCategoria = filtroCategoria === "todos" || (m.categoria ?? "outro") === filtroCategoria;
      const matchBusca = !busca.trim() || m.titulo.toLowerCase().includes(busca.trim().toLowerCase());
      return matchCategoria && matchBusca;
    });
  }, [materiaisTodos, filtroCategoria, busca]);

  return (
    <div className="h-full flex flex-col bg-background w-full flex-shrink-0">
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2 text-sm text-foreground">
            <FileText className="h-4 w-4 text-primary" /> Materiais
          </h3>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar material..." className="pl-8 h-8 text-xs bg-muted/30" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {materiaisTodos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFiltroCategoria("todos")}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap",
                filtroCategoria === "todos" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              Todos ({materiaisTodos.length})
            </button>
            {MATERIAL_CATEGORIAS.map((cat) => {
              const count = contagemPorCategoria.get(cat.value) ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat.value}
                  onClick={() => setFiltroCategoria(cat.value)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap",
                    filtroCategoria === cat.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs">Carregando...</span>
          </div>
        ) : materiaisTodos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-3">
            <div className="p-2.5 rounded-xl bg-muted/40 mb-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Nenhum material ainda</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Em Notas, abra uma página e clique em "Adicionar à conversa" pra ela aparecer aqui.</p>
          </div>
        ) : materiais.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-3">
            <p className="text-xs font-medium text-muted-foreground">Nenhum material encontrado</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-1.5">
            {materiais.map((m) => (
              <AccordionItem key={m.id} value={m.id} className="border rounded-lg border-border/60 px-2.5">
                <AccordionTrigger className="hover:no-underline py-2 text-left">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-medium text-xs leading-tight line-clamp-2 break-words">{m.titulo}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">{materialCategoriaLabel(m.categoria)}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <MaterialConteudo materialId={m.id} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
