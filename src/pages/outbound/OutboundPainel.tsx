import { useState, useMemo } from "react";
import {
  LayoutDashboard, Phone, PhoneCall, Calendar, DollarSign,
  ChevronRight, ArrowRight, Users, TrendingUp, BarChart3, Target,
  Clock, AlertTriangle, Timer, Hourglass,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell,
} from "recharts";
import { format, isBefore, startOfDay, startOfMonth, endOfMonth, endOfDay, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { useOutboundPainel, PeriodoFiltro } from "@/hooks/useOutboundPainel";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { useLigacaoModal } from "@/contexts/LigacaoContext";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const RESULTADO_LABELS: Record<string, string> = {
  sem_interesse: "Sem interesse",
  qualificado: "Qualificado",
  agendou_call: "Agendou call",
  quer_mais_info: "Quer mais info",
  ligar_depois: "Ligar depois",
  nao_e_icp: "Não é ICP",
  ja_tem_solucao: "Já tem solução",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  caixa_postal: "Caixa postal",
  numero_errado: "Nº errado",
  recusou: "Recusou",
  atendeu: "Atendeu",
  sem_resultado: "Sem resultado",
};

const PIE_COLORS = [
  "#E85D24", "#6366f1", "#22c55e", "#3b82f6", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b",
];

const SCORING_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  D: "bg-red-500/20 text-red-400 border-red-500/30",
};

function FunilCard({ icon: Icon, label, value, iconColor }: {
  icon: any; label: string; value: number; iconColor: string;
}) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="p-4 text-center">
        <div className="mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: iconColor + '20' }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function FunilArrow({ rate }: { rate: number }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 min-w-[60px]">
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground font-medium mt-0.5">{rate}%</span>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-[#E85D24]" />
        </div>
        <div>
          <p className="text-lg font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-10 w-10 rounded-xl mx-auto mb-2" />
        <Skeleton className="h-7 w-16 mx-auto mb-1" />
        <Skeleton className="h-3 w-20 mx-auto" />
      </CardContent>
    </Card>
  );
}

