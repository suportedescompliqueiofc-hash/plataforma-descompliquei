import { useState, Fragment } from 'react';
import { cn } from '@/lib/utils';

const TRUNCATE_LENGTH = 120;

interface NotificationMessageProps {
  message: string;
  className?: string;
  /** Render in compact mode (inline, no sections) */
  compact?: boolean;
}

/**
 * Parses notification messages with markdown-like formatting:
 * - **bold** or *bold* → <strong>
 * - Removes emojis (🎉👤🏢📋⚡ etc.) for clean display
 * - Detects section headers like "*Nome:*", "*Ação:*"
 */
function parseFormattedContent(text: string) {
  // Remove emojis - replace with nothing for clean text
  const cleaned = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();

  // Split into lines
  const lines = cleaned.split('\n');

  const elements: Array<{ type: 'section-header' | 'text' | 'action' | 'blank'; content: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push({ type: 'blank', content: '' });
      continue;
    }

    // Detect section headers: *Label:* or **Label:** at start of line
    const headerMatch = trimmed.match(/^\*{1,2}([^*]+?):?\*{1,2}\s*$/);
    if (headerMatch) {
      elements.push({ type: 'section-header', content: headerMatch[1].trim() });
      continue;
    }

    // Detect action lines: *Ação:* content
    const actionMatch = trimmed.match(/^\*{1,2}Ação:?\*{1,2}\s*(.+)$/i);
    if (actionMatch) {
      elements.push({ type: 'action', content: actionMatch[1].trim() });
      continue;
    }

    elements.push({ type: 'text', content: trimmed });
  }

  return elements;
}

/** Renders inline bold markers within text */
function renderInlineBold(text: string) {
  // Split by **text** or *text* patterns
  const parts = text.split(/(\*{1,2}[^*]+?\*{1,2})/g);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*{1,2}([^*]+?)\*{1,2}$/);
    if (boldMatch) {
      return <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function NotificationMessage({ message, className, compact = false }: NotificationMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // For compact mode, just show truncated plain text with inline bold
  if (compact) {
    const cleaned = message.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();
    const isLong = cleaned.length > TRUNCATE_LENGTH;
    const displayText = isLong && !isExpanded ? `${cleaned.substring(0, TRUNCATE_LENGTH)}...` : cleaned;

    return (
      <div className={className}>
        <p className="text-[13px] leading-relaxed">{renderInlineBold(displayText)}</p>
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
          >
            {isExpanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>
    );
  }

  // Rich mode: parse sections
  const elements = parseFormattedContent(message);
  const isLong = message.length > 250;
  const shouldTruncate = isLong && !isExpanded;

  return (
    <div className={cn("space-y-1.5", className)}>
      {elements.map((el, i) => {
        // If truncating and past the first few meaningful elements
        if (shouldTruncate && i > 3) return null;

        switch (el.type) {
          case 'section-header':
            return (
              <p key={i} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-2 first:mt-0">
                {el.content}
              </p>
            );
          case 'action':
            return (
              <div key={i} className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50/50 border border-amber-100/60">
                <span className="text-[13px] leading-relaxed text-amber-800">
                  {renderInlineBold(el.content)}
                </span>
              </div>
            );
          case 'blank':
            return <div key={i} className="h-1" />;
          default:
            return (
              <p key={i} className="text-[13px] leading-relaxed text-foreground/80">
                {renderInlineBold(el.content)}
              </p>
            );
        }
      })}

      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground mt-1 transition-colors"
        >
          {isExpanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  );
}
