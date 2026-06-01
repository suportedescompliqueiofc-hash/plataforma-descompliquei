import { useState } from "react";
import { Plus, X, Check, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTags, useLeadTags, TAG_COLORS, getTagColorStyles } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

interface TagManagerProps {
  leadId: string;
  /** When true, tags display in a single row with overflow hidden (for compact headers) */
  compact?: boolean;
}

export function TagManager({ leadId, compact = false }: TagManagerProps) {
  const { availableTags, createTag } = useTags();
  const { leadTags, addTagToLead, removeTagFromLead } = useLeadTags(leadId);
  
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0].hex); // Inicia com o hex do primeiro preset
  const [customHex, setCustomHex] = useState("");

  const assignedTagIds = new Set(leadTags.map(t => t.id));

  const handleSelectTag = (tagId: string) => {
    if (assignedTagIds.has(tagId)) {
      removeTagFromLead.mutate(tagId);
    } else {
      addTagToLead.mutate(tagId);
    }
  };

  const handleCreateTag = () => {
    if (!searchValue.trim()) return;
    
    // Usa o hex customizado se houver, senão usa a cor selecionada
    const colorToSave = customHex && /^#[0-9A-F]{6}$/i.test(customHex) ? customHex : selectedColor;

    setIsCreating(true);
    createTag.mutate(
      { name: searchValue.trim(), color: colorToSave },
      {
        onSuccess: (newTag) => {
          if (newTag) {
            addTagToLead.mutate(newTag.id);
          }
          setSearchValue("");
          setCustomHex("");
          setIsCreating(false);
        },
        onSettled: () => setIsCreating(false)
      }
    );
  };

  // In compact mode, show only first tag (truncated) + overflow count
  const visibleTags = compact ? leadTags.slice(0, 1) : leadTags;
  const hiddenCount = compact ? leadTags.length - 1 : 0;

  return (
    <div className={cn(
      "flex items-center gap-1 max-w-full",
      compact ? "flex-nowrap" : "flex-wrap gap-1.5"
    )}>
      {visibleTags.map(tag => {
        const styles = getTagColorStyles(tag.color);
        return (
          <Badge
            key={tag.id}
            variant="outline"
            className={cn(
              "font-normal transition-all shrink-0",
              compact
                ? "max-w-[140px] text-[10px] h-5 px-1.5 gap-0.5 pr-1"
                : "gap-1 pr-1 max-w-[200px]",
              styles.className
            )}
            style={styles.style}
          >
            <span className="truncate">{tag.name}</span>
            {!compact && (
              <button
                onClick={() => removeTagFromLead.mutate(tag.id)}
                className="hover:bg-black/10 rounded-full p-0.5 ml-0.5 transition-colors shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {compact && (
              <button
                onClick={() => removeTagFromLead.mutate(tag.id)}
                className="hover:bg-black/10 rounded-full p-px transition-colors shrink-0"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </Badge>
        );
      })}

      {hiddenCount > 0 && (
        <span className="text-[10px] font-medium text-muted-foreground/60 shrink-0">
          +{hiddenCount}
        </span>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {compact ? (
            <button className="flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40 transition-colors shrink-0">
              <Plus className="h-2.5 w-2.5" />
            </button>
          ) : (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground border border-dashed hover:border-solid gap-1 rounded-full hover:bg-muted">
              <Plus className="h-3 w-3" />
              Etiqueta
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[260px]" align="start">
          <Command>
            <CommandInput 
              placeholder="Buscar ou criar..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty className="p-2">
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">Nenhuma etiqueta encontrada.</p>
                  {searchValue && (
                    <div className="space-y-3 pt-2 border-t">
                      <p className="text-xs font-medium">Criar "{searchValue}"</p>
                      
                      {/* Seletor de Cores Presets */}
                      <div className="flex flex-wrap gap-1.5">
                        {TAG_COLORS.map(color => (
                          <button
                            key={color.name}
                            onClick={() => {
                              setSelectedColor(color.hex);
                              setCustomHex(""); // Limpa hex customizado ao selecionar preset
                            }}
                            className={cn(
                              "w-5 h-5 rounded-full border flex items-center justify-center transition-transform hover:scale-110",
                              color.selector,
                              (selectedColor === color.hex && !customHex) ? "ring-2 ring-offset-1 ring-primary" : ""
                            )}
                            title={color.label}
                          >
                            {(selectedColor === color.hex && !customHex) && <Check className="h-3 w-3 text-white" />}
                          </button>
                        ))}
                      </div>

                      {/* Input Hex Customizado */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Hash className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input 
                            placeholder="Hex (ex: #9568CF)" 
                            value={customHex}
                            onChange={(e) => {
                              setCustomHex(e.target.value);
                              // Se for um hex válido, atualiza o preview
                              if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                                setSelectedColor(e.target.value);
                              }
                            }}
                            className="h-7 text-xs pl-6"
                            maxLength={7}
                          />
                        </div>
                        <div 
                          className="w-7 h-7 rounded border flex-shrink-0"
                          style={{ backgroundColor: customHex && /^#[0-9A-F]{6}$/i.test(customHex) ? customHex : selectedColor }}
                        />
                      </div>

                      <Button 
                        size="sm" 
                        className="w-full h-7 text-xs mt-1" 
                        onClick={handleCreateTag}
                        disabled={isCreating}
                      >
                        {isCreating ? 'Criando...' : 'Criar e Adicionar'}
                      </Button>
                    </div>
                  )}
                </div>
              </CommandEmpty>
              
              <CommandGroup heading="Disponíveis">
                {availableTags.map(tag => {
                  const isSelected = assignedTagIds.has(tag.id);
                  const styles = getTagColorStyles(tag.color);
                  
                  return (
                    <CommandItem 
                      key={tag.id} 
                      value={tag.name}
                      onSelect={() => handleSelectTag(tag.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className={cn("w-2 h-2 rounded-full border", tag.color.startsWith('#') ? "" : TAG_COLORS.find(c => c.name === tag.color)?.selector)}
                          style={{ backgroundColor: tag.color.startsWith('#') ? tag.color : undefined }}
                        />
                        <span>{tag.name}</span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}