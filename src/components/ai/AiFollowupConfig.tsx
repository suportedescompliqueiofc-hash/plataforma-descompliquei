import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

interface SequenciaItem {
  ordem: number;
  minutos: number;
  ativo: boolean;
}

interface FollowupConfig {
  id?: string;
  organization_id: string;
  ativo: boolean;
  sequencia: SequenciaItem[];
  apenas_marketing: boolean;
  respeitar_horario_atendimento: boolean;
}

const DEFAULT_SEQUENCIA: SequenciaItem[] = [
  { ordem: 1, minutos: 30, ativo: true },
  { ordem: 2, minutos: 120, ativo: true },
  { ordem: 3, minutos: 1440, ativo: false },
];

const PRESETS: Record<number, { label: string; value: number }[]> = {
  1: [
    { label: "15min", value: 15 },
    { label: "30min", value: 30 },
    { label: "1h", value: 60 },
    { label: "2h", value: 120 },
  ],
  2: [
    { label: "1h", value: 60 },
    { label: "2h", value: 120 },
    { label: "4h", value: 240 },
    { label: "8h", value: 480 },
  ],
  3: [
    { label: "12h", value: 720 },
    { label: "1 dia", value: 1440 },
    { label: "2 dias", value: 2880 },
    { label: "3 dias", value: 4320 },
  ],
};

function getPresetsForOrder(ordem: number) {
  if (ordem <= 1) return PRESETS[1];
  if (ordem === 2) return PRESETS[2];
  return PRESETS[3];
}

function formatMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  if (minutos < 1440) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  const d = Math.floor(minutos / 1440);
  const h = Math.floor((minutos % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export function AiFollowupConfig() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localConfig, setLocalConfig] = useState<FollowupConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["followup-config", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("ia_followup_config")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as FollowupConfig | null;
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (config) {
      setLocalConfig({
        ...config,
        sequencia: Array.isArray(config.sequencia)
          ? (config.sequencia as SequenciaItem[])
          : DEFAULT_SEQUENCIA,
      });
    } else if (!isLoading && orgId) {
      setLocalConfig({
        organization_id: orgId,
        ativo: false,
        sequencia: DEFAULT_SEQUENCIA,
        apenas_marketing: true,
        respeitar_horario_atendimento: true,
      });
    }
  }, [config, isLoading, orgId]);

  const saveMutation = useMutation({
    mutationFn: async (newConfig: FollowupConfig) => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase
        .from("ia_followup_config")
        .upsert(
          {
            organization_id: orgId,
            ativo: newConfig.ativo,
            sequencia: newConfig.sequencia,
            apenas_marketing: newConfig.apenas_marketing,
            respeitar_horario_atendimento: newConfig.respeitar_horario_atendimento,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: "organization_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-config", orgId] });
      toast.success("Configuração salva");
    },
    onError: () => {
      toast.error("Erro ao salvar configuração de follow-up");
    },
    onSettled: () => setIsSaving(false),
  });

  const debouncedSave = useCallback(
    (newConfig: FollowupConfig) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setIsSaving(true);
        saveMutation.mutate(newConfig);
      }, 1000);
    },
    [saveMutation],
  );

  const updateConfig = useCallback(
    (updater: (prev: FollowupConfig) => FollowupConfig) => {
      setLocalConfig((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const updateSequenciaItem = useCallback(
    (ordem: number, patch: Partial<SequenciaItem>) => {
      updateConfig((prev) => ({
        ...prev,
        sequencia: prev.sequencia.map((s) =>
          s.ordem === ordem ? { ...s, ...patch } : s,
        ),
      }));
    },
    [updateConfig],
  );

  const addTentativa = useCallback(() => {
    updateConfig((prev) => {
      if (prev.sequencia.length >= 5) return prev;
      const novaOrdem = prev.sequencia.length + 1;
      return {
        ...prev,
        sequencia: [...prev.sequencia, { ordem: novaOrdem, minutos: 1440, ativo: true }],
      };
    });
  }, [updateConfig]);

  const removeTentativa = useCallback(
    (ordem: number) => {
      updateConfig((prev) => {
        if (prev.sequencia.length <= 1) return prev;
        const filtered = prev.sequencia
          .filter((s) => s.ordem !== ordem)
          .map((s, i) => ({ ...s, ordem: i + 1 }));
        return { ...prev, sequencia: filtered };
      });
    },
    [updateConfig],
  );

  if (!orgId || isLoading || !localConfig) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ativosCount = localConfig.sequencia.filter((s) => s.ativo).length;

  return (
    <div
      data-tutorial="ia-followup-config"
      className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-muted">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  CONFIGURAÇÃO DO FOLLOW-UP
                </p>
                {isSaving && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                {ativosCount} tentativa{ativosCount !== 1 ? "s" : ""} ativa
                {ativosCount !== 1 ? "s" : ""} na sequência
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`text-[11px] font-medium transition-colors ${
                localConfig.ativo ? "text-green-600" : "text-muted-foreground/50"
              }`}
            >
              {localConfig.ativo ? "Ativo" : "Inativo"}
            </span>
            <Switch
              checked={localConfig.ativo}
              onCheckedChange={(checked) =>
                updateConfig((prev) => ({ ...prev, ativo: checked }))
              }
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Sequence */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
            SEQUÊNCIA DE ENVIOS
          </p>

          <div className="space-y-2">
            {localConfig.sequencia.map((item, idx) => (
              <div key={item.ordem} className="relative">
                {idx < localConfig.sequencia.length - 1 && (
                  <div className="absolute left-[19px] top-full w-px h-2 bg-border/50 z-0" />
                )}
                <div
                  className={`rounded-xl border p-3.5 transition-colors ${
                    item.ativo
                      ? "border-border/60 bg-card"
                      : "border-border/40 bg-muted/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Step badge */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold font-display tabular-nums transition-colors ${
                        item.ativo
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground/40"
                      }`}
                    >
                      {item.ordem}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold">
                            {item.ordem}ª tentativa
                          </span>
                          {!item.ativo && (
                            <span className="text-[10px] text-muted-foreground/40">
                              desativada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {localConfig.sequencia.length > 1 && (
                            <button
                              onClick={() => removeTentativa(item.ordem)}
                              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                          <Switch
                            checked={item.ativo}
                            onCheckedChange={(checked) =>
                              updateSequenciaItem(item.ordem, { ativo: checked })
                            }
                          />
                        </div>
                      </div>

                      {/* Timer */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {idx === 0 ? "Após" : "Depois de mais"}
                        </span>
                        <Input
                          type="number"
                          min={1}
                          className="h-7 w-[68px] text-xs font-display tabular-nums text-center rounded-lg border-border/60"
                          value={item.minutos}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1) {
                              updateSequenciaItem(item.ordem, { minutos: val });
                            }
                          }}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          min sem resposta
                        </span>
                        <span className="ml-auto text-[11px] font-display font-semibold text-muted-foreground bg-muted/60 rounded-md px-1.5 py-0.5 tabular-nums">
                          {formatMinutos(item.minutos)}
                        </span>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1">
                        {getPresetsForOrder(item.ordem).map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() =>
                              updateSequenciaItem(item.ordem, { minutos: preset.value })
                            }
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
                              item.minutos === preset.value
                                ? "bg-foreground text-background"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {localConfig.sequencia.length < 5 && (
            <button
              onClick={addTentativa}
              className="mt-2.5 w-full h-9 rounded-xl border border-dashed border-border/60 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar tentativa
            </button>
          )}
        </div>

        {/* Behavior options */}
        <div className="pt-4 border-t border-border/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
            COMPORTAMENTO
          </p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              id="respeitar-horario"
              checked={localConfig.respeitar_horario_atendimento}
              onCheckedChange={(checked) =>
                updateConfig((prev) => ({
                  ...prev,
                  respeitar_horario_atendimento: checked === true,
                }))
              }
              className="mt-0.5"
            />
            <div>
              <p className="text-[12px] font-medium text-foreground leading-none mb-0.5">
                Respeitar horário de atendimento
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                Não envia follow-ups fora do horário configurado na IA
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
