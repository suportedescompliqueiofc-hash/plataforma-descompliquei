import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Sparkles, Loader2, ChevronDown, Wand2, FileDown, PenLine, Feather } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const INLINE_MODEL = "openrouter/deepseek/deepseek-v4-flash";

type AcaoAthos = "continuar" | "resumir" | "reescrever" | "melhorar";

const ACOES: { key: AcaoAthos; label: string; Icon: React.ComponentType<any>; prompt: string; modo: "append" | "replace" }[] = [
  { key: "continuar", label: "Continuar escrevendo", Icon: Feather, modo: "append",
    prompt: "Continue o texto abaixo, no mesmo tom e estilo, com 2-4 frases naturais. Responda só com a continuação, sem repetir o texto original e sem comentários." },
  { key: "resumir", label: "Resumir", Icon: FileDown, modo: "replace",
    prompt: "Resuma o texto abaixo em poucas frases, mantendo os pontos essenciais. Responda só com o resumo, em português, sem comentários." },
  { key: "reescrever", label: "Reescrever", Icon: PenLine, modo: "replace",
    prompt: "Reescreva o texto abaixo de forma mais clara, mantendo o mesmo sentido e tamanho aproximado. Responda só com o texto reescrito, sem comentários." },
  { key: "melhorar", label: "Melhorar escrita", Icon: Wand2, modo: "replace",
    prompt: "Revise o texto abaixo: corrija gramática, melhore a fluidez e a clareza, sem mudar o sentido. Responda só com o texto revisado, sem comentários." },
];

// Toolbar flutuante ao selecionar texto — "Perguntar ao Athos" inline, estilo
// Notion AI. Sem @tiptap/extension-bubble-menu (não instalado): posiciona via
// editor.view.coordsAtPos na seleção atual.
export function AthosInlineToolbar({ editor }: { editor: Editor | null }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState<AcaoAthos | null>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || loading) { setPos(null); setMenuOpen(false); return; }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const left = Math.min(start.left, end.left);
      const top = Math.min(start.top, end.top);
      setPos({ top: top - 44, left });
    };
    editor.on("selectionUpdate", update);
    return () => { editor.off("selectionUpdate", update); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, loading]);

  if (!editor || !pos) return null;

  async function executar(acao: typeof ACOES[number]) {
    const { from, to } = editor!.state.selection;
    const texto = editor!.state.doc.textBetween(from, to, " ");
    if (!texto.trim()) return;
    setLoading(acao.key);
    setMenuOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("chat-completion", {
        body: {
          model: INLINE_MODEL,
          messages: [
            { role: "system", content: acao.prompt },
            { role: "user", content: texto },
          ],
        },
      });
      if (error) throw error;
      const resultado = data?.choices?.[0]?.message?.content?.trim();
      if (!resultado) throw new Error("Athos não retornou conteúdo.");

      if (acao.modo === "append") {
        editor!.chain().focus().setTextSelection(to).insertContent(` ${resultado}`).run();
      } else {
        editor!.chain().focus().deleteRange({ from, to }).insertContent(resultado).run();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar o Athos.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      className="z-50 flex items-center gap-1 rounded-lg border border-border/60 bg-popover shadow-lg px-1 py-1"
    >
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
          disabled={!!loading}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors",
            loading ? "text-muted-foreground" : "text-foreground hover:bg-muted"
          )}
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Sparkles className="h-3.5 w-3.5 text-primary" />}
          {loading ? ACOES.find((a) => a.key === loading)?.label : "Perguntar ao Athos"}
          {!loading && <ChevronDown className="h-3 w-3 opacity-50" />}
        </button>

        {menuOpen && !loading && (
          <div className="absolute top-full left-0 mt-1 w-52 rounded-xl border border-border/60 bg-popover shadow-lg py-1.5">
            {ACOES.map((acao) => (
              <button
                key={acao.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); executar(acao); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-left text-foreground/80 hover:bg-muted/40 transition-colors"
              >
                <acao.Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {acao.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
