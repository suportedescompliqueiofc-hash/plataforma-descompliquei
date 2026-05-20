import { useState, useMemo } from "react";
import { Plus, FileText, Search, Trash2, UserPlus, Phone, TrendingUp, CheckCircle, Calendar, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell } from "recharts";
import {
  useOutboundScripts, OutboundScript,
  useScriptProspectos, useScriptMetricas, useScriptLigacoes,
} from "@/hooks/useOutboundScripts";
import { useOutboundProspectos } from "@/hooks/useOutboundProspectos";
import { cn } from "@/lib/utils";

const OBJETIVO_LABELS: Record<string, string> = {
  abertura: "Abertura", qualificacao: "Qualificação", contorno_objecao: "Contorno de Objeção",
  fechamento_agendamento: "Fechamento", follow_up: "Follow-up", reativacao: "Reativação",
};
const OBJETIVO_COLORS: Record<string, string> = {
  abertura: "bg-blue-500/20 text-blue-500", qualificacao: "bg-emerald-500/20 text-emerald-500",
  contorno_objecao: "bg-amber-500/20 text-amber-500", fechamento_agendamento: "bg-purple-500/20 text-purple-500",
  follow_up: "bg-cyan-500/20 text-cyan-500", reativacao: "bg-pink-500/20 text-pink-500",
};
const STATUS_LABELS: Record<string, string> = { rascunho: "Rascunho", em_teste: "Em Teste", aprovado: "Aprovado", arquivado: "Arquivado" };
const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-zinc-500/20 text-zinc-400", em_teste: "bg-amber-500/20 text-amber-500",
  aprovado: "bg-emerald-500/20 text-emerald-500", arquivado: "bg-red-500/20 text-red-400",
};
const RESULTADO_LABELS: Record<string, string> = {
  sem_interesse: "Sem interesse", qualificado: "Qualificado", agendou_call: "Agendou call",
  quer_mais_info: "Quer mais info", ligar_depois: "Ligar depois", nao_e_icp: "Não é ICP", ja_tem_solucao: "Já tem solução",
};
const STATUS_LIGACAO_LABELS: Record<string, string> = {
  atendeu: "Atendeu", nao_atendeu: "Não atendeu", ocupado: "Ocupado",
  caixa_postal: "Caixa postal", numero_errado: "Nº errado", recusou: "Recusou",
};
const BAR_COLORS = ["#6366f1", "#22c55e", "#3b82f6", "#f59e0b", "#14b8a6", "#ef4444", "#8b5cf6"];

