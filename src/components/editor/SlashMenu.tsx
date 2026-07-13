import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Terminal, Table as TableIcon, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlashItem {
  key: string;
  label: string;
  Icon: React.ComponentType<any>;
  run: (editor: Editor, range: { from: number; to: number }) => void;
}

const ITEMS: SlashItem[] = [
  { key: "h1", label: "Título 1", Icon: Heading1, run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run() },
  { key: "h2", label: "Título 2", Icon: Heading2, run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run() },
  { key: "h3", label: "Título 3", Icon: Heading3, run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run() },
  { key: "bullet", label: "Lista", Icon: List, run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { key: "ordered", label: "Lista numerada", Icon: ListOrdered, run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { key: "quote", label: "Citação", Icon: Quote, run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { key: "code", label: "Bloco de código", Icon: Terminal, run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { key: "table", label: "Tabela", Icon: TableIcon, run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: "hr", label: "Separador", Icon: Minus, run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
];

// Menu "/" estilo Notion: digitar "/" no início de uma linha ou depois de um
// espaço abre a lista; digitar filtra por label; Enter/clique insere o bloco.
// Implementado sem @tiptap/suggestion (não instalado) — leitura direta do texto
// antes do cursor + coordsAtPos para posicionar o popup.
export function SlashMenu({ editor }: { editor: Editor | null }) {
  const [state, setState] = useState<{
    open: boolean; query: string; range: { from: number; to: number } | null;
    top: number; left: number; selected: number;
  }>({ open: false, query: "", range: null, top: 0, left: 0, selected: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = ITEMS.filter((i) => i.label.toLowerCase().includes(state.query.toLowerCase()));

  useEffect(() => {
    if (!editor) return;

    const detect = () => {
      const { state: es } = editor;
      const { $from } = es.selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
      const match = /(?:^|\s)\/([a-zA-ZÀ-ú0-9]*)$/.exec(textBefore);
      if (!match) {
        setState((s) => (s.open ? { ...s, open: false } : s));
        return;
      }
      const query = match[1];
      const slashPos = $from.pos - query.length - 1;
      const coords = editor.view.coordsAtPos($from.pos);
      setState({
        open: true,
        query,
        range: { from: slashPos, to: $from.pos },
        top: coords.bottom + 6,
        left: coords.left,
        selected: 0,
      });
    };

    editor.on("update", detect);
    editor.on("selectionUpdate", detect);
    return () => {
      editor.off("update", detect);
      editor.off("selectionUpdate", detect);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !state.open) return;
    const dom = editor.view.dom;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!filtered.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setState((s) => ({ ...s, selected: (s.selected + 1) % filtered.length }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setState((s) => ({ ...s, selected: (s.selected - 1 + filtered.length) % filtered.length }));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[state.selected] ?? filtered[0];
        if (item && state.range) item.run(editor, state.range);
        setState((s) => ({ ...s, open: false }));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setState((s) => ({ ...s, open: false }));
      }
    };
    dom.addEventListener("keydown", onKeyDown, true);
    return () => dom.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, state.open, state.selected, state.query]);

  if (!state.open || !editor || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", top: state.top, left: state.left }}
      className="z-50 w-56 rounded-xl border border-border/60 bg-popover shadow-lg py-1.5 max-h-72 overflow-y-auto"
    >
      {filtered.map((item, i) => (
        <button
          key={item.key}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            if (state.range) item.run(editor, state.range);
            setState((s) => ({ ...s, open: false }));
          }}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-left transition-colors",
            i === state.selected ? "bg-muted/60 text-foreground" : "text-foreground/80 hover:bg-muted/40"
          )}
        >
          <span className="p-1 rounded-md bg-muted">
            <item.Icon className="h-3 w-3 text-muted-foreground" />
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
