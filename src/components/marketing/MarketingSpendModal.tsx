import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/CurrencyInput";

interface MarketingSpendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { amount: number; date: Date; description: string }) => void;
}

export function MarketingSpendModal({ open, onOpenChange, onSave }: MarketingSpendModalProps) {
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date) return;
    onSave({ amount, date, description });
    onOpenChange(false);
    setAmount(undefined);
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display">Registrar Investimento</DialogTitle>
          <DialogDescription>
            Adicione valores investidos em marketing (Google Ads, Influencers, etc.) para compor o cálculo do CAC.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Valor Investido</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <CurrencyInput 
                id="amount" 
                value={amount} 
                onValueChange={setAmount}
                className="pl-9"
                placeholder="R$ 0,00"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Data do Investimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Descrição (Opcional)</Label>
            <Input 
              id="desc" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Ex: Google Ads Pesquisa" 
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!amount}>Salvar Registro</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}