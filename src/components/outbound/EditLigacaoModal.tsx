import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, PhoneOff, PhoneMissed, Voicemail, XCircle, Ban, Plus } from "lucide-react";
import { OutboundLigacao, useUpdateLigacao } from "@/hooks/useOutboundLigacoes";
import { useOutboundScripts } from "@/hooks/useOutboundScripts";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "atendeu", label: "Atendeu", icon: Phone, color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/30" },
  { value: "nao_atendeu", label: "Não atendeu", icon: PhoneMissed, color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40 hover:bg-zinc-500/30" },
  { value: "ocupado", label: "Ocupado", icon: PhoneOff, color: "bg-amber-500/20 text-amber-500 border-amber-500/40 hover:bg-amber-500/30" },
  { value: "caixa_postal", label: "Caixa postal", icon: Voicemail, color: "bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30" },
  { value: "numero_errado", label: "Nº errado", icon: XCircle, color: "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30" },
  { value: "recusou", label: "Recusou", icon: Ban, color: "bg-red-500/20 text-red-500 border-red-500/40 hover:bg-red-500/30" },
];

const RESULTADO_OPTIONS_DEFAULT = [
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "qualificado", label: "Qualificado" },
  { value: "agendou_call", label: "Agendou call" },
  { value: "quer_mais_info", label: "Quer mais info" },
  { value: "ligar_depois", label: "Ligar depois" },
  { value: "nao_e_icp", label: "Não é ICP" },
  { value: "ja_tem_solucao", label: "Já tem solução" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ligacao: OutboundLigacao | null;
}

