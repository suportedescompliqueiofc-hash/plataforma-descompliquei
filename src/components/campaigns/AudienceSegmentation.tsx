import { useState, useEffect, useMemo } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeads } from '@/hooks/useLeads';
import { subDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { DateRangeFilter } from './DateRangeFilter';

interface AudienceSegmentationProps {
  onConfigChange: (config: any) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  initialSelectedIds?: string[];
}

export function AudienceSegmentation({ onConfigChange, onSelectionChange, initialSelectedIds = [] }: AudienceSegmentationProps) {
  const { leads, isLoading: leadsLoading } = useLeads();

  const [segmentType, setSegmentType] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState({
    lastContact: '',
    gender: 'Todos',
    ageRange: 'Todos',
    registrationDateRange: undefined as DateRange | undefined,
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set(initialSelectedIds));
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Lógica de Filtragem Principal
  const filteredLeads = useMemo(() => {
    if (leadsLoading || !leads) return [];

    let filtered = [...leads];

    if (segmentType === 'advanced') {
      const { lastContact, gender, ageRange, registrationDateRange } = advancedFilters;

      filtered = leads.filter(lead => {
        // Filtro: Último contato
        if (lastContact && lead.ultimo_contato) {
          const days = parseInt(lastContact);
          if (!isNaN(days) && isBefore(new Date(lead.ultimo_contato), subDays(new Date(), days))) return false;
        }
        // Filtro: Gênero
        if (gender !== 'Todos' && lead.genero !== gender) return false;

        // Filtro: Faixa Etária
        if (ageRange !== 'Todos') {
          const [min, max] = ageRange.split('-').map(Number);
          if (!lead.idade || lead.idade < min || lead.idade > max) return false;
        }

        // Filtro: Data de Cadastro
        if (registrationDateRange?.from) {
          const leadCreatedDate = startOfDay(new Date(lead.criado_em));
          const filterStart = startOfDay(registrationDateRange.from);
          
          const filterEnd = registrationDateRange.to 
            ? endOfDay(registrationDateRange.to) 
            : endOfDay(registrationDateRange.from);
          
          if (isBefore(leadCreatedDate, filterStart) || isAfter(leadCreatedDate, filterEnd)) {
            return false;
          }
        }

        return true;
      });
    }

    // Aplica a pesquisa de texto APENAS no modo 'all'
    if (segmentType === 'all' && searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => 
        (lead.nome && lead.nome.toLowerCase().includes(term)) ||
        lead.telefone.includes(term)
      );
    }

    return filtered;
  }, [leads, segmentType, advancedFilters, leadsLoading, searchTerm]);

  // 2. Sincronização de Seleção
  useEffect(() => {
    if (segmentType !== 'all') {
      setSelectedLeadIds(new Set(filteredLeads.map(lead => lead.id)));
    } else {
      if (!searchTerm && selectedLeadIds.size === 0) {
        setSelectedLeadIds(new Set(leads.map(lead => lead.id)));
      }
    }
    
    onSelectionChange(Array.from(selectedLeadIds));
    
    const config = {
      type: segmentType,
      advanced: advancedFilters,
    };
    onConfigChange(config);
  }, [segmentType, filteredLeads, advancedFilters, onSelectionChange, onConfigChange, leads, searchTerm]);


  const handleLeadSelection = (leadId: string, isSelected: boolean) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(leadId);
      } else {
        newSet.delete(leadId);
      }
      onSelectionChange(Array.from(newSet));
      return newSet;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        filteredLeads.forEach(lead => newSet.add(lead.id));
      } else {
        filteredLeads.forEach(lead => newSet.delete(lead.id));
      }
      onSelectionChange(Array.from(newSet));
      return newSet;
    });
  };

  if (leadsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="ml-4 text-muted-foreground">Carregando dados de segmentação...</p>
      </div>
    );
  }

  const selectedCount = Array.from(selectedLeadIds).filter(id => leads.some(l => l.id === id)).length;
  const isAllDisplayedSelected = filteredLeads.length > 0 && filteredLeads.every(lead => selectedLeadIds.has(lead.id));

  return (
    <div className="space-y-4 mt-2 p-4 border border-border/60 rounded-lg">
      <RadioGroup value={segmentType} onValueChange={setSegmentType} className="flex flex-wrap items-center gap-6">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="all" />
          <Label htmlFor="all">Todos os Leads</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="advanced" id="advanced" />
          <Label htmlFor="advanced">Filtros Avançados</Label>
        </div>
      </RadioGroup>

      {segmentType === 'all' && (
        <div className="pt-4 border-t border-border/40 mt-4 animate-fade-in">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {segmentType === 'advanced' && (
        <div className="pt-4 border-t border-border/40 mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          <div>
            <Label>Último contato há mais de (dias)</Label>
            <Input type="number" value={advancedFilters.lastContact} onChange={e => setAdvancedFilters({...advancedFilters, lastContact: e.target.value})} />
          </div>
          
          <div>
            <Label>Gênero</Label>
            <Select value={advancedFilters.gender} onValueChange={v => setAdvancedFilters({...advancedFilters, gender: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Faixa Etária</Label>
            <Select value={advancedFilters.ageRange} onValueChange={v => setAdvancedFilters({...advancedFilters, ageRange: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todas</SelectItem>
                <SelectItem value="0-12">0-12 anos</SelectItem>
                <SelectItem value="13-17">13-17 anos</SelectItem>
                <SelectItem value="18-30">18-30 anos</SelectItem>
                <SelectItem value="31-50">31-50 anos</SelectItem>
                <SelectItem value="51-999">51+ anos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DateRangeFilter
            label="Data de Cadastro"
            dateRange={advancedFilters.registrationDateRange}
            setDateRange={(date) => setAdvancedFilters({...advancedFilters, registrationDateRange: date})}
          />
        </div>
      )}

      <div className="pt-4 border-t border-border/40 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold font-display">Leads Selecionados ({selectedCount})</h4>
          {filteredLeads.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={isAllDisplayedSelected}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                disabled={filteredLeads.length === 0}
              />
              <Label htmlFor="select-all" className="font-normal">
                Selecionar todos
              </Label>
            </div>
          )}
        </div>
        <div className={cn(
          "max-h-60 overflow-y-auto space-y-2 p-2 border border-border/60 rounded-md bg-background",
          filteredLeads.length === 0 && 'min-h-[100px]'
        )}>
          {filteredLeads.length > 0 ? (
            filteredLeads.map(lead => (
              <div key={lead.id} className="flex items-center space-x-3 p-1.5 rounded hover:bg-muted">
                <Checkbox
                  id={`lead-${lead.id}`}
                  checked={selectedLeadIds.has(lead.id)}
                  onCheckedChange={(checked) => handleLeadSelection(lead.id, !!checked)}
                />
                <Label htmlFor={`lead-${lead.id}`} className="font-normal flex-1 cursor-pointer">
                  {lead.nome} - <span className="text-muted-foreground">{lead.telefone}</span>
                </Label>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchTerm ? 'Nenhum lead encontrado com este termo.' : 'Nenhum lead encontrado para esta segmentação.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}