"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { cn } from '@/lib/utils';
import { CheckSquare, Square } from 'lucide-react';

interface FormattedTextProps {
  content: string;
  className?: string;
}

/**
 * Pré-processa o conteúdo para transformar padrões do materialFormatting
 * em markdown GFM válido que o ReactMarkdown consegue renderizar.
 */
function preprocessContent(raw: string): string {
  const lines = raw.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Converte `[x] Texto` e `[ ] Texto` em GFM task list items
    if (/^\[x\]\s+/.test(trimmed)) {
      result.push(`- [x] ${trimmed.slice(trimmed.indexOf(']') + 2)}`);
      continue;
    }
    if (/^\[ \]\s+/.test(trimmed)) {
      result.push(`- [ ] ${trimmed.slice(trimmed.indexOf(']') + 2)}`);
      continue;
    }

    // Linhas que são labels soltas (sem # e sem - ) antes de sub-itens → tornam-se ## heading
    // Mas só se não for já um heading, item de lista, ou linha vazia
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('[') &&
      !trimmed.includes(':') &&
      trimmed.length < 80
    ) {
      // Verifica se a próxima linha é um sub-item ou lista
      const idx = lines.indexOf(line);
      const nextLine = lines[idx + 1]?.trim() || '';
      if (nextLine.startsWith('-') || nextLine.startsWith('[')) {
        result.push(`\n### ${trimmed}`);
        continue;
      }
    }

    result.push(line);
  }

  return result.join('\n');
}

export function FormattedText({ content, className }: FormattedTextProps) {
  if (!content) return null;

  // Limpeza de caracteres de escape literais (\n) que podem vir do banco/IA
  const cleanContent = preprocessContent(content.replace(/\\n/g, '\n'));

  return (
    <div className={cn(
      "prose prose-sm dark:prose-invert max-w-none",
      // Headings
      "prose-h1:text-lg prose-h1:font-bold prose-h1:font-display prose-h1:text-foreground prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h1:mb-4",
      "prose-h2:text-base prose-h2:font-semibold prose-h2:font-display prose-h2:text-foreground prose-h2:mt-5 prose-h2:mb-2",
      "prose-h3:text-[13px] prose-h3:font-semibold prose-h3:text-foreground prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:uppercase prose-h3:tracking-[0.04em]",
      // Body
      "prose-p:leading-relaxed prose-p:text-foreground/85 prose-p:mb-2 prose-p:last:mb-0",
      "prose-strong:font-semibold prose-strong:text-foreground",
      // Lists
      "prose-ul:my-2 prose-ul:space-y-1 prose-ol:my-2 prose-ol:space-y-1",
      "prose-li:text-foreground/85 prose-li:leading-relaxed",
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <h1>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3>{children}</h3>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children, className: ulClass }) => (
            <ul className={cn(
              ulClass?.includes('contains-task-list') ? 'list-none pl-0 space-y-1.5' : 'list-disc pl-5 space-y-1',
              'mb-2'
            )}>{children}</ul>
          ),
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
          li: ({ children, className: liClass }) => {
            const isTask = liClass?.includes('task-list-item');
            if (isTask) {
              // Extrair se é checked pelo conteúdo
              const childArray = Array.isArray(children) ? children : [children];
              const hasChecked = childArray.some((child: any) =>
                child?.props?.checked === true
              );
              return (
                <li className="flex items-start gap-2.5 list-none text-foreground/85 py-0.5">
                  <span className="mt-0.5 shrink-0">
                    {hasChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground/50" />
                    )}
                  </span>
                  <span className={cn(hasChecked && "text-foreground/70")}>
                    {childArray.filter((child: any) => child?.type !== 'input')}
                  </span>
                </li>
              );
            }
            return <li className="text-foreground/85">{children}</li>;
          },
          input: () => null, // Remove default checkbox inputs, we use custom icons
          strong: ({ children }) => <strong>{children}</strong>,
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
}