// ─── SCRIPT DETAIL ─────────────────────────────────────
function ScriptDetail({ script, onDeleted }: { script: OutboundScript; onDeleted: () => void }) {
  const { updateScript, deleteScript } = useOutboundScripts();
  const { associacoes, isLoading: assocLoading, associar, desassociar } = useScriptProspectos(script.id);
  const { data: metricas } = useScriptMetricas(script.id);
  const { data: ligacoes = [] } = useScriptLigacoes(script.id);
  const { prospectos } = useOutboundProspectos();

  const [tab, setTab] = useState("script");
  const [nome, setNome] = useState(script.nome);
  const [descricao, setDescricao] = useState(script.descricao || "");
  const [objetivo, setObjetivo] = useState(script.objetivo);
  const [status, setStatus] = useState(script.status);
  const [saving, setSaving] = useState(false);
  const [showAssociar, setShowAssociar] = useState(false);
  const [assocSearch, setAssocSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset ao trocar de script
  useState(() => { setNome(script.nome); setDescricao(script.descricao || ""); setObjetivo(script.objetivo); setStatus(script.status); setTab("script"); });

  const hasChanges = nome !== script.nome || descricao !== (script.descricao || "") || objetivo !== script.objetivo || status !== script.status;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateScript.mutateAsync({
        id: script.id,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        objetivo,
        status,
      } as any);
    } finally { setSaving(false); }
  };

  const associadosIds = new Set(associacoes.map(a => a.prospecto_id));
  const prospectosDisponiveis = prospectos.filter(p => !associadosIds.has(p.id));
  const filteredDisponiveis = assocSearch
    ? prospectosDisponiveis.filter(p => p.nome.toLowerCase().includes(assocSearch.toLowerCase()) || (p.clinica || "").toLowerCase().includes(assocSearch.toLowerCase()))
    : prospectosDisponiveis.slice(0, 20);

  const chartData = useMemo(() => {
    if (!metricas?.distribuicao) return [];
    return Object.entries(metricas.distribuicao).map(([key, value]) => ({
      name: RESULTADO_LABELS[key] || key,
      value,
    }));
  }, [metricas]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{script.nome}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={OBJETIVO_COLORS[script.objetivo]}>{OBJETIVO_LABELS[script.objetivo]}</Badge>
              <Badge variant="outline" className={STATUS_COLORS[script.status]}>{STATUS_LABELS[script.status]}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="script">Script</TabsTrigger>
          <TabsTrigger value="prospectos">Prospectos ({associacoes.length})</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
        </TabsList>

        {/* ABA SCRIPT — Simplificada: nome, descrição, objetivo, status */}
        <TabsContent value="script" className="flex-1 overflow-y-auto px-5 pb-5 mt-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Objetivo</Label>
                <Select value={objetivo} onValueChange={setObjetivo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OBJETIVO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              className="text-sm"
              placeholder="Descreva o objetivo e contexto de uso deste script..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={!hasChanges || saving || !nome.trim()} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
            <Button variant="outline" onClick={() => setShowAssociar(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Associar a Prospectos
            </Button>
          </div>
        </TabsContent>

        {/* ABA PROSPECTOS */}
        <TabsContent value="prospectos" className="flex-1 overflow-y-auto px-5 pb-5 mt-3">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" onClick={() => setShowAssociar(true)}>
              <Plus className="h-4 w-4 mr-2" /> Associar Prospecto
            </Button>
          </div>
          {assocLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : associacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum prospecto associado a este script</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Scoring</TableHead>
                  <TableHead>Associado em</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {associacoes.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{a.prospecto_nome || "—"}</TableCell>
                    <TableCell className="text-sm">{a.prospecto_clinica || "—"}</TableCell>
                    <TableCell>
                      {a.prospecto_stage_nome ? (
                        <Badge variant="outline" style={{ backgroundColor: `${a.prospecto_stage_cor}20`, color: a.prospecto_stage_cor }}>{a.prospecto_stage_nome}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{a.prospecto_scoring ? <Badge variant="outline" className="text-xs">{a.prospecto_scoring}</Badge> : "—"}</TableCell>
                    <TableCell className="text-xs">{format(new Date(a.associado_em), "dd/MM/yy")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-red-500 hover:text-red-600" onClick={() => desassociar.mutate(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ABA DESEMPENHO */}
        <TabsContent value="desempenho" className="flex-1 overflow-y-auto px-5 pb-5 mt-3 space-y-6">
          {metricas ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Card><CardContent className="p-4 text-center">
                  <Phone className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{metricas.total_ligacoes}</p>
                  <p className="text-xs text-muted-foreground">Ligações</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                  <p className="text-2xl font-bold">{metricas.tx_atendimento}%</p>
                  <p className="text-xs text-muted-foreground">Tx. Atendimento</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <CheckCircle className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                  <p className="text-2xl font-bold">{metricas.tx_qualificacao}%</p>
                  <p className="text-xs text-muted-foreground">Tx. Qualificação</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <Calendar className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                  <p className="text-2xl font-bold">{metricas.tx_agendamento}%</p>
                  <p className="text-xs text-muted-foreground">Tx. Agendamento</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
                  <p className="text-2xl font-bold">{metricas.total_recusas}</p>
                  <p className="text-xs text-muted-foreground">Recusas</p>
                </CardContent></Card>
              </div>

              {chartData.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Distribuição de Resultados</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                        <RTooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {ligacoes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Últimas Ligações com este Script</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Prospecto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>SDR</TableHead>
                        <TableHead>Anotação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ligacoes.slice(0, 20).map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{format(new Date(l.data_hora), "dd/MM/yy HH:mm")}</TableCell>
                          <TableCell className="text-sm">{l.prospecto_nome}{l.prospecto_clinica ? ` • ${l.prospecto_clinica}` : ""}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{STATUS_LIGACAO_LABELS[l.status] || l.status}</Badge></TableCell>
                          <TableCell className="text-xs">{l.resultado ? RESULTADO_LABELS[l.resultado] || l.resultado : "—"}</TableCell>
                          <TableCell className="text-xs">{l.perfil_nome || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{l.anotacao || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* CONFIRM DELETE SCRIPT */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir script "{script.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O script será removido permanentemente, incluindo todas as associações com prospectos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => { deleteScript.mutate(script.id); onDeleted(); }}>
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL ASSOCIAR PROSPECTO */}
      <Dialog open={showAssociar} onOpenChange={setShowAssociar}>
        <DialogContent className="max-w-md max-h-[70vh]">
          <DialogHeader><DialogTitle>Associar Prospecto ao Script</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou clínica..." className="pl-9" value={assocSearch} onChange={e => setAssocSearch(e.target.value)} />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum prospecto disponível</p>
              ) : filteredDisponiveis.map(p => (
                <button key={p.id} className="w-full flex items-center justify-between p-2 rounded hover:bg-muted/50 text-left" onClick={() => { associar.mutate(p.id); setAssocSearch(""); }}>
                  <div>
                    <p className="text-sm font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.clinica}</p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────
export default function OutboundScripts() {
  const { scripts, isLoading, createScript } = useOutboundScripts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filterObjetivo, setFilterObjetivo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Form novo script
  const [newNome, setNewNome] = useState("");
  const [newObjetivo, setNewObjetivo] = useState("abertura");
  const [newDescricao, setNewDescricao] = useState("");

  const filteredScripts = useMemo(() => {
    return scripts.filter(s => {
      if (filterObjetivo !== "todos" && s.objetivo !== filterObjetivo) return false;
      if (filterStatus !== "todos" && s.status !== filterStatus) return false;
      return true;
    });
  }, [scripts, filterObjetivo, filterStatus]);

  const selectedScript = scripts.find(s => s.id === selectedId) || null;

  const handleCreate = async () => {
    if (!newNome.trim()) return;
    const result = await createScript.mutateAsync({
      nome: newNome.trim(),
      objetivo: newObjetivo,
      descricao: newDescricao.trim() || null,
      conteudo: "",
      status: "rascunho",
    });
    setSelectedId(result.id);
    setShowNew(false);
    setNewNome(""); setNewObjetivo("abertura"); setNewDescricao("");
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 border rounded-lg overflow-hidden bg-card">
      {/* COLUNA ESQUERDA — LISTA */}
      <div className="w-[320px] min-w-[320px] border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Scripts</h2>
            <Button size="sm" className="h-7 text-xs bg-[#E85D24] hover:bg-[#E85D24]/90" onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Select value={filterObjetivo} onValueChange={setFilterObjetivo}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Objetivo</SelectItem>
                {Object.entries(OBJETIVO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filteredScripts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum script</p>
          ) : (
            filteredScripts.map(s => (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className={cn("w-full text-left p-3 border-b transition-colors", selectedId === s.id ? "bg-[#E85D24]/10 border-l-2 border-l-[#E85D24]" : "hover:bg-muted/50", s.status === "arquivado" && "opacity-50")}>
                <p className="text-sm font-medium truncate">{s.nome}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${OBJETIVO_COLORS[s.objetivo] || ""}`}>{OBJETIVO_LABELS[s.objetivo]}</Badge>
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[s.status] || ""}`}>{STATUS_LABELS[s.status]}</Badge>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-muted-foreground">{s.prospectos_count || 0} prospectos</span>
                  <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(s.atualizado_em), { addSuffix: true, locale: ptBR })}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* COLUNA DIREITA — DETALHE */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedScript ? (
          <ScriptDetail key={selectedScript.id} script={selectedScript} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Selecione um script para visualizar</p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL NOVO SCRIPT */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Script</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome do script" />
            </div>
            <div className="space-y-2">
              <Label>Objetivo *</Label>
              <Select value={newObjetivo} onValueChange={setNewObjetivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OBJETIVO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={newDescricao} onChange={e => setNewDescricao(e.target.value)} rows={3} className="text-sm" placeholder="Descreva o objetivo e contexto de uso deste script..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newNome.trim() || createScript.isPending} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
              {createScript.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
