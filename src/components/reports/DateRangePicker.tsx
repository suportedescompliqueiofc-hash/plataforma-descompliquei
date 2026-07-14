import * as React from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, startOfYear, endOfYear, addDays, subDays, addWeeks, subWeeks, addMonths, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  hideQuickSelect?: boolean;
  placeholder?: string;
}

export function DateRangePicker({ className, date, setDate, hideQuickSelect = false, placeholder }: DateRangePickerProps) {
  const [activePeriod, setActivePeriod] = React.useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month');

  React.useEffect(() => {
    if (!date?.from || !date?.to) {
      setActivePeriod('custom');
      return;
    }
    
    if (isSameDay(date.from, date.to)) {
      setActivePeriod('day');
    } else if (isSameDay(date.from, startOfWeek(date.from, { locale: ptBR })) && isSameDay(date.to, endOfWeek(date.from, { locale: ptBR }))) {
      setActivePeriod('week');
    } else if (isSameDay(date.from, startOfMonth(date.from)) && isSameDay(date.to, endOfMonth(date.from))) {
      setActivePeriod('month');
    } else if (isSameDay(date.from, startOfYear(date.from)) && isSameDay(date.to, endOfYear(date.from))) {
      setActivePeriod('year');
    } else {
      setActivePeriod('custom');
    }
  }, [date]);

  const handleQuickSelect = (range: 'day' | 'week' | 'month' | 'year') => {
    const today = new Date();
    let newRange: DateRange;
    switch (range) {
      case 'day':
        newRange = { from: today, to: today };
        break;
      case 'week':
        newRange = { from: startOfWeek(today, { locale: ptBR }), to: endOfWeek(today, { locale: ptBR }) };
        break;
      case 'month':
        newRange = { from: startOfMonth(today), to: endOfMonth(today) };
        break;
      case 'year':
        newRange = { from: startOfYear(today), to: endOfYear(today) };
        break;
    }
    setDate(newRange);
    setActivePeriod(range);
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!date?.from || activePeriod === 'custom') return;

    const amount = direction === 'prev' ? -1 : 1;
    let newFromDate: Date;
    let newRange: DateRange;

    switch (activePeriod) {
      case 'day':
        newFromDate = addDays(date.from, amount);
        newRange = { from: newFromDate, to: newFromDate };
        break;
      case 'week':
        newFromDate = addWeeks(date.from, amount);
        newRange = { from: startOfWeek(newFromDate, { locale: ptBR }), to: endOfWeek(newFromDate, { locale: ptBR }) };
        break;
      case 'month':
        newFromDate = addMonths(date.from, amount);
        newRange = { from: startOfMonth(newFromDate), to: endOfMonth(newFromDate) };
        break;
      case 'year':
        newFromDate = addYears(date.from, amount);
        newRange = { from: startOfYear(newFromDate), to: endOfYear(newFromDate) };
        break;
      default:
        return;
    }
    setDate(newRange);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      {!hideQuickSelect && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleNavigate('prev')} disabled={activePeriod === 'custom'}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <ToggleGroup 
            type="single" 
            value={activePeriod} 
            onValueChange={(value) => {
              if (value) {
                handleQuickSelect(value as 'day' | 'week' | 'month' | 'year');
              }
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="day" aria-label="Dia">Dia</ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Semana">Semana</ToggleGroupItem>
            <ToggleGroupItem value="month" aria-label="Mês">Mês</ToggleGroupItem>
            <ToggleGroupItem value="year" aria-label="Ano">Ano</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleNavigate('next')} disabled={activePeriod === 'custom'}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left text-sm font-medium",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              <span>
                {date.to ? (
                  <>
                    {format(date.from, "LLL dd, y", { locale: ptBR })} -{" "}
                    {format(date.to, "LLL dd, y", { locale: ptBR })}
                  </>
                ) : (
                  format(date.from, "LLL dd, y", { locale: ptBR })
                )}
              </span>
            ) : (
              <span>{placeholder || "Período Personalizado"}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(newDate) => {
              // react-day-picker retorna { from: date, to: undefined } quando o usuário
              // clica duas vezes na mesma data — normaliza para range de 1 dia
              if (newDate?.from && !newDate?.to) {
                setDate({ from: newDate.from, to: newDate.from });
              } else {
                setDate(newDate);
              }
              setActivePeriod('custom');
            }}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}