import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, Plus, Loader2 } from "lucide-react";
import { Criativo, MetaMetrics, useMarketing } from "@/hooks/useMarketing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MetaImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criativos: Criativo[];
  onImport: (mapping: { id: string; metrics: MetaMetrics }[]) => void;
}

interface CSVRow {
  campaignName: string;
  metrics: MetaMetrics;
}

export function MetaImportModal({ open, onOpenChange, criativos, onImport }: MetaImportModalProps) {
  const { createCriativo } = useMarketing(); // Hook para criar criativos
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [matchedData, setMatchedData] = useState<{ row: CSVRow; creativeId: string | null }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [creatingIndexes, setCreatingIndexes] = useState<number[]>([]); // Track loading state for specific rows

  const parseNumber = (value: string) => {
    if (!value) return 0;
    const cleanValue = value.replace(/"/g, '');
    const floatVal = parseFloat(cleanValue);
    return isNaN(floatVal) ? 0 : floatVal;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        toast.error("Arquivo CSV inválido ou vazio.");
        return;
      }

      const splitCSV = (str: string) => {
        const matches = str.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches) return str.split(',');
        return matches.map(m => m.replace(/^"|"$/g, ''));
      };

      const headers = splitCSV(lines[0]).map(h => h.trim().replace(/"/g, ''));
      
      const idxName = headers.indexOf('Nome da campanha');
      const idxResults = headers.indexOf('Resultados');
      const idxReach = headers.indexOf('Alcance');
      const idxSpend = headers.indexOf('Valor usado (BRL)');
      const idxCostPerResult = headers.indexOf('Custo por resultados');
      const idxImpressions = headers.indexOf('Impressões');
      const idxClicks = headers.indexOf('Cliques no link');
      const idxCPC = headers.indexOf('CPC (custo por clique no link) (BRL)');
      const idxCTR = headers.indexOf('CTR (taxa de cliques no link)');
      // Novos índices para as datas
      const idxStart = headers.indexOf('Início dos relatórios');
      const idxEnd = headers.indexOf('Término dos relatórios');

      if (idxName === -1) {
        toast.error("Coluna 'Nome da campanha' não encontrada no CSV.");
        return;
      }

      const parsedRows: CSVRow[] = lines.slice(1).map(line => {
        const values = [];
        let inQuote = false;
        let currentVal = '';
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            values.push(currentVal.trim());
            currentVal = '';
          } else {
            currentVal += char;
          }
        }
        values.push(currentVal.trim());

        if (values.length < headers.length * 0.5) return null; 

        return {
          campaignName: values[idxName]?.replace(/"/g, '') || 'Sem Nome',
          metrics: {
            results: parseNumber(values[idxResults]),
            reach: parseNumber(values[idxReach]),
            spend: parseNumber(values[idxSpend]),
            cost_per_result: parseNumber(values[idxCostPerResult]),
            impressions: parseNumber(values[idxImpressions]),
            clicks: parseNumber(values[idxClicks]),
            cpc: parseNumber(values[idxCPC]),
            ctr: parseNumber(values[idxCTR]),
            // Captura as datas se existirem
            reporting_start: idxStart !== -1 ? values[idxStart]?.replace(/"/g, '') : null,
            reporting_end: idxEnd !== -1 ? values[idxEnd]?.replace(/"/g, '') : null,
            updated_at: new Date().toISOString()
          }
        };
      }).filter(Boolean) as CSVRow[];

      setCsvData(parsedRows);

      const matches = parsedRows.map(row => {
        const creative = criativos.find(c => 
          (c.nome && row.campaignName.toLowerCase().includes(c.nome.toLowerCase())) ||
          (c.titulo && row.campaignName.toLowerCase().includes(c.titulo.toLowerCase())) ||
          (c.nome && c.nome.toLowerCase() === row.campaignName.toLowerCase())
        );
        return { row, creativeId: creative ? creative.id : null };
      });

      setMatchedData(matches);
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleManualAssociation = (index: number, creativeId: string) => {
    setMatchedData(prev => {
      const newData = [...prev];
      newData[index].creativeId = creativeId === "none" ? null : creativeId;
      return newData;
    });
  };

  const handleCreateFromRow = async (index: number) => {
    const row = matchedData[index].row;
    if (!row.campaignName) return;

    setCreatingIndexes(prev => [...prev, index]);

    try {
      const newCreative = await createCriativo({
        nome: row.campaignName,
        titulo: row.campaignName
      });

      if (newCreative) {
        setMatchedData(prev => {
          const newData = [...prev];
          newData[index].creativeId = newCreative.id;
          return newData;
        });
        toast.success(`Criativo "${row.campaignName}" criado e associado!`);
      }
    } catch (error) {
      console.error("Erro ao criar criativo:", error);
    } finally {
      setCreatingIndexes(prev => prev.filter(i => i !== index));
    }
  };

  const handleConfirm = () => {
    const importData = matchedData
      .filter(m => m.creativeId !== null)
      .map(m => ({ id: m.creativeId!, metrics: m.row.metrics }));
    
    if (importData.length === 0) {
      toast.warning("Nenhum criativo foi associado para importação.");
      return;
    }

    onImport(importData);
    onOpenChange(false);
    setCsvData([]);
    setMatchedData([]);
    setFileName(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Importar Métricas do Meta Ads
          </DialogTitle>
          <DialogDescription>
            Faça upload do CSV. O sistema tentará associar automaticamente, mas você pode ajustar ou criar novos criativos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!csvData.length ? (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">Clique para selecionar o arquivo CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Formatos suportados: .csv</p>
              <input 
                type="file" 
                accept=".csv" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" 
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Campanha (CSV)</TableHead>
                    <TableHead className="w-[300px]">Criativo Associado</TableHead>
                    <TableHead className="text-right">Valor Usado</TableHead>
                    <TableHead className="text-right">Resultados</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedData.map((match, idx) => {
                    const isAssociated = !!match.creativeId;
                    const isCreating = creatingIndexes.includes(idx);

                    return (
                      <TableRow key={idx} className={!isAssociated ? "bg-muted/10" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm truncate max-w-[230px]" title={match.row.campaignName}>
                              {match.row.campaignName}
                            </span>
                            {!isAssociated && (
                              <span className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                                <AlertCircle className="h-3 w-3" /> Não associado
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Select 
                              value={match.creativeId || "none"} 
                              onValueChange={(val) => handleManualAssociation(idx, val)}
                            >
                              <SelectTrigger className={cn("h-8 text-xs", !match.creativeId && "text-muted-foreground")}>
                                <SelectValue placeholder="Selecione um criativo..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-- Selecione --</SelectItem>
                                {criativos.map(c => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome || c.titulo || "Sem Nome"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {!isAssociated && (
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => handleCreateFromRow(idx)}
                                disabled={isCreating}
                                title="Criar novo criativo com este nome"
                              >
                                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-display tabular-nums">
                          R$ {match.row.metrics.spend.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-display tabular-nums">
                          {match.row.metrics.results}
                        </TableCell>
                        <TableCell>
                          {isAssociated && <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground self-center">
            {csvData.length > 0 && `${matchedData.filter(m => m.creativeId).length} de ${csvData.length} campanhas associadas.`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!csvData.length}>
              Confirmar Importação
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}