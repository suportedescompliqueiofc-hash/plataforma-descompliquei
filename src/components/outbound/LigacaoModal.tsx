import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateLigacao } from "@/hooks/useOutboundLigacoes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectoId: string;
  prospectoNome: string;
}

const STATUS_OPTIONS = [
  { value: "atendeu", label: "Atendeu" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "ocupado", label: "Ocupado" },
  { value: "caixa_postal", label: "Caixa postal" },
  { value: "numero_errado", label: "Número errado" },
  { value: "recusou", label: "Recusou" },
];

const RESULTADO_OPTIONS = [
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "qualificado", label: "Qualificado" },
  { value: "agendou_call", label: "Agendou call" },
  { value: "quer_mais_info", label: "Quer mais info" },
  { value: "ligar_depois", label: "Ligar depois" },
  { value: "nao_e_icp", label: "Não é ICP" },
  { value: "ja_tem_solucao", label: "Já tem solução" },
];

export function LigacaoModal({ open, onOpenChange, prospectoId, prospectoNome }: Props) {
  const [status, setStatus] = useState("");
  const [resultado, setResultado] = useState("");
  const [duracao, setDuracao] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [proximaAcaoData, setProximaAcaoData] = useState("");
  const createLigacao = useCreateLigacao();

  const resetForm = () => {
    setStatus("");
    setResultado("");
    setDuracao("");
    setAnotacao("");
    setProximaAcao("");
    setProximaAcaoData("");
  };

  const handleSubmit = async () => {
    if (!status) return;

    await createLigacao.mutateAsync({
      prospecto_id: prospectoId,
      status,
      resultado: resultado || null,
      duracao_segundos: duracao ? parseInt(duracao) : null,
      anotacao: anotacao.trim() || null,
      proxima_acao: proximaAcao.trim() || null,
      proxima_acao_data: proximaAcaoData || null,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Ligação — {prospectoNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Status da Ligação *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="O que aconteceu?" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {status === "atendeu" && (
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select value={resultado} onValueChange={setResultado}>
                <SelectTrigger><SelectValue placeholder="Qual foi o resultado?" /></SelectTrigger>
                <SelectContent>
                  {RESULTADO_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Duração (segundos)</Label>
            <Input value={duracao} onChange={e => setDuracao(e.target.value)} placeholder="120" type="number" />
          </div>

          <div className="space-y-2">
            <Label>Anotação</Label>
            <Textarea value={anotacao} onChange={e => setAnotacao(e.target.value)} placeholder="O que foi conversado..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Próxima Ação</Label>
            <Input value={proximaAcao} onChange={e => setProximaAcao(e.target.value)} placeholder="Ex: Ligar novamente, enviar proposta..." />
          </div>

          <div className="space-y-2">
            <Label>Data da Próxima Ação</Label>
            <Input value={proximaAcaoData} onChange={e => setProximaAcaoData(e.target.value)} type="datetime-local" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} disabled={createLigacao.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!status || createLigacao.isPending} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            {createLigacao.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Ligação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
