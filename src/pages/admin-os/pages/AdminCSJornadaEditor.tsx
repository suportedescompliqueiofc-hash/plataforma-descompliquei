import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, ExternalLink, Route as RouteIcon,
  Sparkles, RotateCcw, Zap, CheckCircle2, Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AthosCsChat } from '@/components/admin/AthosCsChat';
import { EstagioEditor, blankEstagio } from '../components/CsJornadaEditorParts';
import {
  useCsJornadaFull, useSaveCsJornadaEstrutura, useUpdateJornadaMeta, useDeleteJornada,
  jornadaToDraft, type DraftEstagio,
} from '@/hooks/useCsJornada';

function statusPill(status: string) {
  if (status === 'ativa') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-semibold"><Zap className="h-2.5 w-2.5" /> Ativa</span>;
  if (status === 'concluida') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold"><CheckCircle2 className="h-2.5 w-2.5" /> Concluída</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold"><Circle className="h-2.5 w-2.5" /> Rascunho</span>;
}

// Nome da clínica pela org (fallback quando não veio via navegação)
function useClientNameByOrg(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['cs-clients'],
    enabled: !!orgId,
    select: (rows: any[]) => rows.find(r => r.organization_id === orgId) ?? null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cs_clients');
      if (error) throw error;
      return data || [];
    },
  });
}

