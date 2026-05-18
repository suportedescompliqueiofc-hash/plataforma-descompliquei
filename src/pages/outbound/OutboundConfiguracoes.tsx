import { useState, useEffect, useMemo } from "react";
import {
  Settings, GripVertical, Plus, Trash2, Loader2, Users, List, Bell,
  Pencil, AlertTriangle, Phone, Calendar as CalendarIcon, UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOutboundStages, OutboundStage } from "@/hooks/useOutboundStages";
import { useOutboundProspectos } from "@/hooks/useOutboundProspectos";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";

// ==================== Tab navigation ====================

const TABS = [
  { id: "stages", label: "Stages do Pipeline", icon: GripVertical },
  { id: "sdrs", label: "SDRs", icon: Users },
  { id: "origens", label: "Origens de lista", icon: List },
  { id: "notificacoes", label: "Notificações", icon: Bell },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ==================== Stages tab ====================

const CORES = ["#6366f1", "#E85D24", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

interface StageRow {
  id: string;
  nome: string;
  cor: string;
  tipo: "ativo" | "ganho" | "perdido";
  isNew?: boolean;
}

function SortableStageRow({ stage, onUpdate, onDelete, canDelete, prospCount }: {
  stage: StageRow;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  prospCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
        <Input value={stage.nome} onChange={e => onUpdate(stage.id, "nome", e.target.value)} placeholder="Nome do stage" className="h-9 text-sm" />
        <Select value={stage.cor} onValueChange={v => onUpdate(stage.id, "cor", v)}>
          <SelectTrigger className="w-[60px] h-9 px-2">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: stage.cor }} />
          </SelectTrigger>
          <SelectContent>
            {CORES.map(c => (
              <SelectItem key={c} value={c}>
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />{c}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stage.tipo} onValueChange={v => onUpdate(stage.id, "tipo", v)}>
          <SelectTrigger className="w-[110px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="ganho">Ganho</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
          {prospCount} prospecto{prospCount !== 1 ? 's' : ''}
        </Badge>
        <Button
          variant="ghost" size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-red-500"
          onClick={() => onDelete(stage.id)}
          disabled={!canDelete}
          title={!canDelete ? 'Há prospectos vinculados' : 'Remover'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StagesTab() {
  const { stages, createStage, updateStage, deleteStage } = useOutboundStages();
  const { prospectos } = useOutboundProspectos();
  const [rows, setRows] = useState<StageRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setRows(stages.map(s => ({ id: s.id, nome: s.nome, cor: s.cor, tipo: s.tipo })));
  }, [stages]);

  const prospCountByStage = (stageId: string) => prospectos.filter(p => p.stage_id === stageId).length;

  const handleUpdate = (id: string, field: string, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDeleteRequest = (id: string) => {
    const row = rows.find(r => r.id === id);
    if (row?.isNew) {
      setRows(prev => prev.filter(r => r.id !== id));
      return;
    }
    setDeleteConfirm(id);
  };

  const handleDeleteConfirmed = () => {
    if (deleteConfirm) {
      setRows(prev => prev.filter(r => r.id !== deleteConfirm));
      setDeleteConfirm(null);
    }
  };

  const handleAdd = () => {
    setRows(prev => [...prev, {
      id: `new-${Date.now()}`,
      nome: "",
      cor: CORES[prev.length % CORES.length],
      tipo: "ativo",
      isNew: true,
    }]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex(r => r.id === active.id);
    const newIndex = rows.findIndex(r => r.id === over.id);
    setRows(arrayMove(rows, oldIndex, newIndex));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingIds = stages.map(s => s.id);
      const currentIds = rows.filter(r => !r.isNew).map(r => r.id);
      const deletedIds = existingIds.filter(id => !currentIds.includes(id));

      for (const id of deletedIds) {
        await deleteStage.mutateAsync(id);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.isNew) {
          if (!row.nome.trim()) continue;
          await createStage.mutateAsync({
            nome: row.nome.trim(),
            cor: row.cor,
            tipo: row.tipo,
            posicao_ordem: i,
          });
        } else {
          const original = stages.find(s => s.id === row.id);
          if (original && (original.nome !== row.nome || original.cor !== row.cor || original.tipo !== row.tipo || original.posicao_ordem !== i)) {
            await updateStage.mutateAsync({
              id: row.id,
              nome: row.nome.trim(),
              cor: row.cor,
              tipo: row.tipo,
              posicao_ordem: i,
            });
          }
        }
      }

      toast.success("Stages salvos com sucesso");
    } catch (err: any) {
      toast.error("Erro ao salvar stages: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (rows.length !== stages.length) return true;
    return rows.some((r, i) => {
      if (r.isNew) return true;
      const orig = stages.find(s => s.id === r.id);
      if (!orig) return true;
      return orig.nome !== r.nome || orig.cor !== r.cor || orig.tipo !== r.tipo || orig.posicao_ordem !== i;
    });
  }, [rows, stages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Stages do Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Arraste para reordenar. Stages do tipo "Ganho" e "Perdido" encerram o pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" /> Novo stage
          </Button>
          <Button
            size="sm"
            className="bg-[#E85D24] hover:bg-[#E85D24]/90"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
            {rows.map(row => (
              <SortableStageRow
                key={row.id}
                stage={row}
                onUpdate={handleUpdate}
                onDelete={handleDeleteRequest}
                canDelete={row.isNew || prospCountByStage(row.id) === 0}
                prospCount={row.isNew ? 0 : prospCountByStage(row.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum stage configurado</p>
        )}
      </div>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover este stage? Esta ação será aplicada ao salvar.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteConfirmed}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== SDRs tab ====================

function SdrsTab() {
  const { profile } = useProfile();
  const { users, isLoading: usersLoading } = useOrgUsers();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", password: "", role: "atendente" });

  const now = new Date();
  const mesInicio = startOfMonth(now).toISOString();
  const mesFim = endOfMonth(now).toISOString();

  const { data: sdrStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['outbound_sdr_stats', orgId, format(now, 'yyyy-MM')],
    queryFn: async () => {
      if (!orgId) return [];

      const [prospRes, ligRes, rolesRes] = await Promise.all([
        (supabase as any)
          .from('outbound_prospectos')
          .select('usuario_id, outbound_stages:stage_id(tipo)')
          .eq('organization_id', orgId),
        (supabase as any)
          .from('outbound_ligacoes')
          .select('usuario_id')
          .eq('organization_id', orgId)
          .gte('data_hora', mesInicio)
          .lte('data_hora', mesFim),
        supabase
          .from('usuarios_papeis')
          .select('usuario_id, papel') as any,
      ]);

      const prosps: any[] = prospRes.data || [];
      const ligs: any[] = ligRes.data || [];
      const roles: any[] = rolesRes.data || [];

      const roleMap = new Map<string, string[]>();
      roles.forEach((r: any) => {
        if (!roleMap.has(r.usuario_id)) roleMap.set(r.usuario_id, []);
        roleMap.get(r.usuario_id)!.push(r.papel);
      });

      return users.map(u => {
        const prospectsAtivos = prosps.filter((p: any) => p.usuario_id === u.id && p.outbound_stages?.tipo === 'ativo').length;
        const ligacoesMes = ligs.filter((l: any) => l.usuario_id === u.id).length;
        const papeis = roleMap.get(u.id) || ['atendente'];
        return { ...u, prospectsAtivos, ligacoesMes, papeis };
      });
    },
    enabled: !!orgId && users.length > 0,
    staleTime: 60_000,
  });

  const createSdr = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: userData,
      });
      if (error) throw new Error("Erro de conexão com o servidor.");
      if (data && data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setIsAddOpen(false);
      setNewUser({ fullName: "", email: "", password: "", role: "atendente" });
      queryClient.invalidateQueries({ queryKey: ['org_users'] });
      queryClient.invalidateQueries({ queryKey: ['outbound_sdr_stats'] });
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      toast.success("SDR adicionado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao adicionar SDR");
    },
  });

  const handleAddSdr = () => {
    if (!newUser.fullName.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createSdr.mutate(newUser);
  };

  const isLoading = usersLoading || statsLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">SDRs da organização</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Membros da equipe e métricas do mês atual.</p>
        </div>
        <Button size="sm" onClick={() => setIsAddOpen(true)} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
          <UserPlus className="h-4 w-4 mr-2" /> Adicionar SDR
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} className="h-5 flex-1" />)}
            </div>
          ))}
        </div>
      ) : sdrStats.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Papéis</TableHead>
                <TableHead className="text-xs text-right">Prospectos ativos</TableHead>
                <TableHead className="text-xs text-right">Ligações no mês</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sdrStats.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="text-sm font-medium">{u.nome_completo || 'Sem nome'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {u.papeis.map((p: string) => (
                        <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-right">{u.prospectsAtivos}</TableCell>
                  <TableCell className="text-sm text-right">{u.ligacoesMes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar SDR</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input
                value={newUser.fullName}
                onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))}
                placeholder="Nome do SDR"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                placeholder="Senha inicial"
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendente">Atendente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddSdr} disabled={createSdr.isPending} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
              {createSdr.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Origens tab ====================

const ORIGENS_PADRAO = ["Google Maps", "Instagram", "Base comprada", "Indicação", "Evento"];
const STORAGE_KEY = 'outbound_origens_custom';

function getCustomOrigens(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function OrigensTab() {
  const [customOrigens, setCustomOrigens] = useState<string[]>(getCustomOrigens);
  const [novaOrigem, setNovaOrigem] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const saveCustom = (list: string[]) => {
    setCustomOrigens(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const handleAdd = () => {
    const val = novaOrigem.trim();
    if (!val) return;
    if (ORIGENS_PADRAO.includes(val) || customOrigens.includes(val)) {
      toast.error('Essa origem já existe');
      return;
    }
    saveCustom([...customOrigens, val]);
    setNovaOrigem('');
    toast.success('Origem adicionada');
  };

  const handleDeleteConfirmed = () => {
    if (deleteConfirm) {
      saveCustom(customOrigens.filter(o => o !== deleteConfirm));
      setDeleteConfirm(null);
      toast.success('Origem removida');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Origens de lista</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Origens padrão não podem ser editadas. Adicione origens customizadas conforme necessário.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Origens padrão</Label>
        {ORIGENS_PADRAO.map(o => (
          <div key={o} className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <span className="text-sm">{o}</span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Padrão</Badge>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Origens customizadas</Label>
        {customOrigens.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">Nenhuma origem customizada adicionada</p>
        )}
        {customOrigens.map(o => (
          <div key={o} className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <span className="text-sm">{o}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => setDeleteConfirm(o)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={novaOrigem}
          onChange={e => setNovaOrigem(e.target.value)}
          placeholder="Nome da nova origem"
          className="h-9 text-sm"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <Button variant="outline" size="sm" className="h-9" onClick={handleAdd} disabled={!novaOrigem.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover a origem "{deleteConfirm}"? Prospectos já associados a essa origem não serão afetados.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteConfirmed}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Notificações tab ====================

const NOTIF_STORAGE_KEY = 'outbound_notif_prefs';

interface NotifPrefs {
  atrasado: boolean;
  call_proxima: boolean;
}

function getNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { atrasado: true, call_proxima: true };
  } catch { return { atrasado: true, call_proxima: true }; }
}

function NotificacoesTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>(getNotifPrefs);

  const update = (field: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [field]: value };
    setPrefs(next);
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next));
    toast.success('Preferência salva');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Notificações</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Configure alertas do módulo outbound. Por enquanto, notificações são exibidas apenas no sistema.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Ação atrasada</p>
              <p className="text-xs text-muted-foreground">Notificar quando um prospecto tiver próxima ação atrasada</p>
            </div>
          </div>
          <Switch checked={prefs.atrasado} onCheckedChange={v => update('atrasado', v)} />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <CalendarIcon className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Call próxima</p>
              <p className="text-xs text-muted-foreground">Notificar quando uma call agendada for em menos de 1 hora</p>
            </div>
          </div>
          <Switch checked={prefs.call_proxima} onCheckedChange={v => update('call_proxima', v)} />
        </div>
      </div>

      <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
        <p className="text-xs text-muted-foreground">
          Canal de notificação: <strong>Sistema</strong> (in-app). Integrações com e-mail e WhatsApp serão adicionadas futuramente.
        </p>
      </div>
    </div>
  );
}

// ==================== Main page ====================

export default function OutboundConfiguracoes() {
  const [activeTab, setActiveTab] = useState<TabId>("stages");

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-[#E85D24]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Pipeline, equipe e preferências do módulo outbound</p>
        </div>
      </div>

      {/* Layout: sidebar tabs + content */}
      <div className="flex gap-6 min-h-[500px]">
        {/* Sidebar */}
        <div className="w-[200px] shrink-0 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-[#E85D24]/10 text-[#E85D24] font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <Card className="flex-1">
          <CardContent className="p-6">
            {activeTab === 'stages' && <StagesTab />}
            {activeTab === 'sdrs' && <SdrsTab />}
            {activeTab === 'origens' && <OrigensTab />}
            {activeTab === 'notificacoes' && <NotificacoesTab />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
