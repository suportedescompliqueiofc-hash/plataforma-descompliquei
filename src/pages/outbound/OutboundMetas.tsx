import { useState, useMemo } from "react";
import {
  Target, Phone, PhoneCall, Trophy, Calendar, DollarSign, Banknote,
  Plus, Pencil, Trash2, Loader2, TrendingUp, Rocket, ChevronLeft,
  ChevronRight, BarChart3, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays, isWithinInterval, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import {
  useOutboundMetas, useMetaRealizado, useMetaRealizadoDiario,
  useMetaHistoricoMensal, OutboundMeta, MetaDailyData,
} from "@/hooks/useOutboundMetas";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import {
  BarChart, Bar, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
} from "recharts";

// ==================== Progress Card ====================

interface ProgressCardProps {
  icon: any;
  iconColor: string;
  label: string;
  realizado: number;
  meta: number | null;
  prefix?: string;
  diasPassados: number;
  diasRestantes: number;
  diasTotais: number;
}

function ProgressCard({ icon: Icon, iconColor, label, realizado, meta, prefix = "", diasPassados, diasRestantes, diasTotais }: ProgressCardProps) {
  if (!meta || meta <= 0) return null;
  const pct = Math.min(Math.round((realizado / meta) * 100), 999);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";

  const mediaDiaria = diasPassados > 0 ? (realizado / diasPassados) : 0;
  const projecao = diasPassados > 0 && diasTotais > 0
    ? Math.round(((realizado / diasPassados) * diasTotais / meta) * 100)
    : 0;
  const ritmoNecessario = diasRestantes > 0 ? Math.ceil((meta - realizado) / diasRestantes) : 0;
  const onTrack = projecao >= 90;

  return (
    <Card className="overflow-hidden" style={{ borderTop: `3px solid ${iconColor}` }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconColor + '20' }}>
              <Icon className="h-4 w-4" style={{ color: iconColor }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
          {diasPassados > 0 && (
            <Badge variant="outline" className={cn("text-[10px]", onTrack ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400")}>
              {onTrack ? "No ritmo" : "Atrás"}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{prefix}{realizado.toLocaleString('pt-BR')}</span>
          <span className="text-sm text-muted-foreground">/ {prefix}{meta.toLocaleString('pt-BR')}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className={textColor}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Média: <span className="font-medium text-foreground">{prefix}{mediaDiaria.toFixed(1)}/dia</span>
          </div>
          <div className="flex items-center gap-1">
            <Rocket className="h-3 w-3" />
            Projeção: <span className="font-medium text-foreground">{projecao}%</span>
          </div>
          {diasRestantes > 0 && realizado < meta && (
            <div className="col-span-2 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Ritmo necessário: <span className="font-medium text-foreground">{prefix}{ritmoNecessario}/dia</span>
              <span className="text-muted-foreground/60">({diasRestantes} dias restantes)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Daily Chart ====================

function DailyChart({ diario, metaLigacoes, diasTotais }: { diario: MetaDailyData[]; metaLigacoes: number | null; diasTotais: number }) {
  const chartData = useMemo(() => {
    let acum = 0;
    return diario.map((d, i) => {
      acum += d.ligacoes;
      const idealPace = metaLigacoes ? Math.round((metaLigacoes / diasTotais) * (i + 1)) : null;
      return {
        dia: d.diaNum,
        diaSemana: d.diaSemana,
        ligacoes: d.ligacoes,
        conexoes: d.conexoes,
        acumulado: acum,
        idealPace,
        isFuture: d.isFuture,
      };
    });
  }, [diario, metaLigacoes, diasTotais]);

  if (diario.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily activity */}
      <Card className="rounded-2xl shadow-sm border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Atividade Diária</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis dataKey="dia" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <RechartsTooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', backgroundColor: 'hsl(var(--background))' }}
                labelFormatter={(v) => `Dia ${v}`}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="ligacoes" name="Ligações" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="conexoes" name="Conexões" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cumulative progress vs ideal pace */}
      <Card className="rounded-2xl shadow-sm border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Progresso Acumulado vs Ritmo Ideal</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis dataKey="dia" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <RechartsTooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', backgroundColor: 'hsl(var(--background))' }}
                labelFormatter={(v) => `Dia ${v}`}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="acumulado" name="Realizado" fill="#E85D24" fillOpacity={0.15} stroke="#E85D24" strokeWidth={2.5} dot={false} />
              {metaLigacoes && (
                <Line type="monotone" dataKey="idealPace" name="Ritmo Ideal" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== Daily Table ====================

function DailyTable({ diario }: { diario: MetaDailyData[] }) {
  if (diario.length === 0) return null;

  const totals = useMemo(() => {
    const past = diario.filter(d => !d.isFuture);
    return {
      ligacoes: past.reduce((s, d) => s + d.ligacoes, 0),
      conexoes: past.reduce((s, d) => s + d.conexoes, 0),
      qualificados: past.reduce((s, d) => s + d.qualificados, 0),
      calls_agendadas: past.reduce((s, d) => s + d.calls_agendadas, 0),
    };
  }, [diario]);

  return (
    <Card className="rounded-2xl shadow-sm border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Detalhamento Diário</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Data</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Dia</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Ligações</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Conexões</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Qualificados</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {diario.map(d => (
                <tr
                  key={d.data}
                  className={cn(
                    "transition-colors",
                    d.isToday && "bg-[#E85D24]/5 font-medium",
                    d.isFuture && "opacity-30",
                    d.isWeekend && !d.isToday && "bg-muted/20",
                  )}
                >
                  <td className="px-4 py-2 text-xs">
                    {format(parseISO(d.data), "dd/MM")}
                    {d.isToday && <Badge variant="outline" className="ml-2 text-[9px] border-[#E85D24]/50 text-[#E85D24]">Hoje</Badge>}
                  </td>
                  <td className="px-3 py-2 text-xs capitalize text-muted-foreground">{d.diaSemana}</td>
                  <td className={cn("px-3 py-2 text-xs text-right", d.ligacoes > 0 && "text-indigo-400 font-medium")}>{d.ligacoes || "—"}</td>
                  <td className={cn("px-3 py-2 text-xs text-right", d.conexoes > 0 && "text-emerald-400 font-medium")}>{d.conexoes || "—"}</td>
                  <td className={cn("px-3 py-2 text-xs text-right", d.qualificados > 0 && "text-amber-400 font-medium")}>{d.qualificados || "—"}</td>
                  <td className={cn("px-4 py-2 text-xs text-right", d.calls_agendadas > 0 && "text-blue-400 font-medium")}>{d.calls_agendadas || "—"}</td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                <td className="px-4 py-2.5 text-xs" colSpan={2}>Total</td>
                <td className="px-3 py-2.5 text-xs text-right text-indigo-400">{totals.ligacoes}</td>
                <td className="px-3 py-2.5 text-xs text-right text-emerald-400">{totals.conexoes}</td>
                <td className="px-3 py-2.5 text-xs text-right text-amber-400">{totals.qualificados}</td>
                <td className="px-4 py-2.5 text-xs text-right text-blue-400">{totals.calls_agendadas}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Historical Chart ====================

function HistoricoMensal({ historico }: { historico: { mes: string; mesLabel: string; ligacoes: number; conexoes: number; qualificados: number; calls_agendadas: number; metaLigacoes: number | null }[] }) {
  if (historico.length === 0) return null;

  return (
    <Card className="rounded-2xl shadow-sm border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 pl-3 border-l-[3px] border-[#E85D24]">
            <BarChart3 className="h-4 w-4 text-[#E85D24]" />
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Evolução Mensal</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={historico}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis dataKey="mesLabel" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis allowDecimals={false} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', backgroundColor: 'hsl(var(--background))' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="ligacoes" name="Ligações" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="conexoes" name="Conexões" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="calls_agendadas" name="Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            {historico.some(h => h.metaLigacoes) && (
              <Line type="monotone" dataKey="metaLigacoes" name="Meta Ligações" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: '#ef4444' }} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Mês</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Ligações</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Conexões</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Qualificados</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Calls</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Taxa Conexão</th>
                <th className="text-right px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Var.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {historico.map((h, i) => {
                const prev = i > 0 ? historico[i - 1] : null;
                const variation = prev && prev.ligacoes > 0
                  ? Math.round(((h.ligacoes - prev.ligacoes) / prev.ligacoes) * 100)
                  : null;
                const taxaConexao = h.ligacoes > 0 ? Math.round((h.conexoes / h.ligacoes) * 100) : 0;

                return (
                  <tr key={h.mes} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs font-medium capitalize">{h.mesLabel}</td>
                    <td className="px-3 py-2 text-xs text-right">
                      {h.ligacoes}
                      {h.metaLigacoes && (
                        <span className="text-muted-foreground/60 ml-1">/{h.metaLigacoes}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-right">{h.conexoes}</td>
                    <td className="px-3 py-2 text-xs text-right">{h.qualificados}</td>
                    <td className="px-3 py-2 text-xs text-right">{h.calls_agendadas}</td>
                    <td className="px-3 py-2 text-xs text-right">{taxaConexao}%</td>
                    <td className="px-4 py-2 text-xs text-right">
                      {variation !== null ? (
                        <span className={cn("flex items-center justify-end gap-0.5", variation > 0 ? "text-emerald-400" : variation < 0 ? "text-red-400" : "text-muted-foreground")}>
                          {variation > 0 ? <ArrowUp className="h-3 w-3" /> : variation < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {Math.abs(variation)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Meta Form Modal ====================

const PERIODO_LABELS: Record<string, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
};

interface MetaFormData {
  nome: string;
  tipo: 'org' | 'individual';
  usuario_id: string | null;
  periodo_tipo: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  meta_ligacoes: string;
  meta_conexoes: string;
  meta_qualificados: string;
  meta_calls_agendadas: string;
  meta_show_rate: string;
  meta_fechamentos: string;
  meta_receita: string;
}

const emptyForm: MetaFormData = {
  nome: '', tipo: 'org', usuario_id: null, periodo_tipo: 'mensal',
  data_inicio: '', data_fim: '', ativo: true,
  meta_ligacoes: '', meta_conexoes: '', meta_qualificados: '',
  meta_calls_agendadas: '', meta_show_rate: '', meta_fechamentos: '', meta_receita: '',
};

function MetaFormModal({ open, onOpenChange, editMeta, users, onSubmit, saving }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editMeta: OutboundMeta | null;
  users: { id: string; nome_completo: string | null }[];
  onSubmit: (data: MetaFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<MetaFormData>(emptyForm);

  const resetForm = () => {
    if (editMeta) {
      setForm({
        nome: editMeta.nome,
        tipo: editMeta.usuario_id ? 'individual' : 'org',
        usuario_id: editMeta.usuario_id,
        periodo_tipo: editMeta.periodo_tipo,
        data_inicio: editMeta.data_inicio?.slice(0, 10) || '',
        data_fim: editMeta.data_fim?.slice(0, 10) || '',
        ativo: editMeta.ativo,
        meta_ligacoes: editMeta.meta_ligacoes?.toString() || '',
        meta_conexoes: editMeta.meta_conexoes?.toString() || '',
        meta_qualificados: editMeta.meta_qualificados?.toString() || '',
        meta_calls_agendadas: editMeta.meta_calls_agendadas?.toString() || '',
        meta_show_rate: editMeta.meta_show_rate?.toString() || '',
        meta_fechamentos: editMeta.meta_fechamentos?.toString() || '',
        meta_receita: editMeta.meta_receita?.toString() || '',
      });
    } else {
      setForm(emptyForm);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (o) resetForm();
    onOpenChange(o);
  };

  const valid = form.nome.trim() && form.data_inicio && form.data_fim && form.data_fim > form.data_inicio
    && (form.tipo === 'org' || form.usuario_id);

  const set = (field: keyof MetaFormData, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMeta ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome da meta</Label>
            <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Meta mensal Maio" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => { set('tipo', v); if (v === 'org') set('usuario_id', null); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">Organização</SelectItem>
                  <SelectItem value="individual">Individual (SDR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo === 'individual' && (
              <div className="space-y-1">
                <Label className="text-xs">SDR</Label>
                <Select value={form.usuario_id || ''} onValueChange={v => set('usuario_id', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nome_completo || 'Sem nome'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select value={form.periodo_tipo} onValueChange={v => set('periodo_tipo', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          {form.data_fim && form.data_inicio && form.data_fim <= form.data_inicio && (
            <p className="text-xs text-red-400">Data fim deve ser posterior à data início</p>
          )}
          <div className="border-t pt-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Metas quantitativas (deixe vazio para ignorar)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Ligações</Label>
                <Input type="number" min={0} value={form.meta_ligacoes} onChange={e => set('meta_ligacoes', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conexões</Label>
                <Input type="number" min={0} value={form.meta_conexoes} onChange={e => set('meta_conexoes', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qualificados</Label>
                <Input type="number" min={0} value={form.meta_qualificados} onChange={e => set('meta_qualificados', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Calls agendadas</Label>
                <Input type="number" min={0} value={form.meta_calls_agendadas} onChange={e => set('meta_calls_agendadas', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Show rate (%)</Label>
                <Input type="number" min={0} max={100} value={form.meta_show_rate} onChange={e => set('meta_show_rate', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fechamentos</Label>
                <Input type="number" min={0} value={form.meta_fechamentos} onChange={e => set('meta_fechamentos', e.target.value)} className="h-9 text-sm" placeholder="0" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Receita (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.meta_receita} onChange={e => set('meta_receita', e.target.value)} className="h-9 text-sm" placeholder="0,00" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <Switch checked={form.ativo} onCheckedChange={v => set('ativo', v)} />
            <Label className="text-sm">Meta ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button className="bg-[#E85D24] hover:bg-[#E85D24]/90" disabled={!valid || saving} onClick={() => onSubmit(form)}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editMeta ? 'Salvar' : 'Criar meta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Component ====================

export default function OutboundMetas() {
  const { user } = useAuth();
  const { metas, isLoading, createMeta, updateMeta, deleteMeta } = useOutboundMetas();
  const { users } = useOrgUsers();

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [tab, setTab] = useState<'minha' | 'org' | 'sdr'>('minha');
  const [modalOpen, setModalOpen] = useState(false);
  const [editMetaData, setEditMetaData] = useState<OutboundMeta | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
  const monthLabel = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

  const prevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const nextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  const metaDoMes = useMemo(() => {
    const mesStart = startOfMonth(selectedMonth);
    const mesEnd = endOfMonth(selectedMonth);

    const individual = metas.find(m =>
      m.ativo && m.usuario_id === user?.id &&
      parseISO(m.data_inicio) <= mesEnd && parseISO(m.data_fim) >= mesStart
    );
    if (individual) return individual;

    return metas.find(m =>
      m.ativo && !m.usuario_id &&
      parseISO(m.data_inicio) <= mesEnd && parseISO(m.data_fim) >= mesStart
    ) || null;
  }, [metas, selectedMonth, user?.id]);

  const { data: realizado, isLoading: realizadoLoading } = useMetaRealizado(metaDoMes);
  const { data: diario = [], isLoading: diarioLoading } = useMetaRealizadoDiario(monthStart, monthEnd, metaDoMes?.usuario_id);
  const { data: historico = [] } = useMetaHistoricoMensal(6);

  const diasTotais = useMemo(() => {
    if (!metaDoMes) return 0;
    return Math.max(1, differenceInDays(parseISO(metaDoMes.data_fim), parseISO(metaDoMes.data_inicio)) + 1);
  }, [metaDoMes]);

  const diasPassados = useMemo(() => {
    if (!metaDoMes) return 0;
    return Math.max(0, Math.min(diasTotais, differenceInDays(now, parseISO(metaDoMes.data_inicio)) + 1));
  }, [metaDoMes, diasTotais]);

  const diasRestantes = Math.max(0, diasTotais - diasPassados);

  const filteredMetas = useMemo(() => {
    switch (tab) {
      case 'minha': return metas.filter(m => m.usuario_id === user?.id);
      case 'org': return metas.filter(m => !m.usuario_id);
      case 'sdr': return metas.filter(m => !!m.usuario_id);
    }
  }, [metas, tab, user?.id]);

  const handleSubmit = async (form: MetaFormData) => {
    setSaving(true);
    const payload: any = {
      nome: form.nome.trim(),
      usuario_id: form.tipo === 'individual' ? form.usuario_id : null,
      periodo_tipo: form.periodo_tipo,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      ativo: form.ativo,
      meta_ligacoes: form.meta_ligacoes ? parseInt(form.meta_ligacoes) : null,
      meta_conexoes: form.meta_conexoes ? parseInt(form.meta_conexoes) : null,
      meta_qualificados: form.meta_qualificados ? parseInt(form.meta_qualificados) : null,
      meta_calls_agendadas: form.meta_calls_agendadas ? parseInt(form.meta_calls_agendadas) : null,
      meta_show_rate: form.meta_show_rate ? parseFloat(form.meta_show_rate) : null,
      meta_fechamentos: form.meta_fechamentos ? parseInt(form.meta_fechamentos) : null,
      meta_receita: form.meta_receita ? parseFloat(form.meta_receita) : null,
    };
    try {
      if (editMetaData) {
        await updateMeta.mutateAsync({ id: editMetaData.id, ...payload });
      } else {
        await createMeta.mutateAsync(payload);
      }
      setModalOpen(false);
      setEditMetaData(null);
    } finally {
      setSaving(false);
    }
  };

  const progressCards = metaDoMes && realizado ? [
    { icon: Phone, iconColor: "#6366f1", label: "Ligações", realizado: realizado.ligacoes, meta: metaDoMes.meta_ligacoes },
    { icon: PhoneCall, iconColor: "#22c55e", label: "Conexões", realizado: realizado.conexoes, meta: metaDoMes.meta_conexoes },
    { icon: Trophy, iconColor: "#f59e0b", label: "Qualificados", realizado: realizado.qualificados, meta: metaDoMes.meta_qualificados },
    { icon: Calendar, iconColor: "#3b82f6", label: "Calls agendadas", realizado: realizado.calls_agendadas, meta: metaDoMes.meta_calls_agendadas },
    { icon: DollarSign, iconColor: "#E85D24", label: "Fechamentos", realizado: realizado.fechamentos, meta: metaDoMes.meta_fechamentos },
    { icon: Banknote, iconColor: "#8b5cf6", label: "Receita", realizado: realizado.receita, meta: metaDoMes.meta_receita, prefix: "R$ " },
  ].filter(c => c.meta && c.meta > 0) : [];

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Metas</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe e gerencie metas de prospecção ativa</p>
        </div>
        <Button className="bg-[#E85D24] hover:bg-[#E85D24]/90" onClick={() => { setEditMetaData(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova meta
        </Button>
      </div>

      {/* Month Navigator */}
      <Card className="rounded-2xl shadow-sm border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-bold capitalize">{monthLabel}</h2>
              {metaDoMes ? (
                <div className="flex items-center gap-2 justify-center mt-1">
                  <Badge variant="outline" className="text-[10px] border-[#E85D24]/50 text-[#E85D24]">
                    {metaDoMes.nome}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {PERIODO_LABELS[metaDoMes.periodo_tipo]} · {metaDoMes.usuario_id ? `SDR: ${metaDoMes.perfil_nome}` : 'Organização'}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Nenhuma meta ativa para este mês</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {metaDoMes && (
            <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
              <span>Período: <span className="font-medium text-foreground">{format(parseISO(metaDoMes.data_inicio), 'dd/MM')} — {format(parseISO(metaDoMes.data_fim), 'dd/MM/yy')}</span></span>
              <span>Dias passados: <span className="font-medium text-foreground">{diasPassados}/{diasTotais}</span></span>
              <span>Dias restantes: <span className="font-medium text-foreground">{diasRestantes}</span></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Cards */}
      {realizadoLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-32" />
            </CardContent></Card>
          ))}
        </div>
      ) : progressCards.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {progressCards.map(c => (
            <ProgressCard key={c.label} {...c} diasPassados={diasPassados} diasRestantes={diasRestantes} diasTotais={diasTotais} />
          ))}
        </div>
      ) : metaDoMes ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma meta quantitativa definida para este período. Edite a meta para definir targets.
        </CardContent></Card>
      ) : null}

      {/* Daily Chart */}
      {!diarioLoading && diario.length > 0 && (
        <DailyChart diario={diario} metaLigacoes={metaDoMes?.meta_ligacoes || null} diasTotais={diasTotais || diario.length} />
      )}

      {/* Daily Table */}
      {!diarioLoading && diario.length > 0 && (
        <DailyTable diario={diario} />
      )}

      {/* Historical */}
      {historico.length > 0 && (
        <HistoricoMensal historico={historico} />
      )}

      {/* Gestão de Metas */}
      <Card className="rounded-2xl shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Gestão de Metas</CardTitle>
            <Tabs value={tab} onValueChange={v => setTab(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="minha" className="text-xs h-7 px-3">Minha meta</TabsTrigger>
                <TabsTrigger value="org" className="text-xs h-7 px-3">Organização</TabsTrigger>
                <TabsTrigger value="sdr" className="text-xs h-7 px-3">Por SDR</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-5 flex-1" />)}
                </div>
              ))}
            </div>
          ) : filteredMetas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {tab === 'minha' ? 'Você não tem metas cadastradas' : 'Nenhuma meta encontrada'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Período</TableHead>
                    {tab === 'sdr' && <TableHead className="text-xs">SDR</TableHead>}
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Ligações</TableHead>
                    <TableHead className="text-xs text-right">Conexões</TableHead>
                    <TableHead className="text-xs text-right">Calls</TableHead>
                    <TableHead className="text-xs text-right">Fecham.</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMetas.map(m => {
                    const isAtual = isWithinInterval(now, { start: parseISO(m.data_inicio), end: parseISO(m.data_fim) });
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm font-medium">{m.nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(parseISO(m.data_inicio), 'dd/MM')} — {format(parseISO(m.data_fim), 'dd/MM/yy')}
                          <br />
                          <span className="text-[10px]">{PERIODO_LABELS[m.periodo_tipo] || m.periodo_tipo}</span>
                        </TableCell>
                        {tab === 'sdr' && <TableCell className="text-sm">{m.perfil_nome || '—'}</TableCell>}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {m.ativo ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Ativa</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/30">Inativa</Badge>
                            )}
                            {isAtual && m.ativo && (
                              <Badge variant="outline" className="text-[10px] border-[#E85D24]/50 text-[#E85D24]">Atual</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right">{m.meta_ligacoes ?? '—'}</TableCell>
                        <TableCell className="text-sm text-right">{m.meta_conexoes ?? '—'}</TableCell>
                        <TableCell className="text-sm text-right">{m.meta_calls_agendadas ?? '—'}</TableCell>
                        <TableCell className="text-sm text-right">{m.meta_fechamentos ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditMetaData(m); setModalOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-500" onClick={() => deleteMeta.mutateAsync(m.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <MetaFormModal
        open={modalOpen}
        onOpenChange={o => { setModalOpen(o); if (!o) setEditMetaData(null); }}
        editMeta={editMetaData}
        users={users}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}
