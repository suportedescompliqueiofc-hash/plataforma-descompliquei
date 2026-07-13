import { useRef, useState } from 'react';
import { Bold, Italic, Heading2, List, ListOrdered, Quote, Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormattedText } from '@/components/FormattedText';

// Editor de markdown leve: barra de ferramentas que aplica sintaxe na seleção +
// prévia renderizada com o MESMO FormattedText que o cliente vê. Mantém o
// conteúdo em markdown (paridade total com o que o Athos gera e o cliente lê).

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

type Wrap = { before: string; after: string };
type LinePrefix = { prefix: string; ordered?: boolean };

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 120, className }: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'escrever' | 'previa'>('escrever');

  function applyToSelection(fn: (sel: string, full: string, start: number, end: number) => { text: string; selStart: number; selEnd: number }) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const sel = value.slice(start, end);
    const { text, selStart, selEnd } = fn(sel, value, start, end);
    onChange(text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function wrap({ before, after }: Wrap) {
    applyToSelection((sel, full, start, end) => {
      const inner = sel || 'texto';
      const text = full.slice(0, start) + before + inner + after + full.slice(end);
      return { text, selStart: start + before.length, selEnd: start + before.length + inner.length };
    });
  }

  function linePrefix({ prefix, ordered }: LinePrefix) {
    applyToSelection((sel, full, start, end) => {
      // Expande a seleção para linhas inteiras
      const lineStart = full.lastIndexOf('\n', start - 1) + 1;
      const lineEndRaw = full.indexOf('\n', end);
      const lineEnd = lineEndRaw === -1 ? full.length : lineEndRaw;
      const block = full.slice(lineStart, lineEnd) || 'item';
      const lines = block.split('\n');
      const out = lines.map((l, i) => `${ordered ? `${i + 1}. ` : prefix}${l.replace(/^(\s*([-*>]|\d+\.)\s+)/, '')}`).join('\n');
      const text = full.slice(0, lineStart) + out + full.slice(lineEnd);
      return { text, selStart: lineStart, selEnd: lineStart + out.length };
    });
  }

  const btn = 'h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors';

  return (
    <div className={cn('rounded-lg border border-border/60 bg-background overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border/40 bg-muted/[0.03]">
        <button type="button" title="Negrito" className={btn} onClick={() => wrap({ before: '**', after: '**' })}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" title="Itálico" className={btn} onClick={() => wrap({ before: '*', after: '*' })}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" title="Subtítulo" className={btn} onClick={() => linePrefix({ prefix: '## ' })}><Heading2 className="h-3.5 w-3.5" /></button>
        <span className="w-px h-4 bg-border/50 mx-1" />
        <button type="button" title="Lista" className={btn} onClick={() => linePrefix({ prefix: '- ' })}><List className="h-3.5 w-3.5" /></button>
        <button type="button" title="Lista numerada" className={btn} onClick={() => linePrefix({ prefix: '', ordered: true })}><ListOrdered className="h-3.5 w-3.5" /></button>
        <button type="button" title="Citação" className={btn} onClick={() => linePrefix({ prefix: '> ' })}><Quote className="h-3.5 w-3.5" /></button>
        <div className="ml-auto flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
          <button type="button" onClick={() => setTab('escrever')}
            className={cn('h-6 px-2 inline-flex items-center gap-1 rounded text-[10px] font-semibold transition-colors', tab === 'escrever' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Pencil className="h-3 w-3" /> Escrever
          </button>
          <button type="button" onClick={() => setTab('previa')}
            className={cn('h-6 px-2 inline-flex items-center gap-1 rounded text-[10px] font-semibold transition-colors', tab === 'previa' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Eye className="h-3 w-3" /> Prévia
          </button>
        </div>
      </div>

      {tab === 'escrever' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="w-full resize-y bg-transparent px-3.5 py-3 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none font-body"
        />
      ) : (
        <div className="px-3.5 py-3 overflow-auto" style={{ minHeight }}>
          {value.trim()
            ? <FormattedText content={value} />
            : <p className="text-[12px] text-muted-foreground/40 italic">Nada para pré-visualizar ainda.</p>}
        </div>
      )}
    </div>
  );
}
