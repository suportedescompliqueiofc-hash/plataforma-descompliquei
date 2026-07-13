import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import { useAthosMateriais, type MeuMaterialListItem } from "@/hooks/useAthosMateriais";
import { getRichExtensions, EDITOR_STYLES, PROSE_STYLES, RichToolbar } from "@/components/editor/RichEditor";
import { MATERIAL_CATEGORIAS, materialCategoriaLabel, type MaterialCategoria } from "@/lib/materiaisComerciais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Sparkles, Plus, Loader2, Trash2, FolderOpen, Search, Eye, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";

type Draft = { id: string | null; titulo: string; categoria: MaterialCategoria };
const EMPTY: Draft = { id: null, titulo: "", categoria: "outro" };

export default function AthosMateriais() {
  const navigate = useNavigate();
  const { list, getConteudo, create, update, remove } = useAthosMateriais();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [conteudoInicial, setConteudoInicial] = useState("");
  const [loadingConteudo, setLoadingConteudo] = useState(false);
  const [mode, setMode] = useState<"previa" | "editar">("previa");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");

  const editor = useEditor({
    extensions: getRichExtensions(),
    content: "",
    editorProps: { attributes: { class: "min-h-[280px] px-4 py-3" } },
  });

  useEffect(() => {
    if (!open || !editor || loadingConteudo) return;
    editor.commands.setContent(conteudoInicial || "<p></p>");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadingConteudo, conteudoInicial, editor]);

  const materiaisTodos = list.data ?? [];

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

  async function openMaterial(m: MeuMaterialListItem) {
    setDraft({ id: m.id, titulo: m.titulo, categoria: (m.categoria as MaterialCategoria) ?? "outro" });
    setConteudoInicial("");
    setMode("previa"); // material existente abre em leitura, como o cliente vê
    setOpen(true);
    setLoadingConteudo(true);
    try {
      const conteudo = await getConteudo(m.id);
      setConteudoInicial(conteudo);
    } catch {
      toast.error("Erro ao carregar o conteúdo.");
    } finally {
      setLoadingConteudo(false);
    }
  }

  function openNew() {
    setDraft(EMPTY);
    setConteudoInicial("");
    setMode("editar"); // material novo já abre no editor
    setOpen(true);
  }

  async function handleSave() {
    if (!draft.titulo.trim()) { toast.error("Dê um título ao material."); return; }
    const conteudo = editor?.getHTML() ?? "";
    if (draft.id) {
      await update.mutateAsync({ id: draft.id, titulo: draft.titulo, conteudo, categoria: draft.categoria });
      toast.success("Material salvo.");
    } else {
      await create.mutateAsync({ titulo: draft.titulo, conteudo, categoria: draft.categoria });
      toast.success("Material criado.");
    }
    setOpen(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await remove.mutateAsync(deleteId);
    toast.success("Material excluído.");
    setDeleteId(null);
    setOpen(false);
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-12">
      {/* HEADER */}
      <PageHero
        dataTutorial="materiais-header"
        icon={FileText}
        title="Materiais"
        subtitle="Suas ferramentas comerciais, construídas com o Athos ou por você."
        right={
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={openNew} className="h-9 rounded-lg text-xs font-medium gap-1.5 bg-white/10 hover:bg-white/15 text-white border-white/15 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> Novo material
            </Button>
            <Button
              onClick={() => navigate("/plataforma/athos-gs?acao=criar-material")}
              className="h-9 rounded-lg text-xs font-semibold bg-white text-[#1a0e06] hover:bg-white/90 px-5 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> Criar com o Athos
            </Button>
          </div>
        }
      />

      {materiaisTodos.length > 0 && (
        <div className="space-y-3">
          {/* BUSCA */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título..."
              className="h-9 pl-9 text-sm rounded-lg border-border/60"
            />
          </div>

          {/* PILLS DE CATEGORIA */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFiltroCategoria("todos")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
                filtroCategoria === "todos"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
                    "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
                    filtroCategoria === cat.value
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LISTA */}
      {list.isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Carregando...</span>
        </div>
      ) : materiaisTodos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum material ainda</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 max-w-xs">
            Peça ao Athos para construir uma oferta, um script ou um processo comercial — ele salva aqui.
          </p>
          <Button
            onClick={() => navigate("/plataforma/athos-gs?acao=criar-material")}
            className="mt-4 h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" /> Criar com o Athos
          </Button>
        </div>
      ) : materiais.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">Nenhum material encontrado</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Ajuste a busca ou a categoria selecionada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materiais.map((m) => (
            <button
              key={m.id}
              onClick={() => openMaterial(m)}
              className="text-left rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden hover:bg-muted/20 transition-colors group"
            >
              <div className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded">
                    {materialCategoriaLabel(m.categoria)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{m.titulo}</p>
                <p className="text-[11px] text-muted-foreground/50">
                  Atualizado {format(parseISO(m.updated_at), "dd 'de' MMM", { locale: ptBR })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* DIALOG VER/EDITAR/CRIAR */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">{draft.id ? "Editar material" : "Novo material"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</label>
                <Input
                  className="h-10 text-sm rounded-lg border-border/60"
                  value={draft.titulo}
                  onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
                  placeholder="Ex: Oferta âncora — Consulta de avaliação"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</label>
                <Select value={draft.categoria} onValueChange={(v) => setDraft((d) => ({ ...d, categoria: v as MaterialCategoria }))}>
                  <SelectTrigger className="h-10 w-[200px] text-sm rounded-lg border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIAS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo</label>
                {!loadingConteudo && (
                  <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
                    <button
                      type="button" onClick={() => { if (editor) setConteudoInicial(editor.getHTML()); setMode("previa"); }}
                      className={cn("h-6 px-2 inline-flex items-center gap-1 rounded text-[10px] font-semibold transition-colors",
                        mode === "previa" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      <Eye className="h-3 w-3" /> Prévia
                    </button>
                    <button
                      type="button" onClick={() => setMode("editar")}
                      className={cn("h-6 px-2 inline-flex items-center gap-1 rounded text-[10px] font-semibold transition-colors",
                        mode === "editar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  </div>
                )}
              </div>
              {loadingConteudo ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando conteúdo...
                </div>
              ) : mode === "previa" ? (
                <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
                  <div className="px-4 py-3 max-h-[52vh] overflow-y-auto">
                    {conteudoInicial.replace(/<[^>]*>/g, "").trim()
                      ? <div className={PROSE_STYLES} dangerouslySetInnerHTML={{ __html: conteudoInicial }} />
                      : <p className="text-[12px] text-muted-foreground/40 italic">Este material ainda está vazio. Clique em Editar para escrever.</p>}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <div className="border-b border-border/40 bg-muted/[0.03]">
                    <RichToolbar editor={editor} compact />
                  </div>
                  <div className={EDITOR_STYLES}>
                    <EditorContent editor={editor} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {draft.id && (
              <Button
                variant="ghost"
                className="h-9 rounded-lg text-xs text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 mr-auto gap-1.5"
                onClick={() => setDeleteId(draft.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            )}
            <Button variant="outline" className="h-9 rounded-lg text-xs border-border/60" onClick={() => setOpen(false)}>Fechar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || loadingConteudo}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAR EXCLUSÃO */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-display">
              <Trash2 className="h-5 w-5" /> Excluir material
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Esta ação é irreversível. Confirma a exclusão?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              onClick={handleDelete}
              disabled={remove.isPending}
              className="h-9 rounded-lg text-xs font-semibold gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              {remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
