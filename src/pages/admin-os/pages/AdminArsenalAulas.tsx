import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  GripVertical, Plus, Pencil, Trash2, Loader2, Eye, EyeOff,
  Video, FileText, ExternalLink, Save, GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useAdminBlocos, useAdminAulas, useCreateAula, useUpdateAula, useDeleteAula,
  useCreateBloco, useUpdateBloco, useDeleteBloco,
  AdminBloco, AdminAula, toSlug,
} from '@/hooks/useAdminArsenal';

// ─── YouTube embed helper ─────────────────────────────────────────────────────

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v');
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch { return null; }
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

interface SortableAulaRowProps {
  aula: AdminAula;
  index: number;
  onEdit: () => void;
  onToggleAtivo: () => void;
  onDelete: () => void;
}

function SortableAulaRow({ aula, index, onEdit, onToggleAtivo, onDelete }: SortableAulaRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: aula.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex-shrink-0 w-5 text-[11px] font-display text-muted-foreground/40 tabular-nums">
        {index + 1}
      </span>

      <span className="flex-1 text-[13px] font-medium text-foreground truncate">
        {aula.nome}
      </span>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {aula.video_url && (
          <span title="Tem vídeo"><Video className="h-3.5 w-3.5 text-blue-500" /></span>
        )}
        {aula.texto_aprenda && (
          <span title="Tem conteúdo texto"><FileText className="h-3.5 w-3.5 text-emerald-500" /></span>
        )}
      </div>

      <span className={cn(
        'flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium border',
        aula.ativo
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-muted border-border/60 text-muted-foreground',
      )}>
        {aula.ativo ? 'Ativo' : 'Inativo'}
      </span>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggleAtivo}
          title={aula.ativo ? 'Desativar' : 'Ativar'}>
          {aula.ativo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete} title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Bloco Modal ─────────────────────────────────────────────────────────────

interface BlocoModalProps {
  open: boolean;
  onClose: () => void;
  bloco: Partial<AdminBloco> | null;
  nextOrdem: number;
}

