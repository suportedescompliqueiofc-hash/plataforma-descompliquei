import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Code2,
  ExternalLink,
  FolderOpen,
  Folder,
  Loader2,
  Maximize2,
} from "lucide-react";

type CompFolder = {
  id: string;
  nome: string;
  parent_id: string | null;
  ordem_index: number;
  ativo: boolean;
};

type CompMaterial = {
  id: string;
  folder_id: string;
  titulo: string;
  tipo: "pdf" | "html";
  pdf_url: string | null;
  ordem_index: number;
  // conteudo_html é carregado sob demanda (não vem na query inicial)
};

const db = supabase as any;

export default function MateriaisComplementares() {
  const [folders, setFolders] = useState<CompFolder[]>([]);
  const [materials, setMaterials] = useState<CompMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [htmlMaterial, setHtmlMaterial] = useState<CompMaterial | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: fols }, { data: mats }] = await Promise.all([
        db
          .from("platform_complementary_folders")
          .select("id, nome, parent_id, ordem_index, ativo")
          .eq("ativo", true)
          .order("ordem_index", { ascending: true }),
        db
          .from("platform_complementary_materials")
          // conteudo_html excluído — carregado sob demanda ao abrir
          .select("id, folder_id, titulo, tipo, pdf_url, ordem_index")
          .eq("ativo", true)
          .order("ordem_index", { ascending: true }),
      ]);
      setFolders(fols || []);
      setMaterials(mats || []);
      setLoading(false);
    }
    void load();
  }, []);

  async function openHtmlMaterial(material: CompMaterial) {
    setHtmlMaterial(material);
    setHtmlContent(null);
    setHtmlLoading(true);
    const { data } = await db
      .from("platform_complementary_materials")
      .select("conteudo_html")
      .eq("id", material.id)
      .single();
    setHtmlContent(data?.conteudo_html ?? "");
    setHtmlLoading(false);
  }

  function closeHtmlMaterial() {
    setHtmlMaterial(null);
    setHtmlContent(null);
  }

  function toggleFolder(id: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const rootFolders = folders
    .filter((f) => !f.parent_id)
    .sort((a, b) => a.ordem_index - b.ordem_index);

  function getSubfolders(parentId: string) {
    return folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.ordem_index - b.ordem_index);
  }

  function getFolderMaterials(folderId: string) {
    return materials
      .filter((m) => m.folder_id === folderId)
      .sort((a, b) => a.ordem_index - b.ordem_index);
  }

  function countFolderItems(folderId: string): number {
    const direct = getFolderMaterials(folderId).length;
    const sub = getSubfolders(folderId).reduce(
      (acc, sf) => acc + getFolderMaterials(sf.id).length,
      0
    );
    return direct + sub;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (rootFolders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Nenhum material disponível
        </p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
          Os materiais complementares serão publicados em breve.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground mb-4">
        {materials.length}{" "}
        {materials.length === 1 ? "material disponível" : "materiais disponíveis"}
      </p>

      {rootFolders.map((folder) => {
        const isOpen = openFolders.has(folder.id);
        const subfolders = getSubfolders(folder.id);
        const folderMats = getFolderMaterials(folder.id);
        const total = countFolderItems(folder.id);

        return (
          <div key={folder.id}>
            {/* Root folder header */}
            <button
              onClick={() => toggleFolder(folder.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border/60 bg-card hover:bg-muted/20 transition-colors mb-2 text-left"
            >
              <div className="p-1.5 rounded-lg bg-muted shrink-0">
                {isOpen ? (
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground font-display">
                {folder.nome}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {total} {total === 1 ? "item" : "itens"}
              </span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {/* Root folder contents */}
            {isOpen && (
              <div className="space-y-2 mb-4 pl-4">
                {/* Direct materials */}
                {folderMats.map((material) => {
                  const isPdf = material.tipo === "pdf";
                  return (
                    <div
                      key={material.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        {isPdf ? (
                          <FileText className="h-4 w-4 text-red-500" />
                        ) : (
                          <Code2 className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {material.titulo}
                        </p>
                        <p className="text-[11px] text-muted-foreground uppercase">
                          {isPdf ? "PDF" : "HTML"}
                        </p>
                      </div>
                      {isPdf && material.pdf_url ? (
                        <button
                          onClick={() => window.open(material.pdf_url!, "_blank")}
                          className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5 shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </button>
                      ) : (
                        <button
                          onClick={() => openHtmlMaterial(material)}
                          className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 shrink-0"
                        >
                          Ver Material
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Subfolders */}
                {subfolders.map((sf) => {
                  const sfOpen = openFolders.has(sf.id);
                  const sfMats = getFolderMaterials(sf.id);
                  return (
                    <div key={sf.id}>
                      <button
                        onClick={() => toggleFolder(sf.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors mb-1.5 text-left"
                      >
                        <div className="p-1.5 rounded-lg bg-muted shrink-0">
                          {sfOpen ? (
                            <FolderOpen className="h-3 w-3 text-muted-foreground/70" />
                          ) : (
                            <Folder className="h-3 w-3 text-muted-foreground/70" />
                          )}
                        </div>
                        <span className="flex-1 text-[13px] font-medium text-foreground/80 font-display">
                          {sf.nome}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {sfMats.length} {sfMats.length === 1 ? "item" : "itens"}
                        </span>
                        {sfOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {sfOpen && (
                        <div className="space-y-2 mb-2 pl-4">
                          {sfMats.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground/50 px-4 py-3">
                              Pasta vazia
                            </p>
                          ) : (
                            sfMats.map((material) => {
                              const isPdf = material.tipo === "pdf";
                              return (
                                <div
                                  key={material.id}
                                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                                >
                                  <div className="p-2 rounded-lg bg-muted shrink-0">
                                    {isPdf ? (
                                      <FileText className="h-4 w-4 text-red-500" />
                                    ) : (
                                      <Code2 className="h-4 w-4 text-blue-500" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {material.titulo}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground uppercase">
                                      {isPdf ? "PDF" : "HTML"}
                                    </p>
                                  </div>
                                  {isPdf && material.pdf_url ? (
                                    <button
                                      onClick={() =>
                                        window.open(material.pdf_url!, "_blank")
                                      }
                                      className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5 shrink-0"
                                    >
                                      <ExternalLink className="h-3 w-3" /> Abrir
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openHtmlMaterial(material)}
                                      className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 shrink-0"
                                    >
                                      Ver Material
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {folderMats.length === 0 && subfolders.length === 0 && (
                  <p className="text-[12px] text-muted-foreground/50 px-4 py-3">
                    Pasta vazia
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Dialog HTML viewer — iframe para isolamento total de estilos */}
      <Dialog open={!!htmlMaterial} onOpenChange={closeHtmlMaterial}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden gap-0" style={{ height: '90vh' }}>
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-4 pr-8">
              <DialogTitle className="font-display">{htmlMaterial?.titulo}</DialogTitle>
              <button
                onClick={() => {
                  if (!htmlContent) return;
                  const blob = new Blob([htmlContent], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }}
                disabled={!htmlContent}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold border border-border/60 hover:bg-muted flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-40"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Tela cheia
              </button>
            </div>
          </DialogHeader>

          {htmlLoading ? (
            <div className="flex-1 flex items-center justify-center" style={{ height: 'calc(90vh - 73px)' }}>
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            </div>
          ) : htmlContent ? (
            <iframe
              srcDoc={htmlContent}
              title={htmlMaterial?.titulo}
              className="w-full flex-1 border-0"
              style={{ height: 'calc(90vh - 73px)' }}
              sandbox="allow-same-origin allow-scripts"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
