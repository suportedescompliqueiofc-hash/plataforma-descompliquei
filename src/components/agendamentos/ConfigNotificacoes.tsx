import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Plus, Trash2, Clock, MessageSquare, Users, History, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Lembrete {
  ativo: boolean;
  minutos_antes: number;
}

interface ConfigData {
  id?: string;
  organization_id: string;
  notif_ativa: boolean;
  lembretes: Lembrete[];
  mensagem_lembrete: string;
  notif_confirmacao_ativa: boolean;
  mensagem_confirmacao: string;
  notif_interna_ativa: boolean;
  notif_interna_minutos_antes: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "2 horas", value: 120 },
  { label: "24 horas", value: 1440 },
  { label: "48 horas", value: 2880 },
];

const VARIAVEIS = [
  { key: "{nome}", desc: "Nome do lead" },
  { key: "{data}", desc: "Data da reunião" },
  { key: "{hora}", desc: "Hora da reunião" },
  { key: "{tempo}", desc: "Tempo relativo" },
  { key: "{titulo}", desc: "Título do agendamento" },
];

const DADOS_FICTICIOS: Record<string, string> = {
  "{nome}": "Maria Silva",
  "{data}": "quarta-feira, 07 de maio",
  "{hora}": "14:30",
  "{tempo}": "amanhã",
  "{titulo}": "Consulta de Avaliação",
};

function formatMinutos(min: number): string {
  if (min < 60) return `${min} minutos antes`;
  if (min === 60) return "1 hora antes";
  if (min < 1440) return `${Math.round(min / 60)} horas antes`;
  if (min === 1440) return "1 dia antes";
  return `${Math.round(min / 1440)} dias antes`;
}

function substituirPreview(template: string): string {
  let msg = template;
  for (const [key, val] of Object.entries(DADOS_FICTICIOS)) {
    msg = msg.replaceAll(key, val);
  }
  return msg;
}

const DEFAULT_CONFIG: Omit<ConfigData, "organization_id"> = {
  notif_ativa: true,
  lembretes: [
    { ativo: true, minutos_antes: 1440 },
    { ativo: true, minutos_antes: 60 },
  ],
  mensagem_lembrete: "Olá {nome}! Lembramos que você tem uma reunião agendada para {data} às {hora}. Confirme sua presença respondendo SIM.",
  notif_confirmacao_ativa: true,
  mensagem_confirmacao: 'Olá {nome}! Sua reunião "{titulo}" foi confirmada para {data} às {hora}. Te esperamos!',
  notif_interna_ativa: true,
  notif_interna_minutos_antes: 30,
};

