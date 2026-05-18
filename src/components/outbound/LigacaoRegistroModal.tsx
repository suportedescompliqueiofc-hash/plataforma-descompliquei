import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Phone, PhoneOff, PhoneMissed, Voicemail, XCircle, Ban } from "lucide-react";
import { useLigacaoModal } from "@/contexts/LigacaoContext";
import { useCreateLigacao } from "@/hooks/useOutboundLigacoes";
import { useOutboundProspectos, OutboundProspecto } from "@/hooks/useOutboundProspectos";
import { useOutboundStages } from "@/hooks/useOutboundStages";
import { useOutboundScripts } from "@/hooks/useOutboundScripts";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AgendamentoLeadModal from "@/components/agendamentos/AgendamentoLeadModal";

const STATUS_OPTIONS = [
  { value: "atendeu", label: "Atendeu", icon: Phone, color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/30" },
  { value: "nao_atendeu", label: "Não atendeu", icon: PhoneMissed, color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40 hover:bg-zinc-500/30" },
  { value: "ocupado", label: "Ocupado", icon: PhoneOff, color: "bg-amber-500/20 text-amber-500 border-amber-500/40 hover:bg-amber-500/30" },
  { value: "caixa_postal", label: "Caixa postal", icon: Voicemail, color: "bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30" },
  { value: "numero_errado", label: "Nº errado", icon: XCircle, color: "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30" },
  { value: "recusou", label: "Recusou", icon: Ban, color: "bg-red-500/20 text-red-500 border-red-500/40 hover:bg-red-500/30" },
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

const SCORING_OPTIONS = ["A", "B", "C", "D"];

export function LigacaoRegistroModal() {
  const { isModalOpen, prospecto: preSelectedProspecto, closeModal } = useLigacaoModal();
  const createLigacao = useCreateLigacao();
  const { prospectos } = useOutboundProspectos();
  const { stages } = useOutboundStages();
  const { activeScripts } = useOutboundScripts();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { users } = useOrgUsers();
  const queryClient = useQueryClient();

  const [sdrId, setSdrId] = useState(user?.id || "");
  const [agendamentoOpen, setAgendamentoOpen] = useState(false);
  const [agendamentoLeadId, setAgendamentoLeadId] = useState<string | null>(null);
  const [agendamentoLeadNome, setAgendamentoLeadNome] = useState("");
  const [agendamentoProspectoId, setAgendamentoProspectoId] = useState<string | null>(null);

  const [prospectoId, setProspectoId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [resultado, setResultado] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [duracaoMin, setDuracaoMin] = useState("");
  const [duracaoSeg, setDuracaoSeg] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [proximaAcaoData, setProximaAcaoData] = useState("");
  const [alterarStage, setAlterarStage] = useState(false);
  const [novoStageId, setNovoStageId] = useState("");
  const [alterarScoring, setAlterarScoring] = useState(false);
  const [novoScoring, setNovoScoring] = useState("");

  const selectedProspecto = useMemo(() => {
    return prospectos.find(p => p.id === prospectoId) || null;
  }, [prospectos, prospectoId]);

  const filteredProspectos = useMemo(() => {
    if (!searchTerm) return prospectos.slice(0, 10);
    const s = searchTerm.toLowerCase();
    return prospectos.filter(p =>
      p.nome.toLowerCase().includes(s) || p.telefone.includes(s) || (p.clinica || "").toLowerCase().includes(s)
    ).slice(0, 10);
  }, [prospectos, searchTerm]);

  useEffect(() => {
    if (isModalOpen) {
      if (preSelectedProspecto) {
        setProspectoId(preSelectedProspecto.id);
        setSearchTerm("");
      } else {
        setProspectoId("");
        setSearchTerm("");
      }
      setStatus("");
      setResultado("");
      setScriptId("");
      setDuracaoMin("");
      setDuracaoSeg("");
      setAnotacao("");
      setProximaAcao("");
      setProximaAcaoData("");
      setAlterarStage(false);
      setNovoStageId("");
      setAlterarScoring(false);
      setNovoScoring("");
      setSdrId(user?.id || "");
    }
  }, [isModalOpen, preSelectedProspecto, user?.id]);

  const ensureLeadForProspecto = async (prosp: OutboundProspecto): Promise<string> => {
    if (prosp.whatsapp_lead_id) return prosp.whatsapp_lead_id;
    if (!profile?.organization_id || !user?.id) throw new Error('Sem organização');

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        organization_id: profile.organization_id,
        usuario_id: user.id,
        nome: prosp.nome,
        telefone: prosp.telefone,
        email: prosp.email,
        origem: 'outbound',
        fonte: 'prospecao_ativa',
        status: 'Ativo',
        posicao_pipeline: 0,
        ia_ativa: false,
      } as any)
      .select()
      .single();
    if (error) throw error;

    await (supabase as any)
      .from('outbound_prospectos')
      .update({ whatsapp_lead_id: lead.id })
      .eq('id', prosp.id);

    await (supabase as any)
      .from('outbound_historico')
      .insert({
        organization_id: profile.organization_id,
        prospecto_id: prosp.id,
        usuario_id: user.id,
        tipo: 'mensagem_enviada',
        descricao: 'Lead WhatsApp criado via ligação',
        metadados: { lead_id: lead.id },
      });

    queryClient.invalidateQueries({ queryKey: ['outbound_prospectos'] });
    return lead.id;
  };

  const handleAgendamentoSaved = async () => {
    if (!agendamentoProspectoId || !profile?.organization_id || !user?.id) return;
    try {
      await (supabase as any)
        .from('outbound_historico')
        .insert({
          organization_id: profile.organization_id,
          prospecto_id: agendamentoProspectoId,
          usuario_id: user.id,
          tipo: 'agendamento_criado',
          descricao: 'Call comercial agendada',
        });

      const callStage = stages.find(s => s.nome.toLowerCase().includes('call agendada') || s.nome.toLowerCase().includes('agendad'));
      if (callStage) {
        await (supabase as any)
          .from('outbound_prospectos')
          .update({ stage_id: callStage.id })
          .eq('id', agendamentoProspectoId);
      }

      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos'] });
      queryClient.invalidateQueries({ queryKey: ['outbound_historico', agendamentoProspectoId] });
    } catch (err: any) {
      console.error('Erro ao registrar agendamento no histórico:', err);
    }
  };

  const handleSubmit = async () => {
    if (!prospectoId || !status) return;

    const duracaoTotal = (parseInt(duracaoMin || "0") * 60) + parseInt(duracaoSeg || "0");
    const isAgendouCall = status === "atendeu" && resultado === "agendou_call";

    await createLigacao.mutateAsync({
      prospecto_id: prospectoId,
      usuario_id: sdrId || user?.id,
      status,
      resultado: status === "atendeu" ? resultado || null : null,
      script_id: scriptId || null,
      duracao_segundos: duracaoTotal > 0 ? duracaoTotal : null,
      anotacao: anotacao.trim() || null,
      proxima_acao: proximaAcao.trim() || null,
      proxima_acao_data: proximaAcaoData || null,
      alterar_stage: alterarStage,
      novo_stage_id: novoStageId || undefined,
      alterar_scoring: alterarScoring,
      novo_scoring: novoScoring || undefined,
    } as any);

    if (isAgendouCall) {
      const prosp = prospectos.find(p => p.id === prospectoId);
      if (prosp) {
        try {
          const leadId = await ensureLeadForProspecto(prosp);
          setAgendamentoLeadId(leadId);
          setAgendamentoLeadNome(prosp.nome);
          setAgendamentoProspectoId(prosp.id);
          closeModal();
          setAgendamentoOpen(true);
          return;
        } catch (err: any) {
          toast.error('Erro ao preparar agendamento: ' + err.message);
        }
      }
    }

    closeModal();
  };

  return (
    <>
    <Dialog open={isModalOpen} onOpenChange={(v) => { if (!v) closeModal(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Ligação</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* PROSPECTO */}
          {!preSelectedProspecto ? (
            <div className="space-y-2">
              <Label>Prospecto *</Label>
              {prospectoId && selectedProspecto ? (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{selectedProspecto.nome}</p>
                    <p className="text-xs text-muted-foreground">{selectedProspecto.clinica} • {selectedProspecto.telefone}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setProspectoId("")}>Trocar</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome, telefone ou clínica..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  {filteredProspectos.length > 0 && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto">
                      {filteredProspectos.map(p => (
                        <button key={p.id} className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left transition-colors" onClick={() => { setProspectoId(p.id); setSearchTerm(""); }}>
                          <div>
                            <p className="text-sm font-medium">{p.nome}</p>
                            <p className="text-xs text-muted-foreground">{p.clinica} • {p.telefone}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{p.total_tentativas} lig.</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium">{preSelectedProspecto.nome}</p>
              <p className="text-xs text-muted-foreground">{preSelectedProspecto.clinica} • {preSelectedProspecto.telefone} • {preSelectedProspecto.total_tentativas} ligações anteriores</p>
            </div>
          )}

          {/* SDR */}
          <div className="space-y-2">
            <Label>SDR responsável</Label>
            <Select value={sdrId} onValueChange={setSdrId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar SDR" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome_completo || "Sem nome"}
                    {u.id === user?.id && " (você)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STATUS — BOTÕES VISUAIS */}
          <div className="space-y-2">
            <Label>Status da Ligação *</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STATUS_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isSelected = status === opt.value;
                return (
                  <button key={opt.value} onClick={() => { setStatus(opt.value); if (opt.value !== "atendeu") setResultado(""); }}
                    className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-xs font-medium", isSelected ? opt.color + " ring-2 ring-offset-1 ring-offset-background" : "border-border/50 text-muted-foreground hover:bg-muted/50")}>
                    <Icon className="h-5 w-5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RESULTADO (só se atendeu) */}
          {status === "atendeu" && (
            <div className="space-y-2">
              <Label>Resultado</Label>
              <div className="flex flex-wrap gap-2">
                {RESULTADO_OPTIONS.map(r => (
                  <button key={r.value} onClick={() => setResultado(r.value)}
                    className={cn("px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                      resultado === r.value ? "bg-[#E85D24] text-white border-[#E85D24]" : "border-border/50 text-muted-foreground hover:bg-muted/50")}>
                    {r.label}
                  </button>
                ))}
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

          {/* TOGGLES — STAGE E SCORING */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Alterar stage do prospecto?</p>
                <p className="text-xs text-muted-foreground">Mover para outro estágio do pipeline</p>
              </div>
              <Switch checked={alterarStage} onCheckedChange={setAlterarStage} />
            </div>
            {alterarStage && (
              <Select value={novoStageId} onValueChange={setNovoStageId}>
                <SelectTrigger><SelectValue placeholder="Selecione o novo stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                        {s.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Alterar scoring?</p>
                <p className="text-xs text-muted-foreground">Atualizar classificação A/B/C/D</p>
              </div>
              <Switch checked={alterarScoring} onCheckedChange={setAlterarScoring} />
            </div>
            {alterarScoring && (
              <div className="flex gap-2">
                {SCORING_OPTIONS.map(s => (
                  <button key={s} onClick={() => setNovoScoring(s)}
                    className={cn("w-12 h-12 rounded-lg border-2 font-bold text-lg transition-all",
                      novoScoring === s
                        ? s === "A" ? "bg-emerald-500 text-white border-emerald-600"
                        : s === "B" ? "bg-blue-500 text-white border-blue-600"
                        : s === "C" ? "bg-amber-500 text-white border-amber-600"
                        : "bg-red-500 text-white border-red-600"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50")}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeModal} disabled={createLigacao.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!prospectoId || !status || createLigacao.isPending} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            {createLigacao.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Ligação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {agendamentoLeadId && (
      <AgendamentoLeadModal
        isOpen={agendamentoOpen}
        onClose={() => { setAgendamentoOpen(false); setAgendamentoLeadId(null); }}
        leadId={agendamentoLeadId}
        leadNome={agendamentoLeadNome}
        onSaved={handleAgendamentoSaved}
      />
    )}
    </>
  );
}