export function EditLigacaoModal({ open, onOpenChange, ligacao }: Props) {
  const updateLigacao = useUpdateLigacao();
  const { activeScripts } = useOutboundScripts();

  const [status, setStatus] = useState("");
  const [resultados, setResultados] = useState<string[]>([]);
  const [customResultado, setCustomResultado] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [duracaoMin, setDuracaoMin] = useState("");
  const [duracaoSeg, setDuracaoSeg] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [proximaAcaoData, setProximaAcaoData] = useState("");

  useEffect(() => {
    if (open && ligacao) {
      setStatus(ligacao.status || "");
      setResultados(ligacao.resultado ? ligacao.resultado.split(",") : []);
      setCustomResultado("");
      setScriptId(ligacao.script_id || "");
      const dur = ligacao.duracao_segundos || 0;
      setDuracaoMin(dur >= 60 ? Math.floor(dur / 60).toString() : "");
      setDuracaoSeg(dur % 60 > 0 ? (dur % 60).toString() : "");
      setAnotacao(ligacao.anotacao || "");
      setProximaAcao(ligacao.proxima_acao || "");
      setProximaAcaoData(ligacao.proxima_acao_data ? ligacao.proxima_acao_data.slice(0, 16) : "");
    }
  }, [open, ligacao]);

  const handleSubmit = async () => {
    if (!ligacao || !status) return;

    const duracaoTotal = (parseInt(duracaoMin || "0") * 60) + parseInt(duracaoSeg || "0");
    const resultadoFinal = status === "atendeu" && resultados.length > 0 ? resultados.join(",") : null;

    await updateLigacao.mutateAsync({
      id: ligacao.id,
      prospecto_id: ligacao.prospecto_id,
      status,
      resultado: resultadoFinal,
      script_id: scriptId || null,
      duracao_segundos: duracaoTotal > 0 ? duracaoTotal : null,
      anotacao: anotacao.trim() || null,
      proxima_acao: proximaAcao.trim() || null,
      proxima_acao_data: proximaAcaoData ? new Date(proximaAcaoData).toISOString() : null,
    });

    onOpenChange(false);
  };

  if (!ligacao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Ligação #{ligacao.numero_tentativa}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* STATUS */}
          <div className="space-y-2">
            <Label>Status da Ligação *</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STATUS_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isSelected = status === opt.value;
                return (
                  <button key={opt.value} onClick={() => { setStatus(opt.value); if (opt.value !== "atendeu") { setResultados([]); setCustomResultado(""); } }}
                    className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-xs font-medium", isSelected ? opt.color + " ring-2 ring-offset-1 ring-offset-background" : "border-border/50 text-muted-foreground hover:bg-muted/50")}>
                    <Icon className="h-5 w-5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RESULTADO */}
          {status === "atendeu" && (
            <div className="space-y-2">
              <Label>Resultado <span className="text-xs text-muted-foreground font-normal">(selecione um ou mais)</span></Label>
              <div className="flex flex-wrap gap-2">
                {RESULTADO_OPTIONS_DEFAULT.map(r => {
                  const isSelected = resultados.includes(r.value);
                  return (
                    <button key={r.value} onClick={() => setResultados(prev => isSelected ? prev.filter(v => v !== r.value) : [...prev, r.value])}
                      className={cn("px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                        isSelected ? "bg-[#E85D24] text-white border-[#E85D24]" : "border-border/50 text-muted-foreground hover:bg-muted/50")}>
                      {r.label}
                    </button>
                  );
                })}
                {resultados.filter(r => !RESULTADO_OPTIONS_DEFAULT.some(o => o.value === r)).map(custom => (
                  <button key={custom} onClick={() => setResultados(prev => prev.filter(v => v !== custom))}
                    className="px-3 py-1.5 rounded-full border text-xs font-medium bg-[#E85D24] text-white border-[#E85D24] transition-all">
                    {custom} ×
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  value={customResultado}
                  onChange={e => setCustomResultado(e.target.value)}
                  placeholder="Adicionar resultado personalizado..."
                  className="h-8 text-xs flex-1"
                  onKeyDown={e => {
                    if (e.key === "Enter" && customResultado.trim()) {
                      e.preventDefault();
                      const val = customResultado.trim().toLowerCase().replace(/\s+/g, '_');
                      if (!resultados.includes(val)) setResultados(prev => [...prev, val]);
                      setCustomResultado("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!customResultado.trim()}
                  onClick={() => {
                    const val = customResultado.trim().toLowerCase().replace(/\s+/g, '_');
                    if (val && !resultados.includes(val)) setResultados(prev => [...prev, val]);
                    setCustomResultado("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          {/* SCRIPT + DURAÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Script Utilizado</Label>
              <Select value={scriptId} onValueChange={setScriptId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {activeScripts.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {s.nome}
                        <Badge variant="outline" className="text-[10px]">{s.status === 'em_teste' ? 'Teste' : 'Aprovado'}</Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <div className="flex gap-2 items-center">
                <Input value={duracaoMin} onChange={e => setDuracaoMin(e.target.value)} placeholder="0" type="number" min="0" className="w-20" />
                <span className="text-sm text-muted-foreground">min</span>
                <Input value={duracaoSeg} onChange={e => setDuracaoSeg(e.target.value)} placeholder="0" type="number" min="0" max="59" className="w-20" />
                <span className="text-sm text-muted-foreground">seg</span>
              </div>
            </div>
          </div>

          {/* ANOTAÇÃO */}
          <div className="space-y-2">
            <Label>Anotação</Label>
            <Textarea value={anotacao} onChange={e => setAnotacao(e.target.value)} placeholder="O que foi conversado, observações..." rows={3} />
          </div>

          {/* PRÓXIMA AÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Próxima Ação</Label>
              <Input value={proximaAcao} onChange={e => setProximaAcao(e.target.value)} placeholder="Ligar novamente, enviar proposta..." />
            </div>
            <div className="space-y-2">
              <Label>Data da Próxima Ação</Label>
              <Input value={proximaAcaoData} onChange={e => setProximaAcaoData(e.target.value)} type="datetime-local" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateLigacao.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!status || updateLigacao.isPending} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            {updateLigacao.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