export default function ConfigNotificacoes({ isOpen, onClose }: Props) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [activeTextarea, setActiveTextarea] = useState<"lembrete" | "confirmacao" | null>(null);

  const { data: configDb, isLoading } = useQuery({
    queryKey: ["agendamento-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamento_config_notificacoes")
        .select("*")
        .eq("organization_id", orgId!)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!orgId && isOpen,
  });

  const { data: historicoLog = [] } = useQuery({
    queryKey: ["agendamento-notif-log", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamento_notif_log")
        .select("*, lead:leads(nome)")
        .eq("organization_id", orgId!)
        .order("criado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && isOpen,
  });

  useEffect(() => {
    if (!orgId) return;
    if (configDb) {
      const lembretes = Array.isArray(configDb.lembretes) ? configDb.lembretes : DEFAULT_CONFIG.lembretes;
      setConfig({
        id: configDb.id,
        organization_id: orgId,
        notif_ativa: configDb.notif_ativa ?? true,
        lembretes: lembretes as Lembrete[],
        mensagem_lembrete: configDb.mensagem_lembrete || DEFAULT_CONFIG.mensagem_lembrete,
        notif_confirmacao_ativa: configDb.notif_confirmacao_ativa ?? true,
        mensagem_confirmacao: configDb.mensagem_confirmacao || DEFAULT_CONFIG.mensagem_confirmacao,
        notif_interna_ativa: configDb.notif_interna_ativa ?? true,
        notif_interna_minutos_antes: configDb.notif_interna_minutos_antes ?? 30,
      });
    } else if (!isLoading) {
      setConfig({ organization_id: orgId, ...DEFAULT_CONFIG });
    }
  }, [configDb, orgId, isLoading]);

  function updateLembrete(index: number, updates: Partial<Lembrete>) {
    if (!config) return;
    const lembretes = [...config.lembretes];
    lembretes[index] = { ...lembretes[index], ...updates };
    setConfig({ ...config, lembretes });
  }

  function addLembrete() {
    if (!config || config.lembretes.length >= 5) return;
    setConfig({ ...config, lembretes: [...config.lembretes, { ativo: true, minutos_antes: 30 }] });
  }

  function removeLembrete(index: number) {
    if (!config) return;
    setConfig({ ...config, lembretes: config.lembretes.filter((_, i) => i !== index) });
  }

  function insertVariable(varKey: string) {
    if (!config || !activeTextarea) return;
    const field = activeTextarea === "lembrete" ? "mensagem_lembrete" : "mensagem_confirmacao";
    setConfig({ ...config, [field]: config[field] + varKey });
  }

  async function handleSalvar() {
    if (!config || !orgId) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        notif_ativa: config.notif_ativa,
        lembretes: config.lembretes,
        mensagem_lembrete: config.mensagem_lembrete,
        notif_confirmacao_ativa: config.notif_confirmacao_ativa,
        mensagem_confirmacao: config.mensagem_confirmacao,
        notif_interna_ativa: config.notif_interna_ativa,
        notif_interna_minutos_antes: config.notif_interna_minutos_antes,
        atualizado_em: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase
          .from("agendamento_config_notificacoes")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agendamento_config_notificacoes")
          .insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["agendamento-config", orgId] });
      toast.success("Configurações salvas com sucesso!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    }
    setSaving(false);
  }

  const previewLembrete = useMemo(() => config ? substituirPreview(config.mensagem_lembrete) : "", [config?.mensagem_lembrete]);
  const previewConfirmacao = useMemo(() => config ? substituirPreview(config.mensagem_confirmacao) : "", [config?.mensagem_confirmacao]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Configurar Notificações
          </DialogTitle>
        </DialogHeader>

        {isLoading || !config ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {/* ━━━ SEÇÃO 1: LEMBRETES AUTOMÁTICOS ━━━ */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold">Lembretes Automáticos</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="notif-ativa" className="text-sm text-muted-foreground">Notificações ativas</Label>
                  <Switch
                    id="notif-ativa"
                    checked={config.notif_ativa}
                    onCheckedChange={(v) => setConfig({ ...config, notif_ativa: v })}
                  />
                </div>
              </div>

              {config.notif_ativa && (
                <div className="space-y-3">
                  {config.lembretes.map((lembrete, i) => (
                    <Card key={i} className="rounded-xl shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={lembrete.ativo}
                              onCheckedChange={(v) => updateLembrete(i, { ativo: v })}
                            />
                            <span className="text-sm font-medium">
                              {formatMinutos(lembrete.minutos_antes)}
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeLembrete(i)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {PRESETS.map((p) => (
                            <Badge
                              key={p.value}
                              variant={lembrete.minutos_antes === p.value ? "default" : "outline"}
                              className="cursor-pointer text-xs"
                              onClick={() => updateLembrete(i, { minutos_antes: p.value })}
                            >
                              {p.label}
                            </Badge>
                          ))}
                          <Input
                            type="number"
                            className="w-24 h-7 text-xs"
                            value={lembrete.minutos_antes}
                            onChange={(e) => updateLembrete(i, { minutos_antes: parseInt(e.target.value) || 15 })}
                            min={1}
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {config.lembretes.length < 5 && (
                    <Button variant="outline" size="sm" onClick={addLembrete} className="w-full">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar lembrete
                    </Button>
                  )}
                </div>
              )}
            </section>

            <Separator />

            {/* ━━━ SEÇÃO 2: MENSAGEM DO LEMBRETE ━━━ */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold">Mensagem do Lembrete</h3>
              </div>
              <Textarea
                value={config.mensagem_lembrete}
                onChange={(e) => setConfig({ ...config, mensagem_lembrete: e.target.value })}
                onFocus={() => setActiveTextarea("lembrete")}
                rows={3}
                placeholder="Escreva a mensagem de lembrete..."
              />
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">Variáveis:</span>
                {VARIAVEIS.map((v) => (
                  <Badge
                    key={v.key}
                    variant="secondary"
                    className="cursor-pointer text-xs hover:bg-blue-100"
                    onClick={() => insertVariable(v.key)}
                    title={v.desc}
                  >
                    {v.key}
                  </Badge>
                ))}
              </div>
              <Card className="rounded-lg bg-green-50 border-green-200">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <p className="text-sm">{previewLembrete}</p>
                </CardContent>
              </Card>
            </section>

            <Separator />

            {/* ━━━ SEÇÃO 3: CONFIRMAÇÃO IMEDIATA ━━━ */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <h3 className="font-semibold">Confirmação Imediata</h3>
                </div>
                <Switch
                  checked={config.notif_confirmacao_ativa}
                  onCheckedChange={(v) => setConfig({ ...config, notif_confirmacao_ativa: v })}
                />
              </div>
              {config.notif_confirmacao_ativa && (
                <>
                  <Textarea
                    value={config.mensagem_confirmacao}
                    onChange={(e) => setConfig({ ...config, mensagem_confirmacao: e.target.value })}
                    onFocus={() => setActiveTextarea("confirmacao")}
                    rows={3}
                    placeholder="Mensagem enviada ao confirmar agendamento..."
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-1">Variáveis:</span>
                    {VARIAVEIS.map((v) => (
                      <Badge
                        key={v.key}
                        variant="secondary"
                        className="cursor-pointer text-xs hover:bg-blue-100"
                        onClick={() => insertVariable(v.key)}
                        title={v.desc}
                      >
                        {v.key}
                      </Badge>
                    ))}
                  </div>
                  <Card className="rounded-lg bg-green-50 border-green-200">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                      <p className="text-sm">{previewConfirmacao}</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </section>

            <Separator />

            {/* ━━━ SEÇÃO 4: NOTIFICAÇÃO INTERNA ━━━ */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <h3 className="font-semibold">Notificação Interna do Time</h3>
                </div>
                <Switch
                  checked={config.notif_interna_ativa}
                  onCheckedChange={(v) => setConfig({ ...config, notif_interna_ativa: v })}
                />
              </div>
              {config.notif_interna_ativa && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Alertar</Label>
                    <Input
                      type="number"
                      className="w-20"
                      value={config.notif_interna_minutos_antes}
                      onChange={(e) => setConfig({ ...config, notif_interna_minutos_antes: parseInt(e.target.value) || 30 })}
                      min={5}
                    />
                    <Label className="text-sm whitespace-nowrap">minutos antes</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aparecerá como notificação no CRM para todos os usuários da organização.
                  </p>
                </div>
              )}
            </section>

            <Separator />

            {/* ━━━ SEÇÃO 5: HISTÓRICO RECENTE ━━━ */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold">Histórico Recente</h3>
              </div>
              {historicoLog.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Data/Hora</th>
                        <th className="text-left p-2 font-medium">Lead</th>
                        <th className="text-left p-2 font-medium">Tipo</th>
                        <th className="text-left p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoLog.map((log: any) => (
                        <tr key={log.id} className="border-t">
                          <td className="p-2 text-muted-foreground">
                            {log.criado_em ? format(parseISO(log.criado_em), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                          </td>
                          <td className="p-2">{log.lead?.nome || "—"}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-xs">{log.tipo}</Badge>
                          </td>
                          <td className="p-2">
                            <Badge
                              className="text-xs text-white"
                              style={{ backgroundColor: log.status === "enviado" ? "#10b981" : "#ef4444" }}
                            >
                              {log.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma notificação enviada ainda.
                </p>
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving || isLoading}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
