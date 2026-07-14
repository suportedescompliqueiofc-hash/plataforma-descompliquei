import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  nome: string;
  telefone: string;
  email?: string;
  procedimento_interesse?: string;
  origem?: string;
  etiqueta?: string;
  valid: boolean;
  errors: string[];
}

const normalizePhone = (raw: string): string => {
  const digits = String(raw || '').replace(/\D/g, '');
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
};

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['nome', 'telefone', 'email', 'procedimento_interesse', 'origem', 'etiqueta'],
    ['João Silva', '11987654321', 'joao@email.com', 'Botox', 'organico', 'Reativação'],
    ['Maria Santos', '21912345678', '', 'Rinoplastia', 'marketing', 'Reativação'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, 'modelo_importacao_leads.xlsx');
};

const parseRows = (raw: Record<string, unknown>[]): ParsedRow[] => {
  return raw.map((row) => {
    const findCol = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(row).find(c => c.toLowerCase().trim() === k);
        if (found !== undefined) return String(row[found] ?? '').trim();
      }
      return '';
    };

    const nome = findCol('nome', 'name', 'cliente');
    const telefone = normalizePhone(findCol('telefone', 'phone', 'celular', 'whatsapp', 'fone'));
    const email = findCol('email', 'e-mail');
    const procedimento_interesse = findCol('procedimento_interesse', 'procedimento', 'interesse', 'servico', 'serviço');
    const origem = findCol('origem', 'source', 'canal') || 'organico';
    const etiqueta = findCol('etiqueta', 'etiquetas', 'tag', 'tags', 'label', 'labels');

    const errors: string[] = [];
    if (!nome) errors.push('Nome obrigatório');
    if (!telefone || telefone.length < 10) errors.push('Telefone inválido');

    return { nome, telefone, email, procedimento_interesse, origem, etiqueta, valid: errors.length === 0, errors };
  });
};

type Step = 'upload' | 'preview' | 'importing' | 'done';

const revalidateRow = (row: ParsedRow): ParsedRow => {
  const errors: string[] = [];
  if (!row.nome.trim()) errors.push('Nome obrigatório');
  if (!row.telefone || row.telefone.length < 10) errors.push('Telefone inválido');
  return { ...row, valid: errors.length === 0, errors };
};

