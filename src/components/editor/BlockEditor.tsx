import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { getRichExtensions, EDITOR_STYLES, RichToolbar } from "@/components/editor/RichEditor";
import { SlashMenu } from "@/components/editor/SlashMenu";
import { SelectionToolbar } from "@/components/editor/SelectionToolbar";
import { cn } from "@/lib/utils";

interface BlockEditorProps {
  content: any;
  onChange: (json: any) => void;
  editable?: boolean;
  className?: string;
}

// Editor de blocos das Notas: mesma base do RichEditor (Tiptap + StarterKit +
// Table), conteúdo em JSON (não HTML) e uma camada de UI "estilo Notion" por
// cima — o menu "/" pra inserir blocos.
export function BlockEditor({ content, onChange, editable = true, className }: BlockEditorProps) {
  const editor = useEditor({
    extensions: getRichExtensions(),
    content: content ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    editorProps: {
      attributes: { class: "min-h-[400px] px-1 py-2" },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  // Troca de página: recarrega o documento sem recriar a instância do editor.
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(content ?? { type: "doc", content: [{ type: "paragraph" }] });
    if (current !== next) editor.commands.setContent(content ?? { type: "doc", content: [{ type: "paragraph" }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  // Sem card: no Notion o editor é a própria página, não um widget com borda/
  // sombra por cima dela. A toolbar leva só uma linha fina embaixo, pra
  // separar visualmente sem virar uma caixa fechada.
  return (
    <div className={cn("w-full", className)}>
      {editable && (
        <div className="mb-3 border-b border-border/40">
          <RichToolbar editor={editor} compact />
        </div>
      )}
      <div className={cn(EDITOR_STYLES, "pb-24")}>
        <EditorContent editor={editor} />
      </div>
      {editable && (
        <>
          <SlashMenu editor={editor} />
          <SelectionToolbar editor={editor} />
        </>
      )}
    </div>
  );
}
