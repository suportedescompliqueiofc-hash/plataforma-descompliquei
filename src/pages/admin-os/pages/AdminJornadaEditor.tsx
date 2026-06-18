import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Route, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save,
  Loader2, CheckCircle2, Zap, Circle, GripVertical,
  ExternalLink, Clock, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useAdminJornada, useUpdateJornadaMeta, useSaveJornadaEstrutura, useDeleteJornada, jornadaToDraft,
  type DraftEstagio, type DraftPasso,
} from '@/hooks/useAdminJornadas';
import { useAdminFerramentas, useAdminCategorias } from '@/hooks/useAdminArsenal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── ID generator ─────────────────────────────────────────────────────────────

let _idCounter = 0;
function newId() { return `_draft_${++_idCounter}`; }

function blankPasso(): DraftPasso {
  return {
    _id: newId(), titulo: '', descricao: '', tipo: 'acao_livre',
    ferramenta_id: null, categoria_id: null, aula_id: null, prazo_dias: null, obrigatorio: false,
    concluido: false, concluido_em: null, concluido_por: null,
  };
}

function blankEstagio(): DraftEstagio {
  return { _id: newId(), titulo: '', descricao: '', prazo_dias: 7, data_inicio: null, passos: [] };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type JStatus = 'rascunho' | 'ativa' | 'concluida';
function StatusBadge({ status }: { status: JStatus }) {
  if (status === 'ativa') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-semibold"><Zap className="h-3 w-3" /> Ativa</span>;
  if (status === 'concluida') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold"><CheckCircle2 className="h-3 w-3" /> Concluída</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold"><Circle className="h-3 w-3" /> Rascunho</span>;
}

// ─── Passo editor ─────────────────────────────────────────────────────────────

function PassoEditor({
  passo, ferramentas, categorias, aulas, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  passo: DraftPasso;
  ferramentas: any[];
  categorias: any[];
  aulas: any[];
  onChange: (p: DraftPasso) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const currentFerramenta = ferramentas.find(f => f.id === passo.ferramenta_id);
  const [filterCatId, setFilterCatId] = useState<string>(
    currentFerramenta?.arsenal_categorias?.id ?? ''
  );

  const filteredFerramentas = filterCatId
    ? ferramentas.filter(f => f.arsenal_categorias?.id === filterCatId)
    : [];

  function handleTipoChange(v: string) {
    setFilterCatId('');
    onChange({ ...passo, tipo: v as DraftPasso['tipo'], ferramenta_id: null, categoria_id: null, aula_id: null });
  }

  function handleFilterCatChange(catId: string) {
    setFilterCatId(catId);
    const tool = ferramentas.find(f => f.id === passo.ferramenta_id);
    if (tool?.arsenal_categorias?.id !== catId) {
      onChange({ ...passo, ferramenta_id: null });
    }
  }

  return (
    <div className="group rounded-xl border border-border/50 bg-card p-4 space-y-3">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
        <Input
          value={passo.titulo}
          onChange={e => onChange({ ...passo, titulo: e.target.value })}
          placeholder="Título do passo"
          className="h-8 text-sm rounded-lg border-border/60 flex-1"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={onMoveUp} disabled={isFirst}>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={onMoveDown} disabled={isLast}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Textarea
        value={passo.descricao}
        onChange={e => onChange({ ...passo, descricao: e.target.value })}
        placeholder="Descrição (opcional)"
        className="min-h-[56px] text-sm rounded-lg border-border/60 resize-none"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
          <Select value={passo.tipo} onValueChange={handleTipoChange}>
            <SelectTrigger className="h-8 text-[12px] rounded-lg border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acao_livre">Ação livre</SelectItem>
              <SelectItem value="categoria_arsenal">Categoria do Arsenal</SelectItem>
              <SelectItem value="ferramenta_arsenal">Ferramenta do Arsenal</SelectItem>
              <SelectItem value="aula_arsenal">Aula do Arsenal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prazo (dias)
          </Label>
          <Input
            type="number"
            min={1}
            value={passo.prazo_dias ?? ''}
            onChange={e => onChange({ ...passo, prazo_dias: e.target.value ? Number(e.target.value) : null })}
            placeholder="—"
            className="h-8 text-sm rounded-lg border-border/60"
          />
        </div>
      </div>

      {passo.tipo === 'categoria_arsenal' && (
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Categoria
          </Label>
          <Select
            value={passo.categoria_id ?? ''}
            onValueChange={v => onChange({ ...passo, categoria_id: v || null })}
          >
            <SelectTrigger className="h-8 text-[12px] rounded-lg border-border/60">
              <SelectValue placeholder="Selecionar categoria..." />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {passo.tipo === 'ferramenta_arsenal' && (
        <div className="space-y-2">
          {/* 1. Selecionar categoria */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categoria
            </Label>
            <Select value={filterCatId} onValueChange={handleFilterCatChange}>
              <SelectTrigger className="h-8 text-[12px] rounded-lg border-border/60">
                <SelectValue placeholder="Selecionar categoria..." />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Selecionar ferramenta dentro da categoria */}
          {filterCatId && (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ferramenta
              </Label>
              <Select
                value={passo.ferramenta_id ?? ''}
                onValueChange={v => onChange({ ...passo, ferramenta_id: v || null })}
              >
                <SelectTrigger className="h-8 text-[12px] rounded-lg border-border/60">
                  <SelectValue placeholder="Selecionar ferramenta..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredFerramentas.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                  {filteredFerramentas.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-muted-foreground">
                      Nenhuma ferramenta nesta categoria
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {passo.tipo === 'aula_arsenal' && (
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aula
          </Label>
          <Select
            value={passo.aula_id ?? ''}
            onValueChange={v => onChange({ ...passo, aula_id: v || null })}
          >
            <SelectTrigger className="h-8 text-[12px] rounded-lg border-border/60">
              <SelectValue placeholder="Selecionar aula..." />
            </SelectTrigger>
            <SelectContent>
              {aulas.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.arsenal_blocos?.nome ? `${a.arsenal_blocos.nome} — ` : ''}{a.nome}
                </SelectItem>
              ))}
              {aulas.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted-foreground">Nenhuma aula cadastrada</div>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          checked={passo.obrigatorio}
          onCheckedChange={v => onChange({ ...passo, obrigatorio: v })}
          className="scale-90"
        />
        <Label className="text-[12px] text-muted-foreground cursor-pointer">Passo obrigatório</Label>
        {passo.concluido && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Concluído pelo cliente
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Estagio editor ───────────────────────────────────────────────────────────

function EstagioEditor({
  estagio, ferramentas, categorias, aulas, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, index,
}: {
  estagio: DraftEstagio;
  ferramentas: any[];
  categorias: any[];
  aulas: any[];
  onChange: (e: DraftEstagio) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  index: number;
}) {
  function addPasso() {
    onChange({ ...estagio, passos: [...estagio.passos, blankPasso()] });
  }
  function updatePasso(i: number, p: DraftPasso) {
    const next = [...estagio.passos]; next[i] = p;
    onChange({ ...estagio, passos: next });
  }
  function deletePasso(i: number) {
    onChange({ ...estagio, passos: estagio.passos.filter((_, j) => j !== i) });
  }
  function movePasso(i: number, dir: -1 | 1) {
    const next = [...estagio.passos];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange({ ...estagio, passos: next });
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Estagio header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-[12px] font-bold text-muted-foreground shrink-0 mt-0.5">
            {index + 1}
          </div>
          <div className="flex-1 space-y-2">
            <Input
              value={estagio.titulo}
              onChange={e => onChange({ ...estagio, titulo: e.target.value })}
              placeholder="Título da etapa"
              className="h-9 text-sm font-semibold rounded-lg border-border/60"
            />
            <Input
              value={estagio.descricao}
              onChange={e => onChange({ ...estagio, descricao: e.target.value })}
              placeholder="Descrição (opcional)"
              className="h-8 text-[12px] rounded-lg border-border/60"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 border border-border/60 rounded-lg px-2 py-1">
              <Clock className="h-3 w-3 text-muted-foreground/50" />
              <Input
                type="number"
                min={1}
                value={estagio.prazo_dias}
                onChange={e => onChange({ ...estagio, prazo_dias: Number(e.target.value) || 7 })}
                className="h-6 w-12 text-[12px] border-0 p-0 focus-visible:ring-0"
              />
              <span className="text-[11px] text-muted-foreground/50">dias</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Passos */}
      <div className="p-4 space-y-2">
        {estagio.passos.map((p, i) => (
          <PassoEditor
            key={p._id}
            passo={p}
            ferramentas={ferramentas}
            categorias={categorias}
            aulas={aulas}
            onChange={updated => updatePasso(i, updated)}
            onDelete={() => deletePasso(i)}
            onMoveUp={() => movePasso(i, -1)}
            onMoveDown={() => movePasso(i, 1)}
            isFirst={i === 0}
            isLast={i === estagio.passos.length - 1}
          />
        ))}

        <button
          onClick={addPasso}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border/40 hover:border-border/70 text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar passo
        </button>
      </div>
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function AdminJornadaEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: jornada, isLoading } = useAdminJornada(id);
  const updateMeta = useUpdateJornadaMeta();
  const saveEstrutura = useSaveJornadaEstrutura();
  const deleteJornada = useDeleteJornada();

  const [titulo, setTitulo] = useState('');
  const [estagios, setEstagios] = useState<DraftEstagio[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: ferramentas } = useAdminFerramentas();
  const { data: categorias } = useAdminCategorias();

  const { data: aulas } = useQuery({
    queryKey: ['arsenal-aulas-all-editor'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('arsenal_aulas')
        .select('id, nome, slug, arsenal_blocos(nome)')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (jornada && estagios.length === 0 && !isDirty) {
      setTitulo(jornada.titulo);
      setEstagios(jornadaToDraft(jornada));
    }
  }, [jornada]);

  function markDirty<T>(fn: () => T): T {
    setIsDirty(true);
    return fn();
  }

  function addEstagio() {
    setEstagios(prev => [...prev, blankEstagio()]);
    setIsDirty(true);
  }

  function updateEstagio(i: number, e: DraftEstagio) {
    setEstagios(prev => { const next = [...prev]; next[i] = e; return next; });
    setIsDirty(true);
  }

  function deleteEstagio(i: number) {
    setEstagios(prev => prev.filter((_, j) => j !== i));
    setIsDirty(true);
  }

  function moveEstagio(i: number, dir: -1 | 1) {
    setEstagios(prev => {
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
    setIsDirty(true);
  }

  const handleSave = useCallback(async () => {
    if (!id) return;
    const promises: Promise<any>[] = [];
    if (titulo !== jornada?.titulo) {
      promises.push(updateMeta.mutateAsync({ id, titulo }));
    }
    promises.push(saveEstrutura.mutateAsync({ jornadaId: id, estagios }));
    await Promise.all(promises);
    setIsDirty(false);
  }, [id, titulo, estagios, jornada?.titulo]);

  const handlePublish = async () => {
    if (!id) return;
    await handleSave();
    await updateMeta.mutateAsync({ id, status: 'ativa' });
    toast.success('Jornada publicada para o cliente');
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!jornada) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">Jornada não encontrada.</p>
      <Button variant="ghost" onClick={() => navigate('/admin/jornadas')} className="mt-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
    </div>
  );

  const isSaving = updateMeta.isPending || saveEstrutura.isPending;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* ─── Top bar ─── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/admin/jornadas')} className="h-8 rounded-lg text-xs gap-1.5 px-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Jornadas
        </Button>
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-[11px] text-muted-foreground">Excluir jornada?</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 px-2.5 text-[11px]">Cancelar</Button>
              <Button
                size="sm"
                onClick={async () => { await deleteJornada.mutateAsync(id!); navigate('/admin/jornadas'); }}
                disabled={deleteJornada.isPending}
                className="h-7 px-2.5 text-[11px] font-semibold bg-destructive text-white hover:bg-destructive/90 rounded-lg gap-1"
              >
                {deleteJornada.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Excluir
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="h-8 w-8 text-muted-foreground/50 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Select
            value={jornada.status}
            onValueChange={v => updateMeta.mutateAsync({ id: id!, status: v })}
          >
            <SelectTrigger className="h-8 rounded-lg text-[11px] border-border/60 gap-1.5 w-auto px-2.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar rascunho
          </Button>
          {jornada.status === 'rascunho' && (
            <Button
              onClick={handlePublish}
              disabled={isSaving}
              className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
            >
              <ExternalLink className="h-3 w-3" /> Publicar para cliente
            </Button>
          )}
        </div>
      </div>

      {/* ─── Title + client ─── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted"><Route className="h-3.5 w-3.5 text-muted-foreground" /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">JORNADA</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                Cliente: {jornada.perfis?.nome_completo || jornada.perfis?.email || '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</Label>
            <Input
              value={titulo}
              onChange={e => { setTitulo(e.target.value); setIsDirty(true); }}
              placeholder="Título da jornada"
              className="h-10 text-sm rounded-lg border-border/60"
            />
          </div>
        </div>
      </div>

      {/* ─── Estrutura ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">Etapas</p>
          <Button
            variant="outline"
            size="sm"
            onClick={addEstagio}
            className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
          >
            <Plus className="h-3.5 w-3.5" /> Nova etapa
          </Button>
        </div>

        {estagios.map((e, i) => (
          <EstagioEditor
            key={e._id}
            estagio={e}
            ferramentas={ferramentas ?? []}
            categorias={categorias ?? []}
            aulas={aulas ?? []}
            onChange={updated => updateEstagio(i, updated)}
            onDelete={() => deleteEstagio(i)}
            onMoveUp={() => moveEstagio(i, -1)}
            onMoveDown={() => moveEstagio(i, 1)}
            isFirst={i === 0}
            isLast={i === estagios.length - 1}
            index={i}
          />
        ))}

        {estagios.length === 0 && (
          <button
            onClick={addEstagio}
            className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border-2 border-dashed border-border/40 hover:border-border/70 text-muted-foreground/50 hover:text-muted-foreground transition-all"
          >
            <Route className="h-6 w-6" />
            <span className="text-[13px]">Adicionar primeira etapa</span>
          </button>
        )}
      </div>

      {/* Save footer */}
      {isDirty && (
        <div className="flex items-center justify-end gap-2 py-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar alterações
          </Button>
        </div>
      )}
    </div>
  );
}
