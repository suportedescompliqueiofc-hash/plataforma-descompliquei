import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, ClipboardPaste, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { useOutboundProspectos } from "@/hooks/useOutboundProspectos";
import { useOutboundStages } from "@/hooks/useOutboundStages";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  nome: string;
  telefone: string;
  telefoneBruto: string;
  instagram: string;
  cidade: string;
  uf: string;
  avaliacoes: string;
  observacao: string;
  valid: boolean;
  duplicado: boolean;
}

const KNOWN_HEADERS: Record<string, string> = {
  "#": "index",
  "nome do lead / clínica": "nome",
  "nome do lead / clinica": "nome",
  "nome do lead": "nome",
  "nome": "nome",
  "clínica": "nome",
  "clinica": "nome",
  "whatsapp": "telefone",
  "telefone": "telefone",
  "fone": "telefone",
  "instagram": "instagram",
  "insta": "instagram",
  "cidade": "cidade",
  "uf": "uf",
  "estado": "uf",
  "avaliações google": "avaliacoes",
  "avaliacoes google": "avaliacoes",
  "avaliações": "avaliacoes",
  "avaliacoes": "avaliacoes",
  "google": "avaliacoes",
  "observação": "observacao",
  "observacao": "observacao",
  "obs": "observacao",
};

function normalizeTelefone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function detectColumns(headerRow: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  headerRow.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/[""]/g, "");
    if (KNOWN_HEADERS[key]) {
      map[i] = KNOWN_HEADERS[key];
    }
  });
  return map;
}

function parseRows(raw: string, existingPhones: Set<string>): { rows: ParsedRow[]; colMap: Record<number, string> } {
  const lines = raw.trim().split("\n").map(l => l.split("\t"));
  if (lines.length < 2) return { rows: [], colMap: {} };

  const colMap = detectColumns(lines[0]);
  const dataLines = lines.slice(1);

  const seenPhones = new Set<string>();
  const rows: ParsedRow[] = dataLines
    .filter(cols => cols.length > 1 && cols.some(c => c.trim()))
    .map(cols => {
      const get = (field: string) => {
        const idx = Object.entries(colMap).find(([, v]) => v === field)?.[0];
        return idx !== undefined ? (cols[Number(idx)] || "").trim() : "";
      };

      const telefoneBruto = get("telefone");
      const telefone = normalizeTelefone(telefoneBruto);
      const nome = get("nome");
      const isDup = seenPhones.has(telefone) || existingPhones.has(telefone);
      seenPhones.add(telefone);

      return {
        nome,
        telefone,
        telefoneBruto,
        instagram: get("instagram"),
        cidade: get("cidade"),
        uf: get("uf"),
        avaliacoes: get("avaliacoes"),
        observacao: get("observacao"),
        valid: !!nome && telefone.length >= 10,
        duplicado: isDup,
      };
    });

  return { rows, colMap };
}

