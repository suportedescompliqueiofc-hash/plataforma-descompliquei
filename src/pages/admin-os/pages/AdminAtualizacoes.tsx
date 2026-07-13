import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Megaphone, Loader2, Sparkles, TrendingUp, Wrench, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useAdminAtualizacoesList, useCreateAtualizacao, useUpdateAtualizacao,
  useDeleteAtualizacao, useToggleAtualizacaoPublicado, useResendAtualizacoes,
  type AdminAtualizacao, type AtualizacaoForm,
} from '@/hooks/useAdminAtualizacoes';
import { AREA_OPTIONS, CATEGORIA_OPTIONS, type CategoriaKey } from '@/lib/atualizacoesAreas';
import { tutorials } from '@/components/tutorial/tutorialData';

const CATEGORIA_ICON: Record<CategoriaKey, typeof Sparkles> = {
  novidade: Sparkles,
  melhoria: TrendingUp,
  correcao: Wrench,
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

const EMPTY_FORM: AtualizacaoForm = {
  titulo: '',
  descricao: '',
  categoria: 'novidade',
  areas: [],
  rota_destino: '',
  tutorial_alvo: '',
  publicado: false,
  publicado_em: toLocalInputValue(new Date().toISOString()),
};

export default function AdminAtualizacoes() {
  const { data: itens = [], isLoading } = useAdminAtualizacoesList();
  const createMutation = useCreateAtualizacao();
  const updateMutation = useUpdateAtualizacao();
  const deleteMutation = useDeleteAtualizacao();
  const toggleMutation = useToggleAtualizacaoPublicado();
  const resendMutation = useResendAtualizacoes();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [form, setForm] = useState<AtualizacaoForm>(EMPTY_FORM);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: AdminAtualizacao) {
    setEditingId(item.id);
    setForm({
      titulo: item.titulo,
      descricao: item.descricao,
      categoria: item.categoria,
      areas: item.areas || [],
      rota_destino: item.rota_destino || '',
      tutorial_alvo: item.tutorial_alvo || '',
      publicado: item.publicado,
      publicado_em: toLocalInputValue(item.publicado_em),
    });
    setModalOpen(true);
  }

  function toggleArea(key: string) {
    setForm(f => ({
      ...f,
      areas: f.areas.includes(key) ? f.areas.filter(a => a !== key) : [...f.areas, key],
    }));
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.descricao.trim()) {
      toast.error('Título e descrição são obrigatórios.');
      return;
    }
    const payload: AtualizacaoForm = {
      ...form,
      publicado_em: new Date(form.publicado_em).toISOString(),
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, form: payload });
        toast.success('Atualização salva.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Atualização criada.');
      }
      setModalOpen(false);
    } catch {
      toast.error('Erro ao salvar atualização.');
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success('Atualização excluída.');
      setDeleteId(null);
    } catch {
      toast.error('Erro ao excluir atualização.');
    }
  }

  async function handleToggle(item: AdminAtualizacao) {
    try {
      await toggleMutation.mutateAsync({ id: item.id, publicado: !item.publicado });
      toast.success(item.publicado ? 'Despublicado.' : 'Publicado.');
    } catch {
      toast.error('Erro ao alterar status.');
    }
  }

  async function handleResend() {
    try {
      const count = await resendMutation.mutateAsync();
      toast.success(`Reenviado! O popup de novidades vai reaparecer para ${count} usuários, em todas as orgs.`);
      setResendConfirmOpen(false);
    } catch {
      toast.error('Erro ao reenviar as atualizações.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Atualizações</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Changelog da plataforma exibido pra cada cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setResendConfirmOpen(true)}
            className="h-9 rounded-lg text-xs font-semibold border-border/60 px-4 gap-1.5"
          >
            <Send className="h-3.5 w-3.5" /> Reenviar para todos
          </Button>
          <Button
            onClick={openCreate}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Nova Atualização
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Megaphone className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma atualização cadastrada</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Publique a primeira novidade da plataforma</p>
          <Button variant="outline" size="sm" onClick={openCreate} className="mt-4 gap-1.5 h-8 rounded-lg text-[11px]">
            <Plus className="h-3.5 w-3.5" /> Criar atualização
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {itens.map(item => {
            const Icon = CATEGORIA_ICON[item.categoria];
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-opacity"
                style={{ opacity: item.publicado ? 1 : 0.6 }}
              >
                <div className="px-5 pt-5 pb-4 border-b border-border/40">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-[15px] font-bold text-foreground font-display leading-tight flex-1 min-w-0">
                      {item.titulo}
                    </h3>
                    <span className={cn(
                      'shrink-0 mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      item.publicado
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border/40'
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', item.publicado ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                      {item.publicado ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                    <Icon className="h-3 w-3" />
                    <span>{CATEGORIA_OPTIONS.find(c => c.key === item.categoria)?.label}</span>
                    <span>· {formatDistanceToNow(new Date(item.publicado_em), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mt-2">{item.descricao}</p>
                  {item.areas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.areas.map(a => (
                        <span key={a} className="text-[9px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">
                          {AREA_OPTIONS.find(o => o.key === a)?.label || a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-5 py-3 mt-auto">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)} title="Editar">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(item.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                  <Switch checked={item.publicado} onCheckedChange={() => handleToggle(item)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-bold tracking-tight">
              {editingId ? 'Editar atualização' : 'Nova atualização'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</Label>
              <Input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="h-10 text-sm rounded-lg border-border/60 mt-1"
                placeholder="Ex: Nova aba de Materiais no Arsenal"
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                className="text-sm rounded-lg border-border/60 mt-1"
                rows={4}
                placeholder="Suporta **negrito**, quebras de linha e bullets (• item)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as CategoriaKey }))}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {CATEGORIA_OPTIONS.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Publicar em</Label>
                <Input
                  type="datetime-local"
                  value={form.publicado_em}
                  onChange={e => setForm(f => ({ ...f, publicado_em: e.target.value }))}
                  className="h-10 text-sm rounded-lg border-border/60 mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Áreas visíveis</Label>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 mb-2">Nenhuma marcada = visível pra todo mundo</p>
              <div className="grid grid-cols-2 gap-2">
                {AREA_OPTIONS.map(area => (
                  <label key={area.key} className="flex items-center gap-2 text-[12px] text-foreground/80">
                    <Checkbox checked={form.areas.includes(area.key)} onCheckedChange={() => toggleArea(area.key)} />
                    {area.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rota de destino (opcional)</Label>
              <Input
                value={form.rota_destino}
                onChange={e => setForm(f => ({ ...f, rota_destino: e.target.value }))}
                className="h-10 text-sm rounded-lg border-border/60 mt-1"
                placeholder="/plataforma/arsenal"
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tutorial relacionado (opcional)</Label>
              <Select value={form.tutorial_alvo || '__none__'} onValueChange={v => setForm(f => ({ ...f, tutorial_alvo: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {tutorials.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/60 px-4 py-3 flex items-center justify-between bg-muted/20">
              <div>
                <p className="text-sm font-medium">Publicado</p>
                <p className="text-[11px] text-muted-foreground/60">Só itens publicados aparecem pros clientes</p>
              </div>
              <Switch checked={form.publicado} onCheckedChange={v => setForm(f => ({ ...f, publicado: v }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-lg text-xs">Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-lg text-xs bg-foreground text-background hover:bg-foreground/90"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">Excluir atualização?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Essa atualização será removida permanentemente do changelog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-2">
            <AlertDialogCancel className="rounded-lg text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 rounded-lg text-xs"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resend confirmation */}
      <AlertDialog open={resendConfirmOpen} onOpenChange={setResendConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold tracking-tight">Reenviar novidades para todos?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              O popup de "Novidades da plataforma" e o badge da sidebar vão reaparecer para <strong>todos os usuários, em todas as orgs</strong> — inclusive quem já tinha visto ou dispensado as atualizações publicadas até agora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-2">
            <AlertDialogCancel className="rounded-lg text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResend}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-lg text-xs"
              disabled={resendMutation.isPending}
            >
              {resendMutation.isPending ? 'Reenviando...' : 'Sim, reenviar para todos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
