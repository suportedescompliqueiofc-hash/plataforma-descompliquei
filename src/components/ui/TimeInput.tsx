import { useRef, useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeInputProps {
  hora: string;
  minuto: string;
  onChange: (hora: string, minuto: string) => void;
  className?: string;
}

/**
 * Input de horário com máscara HH:MM.
 * - Digita livremente, o ":" é inserido automaticamente após 2 dígitos de hora.
 * - No blur, normaliza e valida o valor.
 * - Aceita também seta ↑↓ para incrementar hora/minuto conforme cursor.
 */
export function TimeInput({ hora, minuto, onChange, className }: TimeInputProps) {
  const [raw, setRaw] = useState(`${hora}:${minuto}`);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza de fora para dentro quando hora/minuto mudam externamente
  useEffect(() => {
    setRaw(`${hora}:${minuto}`);
  }, [hora, minuto]);

  function parse(value: string): { h: string; m: string } | null {
    const clean = value.replace(/[^\d]/g, '');
    if (clean.length < 3) return null;
    const h = clean.slice(0, 2);
    const m = clean.slice(2, 4).padEnd(2, '0');
    const hNum = parseInt(h, 10);
    const mNum = parseInt(m, 10);
    if (hNum > 23 || mNum > 59) return null;
    return { h: String(hNum).padStart(2, '0'), m: String(mNum).padStart(2, '0') };
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value;
    // Remove tudo que não é dígito ou ':'
    const digits = val.replace(/\D/g, '');
    if (digits.length === 0) { setRaw(''); return; }

    // Auto-insere ':' após 2 dígitos de hora
    let formatted = digits.slice(0, 2);
    if (digits.length >= 3) formatted += ':' + digits.slice(2, 4);

    // Clamp hora
    const h = parseInt(digits.slice(0, 2), 10);
    if (h > 23) formatted = '23' + (digits.length >= 3 ? ':' + digits.slice(2, 4) : '');

    // Clamp minuto
    if (digits.length >= 4) {
      const m = parseInt(digits.slice(2, 4), 10);
      if (m > 59) formatted = digits.slice(0, 2) + ':59';
    }

    setRaw(formatted);

    // Aplica imediatamente se tiver HH:MM completo
    if (formatted.length === 5) {
      const hh = formatted.slice(0, 2);
      const mm = formatted.slice(3, 5);
      onChange(hh, mm);
    }
  }

  function handleBlur() {
    const result = parse(raw);
    if (result) {
      setRaw(`${result.h}:${result.m}`);
      onChange(result.h, result.m);
    } else {
      // Volta para o valor anterior válido
      setRaw(`${hora}:${minuto}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const cursor = inputRef.current?.selectionStart ?? 0;
    const isHourSide = cursor <= 2;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      const hNum = parseInt(hora, 10);
      const mNum = parseInt(minuto, 10);
      if (isHourSide) {
        const newH = String(((hNum + delta + 24) % 24)).padStart(2, '0');
        onChange(newH, minuto);
      } else {
        const newM = String(((mNum + delta + 60) % 60)).padStart(2, '0');
        onChange(hora, newM);
      }
    }
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={raw}
        placeholder="00:00"
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={5}
        className={cn(
          'h-10 w-[72px] rounded-lg border border-border/60 bg-background px-3 text-sm tabular-nums',
          'text-center font-medium text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
          'transition-colors',
        )}
      />
    </div>
  );
}
