import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Bot,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface FollowupLog {
  id: string;
  lead_id: string;
  tentativa: number;
  status: string;
  mensagem_enviada: string | null;
  motivo_ia: string | null;
  enviado_em: string;
  leads: { nome: string | null; telefone: string | null } | null;
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

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  enviado: { label: "Enviado", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />, color: "text-green-600" },
  ignorado_ia: { label: "IA ignorou", icon: <Bot className="h-3.5 w-3.5 text-blue-500" />, color: "text-blue-600" },
  fora_horario: { label: "Fora do horário", icon: <Clock className="h-3.5 w-3.5 text-amber-500" />, color: "text-amber-600" },
  lead_respondeu: { label: "Lead respondeu", icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, color: "text-emerald-600" },
  erro: { label: "Erro", icon: <XCircle className="h-3.5 w-3.5 text-red-500" />, color: "text-red-600" },
};

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

  const { data: logs } = useQuery({
    queryKey: ["followup-logs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("ia_followup_log")
        .select("*, leads!lead_id(nome, telefone)")
        .eq("organization_id", orgId)
        .order("enviado_em", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as FollowupLog[];
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
      const payload = {
        organization_id: orgId,
        ativo: newConfig.ativo,
        sequencia: newConfig.sequencia,
        apenas_marketing: newConfig.apenas_marketing,
        respeitar_horario_atendimento: newConfig.respeitar_horario_atendimento,
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("ia_followup_config")
        .upsert(payload, { onConflict: "organization_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-config", orgId] });
      toast.success("Follow-up salvo com sucesso");
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
        sequencia: [
          ...prev.sequencia,
          { ordem: novaOrdem, minutos: 1440, ativo: true },
        ],
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
      <Card className="border-sidebar-border p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-sidebar-border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Follow-up Automatico com IA</h3>
            {isSaving && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A IA analisa o contexto e envia follow-ups humanizados para leads que sumiram durante o atendimento
          </p>
        </div>
        <Switch
          checked={localConfig.ativo}
          onCheckedChange={(checked) =>
            updateConfig((prev) => ({ ...prev, ativo: checked }))
          }
        />
      </div>

      {/* Body */}
      <div className="space-y-4 p-4">
        {/* Sequência */}
        <div>
          <Label className="text-xs font-semibold">Sequencia de Follow-ups</Label>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Configure quando cada follow-up sera enviado
          </p>

          <div className="space-y-3">
            {localConfig.sequencia.map((item) => (
              <div
                key={item.ordem}
                className="rounded-lg border bg-muted/20 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    {item.ordem}a tentativa
                  </span>
                  <div className="flex items-center gap-2">
                    {localConfig.sequencia.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTentativa(item.ordem)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Switch
                      checked={item.ativo}
                      onCheckedChange={(checked) =>
                        updateSequenciaItem(item.ordem, { ativo: checked })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Enviar apos:
                  </span>
                  <Input
                    type="number"
                    min={5}
                    className="h-7 w-20 text-xs"
                    value={item.minutos}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 5) {
                        updateSequenciaItem(item.ordem, { minutos: val });
                      }
                    }}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    minutos
                  </span>
                  <Badge variant="outline" className="ml-auto text-[10px] font-normal">
                    {formatMinutos(item.minutos)}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getPresetsForOrder(item.ordem).map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] transition-colors ${
                        item.minutos === preset.value
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() =>
                        updateSequenciaItem(item.ordem, { minutos: preset.value })
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {localConfig.sequencia.length < 5 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-1.5 text-xs"
              onClick={addTentativa}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar tentativa
            </Button>
          )}
        </div>

        {/* Opções */}
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="respeitar-horario"
              checked={localConfig.respeitar_horario_atendimento}
              onCheckedChange={(checked) =>
                updateConfig((prev) => ({
                  ...prev,
                  respeitar_horario_atendimento: checked === true,
                }))
              }
            />
            <Label htmlFor="respeitar-horario" className="text-xs">
              Respeitar horario de atendimento configurado
            </Label>
          </div>
        </div>

        {/* Logs recentes */}
        {logs && logs.length > 0 && (
          <div className="border-t pt-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Ultimos follow-ups</span>
            </div>
            <div className="space-y-1.5">
              {logs.map((log) => {
                const st = STATUS_MAP[log.status] || STATUS_MAP.erro;
                const leadName =
                  (log.leads as any)?.nome || (log.leads as any)?.telefone || "Lead";
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-[11px]"
                  >
                    {st.icon}
                    <span className="flex-1 truncate font-medium">
                      {leadName}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {log.tentativa}a
                    </Badge>
                    <span className={`${st.color} text-[10px]`}>
                      {st.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(log.enviado_em), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
