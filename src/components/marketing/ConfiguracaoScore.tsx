import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

interface ScoreConfig {
  cpl_otimo: number;
  cpl_bom: number;
  cpl_aceitavel: number;
  ctr_otimo: number;
  ctr_bom: number;
  ctr_aceitavel: number;
  peso_cpl: number;
  peso_ctr: number;
  peso_leads: number;
  peso_consistencia: number;
  leads_minimo: number;
  gasto_alerta_sem_leads: number;
  tag_escalar: string;
  tag_manter: string;
  tag_monitorar: string;
  tag_pausar: string;
  cor_escalar: string;
  cor_manter: string;
  cor_monitorar: string;
  cor_pausar: string;
}

const DEFAULTS: ScoreConfig = {
  cpl_otimo: 5, cpl_bom: 8, cpl_aceitavel: 15,
  ctr_otimo: 2, ctr_bom: 1.2, ctr_aceitavel: 0.8,
  peso_cpl: 40, peso_ctr: 30, peso_leads: 20, peso_consistencia: 10,
  leads_minimo: 1, gasto_alerta_sem_leads: 20,
  tag_escalar: "Escalar", tag_manter: "Manter", tag_monitorar: "Monitorar", tag_pausar: "Pausar",
  cor_escalar: "#22c55e", cor_manter: "#3b82f6", cor_monitorar: "#f59e0b", cor_pausar: "#ef4444",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfiguracaoScore({ isOpen, onClose }: Props) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const [config, setConfig] = useState<ScoreConfig>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !orgId) return;
    setLoading(true);
    supabase
      .from("marketing_score_config" as any)
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setConfig({
            cpl_otimo: Number(d.cpl_otimo) || DEFAULTS.cpl_otimo,
            cpl_bom: Number(d.cpl_bom) || DEFAULTS.cpl_bom,
            cpl_aceitavel: Number(d.cpl_aceitavel) || DEFAULTS.cpl_aceitavel,
            ctr_otimo: Number(d.ctr_otimo) || DEFAULTS.ctr_otimo,
            ctr_bom: Number(d.ctr_bom) || DEFAULTS.ctr_bom,
            ctr_aceitavel: Number(d.ctr_aceitavel) || DEFAULTS.ctr_aceitavel,
            peso_cpl: Number(d.peso_cpl) ?? DEFAULTS.peso_cpl,
            peso_ctr: Number(d.peso_ctr) ?? DEFAULTS.peso_ctr,
            peso_leads: Number(d.peso_leads) ?? DEFAULTS.peso_leads,
            peso_consistencia: Number(d.peso_consistencia) ?? DEFAULTS.peso_consistencia,
            leads_minimo: Number(d.leads_minimo) ?? DEFAULTS.leads_minimo,
            gasto_alerta_sem_leads: Number(d.gasto_alerta_sem_leads) || DEFAULTS.gasto_alerta_sem_leads,
            tag_escalar: d.tag_escalar || DEFAULTS.tag_escalar,
            tag_manter: d.tag_manter || DEFAULTS.tag_manter,
            tag_monitorar: d.tag_monitorar || DEFAULTS.tag_monitorar,
            tag_pausar: d.tag_pausar || DEFAULTS.tag_pausar,
            cor_escalar: d.cor_escalar || DEFAULTS.cor_escalar,
            cor_manter: d.cor_manter || DEFAULTS.cor_manter,
            cor_monitorar: d.cor_monitorar || DEFAULTS.cor_monitorar,
            cor_pausar: d.cor_pausar || DEFAULTS.cor_pausar,
          });
        }
        setLoading(false);
      });
  }, [isOpen, orgId]);

  const set = <K extends keyof ScoreConfig>(key: K, val: ScoreConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: val }));

  const pesoTotal = config.peso_cpl + config.peso_ctr + config.peso_leads + config.peso_consistencia;
  const pesoValido = pesoTotal === 100;

  const handleSave = async () => {
    if (!orgId) return;
    if (!pesoValido) {
      toast.error("A soma dos pesos deve ser exatamente 100.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from("marketing_score_config" as any) as any)
      .upsert({ organization_id: orgId, ...config, atualizado_em: new Date().toISOString() }, { onConflict: "organization_id" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Configurações salvas com sucesso!");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração do Score de Criativos</DialogTitle>
          <DialogDescription>
            Defina os critérios que fazem sentido para a operação da Descompliquei
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* SEÇÃO 1: CPL */}
            <div>
              <h3 className="text-sm font-semibold mb-3">CPL — Custo por Lead (R$)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Ótimo (abaixo de)</Label>
                  <Input type="number" step="0.50" value={config.cpl_otimo} onChange={(e) => set("cpl_otimo", Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bom (abaixo de)</Label>
                  <Input type="number" step="0.50" value={config.cpl_bom} onChange={(e) => set("cpl_bom", Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Aceitável (abaixo de)</Label>
                  <Input type="number" step="0.50" value={config.cpl_aceitavel} onChange={(e) => set("cpl_aceitavel", Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">CPL acima de {fmt(config.cpl_aceitavel)} será considerado ruim</p>
            </div>

            {/* SEÇÃO 2: CTR */}
            <div>
              <h3 className="text-sm font-semibold mb-3">CTR — Taxa de Clique (%)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Ótimo (acima de)</Label>
                  <Input type="number" step="0.10" value={config.ctr_otimo} onChange={(e) => set("ctr_otimo", Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bom (acima de)</Label>
                  <Input type="number" step="0.10" value={config.ctr_bom} onChange={(e) => set("ctr_bom", Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Aceitável (acima de)</Label>
                  <Input type="number" step="0.10" value={config.ctr_aceitavel} onChange={(e) => set("ctr_aceitavel", Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">CTR abaixo de {config.ctr_aceitavel}% será considerado ruim</p>
            </div>

            {/* SEÇÃO 3: PESOS */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Pesos do Score (total deve ser 100)</h3>
              <div className="space-y-4">
                {([
                  ["CPL", "peso_cpl"],
                  ["CTR", "peso_ctr"],
                  ["Volume de Leads", "peso_leads"],
                  ["Consistência", "peso_consistencia"],
                ] as const).map(([label, key]) => (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-sm w-36 flex-shrink-0">{label}</span>
                    <Slider
                      value={[config[key]]}
                      onValueChange={([v]) => set(key, v)}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-10 text-right">{config[key]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pesoValido ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(pesoTotal, 100)}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${pesoValido ? "text-emerald-600" : "text-red-500"}`}>
                  {pesoTotal}/100
                </span>
              </div>
            </div>

            {/* SEÇÃO 4: REGRAS OPERACIONAIS */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Regras Operacionais</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Leads mínimos para entrar no ranking</Label>
                  <Input type="number" min={0} value={config.leads_minimo} onChange={(e) => set("leads_minimo", Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Alertar sem leads com gasto acima de (R$)</Label>
                  <Input type="number" step="5" min={0} value={config.gasto_alerta_sem_leads} onChange={(e) => set("gasto_alerta_sem_leads", Number(e.target.value))} className="mt-1" />
                </div>
              </div>
            </div>

            {/* SEÇÃO 5: TAGS */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Tags de Decisão</h3>
              <div className="space-y-2">
                {([
                  ["tag_escalar", "cor_escalar"],
                  ["tag_manter", "cor_manter"],
                  ["tag_monitorar", "cor_monitorar"],
                  ["tag_pausar", "cor_pausar"],
                ] as const).map(([tagKey, corKey]) => (
                  <div key={tagKey} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config[corKey]}
                      onChange={(e) => set(corKey, e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer p-0.5"
                    />
                    <Input
                      value={config[tagKey]}
                      onChange={(e) => set(tagKey, e.target.value)}
                      className="flex-1"
                    />
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold text-white min-w-[80px] text-center"
                      style={{ backgroundColor: config[corKey] }}
                    >
                      {config[tagKey]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* PREVIEW */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-semibold mb-2">Preview das regras</p>
              <div className="space-y-1.5 text-sm">
                <p>
                  <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: config.cor_escalar }} />
                  <strong>{config.tag_escalar}:</strong> CPL &lt; {fmt(config.cpl_otimo)} e CTR &gt; {config.ctr_otimo}%
                </p>
                <p>
                  <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: config.cor_manter }} />
                  <strong>{config.tag_manter}:</strong> CPL &lt; {fmt(config.cpl_bom)} e CTR &gt; {config.ctr_bom}%
                </p>
                <p>
                  <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: config.cor_monitorar }} />
                  <strong>{config.tag_monitorar}:</strong> CPL &lt; {fmt(config.cpl_aceitavel)} ou CTR baixo
                </p>
                <p>
                  <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: config.cor_pausar }} />
                  <strong>{config.tag_pausar}:</strong> CPL &gt; {fmt(config.cpl_aceitavel)} ou sem leads com gasto &gt; {fmt(config.gasto_alerta_sem_leads)}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !pesoValido}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
