import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useOutboundProspectos, OutboundProspecto } from "@/hooks/useOutboundProspectos";
import { useOutboundStages } from "@/hooks/useOutboundStages";
import { useOrgUsers } from "@/hooks/useOrgUsers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospecto?: OutboundProspecto | null;
}

const ESPECIALIDADES = [
  { value: "HOF", label: "HOF (Harmonização Orofacial)" },
  { value: "odonto_estetica", label: "Odontologia Estética" },
  { value: "med_estetica", label: "Medicina Estética" },
  { value: "cirurgia_plastica", label: "Cirurgia Plástica" },
  { value: "outro", label: "Outro" },
];

const FATURAMENTO = [
  { value: "abaixo_30k", label: "Abaixo de R$30k" },
  { value: "30_60k", label: "R$30k – R$60k" },
  { value: "60_100k", label: "R$60k – R$100k" },
  { value: "acima_100k", label: "Acima de R$100k" },
];

const TEMPO_MERCADO = [
  { value: "menos_1ano", label: "Menos de 1 ano" },
  { value: "1_3anos", label: "1–3 anos" },
  { value: "3_5anos", label: "3–5 anos" },
  { value: "mais_5anos", label: "Mais de 5 anos" },
];

const CANAIS_ORIGEM = [
  { value: "google_maps", label: "Google Maps" },
  { value: "instagram", label: "Instagram" },
  { value: "base_comprada", label: "Base comprada" },
  { value: "indicacao", label: "Indicação" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

const SCORING_OPTIONS = [
  { value: "A", label: "A — Lead dos sonhos" },
  { value: "B", label: "B — Qualificado com ressalva" },
  { value: "C", label: "C — Em desenvolvimento" },
  { value: "D", label: "D — Fora do ICP" },
];

const emptyForm = {
  nome: "",
  telefone: "",
  email: "",
  clinica: "",
  cidade: "",
  especialidade: "",
  faturamento_estimado: "",
  tamanho_equipe: "",
  tempo_mercado: "",
  canal_origem: "",
  usuario_id: "",
  stage_id: "",
  observacoes: "",
  lead_scoring: "",
};

export function ProspectoFormModal({ open, onOpenChange, prospecto }: Props) {
  const [form, setForm] = useState(emptyForm);
  const { createProspecto, updateProspecto } = useOutboundProspectos();
  const { stages } = useOutboundStages();
  const { users } = useOrgUsers();
  const isEditing = !!prospecto;

  useEffect(() => {
    if (prospecto) {
      setForm({
        nome: prospecto.nome || "",
        telefone: prospecto.telefone || "",
        email: prospecto.email || "",
        clinica: prospecto.clinica || "",
        cidade: prospecto.cidade || "",
        especialidade: prospecto.especialidade || "",
        faturamento_estimado: prospecto.faturamento_estimado || "",
        tamanho_equipe: prospecto.tamanho_equipe?.toString() || "",
        tempo_mercado: prospecto.tempo_mercado || "",
        canal_origem: prospecto.canal_origem || "",
        usuario_id: prospecto.usuario_id || "",
        stage_id: prospecto.stage_id || "",
        observacoes: prospecto.observacoes || "",
        lead_scoring: prospecto.lead_scoring || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [prospecto, open]);

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.telefone.trim() || !form.clinica.trim()) return;

    const payload: any = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      email: form.email.trim() || null,
      clinica: form.clinica.trim() || null,
      cidade: form.cidade.trim() || null,
      especialidade: form.especialidade || null,
      faturamento_estimado: form.faturamento_estimado || null,
      tamanho_equipe: form.tamanho_equipe ? parseInt(form.tamanho_equipe) : null,
      tempo_mercado: form.tempo_mercado || null,
      canal_origem: form.canal_origem || null,
      usuario_id: form.usuario_id || null,
      stage_id: form.stage_id || null,
      observacoes: form.observacoes.trim() || null,
      lead_scoring: form.lead_scoring || null,
    };

    if (isEditing) {
      await updateProspecto.mutateAsync({ id: prospecto!.id, ...payload });
    } else {
      await createProspecto.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const isPending = createProspecto.isPending || updateProspecto.isPending;

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Prospecto" : "Novo Prospecto"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label>Telefone *</Label>
            <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="5511999999999" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@clinica.com" type="email" />
          </div>
          <div className="space-y-2">
            <Label>Clínica *</Label>
            <Input value={form.clinica} onChange={e => set("clinica", e.target.value)} placeholder="Nome da clínica" />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={e => set("cidade", e.target.value)} placeholder="São Paulo" />
          </div>
          <div className="space-y-2">
            <Label>Especialidade</Label>
            <Select value={form.especialidade} onValueChange={v => set("especialidade", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ESPECIALIDADES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Faturamento Estimado</Label>
            <Select value={form.faturamento_estimado} onValueChange={v => set("faturamento_estimado", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FATURAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tamanho da Equipe</Label>
            <Input value={form.tamanho_equipe} onChange={e => set("tamanho_equipe", e.target.value)} placeholder="5" type="number" />
          </div>
          <div className="space-y-2">
            <Label>Tempo de Mercado</Label>
            <Select value={form.tempo_mercado} onValueChange={v => set("tempo_mercado", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TEMPO_MERCADO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Canal de Origem</Label>
            <Select value={form.canal_origem} onValueChange={v => set("canal_origem", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CANAIS_ORIGEM.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>SDR Responsável</Label>
            <Select value={form.usuario_id} onValueChange={v => set("usuario_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome_completo || "Sem nome"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Stage Inicial</Label>
            <Select value={form.stage_id} onValueChange={v => set("stage_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {stages.filter(s => s.tipo === 'ativo').map(s => (
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
          <div className="space-y-2">
            <Label>Scoring Inicial</Label>
            <Select value={form.lead_scoring} onValueChange={v => set("lead_scoring", v)}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {SCORING_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Anotações sobre o prospecto..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.nome.trim() || !form.telefone.trim() || !form.clinica.trim()} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar" : "Criar Prospecto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