export function ImportLeadsDialog({ open, onOpenChange }: ImportLeadsDialogProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [tagCount, setTagCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateRow = (index: number, field: keyof ParsedRow, value: string) => {
    setRows(prev => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      next[index] = revalidateRow(updated as ParsedRow);
      return next;
    });
  };

  const normalizeRowPhone = (index: number) => {
    setRows(prev => {
      const next = [...prev];
      const normalized = normalizePhone(next[index].telefone);
      const updated = { ...next[index], telefone: normalized };
      next[index] = revalidateRow(updated as ParsedRow);
      return next;
    });
  };

  const validRows = rows.filter(r => r.valid);
  const invalidRows = rows.filter(r => !r.valid);
  const hasTagColumn = rows.some(r => r.etiqueta);

  const reset = () => {
    setStep('upload');
    setRows([]);
    setImportedCount(0);
    setErrorCount(0);
    setTagCount(0);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (raw.length === 0) { toast.error('Planilha vazia ou sem dados reconhecíveis.'); return; }
        setRows(parseRows(raw));
        setStep('preview');
      } catch {
        toast.error('Erro ao ler o arquivo. Verifique o formato.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (!user || !orgId || validRows.length === 0) return;
    setStep('importing');

    const BATCH = 50;
    let ok = 0;
    let fail = 0;
    // phone -> lead id, built from insert responses
    const phoneToLeadId: Record<string, string> = {};

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batchRows = validRows.slice(i, i + BATCH);
      const batch = batchRows.map(r => ({
        usuario_id: user.id,
        organization_id: orgId,
        nome: r.nome,
        telefone: r.telefone,
        email: r.email || null,
        procedimento_interesse: r.procedimento_interesse || null,
        origem: r.origem || 'organico',
        fonte: 'importado',
        status: 'ativo',
        queixa_principal: '',
      }));

      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(batch)
        .select('id, telefone');

      if (error) {
        fail += batch.length;
      } else {
        ok += inserted?.length ?? 0;
        for (const lead of (inserted ?? [])) {
          phoneToLeadId[lead.telefone] = lead.id;
        }
      }
    }

    // ── Etiquetas ────────────────────────────────────────────────────────────
    const rowsWithTag = validRows.filter(r => r.etiqueta?.trim());
    let tagsAssigned = 0;

    if (rowsWithTag.length > 0) {
      const uniqueTagNames = [...new Set(rowsWithTag.map(r => r.etiqueta!.trim()))];

      // Fetch existing tags
      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name, label_lid')
        .eq('organization_id', orgId)
        .in('name', uniqueTagNames);

      const tagMap: Record<string, { id: string; label_lid: string | null }> = {};
      for (const t of (existingTags ?? [])) {
        tagMap[t.name.toLowerCase()] = { id: t.id, label_lid: t.label_lid };
      }

      // Create missing tags with default color (slate)
      for (const tagName of uniqueTagNames) {
        if (!tagMap[tagName.toLowerCase()]) {
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ name: tagName, color: '#64748b', organization_id: orgId })
            .select('id, label_lid')
            .single();
          if (newTag) {
            tagMap[tagName.toLowerCase()] = { id: newTag.id, label_lid: newTag.label_lid };
          }
        }
      }

      // Build leads_tags rows + WhatsApp sync list
      const leadTagRows: { lead_id: string; tag_id: string }[] = [];
      const waSync: { telefone: string; label_lid: string }[] = [];

      for (const row of rowsWithTag) {
        const leadId = phoneToLeadId[row.telefone];
        const tagInfo = tagMap[row.etiqueta!.trim().toLowerCase()];
        if (!leadId || !tagInfo) continue;
        leadTagRows.push({ lead_id: leadId, tag_id: tagInfo.id });
        if (tagInfo.label_lid) {
          waSync.push({ telefone: row.telefone, label_lid: tagInfo.label_lid });
        }
      }

      if (leadTagRows.length > 0) {
        const { error: tagErr } = await supabase.from('leads_tags').insert(leadTagRows);
        if (!tagErr) {
          tagsAssigned = leadTagRows.length;

          // Sync with WhatsApp — fire and forget
          if (waSync.length > 0) {
            const { data: { session } } = await supabase.auth.getSession();
            for (const { telefone, label_lid } of waSync) {
              supabase.functions.invoke('manage-whatsapp', {
                body: { action: 'add_label', telefone, label_lid },
                headers: { Authorization: `Bearer ${session?.access_token}` },
              }).catch(() => {/* silent: WhatsApp sync failure doesn't block import */});
            }
          }
        }
      }
    }

    setImportedCount(ok);
    setErrorCount(fail);
    setTagCount(tagsAssigned);
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['leads', orgId] });
    if (tagsAssigned > 0) queryClient.invalidateQueries({ queryKey: ['tags', orgId] });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Leads por Planilha
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Faça upload de um arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong>.
              As colunas <strong>nome</strong> e <strong>telefone</strong> são obrigatórias.
            </p>

            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/60 hover:bg-muted/40"
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv — máx. 5.000 linhas</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            </div>

            <Button variant="outline" size="sm" className="self-start gap-2" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Baixar modelo de planilha
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col gap-4 min-h-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">{rows.length} linhas lidas</Badge>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{validRows.length} válidas</Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive">{invalidRows.length} com erro</Badge>
              )}
              {hasTagColumn && (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  {validRows.filter(r => r.etiqueta).length} com etiqueta
                </Badge>
              )}
            </div>

            <div className="overflow-auto rounded-lg border border-border/60 flex-1 max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Nome</th>
                    <th className="text-left p-2 font-medium">Telefone</th>
                    <th className="text-left p-2 font-medium">Email</th>
                    <th className="text-left p-2 font-medium">Procedimento</th>
                    <th className="text-left p-2 font-medium">Origem</th>
                    <th className="text-left p-2 font-medium">Etiqueta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={cn("border-t border-border/60", !row.valid && "bg-red-50")}>
                      <td className="p-2">
                        {row.valid
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          : <span title={row.errors.join(', ')}><AlertCircle className="h-3.5 w-3.5 text-destructive" /></span>
                        }
                      </td>
                      <td className="p-1">
                        <input
                          className={cn("w-full bg-transparent px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white", !row.nome && "text-destructive italic placeholder:text-destructive")}
                          value={row.nome}
                          placeholder="vazio"
                          onChange={e => updateRow(i, 'nome', e.target.value)}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className={cn("w-full bg-transparent px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white", (!row.telefone || row.telefone.length < 10) && "text-destructive italic")}
                          value={row.telefone}
                          placeholder="inválido"
                          onChange={e => updateRow(i, 'telefone', e.target.value)}
                          onBlur={() => normalizeRowPhone(i)}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-full bg-transparent px-1 py-0.5 rounded text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white focus:text-foreground"
                          value={row.email ?? ''}
                          placeholder="—"
                          onChange={e => updateRow(i, 'email', e.target.value)}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-full bg-transparent px-1 py-0.5 rounded text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white focus:text-foreground"
                          value={row.procedimento_interesse ?? ''}
                          placeholder="—"
                          onChange={e => updateRow(i, 'procedimento_interesse', e.target.value)}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-full bg-transparent px-1 py-0.5 rounded text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white focus:text-foreground"
                          value={row.origem ?? ''}
                          placeholder="organico"
                          onChange={e => updateRow(i, 'origem', e.target.value)}
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-full bg-transparent px-1 py-0.5 rounded text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white focus:text-foreground"
                          value={row.etiqueta ?? ''}
                          placeholder="—"
                          onChange={e => updateRow(i, 'etiqueta', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidRows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Linhas com erro serão ignoradas. Apenas as {validRows.length} linhas válidas serão importadas.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0}>
                Importar {validRows.length} lead{validRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando leads, aguarde...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold font-display"><span className="font-display tabular-nums">{importedCount}</span> lead{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''}!</p>
              {tagCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {tagCount} etiqueta{tagCount !== 1 ? 's' : ''} atribuída{tagCount !== 1 ? 's' : ''} e sincronizada{tagCount !== 1 ? 's' : ''} com o WhatsApp.
                </p>
              )}
              {errorCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">{errorCount} não puderam ser inseridos (telefone duplicado ou erro).</p>
              )}
            </div>
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
