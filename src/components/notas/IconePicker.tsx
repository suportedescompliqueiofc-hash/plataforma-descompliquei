import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ICONE_CATEGORIAS, ICONES_MAP } from "@/lib/notasIcones";

interface IconePickerProps {
  value: string | null;
  onSelect: (nome: string) => void;
  onClear?: () => void;
}

export function IconePicker({ value, onSelect, onClear }: IconePickerProps) {
  const [busca, setBusca] = useState("");

  const categoriasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ICONE_CATEGORIAS;

    return ICONE_CATEGORIAS.map((categoria) => ({
      ...categoria,
      icones: categoria.icones.filter((nome) => nome.toLowerCase().includes(termo)),
    })).filter((categoria) => categoria.icones.length > 0);
  }, [busca]);

  const semResultados = categoriasFiltradas.length === 0;

  return (
    <div className="w-72 sm:w-80">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar ícone..."
          className="h-8 pl-8 text-[13px] rounded-lg border-border/60"
        />
      </div>

      <div className="max-h-80 overflow-y-auto pr-0.5 space-y-3">
        {semResultados ? (
          <div className="py-6 text-center text-[12px] text-muted-foreground/60">
            Nenhum ícone encontrado.
          </div>
        ) : (
          categoriasFiltradas.map((categoria) => (
            <div key={categoria.id}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5 px-0.5">
                {categoria.label}
              </p>
              <div className="grid grid-cols-6 gap-1">
                {categoria.icones.map((nome) => {
                  const Icone = ICONES_MAP[nome];
                  if (!Icone) return null;
                  const ativo = value === nome;
                  return (
                    <button
                      key={nome}
                      type="button"
                      title={nome}
                      onClick={() => onSelect(nome)}
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                        ativo ? "bg-foreground text-background" : "hover:bg-muted text-foreground"
                      )}
                    >
                      <Icone className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {onClear && value && (
        <div className="pt-2 mt-1 border-t border-border/40">
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Remover ícone
          </button>
        </div>
      )}
    </div>
  );
}
