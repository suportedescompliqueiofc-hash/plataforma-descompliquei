import { ReactNode } from 'react';

/** Converts **bold** markers to <strong> tags */
function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * Renders rich-formatted text used across tutoriais e atualizações:
 * - **bold** → <strong>
 * - \n → line breaks / paragraph splits
 * - Lines starting with • or - → bullet list items
 */
export function renderRichText(text: string): ReactNode[] {
  // Normaliza sequências literais "\n" (barra + n, texto vindo de um INSERT SQL
  // sem quebra de linha real) para quebras de linha de verdade antes de dividir.
  const paragraphs = text.replace(/\\n/g, '\n').split('\n');
  const elements: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="space-y-1 pl-0.5">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-1.5 items-start">
            <span className="text-foreground/40 mt-px select-none">•</span>
            <span>{formatInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of paragraphs) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      bulletBuffer.push(trimmed.replace(/^[•\-]\s*/, ''));
    } else {
      flushBullets();
      elements.push(<p key={`p-${elements.length}`}>{formatInline(trimmed)}</p>);
    }
  }
  flushBullets();
  return elements;
}