export function ImportProspectosModal({ open, onOpenChange }: Props) {
  const { prospectos } = useOutboundProspectos();
  const { stages } = useOutboundStages();
  const { users } = useOrgUsers();
  const { profile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [rawText, setRawText] = useState("");
  const [stageId, setStageId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [canalOrigem, setCanalOrigem] = useState("google_maps");
  const [skipDuplicados, setSkipDuplicados] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; ok: number; skipped: number } | null>(null);

  const existingPhones = useMemo(() => {
    return new Set(prospectos.map(p => normalizeTelefone(p.telefone)));
  }, [prospectos]);

  const { rows, colMap } = useMemo(() => {
    if (!rawText.trim()) return { rows: [], colMap: {} };
    return parseRows(rawText, existingPhones);
  }, [rawText, existingPhones]);

  const validRows = rows.filter(r => r.valid);
  const dupRows = rows.filter(r => r.duplicado);
  const importableRows = skipDuplicados ? validRows.filter(r => !r.duplicado) : validRows;

  const handleProceed = () => {
    if (rows.length === 0) {
      toast.error("Nenhum dado detectado. Cole os dados da planilha com cabeçalho.");
      return;
    }
    if (Object.keys(colMap).length < 2) {
      toast.error("Não foi possível detectar as colunas. Verifique se o cabeçalho está presente.");
      return;
    }
    setStep("preview");
  };

  const handleImport = async () => {
    if (!orgId || importableRows.length === 0) return;
    setIsImporting(true);

    try {
      const payloads = importableRows.map(r => {
        const obsParts: string[] = [];
        if (r.instagram) obsParts.push(`• Instagram: ${r.instagram}`);
        if (r.avaliacoes) obsParts.push(`• Avaliações Google: ${r.avaliacoes}`);
        if (r.uf) obsParts.push(`• UF: ${r.uf}`);
        if (r.observacao) obsParts.push(`• ${r.observacao}`);

        return {
          organization_id: orgId,
          nome: r.nome,
          telefone: r.telefone,
          clinica: r.nome,
          cidade: r.uf ? `${r.cidade} - ${r.uf}` : r.cidade || null,
          canal_origem: canalOrigem || null,
          stage_id: stageId || null,
          usuario_id: usuarioId || null,
          observacoes: obsParts.length > 0 ? obsParts.join("\n") : null,
        };
      });

      const BATCH_SIZE = 50;
      let totalOk = 0;

      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        const { data, error } = await (supabase as any)
          .from("outbound_prospectos")
          .insert(batch)
          .select("id, nome");
        if (error) throw error;

        if (data?.length) {
          const histEntries = data.map((d: any) => ({
            organization_id: orgId,
            prospecto_id: d.id,
            usuario_id: user?.id,
            tipo: "prospecto_criado",
            descricao: `Prospecto "${d.nome}" importado via lista`,
          }));
          await (supabase as any).from("outbound_historico").insert(histEntries);
          totalOk += data.length;
        }
      }

      setImportResult({
        total: importableRows.length,
        ok: totalOk,
        skipped: dupRows.length,
      });

      queryClient.invalidateQueries({ queryKey: ["outbound_prospectos", orgId] });
      toast.success(`${totalOk} prospectos importados com sucesso!`);
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep("paste");
    setRawText("");
    setImportResult(null);
    onOpenChange(false);
  };

  const activeStages = stages.filter(s => s.tipo === "ativo");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-3 overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[#E85D24]" /> Importar Lista de Prospectos
          </DialogTitle>
          <DialogDescription>
            {step === "paste"
              ? "Cole os dados da planilha abaixo (com cabeçalho). O sistema detecta as colunas automaticamente."
              : importResult
                ? "Importação concluída."
                : `${importableRows.length} prospectos prontos para importar.`}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ClipboardPaste className="h-4 w-4" /> Dados da Planilha
              </Label>
              <Textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={"Copie os dados da planilha (incluindo cabeçalho) e cole aqui.\n\nExemplo:\n#\tNome do Lead / Clínica\tWhatsApp\tInstagram\tCidade\tUF\tAvaliações Google\tObservação\n1\tClínica Exemplo\t+55 (11) 9 9999-0000\t@clinica\tSão Paulo\tSP\t⭐ 5.0 (100 aval.)\t✅ Alta prova social"}
                rows={10}
                className="font-mono text-xs"
              />
              {rawText.trim() && (
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    {validRows.length} válidos
                  </Badge>
                  {dupRows.length > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                      {dupRows.length} duplicados
                    </Badge>
                  )}
                  {rows.filter(r => !r.valid).length > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                      {rows.filter(r => !r.valid).length} inválidos
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">
                    Colunas detectadas: {Object.values(colMap).filter(v => v !== "index").join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/20 rounded-xl border">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">STAGE INICIAL</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {activeStages.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                          {s.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">SDR RESPONSÁVEL</Label>
                <Select value={usuarioId} onValueChange={setUsuarioId}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome_completo || "Sem nome"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">CANAL DE ORIGEM</Label>
                <Select value={canalOrigem} onValueChange={setCanalOrigem}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google_maps">Google Maps</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="base_comprada">Base comprada</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={skipDuplicados}
                onCheckedChange={(v) => setSkipDuplicados(!!v)}
              />
              <Label className="text-sm cursor-pointer">Pular prospectos com telefone já cadastrado</Label>
            </div>
          </div>
        )}

        {step === "preview" && !importResult && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">Nome / Clínica</TableHead>
                    <TableHead className="text-xs">Telefone</TableHead>
                    <TableHead className="text-xs">Instagram</TableHead>
                    <TableHead className="text-xs">Cidade</TableHead>
                    <TableHead className="text-xs">UF</TableHead>
                    <TableHead className="text-xs">Avaliações</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={!r.valid ? "opacity-40" : r.duplicado && skipDuplicados ? "opacity-50 bg-amber-500/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm">{r.nome || <span className="text-red-400">—</span>}</TableCell>
                      <TableCell className="text-xs font-mono">{r.telefone || <span className="text-red-400">—</span>}</TableCell>
                      <TableCell className="text-xs text-blue-400">{r.instagram || "—"}</TableCell>
                      <TableCell className="text-xs">{r.cidade || "—"}</TableCell>
                      <TableCell className="text-xs font-medium">{r.uf || "—"}</TableCell>
                      <TableCell className="text-xs">{r.avaliacoes || "—"}</TableCell>
                      <TableCell>
                        {!r.valid ? (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Inválido</Badge>
                        ) : r.duplicado ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                            {skipDuplicados ? "Será pulado" : "Duplicado"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "preview" && importResult && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 gap-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{importResult.ok} prospectos importados</p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-muted-foreground">{importResult.skipped} duplicados foram ignorados</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-shrink-0 pt-2 border-t">
          {step === "paste" && (
            <>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
              <Button
                size="sm"
                onClick={handleProceed}
                disabled={validRows.length === 0}
                className="bg-[#E85D24] hover:bg-[#E85D24]/90"
              >
                Pré-visualizar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === "preview" && !importResult && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep("paste")}>Voltar</Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={isImporting || importableRows.length === 0}
                className="bg-[#E85D24] hover:bg-[#E85D24]/90"
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Importar {importableRows.length} Prospectos
              </Button>
            </>
          )}
          {importResult && (
            <Button size="sm" onClick={handleClose} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
