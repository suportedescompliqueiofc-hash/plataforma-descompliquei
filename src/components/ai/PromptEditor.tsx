import { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PromptEditor({ value, onChange, disabled, placeholder }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lineCount, setLineCount] = useState(1);

  // Sincroniza a rolagem e conta linhas
  const handleScroll = () => {
    const textarea = textareaRef.current;
    const lineNumbers = document.getElementById('line-numbers');
    if (textarea && lineNumbers) {
      lineNumbers.scrollTop = textarea.scrollTop;
    }
  };

  const updateLineCount = (text: string) => {
    const lines = text.split('\n').length;
    setLineCount(Math.max(lines, 1)); // Mínimo de 1 linha
  };

  useEffect(() => {
    updateLineCount(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateLineCount(e.target.value);
  };

  // Suporte básico para Tab
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);
      
      // Recoloca o cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  return (
    <div className="flex h-full min-h-[500px] border rounded-md overflow-hidden bg-background font-mono text-sm leading-6">
      {/* Coluna de Números de Linha */}
      <div 
        id="line-numbers"
        className="bg-muted/50 border-r text-muted-foreground w-12 text-right py-4 px-2 select-none overflow-hidden tabular-nums"
      >
        {Array.from({ length: lineCount }).map((_, i) => (
          <div key={i} className="h-6 leading-6">{i + 1}</div>
        ))}
      </div>

      {/* Área de Texto */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "flex-1 w-full h-full p-4 resize-none outline-none bg-background text-foreground leading-6 whitespace-pre-wrap",
          "focus:ring-0 border-0"
        )}
        spellCheck={false}
        placeholder={placeholder ?? "# Digite o prompt do sistema aqui..."}
      />
    </div>
  );
}
