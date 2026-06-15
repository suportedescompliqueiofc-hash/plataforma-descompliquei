import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Minus, Undo2, Redo2,
  Table as TableIcon, Plus, Trash2, ChevronDown,
  Quote, Terminal,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TB({
  onClick, active = false, disabled = false, title, children, dark = false,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean;
  title: string; children: React.ReactNode; dark?: boolean;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded-md transition-colors text-[13px]',
        dark
          ? active
            ? 'bg-white/[0.14] text-white'
            : 'text-white/35 hover:text-white/70 hover:bg-white/[0.06]'
          : active
            ? 'bg-foreground/10 text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        'disabled:opacity-25 disabled:cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

function Divider({ dark = false }: { dark?: boolean }) {
  return <div className={cn('w-px h-4 mx-0.5 shrink-0', dark ? 'bg-white/[0.12]' : 'bg-border/60')} />;
}

// ─── Table dropdown ───────────────────────────────────────────────────────────

function TableMenu({ editor, dark = false }: { editor: Editor; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inTable = editor.isActive('table');

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const actions = inTable ? [
    { label: 'Inserir coluna antes', action: () => editor.chain().focus().addColumnBefore().run() },
    { label: 'Inserir coluna depois', action: () => editor.chain().focus().addColumnAfter().run() },
    { label: 'Excluir coluna', action: () => editor.chain().focus().deleteColumn().run(), danger: true },
    null,
    { label: 'Inserir linha antes', action: () => editor.chain().focus().addRowBefore().run() },
    { label: 'Inserir linha depois', action: () => editor.chain().focus().addRowAfter().run() },
    { label: 'Excluir linha', action: () => editor.chain().focus().deleteRow().run(), danger: true },
    null,
    { label: 'Excluir tabela', action: () => editor.chain().focus().deleteTable().run(), danger: true },
  ] : [
    { label: 'Inserir tabela 3×3', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: 'Inserir tabela 2×2', action: () => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run() },
    { label: 'Inserir tabela 4×4', action: () => editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run() },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onMouseDown={e => { e.preventDefault(); setOpen(v => !v); }}
        title="Tabela"
        className={cn(
          'flex items-center gap-0.5 p-1.5 rounded-md transition-colors',
          dark
            ? inTable ? 'bg-white/[0.14] text-white' : 'text-white/35 hover:text-white/70 hover:bg-white/[0.06]'
            : inTable ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        )}
      >
        <TableIcon className="h-3.5 w-3.5" />
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border border-border/60 bg-popover shadow-lg py-1 min-w-[180px]">
          {actions.map((a, i) =>
            a === null ? (
              <div key={i} className="my-1 h-px bg-border/40 mx-2" />
            ) : (
              <button
                key={a.label}
                onMouseDown={e => { e.preventDefault(); a.action(); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-[12px] transition-colors',
                  a.danger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-foreground/80 hover:bg-muted/60'
                )}
              >
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Editor styles shared ─────────────────────────────────────────────────────

export const EDITOR_STYLES = `
  [&_.ProseMirror]:outline-none
  [&_.ProseMirror_h1]:text-[22px] [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-foreground [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:leading-snug [&_.ProseMirror_h1:first-child]:mt-0
  [&_.ProseMirror_h2]:text-[18px] [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-foreground [&_.ProseMirror_h2]:mb-1.5 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2:first-child]:mt-0
  [&_.ProseMirror_h3]:text-[15px] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-foreground/80 [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3:first-child]:mt-0
  [&_.ProseMirror_p]:text-[14px] [&_.ProseMirror_p]:text-foreground/80 [&_.ProseMirror_p]:leading-[1.8] [&_.ProseMirror_p]:mb-1
  [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_strong]:text-foreground
  [&_.ProseMirror_em]:italic
  [&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-muted-foreground
  [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-2
  [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-2
  [&_.ProseMirror_li]:text-[14px] [&_.ProseMirror_li]:text-foreground/80 [&_.ProseMirror_li]:mb-0.5 [&_.ProseMirror_li]:leading-[1.7]
  [&_.ProseMirror_hr]:border-border/40 [&_.ProseMirror_hr]:my-5
  [&_.ProseMirror_blockquote]:border-l-[3px] [&_.ProseMirror_blockquote]:border-foreground/20 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_blockquote]:italic
  [&_.ProseMirror_code]:bg-muted/60 [&_.ProseMirror_code]:text-[13px] [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded-md [&_.ProseMirror_code]:text-foreground/90 [&_.ProseMirror_code]:border [&_.ProseMirror_code]:border-border/40
  [&_.ProseMirror_pre]:bg-[hsl(220,13%,13%)] [&_.ProseMirror_pre]:text-[hsl(220,14%,82%)] [&_.ProseMirror_pre]:rounded-xl [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto
  [&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:border-0 [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre_code]:text-[13px] [&_.ProseMirror_pre_code]:font-mono [&_.ProseMirror_pre_code]:text-[hsl(220,14%,82%)]
  [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-4 [&_.ProseMirror_table]:rounded-xl [&_.ProseMirror_table]:overflow-hidden
  [&_.ProseMirror_th]:bg-muted/40 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border/60 [&_.ProseMirror_th]:px-3 [&_.ProseMirror_th]:py-2 [&_.ProseMirror_th]:text-[12px] [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:text-foreground [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:uppercase [&_.ProseMirror_th]:tracking-wider
  [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border/60 [&_.ProseMirror_td]:px-3 [&_.ProseMirror_td]:py-2 [&_.ProseMirror_td]:text-[13px] [&_.ProseMirror_td]:text-foreground/80 [&_.ProseMirror_td]:align-top [&_.ProseMirror_td_p]:mb-0
  [&_.ProseMirror_.selectedCell]:bg-primary/10
`;

// ─── Extensions ───────────────────────────────────────────────────────────────

export function getRichExtensions() {
  return [
    StarterKit,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

export function RichToolbar({ editor, compact = false, dark = false }: { editor: Editor | null; compact?: boolean; dark?: boolean }) {
  if (!editor) return null;

  return (
    <div className={cn(
      'flex items-center gap-0.5 flex-wrap',
      compact ? 'px-3 py-2' : 'px-4 py-2.5'
    )}>
      <TB dark={dark} title="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="h-3.5 w-3.5" />
      </TB>

      <Divider dark={dark} />

      <TB dark={dark} title="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-3.5 w-3.5" />
      </TB>

      <Divider dark={dark} />

      <TB dark={dark} title="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Código inline" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-3.5 w-3.5" />
      </TB>

      <Divider dark={dark} />

      <TB dark={dark} title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </TB>
      <TB dark={dark} title="Bloco de código" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Terminal className="h-3.5 w-3.5" />
      </TB>

      <Divider dark={dark} />

      <TableMenu editor={editor} dark={dark} />

      <Divider dark={dark} />

      <TB dark={dark} title="Separador" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-3.5 w-3.5" />
      </TB>
    </div>
  );
}
