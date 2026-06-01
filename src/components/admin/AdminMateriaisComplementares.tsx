import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Code2,
  Edit3,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Plus,
  Trash,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  conteudo_html: string | null;
  ordem_index: number;
  ativo: boolean;
};

const db = supabase as any;

const EMPTY_FOLDER_FORM = {
  nome: "",
  parent_id: null as string | null,
  ativo: true,
};

const EMPTY_MATERIAL_FORM = {
  titulo: "",
  tipo: "pdf" as "pdf" | "html",
  pdf_url: "",
  conteudo_html: "",
  ativo: true,
};

export default function AdminMateriaisComplementares({
  toast,
}: {
  toast: (opts: any) => void;
}) {
  const [folders, setFolders] = useState<CompFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<CompMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderForm, setFolderForm] = useState<
    typeof EMPTY_FOLDER_FORM & { id?: string }
  >(EMPTY_FOLDER_FORM);
  const [savingFolder, setSavingFolder] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<CompFolder | null>(null);

  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState<
    typeof EMPTY_MATERIAL_FORM & { id?: string }
  >(EMPTY_MATERIAL_FORM);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteMaterialTarget, setDeleteMaterialTarget] = useState<CompMaterial | null>(null);

  useEffect(() => {
    void loadFolders();
  }, []);

  useEffect(() => {
    if (selectedFolderId) void loadMaterials(selectedFolderId);
    else setMaterials([]);
  }, [selectedFolderId]);

  async function loadFolders() {
    setLoading(true);
    const { data, error } = await db
      .from("platform_complementary_folders")
      .select("*")
      .order("ordem_index", { ascending: true });
    if (error)
      toast({
        title: "Erro ao carregar pastas",
        description: error.message,
        variant: "destructive",
      });
    setFolders(data || []);
    setLoading(false);
  }

  async function loadMaterials(folderId: string) {
    const { data, error } = await db
      .from("platform_complementary_materials")
      .select("*")
      .eq("folder_id", folderId)
      .order("ordem_index", { ascending: true });
    if (error)
      toast({
        title: "Erro ao carregar materiais",
        description: error.message,
        variant: "destructive",
      });
    setMaterials(data || []);
  }

  // ── Folders ──────────────────────────────────────────

  function openCreateFolder(parentId?: string | null) {
    setFolderForm({ ...EMPTY_FOLDER_FORM, parent_id: parentId ?? null });
    setFolderModalOpen(true);
  }

  function openEditFolder(folder: CompFolder) {
    setFolderForm({
      id: folder.id,
      nome: folder.nome,
      parent_id: folder.parent_id,
      ativo: folder.ativo,
    });
    setFolderModalOpen(true);
  }

  async function saveFolder() {
    if (!folderForm.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSavingFolder(true);
    try {
      if (folderForm.id) {
        const { error } = await db
          .from("platform_complementary_folders")
          .update({
            nome: folderForm.nome.trim(),
            parent_id: folderForm.parent_id,
            ativo: folderForm.ativo,
          })
          .eq("id", folderForm.id);
        if (error) throw error;
        toast({ title: "Pasta atualizada" });
      } else {
        const siblings = folders.filter(
          (f) => f.parent_id === folderForm.parent_id
        );
        const nextOrder = siblings.length + 1;
        const { error } = await db
          .from("platform_complementary_folders")
          .insert({
            nome: folderForm.nome.trim(),
            parent_id: folderForm.parent_id,
            ordem_index: nextOrder,
            ativo: true,
          });
        if (error) throw error;
        toast({ title: "Pasta criada" });
      }
      setFolderModalOpen(false);
      await loadFolders();
    } catch (err: any) {
      toast({
        title: "Erro ao salvar pasta",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingFolder(false);
    }
  }

  async function deleteFolder() {
    if (!deleteFolderTarget) return;
    try {
      const { error } = await db
        .from("platform_complementary_folders")
        .delete()
        .eq("id", deleteFolderTarget.id);
      if (error) throw error;
      if (selectedFolderId === deleteFolderTarget.id)
        setSelectedFolderId(null);
      toast({ title: "Pasta excluída" });
      setDeleteFolderTarget(null);
      await loadFolders();
    } catch (err: any) {
      toast({
        title: "Erro ao excluir pasta",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function moveFolderOrder(folder: CompFolder, direction: "up" | "down") {
    const siblings = folders
      .filter((f) => f.parent_id === folder.parent_id)
      .sort((a, b) => a.ordem_index - b.ordem_index);
    const idx = siblings.findIndex((f) => f.id === folder.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const swap = siblings[swapIdx];
    await Promise.all([
      db
        .from("platform_complementary_folders")
        .update({ ordem_index: swap.ordem_index })
        .eq("id", folder.id),
      db
        .from("platform_complementary_folders")
        .update({ ordem_index: folder.ordem_index })
        .eq("id", swap.id),
    ]);
    await loadFolders();
  }

  // ── Materials ─────────────────────────────────────────

  function openCreateMaterial() {
    setMaterialForm(EMPTY_MATERIAL_FORM);
    setMaterialModalOpen(true);
  }

  function openEditMaterial(material: CompMaterial) {
    setMaterialForm({
      id: material.id,
      titulo: material.titulo,
      tipo: material.tipo,
      pdf_url: material.pdf_url || "",
      conteudo_html: material.conteudo_html || "",
      ativo: material.ativo,
    });
    setMaterialModalOpen(true);
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Apenas PDFs são aceitos", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
      const { data, error } = await supabase.storage
        .from("platform-complementary")
        .upload(path, file, { contentType: "application/pdf" });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("platform-complementary")
        .getPublicUrl(data.path);
      setMaterialForm((prev) => ({ ...prev, pdf_url: urlData.publicUrl }));
      toast({ title: "PDF enviado com sucesso" });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar PDF",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function saveMaterial() {
    if (!materialForm.titulo.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    if (materialForm.tipo === "pdf" && !materialForm.pdf_url) {
      toast({ title: "Faça o upload do PDF primeiro", variant: "destructive" });
      return;
    }
    if (materialForm.tipo === "html" && !materialForm.conteudo_html.trim()) {
      toast({ title: "Conteúdo HTML obrigatório", variant: "destructive" });
      return;
    }
    setSavingMaterial(true);
    try {
      const payload = {
        titulo: materialForm.titulo.trim(),
        tipo: materialForm.tipo,
        pdf_url: materialForm.tipo === "pdf" ? materialForm.pdf_url || null : null,
        conteudo_html:
          materialForm.tipo === "html"
            ? materialForm.conteudo_html || null
            : null,
        ativo: materialForm.ativo,
      };
      if (materialForm.id) {
        const { error } = await db
          .from("platform_complementary_materials")
          .update(payload)
          .eq("id", materialForm.id);
        if (error) throw error;
        toast({ title: "Material atualizado" });
      } else {
        const nextOrder = materials.length + 1;
        const { error } = await db
          .from("platform_complementary_materials")
          .insert({ ...payload, folder_id: selectedFolderId, ordem_index: nextOrder });
        if (error) throw error;
        toast({ title: "Material criado" });
      }
      setMaterialModalOpen(false);
      if (selectedFolderId) await loadMaterials(selectedFolderId);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar material",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingMaterial(false);
    }
  }

  async function deleteMaterial() {
    if (!deleteMaterialTarget) return;
    try {
      const { error } = await db
        .from("platform_complementary_materials")
        .delete()
        .eq("id", deleteMaterialTarget.id);
      if (error) throw error;
      toast({ title: "Material excluído" });
      setDeleteMaterialTarget(null);
      if (selectedFolderId) await loadMaterials(selectedFolderId);
    } catch (err: any) {
      toast({
        title: "Erro ao excluir material",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function moveMaterialOrder(
    material: CompMaterial,
    direction: "up" | "down"
  ) {
    const sorted = [...materials].sort((a, b) => a.ordem_index - b.ordem_index);
    const idx = sorted.findIndex((m) => m.id === material.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    await Promise.all([
      db
        .from("platform_complementary_materials")
        .update({ ordem_index: swap.ordem_index })
        .eq("id", material.id),
      db
        .from("platform_complementary_materials")
        .update({ ordem_index: material.ordem_index })
        .eq("id", swap.id),
    ]);
    if (selectedFolderId) await loadMaterials(selectedFolderId);
  }

  // ── Helpers ───────────────────────────────────────────

  const rootFolders = folders
    .filter((f) => !f.parent_id)
    .sort((a, b) => a.ordem_index - b.ordem_index);

  function getSubfolders(parentId: string) {
    return folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.ordem_index - b.ordem_index);
  }

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // ── Render ─────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-[280px_1fr] gap-6 min-h-[600px]">
        {/* ── Left: Folder tree ── */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  PASTAS
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {folders.length} {folders.length === 1 ? "pasta" : "pastas"}
                </p>
              </div>
            </div>
            <button
              onClick={() => openCreateFolder(null)}
              className="h-7 w-7 rounded-lg flex items-center justify-center bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {loading ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted/30 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : rootFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhuma pasta
                </p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  Crie uma pasta para começar
                </p>
              </div>
            ) : (
              rootFolders.map((folder, idx) => {
                const subfolders = getSubfolders(folder.id);
                const isExpanded = expandedFolders.has(folder.id);
                const isSelected = selectedFolderId === folder.id;

                return (
                  <div key={folder.id}>
                    {/* Root folder row */}
                    <div
                      className={cn(
                        "group flex items-center gap-1.5 px-2 py-2 rounded-xl transition-colors",
                        isSelected && !subfolders.length
                          ? "bg-foreground/[0.08]"
                          : "hover:bg-muted/40"
                      )}
                    >
                      {/* Expand toggle */}
                      {subfolders.length > 0 ? (
                        <button
                          onClick={() =>
                            setExpandedFolders((prev) => {
                              const next = new Set(prev);
                              next.has(folder.id)
                                ? next.delete(folder.id)
                                : next.add(folder.id);
                              return next;
                            })
                          }
                          className="shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      ) : (
                        <div className="w-5 shrink-0" />
                      )}

                      {/* Folder button */}
                      <button
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          if (subfolders.length) {
                            setExpandedFolders((prev) => {
                              const next = new Set(prev);
                              next.add(folder.id);
                              return next;
                            });
                          }
                        }}
                      >
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate text-foreground">
                          {folder.nome}
                        </span>
                        {!folder.ativo && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1 shrink-0"
                          >
                            Inativo
                          </Badge>
                        )}
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => moveFolderOrder(folder, "up")}
                          disabled={idx === 0}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-20"
                        >
                          <ArrowUp className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => moveFolderOrder(folder, "down")}
                          disabled={idx === rootFolders.length - 1}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-20"
                        >
                          <ArrowDown className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => openCreateFolder(folder.id)}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                          title="Adicionar subpasta"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => openEditFolder(folder)}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                        >
                          <Edit3 className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => setDeleteFolderTarget(folder)}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-red-100 text-red-500"
                        >
                          <Trash className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subfolders */}
                    {isExpanded &&
                      subfolders.map((sf, sfIdx) => (
                        <div
                          key={sf.id}
                          className={cn(
                            "group flex items-center gap-1.5 px-2 py-2 ml-5 rounded-xl transition-colors",
                            selectedFolderId === sf.id
                              ? "bg-foreground/[0.08]"
                              : "hover:bg-muted/40"
                          )}
                        >
                          <div className="w-5 shrink-0" />
                          <button
                            className="flex-1 flex items-center gap-2 text-left min-w-0"
                            onClick={() => setSelectedFolderId(sf.id)}
                          >
                            <Folder className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span className="text-[13px] truncate text-muted-foreground">
                              {sf.nome}
                            </span>
                            {!sf.ativo && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] h-4 px-1 shrink-0"
                              >
                                Inativo
                              </Badge>
                            )}
                          </button>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => moveFolderOrder(sf, "up")}
                              disabled={sfIdx === 0}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-20"
                            >
                              <ArrowUp className="h-2.5 w-2.5" />
                            </button>
                            <button
                              onClick={() => moveFolderOrder(sf, "down")}
                              disabled={sfIdx === subfolders.length - 1}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-20"
                            >
                              <ArrowDown className="h-2.5 w-2.5" />
                            </button>
                            <button
                              onClick={() => openEditFolder(sf)}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                            >
                              <Edit3 className="h-2.5 w-2.5" />
                            </button>
                            <button
                              onClick={() => setDeleteFolderTarget(sf)}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-red-100 text-red-500"
                            >
                              <Trash className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Materials ── */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
          {!selectedFolder ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Selecione uma pasta
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                Clique em uma pasta para ver e gerenciar seus materiais
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {selectedFolder.nome}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {materials.length}{" "}
                      {materials.length === 1 ? "material" : "materiais"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={openCreateMaterial}
                  className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Material
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {materials.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <FileText className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum material
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                      Adicione PDFs ou conteúdo HTML nesta pasta
                    </p>
                  </div>
                ) : (
                  materials.map((material, idx) => (
                    <div
                      key={material.id}
                      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-background hover:bg-muted/20 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        {material.tipo === "pdf" ? (
                          <FileText className="h-4 w-4 text-red-500" />
                        ) : (
                          <Code2 className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {material.titulo}
                        </p>
                        <p className="text-[11px] text-muted-foreground uppercase">
                          {material.tipo}
                        </p>
                      </div>
                      {!material.ativo && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Inativo
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => moveMaterialOrder(material, "up")}
                          disabled={idx === 0}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveMaterialOrder(material, "down")}
                          disabled={idx === materials.length - 1}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openEditMaterial(material)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteMaterialTarget(material)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Folder Modal ── */}
      <Dialog open={folderModalOpen} onOpenChange={setFolderModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {folderForm.id ? "Editar Pasta" : "Nova Pasta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nome
              </Label>
              <Input
                value={folderForm.nome}
                onChange={(e) =>
                  setFolderForm((prev) => ({ ...prev, nome: e.target.value }))
                }
                placeholder="Ex: Módulo 1 — Fundação"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pasta pai
              </Label>
              <Select
                value={folderForm.parent_id || "none"}
                onValueChange={(v) =>
                  setFolderForm((prev) => ({
                    ...prev,
                    parent_id: v === "none" ? null : v,
                  }))
                }
              >
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                  <SelectValue placeholder="Pasta raiz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pasta raiz (sem pai)</SelectItem>
                  {rootFolders
                    .filter((f) => f.id !== folderForm.id)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={folderForm.ativo}
                onCheckedChange={(v) =>
                  setFolderForm((prev) => ({ ...prev, ativo: v }))
                }
              />
              <Label className="text-sm">Pasta ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setFolderModalOpen(false)}
              className="h-9 px-4 rounded-lg text-xs font-semibold border border-border/60 hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={saveFolder}
              disabled={savingFolder}
              className="h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {savingFolder && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Material Modal ── */}
      <Dialog open={materialModalOpen} onOpenChange={setMaterialModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {materialForm.id ? "Editar Material" : "Novo Material"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Título
              </Label>
              <Input
                value={materialForm.titulo}
                onChange={(e) =>
                  setMaterialForm((prev) => ({ ...prev, titulo: e.target.value }))
                }
                placeholder="Ex: Guia de Posicionamento"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo
              </Label>
              <Select
                value={materialForm.tipo}
                onValueChange={(v) =>
                  setMaterialForm((prev) => ({
                    ...prev,
                    tipo: v as "pdf" | "html",
                  }))
                }
              >
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {materialForm.tipo === "pdf" ? (
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Arquivo PDF
                </Label>
                {materialForm.pdf_url ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-sm text-emerald-700 truncate flex-1">
                      PDF enviado com sucesso
                    </span>
                    <button
                      onClick={() =>
                        setMaterialForm((prev) => ({ ...prev, pdf_url: "" }))
                      }
                      className="text-[11px] text-red-500 hover:underline shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Clique para enviar o PDF
                        </p>
                        <p className="text-[11px] text-muted-foreground/50">
                          Máx. 50 MB
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={handlePdfUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conteúdo HTML
                </Label>
                <Textarea
                  value={materialForm.conteudo_html}
                  onChange={(e) =>
                    setMaterialForm((prev) => ({
                      ...prev,
                      conteudo_html: e.target.value,
                    }))
                  }
                  placeholder="<h1>Título</h1><p>Conteúdo do material...</p>"
                  rows={12}
                  className="text-sm font-mono rounded-lg border-border/60 resize-none"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={materialForm.ativo}
                onCheckedChange={(v) =>
                  setMaterialForm((prev) => ({ ...prev, ativo: v }))
                }
              />
              <Label className="text-sm">Material ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setMaterialModalOpen(false)}
              className="h-9 px-4 rounded-lg text-xs font-semibold border border-border/60 hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={saveMaterial}
              disabled={savingMaterial || uploading}
              className="h-9 px-5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {savingMaterial && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Folder Confirm ── */}
      <AlertDialog
        open={!!deleteFolderTarget}
        onOpenChange={() => setDeleteFolderTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              A pasta "{deleteFolderTarget?.nome}" e todos os seus materiais
              serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Material Confirm ── */}
      <AlertDialog
        open={!!deleteMaterialTarget}
        onOpenChange={() => setDeleteMaterialTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>
              O material "{deleteMaterialTarget?.titulo}" será excluído
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteMaterial}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
