import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Baseline, ChevronDown, Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CORES_TEXTO } from "@/components/editor/RichEditor";

// Barra flutuante estilo Notion que aparece ao selecionar texto no editor de
// blocos das Notas. Mesma técnica de posicionamento do AthosInlineToolbar
// (sem @tiptap/extension-bubble-menu): editor.view.coordsAtPos na seleção.
export function SelectionToolbar({ editor }: { editor: Editor | null }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [corOpen, setCorOpen] = useState(false);
  const corRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const shownRef = useRef(false);

  // Atraso curto antes de aparecer (padrão Notion/Medium): a barra só surge um
  // instante depois que a seleção "assenta". Ao desmarcar, some na hora. Uma vez
  // visível, acompanha a seleção sem atraso (não reintroduz o delay).
  const SHOW_DELAY = 450;

  useEffect(() => {
    if (!editor) return;
    const computePos = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return null;
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const left = Math.max(8, Math.min(start.left, end.left));
      let top = Math.min(start.top, end.top) - 46;
      if (top < 8) top = Math.max(start.bottom, end.bottom) + 8;
      return { top, left };
    };
    const update = () => {
      if (editor.state.selection.empty) {
        if (showTimer.current) clearTimeout(showTimer.current);
        shownRef.current = false;
        setPos(null);
        setCorOpen(false);
        return;
      }
      if (shownRef.current) {
        // Já visível: acompanha a seleção imediatamente.
        const p = computePos();
        if (p) setPos(p);
        return;
      }
      // Ainda não visível: agenda a aparição após o atraso. Cada mudança de
      // seleção reinicia o timer, então a barra surge quando o usuário para.
      if (showTimer.current) clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => {
        const p = computePos();
        if (p) { shownRef.current = true; setPos(p); setCorOpen(false); }
      }, SHOW_DELAY);
    };
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("selectionUpdate", update);
      if (showTimer.current) clearTimeout(showTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (corRef.current && !corRef.current.contains(e.target as Node)) setCorOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (!editor || !editor.isEditable || !pos) return null;

  const corAtiva = editor.getAttributes("textStyle")?.color as string | undefined;

  return (
    <div
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      className="z-50 flex items-center gap-0.5 rounded-xl border border-border/60 bg-popover shadow-lg px-1 py-1"
    >
      {/* Marcas */}
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        title="Negrito"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("bold") && "bg-foreground/10 text-foreground"
        )}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        title="Itálico"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("italic") && "bg-foreground/10 text-foreground"
        )}
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
        title="Tachado"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("strike") && "bg-foreground/10 text-foreground"
        )}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
        title="Código"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("code") && "bg-foreground/10 text-foreground"
        )}
      >
        <Code className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 mx-0.5 bg-border/60" />

      {/* Blocos */}
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
        title="Título 1"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("heading", { level: 1 }) && "bg-foreground/10 text-foreground"
        )}
      >
        <Heading1 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
        title="Título 2"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("heading", { level: 2 }) && "bg-foreground/10 text-foreground"
        )}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
        title="Título 3"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("heading", { level: 3 }) && "bg-foreground/10 text-foreground"
        )}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
        title="Lista"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("bulletList") && "bg-foreground/10 text-foreground"
        )}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
        title="Lista numerada"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("orderedList") && "bg-foreground/10 text-foreground"
        )}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
        title="Citação"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
          editor.isActive("blockquote") && "bg-foreground/10 text-foreground"
        )}
      >
        <Quote className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 mx-0.5 bg-border/60" />

      {/* Cor */}
      <div ref={corRef} className="relative">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setCorOpen(v => !v); }}
          title="Cor do texto"
          className={cn(
            "flex items-center gap-0.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
            corOpen && "bg-foreground/10 text-foreground"
          )}
        >
          <Baseline className="h-3.5 w-3.5" style={corAtiva ? { color: corAtiva } : undefined} />
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>

        {corOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border border-border/60 bg-popover shadow-lg p-2.5 w-[168px]">
            <div className="grid grid-cols-5 gap-1.5">
              {CORES_TEXTO.map(c => (
                <button
                  key={c.nome}
                  type="button"
                  title={c.nome}
                  onMouseDown={e => {
                    e.preventDefault();
                    if (c.valor) editor.chain().focus().setColor(c.valor).run();
                    else editor.chain().focus().unsetColor().run();
                    setCorOpen(false);
                  }}
                  className={cn(
                    "h-5 w-5 rounded-full border border-black/10 flex items-center justify-center transition-shadow",
                    corAtiva === c.valor
                      ? "ring-2 ring-foreground"
                      : "hover:ring-2 hover:ring-foreground/20",
                    !c.valor && "bg-muted"
                  )}
                  style={c.valor ? { backgroundColor: c.valor } : undefined}
                >
                  {!c.valor && <Ban className="h-3 w-3 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