function SkeletonTable({ rows = 3, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function OutboundPainel() {
  const navigate = useNavigate();
  const { users } = useOrgUsers();
  const { openRegistrarLigacao } = useLigacaoModal();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  });
  const [sdrId, setSdrId] = useState<string | null>(null);

  const periodo: PeriodoFiltro = {
    tipo: 'personalizado',
    inicio: dateRange?.from || startOfMonth(today),
    fim: dateRange?.to || endOfMonth(today),
  };

  const { data, isLoading } = useOutboundPainel(periodo, sdrId);

  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const funil = data?.funil;
  const sdrPerformance = data?.sdrPerformance || [];
  const metricas = data?.metricas;
  const metricasTempo = data?.metricasTempo;
  const analiseHorarios = data?.analiseHorarios;
  const evolucao = data?.evolucao || [];
  const distribuicao = data?.distribuicao || [];
  const scriptComparativo = data?.scriptComparativo || [];
  const fila = data?.fila || [];

  // Ações pendentes para alerta no topo
  const { data: acoesPendentes = [] } = useQuery({
    queryKey: ['outbound_acoes_alerta', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const end = endOfDay(new Date());
      const { data: res, error } = await (supabase as any)
        .from('outbound_prospectos')
        .select('id, nome, clinica, proxima_acao, proxima_acao_data, outbound_stages:stage_id(tipo)')
        .eq('organization_id', orgId)
        .not('proxima_acao_data', 'is', null)
        .lte('proxima_acao_data', end.toISOString())
        .order('proxima_acao_data', { ascending: true });
      if (error) throw error;
      return (res || []).filter((p: any) => p.outbound_stages?.tipo === 'ativo');
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const acoesPendentesAtrasadas = acoesPendentes.filter((p: any) =>
    isBefore(new Date(p.proxima_acao_data), startOfDay(new Date()))
  );
  const acoesPendentesHoje = acoesPendentes.filter((p: any) =>
    !isBefore(new Date(p.proxima_acao_data), startOfDay(new Date()))
  );

  // Helper to format seconds as human-readable
  const fmtTempo = (seg: number): string => {
    if (seg < 60) return `${seg}s`;
    const min = Math.floor(seg / 60);
    const sec = seg % 60;
    if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
    const hrs = Math.floor(min / 60);
    const remMin = min % 60;
    return remMin > 0 ? `${hrs}h ${remMin}m` : `${hrs}h`;
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-[#E85D24]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Painel Outbound</h1>
            <p className="text-sm text-muted-foreground">Visão geral da prospecção ativa</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker date={dateRange} setDate={setDateRange} />

          <Select value={sdrId || 'todos'} onValueChange={v => setSdrId(v === 'todos' ? null : v)}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Todos os SDRs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os SDRs</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.nome_completo || 'Sem nome'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerta de ações pendentes */}
      {acoesPendentes.length > 0 && (
        <div className="space-y-2">
          {acoesPendentesAtrasadas.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/5">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-500">
                  {acoesPendentesAtrasadas.length} {acoesPendentesAtrasadas.length === 1 ? 'ação atrasada' : 'ações atrasadas'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {acoesPendentesAtrasadas.slice(0, 3).map((p: any) => p.nome).join(', ')}
                  {acoesPendentesAtrasadas.length > 3 ? ` e mais ${acoesPendentesAtrasadas.length - 3}` : ''}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10"
                onClick={() => navigate('/outbound/prospectos')}
              >
                Ver prospectos
              </Button>
            </div>
          )}
          {acoesPendentesHoje.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-500">
                  {acoesPendentesHoje.length} {acoesPendentesHoje.length === 1 ? 'ação para hoje' : 'ações para hoje'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {acoesPendentesHoje.slice(0, 3).map((p: any) => p.nome).join(', ')}
                  {acoesPendentesHoje.length > 3 ? ` e mais ${acoesPendentesHoje.length - 3}` : ''}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                onClick={() => navigate('/outbound/prospectos')}
              >
                Ver prospectos
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Seção 1 — Funil */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Funil de Prospecção</h2>
        {isLoading ? (
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : funil ? (
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            <FunilCard icon={Users} label="Leads contatados" value={funil.leads_contatados} iconColor="#8b5cf6" />
            <div className="flex flex-col items-center justify-center px-1 text-muted-foreground/40">
              <span className="text-lg">|</span>
            </div>
            <FunilCard icon={Phone} label="Ligações" value={funil.ligacoes} iconColor="#6366f1" />
            <FunilArrow rate={funil.tx_atendimento} />
            <FunilCard icon={PhoneCall} label="Conexões" value={funil.conexoes} iconColor="#22c55e" />
            <FunilArrow rate={funil.tx_agendamento} />
            <FunilCard icon={Calendar} label="Calls agendadas" value={funil.calls_agendadas} iconColor="#3b82f6" />
            <FunilArrow rate={funil.tx_fechamento} />
            <FunilCard icon={DollarSign} label="Fechamentos" value={funil.fechamentos} iconColor="#E85D24" />
          </div>
        ) : null}
      </div>

      {/* Seção 2 — SDR Performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-[#E85D24]" /> Performance dos SDRs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={8} />
          ) : sdrPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ligação registrada no período</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SDR</TableHead>
                    <TableHead className="text-xs text-right">Leads</TableHead>
                    <TableHead className="text-xs text-right">Ligações</TableHead>
                    <TableHead className="text-xs text-right">Conexões</TableHead>
                    <TableHead className="text-xs text-right">Tx Atend.</TableHead>
                    <TableHead className="text-xs text-right">Calls</TableHead>
                    <TableHead className="text-xs text-right">Fechamentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sdrPerformance.map(sdr => (
                    <TableRow key={sdr.usuario_id}>
                      <TableCell className="text-sm font-medium">{sdr.nome}</TableCell>
                      <TableCell className="text-sm text-right">{sdr.leads_contatados}</TableCell>
                      <TableCell className="text-sm text-right">{sdr.ligacoes}</TableCell>
                      <TableCell className="text-sm text-right">{sdr.conexoes}</TableCell>
                      <TableCell className="text-sm text-right">{sdr.tx_atendimento}%</TableCell>
                      <TableCell className="text-sm text-right">{sdr.calls_agendadas}</TableCell>
                      <TableCell className="text-sm text-right">{sdr.fechamentos}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 3 — Métricas secundárias */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Métricas de Ligações</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : metricas ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={TrendingUp} label="Taxa de atendimento" value={`${metricas.tx_atendimento_geral}%`} />
            <MetricCard icon={Target} label="Média tentativas p/ qualificar" value={`${metricas.media_tentativas_qualificar}`} />
            <MetricCard icon={BarChart3} label="Ligações / dia (média)" value={`${metricas.ligacoes_por_dia}`} />
            <MetricCard icon={Clock} label="Show rate (calls)" value={metricas.show_rate > 0 ? `${metricas.show_rate}%` : '—'} />
          </div>
        ) : null}
      </div>

      {/* Seção — Análise de Tempo de Ligação */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Análise de Tempo de Ligação</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : metricasTempo ? (
          <div className="space-y-4">
            {/* Cards principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={Hourglass} label="Tempo total em ligação" value={fmtTempo(metricasTempo.tempo_total_seg)} />
              <MetricCard icon={Timer} label="Tempo total em conexões" value={fmtTempo(metricasTempo.tempo_total_conexoes_seg)} />
              <MetricCard icon={Clock} label="Duração média (todas)" value={fmtTempo(metricasTempo.media_duracao_geral_seg)} />
              <MetricCard icon={PhoneCall} label="Duração média (conexões)" value={fmtTempo(metricasTempo.media_duracao_conexoes_seg)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={TrendingUp} label="Mediana das conexões" value={fmtTempo(metricasTempo.mediana_duracao_conexoes_seg)} />
              <MetricCard icon={Clock} label="Maior ligação" value={fmtTempo(metricasTempo.maior_ligacao_seg)} />
              <MetricCard icon={Phone} label="Menor conexão" value={fmtTempo(metricasTempo.menor_conexao_seg)} />
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center shrink-0">
                    <BarChart3 className="h-5 w-5 text-[#E85D24]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-red-400">{metricasTempo.ligacoes_curtas} curtas</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-xs font-medium text-amber-400">{metricasTempo.ligacoes_medias} médias</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-xs font-medium text-emerald-400">{metricasTempo.ligacoes_longas} longas</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">&lt;30s · 30s–2min · &gt;2min</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de distribuição por faixa + Tempo por SDR */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Distribuição por Faixa de Duração</CardTitle>
                </CardHeader>
                <CardContent>
                  {metricasTempo.distribuicao_faixas.every(f => f.count === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados de duração</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={metricasTempo.distribuicao_faixas} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <YAxis type="category" dataKey="faixa" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={55} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                          formatter={(value: number) => [`${value} ligações`, 'Quantidade']}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {metricasTempo.distribuicao_faixas.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Tempo por SDR</CardTitle>
                </CardHeader>
                <CardContent>
                  {metricasTempo.tempo_por_sdr.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados de duração</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SDR</TableHead>
                            <TableHead className="text-xs text-right">Ligações</TableHead>
                            <TableHead className="text-xs text-right">Tempo Total</TableHead>
                            <TableHead className="text-xs text-right">Média/Lig.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {metricasTempo.tempo_por_sdr.map(sdr => (
                            <TableRow key={sdr.nome}>
                              <TableCell className="text-sm font-medium">{sdr.nome}</TableCell>
                              <TableCell className="text-sm text-right">{sdr.ligacoes}</TableCell>
                              <TableCell className="text-sm text-right font-mono">{fmtTempo(sdr.total_seg)}</TableCell>
                              <TableCell className="text-sm text-right font-mono">{fmtTempo(sdr.media_seg)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>

      {/* Seção — Análise por Horário */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Análise por Horário de Ligação</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : analiseHorarios && analiseHorarios.porHora.length > 0 ? (
          <div className="space-y-4">
            {/* Destaques */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="mx-auto w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
                    <Phone className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-xl font-bold">{analiseHorarios.picoLigacoes || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pico de ligações</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="mx-auto w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                    <PhoneCall className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold">{analiseHorarios.melhorHoraConexao || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Melhor hora p/ conexão</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="mx-auto w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2">
                    <Target className="h-5 w-5 text-purple-500" />
                  </div>
                  <p className="text-xl font-bold">{analiseHorarios.melhorHoraQualificacao || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Melhor hora p/ qualificação</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="mx-auto w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center mb-2">
                    <Calendar className="h-5 w-5 text-[#E85D24]" />
                  </div>
                  <p className="text-xl font-bold">{analiseHorarios.melhorHoraAgendamento || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Melhor hora p/ agendamento</p>
                </CardContent>
              </Card>
            </div>

            {/* Horários mais eficientes */}
            {analiseHorarios.horasMaisEficientes.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-sm">
                  <span className="font-medium text-emerald-500">Horários mais eficientes:</span>{' '}
                  <span className="text-muted-foreground">
                    {analiseHorarios.horasMaisEficientes.join(', ')} — maior taxa de resultados positivos (qualificações + agendamentos)
                  </span>
                </p>
              </div>
            )}

            {/* Gráfico de barras + Tabela detalhada */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Gráfico: Ligações e Conexões por hora */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Volume por Horário</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analiseHorarios.porHora} margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      />
                      <Bar dataKey="ligacoes" name="Ligações" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="conexoes" name="Conexões" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="agendamentos" name="Agendamentos" fill="#E85D24" radius={[4, 4, 0, 0]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico: Taxas por hora */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Taxas de Conversão por Horário</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={analiseHorarios.porHora} margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="%" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        formatter={(value: number) => [`${value}%`]}
                      />
                      <Line type="monotone" dataKey="tx_atendimento" name="Tx Atendimento" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="tx_qualificacao" name="Tx Qualificação" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="tx_agendamento" name="Tx Agendamento" stroke="#E85D24" strokeWidth={2} dot={{ r: 3 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Tabela detalhada por horário */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Detalhamento por Horário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Horário</TableHead>
                        <TableHead className="text-xs text-right">Ligações</TableHead>
                        <TableHead className="text-xs text-right">Conexões</TableHead>
                        <TableHead className="text-xs text-right">Tx Atend.</TableHead>
                        <TableHead className="text-xs text-right">Qualif.</TableHead>
                        <TableHead className="text-xs text-right">Tx Qualif.</TableHead>
                        <TableHead className="text-xs text-right">Agend.</TableHead>
                        <TableHead className="text-xs text-right">Tx Agend.</TableHead>
                        <TableHead className="text-xs text-right">Duração Média</TableHead>
                        <TableHead className="text-xs text-right">Resultado+</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analiseHorarios.porHora.map(h => {
                        const isTop = analiseHorarios.horasMaisEficientes.includes(h.horaLabel);
                        return (
                          <TableRow key={h.hora} className={isTop ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''}>
                            <TableCell className="text-sm font-medium">
                              {h.horaLabel}
                              {isTop && <Badge variant="outline" className="ml-2 text-[10px] border-emerald-500/50 text-emerald-500">Top</Badge>}
                            </TableCell>
                            <TableCell className="text-sm text-right">{h.ligacoes}</TableCell>
                            <TableCell className="text-sm text-right">{h.conexoes}</TableCell>
                            <TableCell className="text-sm text-right">{h.tx_atendimento}%</TableCell>
                            <TableCell className="text-sm text-right">{h.qualificados}</TableCell>
                            <TableCell className="text-sm text-right">{h.tx_qualificacao}%</TableCell>
                            <TableCell className="text-sm text-right">{h.agendamentos}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{h.tx_agendamento}%</TableCell>
                            <TableCell className="text-sm text-right font-mono">{fmtTempo(h.duracao_media_seg)}</TableCell>
                            <TableCell className="text-sm text-right">
                              <span className="font-medium">{h.resultados_positivos}</span>
                              <span className="text-muted-foreground text-xs ml-1">({h.tx_resultado_positivo}%)</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Sem dados de ligação no período selecionado
            </CardContent>
          </Card>
        )}
      </div>

      {/* Seção 4 + 5 — Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução diária */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução Diária</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : evolucao.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Line type="monotone" dataKey="ligacoes" name="Ligações" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="conexoes" name="Conexões" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="calls" name="Calls agendadas" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribuição de resultados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição de Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : distribuicao.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período</p>
            ) : (
              <div className="space-y-3">
                {distribuicao.map((item, i) => {
                  const total = distribuicao.reduce((s, d) => s + d.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  const color = PIE_COLORS[i % PIE_COLORS.length];
                  return (
                    <div key={item.resultado} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{RESULTADO_LABELS[item.resultado] || item.resultado}</span>
                        <span className="font-medium">{item.count} <span className="text-muted-foreground">({pct}%)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção 6 — Scripts em uso */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#E85D24]" /> Scripts em Uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={5} />
          ) : scriptComparativo.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum script ativo</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Script</TableHead>
                    <TableHead className="text-xs text-right">Ligações</TableHead>
                    <TableHead className="text-xs text-right">Tx Atend.</TableHead>
                    <TableHead className="text-xs text-right">Tx Qualif.</TableHead>
                    <TableHead className="text-xs text-right">Tx Agend.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scriptComparativo.map(s => (
                    <TableRow key={s.id} className={s.melhor ? 'bg-[#E85D24]/5 border-l-2 border-l-[#E85D24]' : ''}>
                      <TableCell className="text-sm font-medium">
                        {s.nome}
                        {s.melhor && <Badge variant="outline" className="ml-2 text-[10px] border-[#E85D24]/50 text-[#E85D24]">Melhor</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-right">{s.ligacoes}</TableCell>
                      <TableCell className="text-sm text-right">{s.tx_atendimento}%</TableCell>
                      <TableCell className="text-sm text-right">{s.tx_qualificacao}%</TableCell>
                      <TableCell className="text-sm text-right font-medium">{s.tx_agendamento}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 7 — Fila de ação imediata */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Fila de Ação Imediata
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[#E85D24] hover:text-[#E85D24]/80"
            onClick={() => navigate('/outbound/ligacoes')}
          >
            Ver todos <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={4} cols={6} />
          ) : fila.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum prospecto com ação pendente</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Prospecto</TableHead>
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-xs">Scoring</TableHead>
                    <TableHead className="text-xs">Ação</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs text-right">Tentativas</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fila.map(p => {
                    const isAtrasado = isBefore(new Date(p.proxima_acao_data), startOfDay(new Date()));
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{p.nome}</p>
                            {p.clinica && <p className="text-xs text-muted-foreground">{p.clinica}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.stage_nome && (
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: p.stage_cor || undefined, color: p.stage_cor || undefined }}>
                              {p.stage_nome}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.lead_scoring && (
                            <Badge variant="outline" className={`text-[10px] ${SCORING_COLORS[p.lead_scoring] || ''}`}>
                              {p.lead_scoring}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{p.proxima_acao || '—'}</TableCell>
                        <TableCell>
                          <span className={`text-xs ${isAtrasado ? 'text-red-400 font-medium' : 'text-muted-foreground'}`}>
                            {format(new Date(p.proxima_acao_data), "dd/MM HH:mm")}
                            {isAtrasado && ' (atrasado)'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-right">{p.total_tentativas}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[#E85D24] hover:text-[#E85D24]/80"
                            onClick={() => openRegistrarLigacao({ id: p.id, nome: p.nome } as any)}
                          >
                            <Phone className="h-3 w-3 mr-1" /> Ligar
                          </Button>
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
    </div>
  );
}