export default function AdminCSJornadaEditor() {
  const { jornadaId = '' } = useParams<{ jornadaId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const { data: jornada, isLoading } = useCsJornadaFull(jornadaId || undefined);
  const saveEstrutura = useSaveCsJornadaEstrutura();
  const updateMeta = useUpdateJornadaMeta();
  const deleteJornada = useDeleteJornada();

  const clientOrgId: string | null = jornada?.organization_id ?? null;
  const stateName = (location.state as any)?.clientName as string | undefined;
  const { data: clientRow } = useClientNameByOrg(stateName ? null : clientOrgId);
  const clientName = stateName || clientRow?.clinic_name || clientRow?.nome_completo || 'este cliente';

  const [titulo, setTitulo] = useState('');
  const [estagios, setEstagios] = useState<DraftEstagio[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [loadedStamp, setLoadedStamp] = useState<string | null>(null);
  const [serverChanged, setServerChanged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sincroniza o rascunho a partir do servidor (primeira carga ou quando o Athos mexe)
  useEffect(() => {
    if (!jornada) return;
    const stamp = (jornada.updated_at as string) ?? jornada.id;
    if (stamp === loadedStamp) return;
    if (loadedStamp === null || !isDirty) {
      setTitulo(jornada.titulo);
      setEstagios(jornadaToDraft(jornada));
      setIsDirty(false);
      setLoadedStamp(stamp);
      setServerChanged(false);
    } else {
      setServerChanged(true); // há edições locais + o servidor mudou (Athos)
    }
  }, [jornada, loadedStamp, isDirty]);

  const reloadFromServer = useCallback(() => {
    if (!jornada) return;
    setTitulo(jornada.titulo);
    setEstagios(jornadaToDraft(jornada));
    setIsDirty(false);
    setLoadedStamp((jornada.updated_at as string) ?? jornada.id);
    setServerChanged(false);
  }, [jornada]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addEstagio = () => { setEstagios(p => [...p, blankEstagio()]); setIsDirty(true); };
  const updEstagio = (i: number, e: DraftEstagio) => { setEstagios(p => { const n = [...p]; n[i] = e; return n; }); setIsDirty(true); };
  const delEstagio = (i: number) => { setEstagios(p => p.filter((_, j) => j !== i)); setIsDirty(true); };
  const onBlocoDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setEstagios(p => {
      const oldI = p.findIndex(x => x._id === active.id);
      const newI = p.findIndex(x => x._id === over.id);
      if (oldI < 0 || newI < 0) return p;
      return arrayMove(p, oldI, newI);
    });
    setIsDirty(true);
  };

  const handleSave = useCallback(async () => {
    if (!jornadaId) return;
    if (titulo !== jornada?.titulo) await updateMeta.mutateAsync({ id: jornadaId, titulo });
    await saveEstrutura.mutateAsync({ jornadaId, estagios });
    setIsDirty(false);
  }, [jornadaId, titulo, estagios, jornada?.titulo]);

  const handlePublish = async () => {
    if (!jornadaId) return;
    await handleSave();
    await updateMeta.mutateAsync({ id: jornadaId, status: 'ativa' });
  };

  // Quando o Athos edita a jornada pelo chat → recarrega os dados do servidor
  const onAthosChanged = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['cs-jornada-full', jornadaId] });
    qc.invalidateQueries({ queryKey: ['cs-client-jornadas'] });
  }, [qc, jornadaId]);

  const isSaving = saveEstrutura.isPending || updateMeta.isPending;
  const status = jornada?.status ?? 'rascunho';

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <span className="p-1.5 rounded-lg bg-muted"><RouteIcon className="h-3.5 w-3.5 text-muted-foreground" /></span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">Editar jornada</p>
          <p className="text-[11px] text-muted-foreground/50 truncate">{clientName}</p>
        </div>
        {statusPill(status)}
        <div className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-[11px] text-muted-foreground">Excluir jornada?</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-8 px-2 text-[11px]">Não</Button>
              <Button size="sm" onClick={async () => { await deleteJornada.mutateAsync(jornadaId); navigate(-1); }} disabled={deleteJornada.isPending} className="h-8 px-2.5 text-[11px] font-semibold bg-destructive text-white hover:bg-destructive/90 rounded-lg gap-1">
                {deleteJornada.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Excluir
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="h-8 w-8 text-muted-foreground/50 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={isSaving || !isDirty} className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3">
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
          </Button>
          {status === 'rascunho' && (
            <Button onClick={handlePublish} disabled={isSaving} className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
              <ExternalLink className="h-3 w-3" /> Publicar
            </Button>
          )}
        </div>
      </div>

      {serverChanged && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <p className="text-[12px] text-amber-700 flex-1">O Athos atualizou esta jornada. Você tem edições não salvas.</p>
          <Button size="sm" variant="outline" onClick={reloadFromServer} className="h-7 rounded-lg text-[11px] gap-1.5 border-amber-500/40"><RotateCcw className="h-3 w-3" /> Recarregar do Athos</Button>
        </div>
      )}

      {isLoading || !jornada ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Editor (esquerda) */}
          <div className="flex-1 min-w-0 w-full space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título da jornada</Label>
              <Input value={titulo} onChange={e => { setTitulo(e.target.value); setIsDirty(true); }} placeholder="Ex.: Jornada de julho de 2026" className="h-11 text-base font-semibold rounded-lg border-border/60 font-display" />
            </div>

            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Blocos & tarefas</p>
              <Button variant="outline" size="sm" onClick={addEstagio} className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"><Plus className="h-3.5 w-3.5" /> Novo bloco</Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlocoDragEnd}>
              <SortableContext items={estagios.map(e => e._id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {estagios.map((e, i) => (
                    <EstagioEditor key={e._id} estagio={e} index={i}
                      onChange={u => updEstagio(i, u)} onDelete={() => delEstagio(i)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {estagios.length === 0 && (
              <button onClick={addEstagio} className="w-full flex flex-col items-center justify-center gap-2 py-12 rounded-2xl border-2 border-dashed border-border/40 hover:border-border/70 text-muted-foreground/50 hover:text-muted-foreground transition-all">
                <RouteIcon className="h-6 w-6" /><span className="text-[13px]">Adicionar primeiro bloco</span>
              </button>
            )}
          </div>

          {/* Athos (direita) */}
          <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 lg:sticky lg:top-4">
            <AthosCsChat
              clientOrgId={clientOrgId}
              clientName={clientName}
              variant="jornada"
              jornadaId={jornadaId}
              onJornadaChanged={onAthosChanged}
            />
          </div>
        </div>
      )}
    </div>
  );
}