function BlocoModal({ open, onClose, bloco, nextOrdem }: BlocoModalProps) {
  const createBloco = useCreateBloco();
  const updateBloco = useUpdateBloco();
  const isEdit = !!bloco?.id;

  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [slugError, setSlugError] = useState('');

  useEffect(() => {
    if (open) {
      setNome(bloco?.nome ?? '');
      setSlug(bloco?.slug ?? '');
      setSlugManual(!!bloco?.id);
      setSlugError('');
    }
  }, [open, bloco]);

  const handleNomeChange = (v: string) => {
    setNome(v);
    if (!slugManual) setSlug(toSlug(v));
  };

  const handleSlugChange = (v: string) => {
    setSlug(v);
    setSlugManual(true);
    setSlugError('');
  };

  const validateSlug = async (): Promise<boolean> => {
    if (!slug) return false;
    const q = supabase.from('arsenal_blocos' as any).select('id').eq('slug', slug);
    if (isEdit) (q as any).neq('id', bloco!.id!);
    const { data } = await q;
    if (data && data.length > 0) {
      setSlugError('Slug já está em uso. Escolha outro.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    if (!slug.trim()) { toast.error('Slug é obrigatório.'); return; }
    const slugOk = await validateSlug();
    if (!slugOk) return;
    try {
      if (isEdit) {
        await updateBloco.mutateAsync({ id: bloco!.id!, nome: nome.trim(), slug: slug.trim() });
        toast.success('Bloco atualizado.');
      } else {
        await createBloco.mutateAsync({ nome: nome.trim(), slug: slug.trim(), ordem: nextOrdem });
        toast.success('Bloco criado.');
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar.');
    }
  };

  const isSaving = createBloco.isPending || updateBloco.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Bloco' : 'Novo Bloco'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nome do Bloco *
            </Label>
            <Input
              value={nome}
              onChange={e => handleNomeChange(e.target.value)}
              placeholder="Ex: Plataforma e Tecnologia"
              className="h-10 text-sm rounded-lg border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Slug
            </Label>
            <Input
              value={slug}
              onChange={e => handleSlugChange(e.target.value)}
              placeholder="ex: plataforma-tecnologia"
              className={cn('h-10 text-sm rounded-lg border-border/60 font-mono', slugError && 'border-destructive')}
            />
            {slugError && <p className="text-[11px] text-destructive">{slugError}</p>}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-foreground text-background hover:bg-foreground/90 gap-1.5"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isEdit ? 'Atualizar' : 'Criar Bloco'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aula Modal ───────────────────────────────────────────────────────────────

interface AulaModalProps {
  open: boolean;
  onClose: () => void;
  aula: Partial<AdminAula> | null;
  blocos: AdminBloco[];
}

function AulaModal({ open, onClose, aula, blocos }: AulaModalProps) {
  const createAula = useCreateAula();
  const updateAula = useUpdateAula();
  const isEdit = !!aula?.id;

  const [blocoId, setBlocoId] = useState('');
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [textoAprenda, setTextoAprenda] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [slugError, setSlugError] = useState('');
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (open) {
      setBlocoId(aula?.bloco_id ?? (blocos[0]?.id ?? ''));
      setNome(aula?.nome ?? '');
      setSlug(aula?.slug ?? '');
      setSlugManual(!!aula?.id);
      setDescricao(aula?.descricao ?? '');
      setVideoUrl(aula?.video_url ?? '');
      setTextoAprenda(aula?.texto_aprenda ?? '');
      setAtivo(aula?.ativo ?? true);
      setSlugError('');
      setPreviewTab('edit');
    }
  }, [open, aula, blocos]);

  const handleNomeChange = (v: string) => {
    setNome(v);
    if (!slugManual) setSlug(toSlug(v));
  };

  const handleSlugChange = (v: string) => {
    setSlug(v);
    setSlugManual(true);
    setSlugError('');
  };

  const validateSlug = async (): Promise<boolean> => {
    if (!slug) return false;
    const q = supabase.from('arsenal_aulas' as any).select('id').eq('slug', slug);
    if (isEdit) (q as any).neq('id', aula!.id!);
    const { data } = await q;
    if (data && data.length > 0) {
      setSlugError('Slug já está em uso. Escolha outro.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    if (!slug.trim()) { toast.error('Slug é obrigatório.'); return; }
    if (!blocoId) { toast.error('Selecione um bloco.'); return; }

    const slugOk = await validateSlug();
    if (!slugOk) return;

    const payload = {
      bloco_id: blocoId,
      nome: nome.trim(),
      slug: slug.trim(),
      descricao: descricao.trim() || null,
      video_url: videoUrl.trim() || null,
      texto_aprenda: textoAprenda.trim() || null,
      ativo,
    };

    try {
      if (isEdit) {
        await updateAula.mutateAsync({ id: aula!.id!, ...payload });
        toast.success('Aula atualizada.');
      } else {
        const { data: existing } = await supabase
          .from('arsenal_aulas' as any)
          .select('ordem')
          .eq('bloco_id', blocoId)
          .order('ordem', { ascending: false })
          .limit(1);
        const maxOrdem = ((existing?.[0] as any)?.ordem ?? 0) as number;
        await createAula.mutateAsync({ ...payload, ordem: maxOrdem + 1 } as any);
        toast.success('Aula criada.');
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar.');
    }
  };

  const embedUrl = videoUrl ? toEmbedUrl(videoUrl) : null;
  const isSaving = createAula.isPending || updateAula.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-muted">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">{isEdit ? 'Editar Aula' : 'Nova Aula'}</p>
              <p className="text-[11px] text-muted-foreground/60">Vídeo + conteúdo textual para os alunos da plataforma</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Bloco + Nome */}
          <div className="rounded-xl border border-border/60 bg-muted/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Identificação</p>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bloco</Label>
              <Select value={blocoId} onValueChange={setBlocoId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o bloco" /></SelectTrigger>
                <SelectContent>
                  {blocos.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da Aula *</Label>
              <Input value={nome} onChange={e => handleNomeChange(e.target.value)} placeholder="Ex: Como Operar o CRM" className="h-9 text-sm" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                Slug
                {!slugManual && nome && (
                  <span className="text-[10px] text-muted-foreground/40 normal-case font-normal">gerado automaticamente</span>
                )}
              </Label>
              <Input
                value={slug}
                onChange={e => handleSlugChange(e.target.value)}
                placeholder="ex: como-operar-crm"
                className={cn('h-9 text-sm font-mono border-border/60', slugError && 'border-destructive')}
              />
              {slugError && <p className="text-[11px] text-destructive">{slugError}</p>}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição curta</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Exibida no card da aula na listagem" rows={2} className="text-sm resize-none" />
          </div>

          {/* Vídeo */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Video className="h-3 w-3" /> URL do Vídeo (YouTube)
            </Label>
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="h-9 text-sm font-mono text-xs" />
            {embedUrl && (
              <div className="aspect-video rounded-xl overflow-hidden border border-border/60 bg-black mt-2">
                <iframe src={embedUrl} className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen title="Preview do vídeo" />
              </div>
            )}
          </div>

          {/* Conteúdo Aprenda */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conteúdo "Aprenda"
              </Label>
              <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
                {(['edit', 'preview'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setPreviewTab(t)}
                    className={cn('px-3 py-1 text-[11px] font-medium rounded-md transition-all',
                      previewTab === t ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    {t === 'edit' ? 'Editar' : 'Preview'}
                  </button>
                ))}
              </div>
            </div>
            {previewTab === 'edit' ? (
              <Textarea value={textoAprenda} onChange={e => setTextoAprenda(e.target.value)}
                placeholder="Texto exibido abaixo do vídeo na página da aula..."
                rows={7} className="text-sm resize-y font-mono text-xs bg-muted/20" />
            ) : (
              <div className="min-h-[140px] rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-[13px] text-foreground/80 leading-[1.8] whitespace-pre-wrap">
                {textoAprenda || <span className="text-muted-foreground/30 italic">Sem conteúdo</span>}
              </div>
            )}
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-border/60 bg-muted/[0.02]">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Aula ativa</p>
              <p className="text-[11px] text-muted-foreground/50">Visível para os alunos na plataforma</p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-t border-border/40 bg-muted/20">
          <div>
            {isEdit && aula?.slug && (
              <Button type="button" variant="ghost" size="sm"
                className="h-8 text-[11px] gap-1.5 text-muted-foreground"
                onClick={() => window.open(`/plataforma/arsenal/aulas/${aula.slug}`, '_blank')}>
                <ExternalLink className="h-3 w-3" /> Ver como cliente
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSaving} className="h-9 text-sm">Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}
              className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isEdit ? 'Salvar alterações' : 'Criar aula'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminArsenalAulas() {
  const { data: blocos = [], isLoading: blocosLoading } = useAdminBlocos();
  const { data: aulasDB = [], isLoading: aulasLoading } = useAdminAulas();
  const updateAula = useUpdateAula();
  const deleteAula = useDeleteAula();
  const deleteBloco = useDeleteBloco();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAula, setEditingAula] = useState<Partial<AdminAula> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAula | null>(null);

  // Bloco CRUD state
  const [blocoModalOpen, setBlocoModalOpen] = useState(false);
  const [editingBloco, setEditingBloco] = useState<Partial<AdminBloco> | null>(null);
  const [deleteBlocoTarget, setDeleteBlocoTarget] = useState<AdminBloco | null>(null);

  // Local state for optimistic drag reorder
  const [localAulas, setLocalAulas] = useState<AdminAula[]>([]);
  useEffect(() => { setLocalAulas(aulasDB); }, [aulasDB]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const aulasPerBloco = (blocoId: string) =>
    localAulas.filter(a => a.bloco_id === blocoId).sort((a, b) => a.ordem - b.ordem);

  const handleDragEnd = async (event: DragEndEvent, blocoId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const list = aulasPerBloco(blocoId);
    const oldIdx = list.findIndex(a => a.id === active.id);
    const newIdx = list.findIndex(a => a.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(list, oldIdx, newIdx).map((a, i) => ({ ...a, ordem: i + 1 }));
    setLocalAulas(prev => [...prev.filter(a => a.bloco_id !== blocoId), ...reordered]);

    try {
      await Promise.all(
        reordered.map(a => supabase.from('arsenal_aulas' as any).update({ ordem: a.ordem }).eq('id', a.id))
      );
    } catch {
      toast.error('Erro ao reordenar.');
      setLocalAulas(aulasDB);
    }
  };

  const handleToggleAtivo = async (a: AdminAula) => {
    try {
      await updateAula.mutateAsync({ id: a.id, ativo: !a.ativo });
      toast.success(a.ativo ? 'Aula desativada.' : 'Aula ativada.');
    } catch {
      toast.error('Erro ao alterar status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAula.mutateAsync(deleteTarget.id);
      toast.success('Aula excluída.');
      setDeleteTarget(null);
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  const openCreate = () => { setEditingAula(null); setModalOpen(true); };
  const openEdit = (a: AdminAula) => { setEditingAula(a); setModalOpen(true); };

  const handleDeleteBloco = async () => {
    if (!deleteBlocoTarget) return;
    try {
      await deleteBloco.mutateAsync(deleteBlocoTarget.id);
      toast.success('Bloco excluído.');
      setDeleteBlocoTarget(null);
    } catch {
      toast.error('Erro ao excluir bloco. Remova as aulas antes de excluir o bloco.');
    }
  };

  const isLoading = blocosLoading || aulasLoading;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Aulas do Arsenal</h2>
            <p className="text-[11px] text-muted-foreground/60">
              {localAulas.length} aulas em {blocos.length} blocos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setEditingBloco(null); setBlocoModalOpen(true); }}
            className="h-9 rounded-lg text-xs font-medium border-border/60 px-4 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Bloco
          </Button>
          <Button
            onClick={openCreate}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Aula
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {blocos.map(bloco => {
            const blocoAulas = aulasPerBloco(bloco.id);
            return (
              <div key={bloco.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                {/* Bloco header */}
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-muted">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          {bloco.nome}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {blocoAulas.length} aulas · arraste para reordenar
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setEditingBloco(bloco); setBlocoModalOpen(true); }}
                        title="Editar bloco"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteBlocoTarget(bloco)}
                        title="Excluir bloco"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lista com DnD */}
                {blocoAulas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/40 mb-3">
                      <GraduationCap className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma aula neste bloco</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                      Clique em "+ Nova Aula" para adicionar.
                    </p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={e => handleDragEnd(e, bloco.id)}
                  >
                    <SortableContext items={blocoAulas.map(a => a.id)} strategy={verticalListSortingStrategy}>
                      {blocoAulas.map((aula, idx) => (
                        <SortableAulaRow
                          key={aula.id}
                          aula={aula}
                          index={idx}
                          onEdit={() => openEdit(aula)}
                          onToggleAtivo={() => handleToggleAtivo(aula)}
                          onDelete={() => setDeleteTarget(aula)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal criar/editar bloco */}
      <BlocoModal
        open={blocoModalOpen}
        onClose={() => { setBlocoModalOpen(false); setEditingBloco(null); }}
        bloco={editingBloco}
        nextOrdem={blocos.length + 1}
      />

      {/* Confirmar exclusão de bloco */}
      <AlertDialog open={!!deleteBlocoTarget} onOpenChange={v => !v && setDeleteBlocoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bloco?</AlertDialogTitle>
            <AlertDialogDescription>
              O bloco <strong>{deleteBlocoTarget?.nome}</strong> e todas as suas aulas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBloco}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal criar/editar aula */}
      <AulaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAula(null); }}
        aula={editingAula}
        blocos={blocos}
      />

      {/* Confirmar exclusão de aula */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
            <AlertDialogDescription>
              A aula <strong>{deleteTarget?.nome}</strong> será excluída permanentemente.
              O progresso dos alunos nesta aula também será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
